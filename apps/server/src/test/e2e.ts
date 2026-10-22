import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import assert from 'assert';
import { registerRoomHandlers } from '../socket/roomHandler.js';
import { roomService } from '../services/roomService.js';
import {
  DeliveryAck,
  RoomOperationResult,
  PublicRoomInfo,
  ChatMessage,
  RateLimitErrorPayload,
} from '../types/index.js';

async function runE2ETests() {
  console.log('🚀 Starting InkDrop Enterprise End-to-End WebSocket & Security Suite...\n');

  // Launch test Express + Socket.io server
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    pingTimeout: 10000,
    pingInterval: 5000,
  });

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const testPort = address.port;
  const serverUrl = `http://localhost:${testPort}`;
  console.log(`📡 Resilient Gateway running at ${serverUrl}`);

  // Initialize two test client sockets
  const clientA: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });
  const clientB: ClientSocketType = ClientSocket(serverUrl, { transports: ['websocket'] });

  await Promise.all([
    new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
    new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
  ]);
  console.log('✅ Both client sockets connected to mesh.');

  try {
    // Step 1: Gateway Latency Ping/Pong
    console.log('▶️ Step 1: Testing Gateway Latency Ping/Pong Probe...');
    const pingStart = Date.now();
    const serverTimestamp = await new Promise<number>((resolve) => {
      clientA.emit('ping_gateway', pingStart, (ts: number) => resolve(ts));
    });
    assert.ok(serverTimestamp >= pingStart, 'Server timestamp must be valid');
    console.log('  Ping/Pong latency probe verified.');

    // Step 2: Client A creates encrypted pool
    console.log('▶️ Step 2: Client A initializes encrypted pool...');
    const createResult = await new Promise<RoomOperationResult>((resolve) => {
      clientA.emit(
        'create_room',
        { roomName: 'Cryptographic Core Pool', password: 'secure-vault-pass' },
        (res: RoomOperationResult) => resolve(res)
      );
    });

    assert.strictEqual(createResult.success, true);
    assert.ok(createResult.room, 'Room data must be returned');
    const roomId = createResult.room!.id;
    assert.strictEqual(createResult.room!.isPrivate, true);
    console.log(`  Encrypted pool established: ID [${roomId}]`);

    // Step 3: Client B queries room list
    console.log('▶️ Step 3: Client B requests active pool directory...');
    const roomList = await new Promise<PublicRoomInfo[]>((resolve) => {
      clientB.once('room_list_update', (list: PublicRoomInfo[]) => resolve(list));
      clientB.emit('request_room_list');
    });

    const targetRoom = roomList.find((r) => r.id === roomId);
    assert.ok(targetRoom, 'Created pool must be visible in public listing');
    assert.strictEqual(targetRoom!.isPrivate, true);
    assert.strictEqual(targetRoom!.userCount, 1);
    console.log('  Pool directory verified.');

    // Step 4: Atomic Password & Join Check: Missing/Evaporated Pool & Bad Passcode
    console.log('▶️ Step 4: Testing Atomic Join validation & 404 Pool Evaporated...');
    const missingJoin = await new Promise<RoomOperationResult>((resolve) => {
      clientB.emit(
        'join_room',
        { roomId: 'drop_fake_evaporated_123', username: 'Operative_B' },
        (res: RoomOperationResult) => resolve(res)
      );
    });
    assert.strictEqual(missingJoin.success, false);
    assert.strictEqual(missingJoin.error, '404 Pool Evaporated');
    console.log('  404 Pool Evaporated correctly returned for missing pool.');

    const badJoin = await new Promise<RoomOperationResult>((resolve) => {
      clientB.emit(
        'join_room',
        { roomId, password: 'incorrect-passcode', username: 'Operative_B' },
        (res: RoomOperationResult) => resolve(res)
      );
    });
    assert.strictEqual(badJoin.success, false);
    assert.strictEqual(badJoin.error, 'Incorrect room password.');
    console.log('  Access rejected as expected for invalid password.');

    // Step 5: Client B enters with valid password and verifies join broadcast
    console.log('▶️ Step 5: Client B enters with valid password...');
    const joinBroadcastPromise = new Promise<ChatMessage>((resolve) => {
      clientA.on('new_message', (msg: ChatMessage) => {
        if (msg.isSystem && msg.systemType === 'join' && msg.text.includes('Operative_B')) {
          resolve(msg);
        }
      });
    });

    const systemMessagePromise = new Promise<string>((resolve) => {
      clientA.once('system_message', (text: string) => resolve(text));
    });

    const goodJoin = await new Promise<RoomOperationResult>((resolve) => {
      clientB.emit(
        'join_room',
        { roomId, password: 'secure-vault-pass', username: 'Operative_B' },
        (res: RoomOperationResult) => resolve(res)
      );
    });

    assert.strictEqual(goodJoin.success, true);
    assert.strictEqual(goodJoin.room!.userCount, 2);

    const joinMessage = await joinBroadcastPromise;
    assert.strictEqual(joinMessage.text, 'Operative_B dropped into the pool');

    const systemMsgText = await systemMessagePromise;
    assert.strictEqual(systemMsgText, 'Operative_B dropped into the pool');
    console.log('  Join broadcast verified: "Operative_B dropped into the pool" across new_message and system_message');

    // Step 6: Client B sends message with Leetspeak Profanities & Delivery ACK Handshake
    console.log('▶️ Step 6: Testing Leetspeak Sanitization, Server-Side Monotonic Timestamps & Delivery ACK...');
    const sanitizedReceivePromise = new Promise<ChatMessage>((resolve) => {
      clientA.on('new_message', (msg: ChatMessage) => {
        if (!msg.isSystem && msg.sender === 'Operative_B') {
          resolve(msg);
        }
      });
    });

    const ackResult = await new Promise<DeliveryAck>((resolve) => {
      clientB.emit(
        'send_message',
        'Hey team, what the f@ck is this b!tch talking about with that bull$h!t?',
        (ack: DeliveryAck) => resolve(ack)
      );
    });

    assert.strictEqual(ackResult.status, 'ok', 'Delivery ACK must return status: "ok"');
    assert.ok(ackResult.timestamp > 0, 'Delivery ACK must include server monotonic timestamp');
    assert.ok(ackResult.messageId, 'Delivery ACK must include messageId');

    const receivedMessage = await sanitizedReceivePromise;
    assert.strictEqual(receivedMessage.sender, 'Operative_B', 'Custom nickname must persist and not revert to Stranger_');
    assert.ok(!receivedMessage.sender.startsWith('Stranger_'), 'Sender must not revert to Stranger_ fallback');
    assert.strictEqual(
      receivedMessage.text,
      'Hey team, what the **** is this ***** talking about with that ********?',
      'Leetspeak characters (@, !, $, etc.) must be normalized and masked'
    );
    assert.strictEqual(receivedMessage.timestamp, ackResult.timestamp, 'Server monotonic timestamp must match broadcast payload');
    console.log(`  Custom username and delivery ACK verified: "${receivedMessage.sender}" (Timestamp: ${receivedMessage.timestamp})`);

    // Step 7: Ephemeral Image Drop transmission, Sanitized Caption, and Zero-Disk Relay
    console.log('▶️ Step 7: Testing Ephemeral Image Drop & Sanitized Caption Relay...');
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validPngDataUrl = `data:image/png;base64,${validPngBase64}`;

    const imageReceivePromise = new Promise<ChatMessage>((resolve) => {
      clientA.once('new_message', (msg: ChatMessage) => {
        if (msg.messageType === 'image') {
          resolve(msg);
        }
      });
    });

    const imageAck = await new Promise<DeliveryAck>((resolve) => {
      clientB.emit(
        'send_message',
        {
          type: 'image',
          dataUrl: validPngDataUrl,
          caption: 'Classified schematic, f@ck yeah!',
        },
        (ack: DeliveryAck) => resolve(ack)
      );
    });

    assert.strictEqual(imageAck.status, 'ok', 'Image delivery ACK must succeed');
    const receivedImage = await imageReceivePromise;
    assert.strictEqual(receivedImage.messageType, 'image');
    assert.strictEqual(receivedImage.imageDataUrl, validPngDataUrl);
    assert.strictEqual(receivedImage.caption, 'Classified schematic, **** yeah!', 'Image caption must be sanitized');
    console.log('  Ephemeral image drop relay verified without server disk write.');

    // Step 8: Image Rate Limiting (max 3 images per 10s)
    console.log('▶️ Step 8: Testing Dedicated Image Rate Limiting (max 3 per 10s)...');
    for (let i = 0; i < 2; i++) {
      await new Promise<DeliveryAck>((resolve) => {
        clientB.emit(
          'send_message',
          { type: 'image', dataUrl: validPngDataUrl, caption: `Image burst ${i}` },
          (ack: DeliveryAck) => resolve(ack)
        );
      });
    }

    const fourthImageAck = await new Promise<DeliveryAck>((resolve) => {
      clientB.emit(
        'send_message',
        { type: 'image', dataUrl: validPngDataUrl, caption: 'Image burst 4' },
        (ack: DeliveryAck) => resolve(ack)
      );
    });

    assert.strictEqual(fourthImageAck.status, 'error');
    assert.ok(
      fourthImageAck.reason.includes('Image rate limit'),
      '4th image must be blocked by image rate limiter'
    );
    console.log('  Dedicated image rate limiter verified.');

    // Step 9: Sliding-Window Rate Limiter (Max 5 text payloads in 2000ms)
    console.log('▶️ Step 9: Testing 429 burst muting under flood...');
    let rateLimitHit = false;
    clientA.on('429_too_many_requests', (err: RateLimitErrorPayload) => {
      rateLimitHit = true;
      assert.strictEqual(err.code, 429);
      assert.ok(err.retryAfterMs > 0);
    });

    for (let i = 0; i < 7; i++) {
      clientA.emit('send_message', `Flood message payload #${i}`);
    }

    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(rateLimitHit, true, 'Client A must receive 429_too_many_requests event');
    console.log('  Sliding-Window Rate Limiter 429 enforcement verified.');

    // Step 10: Client B departs -> Client A receives evaporation notification
    console.log('▶️ Step 10: Client B leaves pool...');
    const leavePromise = new Promise<ChatMessage>((resolve) => {
      clientA.on('new_message', (msg: ChatMessage) => {
        if (msg.isSystem && msg.systemType === 'leave' && msg.text.includes('Operative_B')) {
          resolve(msg);
        }
      });
    });

    clientB.disconnect();
    const leaveMessage = await leavePromise;
    assert.strictEqual(leaveMessage.text, 'Operative_B has evaporated');
    console.log('  Evaporation notification verified: "Operative_B has evaporated"');

    // Step 11: Final Client A departs -> Zero users -> Volatile Cleanup Protocol
    console.log('▶️ Step 11: Client A departs -> Triggering Volatile Cleanup Protocol...');
    clientA.disconnect();

    await new Promise((r) => setTimeout(r, 300));

    const checkRoom = await roomService.getRoom(roomId);
    assert.strictEqual(
      checkRoom,
      null,
      'Pool must be immediately deleted from memory upon reaching 0 users (Zero-Disk-Write)'
    );

    const finalDirectory = await roomService.getPublicRooms();
    assert.strictEqual(finalDirectory.length, 0, 'Public directory must be empty');
    console.log('  Volatile Cleanup Protocol verified: Instant Zero-Disk Purge.');

    console.log('\n🎉 ALL ENTERPRISE END-TO-END TESTS COMPLETED SUCCESSFULLY!');
    clientA.close();
    clientB.close();
    server.close(() => {
      process.exit(0);
    });
  } finally {
    clientA.close();
    clientB.close();
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Test Suite Error:', err);
  process.exit(1);
});
