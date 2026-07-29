import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, stores } from '../db/schema.js';
import type { ParsedProduct } from './xml-parser.js';

export interface SyncReport {
  imported: number;
  updated: number;
  new: number;
  skipped: number;
  errors: string[];
}

export async function syncProducts(storeId: number, parsedProducts: ParsedProduct[]): Promise<SyncReport> {
  const barcodes = parsedProducts
    .filter((p) => p.barcode !== null)
    .map((p) => p.barcode!);

  const productsWithoutBarcode = parsedProducts.filter((p) => p.barcode === null);

  if (barcodes.length === 0) {
    return {
      imported: 0,
      updated: 0,
      new: 0,
      skipped: productsWithoutBarcode.length,
      errors: ['No products with valid barcodes found in XML'],
    };
  }

  const existing = await db
    .select({ barcode: products.barcode, price: products.price, oldPrice: products.oldPrice })
    .from(products)
    .where(eq(products.storeId, storeId));

  const existingMap = new Map(
    existing.map((p) => [p.barcode, { price: Number(p.price), oldPrice: p.oldPrice ? Number(p.oldPrice) : null }])
  );

  const existingBarcodes = new Set(existing.map((p) => p.barcode));
  const newBarcodes = new Set(barcodes.filter((b) => !existingBarcodes.has(b)));

  const upsertData = parsedProducts
    .filter((p) => p.barcode !== null)
    .map((p) => {
      const existing = existingMap.get(p.barcode!);
      const newPrice = p.price;
      let old_price: number | null = null;

      if (existing) {
        if (newPrice < existing.price) {
          old_price = existing.price;
        } else if (newPrice > existing.price) {
          old_price = null;
        } else {
          old_price = existing.oldPrice;
        }
      }

      return {
        storeId,
        barcode: p.barcode!,
        internalRef: p.internalRef,
        name: p.name,
        price: String(p.price),
        oldPrice: old_price !== null ? String(old_price) : null,
      };
    });

  const BATCH_SIZE = 500;
  let updated = 0;
  let newCount = 0;

  for (let i = 0; i < upsertData.length; i += BATCH_SIZE) {
    const batch = upsertData.slice(i, i + BATCH_SIZE);

    const result = await db
      .insert(products)
      .values(batch)
      .onConflictDoUpdate({
        target: [products.storeId, products.barcode],
        set: {
          price: sql`excluded.price`,
          internalRef: sql`excluded.internal_ref`,
          name: sql`excluded.name`,
          oldPrice: sql`excluded.old_price`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({ barcode: products.barcode });

    for (const row of result) {
      if (newBarcodes.has(row.barcode)) {
        newCount++;
      } else {
        updated++;
      }
    }
  }

  await db.execute(sql`SELECT increment_version(${storeId})`);

  return {
    imported: barcodes.length,
    updated,
    new: newCount,
    skipped: productsWithoutBarcode.length,
    errors: [],
  };
}

export async function clearProducts(storeId: number): Promise<void> {
  await db.delete(products).where(eq(products.storeId, storeId));
  await db.execute(sql`SELECT increment_version(${storeId})`);
}
