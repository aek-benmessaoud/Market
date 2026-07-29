import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stores } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';

const storeRoutes = new Hono();

// =============================================
// GET /api/v1/stores/:slug
// Public - returns store info if active and not expired
// =============================================
storeRoutes.get('/v1/stores/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const [store] = await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      version: stores.version,
      isActive: stores.isActive,
      expiresAt: stores.expiresAt,
    }).from(stores).where(eq(stores.slug, slug));

    if (!store) {
      return c.json(errorResponse('Store not found', 'NOT_FOUND'), 404);
    }

    if (!store.isActive) {
      return c.json(errorResponse('Store suspended. Contact support.', 'ACCOUNT_SUSPENDED'), 403);
    }

    if (store.expiresAt && new Date(store.expiresAt) < new Date()) {
      return c.json(errorResponse('Store expired. Renew your subscription.', 'ACCOUNT_EXPIRED'), 403);
    }

    return c.json(successResponse({
      id: store.id,
      name: store.name,
      slug: store.slug,
      version: store.version,
    }));
  } catch (err) {
    return c.json(errorResponse('Failed to fetch store', 'DATABASE_ERROR'), 500);
  }
});

export default storeRoutes;
