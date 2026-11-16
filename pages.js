/* =========================================================
   pages.js — Rendu des pages de l'application
   ========================================================= */

const Pages = {};

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
Pages.dashboard = function () {
  const t = DB.totals();
  const bestPapier = DB.bestSellers(5, 'papier');
  const bestEbook = DB.bestSellers(5, 'ebook');
  const lowStock = DB.data.books.filter(b => DB.bookStatus(b) !== 'disponible');

  let alertHtml = '';
  if (lowStock.length) {
    alertHtml = `<div class="alert-banner">⚠️ ${lowStock.length} livre(s) proche(s) de la rupture ou en rupture de stock.</div>`;
  }

  const bestListHtml = (list, emptyMsg) => list.length ? list.map(b => `
    <div class="list-item">
      <div class="avatar">${Utils.escapeHtml(b.title.slice(0,1).toUpperCase())}</div>
      <div class="content">
        <div class="title">${Utils.escapeHtml(b.title)}</div>
        <div class="meta">${b.sold || 0} vendu(s) · ${Utils.money(b.price)}</div>
      </div>
    </div>`).join('') : `<div class="empty-state"><div class="ic">📈</div><p>${emptyMsg}</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Vue d'ensemble</span><h2>Tableau de bord</h2></div>
    </div>
    ${alertHtml}
    <div class="grid-stats">
      <div class="stat-card"><span class="ic">📚</span><div class="label">Total livres</div><div class="value">${t.totalBooks}</div></div>
      <div class="stat-card"><span class="ic">📦</span><div class="label">En stock</div><div class="value">${t.inStock}</div></div>
      <div class="stat-card"><span class="ic">✅</span><div class="label">Vendus</div><div class="value">${t.sold}</div></div>
      <div class="stat-card"><span class="ic">💰</span><div class="label">Chiffre d'affaires</div><div class="value">${Utils.money(t.revenue)}</div></div>
      <div class="stat-card"><span class="ic">📈</span><div class="label">Bénéfice</div><div class="value">${Utils.money(t.profit)}</div></div>
      <div class="stat-card"><span class="ic">🏷️</span><div class="label">Réductions accordées</div><div class="value">${Utils.money(t.totalDiscounts)}</div></div>
    </div>

    <div class="section-block">
      <h3>💳 Suivi des paiements</h3>
      <div class="grid-stats">
        <div class="stat-card" style="border-left-color:var(--danger)"><span class="ic">⏳</span><div class="label">Paiements en attente</div><div class="value">${t.pending}</div></div>
        <div class="stat-card" style="border-left-color:var(--warn)"><span class="ic">🟡</span><div class="label">Paiements partiels</div><div class="value">${t.partial}</div></div>
        <div class="stat-card"><span class="ic">💵</span><div class="label">Reste à encaisser</div><div class="value">${Utils.money(t.totalRemaining)}</div></div>
      </div>
    </div>

    <div class="section-block">
      <h3>📊 Performance par type de produit</h3>
      <div class="grid-stats" style="grid-template-columns:repeat(2,1fr)">
        <div class="card" style="border-left:4px solid var(--gold)">
          <h3 style="font-size:.95rem">📄 Livres papier</h3>
          <div class="stock-row mt-8"><span class="text-muted">Vendus</span><strong>${t.papierSold}</strong></div>
          <div class="stock-row"><span class="text-muted">Chiffre d'affaires</span><strong>${Utils.money(t.papierRevenue)}</strong></div>
          <div class="stock-row"><span class="text-muted">Bénéfice</span><strong class="gold-text">${Utils.money(t.papierProfit)}</strong></div>
        </div>
        <div class="card" style="border-left:4px solid var(--emerald-600)">
          <h3 style="font-size:.95rem">💻 E-books</h3>
          <div class="stock-row mt-8"><span class="text-muted">Vendus</span><strong>${t.ebookSold}</strong></div>
          <div class="stock-row"><span class="text-muted">Chiffre d'affaires</span><strong>${Utils.money(t.ebookRevenue)}</strong></div>
          <div class="stock-row"><span class="text-muted">Bénéfice</span><strong class="gold-text">${Utils.money(t.ebookProfit)}</strong></div>
        </div>
      </div>
    </div>

    <div class="section-block">
      <h3>📚 Livres papier les plus vendus</h3>
      <div class="list">${bestListHtml(bestPapier, 'Aucune vente de livre papier pour le moment.')}</div>
    </div>
    <div class="section-block">
      <h3>📱 E-books les plus vendus</h3>
      <div class="list">${bestListHtml(bestEbook, 'Aucune vente d\'e-book pour le moment.')}</div>
    </div>

    <div class="section-block">
      <h3>⚡ Actions rapides</h3>
      <div class="tag-row">
        <button class="btn btn-primary btn-sm" onclick="Router.go('sales/new')">+ Nouvelle vente</button>
        <button class="btn btn-outline btn-sm" onclick="Router.go('books')">+ Ajouter un livre</button>
        <button class="btn btn-outline btn-sm" onclick="Router.go('clients')">+ Ajouter un client</button>
        <button class="btn btn-outline btn-sm" onclick="Router.go('reports')">Voir les rapports</button>
      </div>
    </div>
  `;
};

