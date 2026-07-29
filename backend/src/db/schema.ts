import { pgTable, serial, text, integer, numeric, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

// =============================================
// STORES TABLE
// =============================================
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  ownerEmail: text('owner_email').unique().notNull(),
  ownerPhone: text('owner_phone'),
  passwordHash: text('password_hash').notNull(),
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),
  role: text('role').default('owner'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================
// PRODUCTS TABLE
// =============================================
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  barcode: text('barcode').notNull(),
  internalRef: text('internal_ref'),
  name: text('name'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  oldPrice: numeric('old_price', { precision: 10, scale: 2 }),
  unit: text('unit'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueStoreBarcode: uniqueIndex('idx_products_store_barcode').on(table.storeId, table.barcode),
}));

// =============================================
// INFER TYPES
// =============================================
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
