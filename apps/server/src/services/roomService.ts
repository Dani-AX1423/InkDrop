import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  RoomMetadata,
  PublicRoomInfo,
  CircuitBreakerState,
  TTLMinutes,
} from '../types/index.js';

const ROOMS_SET_KEY = 'inkdrop:rooms';
const ROOM_PREFIX = 'inkdrop:room:';

// Atomic Lua Script: Increment user count if and only if room exists
const ATOMIC_INCREMENT_SCRIPT = `
local roomKey = KEYS[1]
local raw = redis.call('GET', roomKey)
if not raw then
  return -1
end
local data = cjson.decode(raw)
data.userCount = (data.userCount or 0) + 1
redis.call('SET', roomKey, cjson.encode(data))
return data.userCount
`;

// Atomic Lua Script: Decrement user count and atomically purge (DEL + SREM) when 0
const ATOMIC_DECREMENT_PURGE_SCRIPT = `
local roomKey = KEYS[1]
local roomsSetKey = KEYS[2]
local roomId = ARGV[1]
local raw = redis.call('GET', roomKey)
if not raw then
  redis.call('SREM', roomsSetKey, roomId)
  return {0, 1}
end
local data = cjson.decode(raw)
local nextCount = (data.userCount or 1) - 1
if nextCount <= 0 then
  redis.call('DEL', roomKey)
  redis.call('SREM', roomsSetKey, roomId)
  return {0, 1}
else
  data.userCount = nextCount
  redis.call('SET', roomKey, cjson.encode(data))
  return {nextCount, 0}
end
`;

/**
 * In-Memory Circuit Breaker Fallback Storage
 * Seamless zero-downtime memory store used during Redis network partitions or timeouts.
 */
class MemoryStorageAdapter {
  private data = new Map<string, RoomMetadata>();
  private sets = new Map<string, Set<string>>();

  public getRoom(roomId: string): RoomMetadata | null {
    return this.data.get(roomId) ?? null;
  }

  public setRoom(room: RoomMetadata): void {
    this.data.set(room.id, { ...room });
    if (!this.sets.has(ROOMS_SET_KEY)) {
      this.sets.set(ROOMS_SET_KEY, new Set());
    }
    this.sets.get(ROOMS_SET_KEY)!.add(room.id);
  }

  public deleteRoom(roomId: string): void {
    this.data.delete(roomId);
    this.sets.get(ROOMS_SET_KEY)?.delete(roomId);
  }

  public getAllRoomIds(): string[] {
    const set = this.sets.get(ROOMS_SET_KEY);
    return set ? Array.from(set) : [];
  }

