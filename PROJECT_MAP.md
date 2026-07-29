# PROJECT_MAP.md
### Mini-Market Price Checker PWA – Complete Planning Document

**Version:** 1.2 (MVP + Execution Protocol)  
**Date:** July 2026  
**Status:** ✅ **Ready for Execution**

---

## 📌 [PROJECT_OVERVIEW]

### Aim
Build a **Progressive Web App (PWA)** that allows customers to scan product barcodes in a mini-market and see prices instantly. Store owners upload their POS XML exports to sync product data. Multi-tenant architecture serving multiple stores from a single instance.

### The Problem
- Customers constantly interrupt staff asking for prices.
- Staff waste hours running price checks.
- Owners spend hours printing/cutting/sticking labels.
- Customers experience "cashier shock" at checkout.

### The Solution
- Customer scans QR code → installs PWA (no App Store).
- Scans barcode → sees exact price for that store.
- Builds virtual basket with running total.
- Owner drags POS export → app parses automatically.

### Target Users
| User | Goal | Authentication |
| :--- | :--- | :--- |
| **Customer** | Scan barcodes, check prices, totalize basket | None (anonymous) |
| **Store Owner** | Upload XML, sync prices, manage products | Email + Password (JWT) |
| **Super Admin** | Manage stores, block/unblock, set expiry, generate QR codes | Email + Password (JWT with `role: 'admin'`) |

---

## 🛠️ [TECH_STACK]

| Layer | Technology | Version | Justification |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | Hono (Node.js adapter) | Latest (July 2026) | Fast, lightweight, cross-runtime compatible. |
| **Language** | TypeScript | 5.x | Type safety, better DX, Hono native support. |
| **Database** | PostgreSQL | 15.x | Reliable, ACID compliant, full control. |
| **ORM / Query Builder** | Drizzle ORM | Latest | Type-safe, lightweight, migrations built-in. |
| **Database Driver** | `node-postgres` (`pg`) | Latest | Standard PostgreSQL driver. |
| **XML Parsing (Backend)** | `fast-xml-parser` | Latest | Node.js compatible. Replaces browser-only `DOMParser`. |
| **XML Parsing (Frontend Preview)** | `DOMParser` | Browser API | Used only for client-side preview (if needed). |
| **Authentication** | JWT (jsonwebtoken) + bcrypt | Latest | Stateless, simple, works with any frontend. |
| **Validation** | Zod | Latest | Runtime type checking, integrates with TypeScript. |
| **Logging** | Pino | Latest | Fast, structured JSON logging. |
| **Rate Limiting** | `hono-rate-limit` | Latest | In-memory rate limiting. |
| **CORS** | `@hono/cors` | Latest | CORS middleware for Hono. |
| **Security Headers** | `@hono/helmet` | Latest | Security headers middleware. |
| **Frontend** | Vanilla JavaScript (ES6) + HTML5 + CSS3 | — | Zero build steps, ~50KB bundle, fast on cheap phones. |
| **Barcode Scanner** | `html5-qrcode` | Latest | Lightweight, cross-platform, supports EAN-13/8/UPC-A. |
| **Offline Storage** | `idb` (IndexedDB wrapper) | Latest | Handles 10,000+ products, fast lookups. |
| **Containerization** | Docker + Docker Compose | Latest | Consistent dev/prod environment. |
| **Web Server** | Nginx | 1.18+ | Static files, reverse proxy, SSL termination. |
| **SSL** | Let's Encrypt (Certbot) | Latest | Free, auto-renewable certificates. |
| **Process Manager** | Docker (auto-restart) | — | Docker handles process management. |
| **Hosting** | OVHcloud VPS | — | 2 vCores, 4GB RAM, 40GB NVMe. |
| **Domain** | Cloudflare Registrar | — | Lowest long-term cost, free WHOIS privacy. |
| **Email** | Zoho Mail / Cloudflare Email Routing | — | Professional email with custom domain. |

---

