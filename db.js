/* =========================================================
   DB.js — Couche de stockage local (localStorage)
   Toutes les données de l'application vivent ici.
   ========================================================= */

const DB_KEY = 'sza_livres_db_v1';

const DB = {
  data: null,

  defaultData() {
    return {
      settings: {
        academyName: 'Seyda Zeynab Academy',
        tagline: 'Savoir utile pour une vie meilleure',
        logo: 'logo.png',
        phone: '+221 77 000 00 00',
        address: 'Keur Massar, Dakar, Sénégal',
        currency: 'FCFA',
        colorEmerald: '#1d3823',
        colorGold: '#c9a15a',
        password: '',
        passwordEnabled: false
      },
      books: [],
      clients: [],
      sales: [],
      seq: { book: 1, client: 1, sale: 1 }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      this.data = raw ? JSON.parse(raw) : this.defaultData();
      // fill any missing keys (future-proofing / upgrades)
      const def = this.defaultData();
      this.data.settings = Object.assign({}, def.settings, this.data.settings || {});
      this.data.books = this.data.books || [];
      this.data.clients = this.data.clients || [];
      this.data.sales = this.data.sales || [];
      this.data.seq = Object.assign({}, def.seq, this.data.seq || {});
      this.migrate();
    } catch (e) {
      console.error('Erreur de chargement des données', e);
      this.data = this.defaultData();
    }
    return this.data;
  },

  // Backfill fields introduced in later versions so that data saved by an
  // older version of the app is never lost or broken when the app is updated.
  migrate() {
    this.data.books.forEach(b => {
      if (!b.type) b.type = 'papier';
      if (b.downloadLink === undefined) b.downloadLink = '';
      if (b.stock === undefined || b.stock === null) b.stock = 0;
      if (b.sold === undefined || b.sold === null) b.sold = 0;
    });
    this.data.sales.forEach(s => {
      const subtotal = (s.items || []).reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0);
      if (s.subtotal === undefined) s.subtotal = subtotal;
      if (s.discount === undefined) s.discount = 0;
      if (s.total === undefined) s.total = subtotal;
      const paid = Number(s.paid || 0);
      const total = Number(s.total);
      if (s.remaining === undefined) s.remaining = Math.max(0, total - paid);
      // Reclassify the old binary status (Payé / En attente) into the new
      // three-tier system (Payé / Partiel / En attente) without losing data.
      if (s.status !== 'Payé' && s.status !== 'Partiel' && s.status !== 'En attente') {
        if (paid <= 0) s.status = 'En attente';
        else if (paid >= total) s.status = 'Payé';
        else s.status = 'Partiel';
      } else if (s.status === 'En attente' && paid > 0 && paid < total) {
        s.status = 'Partiel';
      } else if (s.status === 'En attente' && paid >= total && total > 0) {
        s.status = 'Payé';
      }
    });
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
      localStorage.setItem(DB_KEY + '_last_backup_at', new Date().toISOString());
      return true;
    } catch (e) {
      console.error('Erreur de sauvegarde', e);
      const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(isQuota
          ? "Stockage plein : exportez vos données (Sauvegarde) puis réduisez la taille/nombre des photos de couverture."
          : "Erreur de sauvegarde locale. Vos dernières modifications risquent de ne pas être conservées.", 'err');
      }
      return false;
    }
  },

  nextId(kind) {
    const id = this.data.seq[kind]++;
    this.save();
    return `${kind[0].toUpperCase()}${String(id).padStart(4, '0')}`;
  },

  // ---------- Books ----------
  addBook(book) {
    book.id = this.nextId('book');
    book.createdAt = new Date().toISOString();
    this.data.books.push(book);
    this.save();
    return book;
  },
  updateBook(id, patch) {
    const b = this.data.books.find(x => x.id === id);
    if (b) { Object.assign(b, patch); this.save(); }
    return b;
  },
  deleteBook(id) {
    this.data.books = this.data.books.filter(x => x.id !== id);
    this.save();
  },
  getBook(id) {
    return this.data.books.find(x => x.id === id);
  },
  bookStatus(book) {
    if (book.type === 'ebook') return 'disponible';
    return book.stock <= 0 ? 'rupture' : (book.stock <= book.minAlert ? 'alerte' : 'disponible');
  },
  isEbook(book) {
    return !!book && book.type === 'ebook';
  },

  // ---------- Clients ----------
  addClient(client) {
    client.id = this.nextId('client');
    client.createdAt = new Date().toISOString();
    this.data.clients.push(client);
    this.save();
    return client;
  },
  updateClient(id, patch) {
    const c = this.data.clients.find(x => x.id === id);
    if (c) { Object.assign(c, patch); this.save(); }
    return c;
  },
  deleteClient(id) {
    this.data.clients = this.data.clients.filter(x => x.id !== id);
    this.save();
  },
  getClient(id) {
    return this.data.clients.find(x => x.id === id);
  },
  clientHistory(id) {
    return this.data.sales.filter(s => s.clientId === id).sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // ---------- Sales ----------
  addSale(sale) {
    sale.id = this.nextId('sale');
    // decrement stock — only for physical books; e-books have unlimited stock
    sale.items.forEach(item => {
      const book = this.getBook(item.bookId);
      if (book) {
        if (book.type !== 'ebook') {
          book.stock = Math.max(0, book.stock - item.qty);
        }
        book.sold = (book.sold || 0) + item.qty;
      }
    });
    const client = this.getClient(sale.clientId);
    if (client) client.lastPurchaseDate = sale.date;
    this.data.sales.push(sale);
    this.save();
    return sale;
  },
  updateSale(id, patch) {
    const s = this.data.sales.find(x => x.id === id);
    if (s) { Object.assign(s, patch); this.save(); }
    return s;
  },
  deleteSale(id) {
    const sale = this.data.sales.find(x => x.id === id);
    if (sale) {
      // restore stock — only for physical books
      sale.items.forEach(item => {
        const book = this.getBook(item.bookId);
        if (book) {
          if (book.type !== 'ebook') book.stock += item.qty;
          book.sold = Math.max(0, (book.sold || 0) - item.qty);
        }
      });
    }
    this.data.sales = this.data.sales.filter(x => x.id !== id);
    this.save();
  },
  getSale(id) {
    return this.data.sales.find(x => x.id === id);
  },

  // ---------- Aggregates ----------
  // Core stats engine — reusable for global totals, date-filtered reports,
  // and per-type (papier / ebook) breakdowns, so all screens stay consistent.
  computeSalesStats(salesArr) {
    let revenue = 0, profit = 0, discount = 0;
    let papierRevenue = 0, ebookRevenue = 0, papierProfit = 0, ebookProfit = 0;
    let papierQty = 0, ebookQty = 0;
    let paidCount = 0, partialCount = 0, pendingCount = 0, totalRemaining = 0;

    salesArr.forEach(sale => {
      const items = sale.items || [];
      const subtotal = sale.subtotal != null ? Number(sale.subtotal) : items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
      const disc = Number(sale.discount || 0);
      const paid = Number(sale.paid || 0);
      const total = sale.total != null ? Number(sale.total) : Math.max(0, subtotal - disc);

      revenue += paid;
      discount += disc;
      if (sale.status === 'Partiel') { partialCount++; totalRemaining += Math.max(0, total - paid); }
      else if (sale.status === 'En attente') { pendingCount++; totalRemaining += Math.max(0, total - paid); }
      else { paidCount++; }

      items.forEach(item => {
        const book = this.getBook(item.bookId);
        const isEbook = book ? book.type === 'ebook' : !!item.isEbook;
        const itemSubtotal = Number(item.price || 0) * Number(item.qty || 0);
        const share = subtotal > 0 ? itemSubtotal / subtotal : 0;
        const itemDiscount = disc * share;
        const itemTotal = itemSubtotal - itemDiscount;
        const cost = book ? Number(book.cost || 0) : 0;
        const itemCost = cost * Number(item.qty || 0);
        const itemProfit = itemTotal - itemCost;
        const itemPaidShare = paid * share;
        profit += itemProfit;
        if (isEbook) {
          ebookRevenue += itemPaidShare; ebookProfit += itemProfit; ebookQty += Number(item.qty || 0);
        } else {
          papierRevenue += itemPaidShare; papierProfit += itemProfit; papierQty += Number(item.qty || 0);
        }
      });
    });

    return {
      revenue, profit, discount,
      papierRevenue, ebookRevenue, papierProfit, ebookProfit, papierQty, ebookQty,
      paidCount, partialCount, pendingCount, totalRemaining
    };
  },

  totals() {
    const books = this.data.books;
    // E-books have unlimited stock, so they never count toward "en stock"
    const inStock = books.reduce((s, b) => s + (b.type === 'ebook' ? 0 : Number(b.stock || 0)), 0);
    const sold = books.reduce((s, b) => s + Number(b.sold || 0), 0);
    const totalBooks = inStock + sold;
    const papierSold = books.filter(b => b.type !== 'ebook').reduce((s, b) => s + Number(b.sold || 0), 0);
    const ebookSold = books.filter(b => b.type === 'ebook').reduce((s, b) => s + Number(b.sold || 0), 0);
    const stats = this.computeSalesStats(this.data.sales);
    return {
      totalBooks, inStock, sold, papierSold, ebookSold,
      revenue: stats.revenue, profit: stats.profit, totalDiscounts: stats.discount,
      papierRevenue: stats.papierRevenue, ebookRevenue: stats.ebookRevenue,
      papierProfit: stats.papierProfit, ebookProfit: stats.ebookProfit,
      pending: stats.pendingCount, partial: stats.partialCount, totalRemaining: stats.totalRemaining
    };
  },

  // type: undefined/'all' = tous, 'papier' = livres papier uniquement, 'ebook' = e-books uniquement
  bestSellers(limit = 5, type) {
    return [...this.data.books]
      .filter(b => {
        if ((b.sold || 0) <= 0) return false;
        if (type === 'papier') return b.type !== 'ebook';
        if (type === 'ebook') return b.type === 'ebook';
        return true;
      })
      .sort((a, b) => (b.sold || 0) - (a.sold || 0))
      .slice(0, limit);
  },

  salesBetween(start, end) {
    return this.data.sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
  },

  // ---------- Backup ----------
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },
  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') throw new Error('Fichier invalide');
    this.data = parsed;
    const def = this.defaultData();
    this.data.settings = Object.assign({}, def.settings, this.data.settings || {});
    this.data.books = this.data.books || [];
    this.data.clients = this.data.clients || [];
    this.data.sales = this.data.sales || [];
    this.data.seq = Object.assign({}, def.seq, this.data.seq || {});
    this.migrate();
    this.save();
  }
};
