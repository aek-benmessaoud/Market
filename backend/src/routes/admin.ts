import { Hono } from 'hono';
import { eq, count, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stores, products } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { requireAdmin, generateQrToken } from '../middleware/auth.js';

const admin = new Hono();

admin.use('*', requireAdmin);

// =============================================
// GET /v1/admin/stores
// List all stores with product counts
// =============================================
admin.get('/v1/admin/stores', async (c) => {
  try {
    const allStores = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        ownerEmail: stores.ownerEmail,
        ownerPhone: stores.ownerPhone,
        isActive: stores.isActive,
        expiresAt: stores.expiresAt,
        role: stores.role,
        version: stores.version,
        createdAt: stores.createdAt,
      })
      .from(stores)
      .orderBy(desc(stores.createdAt));

    const storeIds = allStores.map((s) => s.id);
    const counts: Record<number, number> = {};

    if (storeIds.length > 0) {
      const productCounts = await db
        .select({ storeId: products.storeId, total: count() })
        .from(products)
        .groupBy(products.storeId);

      for (const row of productCounts) {
        counts[row.storeId] = row.total;
      }
    }

    const result = allStores.map((s) => ({
      ...s,
      productCount: counts[s.id] || 0,
    }));

    return c.json(successResponse(result));
  } catch (err) {
    return c.json(errorResponse('Failed to fetch stores', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// PUT /v1/admin/stores/:id/toggle-active
// Toggle block/unblock a store
// =============================================
admin.put('/v1/admin/stores/:id/toggle-active', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
      return c.json(errorResponse('Invalid store ID', 'VALIDATION_ERROR'), 400);
    }

    const [store] = await db.select({ isActive: stores.isActive }).from(stores).where(eq(stores.id, id));
    if (!store) {
      return c.json(errorResponse('Store not found', 'NOT_FOUND'), 404);
    }

    const newActive = !store.isActive;
    const [updated] = await db
      .update(stores)
      .set({ isActive: newActive })
      .where(eq(stores.id, id))
      .returning({ isActive: stores.isActive });

    return c.json(successResponse({
      id,
      isActive: updated.isActive,
      message: updated.isActive ? 'Store activated' : 'Store blocked',
    }));
  } catch (err) {
    return c.json(errorResponse('Failed to update store', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// PUT /v1/admin/stores/:id/expiry
// Set expiry date for a store
// =============================================
admin.put('/v1/admin/stores/:id/expiry', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
      return c.json(errorResponse('Invalid store ID', 'VALIDATION_ERROR'), 400);
    }

    const body = await c.req.json();
    const { expiresAt } = body;

    // null means no expiry (lifetime)
    const expiryDate = expiresAt ? new Date(expiresAt) : null;

    if (expiryDate && isNaN(expiryDate.getTime())) {
      return c.json(errorResponse('Invalid date format', 'VALIDATION_ERROR'), 400);
    }

    const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, id));
    if (!store) {
      return c.json(errorResponse('Store not found', 'NOT_FOUND'), 404);
    }

    await db.update(stores).set({ expiresAt: expiryDate }).where(eq(stores.id, id));

    return c.json(successResponse({
      id,
      expiresAt: expiryDate ? expiryDate.toISOString() : null,
      message: expiryDate ? `Expiry set to ${expiryDate.toISOString()}` : 'Expiry removed (lifetime)',
    }));
  } catch (err) {
    return c.json(errorResponse('Failed to set expiry', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// GET /v1/admin/stores/:id/qr-token
// Generate a QR sync token for a store
// =============================================
admin.get('/v1/admin/stores/:id/qr-token', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
      return c.json(errorResponse('Invalid store ID', 'VALIDATION_ERROR'), 400);
    }

    const [store] = await db.select({ id: stores.id, slug: stores.slug }).from(stores).where(eq(stores.id, id));
    if (!store) {
      return c.json(errorResponse('Store not found', 'NOT_FOUND'), 404);
    }

    const token = generateQrToken({
      storeId: store.id,
      slug: store.slug,
      purpose: 'sync',
    });

    const customerUrl = `/#/s/${store.slug}?token=${token}`;

    return c.json(successResponse({
      token,
      customerUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
  } catch (err) {
    return c.json(errorResponse('Failed to generate QR token', 'DATABASE_ERROR'), 500);
  }
});

export default admin;
