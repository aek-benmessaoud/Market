import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { generateToken } from '../middleware/auth.js';

const auth = new Hono();

// =============================================
// VALIDATION SCHEMAS
// =============================================
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// =============================================
// POST /api/v1/auth/signup
// =============================================
auth.post('/v1/auth/signup', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      return c.json(errorResponse(message, 'VALIDATION_ERROR'), 400);
    }

    const { email, password, storeName, phone } = parsed.data;

    // Check if email already exists
    const existing = await db.select().from(stores).where(eq(stores.ownerEmail, email));
    if (existing.length > 0) {
      return c.json(errorResponse('Email already registered', 'DUPLICATE'), 409);
    }

    // Generate slug from store name
    let slug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      slug = `store-${Date.now()}`;
    }

    // Check if slug is unique
    const slugExists = await db.select().from(stores).where(eq(stores.slug, slug));
    if (slugExists.length > 0) {
      return c.json(errorResponse('Store name already taken, please choose another', 'DUPLICATE'), 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create store
    const [newStore] = await db.insert(stores).values({
      name: storeName,
      slug,
      ownerEmail: email,
      ownerPhone: phone || null,
      passwordHash,
      role: 'owner',
    }).returning({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      ownerEmail: stores.ownerEmail,
      role: stores.role,
      createdAt: stores.createdAt,
    });

    // Generate JWT
    const token = generateToken({
      storeId: newStore.id,
      slug: newStore.slug,
      role: newStore.role!,
      email: newStore.ownerEmail,
    });

    return c.json(successResponse({
      token,
      store: {
        id: newStore.id,
        name: newStore.name,
        slug: newStore.slug,
        email: newStore.ownerEmail,
        role: newStore.role,
      },
    }), 201);
  } catch (err) {
    return c.json(errorResponse('Signup failed', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// POST /api/v1/auth/login
// =============================================
auth.post('/v1/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      return c.json(errorResponse(message, 'VALIDATION_ERROR'), 400);
    }

    const { email, password } = parsed.data;

    // Find store by email
    const [store] = await db.select().from(stores).where(eq(stores.ownerEmail, email));
    if (!store) {
      return c.json(errorResponse('Invalid email or password', 'UNAUTHORIZED'), 401);
    }

    // Verify password
    const valid = await bcrypt.compare(password, store.passwordHash);
    if (!valid) {
      return c.json(errorResponse('Invalid email or password', 'UNAUTHORIZED'), 401);
    }

    // Check is_active
    if (!store.isActive) {
      return c.json(errorResponse('Account suspended. Contact support.', 'ACCOUNT_SUSPENDED'), 403);
    }

    // Check expires_at
    if (store.expiresAt && new Date(store.expiresAt) < new Date()) {
      return c.json(errorResponse('Account expired. Renew your subscription.', 'ACCOUNT_EXPIRED'), 403);
    }

    // Generate JWT
    const token = generateToken({
      storeId: store.id,
      slug: store.slug,
      role: store.role!,
      email: store.ownerEmail,
    });

    return c.json(successResponse({
      token,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        email: store.ownerEmail,
        role: store.role,
      },
    }));
  } catch (err) {
    return c.json(errorResponse('Login failed', 'DATABASE_ERROR'), 500);
  }
});

export default auth;