  public getPublicRooms(): PublicRoomInfo[] {
    const list: PublicRoomInfo[] = [];
    const ids = this.sets.get(ROOMS_SET_KEY) ?? new Set();

    for (const id of ids) {
      const room = this.data.get(id);
      if (room) {
        list.push({
          id: room.id,
          name: room.name,
          isPrivate: room.isPrivate,
          userCount: room.userCount,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
        });
      }
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  public incrementUser(roomId: string): number {
    const room = this.data.get(roomId);
    if (!room) return -1;
    room.userCount = (room.userCount || 0) + 1;
    return room.userCount;
  }

  public decrementUser(roomId: string): { remainingUsers: number; evaporated: boolean } {
    const room = this.data.get(roomId);
    if (!room) {
      this.deleteRoom(roomId);
      return { remainingUsers: 0, evaporated: true };
    }

    const nextCount = (room.userCount || 1) - 1;
    if (nextCount <= 0) {
      this.deleteRoom(roomId);
      return { remainingUsers: 0, evaporated: true };
    }

    room.userCount = nextCount;
    return { remainingUsers: nextCount, evaporated: false };
  }
}

export class RoomService {
  private redisClient: Redis | null = null;
  private memoryStore: MemoryStorageAdapter;

  // Circuit Breaker State & Thresholds
  private circuitState: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeoutMs = 15000;
  private readonly callTimeoutMs = 3500;
  private lastFailureTime = 0;

  // TTL & Expiration Management
  private expiryTimers = new Map<string, NodeJS.Timeout>();
  private sweepInterval: NodeJS.Timeout | null = null;
  private roomExpiredCallbacks: Array<(roomId: string) => void> = [];

  constructor(customRedis?: Redis | null) {
    this.memoryStore = new MemoryStorageAdapter();

    if (customRedis !== undefined) {
      this.redisClient = customRedis;
    } else {
      this.initRedis();
    }

    // Start 5s safety net sweep for expired rooms
    this.sweepInterval = setInterval(() => {
      this.sweepExpiredRooms().catch((err) => {
        console.error('❌ [Room Expiry Sweep] Error during periodic check:', err);
      });
    }, 5000);
    this.sweepInterval.unref();

    // Initial timer re-arm
    this.recoverTimers().catch(() => {});
  }

  public onRoomExpired(callback: (roomId: string) => void): () => void {
    this.roomExpiredCallbacks.push(callback);
    return () => {
      this.roomExpiredCallbacks = this.roomExpiredCallbacks.filter((cb) => cb !== callback);
    };
  }

  private armRoomTimer(roomId: string, expiresAt: number): void {
    if (this.expiryTimers.has(roomId)) {
      clearTimeout(this.expiryTimers.get(roomId)!);
      this.expiryTimers.delete(roomId);
    }

    const remainingMs = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => {
      this.expiryTimers.delete(roomId);
      this.expireRoom(roomId).catch((err) => {
        console.error(`❌ [Room Expiry] Failed to expire room [${roomId}]:`, err);
      });
    }, remainingMs);
    timer.unref();

    this.expiryTimers.set(roomId, timer);
  }

  private cancelRoomTimer(roomId: string): void {
    if (this.expiryTimers.has(roomId)) {
      clearTimeout(this.expiryTimers.get(roomId)!);
      this.expiryTimers.delete(roomId);
    }
  }

  public async expireRoom(roomId: string): Promise<void> {
    this.cancelRoomTimer(roomId);
    console.log(`⌛ [Room Expiry] Room [${roomId}] has reached its TTL and is dissolving.`);

    // Purge memory store and redis atomically
    this.memoryStore.deleteRoom(roomId);

    await this.executeWithCircuitBreaker(
      'expireRoom',
      async (redis) => {
        const p = redis.pipeline();
        p.del(this.getRoomKey(roomId));
        p.srem(ROOMS_SET_KEY, roomId);
        await p.exec();
      },
      () => undefined
    );

    // Notify registered listeners (e.g. gateway socket handler)
    for (const callback of this.roomExpiredCallbacks) {
      try {
        callback(roomId);
      } catch (err) {
        console.error(`❌ [Room Expiry Callback] Error notifying listener for room [${roomId}]:`, err);
      }
    }
  }

  public async sweepExpiredRooms(): Promise<void> {
    const now = Date.now();
    const rooms = await this.getPublicRooms();
    for (const room of rooms) {
      if (room.expiresAt && room.expiresAt <= now) {
        await this.expireRoom(room.id);
      }
    }
  }

  private async recoverTimers(): Promise<void> {
    try {
      const rooms = await this.getPublicRooms();
      const now = Date.now();
      for (const room of rooms) {
        if (room.expiresAt) {
          if (room.expiresAt <= now) {
            await this.expireRoom(room.id);
          } else {
            this.armRoomTimer(room.id, room.expiresAt);
          }
        }
      }
    } catch {
      // In-memory or network boot tolerance
    }
  }

  private initRedis(): void {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (url && token && !url.includes('your-upstash-redis')) {
      try {
        this.redisClient = new Redis({ url, token });
        console.log('⚡ [Redis Circuit Breaker] Upstash Redis client initialized.');
      } catch (err) {
        console.warn('⚠️ [Redis Circuit Breaker] Initial connection failed. Operating in Memory Fallback mode:', err);
        this.redisClient = null;
        this.circuitState = 'OPEN';
      }
    } else {
      console.log('ℹ️ [Redis Circuit Breaker] No remote credentials supplied. Ephemeral In-Memory Storage active.');
      this.redisClient = null;
    }
  }

  /**
   * Resilient Circuit Breaker Execution
   */
  private async executeWithCircuitBreaker<T>(
    operationName: string,
    redisOp: (redis: Redis) => Promise<T>,
    fallbackOp: () => T | Promise<T>
  ): Promise<T> {
    if (!this.redisClient) {
      return fallbackOp();
    }

    const now = Date.now();

    if (this.circuitState === 'OPEN') {
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        console.log(`🔄 [Circuit Breaker] Probe timer elapsed. Testing Redis with HALF_OPEN request: ${operationName}`);
        this.circuitState = 'HALF_OPEN';
      } else {
        return fallbackOp();
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Redis operation timed out after ${this.callTimeoutMs}ms`)), this.callTimeoutMs)
      );

      const result = await Promise.race([redisOp(this.redisClient), timeoutPromise]);

      if (this.circuitState === 'HALF_OPEN') {
        console.log('✅ [Circuit Breaker] Redis probe succeeded. Circuit reset to CLOSED.');
        this.circuitState = 'CLOSED';
        this.failureCount = 0;
      }

      return result;
    } catch (err: unknown) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      const errMsg = err instanceof Error ? err.message : String(err);

      console.warn(`⚠️ [Circuit Breaker] Redis failure #${this.failureCount} during ${operationName}: ${errMsg}`);

      if (this.failureCount >= this.failureThreshold || this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'OPEN';
        console.error(`🚨 [Circuit Breaker] Threshold reached. Circuit TRIPPED to OPEN. Falling back to In-Memory Map.`);
      }

      return fallbackOp();
    }
  }

  private getRoomKey(roomId: string): string {
    return `${ROOM_PREFIX}${roomId}`;
  }

  /**
   * Hashes room passwords using Bcrypt (10 rounds) if provided.
   * Saves room metadata to Upstash Redis with atomic memory fallback mirror.
   */
  public async createRoom(
    name: string,
    password?: string,
    ttlMinutes?: TTLMinutes | null
  ): Promise<RoomMetadata> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Room name cannot be empty');
    }

