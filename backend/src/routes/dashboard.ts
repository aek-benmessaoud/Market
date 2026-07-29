import { Hono } from 'hono';
import { eq, count, max } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stores, products } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';

const dashboardRoutes = new Hono();

// =============================================
// GET /api/v1/dashboard/stats
// Protected - returns store analytics for the logged-in owner
// =============================================
dashboardRoutes.get('/v1/dashboard/stats', async (c) => {
  try {
    const storeId = c.get('storeId');

    const [store] = await db.select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      version: stores.version,
      updatedAt: stores.updatedAt,
    }).from(stores).where(eq(stores.id, storeId));

    if (!store) {
      return c.json(errorResponse('Store not found', 'NOT_FOUND'), 404);
    }

    const [productCount] = await db.select({
      total: count(),
    }).from(products).where(eq(products.storeId, storeId));

    const [lastSync] = await db.select({
      lastSync: max(products.updatedAt),
    }).from(products).where(eq(products.storeId, storeId));

    return c.json(successResponse({
      totalProducts: productCount.total,
      lastSync: lastSync.lastSync || null,
      version: store.version,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
      },
    }));
  } catch (err) {
    return c.json(errorResponse('Failed to fetch stats', 'DATABASE_ERROR'), 500);
  }
});

export default dashboardRoutes;
