import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { registerRoomHandlers, broadcastRoomList } from './socket/roomHandler.js';
import { roomService } from './services/roomService.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { ChatMessage } from './types/index.js';

// Load environment configuration
dotenv.config();

// Startup Environment Validation (Fail Fast)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.CLIENT_ORIGIN) {
  console.error('❌ [InkDrop Server Fatal] Missing required environment variable: CLIENT_ORIGIN');
  console.error('In production, CLIENT_ORIGIN must specify the authorized client origin(s), e.g. https://inkdrop-app.vercel.app');
  process.exit(1);
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
if ((redisUrl && !redisToken) || (!redisUrl && redisToken)) {
  console.error(
    '❌ [InkDrop Server Fatal] Mismatched Redis configuration: Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided together, or both left blank for in-memory mode.'
  );
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Port binding fallback to 4000 if unspecified
const PORT = parseInt(process.env.PORT || '4000', 10);
if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(
    `❌ [InkDrop Server Fatal] Invalid PORT environment variable: "${process.env.PORT}". Must be a valid port number between 1 and 65535.`
  );
  process.exit(1);
}

// Dynamic CORS configuration parsing comma-separated list of origins for preview deploys
const RAW_CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.trim() || 'http://localhost:3000';
const ALLOWED_ORIGINS = RAW_CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // allow non-browser clients (uptime health checks, curl, tools)
  if (ALLOWED_ORIGINS.includes('*')) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Localhost development fallbacks
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') return true;

  // Wildcard preview deploy pattern matching (e.g. *.vercel.app or preview-*.domain.com)
  for (const pattern of ALLOWED_ORIGINS) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) return true;
    }
  }

  return false;
};

// Express Middleware Pipeline
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  })
);
app.use(express.json());

// Resilient Socket.io Server with Rapid Heartbeat Tuning
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // 1MB payload buffer for base64 ephemeral images
  pingTimeout: 10000,     // 10s ghost-connection detection
  pingInterval: 5000,      // 5s heartbeat interval
  transports: ['websocket', 'polling'],
});

// Wire TTL Expiry hook to gateway
roomService.onRoomExpired((roomId) => {
  console.log(`⌛ [Gateway] Room [${roomId}] expired. Broadcasting room_expired and disconnecting sockets.`);
  const sysMsg: ChatMessage = {
    id: crypto.randomUUID(),
    sender: 'SYSTEM',
    text: 'This pool has dissolved after its scheduled lifetime.',
    timestamp: Date.now(),
    isSystem: true,
    systemType: 'expire',
  };
  io.to(roomId).emit('new_message', sysMsg);
  io.to(roomId).emit('room_expired', { roomId, reason: 'expired' });
  io.in(roomId).socketsLeave(roomId);
  broadcastRoomList(io).catch(() => {});
});

// Minimal, zero-disk health probe endpoint for render cold-start wakeups and external pingers
app.get('/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
});

app.get('/api/rooms', async (_req, res) => {
  try {
    const rooms = await roomService.getPublicRooms();
    res.json({ success: true, count: rooms.length, rooms });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed fetching rooms';
    res.status(500).json({ success: false, error: msg });
  }
});

// Connection Lifecycle Gateway
io.on('connection', (socket) => {
  registerRoomHandlers(io, socket);
});

// Start Server: immediate non-blocking bind to 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  💧 ========================================================
  🌊 InkDrop Ephemeral Real-Time Gateway Active
  📡 Port: ${PORT} (0.0.0.0)
  🔗 Client Origin(s): ${ALLOWED_ORIGINS.join(', ')}
  🛡️ Moderation: Trie In-Flight Normalization Engine Active
  ⏱️ Rate Limiter: 5 pkts / 2000ms Sliding Window (60s GC)
  💓 Heartbeat: pingTimeout=10000ms, pingInterval=5000ms
  🔌 Circuit Breaker: ${roomService.getCircuitState()}
  ========================================================
  `);
});

// Graceful Process Termination (SIGTERM / SIGINT)
const gracefulShutdown = () => {
  console.log('\n🛑 Gracefully dissolving InkDrop Gateway...');
  rateLimiter.destroy();
  roomService.destroy();

  io.close(() => {
    console.log('✅ WebSocket gateway closed.');
    server.close(() => {
      console.log('✅ HTTP server closed. Goodbye.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('⚠️ Forcefully terminating gateway.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
