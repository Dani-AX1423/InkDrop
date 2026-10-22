import { Socket } from 'socket.io';
import { RateLimitErrorPayload } from '../types/index.js';

export interface RateLimiterOptions {
  windowMs?: number;
  maxBurst?: number;
  imageWindowMs?: number;
  maxImages?: number;
  gcIntervalMs?: number;
}

export class SlidingWindowRateLimiter {
  private socketHistory: Map<string, number[]>;
  private imageHistory: Map<string, number[]>;
  private readonly windowMs: number;
  private readonly maxBurst: number;
  private readonly imageWindowMs: number;
  private readonly maxImages: number;
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.socketHistory = new Map<string, number[]>();
    this.imageHistory = new Map<string, number[]>();
    this.windowMs = options.windowMs ?? 2000;          // 2000ms rolling window for text
    this.maxBurst = options.maxBurst ?? 5;            // Max 5 messages per window
    this.imageWindowMs = options.imageWindowMs ?? 10000; // 10s rolling window for images
    this.maxImages = options.maxImages ?? 3;          // Max 3 images per 10s
    const gcInterval = options.gcIntervalMs ?? 60000; // 60s periodic cleanup

    this.startGarbageCollector(gcInterval);
  }

  /**
   * Periodic GC to purge stale sockets and timestamps, preventing unbounded memory growth
   */
  private startGarbageCollector(intervalMs: number): void {
    this.gcTimer = setInterval(() => {
      const now = Date.now();
      const textCutoff = now - this.windowMs;
      const imageCutoff = now - this.imageWindowMs;
      let purgedCount = 0;

      for (const [socketId, timestamps] of this.socketHistory.entries()) {
        const valid = timestamps.filter((ts) => ts > textCutoff);
        if (valid.length === 0) {
          this.socketHistory.delete(socketId);
          purgedCount++;
        } else {
          this.socketHistory.set(socketId, valid);
        }
      }

      for (const [socketId, timestamps] of this.imageHistory.entries()) {
        const valid = timestamps.filter((ts) => ts > imageCutoff);
        if (valid.length === 0) {
          this.imageHistory.delete(socketId);
        } else {
          this.imageHistory.set(socketId, valid);
        }
      }

      if (purgedCount > 0) {
        console.log(`🧹 [Rate Limiter GC] Purged ${purgedCount} idle socket records. Active tracking: ${this.socketHistory.size}`);
      }
    }, intervalMs);

    if (this.gcTimer.unref) {
      this.gcTimer.unref();
    }
  }

  /**
   * General sliding-window rate limit check for text transmissions
   */
  public checkRateLimit(socketId: string, socket?: Socket): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const history = this.socketHistory.get(socketId) ?? [];
    const validTimestamps = history.filter((ts) => ts > windowStart);

    if (validTimestamps.length >= this.maxBurst) {
      const oldestValid = validTimestamps[0];
      const retryAfterMs = Math.max(100, oldestValid + this.windowMs - now);

      const payload: RateLimitErrorPayload = {
        code: 429,
        message: `Transmission burst exceeded. Max ${this.maxBurst} messages per ${this.windowMs}ms window.`,
        retryAfterMs,
      };

      if (socket) {
        socket.emit('429_too_many_requests', payload);
      }

      console.warn(`🛑 [Rate Limiter] Socket [${socketId}] throttled: ${validTimestamps.length} hits in ${this.windowMs}ms.`);
      return false;
    }

    validTimestamps.push(now);
    this.socketHistory.set(socketId, validTimestamps);
    return true;
  }

  /**
   * Stricter rate limit check for ephemeral image drops (Max 3 images / 10s)
   */
  public checkImageRateLimit(socketId: string, socket?: Socket): boolean {
    const now = Date.now();
    const windowStart = now - this.imageWindowMs;

    const history = this.imageHistory.get(socketId) ?? [];
    const valid = history.filter((ts) => ts > windowStart);

    if (valid.length >= this.maxImages) {
      const oldest = valid[0];
      const retryAfterMs = Math.max(500, oldest + this.imageWindowMs - now);

      const payload: RateLimitErrorPayload = {
        code: 429,
        message: `Image upload rate limit reached. Max ${this.maxImages} images per 10s window.`,
        retryAfterMs,
      };

      if (socket) {
        socket.emit('429_too_many_requests', payload);
      }

      console.warn(`🛑 [Image Rate Limiter] Socket [${socketId}] hit image rate limit.`);
      return false;
    }

    valid.push(now);
    this.imageHistory.set(socketId, valid);
    return true;
  }

  public clearSocket(socketId: string): void {
    this.socketHistory.delete(socketId);
    this.imageHistory.delete(socketId);
  }

  public getTrackedSocketsCount(): number {
    return this.socketHistory.size;
  }

  public destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}

export const rateLimiter = new SlidingWindowRateLimiter({
  windowMs: 2000,
  maxBurst: 5,
  imageWindowMs: 10000,
  maxImages: 3,
  gcIntervalMs: 60000,
});
