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

  // Écrit puis relit le fichier : on ne prétend jamais « enregistré » sans l'avoir vérifié
  async putVerified(bookId, kind, blob) {
    await this.put(bookId, kind, blob);
    const back = await this.get(bookId, kind);
    if (!back || back.size !== blob.size) {
      throw new Error("le fichier n'a pas été enregistré correctement (espace insuffisant ?)");
    }
  },

  async exists(bookId, kind) {
    const n = await this._run('readonly', s => s.count(this.key(bookId, kind)));
    return n > 0;
  },

  // Demande au navigateur de ne jamais effacer ces fichiers automatiquement
  async persist() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) { /* ignore */ }
    return false;
  },

  async storageInfo() {
    const info = { persisted: null, usage: null, quota: null };
    try { if (navigator.storage && navigator.storage.persisted) info.persisted = await navigator.storage.persisted(); } catch (e) { /* ignore */ }
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        info.usage = e.usage; info.quota = e.quota;
      }
    } catch (e) { /* ignore */ }
    return info;
  },

  // Compare ce que l'application croit avoir (nom du fichier) et ce qui est vraiment stocké.
  // Marque « introuvable » les fichiers disparus pour que ce soit visible. Retourne true si changement.
  async reconcile() {
    let changed = false;
    try {
      for (const b of DB.data.books) {
        if (b.type !== 'ebook') continue;
        for (const kind of ['pdf', 'audio']) {
          // un fichier hébergé dans Supabase n'a pas besoin d'être présent sur l'appareil
          const missing = (b[kind + 'Name'] && !b[kind + 'Path']) ? !(await this.exists(b.id, kind)) : false;
          if (!!b[kind + 'Missing'] !== missing) { b[kind + 'Missing'] = missing; changed = true; }
        }
      }
      if (changed) DB.save();
    } catch (e) {
      console.warn('Vérification des fichiers impossible', e);
      return false;
    }
    return changed;
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
   Supabase Storage : les PDF / audios restent dans Supabase,
   l'application les télécharge au moment de l'envoi au client.
--------------------------------------------------------- */
const Cloud = {
  cfg() {
    const s = DB.data.settings;
    return {
      url: String(s.supabaseUrl || '').trim().replace(/\/+$/, ''),
      key: String(s.supabaseKey || '').trim(),
      bucket: String(s.supabaseBucket || '').trim()
    };
  },
  configured() { const c = this.cfg(); return !!(c.url && c.key && c.bucket); },
  basename(path) { return String(path || '').split('/').filter(Boolean).pop() || ''; },
  encPath(path) { return String(path).split('/').map(encodeURIComponent).join('/'); },
  err(code, message) { const e = new Error(message); e.code = code; return e; },

  // Refuse les clés secrètes : elles ne doivent jamais se trouver dans une application
  isSecretKey(key) {
    key = String(key || '').trim();
    if (!key) return false;
    if (key.startsWith('sb_secret_')) return true;
    try {
      const part = key.split('.')[1];
      if (part) {
        const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        return !!json && json.role === 'service_role';
      }
    } catch (e) { /* pas un JWT */ }
    return false;
  },

  // Essaie d'abord l'accès public, puis l'accès avec la clé « anon » (bucket privé)
  async request(path) {
    const c = this.cfg();
    if (!this.configured()) {
      throw this.err('config', "Supabase n'est pas configuré. Allez dans Réglages → Supabase et renseignez l'adresse du projet, la clé « anon public » et le nom du bucket.");
    }
    const clean = String(path || '').trim().replace(/^\/+/, '');
    if (!clean) throw this.err('notfound', "Aucun chemin de fichier n'est renseigné pour cet e-book.");
    const tail = encodeURIComponent(c.bucket) + '/' + this.encPath(clean);
    const base = c.url + '/storage/v1/object';
    let pub, auth;
    try {
      pub = await fetch(base + '/public/' + tail);
      if (pub.ok) return { res: pub, via: 'public' };
      auth = await fetch(base + '/authenticated/' + tail, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } });
      if (auth.ok) return { res: auth, via: 'authenticated' };
    } catch (e) {
      throw this.err('network', "Connexion à Supabase impossible : vérifiez votre connexion internet et l'adresse du projet (Réglages → Supabase).");
    }
    if (auth.status === 401) {
      throw this.err('denied', "Clé refusée par Supabase. Vérifiez la clé « anon public » dans Réglages → Supabase.");
    }
    throw this.err('notfound', "Fichier introuvable (ou accès refusé) dans Supabase.\nBucket : « " + c.bucket + " »\nChemin : « " + clean + " »\n\nVérifiez l'orthographe exacte (majuscules, extension). Si le bucket est privé, ajoutez une règle de lecture dans Storage → Policies, ou rendez-le public.");
  },

  async fetchFile(path) {
    const { res } = await this.request(path);
    return await res.blob();
  },

  // Vérifie qu'un fichier existe sans le télécharger en entier
  async check(path) {
    const { res, via } = await this.request(path);
    const size = Number(res.headers.get('content-length') || 0);
    try { if (res.body && res.body.cancel) await res.body.cancel(); } catch (e) { /* ignore */ }
    return { via, size };
  },

  // Vérifie l'adresse du projet et la clé
  async ping() {
    const c = this.cfg();
    if (!c.url || !c.key) throw this.err('config', "Renseignez l'adresse du projet et la clé « anon public ».");
    let r;
    try { r = await fetch(c.url + '/auth/v1/settings', { headers: { apikey: c.key } }); }
    catch (e) { throw this.err('network', "Adresse injoignable : vérifiez l'adresse du projet et votre connexion internet."); }
    if (r.status === 401 || r.status === 403) throw this.err('denied', "Clé refusée : vérifiez la clé « anon public ».");
    if (!r.ok) throw this.err('other', 'Réponse inattendue de Supabase (code ' + r.status + ').');
    return true;
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

  audioType(path) {
    const ext = String(path).split('.').pop().toLowerCase();
    return ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg' })[ext] || 'audio/mpeg';
  },

  // Fichier hébergé dans Supabase : on télécharge toujours la dernière version
  // (hors connexion, on utilise la copie gardée sur l'appareil). Sinon : fichier importé localement.
  async fetchBlob(book, kind) {
    const path = String(book[kind + 'Path'] || '').trim();
    if (path) {
      try {
        const raw = await Cloud.fetchFile(path);
        const type = kind === 'pdf' ? 'application/pdf' : (raw.type && raw.type.startsWith('audio/') ? raw.type : this.audioType(path));
        const blob = new Blob([raw], { type });
        try { await FileStore.putVerified(book.id, kind, blob); } catch (e) { /* copie locale impossible : sans gravité */ }
        return blob;
      } catch (e) {
        if (e && e.code === 'network') {
          const cached = await FileStore.get(book.id, kind).catch(() => null);
          if (cached) return cached;
        }
        throw e;
      }
    }
    const blob = await FileStore.get(book.id, kind);
    if (!blob) {
      throw new Error(kind === 'pdf'
        ? "Aucun PDF n'est enregistré pour cet e-book. Renseignez son chemin Supabase ou importez-le dans la fiche du livre."
        : "Aucun audio n'est enregistré pour cet e-book. Renseignez son chemin Supabase ou importez-le dans la fiche du livre.");
    }
    return blob;
  },

  async prepare(saleId, bookId, kind) {
    const sale = DB.getSale(saleId);
    const book = DB.getBook(bookId);
    this.assertAllowed(sale, book);
    const client = DB.getClient(sale.clientId);
    const blob = await this.fetchBlob(book, kind);
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