/* ---------------------------------------------------------
   BOOKS
--------------------------------------------------------- */
Pages.books = function (query = '', typeFilter = 'all') {
  const q = query.trim().toLowerCase();
  let books = [...DB.data.books].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (q) books = books.filter(b => b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q));
  if (typeFilter === 'papier') books = books.filter(b => b.type !== 'ebook');
  if (typeFilter === 'ebook') books = books.filter(b => b.type === 'ebook');

  const cardsHtml = books.length ? books.map(b => {
    const isEbook = DB.isEbook(b);
    const status = DB.bookStatus(b);
    const badge = isEbook ? '<span class="badge badge-ok">Illimité</span>'
      : status === 'rupture' ? '<span class="badge badge-danger">Rupture</span>'
      : status === 'alerte' ? '<span class="badge badge-warn">Stock faible</span>'
      : '<span class="badge badge-ok">Disponible</span>';
    const typeTag = isEbook ? '<span class="chip" style="padding:2px 9px;font-size:.62rem">💻 E-book</span>' : '<span class="chip" style="padding:2px 9px;font-size:.62rem">📄 Papier</span>';
    const cover = b.cover
      ? `<img class="book-cover" src="${b.cover}" alt="${Utils.escapeHtml(b.title)}">`
      : `<div class="book-cover">${isEbook ? '💻' : '📘'}</div>`;
    return `
      <div class="book-card" onclick="Pages.openBookForm('${b.id}')">
        ${cover}
        <div class="book-info">
          <div class="tag-row mb-8">${typeTag}</div>
          <div class="title">${Utils.escapeHtml(b.title)}</div>
          <div class="author">${Utils.escapeHtml(b.author || '—')}</div>
          <div class="stock-row"><span class="price">${Utils.money(b.price)}</span>${badge}</div>
          <div class="mt-8 text-muted" style="font-size:.72rem">Stock : ${isEbook ? 'Illimité ∞' : b.stock}</div>
          ${isEbook ? `<div class="text-muted" style="font-size:.68rem;margin-top:4px">${b.pdfName ? (b.pdfMissing ? '⚠️ PDF à réimporter' : '📄 PDF ✓') : '📄 PDF manquant'} · ${b.audioName ? (b.audioMissing ? '⚠️ audio à réimporter' : '🎧 Audio ✓') : 'sans audio'}${b.filesEnabled === false ? ' · 🚫 désactivé' : ''}<br>📤 ${b.pdfSent || 0} envoi(s) PDF${b.audioName ? ' · ' + (b.audioSent || 0) + ' audio' : ''}</div>` : ''}
        </div>
      </div>`;
  }).join('') : `<div class="empty-state"><div class="ic">📚</div><p>Aucun livre trouvé. Ajoutez votre premier livre ou e-book avec le bouton +.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Catalogue</span><h2>Gestion des livres</h2></div>
      <button class="btn btn-primary btn-sm" onclick="Pages.openBookForm()">+ Ajouter un livre</button>
    </div>
    <div class="search-bar">
      <span class="ic">🔍</span>
      <input type="text" id="book-search" placeholder="Rechercher un titre ou un auteur..." value="${Utils.escapeHtml(query)}" oninput="Pages.refreshBooks(this.value)">
    </div>
    <div class="tag-row mb-8" id="book-type-filter">
      <span class="chip ${typeFilter==='all'?'active':''}" onclick="Pages.setBookFilter('all')">Tous</span>
      <span class="chip ${typeFilter==='papier'?'active':''}" onclick="Pages.setBookFilter('papier')">📄 Livres papier</span>
      <span class="chip ${typeFilter==='ebook'?'active':''}" onclick="Pages.setBookFilter('ebook')">💻 E-books</span>
    </div>
    <div class="book-grid" id="book-grid">${cardsHtml}</div>
  `;
};