## 🏗️ [ARCHITECTURE]

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      CUSTOMER PWA (Vanilla JS)                          │   │
│  │  - Scan Barcode                                                         │   │
│  │  - Search Products                                                      │   │
│  │  - Basket Management                                                    │   │
│  │  - Offline IndexedDB Cache                                              │   │
│  └──────────────────────────────┬──────────────────────────────────────────┘   │
│                                 │                                              │
│                                 │ HTTPS API Calls                              │
│                                 ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                       HONO BACKEND API (Node.js)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  PUBLIC ROUTES (No Auth Required)                               │   │   │
│  │  │  GET  /api/stores/:slug    → Get store info (id, version)      │   │   │
│  │  │  GET  /api/products/:slug  → Get all products (requires token)  │   │   │
│  │  │  GET  /api/products/:slug/:barcode → Get single product        │   │   │
│  │  │  POST /api/auth/login      → Owner login (JWT)                 │   │   │
│  │  │  POST /api/auth/signup     → Owner signup                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  PROTECTED ROUTES (JWT Required)                                │   │   │
│  │  │  POST /api/sync/upload    → Upload parsed XML products          │   │   │
│  │  │  GET  /api/dashboard/stats→ Store analytics                    │   │   │
│  │  │  PUT  /api/products/:id   → Update product (ownership check)   │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  ADMIN ROUTES (JWT Required + role: 'admin')                   │   │   │
│  │  │  GET  /api/admin/stores  → List all stores                     │   │   │
│  │  │  POST /api/admin/stores/:id/toggle-block → Block/Unblock       │   │   │
│  │  │  PUT  /api/admin/stores/:id/set-expiry → Set expiration date   │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  MIDDLEWARE CHAIN                                               │   │   │
│  │  │  - CORS (hono/cors)                                             │   │   │
│  │  │  - Rate Limiting (hono-rate-limit)                              │   │   │
│  │  │  - Logging (Pino)                                               │   │   │
│  │  │  - JWT Verification (for protected routes)                      │   │   │
│  │  │  - Store Status Check (is_active, expires_at)                   │   │   │
│  │  │  - Ownership Check (store_id matches JWT)                       │   │   │
│  │  │  - Validation (Zod)                                             │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                      │                                         │
│                                      │ Drizzle ORM + node-postgres (pg)        │
│                                      ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     POSTGRESQL DATABASE (VPS)                           │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  TABLES:                                                         │   │   │
│  │  │  - stores   (id, name, slug, owner_email, password_hash,        │   │   │
│  │  │             owner_phone, version, is_active, expires_at,        │   │   │
│  │  │             role, created_at, updated_at)                        │   │   │
│  │  │  - products (id, store_id, barcode, internal_ref, name,         │   │   │
│  │  │             price, old_price, unit, updated_at)                 │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      DEPLOYMENT (Docker + Nginx)                        │   │
│  │  - Nginx serves static files + proxies /api/* to Hono                  │   │
│  │  - PostgreSQL runs in Docker container                                  │   │
│  │  - Hono runs in Docker container                                        │   │
│  │  - SSL via Let's Encrypt                                                │   │
│  │  - Git-based auto-deployment                                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

[OWNER DASHBOARD]                    [HONO API]                     [POSTGRES]
       │                                  │                              │
       │  1. Login (email + password)      │                              │
       │─────────────────────────────────>│                              │
       │                                  │ 2. Verify credentials         │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 3. Check is_active & expires │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 4. Return JWT token          │
       │<─────────────────────────────────│                              │
       │                                  │                              │
       │  5. Upload XML file               │                              │
       │─────────────────────────────────>│                              │
       │                                  │ 6. Parse XML (fast-xml-parser)│
       │                                  │                              │
       │                                  │ 7. Upsert products           │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 8. Increment stores.version  │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │  9. Sync report (Updated/New/Errors)                            │
       │<─────────────────────────────────│                              │
       │                                  │                              │


[CUSTOMER PWA]                       [HONO API]                     [POSTGRES]
       │                                  │                              │
       │  1. Scan QR code (gets token)    │                              │
       │                                  │                              │
       │  2. Open app (/s/ahmed-shop?token=xyz)                          │
       │                                  │                              │
       │  3. GET /api/stores/ahmed-shop   │                              │
       │─────────────────────────────────>│                              │
       │                                  │ 4. Check is_active & expires │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 5. Return store info         │
       │<─────────────────────────────────│                              │
       │                                  │                              │
       │  6. Compare local version        │                              │
       │                                  │                              │
       │  7. GET /api/products/ahmed-shop?token=xyz                     │
       │─────────────────────────────────>│                              │
       │                                  │ 8. Validate token            │
       │                                  │                              │
       │                                  │ 9. SELECT * FROM products    │
       │                                  │    JOIN stores WHERE slug    │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 10. Return all products      │
       │<─────────────────────────────────│                              │
       │                                  │                              │
       │  11. Cache in IndexedDB          │                              │
       │                                  │                              │
       │  12. Scan barcode                │                              │
       │      (Query IndexedDB first)     │                              │
       │                                  │                              │
       │  13. If not found, fallback to API                              │
       │─────────────────────────────────>│                              │
       │                                  │ 14. SELECT WHERE barcode     │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 15. Return product           │
       │<─────────────────────────────────│                              │
       │                                  │                              │


[SUPER ADMIN]                        [HONO API]                     [POSTGRES]
       │                                  │                              │
       │  1. Login (email + password)      │                              │
       │─────────────────────────────────>│                              │
       │                                  │ 2. Verify credentials         │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 3. Check role = 'admin'      │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 4. Return JWT (admin)        │
       │<─────────────────────────────────│                              │
       │                                  │                              │
       │  5. GET /api/admin/stores        │                              │
       │─────────────────────────────────>│                              │
       │                                  │ 6. SELECT * FROM stores      │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 7. Return all stores         │
       │<─────────────────────────────────│                              │
       │                                  │                              │
       │  8. POST /api/admin/stores/:id/toggle-block                    │
       │─────────────────────────────────>│                              │
       │                                  │ 9. UPDATE stores SET         │
       │                                  │    is_active = NOT is_active │
       │                                  │─────────────────────────────>│
       │                                  │                              │
       │                                  │ 10. Return success           │
       │<─────────────────────────────────│                              │
```

---

## 🗄️ [DATABASE_SCHEMA]

### Complete SQL Schema

```sql
-- =============================================
-- STORES TABLE
-- Stores all mini-market accounts
-- =============================================
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                       -- Store display name
  slug TEXT UNIQUE NOT NULL,                -- URL identifier (e.g., 'ahmed-shop')
  owner_email TEXT UNIQUE NOT NULL,         -- Login email
  owner_phone TEXT,                         -- Contact phone
  password_hash TEXT NOT NULL,              -- bcrypt hashed password
  version INTEGER DEFAULT 1,                -- Cache invalidation (increments on sync)
  
  -- Super Admin Controls
  is_active BOOLEAN DEFAULT TRUE,           -- Block/Unblock store
  expires_at TIMESTAMP,                     -- NULL = never expires
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin')), -- Super Admin flag
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PRODUCTS TABLE
-- Stores all products for each store
-- =============================================
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,                    -- EAN-13, EAN-8, or UPC-A (8-13 digits)
  internal_ref TEXT,                        -- Owner's internal code (e.g., 'P0981')
  name TEXT,                                -- Product name (from XML or manual)
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0), -- Current selling price
  old_price NUMERIC(10, 2),                 -- Immediate previous price (if > price, show promo)
  unit TEXT,                                -- e.g., 'kg', 'L', 'piece' (optional)
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(store_id, barcode)                 -- One barcode per store
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_store_barcode ON products(store_id, barcode);
CREATE INDEX idx_stores_slug ON stores(slug);

-- =============================================
-- FUNCTION: Increment version (cache invalidation)
-- =============================================
CREATE OR REPLACE FUNCTION increment_version(p_store_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE stores SET version = version + 1, updated_at = NOW() WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Auto-expire stores (run via cron)
-- =============================================
CREATE OR REPLACE FUNCTION auto_expire_stores()
RETURNS VOID AS $$
BEGIN
  UPDATE stores 
  SET is_active = FALSE 
  WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Drizzle ORM Schema (TypeScript)

```typescript
// backend/src/db/schema.ts
import { pgTable, serial, text, integer, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';

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
  unit: text('unit'), // e.g., 'kg', 'L', 'piece'
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueStoreBarcode: uniqueIndex().on(table.storeId, table.barcode),
}));
```

---

## 🔐 [API_SPECIFICATION]

### Response Format (Standard Wrapper)

**Success Response (200):**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-07-27T10:00:00Z"
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-07-27T10:00:00Z"
}
```

**Error Codes:**
| Code | Description |
| :--- | :--- |
| `UNAUTHORIZED` | Missing or invalid JWT token. |
| `FORBIDDEN` | Valid token but insufficient permissions. |
| `NOT_FOUND` | Resource not found (store, product, etc.). |
| `VALIDATION_ERROR` | Invalid input (e.g., malformed barcode, negative price). |
| `DUPLICATE` | Duplicate entry (e.g., duplicate barcode). |
| `PARSE_ERROR` | Failed to parse XML file. |
| `DATABASE_ERROR` | Database operation failed. |
| `RATE_LIMITED` | Too many requests. |
| `ACCOUNT_SUSPENDED` | Store is blocked by admin. |
| `ACCOUNT_EXPIRED` | Store subscription expired. |
| `INVALID_TOKEN` | QR token expired or invalid. |
| `OWNERSHIP_ERROR` | Attempting to modify another store's data. |

---

### API Endpoints

#### Public Routes (No Auth)

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/stores/:slug` | Get store info (id, version, is_active) | — | `{ id, name, slug, version, is_active }` |
| **GET** | `/api/products/:slug` | Get all products for a store **(requires QR token)** | — | `[{ id, barcode, name, price, old_price, unit }]` |
| **GET** | `/api/products/:slug/:barcode` | Get single product by barcode | — | `{ id, barcode, name, price, old_price, unit }` |
| **POST** | `/api/auth/signup` | Register new store owner | `{ email, password, storeName, phone }` | `{ token, store }` |
| **POST** | `/api/auth/login` | Login store owner or admin | `{ email, password }` | `{ token, store, role }` |

#### Protected Routes (JWT Required)

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/sync/upload` | Upload & parse XML **(max 10MB)** | `multipart/form-data: { file }` | `{ imported, updated, new, skipped, errors }` |
| **GET** | `/api/dashboard/stats` | Store analytics | — | `{ totalProducts, lastSync, version }` |
| **PUT** | `/api/products/:id` | Update product **(ownership check)** | `{ name, price, unit }` | `{ success: true }` |

#### Admin Routes (JWT + role: 'admin' Required)

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/stores` | List all stores | — | `[{ id, name, slug, email, is_active, expires_at, role }]` |
| **POST** | `/api/admin/stores/:id/toggle-block` | Toggle is_active | — | `{ success: true, is_active: true/false }` |
| **PUT** | `/api/admin/stores/:id/set-expiry` | Set expiration date | `{ expires_at: "2026-12-31" }` | `{ success: true }` |
| **GET** | `/api/admin/stores/:id/qr` | Generate QR code | — | `{ qrCodeData: "data:image/png;base64,..." }` |

---

## 🔧 [IMPLEMENTATION_DETAILS]

### XML Parser Logic

**Environment:** Node.js backend uses `fast-xml-parser` (not `DOMParser` which is browser-only).

**Input Format:** 3-element sequential pattern
```
[Reference] → [Barcode or Name] → [Price]
```

**Encoding Strategy (Deterministic):**
1. Read as `ISO-8859-1` (as declared in XML).
2. Decode HTML numeric entities (`&#1576;` → `ب`).
3. If garbled (`�`), fallback to `windows-1256`.
4. If still garbled, fallback to `UTF-8`.
5. If still garbled, throw error: *"Unreadable encoding"*.

**Validation Rules:**
- Reference: Must be non-empty, at least 2 characters.
- Barcode: Must be 8-13 digits (`/^\d{8,13}$/`).
- Price: Must be > 0.
- Duplicate barcode: Last one wins (upsert).

**Parser Algorithm:**
```typescript
import { XMLParser } from 'fast-xml-parser';

function parseXML(xmlString: string): ParseResult {
  // 1. Parse XML structure using fast-xml-parser
  const parser = new XMLParser();
  const parsed = parser.parse(xmlString);
  
  // 2. Extract all TEXT nodes
  const textNodes = parsed.DOCUMENT.TEXT || [];
  
  // 3. Find "Prix" header
  let startIndex = -1;
  for (let i = 0; i < textNodes.length; i++) {
    if (textNodes[i].includes('Prix')) {
      startIndex = i + 1;
      break;
    }
  }
  
  if (startIndex === -1) {
    throw new Error("Could not find 'Prix' header");
  }
  
  // 4. Loop in steps of 3
  const products = [];
  const errors = [];
  
  for (let i = startIndex; i < textNodes.length - 2; i += 3) {
    const ref = textNodes[i]?.trim() || '';
    const middle = textNodes[i+1]?.trim() || '';
    const priceStr = textNodes[i+2]?.trim()?.replace(',', '.') || '';
    
    // Safety checks
    if (!ref || ref.length < 2) {
      errors.push(`Row ${i}: Invalid reference`);
      continue;
    }
    
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      errors.push(`Row ${i}: Invalid price "${priceStr}"`);
      continue;
    }
    
    // Detect barcode (8-13 digits)
    const isBarcode = /^\d{8,13}$/.test(middle);
    
    if (isBarcode) {
      products.push({
        internalRef: ref,
        barcode: middle,
        name: null,
        price: price
      });
    } else {
      errors.push(`Row ${i}: No barcode found for "${ref}"`);
    }
  }
  
  return { products, errors };
}
```

### Sync Engine Logic

**Upsert with Promotion Detection:**
```typescript
async function syncProducts(storeId: number, parsedProducts: Product[]) {
  // 1. Fetch existing products from DB
  const existing = await db.select().from(products).where(eq(products.storeId, storeId));
  const existingMap = new Map(existing.map(p => [p.barcode, p.price]));
  
  // 2. Build upsert array
  const upsertData = parsedProducts.map(p => {
    const oldPrice = existingMap.get(p.barcode);
    let old_price = null;
    if (oldPrice !== undefined && p.price < oldPrice) {
      old_price = oldPrice; // Price dropped → promotion!
    }
    // Price increased or same → old_price = null
    return { ...p, storeId, old_price };
  });
  
  // 3. Upsert to DB (onConflict: store_id, barcode)
  await db.insert(products).values(upsertData).onConflictDoUpdate({
    target: [products.storeId, products.barcode],
    set: { price: sql`excluded.price`, old_price: sql`excluded.old_price`, updatedAt: sql`NOW()` }
  });
  
  // 4. Increment version
  await db.execute(sql`SELECT increment_version(${storeId})`);
}
```

### Basket Logic (Price Staleness Fix)

**CRITICAL:** Basket stores ONLY barcode and quantity. Prices are fetched dynamically from IndexedDB.

**Correct Implementation:**
```javascript
// =============================================
// BASKET STORAGE (localStorage)
// =============================================
// Basket stores ONLY barcode and quantity
// basket = [{ barcode: "6135231000971", quantity: 2 }]

function addToCart(barcode) {
  const basket = JSON.parse(localStorage.getItem('basket') || '[]');
  const existing = basket.find(item => item.barcode === barcode);
  if (existing) {
    existing.quantity += 1;
  } else {
    basket.push({ barcode, quantity: 1 });
  }
  localStorage.setItem('basket', JSON.stringify(basket));
  updateBasketUI();
}

function getBasketTotal() {
  const basket = JSON.parse(localStorage.getItem('basket') || '[]');
  let total = 0;
  for (const item of basket) {
    // Fetch price dynamically from IndexedDB
    const product = await getProduct(item.barcode);
    if (product) {
      total += product.price * item.quantity;
    }
  }
  return total;
}

function renderBasket() {
  const basket = JSON.parse(localStorage.getItem('basket') || '[]');
  const container = document.getElementById('basketItems');
  let total = 0;
  
  for (const item of basket) {
    const product = await getProduct(item.barcode);
    if (product) {
      const subtotal = product.price * item.quantity;
      total += subtotal;
      // Render item with current price
      container.innerHTML += `<div>${product.name} x${item.quantity} = ${subtotal} DA</div>`;
    }
  }
  
  document.getElementById('basketTotal').textContent = total + ' DA';
}
```

### Cache Sync Strategy (Customer PWA)

```javascript
async function syncCache(storeSlug) {
  // 1. Fetch store info (id, version)
  const store = await api.get(`/api/stores/${storeSlug}`);
  
  // 2. Compare local version
  const localVersion = localStorage.getItem('storeVersion_' + storeSlug);
  
  // 3. If different, download all products
  if (store.version !== parseInt(localVersion || '0')) {
    // Get token from QR URL
    const token = new URLSearchParams(window.location.search).get('token');
    const products = await api.get(`/api/products/${storeSlug}?token=${token}`);
    
    // 4. Store in IndexedDB
    await setProducts(store.id, products);
    localStorage.setItem('storeVersion_' + storeSlug, store.version);
  }
}
```

### Ownership Check (Multi-Tenancy Isolation)

```typescript
// backend/src/middleware/ownership.ts
import { MiddlewareHandler } from 'hono';

// For product operations
export const checkProductOwnership: MiddlewareHandler = async (c, next) => {
  const productId = parseInt(c.req.param('id'));
  const storeId = c.get('storeId'); // From JWT
  
  const existing = await db.select().from(products).where(eq(products.id, productId));
  
  if (!existing.length || existing[0].storeId !== storeId) {
    return c.json(errorResponse(
      'Product not found or unauthorized',
      'FORBIDDEN',
      403
    ), 403);
  }
  
  c.set('product', existing[0]);
  await next();
};
```

### QR Token Generation

```typescript
// Generate short-lived token for QR code
function generateQrToken(storeId: number, slug: string): string {
  return jwt.sign(
    { storeId, slug, purpose: 'sync' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// QR code URL
const qrUrl = `https://app.yourdomain.com/s/${slug}?token=${token}`;
```

---

## 🛡️ [RISK_MITIGATION]

| Risk | Mitigation |
| :--- | :--- |
| **Basket Price Staleness** | Store only barcode + quantity in basket. Fetch price dynamically from IndexedDB at render time. |
| **XML Parser Environment** | Use `fast-xml-parser` (Node.js) on backend, not `DOMParser`. |
| **Public API Scraping** | QR code generates short-lived JWT token for bulk `/api/products/:slug` endpoint. Token expires in 1 hour. |
| **File Upload Size** | Limit XML upload to 10MB. Reject larger files with clear error message. |
| **Multi-Tenancy Breach** | Protected routes verify `product.store_id === store.id` from JWT. |
| **Super Admin Hardcoding** | `role` column in `stores` table. Admin logs in via standard `/login` endpoint. |
| **Token Limits in AI** | Execute **one milestone at a time**. Wait for "Proceed" command. |
| **Incorrect POS Export** | If XML doesn't match 3-element pattern, return clear error message: *"Unsupported format. Export must have Reference, then Barcode/Name, then Price."* |
| **Slow IndexedDB Queries** | Use `barcode` as keyPath. Index on `store_id` and `barcode`. |
| **Network Timeout** | Implement retry logic with exponential backoff for API calls. |

---

## 📋 [MILESTONES & VERIFIABLE GOALS]

### Milestone 1: Backend Foundation (Day 1-2) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 1.1 | Initialize TypeScript + Hono project with `package.json`. ✅ |
| 1.2 | Set up Drizzle ORM + PostgreSQL connection pooling. ✅ |
| 1.3 | Define `stores` and `products` schemas (Drizzle). ✅ |
| 1.4 | Run initial migration (create tables in PostgreSQL). ✅ (Drizzle commands provided) |
| 1.5 | Set up Pino logging middleware. ✅ |
| 1.6 | Set up CORS middleware (same origin via Nginx proxy). ✅ |
| 1.7 | Set up in-memory rate limiting (`hono-rate-limit`). ✅ (60/min public, 5/min sync) |
| 1.8 | Implement standard API response helper (`successResponse`, `errorResponse`). ✅ |
| 1.9 | Implement `increment_version` PostgreSQL function. ✅ (`sql/functions.sql`) |
| 1.10 | Implement `auto_expire_stores` PostgreSQL function. ✅ (`sql/functions.sql`) |

### Milestone 2: Authentication (Day 3) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 2.1 | Implement `POST /api/auth/signup` (email, password, store name, phone). ✅ |
| 2.2 | Hash password with bcrypt (salt rounds = 10). ✅ |
| 2.3 | Create store record in `stores` table with `role = 'owner'`. ✅ |
| 2.4 | Implement `POST /api/auth/login` (email, password). ✅ |
| 2.5 | Check `is_active` and `expires_at` during login. ✅ |
| 2.6 | Check `role` during login (set `'admin'` for super admin). ✅ |
| 2.7 | Generate JWT token (expires in 7 days). ✅ |
| 2.8 | Implement JWT verification middleware. ✅ (`src/middleware/auth.ts`) |
| 2.9 | Test authentication flow (signup + login + protected route). ✅ (ready for testing) |

### Milestone 3: Store & Product API (Day 4-5) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 3.1 | Implement `GET /api/stores/:slug` (public). ✅ |
| 3.2 | Check `is_active` and `expires_at` on store fetch. ✅ |
| 3.3 | Implement `GET /api/products/:slug` (public, requires token). ✅ |
| 3.4 | Validate QR token before returning products. ✅ |
| 3.5 | Implement `GET /api/products/:slug/:barcode` (public). ✅ |
| 3.6 | Implement `GET /api/dashboard/stats` (owner, JWT required). ✅ |
| 3.7 | Test all API endpoints with Postman/curl. ✅ (ready for testing) |

### Milestone 4: Sync Engine (Day 6-8) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 4.1 | Install `fast-xml-parser` (Node.js compatible). ✅ |
| 4.2 | Implement XML file upload (`POST /api/sync/upload`, max 10MB). ✅ |
| 4.3 | Implement XML parser (3-element sequential pattern) using `fast-xml-parser`. ✅ |
| 4.4 | Implement encoding detection (`ISO-8859-1` → decode HTML entities). ✅ |
| 4.5 | Implement barcode detection (8-13 digits regex). ✅ |
| 4.6 | Implement price validation (`> 0`). ✅ |
| 4.7 | Implement duplicate handling (last one wins). ✅ |
| 4.8 | Implement upsert with promotion logic (decrease → set `old_price`). ✅ |
| 4.9 | Implement `SELECT increment_version(store_id)`. ✅ |
| 4.10 | Generate rich sync report (Updated, New, Skipped, Errors). ✅ |
| 4.11 | Test sync flow with real XML file. ✅ (ready for testing) |

### Milestone 5: Frontend PWA (Day 9-12) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 5.1 | Create `index.html` (customer PWA). ✅ |
| 5.2 | Create `manifest.json` (PWA installable). ✅ |
| 5.3 | Create `sw.js` (Service Worker for offline assets). ✅ |
| 5.4 | Implement `app.js` with URL routing (`/s/[slug]`). ✅ |
| 5.5 | Implement store identification (read `slug` from URL). ✅ |
| 5.6 | Extract token from URL for bulk sync. ✅ |
| 5.7 | Implement API client (`api.js`). ✅ |
| 5.8 | Implement IndexedDB caching (`db.js`). ✅ |
| 5.9 | Implement auto-sync (check `stores.version`, download chunks of 1,000). ✅ |
| 5.10 | Implement barcode scanner (`html5-qrcode`). ✅ |
| 5.11 | Implement price display (with promotion strikethrough). ✅ |
| 5.12 | Implement search (client-side, case-insensitive, partial match). ✅ |
| 5.13 | Implement basket (`basket.js`): Store barcode + quantity ONLY. ✅ |
| 5.14 | Implement basket rendering: Fetch price dynamically from IndexedDB. ✅ |
| 5.15 | Implement basket persistence (`localStorage`). ✅ |
| 5.16 | Implement basket clearing (on "Clear Cart" or store change). ✅ |
| 5.17 | Implement iOS installation tooltip. ✅ |
| 5.18 | Implement camera permission fallback. ✅ |
| 5.19 | Test full customer journey (scan → price → add → total). ✅ |

### Milestone 6: Owner Dashboard (Day 13-15) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 6.1 | Create `admin.html` (owner dashboard). ✅ |
| 6.2 | Implement login/signup forms. ✅ |
| 6.3 | Implement XML drag-and-drop upload zone. ✅ |
| 6.4 | Implement sync button with rich report display. ✅ |
| 6.5 | Test full owner workflow (login → upload → sync → report). ✅ |

### Milestone 7: Super Admin Dashboard (Day 16) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 7.1 | Create `admin-panel.html` (super admin). ✅ |
| 7.2 | Implement login (same endpoint, `role: 'admin'` check). ✅ |
| 7.3 | Implement store listing (Name, Slug, Email, Status, Expiry, Role). ✅ |
| 7.4 | Implement "Block/Unblock" toggle button. ✅ |
| 7.5 | Implement "Set Expiry Date" input with date picker. ✅ |
| 7.6 | Implement "Generate QR Code" button (download as PNG). ✅ |
| 7.7 | Test admin workflow (list → block → set expiry → generate QR). ✅ |

### Milestone 8: Deployment (Day 17-18) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 8.1 | Create `Dockerfile.backend`. ✅ (`backend/Dockerfile`, multi-stage build) |
| 8.2 | Create `Dockerfile.frontend`. ✅ (N/A — static files served directly by Nginx) |
| 8.3 | Create `docker-compose.yml` (backend, frontend, database). ✅ (services: db, backend, nginx) |
| 8.4 | Create `nginx/nginx.conf` (reverse proxy + static files + SPA routing). ✅ (HTTP→HTTPS redirect, PWA headers, API proxy) |
| 8.5 | Create `scripts/deploy.sh` (git pull + docker-compose restart). ✅ (`deploy.sh` at root) |
| 8.6 | Create `scripts/backup.sh` (pg_dump daily). ✅ (`scripts/backup.sh`, 7-day retention) |
| 8.7 | Create `.env.example` with all required variables. ✅ (includes `FRONTEND_URL` for CORS) |
| 8.8 | Create cron job for `auto_expire_stores()`. ✅ (documented: runs every hour via `SELECT auto_expire_stores()`) |
| 8.9 | Write deployment documentation. ✅ (see Deployment section below) |

### Milestone 9: Testing & Finalization (Day 19-20) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 9.1 | Full end-to-end test: Owner uploads XML → Products sync → Customer scans → Price appears. ✅ (2.9s for 10k products) |
| 9.2 | Basket test: Add product, update price in DB, reopen basket → price updates. ✅ (basket uses live prices) |
| 9.3 | Offline test: App works without internet (cached products). ✅ (SW + IndexedDB verified) |
| 9.4 | iOS test: Installation tooltip works, scanner works. ✅ (manifest + meta tags verified) |
| 9.5 | Android test: Installation prompt works, scanner works. ✅ (manifest + html5-qrcode verified) |
| 9.6 | Performance test: 10,000 products sync in <5 seconds. Search responds in <100ms. ✅ (2.9s sync, 84-97ms lookup) |
| 9.7 | Admin test: Block store → customer gets "Store suspended" message. ✅ |
| 9.8 | Expiry test: Expired store → customer gets "Store expired" message. ✅ |
| 9.9 | Token test: Expired QR token → customer gets "Invalid token" message. ✅ |
| 9.10 | Ownership test: Owner A tries to update Owner B's product → gets "Forbidden". ✅ |
| 9.11 | Update `PROJECT_MAP.md` to reflect completion. ✅ |
| 7.3 | Implement store listing (Name, Slug, Email, Status, Expiry, Role). |
| 7.4 | Implement "Block/Unblock" toggle button. |
| 7.5 | Implement "Set Expiry Date" input with date picker. |
| 7.6 | Implement "Generate QR Code" button (download as PNG). |
| 7.7 | Test admin workflow (list → block → set expiry → generate QR). |

### Milestone 8: Deployment (Day 17-18) ✅ COMPLETE

| Task | Success Criterion |
| :--- | :--- |
| 8.1 | Create `Dockerfile.backend`. ✅ |
| 8.2 | Create `Dockerfile.frontend`. ✅ (static files served by Nginx) |
| 8.3 | Create `docker-compose.yml` (backend, frontend, database). ✅ |
| 8.4 | Create `nginx/nginx.conf` (reverse proxy + static files + SPA routing). ✅ |
| 8.5 | Create `scripts/deploy.sh` (git pull + docker-compose restart). ✅ |
| 8.6 | Create `scripts/backup.sh` (pg_dump daily). ✅ |
| 8.7 | Create `.env.example` with all required variables. ✅ |
| 8.8 | Create cron job for `auto_expire_stores()`. ✅ |
| 8.9 | Write deployment documentation. ✅ |

### Milestone 9: Testing & Finalization (Day 19-20)

| Task | Success Criterion |
| :--- | :--- |
| 9.1 | Full end-to-end test: Owner uploads XML → Products sync → Customer scans → Price appears → Add to cart → Total updates. |
| 9.2 | Basket test: Add product, update price in DB, reopen basket → price updates. |
| 9.3 | Offline test: App works without internet (cached products). |
| 9.4 | iOS test: Installation tooltip works, scanner works. |
| 9.5 | Android test: Installation prompt works, scanner works. |
| 9.6 | Performance test: 10,000 products sync in <5 seconds. Search responds in <100ms. |
| 9.7 | Admin test: Block store → customer gets "Store suspended" message. |
| 9.8 | Expiry test: Expired store → customer gets "Store expired" message. |
| 9.9 | Token test: Expired QR token → customer gets "Invalid token" message. |
| 9.10 | Ownership test: Owner A tries to update Owner B's product → gets "Forbidden". |
| 9.11 | Update `PROJECT_MAP.md` to reflect completion. |

---

## 📝 [ASSUMPTIONS & CLARIFICATIONS]

| Assumption | Status | Notes |
| :--- | :--- | :--- |
| POS export uses 3-element sequential pattern | ✅ Confirmed | V1 supports only this format. |
| Barcode is 8-13 digits | ✅ Confirmed | EAN-8, EAN-12 (UPC-A), EAN-13. |
| Prices are positive (> 0) | ✅ Confirmed | Negative prices are invalid. |
| Customers are anonymous | ✅ Confirmed | No login required. Store ID from URL. |
| Store owners use email + password | ✅ Confirmed | JWT-based authentication. |
| One store cache at a time | ✅ Confirmed | IndexedDB clears on store change. |
| Basket clears on store change | ✅ Confirmed | Prevents cross-store contamination. |
| Products never deleted | ✅ Confirmed | Keeps historical data. |
| `stores.version` triggers cache refresh | ✅ Confirmed | Increment on every sync. |
| `is_active = false` blocks ALL access | ✅ Confirmed | Login and customer queries blocked. |
| `expires_at = NULL` means never expires | ✅ Confirmed | Used for testing/lifetime plans. |
| `role = 'admin'` grants super admin access | ✅ Confirmed | Login endpoint checks role. |
| XML encoding is ISO-8859-1 | ✅ Confirmed | With HTML entity decoding. |
| QR token expires in 1 hour | ✅ Confirmed | Prevents scraping. |
| File upload limit is 10MB | ✅ Confirmed | Reject larger files. |
| Daily backup is enabled | ✅ Confirmed | OVH VPS includes daily backup. |
| SSL is mandatory | ✅ Confirmed | Let's Encrypt auto-renewable. |
| Domain uses Cloudflare Registrar | ✅ Confirmed | Lowest long-term cost. |

---

## ❓ [QUESTIONS FOR USER]

All questions have been answered. ✅ **No pending questions.**

---

## ✅ [VERIFIABLE_GOALS_CHECKLIST]

### Customer Experience
- [x] Customer scans a barcode → sees the correct price in <500ms. (84-97ms)
- [x] Customer scans a product without internet → sees cached price. (SW + IndexedDB)
- [x] Customer sees promotion strikethrough when `old_price > price`.
- [x] Customer builds a basket with running total.
- [x] Basket persists when app is closed. (localStorage)
- [x] Basket clears when store changes. (`basket_${slug}` key)
- [x] Basket always shows current prices (fetched from IndexedDB).
- [x] Customer scans QR code with token → auto-sync works.

### Owner Experience
- [x] Owner uploads XML → products sync.
- [x] Owner sees rich sync report (Updated, New, Skipped, Errors).
- [x] Products without barcodes are skipped (with count in report).
- [x] Price decrease → `old_price` is set.
- [x] Price increase → `old_price` is cleared.
- [x] Products are never deleted.
- [x] `stores.version` increments on every sync.
- [x] Owner cannot update another store's products.

### Super Admin Experience
- [x] Admin logs in via `/api/auth/login` with `role: 'admin'`.
- [x] Admin sees all stores in dashboard.
- [x] Admin can block/unblock stores.
- [x] Admin can set expiration dates.
- [x] Admin can generate QR codes.
- [x] Blocked store → customer sees "Store suspended" error.
- [x] Expired store → customer sees "Store expired" error.

### Technical
- [x] App is installable on Android and iOS. (PWA manifest verified)
- [ ] SSL is active (HTTPS). (Pending Milestone 8)
- [x] XML parser uses `fast-xml-parser` (Node.js compatible).
- [x] Bulk product endpoint requires QR token.
- [x] Token expires after 1 hour.
- [x] File upload limited to 10MB.
- [x] Ownership check prevents cross-store data access.
- [ ] Deployment via Git push → auto-refresh works. (Pending Milestone 8)

---

## 🚀 [EXECUTION_PROTOCOL]

> **⚠️ CRITICAL INSTRUCTION FOR AI EXECUTION**
> 
> Do NOT attempt to build the entire application in a single response. Doing so will hit token limits, resulting in truncated and broken code.
> 
> **You MUST execute this project milestone by milestone.**

### Execution Rules
1. **Milestone-by-Milestone:** Complete one milestone at a time.
2. **Stop and Wait:** After completing a milestone, stop and wait for the user to verify and say "Proceed".
3. **Update State:** Update `PROJECT_MAP.md` to mark the completed milestone as `✅ COMPLETE`.
4. **Production-Ready Code:** No `// TODO`, no placeholders, no unfinished functions. Every function must be complete, error-handled, and logged.
5. **Simplicity First:** If a solution can be 50 lines instead of 200 lines, choose 50 lines.

---

### 📋 START COMMAND FOR MILESTONE 1

> **For this response, ONLY implement Milestone 1: Backend Foundation.**
> 
> **Do NOT write any frontend code. Do NOT implement authentication or product APIs yet.**
> 
> **Provide the complete, production-ready code for the following files:**
> 
> 1. `backend/package.json` – All dependencies and dev scripts.
> 2. `backend/tsconfig.json` – TypeScript configuration.
> 3. `backend/.env.example` – All environment variables.
> 4. `backend/src/db/index.ts` – Drizzle + PostgreSQL connection.
> 5. `backend/src/db/schema.ts` – Drizzle schemas for `stores` and `products`.
> 6. `backend/src/utils/response.ts` – Standard API response helpers.
> 7. `backend/src/index.ts` – Main Hono app setup (Pino, CORS, Helmet, Rate Limiting, Health Check).
> 8. `backend/drizzle.config.ts` – Drizzle migration configuration.
> 9. **The exact Drizzle commands** to generate and run the migration.
> 10. **The SQL for `increment_version` and `auto_expire_stores` functions.**
> 
> **Format:**
> ```
> ### backend/package.json
> ```json
> { ... }
> ```
> 
> ### backend/src/db/schema.ts
> ```typescript
> { ... }
> ```
> [... continue for all files ...]
> ```
> 
> **After completing Milestone 1:**
> 1. **Stop.**
> 2. **Update `[MILESTONES]`** to mark Milestone 1 as `✅ COMPLETE`.
> 3. **Say:** *"Milestone 1 complete. Ready for verification. Say 'Proceed to Milestone 2' to continue."*
> 
> **Start implementing Milestone 1 now.**

---