    const roomId = `drop_${crypto.randomBytes(6).toString('hex')}`;
    const isPrivate = Boolean(password && password.trim().length > 0);
    let passwordHash: string | undefined = undefined;

    if (isPrivate && password) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const now = Date.now();
    const expiresAt =
      ttlMinutes && [5, 15, 60].includes(ttlMinutes)
        ? now + ttlMinutes * 60 * 1000
        : undefined;

    const metadata: RoomMetadata = {
      id: roomId,
      name: trimmedName,
      isPrivate,
      passwordHash,
      userCount: 0,
      createdAt: now,
      expiresAt,
    };

    this.memoryStore.setRoom(metadata);

    const roomKey = this.getRoomKey(roomId);

    await this.executeWithCircuitBreaker(
      'createRoom',
      async (redis) => {
        const p = redis.pipeline();
        p.set(roomKey, JSON.stringify(metadata));
        p.sadd(ROOMS_SET_KEY, roomId);
        await p.exec();
        return metadata;
      },
      () => metadata
    );

    if (expiresAt) {
      this.armRoomTimer(roomId, expiresAt);
    }

    console.log(
      `💧 [Room Lifecycle] Created pool "${trimmedName}" [${roomId}] (Private: ${isPrivate}, TTL: ${ttlMinutes ?? 'Unlimited'}m)`
    );
    return metadata;
  }

  /**
   * Returns active rooms: { id, name, isPrivate, userCount, createdAt, expiresAt }
   */
  public async getPublicRooms(): Promise<PublicRoomInfo[]> {
    const now = Date.now();

    return this.executeWithCircuitBreaker(
      'getPublicRooms',
      async (redis) => {
        const roomIds = await redis.smembers(ROOMS_SET_KEY);
        if (!roomIds || roomIds.length === 0) {
          return [];
        }

        const roomList: PublicRoomInfo[] = [];

        for (const id of roomIds) {
          const roomKey = this.getRoomKey(id);
          const raw = await redis.get<RoomMetadata | string>(roomKey);

          if (!raw) {
            await redis.srem(ROOMS_SET_KEY, id);
            this.memoryStore.deleteRoom(id);
            this.cancelRoomTimer(id);
            continue;
          }

          const meta: RoomMetadata = typeof raw === 'string' ? JSON.parse(raw) : raw;

          // Lazy TTL check
          if (meta.expiresAt && meta.expiresAt <= now) {
            await this.expireRoom(id);
            continue;
          }

          this.memoryStore.setRoom(meta);

          roomList.push({
            id: meta.id,
            name: meta.name,
            isPrivate: meta.isPrivate,
            userCount: meta.userCount,
            createdAt: meta.createdAt,
            expiresAt: meta.expiresAt,
          });
        }

        return roomList.sort((a, b) => b.createdAt - a.createdAt);
      },
      () => {
        const list = this.memoryStore.getPublicRooms();
        return list.filter((r) => {
          if (r.expiresAt && r.expiresAt <= now) {
            this.expireRoom(r.id).catch(() => {});
            return false;
          }
          return true;
        });
      }
    );
  }

  /**
   * Fetches room metadata
   */
  public async getRoom(roomId: string): Promise<RoomMetadata | null> {
    const now = Date.now();

    return this.executeWithCircuitBreaker(
      'getRoom',
      async (redis) => {
        const roomKey = this.getRoomKey(roomId);
        const raw = await redis.get<RoomMetadata | string>(roomKey);
        if (!raw) {
          this.memoryStore.deleteRoom(roomId);
          this.cancelRoomTimer(roomId);
          return null;
        }
        const meta: RoomMetadata = typeof raw === 'string' ? JSON.parse(raw) : raw;

        // Lazy TTL eviction
        if (meta.expiresAt && meta.expiresAt <= now) {
          await this.expireRoom(roomId);
          return null;
        }

        this.memoryStore.setRoom(meta);
        return meta;
      },
      () => {
        const room = this.memoryStore.getRoom(roomId);
        if (room && room.expiresAt && room.expiresAt <= now) {
          this.expireRoom(roomId).catch(() => {});
          return null;
        }
        return room;
      }
    );
  }

  /**
   * Atomic Password & Join Check
   * Validates room existence and password hash atomically before incrementing userCount.
   * If the room is currently being purged or expired, returns 404 Pool Evaporated status immediately.
   */
  public async atomicJoinRoom(
    roomId: string,
    password?: string
  ): Promise<{
    success: boolean;
    status: number;
    room?: PublicRoomInfo;
    error?: string;
  }> {
    const room = await this.getRoom(roomId);
    if (!room) {
      return {
        success: false,
        status: 404,
        error: '404 Pool Evaporated',
      };
    }

    if (room.isPrivate) {
      if (!password) {
        return {
          success: false,
          status: 401,
          error: 'Incorrect room password.',
        };
      }
      if (room.passwordHash) {
        const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
        if (!isPasswordValid) {
          return {
            success: false,
            status: 401,
            error: 'Incorrect room password.',
          };
        }
      }
    }

    // Atomically increment userCount ONLY IF room still exists
    try {
      const updatedCount = await this.incrementRoomUser(roomId);
      if (updatedCount <= 0) {
        return {
          success: false,
          status: 404,
          error: '404 Pool Evaporated',
        };
      }

      return {
        success: true,
        status: 200,
        room: {
          id: room.id,
          name: room.name,
          isPrivate: room.isPrivate,
          userCount: updatedCount,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
        },
      };
    } catch {
      return {
        success: false,
        status: 404,
        error: '404 Pool Evaporated',
      };
    }
  }

  /**
   * Updates room population dynamically (+1) using atomic Lua script
   */
  public async incrementRoomUser(roomId: string): Promise<number> {
    const memCount = this.memoryStore.incrementUser(roomId);

    return this.executeWithCircuitBreaker(
      'incrementRoomUser',
      async (redis) => {
        const roomKey = this.getRoomKey(roomId);
        const res = await redis.eval(ATOMIC_INCREMENT_SCRIPT, [roomKey], []);
        const count = typeof res === 'number' ? res : parseInt(String(res), 10);

        if (count < 0) {
          throw new Error(`Room [${roomId}] does not exist on Redis`);
        }

        const room = this.memoryStore.getRoom(roomId);
        if (room) {
          room.userCount = count;
        }

        return count;
      },
      () => memCount
    );
  }

  /**
   * Atomic Decrement & Purge
   * Atomically decrements userCount. If userCount <= 0, executes an atomic purge
   * (DEL room key and SREM from active rooms set) in the same Lua transaction.
   */
  public async decrementRoomUser(
    roomId: string
  ): Promise<{ remainingUsers: number; evaporated: boolean }> {
    const memResult = this.memoryStore.decrementUser(roomId);

    return this.executeWithCircuitBreaker(
      'decrementRoomUser',
      async (redis) => {
        const roomKey = this.getRoomKey(roomId);
        const res = (await redis.eval(
          ATOMIC_DECREMENT_PURGE_SCRIPT,
          [roomKey, ROOMS_SET_KEY],
          [roomId]
        )) as [number, number];

        const remainingUsers = Array.isArray(res) ? res[0] : 0;
        const evaporated = Array.isArray(res) ? res[1] === 1 : true;

        if (evaporated) {
          this.memoryStore.deleteRoom(roomId);
          this.cancelRoomTimer(roomId);
          console.log(`💨 [Atomic Eviction Protocol] Room [${roomId}] reached 0 users. Atomically purged via DEL + SREM.`);
        } else {
          const room = this.memoryStore.getRoom(roomId);
          if (room) {
            room.userCount = remainingUsers;
          }
        }

        return { remainingUsers, evaporated };
      },
      () => {
        if (memResult.evaporated) {
          this.cancelRoomTimer(roomId);
        }
        return memResult;
      }
    );
  }

  public async deleteRoom(roomId: string): Promise<void> {
    this.cancelRoomTimer(roomId);
    this.memoryStore.deleteRoom(roomId);
    await this.executeWithCircuitBreaker(
      'deleteRoom',
      async (redis) => {
        const p = redis.pipeline();
        p.del(this.getRoomKey(roomId));
        p.srem(ROOMS_SET_KEY, roomId);
        await p.exec();
      },
      () => undefined
    );
  }

  public getCircuitState(): CircuitBreakerState {
    return this.circuitState;
  }

  public destroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    for (const [, timer] of this.expiryTimers) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
  }
}

export const roomService = new RoomService();
