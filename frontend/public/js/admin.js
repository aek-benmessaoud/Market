(function() {
  'use strict';

  var API_BASE = (location.hostname === 'localhost')
    ? location.protocol + '//' + location.hostname + ':3000'
    : location.origin;
  var API = API_BASE + '/api/v1';
  var TOKEN_KEY = 'admin_token';
  var STORE_KEY = 'admin_store';

  var state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    store: null,
    file: null
  };

  // ── Elements ──────────────────────────────────────────
  var $authScreen   = document.getElementById('authScreen');
  var $dashboard    = document.getElementById('dashboard');
  var $authError    = document.getElementById('authError');
  var $loginForm    = document.getElementById('loginForm');
  var $signupForm   = document.getElementById('signupForm');
  var $loginBtn     = document.getElementById('loginBtn');
  var $signupBtn    = document.getElementById('signupBtn');
  var $logoutBtn    = document.getElementById('logoutBtn');
  var $dropZone     = document.getElementById('dropZone');
  var $fileInput    = document.getElementById('fileInput');
  var $fileSelected = document.getElementById('fileSelected');
  var $fileName     = document.getElementById('fileName');
  var $fileSize     = document.getElementById('fileSize');
  var $fileRemove   = document.getElementById('fileRemove');
  var $syncBtn      = document.getElementById('syncBtn');
  var $syncReport   = document.getElementById('syncReport');
  var $toast        = document.getElementById('toast');

  // ── Auth Tabs ─────────────────────────────────────────
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.auth-form').forEach(function(f) { f.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-tab');
      document.getElementById(target + 'Form').classList.add('active');
      $authError.classList.remove('show');
    });
  });

  // ── Login ─────────────────────────────────────────────
  $loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    $authError.classList.remove('show');
    $loginBtn.disabled = true;
    $loginBtn.textContent = 'Logging in...';

    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;

    fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data && data.data.token) {
        state.token = data.data.token;
        state.store = data.data.store || null;
        localStorage.setItem(TOKEN_KEY, state.token);
        if (state.store) localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
        showDashboard();
      } else {
        showAuthError(data.error || 'Invalid email or password');
      }
    })
    .catch(function() { showAuthError('Network error. Please try again.'); })
    .finally(function() {
      $loginBtn.disabled = false;
      $loginBtn.textContent = 'Log in';
    });
  });

  // ── Signup ────────────────────────────────────────────
  $signupForm.addEventListener('submit', function(e) {
    e.preventDefault();
    $authError.classList.remove('show');
    $signupBtn.disabled = true;
    $signupBtn.textContent = 'Creating store...';

    var storeName = document.getElementById('signupStore').value.trim();
    var email = document.getElementById('signupEmail').value.trim();
    var password = document.getElementById('signupPassword').value;
    var phone = document.getElementById('signupPhone').value.trim();

    fetch(API + '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName: storeName, email: email, password: password, phone: phone || undefined })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data && data.data.token) {
        state.token = data.data.token;
        state.store = data.data.store || null;
        localStorage.setItem(TOKEN_KEY, state.token);
        if (state.store) localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
        showDashboard();
      } else {
        showAuthError(data.error || 'Could not create store. Please try again.');
      }
    })
    .catch(function() { showAuthError('Network error. Please try again.'); })
    .finally(function() {
      $signupBtn.disabled = false;
      $signupBtn.textContent = 'Create store';
    });
  });

  function showAuthError(msg) {
    $authError.textContent = msg;
    $authError.classList.add('show');
  }

  // ── Logout ────────────────────────────────────────────
  $logoutBtn.addEventListener('click', function() {
    state.token = null;
    state.store = null;
    state.file = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORE_KEY);
    $dashboard.classList.remove('active');
    $authScreen.style.display = '';
    $loginForm.reset();
    $signupForm.reset();
    $authError.classList.remove('show');
    clearFileUI();
    $syncReport.classList.remove('show');
  });

  // ── Dashboard Init ────────────────────────────────────
  function showDashboard() {
    $authScreen.style.display = 'none';
    $dashboard.classList.add('active');

    var stored = state.store || safeParse(localStorage.getItem(STORE_KEY));
    if (stored) {
      state.store = stored;
      document.getElementById('dashStoreName').textContent = stored.name || 'My Store';
      document.getElementById('dashStoreSlug').textContent = '@' + (stored.slug || '');
    }

    loadStats();
  }

  function loadStats() {
    if (!state.token) return;

    fetch(API + '/dashboard/stats', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data) {
        var d = data.data;
        document.getElementById('statProducts').textContent = d.totalProducts != null ? d.totalProducts : '-';
        document.getElementById('statVersion').textContent = d.version != null ? 'v' + d.version : '-';

        if (d.lastSync) {
          var dt = new Date(d.lastSync);
          var now = new Date();
          var diffMin = Math.round((now - dt) / 60000);
          if (diffMin < 1) {
            document.getElementById('statSync').textContent = 'Just now';
          } else if (diffMin < 60) {
            document.getElementById('statSync').textContent = diffMin + 'm ago';
          } else if (diffMin < 1440) {
            document.getElementById('statSync').textContent = Math.round(diffMin / 60) + 'h ago';
          } else {
            document.getElementById('statSync').textContent = Math.round(diffMin / 1440) + 'd ago';
          }
        } else {
          document.getElementById('statSync').textContent = 'Never';
        }

        if (stored = data.data.store) {
          state.store = stored;
          localStorage.setItem(STORE_KEY, JSON.stringify(stored));
          document.getElementById('dashStoreName').textContent = stored.name || 'My Store';
          document.getElementById('dashStoreSlug').textContent = '@' + (stored.slug || '');
        }
      }
    })
    .catch(function() {});
  }

  // ── File Selection ────────────────────────────────────
  $dropZone.addEventListener('click', function() { $fileInput.click(); });

  $dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    $dropZone.classList.add('dragover');
  });

  $dropZone.addEventListener('dragleave', function() {
    $dropZone.classList.remove('dragover');
  });

  $dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    $dropZone.classList.remove('dragover');
    var files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
  });

  $fileInput.addEventListener('change', function() {
    if ($fileInput.files.length) handleFile($fileInput.files[0]);
  });

  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      showToast('Please select an XML file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large (max 10MB)');
      return;
    }

    state.file = file;
    $fileName.textContent = file.name;
    $fileSize.textContent = formatBytes(file.size);
    $fileSelected.classList.add('show');
    $dropZone.style.display = 'none';
    $syncBtn.disabled = false;
    $syncReport.classList.remove('show');
  }

  $fileRemove.addEventListener('click', function() {
    clearFileUI();
    $fileInput.value = '';
  });

  function clearFileUI() {
    state.file = null;
    $fileSelected.classList.remove('show');
    $dropZone.style.display = '';
    $syncBtn.disabled = true;
  }

  // ── Sync ──────────────────────────────────────────────
  $syncBtn.addEventListener('click', function() {
    if (!state.file || !state.token) return;

    $syncBtn.disabled = true;
    $syncBtn.textContent = 'Syncing...';
    $syncReport.classList.remove('show');

    var formData = new FormData();
    formData.append('file', state.file);

    fetch(API + '/sync/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + state.token },
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success && data.data) {
        showReport(data.data);
        loadStats();
        showToast('Sync complete!');
      } else {
        showToast(data.error || 'Sync failed');
      }
    })
    .catch(function() { showToast('Network error during sync'); })
    .finally(function() {
      $syncBtn.disabled = false;
      $syncBtn.textContent = 'Sync Products';
    });
  });

  // ── Report ────────────────────────────────────────────
  function showReport(result) {
    var $icon = document.getElementById('reportIcon');
    var $title = document.getElementById('reportTitle');
    var hasErrors = result.errors && result.errors.length > 0;

    if (hasErrors) {
      $icon.className = 'report-icon error';
      $icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      $title.textContent = 'Sync Completed with Errors';
    } else {
      $icon.className = 'report-icon success';
      $icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      $title.textContent = 'Sync Complete';
    }

    document.getElementById('reportImported').textContent = result.imported || 0;
    document.getElementById('reportUpdated').textContent = result.updated || 0;
    document.getElementById('reportNew').textContent = result['new'] || 0;
    document.getElementById('reportSkipped').textContent = result.skipped || 0;

    var $errors = document.getElementById('reportErrors');
    var $errorList = document.getElementById('reportErrorList');
    if (hasErrors) {
      $errors.style.display = '';
      $errorList.textContent = result.errors.join('\n');
    } else {
      $errors.style.display = 'none';
    }

    $syncReport.classList.add('show');
  }

  // ── Helpers ───────────────────────────────────────────
  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function safeParse(str) {
    try { return JSON.parse(str); } catch(e) { return null; }
  }

  function showToast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    setTimeout(function() { $toast.classList.remove('show'); }, 2500);
  }

  // ── Init: check existing token ────────────────────────
  if (state.token) {
    fetch(API + '/dashboard/stats', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    })
    .then(function(res) {
      if (res.ok) return res.json();
      throw new Error('unauthorized');
    })
    .then(function(data) {
      if (data.success) showDashboard();
      else throw new Error('bad');
    })
    .catch(function() {
      state.token = null;
      localStorage.removeItem(TOKEN_KEY);
    });
  }

})();
