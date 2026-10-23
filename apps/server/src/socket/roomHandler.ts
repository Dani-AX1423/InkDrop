import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { roomService } from '../services/roomService.js';
import { sanitizeMessage } from '../middleware/moderation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  ChatMessage,
  DeliveryAck,
  RoomOperationResult,
  RoomInfoUpdatePayload,
  RoomEvaporatedPayload,
  SendMessagePayload,
  isValidTTL,
  validateImageDataUrl,
} from '../types/index.js';

/**
 * Broadcasts active public room directory to target socket or entire mesh.
 * Coalesces bursts into one broadcast update per ~250ms.
 */
let broadcastThrottleTimer: NodeJS.Timeout | null = null;
let isBroadcastPending = false;

export async function broadcastRoomList(io: Server, targetSocket?: Socket): Promise<void> {
  if (targetSocket) {
    try {
      const rooms = await roomService.getPublicRooms();
      targetSocket.emit('room_list_update', rooms);
    } catch (err) {
      console.error('❌ [Gateway] Failed broadcasting room list to socket:', err);
    }
    return;
  }

  isBroadcastPending = true;
  if (!broadcastThrottleTimer) {
    broadcastThrottleTimer = setTimeout(async () => {
      broadcastThrottleTimer = null;
      if (isBroadcastPending) {
        isBroadcastPending = false;
        try {
          const rooms = await roomService.getPublicRooms();
          io.emit('room_list_update', rooms);
        } catch (err) {
          console.error('❌ [Gateway] Failed broadcasting coalesced room list:', err);
        }
      }
    }, 250);
  }
}

/**
 * Gracefully dissolves socket presence from its current room
 */
async function handleLeaveCurrentRoom(io: Server, socket: Socket): Promise<void> {
  const roomId = socket.data.roomId as string | undefined;
  const username = (socket.data.username as string | undefined) || `Stranger_${socket.id.substring(0, 5)}`;

  if (!roomId) return;

  console.log(`🚪 [Gateway] Socket [${socket.id}] (${username}) departing pool [${roomId}]`);

  socket.leave(roomId);
  socket.data.roomId = undefined;

  const leaveNotice = `${username} has evaporated`;
  io.to(roomId).emit('system_message', leaveNotice);

  const leaveMessage: ChatMessage = {
    id: crypto.randomUUID(),
    sender: 'SYSTEM',
    text: leaveNotice,
    timestamp: Date.now(),
    isSystem: true,
    systemType: 'leave',
  };
  io.to(roomId).emit('new_message', leaveMessage);

  try {
    const { remainingUsers, evaporated } = await roomService.decrementRoomUser(roomId);

    if (evaporated) {
      console.log(`💨 [Gateway] Pool [${roomId}] completely dissolved.`);
      const payload: RoomEvaporatedPayload = { roomId, reason: 'empty' };
      io.to(roomId).emit('room_evaporated', payload);
    } else {
      const updatePayload: RoomInfoUpdatePayload = {
        roomId,
        userCount: remainingUsers,
      };
      io.to(roomId).emit('room_info_update', updatePayload);
    }

    await broadcastRoomList(io);
  } catch (err) {
    console.error(`❌ [Gateway] Error leaving pool [${roomId}]:`, err);
  }
}

/**
 * Registers all Socket.io Event Ledger Gateway listeners
 */
