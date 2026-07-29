(() => {
  'use strict';

  const App = {
    slug: null,
    token: null,
    storeInfo: null,
    scannerRunning: false,
    html5QrCode: null,
    lastScannedProduct: null,

    init() {
      this.parseRoute();
      this.cacheDOM();
      this.bindEvents();
      this.registerSW();
      this.checkInstallPrompt();
      this.checkIOS();
      this.setupConnectionStatus();
      this.bootstrap();
    },

    parseRoute() {
      const hash = window.location.hash.slice(1) || '/';
      const match = hash.match(/^\/s\/([^/?]+)(?:\?.*)?$/);
      if (match) {
        this.slug = match[1];
        const params = new URLSearchParams(hash.split('?')[1] || '');
        this.token = params.get('token');
      }
    },

    cacheDOM() {
      this.els = {
        topbar: document.getElementById('topbar'),
        storeName: document.getElementById('storeName'),
        syncStatus: document.getElementById('syncStatus'),
        syncText: document.getElementById('syncText'),
        bottomNav: document.getElementById('bottomNav'),
        loadingBar: document.getElementById('loadingBar'),
        toast: document.getElementById('toast'),
        errorScreen: document.getElementById('errorScreen'),
        errorTitle: document.getElementById('errorTitle'),
        errorMessage: document.getElementById('errorMessage'),
        retryBtn: document.getElementById('retryBtn'),
        installBanner: document.getElementById('installBanner'),
        installBtn: document.getElementById('installBtn'),
        installClose: document.getElementById('installClose'),
        iosTooltip: document.getElementById('iosTooltip'),
        iosTooltipClose: document.getElementById('iosTooltipClose'),
        scanToggle: document.getElementById('scanToggle'),
        manualBarcode: document.getElementById('manualBarcode'),
        manualLookup: document.getElementById('manualLookup'),
        resultCard: document.getElementById('resultCard'),
        resultRef: document.getElementById('resultRef'),
        resultName: document.getElementById('resultName'),
        resultPrice: document.getElementById('resultPrice'),
        resultOldPrice: document.getElementById('resultOldPrice'),
        resultPromo: document.getElementById('resultPromo'),
        resultUnit: document.getElementById('resultUnit'),
        addToCartBtn: document.getElementById('addToCartBtn'),
        notFound: document.getElementById('notFound'),
        searchInput: document.getElementById('searchInput'),
        searchClear: document.getElementById('searchClear'),
        searchCount: document.getElementById('searchCount'),
        searchResults: document.getElementById('searchResults'),
        basketContent: document.getElementById('basketContent'),
        basketFooter: document.getElementById('basketFooter'),
        basketTotal: document.getElementById('basketTotal'),
        basketClearBtn: document.getElementById('basketClearBtn'),
        basketBadge: document.getElementById('basketBadge'),
        scannerContainer: document.getElementById('scannerContainer'),
      };
    },

    bindEvents() {
      document.querySelectorAll('[data-nav]').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigate(el.dataset.nav);
        });
      });

      this.els.scanToggle.addEventListener('click', () => this.toggleScanner());
      this.els.manualLookup.addEventListener('click', () => this.manualSearch());
      this.els.manualBarcode.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.manualSearch();
      });

      this.els.addToCartBtn.addEventListener('click', () => this.addToCart());

      this.els.searchInput.addEventListener('input', () => this.onSearch());
      this.els.searchClear.addEventListener('click', () => {
        this.els.searchInput.value = '';
        this.els.searchClear.style.display = 'none';
        this.els.searchCount.textContent = '';
        this.els.searchResults.innerHTML = '';
        this.els.searchInput.focus();
      });

      this.els.basketClearBtn.addEventListener('click', () => this.clearBasket());

      this.els.retryBtn.addEventListener('click', () => this.bootstrap());
      this.els.installBtn?.addEventListener('click', () => this.installApp());
      this.els.installClose?.addEventListener('click', () => this.dismissInstall());
      this.els.iosTooltipClose?.addEventListener('click', () => this.dismissIOSTooltip());

      window.addEventListener('hashchange', () => {
        this.parseRoute();
        if (this.slug) this.bootstrap();
      });
    },

    navigate(view) {
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      document.querySelectorAll('[data-nav]').forEach((n) => n.classList.remove('active'));

      const viewEl = document.getElementById(`view-${view}`);
      const navEl = document.querySelector(`[data-nav="${view}"]`);

      if (viewEl) viewEl.classList.add('active');
      if (navEl) navEl.classList.add('active');

      if (view === 'basket') this.renderBasket();
      if (view === 'search') this.els.searchInput.focus();
      if (view === 'scan' && this.scannerRunning) this.startScanner();
      if (view !== 'scan' && this.scannerRunning) this.stopScanner();

      this.els.basketFooter.classList.toggle('show', view === 'basket' && this.getBasket().length > 0);
      this.updateBadge();
    },

    showView(view) {
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      document.querySelectorAll('[data-nav]').forEach((n) => n.classList.remove('active'));

      const viewEl = document.getElementById(`view-${view}`);
      const navEl = document.querySelector(`[data-nav="${view}"]`);

      if (viewEl) viewEl.classList.add('active');
      if (navEl) navEl.classList.add('active');
    },

    registerSW() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    },

    showLoading(show) {
      this.els.loadingBar.classList.toggle('active', show);
      if (show) {
        this.els.loadingBar.style.width = '60%';
        setTimeout(() => {
          if (this.els.loadingBar.classList.contains('active')) {
            this.els.loadingBar.style.width = '85%';
          }
        }, 600);
      } else {
        this.els.loadingBar.style.width = '100%';
        setTimeout(() => {
          this.els.loadingBar.classList.remove('active');
          this.els.loadingBar.style.width = '0%';
        }, 200);
      }
    },

    showToast(message, duration = 2500) {
      this.els.toast.textContent = message;
      this.els.toast.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.els.toast.classList.remove('show'), duration);
    },

    showError(title, message) {
      this.els.errorTitle.textContent = title;
      this.els.errorMessage.textContent = message;
      this.els.errorScreen.classList.add('show');
    },

    hideError() {
      this.els.errorScreen.classList.remove('show');
    },

    async bootstrap() {
      if (!this.slug) {
        this.showError(
          'No store specified',
          'Scan a QR code at your local store to get started.'
        );
        return;
      }

      this.hideError();
      this.showView('scan');
      this.els.topbar.style.display = '';
      this.els.bottomNav.style.display = '';
      this.els.storeName.textContent = this.slug;

      try {
        this.showLoading(true);
        this.storeInfo = await API.getStore(this.slug);
        this.els.storeName.textContent = this.storeInfo.name || this.slug;

        await this.syncCache();
        this.navigate('scan');
        this.updateSyncStatus('synced');
      } catch (err) {
        this.showLoading(false);

        if (err.code === 'NOT_FOUND') {
          this.showError('Store not found', `No store found for "${this.slug}". Check the QR code and try again.`);
        } else if (err.code === 'ACCOUNT_SUSPENDED') {
          this.showError('Store suspended', 'This store is currently unavailable. Contact the store owner.');
        } else if (err.code === 'ACCOUNT_EXPIRED') {
          this.showError('Store expired', 'This store subscription has expired. Contact the store owner.');
        } else {
          this.showError('Connection error', 'Could not reach the server. The app will use cached data if available.');

          const count = await IDB.getProductCount();
          if (count > 0) {
            this.els.storeName.textContent = this.slug;
            this.navigate('scan');
          }
        }
      }
    },

    async syncCache() {
      if (!this.storeInfo || !this.token) return;

      const localVersion = await IDB.getLocalVersion(this.slug);

      if (String(localVersion) === String(this.storeInfo.version)) {
        return;
      }

      this.updateSyncStatus('syncing');

      try {
        const products = await API.getProducts(this.slug, this.token);
        await IDB.setProducts(this.storeInfo.id, products);
        await IDB.setLocalVersion(this.slug, this.storeInfo.version);
        this.updateSyncStatus('synced');
        this.showToast(`${products.length} products synced`);
      } catch (err) {
        this.updateSyncStatus('error');
        const count = await IDB.getProductCount();
        if (count === 0) {
          throw err;
        }
      }
    },

    updateSyncStatus(status) {
      const dot = this.els.syncStatus.querySelector('.sync-dot');
      dot.className = 'sync-dot';
      if (status === 'synced') {
        this.els.syncText.textContent = 'Synced';
      } else if (status === 'syncing') {
        this.els.syncText.textContent = 'Syncing...';
      } else if (status === 'error') {
        dot.classList.add('error');
        this.els.syncText.textContent = 'Offline';
      } else if (status === 'stale') {
        dot.classList.add('stale');
        this.els.syncText.textContent = 'Stale';
      }
    },

    toggleScanner() {
      if (this.scannerRunning) {
        this.stopScanner();
      } else {
        this.startScanner();
      }
    },

    async startScanner() {
      if (!window.Html5Qrcode) {
        this.showToast('Scanner library not loaded. Use manual entry.');
        return;
      }

      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode('scanner');
      }

      try {
        this.els.scannerContainer.style.display = '';
        this.els.scanToggle.textContent = 'Starting...';

        await this.html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.333 },
          (decodedText) => this.onScanResult(decodedText),
          () => {}
        );
        this.scannerRunning = true;
        this.els.scanToggle.textContent = 'Stop Scanner';
      } catch (err) {
        this.scannerRunning = false;
        this.els.scannerContainer.style.display = 'none';
        this.els.scanToggle.textContent = 'Start Scanner';

        if (err.toString().includes('NotAllowedError') || err.toString().includes('Permission')) {
          this.showToast('Camera permission denied. Use manual entry.');
        } else if (err.toString().includes('NotFound')) {
          this.showToast('No camera found. Use manual entry.');
        } else {
          this.showToast('Scanner error. Use manual entry.');
        }
      }
    },

    async stopScanner() {
      if (this.html5QrCode && this.scannerRunning) {
        try {
          await this.html5QrCode.stop();
        } catch {}
      }
      this.scannerRunning = false;
      this.els.scannerContainer.style.display = 'none';
      this.els.scanToggle.textContent = 'Start Scanner';
    },

    async onScanResult(barcode) {
      if (navigator.vibrate) navigator.vibrate(100);
      this.stopScanner();
      await this.lookupProduct(barcode.trim());
    },

    manualSearch() {
      const val = this.els.manualBarcode.value.trim();
      if (!val) return;
      this.lookupProduct(val);
    },

    async lookupProduct(barcode) {
      this.els.resultCard.classList.remove('show');
      this.els.notFound.classList.remove('show');

      try {
        let product = await IDB.getProduct(barcode);

        if (!product && navigator.onLine) {
          try {
            const apiProduct = await API.getProduct(this.slug, barcode);
            if (apiProduct) {
              product = {
                storeId: this.storeInfo?.id,
                barcode: apiProduct.barcode,
                internalRef: apiProduct.internalRef,
                name: apiProduct.name,
                price: parseFloat(apiProduct.price) || 0,
                oldPrice: apiProduct.oldPrice ? parseFloat(apiProduct.oldPrice) : null,
                unit: apiProduct.unit,
              };
            }
          } catch {}
        }

        if (!product) {
          this.els.notFound.classList.add('show');
          return;
        }

        this.lastScannedProduct = product;

        this.els.resultRef.textContent = product.internalRef || product.barcode;
        this.els.resultName.textContent = product.name || `Product ${product.barcode}`;
        this.els.resultPrice.textContent = `${this.formatPrice(product.price)} DA`;

        if (product.oldPrice && product.oldPrice > product.price) {
          this.els.resultOldPrice.textContent = `${this.formatPrice(product.oldPrice)} DA`;
          this.els.resultOldPrice.style.display = '';
          this.els.resultPromo.style.display = '';
          const pct = Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
          this.els.resultPromo.textContent = `-${pct}%`;
          const badgeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          badgeIcon.setAttribute('width', '10');
          badgeIcon.setAttribute('height', '10');
          badgeIcon.setAttribute('viewBox', '0 0 24 24');
          badgeIcon.setAttribute('fill', 'currentColor');
          badgeIcon.innerHTML = '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>';
          this.els.resultPromo.textContent = '';
          this.els.resultPromo.appendChild(badgeIcon);
          this.els.resultPromo.appendChild(document.createTextNode(` -${pct}%`));
        } else {
          this.els.resultOldPrice.style.display = 'none';
          this.els.resultPromo.style.display = 'none';
        }

        this.els.resultUnit.textContent = product.unit ? `Per ${product.unit}` : '';
        this.els.resultCard.classList.add('show');
      } catch (err) {
        this.showToast('Lookup failed. Check connection.');
      }
    },

    addToCart() {
      if (!this.lastScannedProduct) return;

      const basket = this.getBasket();
      const existing = basket.find((i) => i.barcode === this.lastScannedProduct.barcode);

      if (existing) {
        existing.quantity += 1;
      } else {
        basket.push({ barcode: this.lastScannedProduct.barcode, quantity: 1 });
      }

      this.saveBasket(basket);
      this.updateBadge();
      this.showToast('Added to basket');
    },

    getBasketKey() {
      return `basket_${this.slug || '_default'}`;
    },

    getBasket() {
      try {
        return JSON.parse(localStorage.getItem(this.getBasketKey()) || '[]');
      } catch {
        return [];
      }
    },

    saveBasket(basket) {
      localStorage.setItem(this.getBasketKey(), JSON.stringify(basket));
    },

    clearBasket() {
      localStorage.removeItem(this.getBasketKey());
      this.renderBasket();
      this.updateBadge();
      this.showToast('Basket cleared');
    },

    updateBadge() {
      const basket = this.getBasket();
      const count = basket.reduce((sum, i) => sum + i.quantity, 0);
      this.els.basketBadge.textContent = count > 0 ? String(count) : '';
    },

    async renderBasket() {
      const basket = this.getBasket();

      if (basket.length === 0) {
        this.els.basketContent.innerHTML = `
          <div class="basket-empty">
            <div class="basket-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h3>Empty basket</h3>
            <p>Scan a barcode to add products</p>
          </div>
        `;
        this.els.basketFooter.classList.remove('show');
        return;
      }

      let html = '';
      let total = 0;

      for (const item of basket) {
        const product = await IDB.getProduct(item.barcode);
        if (!product) continue;

        const subtotal = product.price * item.quantity;
        total += subtotal;

        html += `
          <div class="basket-item" data-barcode="${product.barcode}">
            <div class="basket-item-info">
              <div class="basket-item-name">${this.escapeHtml(product.name || product.barcode)}</div>
              <div class="basket-item-price">${this.formatPrice(product.price)} DA each</div>
            </div>
            <div class="basket-item-controls">
              <button class="qty-btn ${item.quantity <= 1 ? 'remove' : ''}" data-action="dec" data-barcode="${product.barcode}">
                ${item.quantity <= 1 ? '&times;' : '−'}
              </button>
              <span class="basket-item-qty">${item.quantity}</span>
              <button class="qty-btn" data-action="inc" data-barcode="${product.barcode}">+</button>
            </div>
            <div class="basket-item-subtotal">${this.formatPrice(subtotal)} DA</div>
          </div>
        `;
      }

      this.els.basketContent.innerHTML = html;
      this.els.basketTotal.textContent = `${this.formatPrice(total)} DA`;
      this.els.basketFooter.classList.add('show');

      this.els.basketContent.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const bc = btn.dataset.barcode;
          const action = btn.dataset.action;
          this.updateQty(bc, action);
        });
      });
    },

    updateQty(barcode, action) {
      const basket = this.getBasket();
      const idx = basket.findIndex((i) => i.barcode === barcode);
      if (idx === -1) return;

      if (action === 'inc') {
        basket[idx].quantity += 1;
      } else if (action === 'dec') {
        basket[idx].quantity -= 1;
        if (basket[idx].quantity <= 0) basket.splice(idx, 1);
      }

      this.saveBasket(basket);
      this.renderBasket();
      this.updateBadge();
    },

    onSearch() {
      clearTimeout(this._searchTimer);
      const val = this.els.searchInput.value.trim();
      this.els.searchClear.style.display = val.length > 0 ? 'flex' : 'none';
      this._searchTimer = setTimeout(() => this.performSearch(), 200);
    },

    async performSearch() {
      const query = this.els.searchInput.value.trim();
      if (!query) {
        this.els.searchCount.textContent = '';
        this.els.searchResults.innerHTML = '';
        return;
      }

      const results = await IDB.searchProducts(query);
      this.els.searchCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

      const maxShow = 50;
      const shown = results.slice(0, maxShow);

      this.els.searchResults.innerHTML = shown
        .map(
          (p) => `
        <div class="search-item" data-barcode="${p.barcode}">
          <div class="search-item-info">
            <div class="search-item-name">${this.escapeHtml(p.name || p.barcode)}</div>
            <div class="search-item-ref">${p.internalRef || p.barcode}</div>
          </div>
          <div>
            <span class="search-item-price">${this.formatPrice(p.price)} DA</span>
            ${p.oldPrice && p.oldPrice > p.price ? `<span class="search-item-old">${this.formatPrice(p.oldPrice)} DA</span>` : ''}
          </div>
        </div>
      `
        )
        .join('');

      this.els.searchResults.querySelectorAll('.search-item').forEach((el) => {
        el.addEventListener('click', async () => {
          const barcode = el.dataset.barcode;
          await this.lookupProduct(barcode);
          this.navigate('scan');
          this.els.searchInput.value = '';
          this.els.searchResults.innerHTML = '';
          this.els.searchCount.textContent = '';
        });
      });
    },

    formatPrice(val) {
      return Number(val).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    deferredPrompt: null,

    checkInstallPrompt() {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        const dismissed = localStorage.getItem('install_dismissed');
        if (!dismissed) {
          this.els.installBanner.classList.add('show');
        }
      });

      window.addEventListener('appinstalled', () => {
        this.els.installBanner.classList.remove('show');
        this.deferredPrompt = null;
        this.showToast('App installed!');
      });
    },

    async installApp() {
      if (!this.deferredPrompt) return;
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.els.installBanner.classList.remove('show');
      this.deferredPrompt = null;
    },

    dismissInstall() {
      this.els.installBanner.classList.remove('show');
      localStorage.setItem('install_dismissed', '1');
    },

    checkIOS() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS && !window.navigator.standalone) {
        const dismissed = localStorage.getItem('ios_tooltip_dismissed');
        if (!dismissed) {
          setTimeout(() => this.els.iosTooltip.classList.add('show'), 3000);
        }
      }
    },

    dismissIOSTooltip() {
      this.els.iosTooltip.classList.remove('show');
      localStorage.setItem('ios_tooltip_dismissed', '1');
    },

    setupConnectionStatus() {
      const banner = document.getElementById('offlineBanner');
      if (!banner) return;

      const update = () => {
        if (navigator.onLine) {
          banner.classList.remove('show');
          this.updateSyncStatus('synced');
        } else {
          banner.classList.add('show');
          this.updateSyncStatus('error');
        }
      };

      window.addEventListener('online', () => {
        update();
        this.showToast('Back online');
      });

      window.addEventListener('offline', () => {
        update();
        this.showToast('You are offline');
      });

      if (!navigator.onLine) update();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
