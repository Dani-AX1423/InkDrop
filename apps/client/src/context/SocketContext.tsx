'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import {
  PublicRoomInfo,
  ChatMessage,
  ActiveRoomState,
  RateLimitNotice,
  ConnectionStatus,
  DeliveryAck,
  RoomOperationResult,
  TTLMinutes,
  SendMessagePayload,
} from '../types';
import { playMessageChime, playSystemChime, playSendSound, playErrorSound } from '../lib/audio';
import { useSettings, getStoredUsername } from '../hooks/useSettings';

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  wakingElapsedSeconds: number;
  retryConnection: () => void;
  latencyMs: number | null;
  username: string;
  setUsername: (name: string) => void;
  rooms: PublicRoomInfo[];
  activeRoom: ActiveRoomState | null;
  messages: ChatMessage[];
  rateLimitNotice: RateLimitNotice | null;
  isRateLimited: boolean;
  rateLimitProgress: number; // 0 to 100%
  clockSkewMs: number;
  evaporatedNotice: string | null;
  clearEvaporatedNotice: () => void;
  createRoom: (
    name: string,
    password?: string,
    customUsername?: string,
    ttlMinutes?: TTLMinutes
  ) => Promise<RoomOperationResult>;
  joinRoom: (
    roomId: string,
    password?: string,
    customUsername?: string
  ) => Promise<RoomOperationResult>;
  leaveRoom: () => void;
  sendMessage: (payload: string | SendMessagePayload) => Promise<DeliveryAck>;
  sendImage: (dataUrl: string, caption?: string) => Promise<DeliveryAck>;
  requestRoomList: () => void;
  clearRateLimitNotice: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Read server URL from NEXT_PUBLIC_SERVER_URL (or fallback NEXT_PUBLIC_SOCKET_SERVER_URL)
const RAW_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;

if (typeof window !== 'undefined' && !RAW_SERVER_URL && process.env.NODE_ENV === 'development') {
  console.error(
    '❌ [InkDrop Client Fatal] Missing required environment variable: NEXT_PUBLIC_SERVER_URL.\n' +
      'Please create apps/client/.env.local (see apps/client/.env.example) and set NEXT_PUBLIC_SERVER_URL=http://localhost:4000'
  );
}

const SERVER_URL = RAW_SERVER_URL || 'http://localhost:4000';

