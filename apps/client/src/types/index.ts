/**
 * Shared Type Definitions for InkDrop (Client & Server Synchronized)
 * Mirrors: apps/server/src/types/index.ts
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
}

export interface ActiveRoomState {
  id: string;
  name: string;
  isPrivate: boolean;
  userCount: number;
  createdAt?: number;
  expiresAt?: number;
}

export interface RateLimitNotice {
  message: string;
  retryAfterMs: number;
  receivedAt: number;
}

export type ConnectionStatus = 'connecting' | 'waking' | 'connected' | 'reconnecting' | 'offline';

export type DeliveryAck =
  | { status: 'ok'; timestamp: number; messageId?: string }
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

export type SendMessagePayload =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string; caption?: string };

export function isValidTTL(val: unknown): val is TTLMinutes {
  return val === null || val === undefined || val === 5 || val === 15 || val === 60;
}
