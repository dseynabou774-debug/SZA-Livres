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

Pages.openBookForm = function (id) {
  const book = id ? DB.getBook(id) : null;
  const type = book ? (book.type || 'papier') : 'papier';
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
    <div class="form-group" id="ebook-link-field" style="${type==='ebook'?'':'display:none'}">
      <label>Fichier PDF de l'e-book</label>
      <input type="file" id="f-ebookfile" accept="application/pdf">
      <div class="tag-row mt-8">
        <label style="display:flex;align-items:center;gap:6px;font-weight:600;">
          <input type="checkbox" id="f-ebookactive" checked>
          Téléchargement activé
        </label>
      </div>
      <div class="text-muted mt-8" id="ebook-status-box"></div>
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
      const b64 = await Utils.fileToBase64(file);
      document.getElementById('cover-box').innerHTML = `<img src="${b64}"><input type="file" accept="image/*" id="book-cover-input">`;
      document.getElementById('cover-box').dataset.cover = b64;
      bindCoverInput();
    });
  };
  bindCoverInput();
  if (book && book.type === 'ebook') {
    Ebooks.getInfo(book.id).then(info => {
      const box = document.getElementById('ebook-status-box');
      if (!box) return;
      if (!info) { box.textContent = 'Pas encore synchronisé.'; return; }
      document.getElementById('f-ebookactive').checked = info.active;
      box.innerHTML = `📦 Version ${info.version} · 📥 ${info.download_count} téléchargement(s) · ${info.storage_path ? '✅ Fichier en ligne' : '⚠️ Aucun fichier'}`;
    });
  }
};

Pages.toggleEbookFields = function (type) {
  document.getElementById('stock-fields').style.display = type === 'ebook' ? 'none' : '';
  document.getElementById('ebook-link-field').style.display = type === 'ebook' ? '' : 'none';
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
    cover: coverImg ? coverImg.getAttribute('src') : ''
  };
  let savedBook;
  if (id) {
    savedBook = DB.updateBook(id, payload);
    Utils.toast('Livre mis à jour ✅');
  } else {
    payload.sold = 0;
    savedBook = DB.addBook(payload);
    Utils.toast(type === 'ebook' ? 'E-book ajouté ✅' : 'Livre ajouté ✅');
  }
  if (type === 'ebook' && savedBook) {
    const active = document.getElementById('f-ebookactive').checked;
    // --- BLOC DE DIAGNOSTIC AJOUTÉ ---
    // On entoure les appels réseau d'un try/catch pour que toute erreur
    // (réseau, exception JS, promesse rejetée) s'affiche clairement
    // via une alerte bloquante, au lieu de disparaître silencieusement.
    try {
      alert('Étape 1 : début synchro e-book pour ' + savedBook.id);
      await Ebooks.syncBook(savedBook.id, title, active);
      alert('Étape 2 : synchro terminée. Vérification du fichier...');
      const fileInput = document.getElementById('f-ebookfile');
      if (fileInput && fileInput.files[0]) {
        alert('Étape 3 : fichier détecté (' + fileInput.files[0].name + ', ' + fileInput.files[0].size + ' octets). Envoi en cours...');
        await Ebooks.uploadFile(savedBook.id, fileInput.files[0]);
        alert('Étape 4 : uploadFile terminé sans exception.');
      } else {
        alert('Étape 3 (info) : aucun fichier détecté dans le champ PDF.');
      }
    } catch (e) {
      alert('❌ ERREUR CAPTURÉE : ' + (e && e.message ? e.message : JSON.stringify(e)));
    }
    // --- FIN DU BLOC DE DIAGNOSTIC ---
  }
  Utils.closeModal();
  Router.render();
};

Pages.removeBook = function (id) {
  if (!confirm('Supprimer définitivement ce livre ?')) return;
  DB.deleteBook(id);
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
