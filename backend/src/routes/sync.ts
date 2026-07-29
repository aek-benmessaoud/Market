import { Hono } from 'hono';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseXml } from '../utils/xml-parser.js';
import { syncProducts, clearProducts } from '../utils/sync-engine.js';

const sync = new Hono();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================
// POST /api/v1/sync/upload
// Protected - upload XML file, parse, and sync products
// =============================================
sync.post('/v1/sync/upload', async (c) => {
  try {
    const storeId = c.get('storeId');

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json(errorResponse('No file uploaded. Send a file with key "file".', 'VALIDATION_ERROR'), 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json(errorResponse('File too large. Maximum size is 10MB.', 'VALIDATION_ERROR'), 400);
    }

    if (!file.name.endsWith('.xml') && file.type !== 'text/xml' && file.type !== 'application/xml') {
      return c.json(errorResponse('Invalid file type. Only XML files are accepted.', 'VALIDATION_ERROR'), 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parseResult;
    try {
      parseResult = parseXml(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse XML file';
      return c.json(errorResponse(message, 'PARSE_ERROR'), 400);
    }

    if (parseResult.products.length === 0) {
      return c.json(successResponse({
        imported: 0,
        updated: 0,
        new: 0,
        skipped: parseResult.stats.total,
        errors: parseResult.errors,
        stats: parseResult.stats,
      }));
    }

    const syncReport = await syncProducts(storeId, parseResult.products);

    return c.json(successResponse({
      ...syncReport,
      errors: [...syncReport.errors, ...parseResult.errors],
      stats: parseResult.stats,
    }));
  } catch (err) {
    return c.json(errorResponse('Sync failed', 'DATABASE_ERROR'), 500);
  }
});

// =============================================
// POST /api/v1/sync/clear
// Protected - clear all products for the store
// =============================================
sync.post('/v1/sync/clear', async (c) => {
  try {
    const storeId = c.get('storeId');
    await clearProducts(storeId);

    return c.json(successResponse({ message: 'All products cleared' }));
  } catch (err) {
    return c.json(errorResponse('Failed to clear products', 'DATABASE_ERROR'), 500);
  }
});

export default sync;