Pages.bookTypeFilter = 'all';
Pages.setBookFilter = function (t) {
  Pages.bookTypeFilter = t;
  const q = document.getElementById('book-search') ? document.getElementById('book-search').value : '';
  document.getElementById('main-content').innerHTML = Pages.books(q, t);
};

Pages.refreshBooks = function (q) {
  const html = Pages.books(q, Pages.bookTypeFilter);
  const match = html.match(/<div class="book-grid"[\s\S]*<\/div>\s*$/);
  if (match) document.getElementById('book-grid').outerHTML = match[0];
};

Pages._pending = { pdf: undefined, audio: undefined }; // undefined = inchangé, File = nouveau, null = retirer

Pages.fileStatusHtml = function (book, kind) {
  const p = Pages._pending[kind];
  if (p && p.blob) return `<div>✅ Nouveau fichier prêt : <strong>${Utils.escapeHtml(p.name)}</strong> (${Pages.fmtSize(p.size)})</div><div class="text-muted" style="font-size:.72rem">Sera enregistré en appuyant sur « Enregistrer »</div>`;
  if (p === null) return `<div>🗑 Fichier retiré</div><div class="text-muted" style="font-size:.72rem">Sera supprimé en appuyant sur « Enregistrer »</div>`;
  const name = book ? book[kind + 'Name'] : '';
  const size = book ? book[kind + 'Size'] : 0;
  if (book && book[kind + 'Path']) return `<div>☁️ Supabase : <strong>${Utils.escapeHtml(book[kind + 'Path'])}</strong></div><div class="text-muted" style="font-size:.72rem">Téléchargé automatiquement au moment de l'envoi</div>`;
  if (name && book[kind + 'Missing']) return `<div>⚠️ <strong>${Utils.escapeHtml(name)}</strong> est introuvable sur cet appareil</div><div class="text-muted" style="font-size:.72rem">Appuyez pour l'importer à nouveau</div>`;
  if (name) return `<div>✅ <strong>${Utils.escapeHtml(name)}</strong> (${Pages.fmtSize(size)})</div><div class="text-muted" style="font-size:.72rem">Appuyez pour remplacer par une nouvelle version</div>`;
  return `<div style="font-size:1.6rem">${kind === 'pdf' ? '📄' : '🎧'}</div><div>Importer le fichier ${kind === 'pdf' ? 'PDF' : 'audio'}</div>`;
};

Pages.fmtSize = function (bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' Mo';
  return Math.max(1, Math.round(n / 1024)) + ' Ko';
};

Pages.refreshFileStatus = function (kind) {
  const id = Pages._editingBookId;
  const el = document.getElementById(kind + '-status');
  if (el) el.innerHTML = Pages.fileStatusHtml(id ? DB.getBook(id) : null, kind);
};

Pages.clearPending = function (kind) {
  Pages._pending[kind] = null;
  const input = document.getElementById('f-' + kind);
  if (input) input.value = '';
  const pin = document.getElementById('f-' + kind + 'path'); if (pin) pin.value = '';
  Pages.refreshFileStatus(kind);
};

