/* =========================================================
   files.js — Fichiers des e-books (PDF + audio), filigrane
   personnalisé par client et livraison par WhatsApp.
   Les fichiers sont stockés dans IndexedDB (adapté aux gros
   fichiers, contrairement à localStorage).
   ========================================================= */

const FileStore = {
  dbPromise: null,

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('sza_files_v1', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  },

  async _run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const r = fn(t.objectStore('files'));
      t.oncomplete = () => resolve(r ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  },

  key(bookId, kind) { return bookId + ':' + kind; },
  put(bookId, kind, blob) { return this._run('readwrite', s => s.put(blob, this.key(bookId, kind))); },
  get(bookId, kind) { return this._run('readonly', s => s.get(this.key(bookId, kind))); },
  del(bookId, kind) { return this._run('readwrite', s => s.delete(this.key(bookId, kind))); },

  // Demande au navigateur de ne jamais effacer ces fichiers automatiquement
  async persist() {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
  }
};

/* ---------------------------------------------------------
   Filigrane PDF : nom, téléphone et n° de reçu du client
   sur chaque page (diagonale + pied de page).
--------------------------------------------------------- */
const Watermark = {
  // Helvetica ne gère pas tous les caractères : on remplace ceux
  // qui ne sont pas supportés (ex. alphabet arabe) par « ? ».
  safe(font, text) {
    let out = '';
    for (const ch of String(text == null ? '' : text)) {
      try { font.encodeText(ch); out += ch; } catch (e) { out += '?'; }
    }
    return out;
  },

  async apply(pdfBytes, info) {
    if (typeof PDFLib === 'undefined') {
      throw new Error("Module PDF non chargé. Connectez-vous à internet une première fois puis réessayez.");
    }
    const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const name = this.safe(font, info.name || 'Client');
    const phone = this.safe(font, info.phone || '');
    const receipt = this.safe(font, info.receipt || '');
    const academy = this.safe(font, info.academy || '');

    const main = [name, phone, 'Recu ' + receipt].filter(Boolean).join('  -  ');
    const footer = this.safe(font, `Exemplaire personnel de ${info.name || 'Client'} (${info.phone || '-'}) - Recu ${info.receipt || ''} - ${info.academy || ''} - Reproduction et partage interdits`);

    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      const diag = Math.sqrt(width * width + height * height);
      const angle = Math.atan2(height, width);
      const unit = font.widthOfTextAtSize(main, 1) || 1;
      const size = Math.max(10, Math.min(34, (diag * 0.5) / unit));
      const tw = font.widthOfTextAtSize(main, size);
      const th = size;
      const cx = width / 2, cy = height / 2;
      // 3 lignes parallèles à la diagonale
      [-1, 0, 1].forEach(i => {
        const off = i * Math.min(width, height) * 0.2;
        const px = cx + off * -Math.sin(angle);
        const py = cy + off * Math.cos(angle);
        page.drawText(main, {
          x: px - (tw / 2) * Math.cos(angle) + (th / 2) * Math.sin(angle),
          y: py - (tw / 2) * Math.sin(angle) - (th / 2) * Math.cos(angle),
          size,
          font,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.2,
          rotate: degrees((angle * 180) / Math.PI)
        });
      });
      // Pied de page
      const fsize = 6.5;
      const fw = font.widthOfTextAtSize(footer, fsize);
      const fs = fw > width - 20 ? (fsize * (width - 20)) / fw : fsize;
      page.drawText(footer, { x: 10, y: 8, size: fs, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.8 });
    });

    doc.setSubject(this.safe(font, `Exemplaire de ${info.name || 'Client'} - Recu ${info.receipt || ''}`));
    doc.setProducer(academy || 'Seyda Zeynab Academy');
    return doc.save();
  }
};

/* ---------------------------------------------------------
   Livraison : préparation du fichier puis envoi WhatsApp
--------------------------------------------------------- */
const Delivery = {
  ready: null, // { file, saleId, bookId, kind }

  cleanName(s) {
    return String(s || 'ebook').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ebook';
  },

  // Numéro au format international pour wa.me (Sénégal par défaut)
  waNumber(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 9 && d.startsWith('7')) d = '221' + d;
    return d;
  },

  assertAllowed(sale, book) {
    if (!sale || !book) throw new Error('Vente ou e-book introuvable.');
    if (sale.status !== 'Payé') throw new Error('Livraison possible uniquement après paiement complet.');
    if (book.filesEnabled === false) throw new Error("La livraison est désactivée pour cet e-book.");
  },

  async prepare(saleId, bookId, kind) {
    const sale = DB.getSale(saleId);
    const book = DB.getBook(bookId);
    this.assertAllowed(sale, book);
    const client = DB.getClient(sale.clientId);
    const blob = await FileStore.get(bookId, kind);
    if (!blob) {
      throw new Error(kind === 'pdf'
        ? "Aucun PDF n'est enregistré sur cet appareil pour cet e-book. Importez-le dans la fiche du livre."
        : "Aucun audio n'est enregistré sur cet appareil pour cet e-book.");
    }
    if (kind === 'pdf') {
      const bytes = await blob.arrayBuffer();
      const out = await Watermark.apply(bytes, {
        name: client ? client.name : 'Client',
        phone: client ? client.phone : '',
        receipt: sale.id,
        academy: DB.data.settings.academyName
      });
      return new File([out], `${this.cleanName(book.title)}_${sale.id}.pdf`, { type: 'application/pdf' });
    }
    const ext = ((book.audioName || '').split('.').pop() || 'mp3').toLowerCase();
    return new File([blob], `${this.cleanName(book.title)}_audio.${ext}`, { type: blob.type || 'audio/mpeg' });
  },

  message(sale, book, kind) {
    const client = DB.getClient(sale.clientId);
    const set = DB.data.settings;
    return `Bonjour ${client ? client.name : ''},\n\nVoici ${kind === 'pdf' ? 'votre e-book' : "la version audio de votre e-book"} « ${book.title} » (reçu ${sale.id}).\n\nMerci pour votre confiance 🌿\n${set.academyName}`;
  },

  download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
};
