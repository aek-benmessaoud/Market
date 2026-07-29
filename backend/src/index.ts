import 'dotenv/config';

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimit } from './middleware/rate-limit.js';
import { serve } from '@hono/node-server';
import pino from 'pino';
import { successResponse, errorResponse } from './utils/response.js';
import { verifyJwt } from './middleware/auth.js';
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import storeRoutes from './routes/stores.js';
import productRoutes from './routes/products.js';
import dashboardRoutes from './routes/dashboard.js';
import syncRoutes from './routes/sync.js';
import adminRoutes from './routes/admin.js';
import { eq } from 'drizzle-orm';
import { stores } from './db/schema.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

// =============================================
// LOGGER (Pino)
// =============================================
const pinoLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// =============================================
// HONO APP
// =============================================
const app = new Hono();

// =============================================
// MIDDLEWARE CHAIN
// =============================================

// 1. Request logging (Hono built-in, feeds to Pino)
app.use('*', logger((str) => pinoLogger.info(str)));

// 2. Security headers
app.use('*', secureHeaders());

// 3. CORS
app.use('*', cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// 4. Rate limiting - Public routes (60 req/min)
app.use('/api/*', rateLimit(60 * 1000, parseInt(process.env.RATE_LIMIT_PUBLIC || '60')));

// 5. Rate limiting - Sync/Upload routes (5 req/min)
app.use('/api/v1/sync/*', rateLimit(60 * 1000, parseInt(process.env.RATE_LIMIT_SYNC || '5')));

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', (c) => {
  return c.json(successResponse({ status: 'ok', uptime: process.uptime() }));
});

// =============================================
// API ROUTES
// =============================================
const api = new Hono();

// Auth routes (public)
api.route('/', authRoutes);

// Store routes (public)
api.route('/', storeRoutes);

// Product routes (public, but bulk requires QR token)
api.route('/', productRoutes);

// Protected routes (JWT required)
const protectedApi = new Hono();
protectedApi.use('*', verifyJwt);

// Protected - Sync routes
protectedApi.route('/', syncRoutes);

// Protected - Dashboard
protectedApi.route('/', dashboardRoutes);

// Protected - Product update
protectedApi.put('/v1/products/:id', (c) => c.json(successResponse({ message: 'Not implemented yet' }), 501));

api.route('/', protectedApi);

// Admin routes (JWT + role: 'admin' required)
const adminApi = new Hono();
adminApi.use('*', verifyJwt);
adminApi.route('/', adminRoutes);
api.route('/', adminApi);

app.route('/api', api);

// TEMP: Promote user to admin (remove after use)
api.post('/v1/set-admin', async (c) => {
  const { email, secret } = await c.req.json();
  if (secret !== process.env.JWT_SECRET) {
    return c.json({ error: 'Invalid secret' }, 403);
  }
  const result = await db.update(stores).set({ role: 'admin' }).where(eq(stores.ownerEmail, email));
  return c.json({ success: true, message: `Admin role set for ${email}` });
});

// =============================================
// FRONTEND STATIC FILES
// =============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STATIC_DIR = join(__dirname, '../frontend/public');
const INDEX_HTML = readFileSync(join(STATIC_DIR, 'index.html'), 'utf-8');

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

app.get('/*', async (c) => {
  return c.html(INDEX_HTML);
});

// =============================================
// 404 HANDLER — serve static files or index.html
// =============================================
app.notFound(async (c) => {
  const path = c.req.path;

  if (path.startsWith('/api/')) {
    return c.json(errorResponse('Route not found', 'NOT_FOUND'), 404);
  }

  const filePath = join(STATIC_DIR, path);
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const content = readFileSync(filePath);
    return c.body(content, 200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    });
  }

  return c.html(INDEX_HTML);
});

// =============================================
// ERROR HANDLER
// =============================================
app.onError((err, c) => {
  pinoLogger.error({ err }, 'Unhandled error');
  return c.json(
    errorResponse('Internal server error', 'DATABASE_ERROR'),
    500
  );
});

// =============================================
// START SERVER
// =============================================
const port = parseInt(process.env.PORT || '3000');

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  pinoLogger.info(`Mini-Market API running on http://localhost:${info.port}`);
});

export default app;