Pages.openBookForm = function (id) {
  const book = id ? DB.getBook(id) : null;
  const type = book ? (book.type || 'papier') : 'papier';
  Pages._pending = { pdf: undefined, audio: undefined };
  Pages._editingBookId = id || null;
  Utils.openModal(`
    <div class="modal-header">
      <h3>${book ? 'Modifier le livre' : 'Nouveau livre'}</h3>
      <button class="modal-close" onclick="Utils.closeModal()">✕</button>
    </div>
    <div class="upload-box" id="cover-box">
      ${book && book.cover ? `<img src="${book.cover}">` : '<div style="font-size:2rem">📷</div><div>Ajouter une photo de couverture</div>'}
      <input type="file" accept="image/*" id="book-cover-input">
    </div>
    <div class="form-group mt-16">
      <label>Type de produit *</label>
      <select id="f-type" onchange="Pages.toggleEbookFields(this.value)">
        <option value="papier" ${type==='papier'?'selected':''}>📄 Livre papier (stock physique)</option>
        <option value="ebook" ${type==='ebook'?'selected':''}>💻 E-book (stock illimité)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Titre *</label>
      <input type="text" id="f-title" value="${book ? Utils.escapeHtml(book.title) : ''}" placeholder="Titre du livre">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Auteur</label>
        <input type="text" id="f-author" value="${book ? Utils.escapeHtml(book.author || '') : ''}" placeholder="Nom de l'auteur">
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <input type="text" id="f-category" value="${book ? Utils.escapeHtml(book.category || '') : ''}" placeholder="Ex : Tafsir, Fiqh...">
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="f-description" rows="3" placeholder="Courte description du livre">${book ? Utils.escapeHtml(book.description || '') : ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prix de vente (${DB.data.settings.currency})</label>
        <input type="number" id="f-price" value="${book ? book.price : ''}" min="0">
      </div>
      <div class="form-group">
        <label>Coût ${type==='ebook' ? '(production)' : "d'impression"} (${DB.data.settings.currency})</label>
        <input type="number" id="f-cost" value="${book ? book.cost : ''}" min="0">
      </div>
    </div>
    <div class="form-row" id="stock-fields" style="${type==='ebook'?'display:none':''}">
      <div class="form-group">
        <label>Quantité en stock</label>
        <input type="number" id="f-stock" value="${book ? book.stock : ''}" min="0">
      </div>
      <div class="form-group">
        <label>Seuil d'alerte minimum</label>
        <input type="number" id="f-minalert" value="${book ? book.minAlert : 3}" min="0">
      </div>
    </div>
    <div id="ebook-files-field" style="${type==='ebook'?'':'display:none'}">
      <div class="form-group">
        <label>📄 PDF de l'e-book</label>
        <input type="text" id="f-pdfpath" value="${book ? Utils.escapeHtml(book.pdfPath || '') : ''}" placeholder="Chemin dans Supabase, ex : livres/mon-livre.pdf" oninput="Pages.onPathInput('pdf')">
        <button type="button" class="btn btn-outline btn-sm mt-8" onclick="Pages.testPath('pdf')">🔌 Tester ce chemin</button>
        <div class="text-muted mt-8" style="font-size:.72rem">ou importez un fichier depuis le téléphone :</div>
        <div class="upload-box" id="pdf-box">
          <div id="pdf-status">${Pages.fileStatusHtml(book, 'pdf')}</div>
          <input type="file" accept="application/pdf,.pdf" id="f-pdf">
        </div>
        <button type="button" class="btn btn-outline btn-sm mt-8" onclick="Pages.clearPending('pdf')">Retirer le PDF</button>
      </div>
      <div class="form-group">
        <label>🎧 Audio de l'e-book (optionnel)</label>
        <input type="text" id="f-audiopath" value="${book ? Utils.escapeHtml(book.audioPath || '') : ''}" placeholder="Chemin dans Supabase, ex : audios/mon-livre.mp3" oninput="Pages.onPathInput('audio')">
        <button type="button" class="btn btn-outline btn-sm mt-8" onclick="Pages.testPath('audio')">🔌 Tester ce chemin</button>
        <div class="text-muted mt-8" style="font-size:.72rem">ou importez un fichier depuis le téléphone :</div>
        <div class="upload-box" id="audio-box">
          <div id="audio-status">${Pages.fileStatusHtml(book, 'audio')}</div>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" id="f-audio">
        </div>
        <button type="button" class="btn btn-outline btn-sm mt-8" onclick="Pages.clearPending('audio')">Retirer l'audio</button>
      </div>
      <div class="stock-row">
        <span>Livraison activée (PDF / audio)</span>
        <input type="checkbox" id="f-filesenabled" ${!book || book.filesEnabled !== false ? 'checked' : ''} style="width:20px;height:20px">
      </div>
      ${book ? `<div class="text-muted mt-8" style="font-size:.78rem">📤 Envoyés à des clients : <strong>${book.pdfSent || 0}</strong> PDF · <strong>${book.audioSent || 0}</strong> audio</div>` : ''}
      <div class="text-muted mt-8" style="font-size:.72rem">Avec un chemin Supabase, l'application télécharge toujours la dernière version du fichier au moment de l'envoi : pour publier une nouvelle version, remplacez simplement le fichier dans Supabase. Un fichier importé depuis le téléphone reste, lui, sur cet appareil.</div>
    </div>
    <div class="form-group mt-16" id="ebook-link-field" style="${type==='ebook'?'':'display:none'}">
      <label>Lien externe (optionnel — Drive, WeTransfer...)</label>
      <input type="text" id="f-downloadlink" value="${book ? Utils.escapeHtml(book.downloadLink || '') : ''}" placeholder="Lien Google Drive, WeTransfer...">
    </div>
    <div class="tag-row mt-16">
      <button class="btn btn-primary" onclick="Pages.saveBook('${book ? book.id : ''}')">💾 Enregistrer</button>
      ${book ? `<button class="btn btn-danger" onclick="Pages.removeBook('${book.id}')">🗑 Supprimer</button>` : ''}
      <button class="btn btn-outline" onclick="Utils.closeModal()">Annuler</button>
    </div>
  `);

  const bindCoverInput = () => {
    const input = document.getElementById('book-cover-input');
    if (!input) return;
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let b64;
      try { b64 = await Utils.compressImage(file, 700, 0.82); }
      catch (err) { Utils.toast('Photo illisible, essayez une autre image.', 'err'); return; }
      document.getElementById('cover-box').innerHTML = `<img src="${b64}"><input type="file" accept="image/*" id="book-cover-input">`;
      document.getElementById('cover-box').dataset.cover = b64;
      bindCoverInput();
    });
  };
  bindCoverInput();

  [['pdf', 80], ['audio', 150]].forEach(([kind, maxMb]) => {
    const input = document.getElementById('f-' + kind);
    if (!input) return;
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const okType = kind === 'pdf'
        ? (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
        : (file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name));
      if (!okType) {
        Utils.toast(kind === 'pdf' ? 'Choisissez un fichier PDF.' : 'Choisissez un fichier audio.', 'err');
        input.value = '';
        return;
      }
      if (file.size > maxMb * 1048576) {
        alert(`Ce fichier est trop volumineux (${Pages.fmtSize(file.size)}). Maximum : ${maxMb} Mo.`);
        input.value = '';
        return;
      }
      const status = document.getElementById(kind + '-status');
      if (status) status.innerHTML = '<div>⏳ Chargement du fichier…</div>';
      try {
        // On copie tout de suite le contenu en mémoire : sur Android, une référence vers
        // un fichier peut devenir illisible quelques minutes plus tard.
        const buf = await file.arrayBuffer();
        const type = file.type || (kind === 'pdf' ? 'application/pdf' : 'audio/mpeg');
        Pages._pending[kind] = { name: file.name, size: buf.byteLength, type, blob: new Blob([buf], { type }) };
        const pin = document.getElementById('f-' + kind + 'path'); if (pin) pin.value = '';
      } catch (err) {
        console.error(err);
        input.value = '';
        alert("Impossible de lire ce fichier.\n\nSi vous l'avez choisi depuis Google Drive, WhatsApp ou une autre application, téléchargez-le d'abord sur le téléphone (dossier Téléchargements), puis choisissez-le depuis « Fichiers ».");
      }
      Pages.refreshFileStatus(kind);
    });
  });
};

