const API_BASE = (() => {
  if (typeof window !== 'undefined') {
    const loc = window.location;
    if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
      return `http://${loc.hostname}:3000`;
    }
  }
  return '';
})();

async function apiRequest(method, path, options = {}) {
  const { body, retries = 2, timeout = 8000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = {
        method,
        signal: controller.signal,
        headers: {},
      };

      if (body) {
        if (body instanceof FormData) {
          fetchOptions.body = body;
        } else {
          fetchOptions.headers['Content-Type'] = 'application/json';
          fetchOptions.body = JSON.stringify(body);
        }
      }

      const response = await fetch(`${API_BASE}${path}`, fetchOptions);
      clearTimeout(timer);

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw {
          status: response.status,
          code: data.code || 'UNKNOWN',
          message: data.error || 'Request failed',
        };
      }

      return data.data;
    } catch (err) {
      lastError = err;

      if (err.name === 'AbortError') {
        lastError = { status: 0, code: 'TIMEOUT', message: 'Request timed out' };
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 4000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

const API = {
  getStore(slug) {
    return apiRequest('GET', `/api/v1/stores/${slug}`);
  },

  getProducts(slug, token) {
    return apiRequest('GET', `/api/v1/products/${slug}?token=${encodeURIComponent(token)}`);
  },

  getProduct(slug, barcode) {
    return apiRequest('GET', `/api/v1/products/${slug}/${barcode}`);
  },

  login(email, password) {
    return apiRequest('POST', '/api/v1/auth/login', {
      body: { email, password },
    });
  },

  signup(storeName, email, password, phone) {
    return apiRequest('POST', '/api/v1/auth/signup', {
      body: { storeName, email, password, phone },
    });
  },

  uploadSync(token, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('POST', '/api/v1/sync/upload', {
      body: formData,
      timeout: 30000,
      retries: 0,
    });
  },

  clearSync(token) {
    return apiRequest('POST', '/api/v1/sync/clear');
  },

  getStats(token) {
    return apiRequest('GET', '/api/v1/dashboard/stats');
  },
};

window.API = API;
