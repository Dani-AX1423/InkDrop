import assert from 'assert';
import { sanitizeMessage } from '../middleware/moderation.js';
import { SlidingWindowRateLimiter } from '../middleware/rateLimiter.js';
import { RoomService } from '../services/roomService.js';
import { RateLimitErrorPayload, validateImageDataUrl } from '../types/index.js';

async function runUnitTests() {
  console.log('🧪 Starting InkDrop Hardened Unit Test Suite...\n');

  // Test 1: Trie Moderation Pipeline with Leetspeak & Obfuscation Normalization
  console.log('▶️ Test 1: Trie Moderation & Leetspeak Obfuscation Normalization...');
  
  // Standard curse words
  assert.strictEqual(
    sanitizeMessage('This is fucking terrible'),
    'This is ******* terrible',
    'Standard profanity must be masked'
  );

  // Leetspeak substitutions: @ -> a, ! -> i, $ -> s, 1 -> i/l, 3 -> e, 0 -> o
  assert.strictEqual(
    sanitizeMessage('What the f@ck is that b!tch doing?'),
    'What the **** is that ***** doing?',
    'Leetspeak @ and ! must be normalized and masked'
  );

  assert.strictEqual(
    sanitizeMessage('You complete a$$hole and d1ck!'),
    'You complete ******* and ****!',
    'Leetspeak $ and 1 must be normalized and masked'
  );

  // 1 -> l test (bu11shit, s1ut)
  assert.strictEqual(
    sanitizeMessage('Stop this bu11shit right now, s1ut!'),
    'Stop this ******** right now, ****!',
    'Leetspeak 1 -> l must be normalized and masked'
  );

  assert.strictEqual(
    sanitizeMessage('Don’t give me that bull$h!t'),
    'Don’t give me that ********',
    'Compound leetspeak must be normalized'
  );

  // Word boundaries preservation (No false positives on innocent words)
  assert.strictEqual(
    sanitizeMessage('This classic pass requires careful assessment and class notes'),
    'This classic pass requires careful assessment and class notes',
    'Innocent words containing bad subwords must not be falsely masked'
  );

  // Preserving surrounding punctuation
  assert.strictEqual(
    sanitizeMessage('Hey! What the f@ck, man?'),
    'Hey! What the ****, man?',
    'Surrounding punctuation must be preserved'
  );

  console.log('  ✅ Trie Moderation with Leetspeak Normalization passed.');

  // Test 2: Sliding-Window Rate Limiter & Periodic GC (Text & Images)
  console.log('▶️ Test 2: Sliding-Window Rate Limiter & GC Lifecycle...');
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 2000,
    maxBurst: 5,
    gcIntervalMs: 500,
  });

  const socketId = 'sock_unit_test_alpha';

  // 5 bursts permitted
  for (let i = 1; i <= 5; i++) {
    const ok = limiter.checkRateLimit(socketId);
    assert.strictEqual(ok, true, `Payload ${i} must be permitted`);
  }

  // 6th burst throttled
  let emitted429 = false;
  let retryAfter = 0;
  const mockSocket: any = {
    emit: (event: string, payload: RateLimitErrorPayload) => {
      if (event === '429_too_many_requests') {
        emitted429 = true;
        retryAfter = payload.retryAfterMs;
        assert.strictEqual(payload.code, 429);
      }
    },
  };

  const throttled = limiter.checkRateLimit(socketId, mockSocket);
  assert.strictEqual(throttled, false, '6th payload must be rejected');
  assert.strictEqual(emitted429, true, '429 payload must be emitted to socket');
  assert.ok(retryAfter > 0, 'Retry-after window must be greater than zero');

  // Test image rate limiting (max 3 images per 10s)
  for (let i = 1; i <= 3; i++) {
    const ok = limiter.checkImageRateLimit(socketId);
    assert.strictEqual(ok, true, `Image ${i} must be permitted`);
  }
  const fourthImage = limiter.checkImageRateLimit(socketId);
  assert.strictEqual(fourthImage, false, '4th image within 10s must be throttled');

  // Verify memory cleanup
  limiter.clearSocket(socketId);
  assert.strictEqual(limiter.getTrackedSocketsCount(), 0, 'Socket memory must be cleared');
  limiter.destroy();
  console.log('  ✅ Sliding-Window Rate Limiter & GC passed.');

  // Test 3: Base64 Image Drop Validation & Magic-Byte Verification
  console.log('▶️ Test 3: Ephemeral Image Data URL & Magic Bytes Validation...');
  // Valid PNG header (89 50 4E 47 0D 0A 1A 0A)
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validPngDataUrl = `data:image/png;base64,${validPngBase64}`;
  const pngCheck = validateImageDataUrl(validPngDataUrl);
  assert.strictEqual(pngCheck.valid, true, 'Valid PNG data URL must pass');
  assert.strictEqual(pngCheck.mimeType, 'image/png');

  // Valid JPEG header (FF D8 FF E0 ...)
  const validJpgBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const validJpgDataUrl = `data:image/jpeg;base64,${validJpgBase64}`;
  const jpgCheck = validateImageDataUrl(validJpgDataUrl);
  assert.strictEqual(jpgCheck.valid, true, 'Valid JPEG data URL must pass');

  // Valid WebP header (RIFF .... WEBP)
  const validWebpBase64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  const validWebpDataUrl = `data:image/webp;base64,${validWebpBase64}`;
  const webpCheck = validateImageDataUrl(validWebpDataUrl);
  assert.strictEqual(webpCheck.valid, true, 'Valid WebP data URL must pass');

  // Reject SVG / XML injection attempt
  const svgDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';
  const svgCheck = validateImageDataUrl(svgDataUrl);
  assert.strictEqual(svgCheck.valid, false, 'SVG image data URLs must be rejected');

  // Reject mismatched magic bytes
  const spoofedPng = 'data:image/png;base64,AAAA' + validPngBase64;
  const spoofCheck = validateImageDataUrl(spoofedPng);
  assert.strictEqual(spoofCheck.valid, false, 'Spoofed PNG header bytes must be rejected');

  // Reject oversized data URL (> 700,000 chars)
  const giantDataUrl = 'data:image/png;base64,' + 'A'.repeat(750000);
  const giantCheck = validateImageDataUrl(giantDataUrl);
  assert.strictEqual(giantCheck.valid, false, 'Oversized image data URL must be rejected');
  console.log('  ✅ Ephemeral Image validation passed.');

  // Test 4: Atomic Distributed Room Lifecycle & Volatile Cleanup Protocol
  console.log('▶️ Test 4: Atomic Room Lifecycle, TTL & Volatile Cleanup Protocol...');
  const roomService = new RoomService(null); // Explicit in-memory circuit breaker adapter

  // Create public pool with 5m TTL
  const pubPool = await roomService.createRoom('Distributed Core Sync', undefined, 5);
  assert.strictEqual(pubPool.isPrivate, false);
  assert.strictEqual(pubPool.userCount, 0);
  assert.ok(pubPool.expiresAt && pubPool.expiresAt > Date.now(), 'ExpiresAt must be populated for 5m TTL');

  // Create encrypted pool with password
  const encPool = await roomService.createRoom('Cryptographic Enclave', 'SecretProtocol99');
  assert.strictEqual(encPool.isPrivate, true);
  assert.ok(encPool.passwordHash, 'Password must be hashed with Bcrypt');

  // Atomic Password & Join Check: non-existent pool returns 404 Pool Evaporated
  const missingJoin = await roomService.atomicJoinRoom('drop_nonexistent_xyz');
  assert.strictEqual(missingJoin.success, false);
  assert.strictEqual(missingJoin.status, 404);
  assert.strictEqual(missingJoin.error, '404 Pool Evaporated');

  // Atomic Password & Join Check: invalid password
  const badPassJoin = await roomService.atomicJoinRoom(encPool.id, 'WrongPassword');
  assert.strictEqual(badPassJoin.success, false);
  assert.strictEqual(badPassJoin.status, 401);

  // Atomic Password & Join Check: valid password
  const goodPassJoin = await roomService.atomicJoinRoom(encPool.id, 'SecretProtocol99');
  assert.strictEqual(goodPassJoin.success, true);
  assert.strictEqual(goodPassJoin.status, 200);
  assert.strictEqual(goodPassJoin.room?.userCount, 1);

  // Atomic user decrement & volatile purge
  const dec1 = await roomService.decrementRoomUser(encPool.id);
  assert.strictEqual(dec1.remainingUsers, 0);
  assert.strictEqual(dec1.evaporated, true, 'Room must evaporate when count reaches 0');

  // Attempting to join an evaporated room immediately returns 404 Pool Evaporated
  const postEvapJoin = await roomService.atomicJoinRoom(encPool.id, 'SecretProtocol99');
  assert.strictEqual(postEvapJoin.success, false);
  assert.strictEqual(postEvapJoin.status, 404);
  assert.strictEqual(postEvapJoin.error, '404 Pool Evaporated');

  const postEvap = await roomService.getRoom(encPool.id);
  assert.strictEqual(postEvap, null, 'Evaporated pool must be deleted from memory with Zero Disk Write');

  const activeRooms = await roomService.getPublicRooms();
  assert.strictEqual(
    activeRooms.some((r) => r.id === encPool.id),
    false,
    'Evaporated pool must be pruned from public directory'
  );

  // Test TTL Expiration hook & eviction
  let expiredNotified = false;
  roomService.onRoomExpired((rId) => {
    if (rId === pubPool.id) {
      expiredNotified = true;
    }
  });

  await roomService.expireRoom(pubPool.id);
  assert.strictEqual(expiredNotified, true, 'TTL expiration callback must be triggered');
  const checkExpired = await roomService.getRoom(pubPool.id);
  assert.strictEqual(checkExpired, null, 'Expired room must be removed from memory');

  roomService.destroy();
  console.log('  ✅ Atomic Room Lifecycle, TTL & Volatile Cleanup passed.\n');

  console.log('🎉 ALL HARDENED UNIT TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runUnitTests().catch((err) => {
  console.error('❌ Unit test failure:', err);
  process.exit(1);
});