Pages.toggleEbookFields = function (type) {
  document.getElementById('stock-fields').style.display = type === 'ebook' ? 'none' : '';
  document.getElementById('ebook-link-field').style.display = type === 'ebook' ? '' : 'none';
  document.getElementById('ebook-files-field').style.display = type === 'ebook' ? '' : 'none';
};

Pages.saveBook = async function (id) {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { Utils.toast('Le titre est obligatoire.', 'err'); return; }
  const coverBox = document.getElementById('cover-box');
  const coverImg = coverBox.querySelector('img');
  const type = document.getElementById('f-type').value;
  const payload = {
    type,
    title,
    author: document.getElementById('f-author').value.trim(),
    category: document.getElementById('f-category').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    price: Number(document.getElementById('f-price').value) || 0,
    cost: Number(document.getElementById('f-cost').value) || 0,
    stock: type === 'ebook' ? 0 : (Number(document.getElementById('f-stock').value) || 0),
    minAlert: type === 'ebook' ? 0 : (Number(document.getElementById('f-minalert').value) || 0),
    downloadLink: type === 'ebook' ? document.getElementById('f-downloadlink').value.trim() : '',
    filesEnabled: type === 'ebook' ? document.getElementById('f-filesenabled').checked : true,
    cover: coverImg ? coverImg.getAttribute('src') : ''
  };
  const prev = id ? Object.assign({}, DB.getBook(id)) : {};
  const paths = {
    pdf: type === 'ebook' ? document.getElementById('f-pdfpath').value.trim().replace(/^\/+/, '') : '',
    audio: type === 'ebook' ? document.getElementById('f-audiopath').value.trim().replace(/^\/+/, '') : ''
  };
  let book;
  if (id) {
    book = DB.updateBook(id, payload);
  } else {
    payload.sold = 0;
    payload.pdfName = ''; payload.pdfSize = 0; payload.audioName = ''; payload.audioSize = 0;
    payload.pdfSent = 0; payload.audioSent = 0;
    book = DB.addBook(payload);
  }

  // Fichiers PDF / audio (stockés dans IndexedDB), chaque écriture est vérifiée
  if (type === 'ebook' && book) {
    const problems = [];
    for (const kind of ['pdf', 'audio']) {
      const pending = Pages._pending[kind];
      try {
        if (pending && pending.blob) {
          await FileStore.persist();
          await FileStore.putVerified(book.id, kind, pending.blob);
          DB.updateBook(book.id, { [kind + 'Name']: pending.name, [kind + 'Size']: pending.size, [kind + 'Missing']: false, [kind + 'Path']: '' });
        } else if (pending === null) {
          await FileStore.del(book.id, kind);
          DB.updateBook(book.id, { [kind + 'Name']: '', [kind + 'Size']: 0, [kind + 'Missing']: false, [kind + 'Path']: '' });
        } else if (paths[kind]) {
          // Fichier hébergé dans Supabase : téléchargé au moment de l'envoi
          DB.updateBook(book.id, { [kind + 'Path']: paths[kind], [kind + 'Name']: Cloud.basename(paths[kind]), [kind + 'Size']: 0, [kind + 'Missing']: false });
        } else if (prev[kind + 'Path']) {
          // Chemin Supabase retiré : on oublie aussi la copie gardée sur l'appareil
          try { await FileStore.del(book.id, kind); } catch (e2) { /* ignore */ }
          DB.updateBook(book.id, { [kind + 'Path']: '', [kind + 'Name']: '', [kind + 'Size']: 0, [kind + 'Missing']: false });
        }
      } catch (e) {
        console.error(e);
        problems.push((kind === 'pdf' ? 'PDF' : 'Audio') + ' : ' + ((e && e.message) || (e && e.name) || 'erreur inconnue'));
      }
    }
    if (problems.length) {
      alert("Le livre est enregistré, mais un fichier n'a PAS pu être stocké sur l'appareil :\n\n" + problems.join('\n') +
        "\n\nOuvrez la fiche du livre pour le réimporter. Si cela se répète, libérez de l'espace sur le téléphone.");
      Utils.closeModal();
      Router.render();
      return;
    }
  }

  Utils.toast(id ? 'Livre mis à jour ✅' : (type === 'ebook' ? 'E-book ajouté ✅' : 'Livre ajouté ✅'));
  Utils.closeModal();
  Router.render();
};

