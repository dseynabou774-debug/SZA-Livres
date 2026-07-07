/* =========================================================
   app.js — Contrôleur principal : navigation, verrouillage,
   thème, installation PWA
   ========================================================= */

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: '🏠' },
  { id: 'books', label: 'Livres', icon: '📚' },
  { id: 'sales', label: 'Ventes', icon: '🧾' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'reports', label: 'Rapports', icon: '📊' },
  { id: 'search', label: 'Recherche', icon: '🔍' },
  { id: 'backup', label: 'Sauvegarde', icon: '💾' },
  { id: 'settings', label: 'Réglages', icon: '⚙️' }
];
const BOTTOM_NAV_IDS = ['dashboard', 'books', 'sales', 'clients'];

const Router = {
  current: { page: 'dashboard', param: '' },

  parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [pagePart, queryPart] = hash.split('?');
    const parts = pagePart.split('/');
    return { page: parts[0] || 'dashboard', param: parts[1] || '', query: queryPart || '' };
  },

  go(route) {
    location.hash = '#/' + route;
  },

  render() {
    const { page, param, query } = this.parseHash();
    this.current = { page, param };
    const main = document.getElementById('main-content');

    let html = '';
    let title = 'Gestion des Livres';
    switch (page) {
      case 'dashboard':
        html = Pages.dashboard(); title = 'Tableau de bord'; break;
      case 'books':
        html = Pages.books(); title = 'Livres'; break;
      case 'clients':
        if (param) { html = Pages.clientDetail(param); title = 'Fiche client'; }
        else { html = Pages.clients(); title = 'Clients'; }
        break;
      case 'sales':
        if (param === 'new') {
          const presetClient = (query.match(/client=([^&]+)/) || [])[1];
          html = Pages.saleNew(presetClient); title = 'Nouvelle vente';
        } else { html = Pages.sales(); title = 'Ventes'; }
        break;
      case 'receipt':
        html = Pages.receipt(param); title = 'Reçu'; break;
      case 'reports':
        html = Pages.reports(); title = 'Rapports'; break;
      case 'search':
        html = Pages.search(); title = 'Recherche'; break;
      case 'backup':
        html = Pages.backup(); title = 'Sauvegarde'; break;
      case 'settings':
        html = Pages.settings(); title = 'Réglages'; break;
      default:
        html = Pages.dashboard(); title = 'Tableau de bord';
    }

    main.innerHTML = html;
    document.getElementById('topbar-title').textContent = title;
    App.updateNavActive(page);
    App.updateFab(page);
    App.bindDynamicInputs();
    if (page === 'receipt' && param) Pages.renderReceiptQR(param);
    window.scrollTo(0, 0);
  }
};

const App = {
  deferredInstallPrompt: null,

  init() {
    DB.load();
    this.applyTheme();
    this.renderShell();
    this.checkLock();
    this.registerServiceWorker();
    this.setupInstallPrompt();

    window.addEventListener('hashchange', () => Router.render());
    if (!location.hash) location.hash = '#/dashboard';
    Router.render();

    document.getElementById('btn-lock').addEventListener('click', () => this.lockNow());
  },

  applyTheme() {
    const s = DB.data.settings;
    document.documentElement.style.setProperty('--emerald-700', s.colorEmerald || '#0b5e4a');
    document.documentElement.style.setProperty('--gold', s.colorGold || '#c9a227');
  },

  renderShell() {
    // Sidebar (desktop)
    const sideNav = document.getElementById('side-nav');
    sideNav.innerHTML = NAV_ITEMS.map(item =>
      `<a class="nav-item" data-nav="${item.id}" onclick="Router.go('${item.id}')"><span class="ic">${item.icon}</span>${item.label}</a>`
    ).join('');

    // Bottom nav (mobile) — 4 main items + "Plus"
    const bottomNav = document.getElementById('bottom-nav');
    const mainItems = NAV_ITEMS.filter(i => BOTTOM_NAV_IDS.includes(i.id));
    bottomNav.innerHTML = mainItems.map(item =>
      `<a class="b-item" data-nav="${item.id}" onclick="Router.go('${item.id}')"><span class="ic">${item.icon}</span>${item.label}</a>`
    ).join('') + `<a class="b-item" data-nav="more" onclick="App.openMoreMenu()"><span class="ic">⋯</span>Plus</a>`;
  },

  openMoreMenu() {
    const extra = NAV_ITEMS.filter(i => !BOTTOM_NAV_IDS.includes(i.id));
    Utils.openModal(`
      <div class="modal-header"><h3>Plus d'options</h3><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
      <div class="list">
        ${extra.map(item => `
          <div class="list-item" onclick="Utils.closeModal(); Router.go('${item.id}')">
            <div class="avatar">${item.icon}</div>
            <div class="content"><div class="title">${item.label}</div></div>
          </div>`).join('')}
      </div>
    `);
  },

  updateNavActive(page) {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === page);
    });
  },

  updateFab(page) {
    const fab = document.getElementById('fab-add');
    const map = {
      books: () => Pages.openBookForm(),
      clients: () => Pages.openClientForm(),
      sales: () => Router.go('sales/new')
    };
    if (map[page]) {
      fab.classList.remove('hidden');
      fab.onclick = map[page];
    } else {
      fab.classList.add('hidden');
      fab.onclick = null;
    }
  },

  bindDynamicInputs() {
    const logoInput = document.getElementById('logo-input');
    if (logoInput) {
      logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const b64 = await Utils.fileToBase64(file);
        document.getElementById('logo-box').innerHTML = `<img src="${b64}"><input type="file" accept="image/*" id="logo-input">`;
        App.bindDynamicInputs();
      });
    }
  },

  setPageState() { /* reserved for future granular state persistence */ },

  /* ---------- Lock screen ---------- */
  checkLock() {
    const s = DB.data.settings;
    const unlocked = sessionStorage.getItem('sza_unlocked') === '1';
    if (s.passwordEnabled && !unlocked) {
      document.getElementById('lock-screen').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
      this.bindLockScreen();
    } else {
      document.getElementById('lock-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
    }
  },

  bindLockScreen() {
    const input = document.getElementById('lock-input');
    const btn = document.getElementById('lock-btn');
    const tryUnlock = () => {
      const val = input.value;
      const stored = DB.data.settings.password ? decodeURIComponent(escape(atob(DB.data.settings.password))) : '';
      if (val && val === stored) {
        sessionStorage.setItem('sza_unlocked', '1');
        document.getElementById('lock-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('lock-error').textContent = '';
        input.value = '';
      } else {
        document.getElementById('lock-error').textContent = 'Mot de passe incorrect. Réessayez.';
      }
    };
    btn.onclick = tryUnlock;
    input.onkeydown = (e) => { if (e.key === 'Enter') tryUnlock(); };
    input.focus();
  },

  lockNow() {
    if (!DB.data.settings.passwordEnabled) {
      Utils.toast('Activez le mot de passe dans Réglages > Sécurité pour verrouiller.', 'warn');
      return;
    }
    sessionStorage.removeItem('sza_unlocked');
    this.checkLock();
  },

  /* ---------- Service worker & install ---------- */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW non enregistré :', err));
      });
    }
  },

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
    });
    document.getElementById('btn-install').addEventListener('click', async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        await this.deferredInstallPrompt.userChoice;
        this.deferredInstallPrompt = null;
      } else {
        Utils.toast('Utilisez le menu de votre navigateur : "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".', 'warn');
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
