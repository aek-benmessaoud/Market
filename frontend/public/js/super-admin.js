(function() {
  'use strict';

  var API_BASE = (location.hostname === 'localhost')
    ? location.protocol + '//' + location.hostname + ':3000'
    : location.origin;
  var API = API_BASE + '/api/v1';
  var TOKEN_KEY = 'super_admin_token';

  var state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    stores: []
  };

  // ── Elements ──
  var $authWrap  = document.getElementById('authWrap');
  var $dash      = document.getElementById('dash');
  var $authError = document.getElementById('authError');
  var $loginForm = document.getElementById('loginForm');
  var $loginBtn  = document.getElementById('loginBtn');
  var $logoutBtn = document.getElementById('logoutBtn');
  var $storeList = document.getElementById('storeList');
  var $qrModal   = document.getElementById('qrModal');
  var $toast     = document.getElementById('toast');

  // ── Auth ──
  $loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    $authError.classList.remove('show');
    $loginBtn.disabled = true;
    $loginBtn.textContent = 'Logging in...';

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;

    fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data && data.data.token) {
        var store = data.data.store;
        if (!store || store.role !== 'admin') {
          showAuthError('This account does not have admin access');
          return;
        }
        state.token = data.data.token;
        localStorage.setItem(TOKEN_KEY, state.token);
        showDash();
      } else {
        showAuthError(data.error || 'Invalid credentials');
      }
    })
    .catch(function() { showAuthError('Network error'); })
    .finally(function() {
      $loginBtn.disabled = false;
      $loginBtn.textContent = 'Log in';
    });
  });

  function showAuthError(msg) {
    $authError.textContent = msg;
    $authError.classList.add('show');
  }

  $logoutBtn.addEventListener('click', function() {
    state.token = null;
    state.stores = [];
    localStorage.removeItem(TOKEN_KEY);
    $dash.classList.remove('active');
    $authWrap.style.display = '';
  });

  // ── Dashboard ──
  function showDash() {
    $authWrap.style.display = 'none';
    $dash.classList.add('active');
    loadStores();
  }

  function loadStores() {
    if (!state.token) return;

    apiFetch('/admin/stores')
      .then(function(data) {
        if (!data.success) throw new Error(data.error);
        state.stores = data.data || [];
        renderStats();
        renderStores();
      })
      .catch(function(err) { toast('Failed to load stores: ' + err.message); });
  }

  function renderStats() {
    var total = state.stores.length;
    var active = state.stores.filter(function(s) { return s.isActive; }).length;
    var blocked = total - active;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statBlocked').textContent = blocked;
    document.getElementById('storeCount').textContent = total + ' store' + (total !== 1 ? 's' : '');
  }

  function renderStores() {
    $storeList.innerHTML = '';

    if (state.stores.length === 0) {
      $storeList.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px 0;font-size:0.875rem;">No stores yet</div>';
      return;
    }

    state.stores.forEach(function(store) {
      var card = document.createElement('div');
      card.className = 'store-card' + (store.isActive ? '' : ' blocked');
      card.setAttribute('data-id', store.id);

      var statusBadge = store.isActive
        ? '<span class="badge green">Active</span>'
        : '<span class="badge red">Blocked</span>';

      var roleBadge = store.role === 'admin'
        ? '<span class="badge dim">Admin</span>'
        : '<span class="badge dim">Owner</span>';

      var expiryText = 'Never';
      var expiryBadge = '';
      if (store.expiresAt) {
        var expDate = new Date(store.expiresAt);
        var now = new Date();
        if (expDate < now) {
          expiryText = 'Expired ' + formatDate(expDate);
          expiryBadge = '<span class="badge red">Expired</span>';
        } else {
          expiryText = formatDate(expDate);
          var daysLeft = Math.ceil((expDate - now) / 86400000);
          if (daysLeft <= 30) {
            expiryBadge = '<span class="badge orange">' + daysLeft + 'd left</span>';
          }
        }
      }

      card.innerHTML =
        '<div class="store-header">' +
          '<div>' +
            '<div class="store-name">' + esc(store.name) + '</div>' +
            '<div class="store-slug">@' + esc(store.slug) + '</div>' +
          '</div>' +
          '<div>' + statusBadge + roleBadge + '</div>' +
        '</div>' +
        '<div class="store-email">' + esc(store.ownerEmail) + '</div>' +
        '<div class="store-meta">' +
          '<span class="badge dim">' + store.productCount + ' products</span>' +
          '<span class="badge dim">v' + store.version + '</span>' +
          '<span class="badge dim">Expiry: ' + expiryText + '</span>' +
          expiryBadge +
        '</div>' +
        '<div class="store-actions">' +
          (store.role !== 'admin'
            ? '<button class="action-btn ' + (store.isActive ? 'block' : 'unblock') + '" data-action="toggle">' +
                (store.isActive ? 'Block' : 'Unblock') + '</button>'
            : '') +
          (store.role !== 'admin'
            ? '<button class="action-btn expiry" data-action="expiry">Set Expiry</button>'
            : '') +
          '<button class="action-btn qr" data-action="qr">QR Code</button>' +
        '</div>' +
        '<div class="date-input-wrap" data-expiry-form="' + store.id + '">' +
          '<input type="date" data-expiry-date="' + store.id + '">' +
          '<button class="set-btn" data-set-expiry="' + store.id + '">Set</button>' +
          '<button class="clear-btn" data-clear-expiry="' + store.id + '">Clear</button>' +
        '</div>';

      $storeList.appendChild(card);
    });
  }

  // ── Event delegation for store actions ──
  $storeList.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;

    var card = btn.closest('.store-card');
    var id = parseInt(card.getAttribute('data-id'));
    var action = btn.getAttribute('data-action');

    if (action === 'toggle') toggleActive(id);
    if (action === 'expiry') toggleExpiryForm(id);
    if (action === 'qr') generateQR(id);
  });

  $storeList.addEventListener('click', function(e) {
    var setBtn = e.target.closest('[data-set-expiry]');
    if (setBtn) {
      var id = parseInt(setBtn.getAttribute('data-set-expiry'));
      var dateInput = document.querySelector('[data-expiry-date="' + id + '"]');
      if (dateInput && dateInput.value) {
        setExpiry(id, dateInput.value);
      } else {
        toast('Pick a date first');
      }
      return;
    }

    var clearBtn = e.target.closest('[data-clear-expiry]');
    if (clearBtn) {
      var id = parseInt(clearBtn.getAttribute('data-clear-expiry'));
      setExpiry(id, null);
    }
  });

  function toggleActive(id) {
    apiFetch('/admin/stores/' + id + '/toggle-active', { method: 'PUT' })
      .then(function(data) {
        if (!data.success) throw new Error(data.error);
        toast(data.data.message);
        loadStores();
      })
      .catch(function(err) { toast('Error: ' + err.message); });
  }

  function toggleExpiryForm(id) {
    var form = document.querySelector('[data-expiry-form="' + id + '"]');
    if (form) form.classList.toggle('show');
  }

  function setExpiry(id, dateValue) {
    apiFetch('/admin/stores/' + id + '/expiry', {
      method: 'PUT',
      body: JSON.stringify({ expiresAt: dateValue })
    })
    .then(function(data) {
      if (!data.success) throw new Error(data.error);
      toast(data.data.message);
      loadStores();
    })
    .catch(function(err) { toast('Error: ' + err.message); });
  }

  function generateQR(id) {
    var store = state.stores.find(function(s) { return s.id === id; });
    if (!store) return;

    apiFetch('/admin/stores/' + id + '/qr-token')
      .then(function(data) {
        if (!data.success) throw new Error(data.error);
        showQRModal(store.name, data.data.customerUrl, data.data.token);
      })
      .catch(function(err) { toast('Error: ' + err.message); });
  }

  // ── QR Modal ──
  function showQRModal(storeName, url, token) {
    var fullUrl = location.origin + '/#/' + url.split('#/')[1];
    document.getElementById('qrTitle').textContent = storeName + ' – QR Code';
    document.getElementById('qrUrl').textContent = fullUrl;

    var canvas = document.getElementById('qrCanvas');
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, fullUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' }
      }, function(err) {
        if (err) console.error('QR error:', err);
      });
    } else {
      var ctx = canvas.getContext('2d');
      canvas.width = 200;
      canvas.height = 200;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#000';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QR Library not loaded', 100, 100);
    }

    $qrModal.classList.add('show');
    $qrModal.setAttribute('data-url', fullUrl);
  }

  document.getElementById('qrClose').addEventListener('click', function() {
    $qrModal.classList.remove('show');
  });

  document.getElementById('qrDownload').addEventListener('click', function() {
    var canvas = document.getElementById('qrCanvas');
    var link = document.createElement('a');
    link.download = 'qr-code.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('QR code downloaded');
  });

  $qrModal.addEventListener('click', function(e) {
    if (e.target === $qrModal) $qrModal.classList.remove('show');
  });

  // ── API Helper ──
  function apiFetch(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

    return fetch(API + path, Object.assign({}, opts, { headers: headers }))
      .then(function(res) { return res.json(); });
  }

  // ── Helpers ──
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function formatDate(d) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    setTimeout(function() { $toast.classList.remove('show'); }, 2500);
  }

  // ── Init ──
  if (state.token) {
    apiFetch('/admin/stores')
      .then(function(data) {
        if (data.success) showDash();
        else throw new Error('unauthorized');
      })
      .catch(function() {
        state.token = null;
        localStorage.removeItem(TOKEN_KEY);
      });
  }
})();