Pages.removeBook = function (id) {
  if (!confirm('Supprimer définitivement ce livre ?')) return;
  DB.deleteBook(id);
  FileStore.del(id, 'pdf').catch(() => {});
  FileStore.del(id, 'audio').catch(() => {});
  Utils.closeModal();
  Utils.toast('Livre supprimé');
  Router.render();
};

/* ---------------------------------------------------------
   CLIENTS
--------------------------------------------------------- */
Pages.clients = function (query = '') {
  const q = query.trim().toLowerCase();
  let clients = [...DB.data.clients].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (q) clients = clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));

  const listHtml = clients.length ? clients.map(c => {
    const historyCount = DB.clientHistory(c.id).length;
    return `
      <div class="list-item" onclick="Router.go('clients/${c.id}')">
        <div class="avatar">${Utils.escapeHtml(c.name.slice(0,1).toUpperCase())}</div>
        <div class="content">
          <div class="title">${Utils.escapeHtml(c.name)}</div>
          <div class="meta">${Utils.escapeHtml(c.phone || '—')} · ${Utils.escapeHtml(c.city || '—')}</div>
        </div>
        <div class="trail"><span class="badge badge-ok">${historyCount} achat(s)</span></div>
      </div>`;
  }).join('') : `<div class="empty-state"><div class="ic">👥</div><p>Aucun client enregistré. Ajoutez-en un avec le bouton +.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Répertoire</span><h2>Gestion des clients</h2></div>
      <button class="btn btn-primary btn-sm" onclick="Pages.openClientForm()">+ Ajouter un client</button>
    </div>
    <div class="search-bar">
      <span class="ic">🔍</span>
      <input type="text" id="client-search" placeholder="Rechercher un nom ou un téléphone..." value="${Utils.escapeHtml(query)}" oninput="Pages.refreshClients(this.value)">
    </div>
    <div class="list" id="client-list">${listHtml}</div>
  `;
};