export function SocketProvider({ children }: { children: ReactNode }) {
  const { username, setUsername, soundEnabled } = useSettings();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [wakingElapsedSeconds, setWakingElapsedSeconds] = useState<number>(0);
  const [evaporatedNotice, setEvaporatedNotice] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [rooms, setRooms] = useState<PublicRoomInfo[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rateLimitNotice, setRateLimitNotice] = useState<RateLimitNotice | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [rateLimitProgress, setRateLimitProgress] = useState<number>(0);
  const [clockSkewMs, setClockSkewMs] = useState<number>(0);

  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usernameRef = useRef<string>(username);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  // Connection State Machine Refs
  const hasConnectedOnceRef = useRef<boolean>(false);
  const connectionStartTimeRef = useRef<number>(Date.now());
  const wakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthBackoffMsRef = useRef<number>(1000);
  const activeRoomIdRef = useRef<string | null>(null);
  // Store locked pool passwords strictly in-memory (never in localStorage or disk)
  const inMemoryPasswordMap = useRef<Map<string, string>>(new Map());

  // Keep refs synchronized
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Keep activeRoomIdRef in sync
  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id || null;
  }, [activeRoom]);

  // Waking sequence with exponential health probe polling
  const startWakingSequence = useCallback(() => {
    setConnectionStatus('waking');
    connectionStartTimeRef.current = Date.now();
    healthBackoffMsRef.current = 1000;

    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    elapsedIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - connectionStartTimeRef.current) / 1000);
      setWakingElapsedSeconds(elapsed);

      // Give up gracefully after 90 seconds
      if (elapsed >= 90) {
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        if (healthPollTimeoutRef.current) clearTimeout(healthPollTimeoutRef.current);
        setConnectionStatus('offline');
      }
    }, 1000);

    const pollHealth = async () => {
      if (hasConnectedOnceRef.current && socketRef.current?.connected) return;
      const elapsed = Math.floor((Date.now() - connectionStartTimeRef.current) / 1000);
      if (elapsed >= 90) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${SERVER_URL}/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.status === 'ok') {
            // Server woke up! Trigger socket connect immediately
            if (socketRef.current && !socketRef.current.connected) {
              socketRef.current.connect();
            }
            return;
          }
        }
      } catch {
        // Cold start in progress
      }

      // Exponential backoff (1s, 2s, 4s, capped at 8s)
      healthBackoffMsRef.current = Math.min(8000, healthBackoffMsRef.current * 2);
      healthPollTimeoutRef.current = setTimeout(pollHealth, healthBackoffMsRef.current);
    };

    pollHealth();
  }, []);

  // Manual retry connection
  const retryConnection = useCallback(() => {
    if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (healthPollTimeoutRef.current) clearTimeout(healthPollTimeoutRef.current);

    setWakingElapsedSeconds(0);
    setConnectionStatus('connecting');
    connectionStartTimeRef.current = Date.now();

    if (socketRef.current) {
      socketRef.current.connect();
    }

    wakingTimerRef.current = setTimeout(() => {
      if (!hasConnectedOnceRef.current && (!socketRef.current || !socketRef.current.connected)) {
        startWakingSequence();
      }
    }, 3000);
  }, [startWakingSequence]);

  // Socket Lifecycle Connection
  useEffect(() => {
    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = s;
    setSocket(s);

    // Initial 3-second waking threshold
    wakingTimerRef.current = setTimeout(() => {
      if (!hasConnectedOnceRef.current && !s.connected) {
        startWakingSequence();
      }
    }, 3000);

    s.on('connect', () => {
      // Clear waking timers
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (healthPollTimeoutRef.current) clearTimeout(healthPollTimeoutRef.current);

      setConnectionStatus('connected');
      setWakingElapsedSeconds(0);
      hasConnectedOnceRef.current = true;
      s.emit('request_room_list');

      // Start Latency Ping Probe
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (s.connected) {
          const start = Date.now();
          s.emit('ping_gateway', start, () => {
            const rtt = Math.max(1, Date.now() - start);
            setLatencyMs(rtt);
          });
        }
      }, 5000);

      // Automatic Room Rejoin after mid-session reconnect
      const lastRoomId = activeRoomIdRef.current;
      if (lastRoomId) {
        const inMemPassword = inMemoryPasswordMap.current.get(lastRoomId);
        const currentUser = usernameRef.current || getStoredUsername();

        s.emit(
          'join_room',
          { roomId: lastRoomId, password: inMemPassword, username: currentUser },
          (res: RoomOperationResult) => {
            if (res?.success && res.room) {
              setActiveRoom(res.room);
              if (res.serverNow) {
                setClockSkewMs(res.serverNow - Date.now());
              }
            } else {
              // Pool evaporated while disconnected (e.g. server restart)
              setActiveRoom(null);
              activeRoomIdRef.current = null;
              inMemoryPasswordMap.current.delete(lastRoomId);
              setEvaporatedNotice('This pool evaporated while you were away');
            }
          }
        );
      }
    });

    s.on('disconnect', () => {
      setLatencyMs(null);
      if (hasConnectedOnceRef.current) {
        setConnectionStatus('reconnecting');

        // Track 90-second give-up if disconnected permanently
        connectionStartTimeRef.current = Date.now();
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - connectionStartTimeRef.current) / 1000);
          if (elapsed >= 90) {
            if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
            setConnectionStatus('offline');
          }
        }, 1000);
      } else {
        setConnectionStatus('connecting');
      }
    });

    s.on('connect_error', () => {
      setLatencyMs(null);
      if (hasConnectedOnceRef.current) {
        setConnectionStatus('reconnecting');
      }
    });

    s.on('room_list_update', (roomList: PublicRoomInfo[]) => {
      setRooms(roomList || []);
    });

    s.on('new_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-199), message]);

      const isSoundActive = soundEnabledRef.current;
      const currentSender = usernameRef.current;

      if (message.isSystem) {
        playSystemChime(isSoundActive);
      } else if (message.sender !== currentSender) {
        playMessageChime(isSoundActive);
      }
    });

    s.on('room_info_update', (info: { roomId: string; name?: string; isPrivate?: boolean; userCount: number; expiresAt?: number }) => {
      setActiveRoom((prev) => {
        if (!prev || prev.id !== info.roomId) return prev;
        return {
          ...prev,
          name: info.name ?? prev.name,
          isPrivate: info.isPrivate ?? prev.isPrivate,
          userCount: info.userCount,
          expiresAt: info.expiresAt !== undefined ? info.expiresAt : prev.expiresAt,
        };
      });
    });

    s.on('room_joined', (room: ActiveRoomState) => {
      setActiveRoom(room);
    });

    s.on('room_expired', (data: { roomId: string; reason?: string }) => {
      setActiveRoom((prev) => {
        if (prev?.id === data.roomId) {
          return {
            ...prev,
            userCount: 0,
          };
        }
        return prev;
      });
    });

    s.on('room_evaporated', (data: { roomId: string; reason?: string }) => {
      setActiveRoom((prev) => {
        if (prev?.id === data.roomId) {
          setMessages((msgs) => [
            ...msgs.slice(-199),
            {
              id: 'evap-' + Date.now(),
              sender: 'SYSTEM',
              text: 'This pool has completely evaporated from memory.',
              timestamp: Date.now(),
              isSystem: true,
              systemType: 'leave',
            },
          ]);
        }
        return prev;
      });
    });

    s.on('429_too_many_requests', (payload: { code: number; message: string; retryAfterMs: number }) => {
      playErrorSound(soundEnabledRef.current);
      const notice: RateLimitNotice = {
        message: payload.message || 'Transmission burst limit exceeded.',
        retryAfterMs: payload.retryAfterMs || 2000,
        receivedAt: Date.now(),
      };
      setRateLimitNotice(notice);
      setIsRateLimited(true);
      setRateLimitProgress(100);

      const duration = payload.retryAfterMs || 2000;
      const startTime = Date.now();

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setRateLimitProgress(remaining);

        if (elapsed >= duration) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setIsRateLimited(false);
          setRateLimitProgress(0);
        }
      }, 50);

      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => {
        setRateLimitNotice(null);
        setIsRateLimited(false);
        setRateLimitProgress(0);
      }, duration);
    });

    return () => {
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (healthPollTimeoutRef.current) clearTimeout(healthPollTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      s.disconnect();
    };
  }, [startWakingSequence]);

  const clearRateLimitNotice = useCallback(() => {
    setRateLimitNotice(null);
  }, []);

  const clearEvaporatedNotice = useCallback(() => {
    setEvaporatedNotice(null);
  }, []);

  const requestRoomList = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request_room_list');
    }
  }, []);

  const createRoom = useCallback(
    (
      name: string,
      password?: string,
      customUsername?: string,
      ttlMinutes?: TTLMinutes
    ): Promise<RoomOperationResult> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          return resolve({ success: false, error: 'Gateway socket disconnected.' });
        }

        const stored = getStoredUsername();
        const currentUsername =
          customUsername?.trim() ||
          username?.trim() ||
          stored ||
          (socketRef.current.id ? `Stranger_${socketRef.current.id.substring(0, 5)}` : 'node');

        socketRef.current.emit(
          'create_room',
          { roomName: name, password, username: currentUsername, ttlMinutes },
          (res: RoomOperationResult) => {
            if (res?.success && res.room) {
              setActiveRoom(res.room);
              activeRoomIdRef.current = res.room.id;
              if (password) {
                inMemoryPasswordMap.current.set(res.room.id, password);
              }
              setMessages([]);
              if (res.serverNow) {
                setClockSkewMs(res.serverNow - Date.now());
              }
              resolve({ success: true, room: res.room, serverNow: res.serverNow });
            } else {
              resolve({ success: false, error: res?.error || 'Failed creating pool.' });
            }
          }
        );
      });
    },
    [username]
  );

  const joinRoom = useCallback(
    (
      roomId: string,
      password?: string,
      customUsername?: string
    ): Promise<RoomOperationResult> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          return resolve({ success: false, error: 'Gateway socket disconnected.' });
        }

        const storedUsername = getStoredUsername();
        const currentUsername =
          customUsername?.trim() ||
          username?.trim() ||
          storedUsername ||
          (socketRef.current.id ? `Stranger_${socketRef.current.id.substring(0, 5)}` : 'node');

        socketRef.current.emit(
          'join_room',
          { roomId, password, username: currentUsername },
          (res: RoomOperationResult) => {
            if (res?.success && res.room) {
              setActiveRoom(res.room);
              activeRoomIdRef.current = res.room.id;
              if (password) {
                inMemoryPasswordMap.current.set(res.room.id, password);
              }
              setMessages([]);
              if (res.serverNow) {
                setClockSkewMs(res.serverNow - Date.now());
              }
              resolve({ success: true, room: res.room, serverNow: res.serverNow });
            } else {
              resolve({ success: false, error: res?.error || 'Authentication denied.' });
            }
          }
        );
      });
    },
    [username]
  );

  const leaveRoom = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_room');
    }
    if (activeRoomIdRef.current) {
      inMemoryPasswordMap.current.delete(activeRoomIdRef.current);
    }
    activeRoomIdRef.current = null;
    setActiveRoom(null);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    (payload: string | SendMessagePayload): Promise<DeliveryAck> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          playErrorSound(soundEnabledRef.current);
          return resolve({ status: 'error', reason: 'Socket disconnected' });
        }
        if (isRateLimited) {
          playErrorSound(soundEnabledRef.current);
          return resolve({ status: 'error', reason: 'Rate limited' });
        }

        let emitData: unknown = payload;
        if (typeof payload === 'string') {
          if (!payload.trim()) {
            return resolve({ status: 'error', reason: 'Empty payload' });
          }
          emitData = { type: 'text', text: payload.trim() };
        }

        socketRef.current.emit('send_message', emitData, (ack?: DeliveryAck) => {
          if (ack) {
            if (ack.status === 'ok') {
              playSendSound(soundEnabledRef.current);
            } else {
              playErrorSound(soundEnabledRef.current);
            }
            resolve(ack);
          } else {
            playSendSound(soundEnabledRef.current);
            resolve({ status: 'ok', timestamp: Date.now() });
          }
        });
      });
    },
    [isRateLimited]
  );

  const sendImage = useCallback(
    (dataUrl: string, caption?: string): Promise<DeliveryAck> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          playErrorSound(soundEnabledRef.current);
          return resolve({ status: 'error', reason: 'Socket disconnected' });
        }
        if (isRateLimited) {
          playErrorSound(soundEnabledRef.current);
          return resolve({ status: 'error', reason: 'Rate limited' });
        }

        const payload: SendMessagePayload = {
          type: 'image',
          dataUrl,
          caption: caption?.trim() || undefined,
        };

        socketRef.current.emit('send_message', payload, (ack?: DeliveryAck) => {
          if (ack) {
            if (ack.status === 'ok') {
              playSendSound(soundEnabledRef.current);
            } else {
              playErrorSound(soundEnabledRef.current);
            }
            resolve(ack);
          } else {
            playSendSound(soundEnabledRef.current);
            resolve({ status: 'ok', timestamp: Date.now() });
          }
        });
      });
    },
    [isRateLimited]
  );

  if (process.env.NODE_ENV === 'development' && !RAW_SERVER_URL) {
    return (
      <div className="min-h-screen bg-[#05070c] text-rose-300 p-8 flex flex-col items-center justify-center font-mono">
        <div className="max-w-md p-6 rounded-xl border border-rose-500/40 bg-rose-950/30 text-center">
          <h2 className="text-lg font-bold text-rose-300 mb-2">Missing NEXT_PUBLIC_SERVER_URL</h2>
          <p className="text-xs text-neutral-300 mb-4">
            InkDrop requires <code className="text-rose-200">NEXT_PUBLIC_SERVER_URL</code> to connect to the backend gateway.
          </p>
          <div className="text-xs text-left bg-black/60 p-3 rounded border border-white/10 text-neutral-400 space-y-1">
            <div>1. Copy <code>apps/client/.env.example</code> to <code>apps/client/.env.local</code></div>
            <div>2. Set <code>NEXT_PUBLIC_SERVER_URL=http://localhost:4000</code></div>
            <div>3. Restart Next.js dev server</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        connectionStatus,
        wakingElapsedSeconds,
        retryConnection,
        latencyMs,
        username,
        setUsername,
        rooms,
        activeRoom,
        messages,
        rateLimitNotice,
        isRateLimited,
        rateLimitProgress,
        clockSkewMs,
        evaporatedNotice,
        clearEvaporatedNotice,
        createRoom,
        joinRoom,
        leaveRoom,
        sendMessage,
        sendImage,
        requestRoomList,
        clearRateLimitNotice,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
