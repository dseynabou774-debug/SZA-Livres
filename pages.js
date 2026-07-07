/* =========================================================
   pages.js — Rendu des pages de l'application
   ========================================================= */

const Pages = {};

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
Pages.dashboard = function () {
  const t = DB.totals();
  const best = DB.bestSellers(5);
  const lowStock = DB.data.books.filter(b => DB.bookStatus(b) !== 'disponible');

  let alertHtml = '';
  if (lowStock.length) {
    alertHtml = `<div class="alert-banner">⚠️ ${lowStock.length} livre(s) proche(s) de la rupture ou en rupture de stock.</div>`;
  }

  const bestHtml = best.length ? best.map(b => `
    <div class="list-item">
      <div class="avatar">${Utils.escapeHtml(b.title.slice(0,1).toUpperCase())}</div>
      <div class="content">
        <div class="title">${Utils.escapeHtml(b.title)}</div>
        <div class="meta">${b.sold || 0} vendu(s) · ${Utils.money(b.price)}</div>
      </div>
    </div>`).join('') : `<div class="empty-state"><div class="ic">📈</div><p>Aucune vente enregistrée pour le moment.</p></div>`;

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
      <div class="stat-card"><span class="ic">⏳</span><div class="label">En attente</div><div class="value">${t.pending}</div></div>
    </div>
    <div class="section-block">
      <h3>🏆 Livres les plus vendus</h3>
      <div class="list">${bestHtml}</div>
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
Pages.books = function (query = '') {
  const q = query.trim().toLowerCase();
  let books = [...DB.data.books].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (q) books = books.filter(b => b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q));

  const cardsHtml = books.length ? books.map(b => {
    const status = DB.bookStatus(b);
    const badge = status === 'rupture' ? '<span class="badge badge-danger">Rupture</span>'
      : status === 'alerte' ? '<span class="badge badge-warn">Stock faible</span>'
      : '<span class="badge badge-ok">Disponible</span>';
    const cover = b.cover
      ? `<img class="book-cover" src="${b.cover}" alt="${Utils.escapeHtml(b.title)}">`
      : `<div class="book-cover">📘</div>`;
    return `
      <div class="book-card" onclick="Pages.openBookForm('${b.id}')">
        ${cover}
        <div class="book-info">
          <div class="title">${Utils.escapeHtml(b.title)}</div>
          <div class="author">${Utils.escapeHtml(b.author || '—')}</div>
          <div class="stock-row"><span class="price">${Utils.money(b.price)}</span>${badge}</div>
          <div class="mt-8 text-muted" style="font-size:.72rem">Stock : ${b.stock}</div>
        </div>
      </div>`;
  }).join('') : `<div class="empty-state"><div class="ic">📚</div><p>Aucun livre trouvé. Ajoutez votre premier livre avec le bouton +.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Catalogue</span><h2>Gestion des livres</h2></div>
      <button class="btn btn-primary btn-sm" onclick="Pages.openBookForm()">+ Ajouter un livre</button>
    </div>
    <div class="search-bar">
      <span class="ic">🔍</span>
      <input type="text" id="book-search" placeholder="Rechercher un titre ou un auteur..." value="${Utils.escapeHtml(query)}" oninput="App.setPageState({bookQuery:this.value}); Pages.refreshBooks(this.value)">
    </div>
    <div class="book-grid" id="book-grid">${cardsHtml}</div>
  `;
};

Pages.refreshBooks = function (q) {
  document.getElementById('book-grid').outerHTML = Pages.books(q).match(/<div class="book-grid"[\s\S]*<\/div>\s*$/)[0];
};

Pages.openBookForm = function (id) {
  const book = id ? DB.getBook(id) : null;
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
        <label>Coût d'impression (${DB.data.settings.currency})</label>
        <input type="number" id="f-cost" value="${book ? book.cost : ''}" min="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Quantité en stock</label>
        <input type="number" id="f-stock" value="${book ? book.stock : ''}" min="0">
      </div>
      <div class="form-group">
        <label>Seuil d'alerte minimum</label>
        <input type="number" id="f-minalert" value="${book ? book.minAlert : 3}" min="0">
      </div>
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
};

Pages.saveBook = function (id) {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { Utils.toast('Le titre est obligatoire.', 'err'); return; }
  const coverBox = document.getElementById('cover-box');
  const coverImg = coverBox.querySelector('img');
  const payload = {
    title,
    author: document.getElementById('f-author').value.trim(),
    category: document.getElementById('f-category').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    price: Number(document.getElementById('f-price').value) || 0,
    cost: Number(document.getElementById('f-cost').value) || 0,
    stock: Number(document.getElementById('f-stock').value) || 0,
    minAlert: Number(document.getElementById('f-minalert').value) || 0,
    cover: coverImg ? coverImg.getAttribute('src') : ''
  };
  if (id) {
    DB.updateBook(id, payload);
    Utils.toast('Livre mis à jour ✅');
  } else {
    payload.sold = 0;
    DB.addBook(payload);
    Utils.toast('Livre ajouté ✅');
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
        <div class="title">${Utils.money(s.total)}</div>
        <div class="meta">${Utils.dateTimeFmt(s.date)}</div>
      </div>
      <div class="trail">${s.status === 'Payé' ? '<span class="badge badge-ok">Payé</span>' : '<span class="badge badge-warn">En attente</span>'}</div>
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
