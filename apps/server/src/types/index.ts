/**
 * Shared Type Definitions for InkDrop (Server & Client Synchronized)
 * Mirrors: apps/client/src/types/index.ts
 */

export type TTLMinutes = 5 | 15 | 60 | null;

export interface RoomMetadata {
  id: string;
  name: string;
  isPrivate: boolean;
  passwordHash?: string;
  userCount: number;
  createdAt: number;
  expiresAt?: number;
}

export interface PublicRoomInfo {
  id: string;
  name: string;
  isPrivate: boolean;
  userCount: number;
  createdAt: number;
  expiresAt?: number;
}

export type SystemMessageType = 'join' | 'leave' | 'warning' | 'info' | 'expire';

export type MessageContentType = 'text' | 'image';

export interface ChatMessage {
  id: string;
  sender: string;
  timestamp: number;
  isSystem?: boolean;
  systemType?: SystemMessageType;
  text: string;
  messageType?: MessageContentType;
  imageDataUrl?: string;
  caption?: string;
  status?: 'pending' | 'delivered' | 'failed';
  tempId?: string;
}

export interface CreateRoomPayload {
  roomName: string;
  password?: string;
  username?: string;
  ttlMinutes?: TTLMinutes;
}

export interface JoinRoomPayload {
  roomId: string;
  password?: string;
  username?: string;
}

export type SendMessagePayload =
  | { type: 'text'; text: string; tempId?: string }
  | { type: 'image'; dataUrl: string; caption?: string; tempId?: string };

export interface RateLimitErrorPayload {
  code: 429;
  message: string;
  retryAfterMs: number;
}

export type DeliveryAck =
  | {
      status: 'ok';
      timestamp: number;
      messageId?: string;
      tempId?: string;
      sanitizedText?: string;
      processingTimeMs?: number;
    }
  | { status: 'error'; reason: string };

export interface RoomOperationResult {
  success: boolean;
  room?: PublicRoomInfo;
  serverNow?: number;
  error?: string;
}

export interface RoomEvaporatedPayload {
  roomId: string;
  reason?: 'empty' | 'expired';
}

export interface RoomInfoUpdatePayload {
  roomId: string;
  name?: string;
  isPrivate?: boolean;
  userCount: number;
  expiresAt?: number;
}

export interface SocketSessionData {
  roomId?: string;
  username?: string;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Runtime Type Guards & Validators

export function isValidTTL(val: unknown): val is TTLMinutes {
  return val === null || val === undefined || val === 5 || val === 15 || val === 60;
}

export function isSendMessagePayload(val: unknown): val is SendMessagePayload {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  if (obj.type === 'text') {
    return typeof obj.text === 'string';
  }
  if (obj.type === 'image') {
    return (
      typeof obj.dataUrl === 'string' &&
      (obj.caption === undefined || typeof obj.caption === 'string')
    );
  }
  return false;
}

/**
 * Validates base64 Data URL format, length (<= 500KB), and magic bytes
 */
export function validateImageDataUrl(dataUrl: string): {
  valid: boolean;
  error?: string;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
} {
  if (typeof dataUrl !== 'string') {
    return { valid: false, error: 'Image data URL must be a string' };
  }

  // Max 500KB in raw payload length: ~683,000 base64 characters
  const MAX_DATA_URL_LENGTH = 700000;
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return { valid: false, error: 'Image exceeds 500KB transmission cap' };
  }

  const regex = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
  const match = dataUrl.match(regex);
  if (!match) {
    return { valid: false, error: 'Invalid image format. Only PNG, JPEG, and WebP are permitted.' };
  }

  const declaredType = match[1];
  const base64Data = match[2];

  try {
    // Decode first 16 bytes for magic-byte verification
    const headerBuffer = Buffer.from(base64Data.slice(0, 32), 'base64');
    if (headerBuffer.length < 4) {
      return { valid: false, error: 'Truncated image header bytes' };
    }

    if (declaredType === 'png') {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      if (
        headerBuffer[0] === 0x89 &&
        headerBuffer[1] === 0x50 &&
        headerBuffer[2] === 0x4e &&
        headerBuffer[3] === 0x47
      ) {
        return { valid: true, mimeType: 'image/png' };
      }
      return { valid: false, error: 'Corrupt or mismatched PNG magic bytes' };
    }

    if (declaredType === 'jpeg') {
      // JPEG magic bytes: FF D8 FF
      if (headerBuffer[0] === 0xff && headerBuffer[1] === 0xd8 && headerBuffer[2] === 0xff) {
        return { valid: true, mimeType: 'image/jpeg' };
      }
      return { valid: false, error: 'Corrupt or mismatched JPEG magic bytes' };
    }

    if (declaredType === 'webp') {
      // WebP magic bytes: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
      if (headerBuffer.length >= 12) {
        const isRiff =
          headerBuffer[0] === 0x52 &&
          headerBuffer[1] === 0x49 &&
          headerBuffer[2] === 0x46 &&
          headerBuffer[3] === 0x46;
        const isWebp =
          headerBuffer[8] === 0x57 &&
          headerBuffer[9] === 0x45 &&
          headerBuffer[10] === 0x42 &&
          headerBuffer[11] === 0x50;
        if (isRiff && isWebp) {
          return { valid: true, mimeType: 'image/webp' };
        }
      }
      return { valid: false, error: 'Corrupt or mismatched WebP magic bytes' };
    }

    return { valid: false, error: 'Unsupported format' };
  } catch {
    return { valid: false, error: 'Failed decoding base64 image data' };
  }
}