export function registerRoomHandlers(io: Server, socket: Socket): void {
  // Initialize default fallback username in socket context
  socket.data.username = `Stranger_${socket.id.substring(0, 5)}`;

  console.log(`⚡ [Gateway] Client connected: [${socket.id}] -> Session handle: ${socket.data.username}`);

  // 1. request_room_list: Emits room_list_update to client
  socket.on('request_room_list', async () => {
    await broadcastRoomList(io, socket);
  });

  // Latency ping-pong probe
  socket.on('ping_gateway', (clientTs: number, callback?: (serverTs: number) => void) => {
    const now = Date.now();
    if (typeof callback === 'function') {
      callback(now);
    } else {
      socket.emit('pong_gateway', { clientTs, serverTs: now });
    }
  });

  // 2. create_room ({ roomName, password?, username?, ttlMinutes? })
  socket.on(
    'create_room',
    async (
      payload: CreateRoomPayload,
      callback?: (res: RoomOperationResult) => void
    ) => {
      try {
        const roomName = payload?.roomName?.trim();
        if (!roomName) {
          callback?.({ success: false, error: 'Pool title cannot be blank.' });
          return;
        }

        if (payload?.ttlMinutes !== undefined && !isValidTTL(payload.ttlMinutes)) {
          callback?.({ success: false, error: 'Invalid pool lifetime duration.' });
          return;
        }

        // Attach custom username to socket context if supplied
        if (payload?.username && payload.username.trim()) {
          socket.data.username = payload.username.trim();
        }

        if (socket.data.roomId) {
          await handleLeaveCurrentRoom(io, socket);
        }

        const newRoom = await roomService.createRoom(roomName, payload.password, payload.ttlMinutes);

        socket.join(newRoom.id);
        socket.data.roomId = newRoom.id;

        const count = await roomService.incrementRoomUser(newRoom.id);
        newRoom.userCount = count;

        await broadcastRoomList(io);

        const joinNotice = `${socket.data.username} dropped into the pool and created the room`;
        io.to(newRoom.id).emit('system_message', joinNotice);

        const sysMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'SYSTEM',
          text: joinNotice,
          timestamp: Date.now(),
          isSystem: true,
          systemType: 'join',
        };
        io.to(newRoom.id).emit('new_message', sysMsg);

        const publicInfo = {
          id: newRoom.id,
          name: newRoom.name,
          isPrivate: newRoom.isPrivate,
          userCount: count,
          createdAt: newRoom.createdAt,
          expiresAt: newRoom.expiresAt,
        };

        const serverNow = Date.now();
        callback?.({ success: true, room: publicInfo, serverNow });
        socket.emit('room_joined', publicInfo);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to create room';
        console.error('❌ [Gateway] create_room error:', err);
        callback?.({ success: false, error: errMsg });
      }
    }
  );

  // 3. join_room with Atomic Password & Join Check
  socket.on(
    'join_room',
    async (
      payload: JoinRoomPayload,
      callback?: (res: RoomOperationResult) => void
    ) => {
      try {
        const { roomId, password, username } = payload || {};
        if (!roomId) {
          callback?.({ success: false, error: 'Pool ID is required.' });
          return;
        }

        // Attach username directly to active socket context
        socket.data.username = username?.trim() || `Stranger_${socket.id.substring(0, 5)}`;

        // Atomic Password & Join Check
        const joinResult = await roomService.atomicJoinRoom(roomId, password);
        if (!joinResult.success || !joinResult.room) {
          const err = joinResult.error || 'Pool not found or evaporated';
          callback?.({ success: false, error: err });
          socket.emit('room_error', { message: err });
          return;
        }

        const room = joinResult.room;
        const serverNow = Date.now();

        if (socket.data.roomId === roomId) {
          callback?.({
            success: true,
            room,
            serverNow,
          });
          return;
        }

        if (socket.data.roomId) {
          await handleLeaveCurrentRoom(io, socket);
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        // Broadcast system event using socket.data.username
        const joinNotice = `${socket.data.username} dropped into the pool`;
        io.to(roomId).emit('system_message', joinNotice);

        const sysMessage: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'SYSTEM',
          text: joinNotice,
          timestamp: Date.now(),
          isSystem: true,
          systemType: 'join',
        };

        io.to(roomId).emit('new_message', sysMessage);

        const updatePayload: RoomInfoUpdatePayload = {
          roomId: room.id,
          name: room.name,
          isPrivate: room.isPrivate,
          userCount: room.userCount,
          expiresAt: room.expiresAt,
        };
        io.to(roomId).emit('room_info_update', updatePayload);

        await broadcastRoomList(io);

        callback?.({ success: true, room, serverNow });
        socket.emit('room_joined', room);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to join room';
        console.error(`❌ [Gateway] Error joining room:`, err);
        callback?.({ success: false, error: errMsg });
      }
    }
  );

  // 4. send_message supporting text and ephemeral image drops
  socket.on(
    'send_message',
    (
      rawPayload: string | { text: string } | SendMessagePayload,
      ackCallback?: (ack: DeliveryAck & { processingTimeMs?: number; sanitizedText?: string; tempId?: string }) => void
    ) => {
      const serverProcessingStart = process.hrtime.bigint();
      const roomId = socket.data.roomId as string | undefined;
      if (!roomId) {
        ackCallback?.({
          status: 'error',
          reason: 'Cannot transmit: Not connected to any pool.',
        });
        socket.emit('room_error', { message: 'Cannot send message: You are not in any room' });
        return;
      }

      const tempId =
        typeof rawPayload === 'object' && rawPayload !== null && 'tempId' in rawPayload
          ? (rawPayload as { tempId?: string }).tempId
          : undefined;

      // Check for image payload
      const isImagePayload =
        typeof rawPayload === 'object' &&
        rawPayload !== null &&
        'type' in rawPayload &&
        rawPayload.type === 'image';

      if (isImagePayload) {
        // Enforce dedicated image rate limit: max 3 per 10s
        const isAllowed = rateLimiter.checkImageRateLimit(socket.id, socket);
        if (!isAllowed) {
          ackCallback?.({
            status: 'error',
            reason: 'Image rate limit reached. Maximum 3 images per 10 seconds.',
          });
          return;
        }

        const imagePayload = rawPayload as {
          type: 'image';
          dataUrl: string;
          caption?: string;
          tempId?: string;
        };
        const validation = validateImageDataUrl(imagePayload.dataUrl);

        if (!validation.valid) {
          ackCallback?.({
            status: 'error',
            reason: validation.error || 'Invalid image payload format.',
          });
          return;
        }

        const rawCaption = imagePayload.caption ? String(imagePayload.caption).trim().slice(0, 200) : '';
        const sanitizedCaption = rawCaption ? sanitizeMessage(rawCaption) : '';
        const messageId = crypto.randomUUID();
        const serverTimestamp = Date.now();

        // Zero-Disk-Write: We relay the in-flight buffer to the room sockets only.
        // It is NEVER written to disk, server logs, or Redis.
        const messagePayload: ChatMessage = {
          id: messageId,
          tempId,
          sender: socket.data.username || `Stranger_${socket.id.substring(0, 5)}`,
          text: sanitizedCaption,
          caption: sanitizedCaption || undefined,
          messageType: 'image',
          imageDataUrl: imagePayload.dataUrl,
          timestamp: serverTimestamp,
          isSystem: false,
        };

        io.to(roomId).emit('new_message', messagePayload);

        const procNs = Number(process.hrtime.bigint() - serverProcessingStart);
        const processingTimeMs = Math.round((procNs / 1_000_000) * 100) / 100;

        ackCallback?.({
          status: 'ok',
          timestamp: serverTimestamp,
          messageId,
          tempId,
          sanitizedText: sanitizedCaption,
          processingTimeMs,
        });
        return;
      }

      // Otherwise text payload
      const isAllowed = rateLimiter.checkRateLimit(socket.id, socket);
      if (!isAllowed) {
        ackCallback?.({
          status: 'error',
          reason: 'Rate limit exceeded. Maximum 5 messages per 2000ms.',
        });
        return;
      }

      let text: string | undefined;
      if (typeof rawPayload === 'string') {
        text = rawPayload;
      } else if (rawPayload && typeof rawPayload === 'object' && 'text' in rawPayload) {
        text = (rawPayload as { text: string }).text;
      }

      if (!text || typeof text !== 'string' || !text.trim()) {
        ackCallback?.({ status: 'error', reason: 'Empty message payload.' });
        return;
      }

      const sanitizedText = sanitizeMessage(text.trim().slice(0, 1000));
      const messageId = crypto.randomUUID();
      const serverTimestamp = Date.now();

      const messagePayload: ChatMessage = {
        id: messageId,
        tempId,
        sender: socket.data.username || `Stranger_${socket.id.substring(0, 5)}`,
        text: sanitizedText,
        messageType: 'text',
        timestamp: serverTimestamp,
        isSystem: false,
      };

      io.to(roomId).emit('new_message', messagePayload);

      const procNs = Number(process.hrtime.bigint() - serverProcessingStart);
      const processingTimeMs = Math.round((procNs / 1_000_000) * 100) / 100;

      ackCallback?.({
        status: 'ok',
        timestamp: serverTimestamp,
        messageId,
        tempId,
        sanitizedText,
        processingTimeMs,
      });
    }
  );

  socket.on('leave_room', async () => {
    await handleLeaveCurrentRoom(io, socket);
  });

  // 5. disconnect: Decrement room, volatile cleanup, broadcast evaporation
  socket.on('disconnect', async (reason) => {
    console.log(`🔌 [Gateway] Socket disconnected [${socket.id}] (Reason: ${reason})`);
    rateLimiter.clearSocket(socket.id);
    await handleLeaveCurrentRoom(io, socket);
  });
}
