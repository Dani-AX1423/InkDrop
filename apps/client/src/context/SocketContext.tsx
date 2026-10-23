'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
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
import { clientSanitizeMessage } from '../lib/moderation';

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
  retryMessage?: (failedMessage: ChatMessage) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Module-level in-memory rooms cache to pre-fill lobby instantaneously without waiting
// Global lightweight latency event bus (eliminates tree re-renders from latency ticks)
const latencyListeners = new Set<(ms: number | null) => void>();
let globalLatency: number | null = null;

export function subscribeLatency(fn: (ms: number | null) => void): () => void {
  latencyListeners.add(fn);
  fn(globalLatency);
  return () => {
    latencyListeners.delete(fn);
  };
}

let lastKnownRooms: PublicRoomInfo[] = [];

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
  const [rooms, setRooms] = useState<PublicRoomInfo[]>(lastKnownRooms);
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
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 300, // fast first retry (~300ms)
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
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

      // Start Latency Ping Probe (every 8s lightweight interval, updates badge without re-rendering tree)
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (s.connected) {
          const start = Date.now();
          s.emit('ping_gateway', start, () => {
            const rtt = Math.max(1, Date.now() - start);
            globalLatency = rtt;
            latencyListeners.forEach((fn) => fn(rtt));
          });
        }
      }, 8000);

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
      globalLatency = null;
      latencyListeners.forEach((fn) => fn(null));
      if (hasConnectedOnceRef.current) {
        setConnectionStatus('reconnecting');
      }
    });

    s.on('room_list_update', (roomList: PublicRoomInfo[]) => {
      lastKnownRooms = roomList || [];
      setRooms(lastKnownRooms);
    });

    s.on('new_message', (message: ChatMessage) => {
      setMessages((prev) => {
        // Robust matching against optimistic pending message:
        // 1. By server message.id matching an existing message
        // 2. By message.tempId matching m.id or m.tempId
        // 3. Fallback for pending message by same sender within 6 seconds
        const pendingIdx = prev.findIndex(
          (m) =>
            m.id === message.id ||
            (message.tempId && (m.id === message.tempId || m.tempId === message.tempId)) ||
            (m.status === 'pending' &&
              m.sender === message.sender &&
              Math.abs(m.timestamp - message.timestamp) < 6000)
        );

        if (pendingIdx !== -1) {
          const updated = [...prev];
          updated[pendingIdx] = { ...message, status: 'delivered' };
          return updated;
        }

        return [...prev.slice(-199), { ...message, status: 'delivered' }];
      });

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
        let textContent = '';
        if (typeof payload === 'string') {
          if (!payload.trim()) {
            return resolve({ status: 'error', reason: 'Empty payload' });
          }
          textContent = payload.trim();
          emitData = { type: 'text', text: textContent };
        } else if (payload && typeof payload === 'object' && 'text' in payload) {
          textContent = (payload as { text: string }).text.trim();
        }

        // Sub-frame Optimistic UI: Pre-sanitize message immediately so profanity never flashes in chat
        const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const preSanitizedText = clientSanitizeMessage(textContent);
        const optimisticMsg: ChatMessage = {
          id: tempId,
          tempId,
          sender: usernameRef.current || getStoredUsername(),
          text: preSanitizedText,
          messageType: 'text',
          timestamp: Date.now(),
          isSystem: false,
          status: 'pending',
        };

        setMessages((prev) => [...prev.slice(-199), optimisticMsg]);
        playSendSound(soundEnabledRef.current);

        const payloadToSend: SendMessagePayload = {
          type: 'text',
          text: textContent,
          tempId,
        };

        socketRef.current.emit('send_message', payloadToSend, (ack?: DeliveryAck) => {
          if (ack && ack.status === 'ok') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.tempId === tempId
                  ? {
                      ...m,
                      id: ack.messageId || m.id,
                      text: ack.sanitizedText ?? m.text,
                      status: 'delivered',
                      timestamp: ack.timestamp || m.timestamp,
                    }
                  : m
              )
            );
            resolve(ack);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.tempId === tempId ? { ...m, status: 'failed' } : m
              )
            );
            playErrorSound(soundEnabledRef.current);
            resolve(ack || { status: 'error', reason: 'Transmission failed' });
          }
        });
      });
    },
    [isRateLimited]
  );

  const retryMessage = useCallback((failedMsg: ChatMessage) => {
    if (!socketRef.current?.connected || !failedMsg.text) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'pending' } : m))
    );
    socketRef.current.emit(
      'send_message',
      { type: 'text', text: failedMsg.text, tempId: failedMsg.id },
      (ack?: DeliveryAck) => {
        if (ack && ack.status === 'ok') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === failedMsg.id
                ? {
                    ...m,
                    id: ack.messageId || m.id,
                    text: ack.sanitizedText ?? m.text,
                    status: 'delivered',
                    timestamp: ack.timestamp || m.timestamp,
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
          );
          playErrorSound(soundEnabledRef.current);
        }
      }
    );
  }, []);

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

        const tempId = 'temp-img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const preSanitizedCaption = caption?.trim() ? clientSanitizeMessage(caption.trim()) : undefined;
        const optimisticMsg: ChatMessage = {
          id: tempId,
          tempId,
          sender: usernameRef.current || getStoredUsername(),
          text: preSanitizedCaption || '',
          caption: preSanitizedCaption,
          messageType: 'image',
          imageDataUrl: dataUrl,
          timestamp: Date.now(),
          isSystem: false,
          status: 'pending',
        };

        setMessages((prev) => [...prev.slice(-199), optimisticMsg]);
        playSendSound(soundEnabledRef.current);

        const payload: SendMessagePayload = {
          type: 'image',
          dataUrl,
          caption: caption?.trim() || undefined,
          tempId,
        };

        socketRef.current.emit('send_message', payload, (ack?: DeliveryAck) => {
          if (ack && ack.status === 'ok') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.tempId === tempId
                  ? {
                      ...m,
                      id: ack.messageId || m.id,
                      text: ack.sanitizedText ?? m.text,
                      caption: ack.sanitizedText ?? m.caption,
                      status: 'delivered',
                      timestamp: ack.timestamp || m.timestamp,
                    }
                  : m
              )
            );
            resolve(ack);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId || m.tempId === tempId ? { ...m, status: 'failed' } : m
              )
            );
            playErrorSound(soundEnabledRef.current);
            resolve(ack || { status: 'error', reason: 'Image delivery failed' });
          }
        });
      });
    },
    [isRateLimited]
  );

  const contextValue = useMemo(
    () => ({
      socket,
      connectionStatus,
      wakingElapsedSeconds,
      retryConnection,
      latencyMs: globalLatency,
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
      retryMessage,
    }),
    [
      socket,
      connectionStatus,
      wakingElapsedSeconds,
      retryConnection,
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
      retryMessage,
    ]
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
    <SocketContext.Provider value={contextValue}>
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
