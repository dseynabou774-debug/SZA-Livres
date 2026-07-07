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
    } catch (e) {
      console.error('Erreur de chargement des données', e);
      this.data = this.defaultData();
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
      localStorage.setItem(DB_KEY + '_last_backup_at', new Date().toISOString());
      return true;
    } catch (e) {
      console.error('Erreur de sauvegarde', e);
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
    return book.stock <= 0 ? 'rupture' : (book.stock <= book.minAlert ? 'alerte' : 'disponible');
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
    // decrement stock
    sale.items.forEach(item => {
      const book = this.getBook(item.bookId);
      if (book) {
        book.stock = Math.max(0, book.stock - item.qty);
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
      // restore stock
      sale.items.forEach(item => {
        const book = this.getBook(item.bookId);
        if (book) {
          book.stock += item.qty;
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
  totals() {
    const books = this.data.books;
    const sales = this.data.sales;
    const totalBooks = books.reduce((s, b) => s + Number(b.stock || 0) + Number(b.sold || 0), 0);
    const inStock = books.reduce((s, b) => s + Number(b.stock || 0), 0);
    const sold = books.reduce((s, b) => s + Number(b.sold || 0), 0);
    const revenue = sales.reduce((s, sale) => s + Number(sale.paid || 0), 0);
    let profit = 0;
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const book = this.getBook(item.bookId);
        const cost = book ? Number(book.cost || 0) : 0;
        profit += (Number(item.price) - cost) * Number(item.qty);
      });
    });
    const pending = sales.filter(s => s.status === 'En attente').length;
    return { totalBooks, inStock, sold, revenue, profit, pending };
  },

  bestSellers(limit = 5) {
    return [...this.data.books]
      .filter(b => (b.sold || 0) > 0)
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
    this.save();
  }
};