Pages.refreshClients = function (q) {
  document.getElementById('client-list').innerHTML = Pages.clients(q).match(/<div class="list" id="client-list">([\s\S]*)<\/div>\s*$/)[1];
};

Pages.openClientForm = function (id) {
  const c = id ? DB.getClient(id) : null;
  Utils.openModal(`
    <div class="modal-header">
      <h3>${c ? 'Modifier le client' : 'Nouveau client'}</h3>
      <button class="modal-close" onclick="Utils.closeModal()">✕</button>
    </div>
    <div class="form-group">
      <label>Nom complet *</label>
      <input type="text" id="f-name" value="${c ? Utils.escapeHtml(c.name) : ''}" placeholder="Nom du client">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Téléphone</label>
        <input type="tel" id="f-phone" value="${c ? Utils.escapeHtml(c.phone || '') : ''}" placeholder="+221 77 000 00 00">
      </div>
      <div class="form-group">
        <label>Ville</label>
        <input type="text" id="f-city" value="${c ? Utils.escapeHtml(c.city || '') : ''}" placeholder="Ville">
      </div>
    </div>
    <div class="form-group">
      <label>Adresse</label>
      <input type="text" id="f-address" value="${c ? Utils.escapeHtml(c.address || '') : ''}" placeholder="Adresse complète">
    </div>
    <div class="form-group">
      <label>Observations</label>
      <textarea id="f-notes" rows="3" placeholder="Notes sur le client">${c ? Utils.escapeHtml(c.notes || '') : ''}</textarea>
    </div>
    <div class="tag-row mt-16">
      <button class="btn btn-primary" onclick="Pages.saveClient('${c ? c.id : ''}')">💾 Enregistrer</button>
      ${c ? `<button class="btn btn-danger" onclick="Pages.removeClient('${c.id}')">🗑 Supprimer</button>` : ''}
      <button class="btn btn-outline" onclick="Utils.closeModal()">Annuler</button>
    </div>
  `);
};

Pages.saveClient = function (id) {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { Utils.toast('Le nom est obligatoire.', 'err'); return; }
  const payload = {
    name,
    phone: document.getElementById('f-phone').value.trim(),
    city: document.getElementById('f-city').value.trim(),
    address: document.getElementById('f-address').value.trim(),
    notes: document.getElementById('f-notes').value.trim()
  };
  if (id) {
    DB.updateClient(id, payload);
    Utils.toast('Client mis à jour ✅');
  } else {
    DB.addClient(payload);
    Utils.toast('Client ajouté ✅');
  }
  Utils.closeModal();
  Router.render();
};

