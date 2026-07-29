import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

export interface JwtPayload {
  storeId: number;
  slug: string;
  role: string;
  email: string;
}

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    storeId: number;
    slug: string;
    role: string;
    email: string;
  }
}

function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function verifyJwt(c: Context, next: Next) {
  return (async () => {
    const token = extractToken(c);

    if (!token) {
      return c.json(errorResponse('Missing authorization token', 'UNAUTHORIZED'), 401);
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      c.set('storeId', payload.storeId);
      c.set('slug', payload.slug);
      c.set('role', payload.role);
      c.set('email', payload.email);
      await next();
    } catch (err) {
      return c.json(errorResponse('Invalid or expired token', 'UNAUTHORIZED'), 401);
    }
  })();
}

export function requireAdmin(c: Context, next: Next) {
  return (async () => {
    const role = c.get('role');
    if (role !== 'admin') {
      return c.json(errorResponse('Admin access required', 'FORBIDDEN'), 403);
    }
    await next();
  })();
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export interface QrPayload {
  storeId: number;
  slug: string;
  purpose: string;
}

export function generateQrToken(payload: QrPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

export function verifyQrToken(token: string): QrPayload | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as QrPayload;
    if (payload.purpose !== 'sync') return null;
    return payload;
  } catch {
    return null;
  }
}
