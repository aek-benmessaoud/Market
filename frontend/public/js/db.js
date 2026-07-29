const DB_NAME = 'pricecheck';
const DB_VERSION = 1;
const PRODUCTS_STORE = 'products';
const META_STORE = 'meta';

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: 'barcode' });
        store.createIndex('by_store', 'storeId', { unique: false });
        store.createIndex('by_name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getLocalVersion(storeSlug) {
  return getMeta(`version_${storeSlug}`);
}

async function setLocalVersion(storeSlug, version) {
  return setMeta(`version_${storeSlug}`, version);
}

async function setProducts(storeId, products) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);

    const storeIndex = store.index('by_store');
    const range = IDBKeyRange.only(storeId);
    const cursor = storeIndex.openCursor(range);

    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };

    tx.oncomplete = () => {
      const tx2 = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store2 = tx2.objectStore(PRODUCTS_STORE);

      for (const p of products) {
        store2.put({
          storeId,
          barcode: p.barcode,
          internalRef: p.internalRef || null,
          name: p.name || null,
          price: parseFloat(p.price) || 0,
          oldPrice: p.oldPrice ? parseFloat(p.oldPrice) : null,
          unit: p.unit || null,
        });
      }

      tx2.oncomplete = () => resolve();
      tx2.onerror = () => reject(tx2.error);
    };

    tx.onerror = () => reject(tx.error);
  });
}

async function getProduct(barcode) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.get(barcode);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function searchProducts(query) {
  const db = await openDB();
  const q = query.toLowerCase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const results = [];

    const cursor = store.openCursor();
    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (c) {
        const p = c.value;
        const match =
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.internalRef && p.internalRef.toLowerCase().includes(q));
        if (match) results.push(p);
        c.continue();
      } else {
        resolve(results);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

async function getAllProducts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function clearProducts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getProductCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.IDB = {
  openDB,
  getMeta,
  setMeta,
  getLocalVersion,
  setLocalVersion,
  setProducts,
  getProduct,
  searchProducts,
  getAllProducts,
  clearProducts,
  getProductCount,
};