Pages.removeClient = function (id) {
  if (!confirm('Supprimer définitivement ce client ?')) return;
  DB.deleteClient(id);
  Utils.closeModal();
  Utils.toast('Client supprimé');
  Router.render();
};

Pages.clientDetail = function (id) {
  const c = DB.getClient(id);
  if (!c) return `<div class="empty-state"><p>Client introuvable.</p></div>`;
  const history = DB.clientHistory(id);
  const totalSpent = history.reduce((s, sale) => s + Number(sale.paid || 0), 0);

  const historyHtml = history.length ? history.map(s => `
    <div class="list-item" onclick="Router.go('receipt/${s.id}')">
      <div class="avatar">🧾</div>
      <div class="content">
        <div class="title">${Utils.money(s.total)}${s.discount ? ` <span class="gold-text" style="font-size:.72rem">(- ${Utils.money(s.discount)})</span>` : ''}</div>
        <div class="meta">${Utils.dateTimeFmt(s.date)}</div>
      </div>
      <div class="trail">${Utils.statusBadge(s.status)}</div>
    </div>`).join('') : `<div class="empty-state"><div class="ic">🧾</div><p>Aucun achat pour ce client.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Fiche client</span><h2>${Utils.escapeHtml(c.name)}</h2></div>
      <button class="btn btn-outline btn-sm" onclick="Pages.openClientForm('${c.id}')">✏️ Modifier</button>
    </div>
    <div class="card mb-8">
      <div class="stock-row"><span class="text-muted">📞 Téléphone</span><strong>${Utils.escapeHtml(c.phone || '—')}</strong></div>
      <div class="stock-row"><span class="text-muted">📍 Ville</span><strong>${Utils.escapeHtml(c.city || '—')}</strong></div>
      <div class="stock-row"><span class="text-muted">🏠 Adresse</span><strong>${Utils.escapeHtml(c.address || '—')}</strong></div>
      <div class="stock-row"><span class="text-muted">💰 Total dépensé</span><strong class="gold-text">${Utils.money(totalSpent)}</strong></div>
      ${c.notes ? `<div class="mt-8 text-muted" style="font-size:.82rem">📝 ${Utils.escapeHtml(c.notes)}</div>` : ''}
    </div>
    <div class="section-block">
      <h3>📜 Historique des achats</h3>
      <div class="list">${historyHtml}</div>
    </div>
    <button class="btn btn-primary btn-block mt-16" onclick="Router.go('sales/new?client=${c.id}')">+ Nouvelle vente pour ce client</button>
  `;
};


// Saisie d'un chemin Supabase : il remplace un éventuel fichier choisi sur le téléphone
Pages.onPathInput = function (kind) {
  const v = (document.getElementById('f-' + kind + 'path').value || '').trim();
  const status = document.getElementById(kind + '-status');
  if (v) {
    Pages._pending[kind] = undefined;
    const fi = document.getElementById('f-' + kind);
    if (fi) fi.value = '';
    if (status) status.innerHTML = `<div>☁️ Supabase : <strong>${Utils.escapeHtml(v)}</strong></div><div class="text-muted" style="font-size:.72rem">Sera enregistré en appuyant sur « Enregistrer »</div>`;
  } else {
    Pages.refreshFileStatus(kind);
  }
};

Pages.testPath = async function (kind) {
  const v = (document.getElementById('f-' + kind + 'path').value || '').trim();
  if (!v) { Utils.toast("Saisissez d'abord le chemin du fichier.", 'err'); return; }
  Utils.toast('Test en cours…');
  try {
    const r = await Cloud.check(v);
    alert('✅ Fichier trouvé dans Supabase' + (r.via === 'authenticated' ? ' (bucket privé, accès par la clé)' : ' (accès public)') +
      '\n\n' + v + (r.size ? '\nTaille : ' + Pages.fmtSize(r.size) : ''));
  } catch (e) {
    alert('❌ ' + e.message);
  }
};
