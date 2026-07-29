import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stores, products } from '../db/schema.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { verifyQrToken } from '../middleware/auth.js';

const productRoutes = new Hono();

// =============================================
// Helper: verify store is active (used by all product routes)
// =============================================
async function getActiveStore(slug: string) {
  const [store] = await db.select().from(stores).where(eq(stores.slug, slug));
  if (!store) return { error: 'Store not found', status: 404 as const, code: 'NOT_FOUND' as const };
  if (!store.isActive) return { error: 'Store suspended. Contact support.', status: 403 as const, code: 'ACCOUNT_SUSPENDED' as const };
  if (store.expiresAt && new Date(store.expiresAt) < new Date()) return { error: 'Store expired. Renew your subscription.', status: 403 as const, code: 'ACCOUNT_EXPIRED' as const };
  return { store };
}

// =============================================
// GET /api/v1/products/:slug
// Public - requires QR token for bulk product listing
// =============================================
productRoutes.get('/v1/products/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const token = c.req.query('token');

    if (!token) {
      return c.json(errorResponse('QR token required', 'INVALID_TOKEN'), 401);
    }

    const qrPayload = verifyQrToken(token);
    if (!qrPayload) {
      return c.json(errorResponse('Invalid or expired QR token', 'INVALID_TOKEN'), 401);
    }

    if (qrPayload.slug !== slug) {
      return c.json(errorResponse('Token does not match this store', 'INVALID_TOKEN'), 401);
    }

    // Verify store is active
    const storeCheck = await getActiveStore(slug);
    if ('error' in storeCheck) {
      return c.json(errorResponse(storeCheck.error!, storeCheck.code!), storeCheck.status!);
    }

    const allProducts = await db.select({
      id: products.id,
      barcode: products.barcode,
      internalRef: products.internalRef,
      name: products.name,
      price: products.price,
      oldPrice: products.oldPrice,
      unit: products.unit,
    }).from(products).where(eq(products.storeId, storeCheck.store.id));

    return c.json(successResponse(allProducts));
  } catch (err) {
    return c.json(errorResponse('Failed to fetch products', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// GET /api/v1/products/:slug/:barcode
// Public - no token required, single product lookup
// =============================================
productRoutes.get('/v1/products/:slug/:barcode', async (c) => {
  try {
    const slug = c.req.param('slug');
    const barcode = c.req.param('barcode');

    // Verify store is active
    const storeCheck = await getActiveStore(slug);
    if ('error' in storeCheck) {
      return c.json(errorResponse(storeCheck.error!, storeCheck.code!), storeCheck.status!);
    }

    const [product] = await db.select({
      id: products.id,
      barcode: products.barcode,
      internalRef: products.internalRef,
      name: products.name,
      price: products.price,
      oldPrice: products.oldPrice,
      unit: products.unit,
    }).from(products).where(
      and(
        eq(products.storeId, storeCheck.store.id),
        eq(products.barcode, barcode)
      )
    );

    if (!product) {
      return c.json(errorResponse('Product not found', 'NOT_FOUND'), 404);
    }

    return c.json(successResponse(product));
  } catch (err) {
    return c.json(errorResponse('Failed to fetch product', 'DATABASE_ERROR'), 500);
  }
});

export default productRoutes;
