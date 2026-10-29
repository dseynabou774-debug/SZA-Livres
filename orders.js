/* =========================================================
   orders.js — Commandes clients : qui a commandé, qui n'a
   pas encore reçu son livre. Données dans DB.data.orders
   (sauvegardées et exportées avec le reste de l'application).
   ========================================================= */

const Orders = { filter: 'pending' };

Orders.all = function () {
  DB.data.orders = DB.data.orders || [];
  return DB.data.orders;
};

Orders.get = function (id) {
  return Orders.all().find(o => o.id === id);
};

Orders.nextId = function () {
  const n = DB.data.seq.order || 1;
  DB.data.seq.order = n + 1;
  return 'O' + String(n).padStart(4, '0');
};

Orders.pendingCount = function () {
  return Orders.all().filter(o => o.status !== 'delivered').length;
};

Orders.setFilter = function (f) {
  Orders.filter = f;
  Router.render();
};

/* ---------- Liste ---------- */
Pages.orders = function () {
  const all = Orders.all();
  const pending = all.filter(o => o.status !== 'delivered');
  const delivered = all.filter(o => o.status === 'delivered');
  let rows = Orders.filter === 'delivered' ? delivered : Orders.filter === 'all' ? all : pending;
  rows = [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const chip = (key, label, n) =>
    `<span class="chip ${Orders.filter === key ? 'active' : ''}" onclick="Orders.setFilter('${key}')">${label} (${n})</span>`;

  const list = rows.length ? rows.map(o => {
    const total = (Number(o.qty) || 1) * (Number(o.price) || 0);
    const rest = Math.max(0, total - (Number(o.paid) || 0));
    const isDone = o.status === 'delivered';
    return `
      <div class="list-item" style="flex-wrap:wrap" onclick="Orders.openForm('${o.id}')">
        <div class="avatar">📦</div>
        <div class="content">
          <div class="title">${Utils.escapeHtml(o.name)}</div>
          <div class="meta">${Number(o.qty) || 1} × ${Utils.escapeHtml(o.title)} · ${Utils.dateFmt(o.date)}</div>
          <div class="meta">${Utils.money(total)}${rest > 0 ? ` · reste ${Utils.money(rest)}` : ' · payé'}</div>
          ${o.notes ? `<div class="meta">📝 ${Utils.escapeHtml(o.notes)}</div>` : ''}
        </div>
        <div class="trail"><span class="badge ${isDone ? 'badge-ok' : 'badge-warn'}">${isDone ? 'Livré' : 'À livrer'}</span></div>
        <div class="tag-row" style="width:100%;margin-top:8px">
          ${o.phone ? `<button class="btn btn-gold btn-sm" onclick="event.stopPropagation();Orders.whatsapp('${o.id}')">💬 WhatsApp</button>` : ''}
          ${o.saleId
            ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Router.go('receipt/${o.saleId}')">🧾 Voir le reçu</button>`
            : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Orders.toSale('${o.id}')">🧾 Créer la vente</button>`}
          ${isDone
            ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Orders.setStatus('${o.id}','pending')">↩ Remettre à livrer</button>`
            : `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Orders.setStatus('${o.id}','delivered')">✅ Marquer livré</button>`}
        </div>
      </div>`;
  }).join('') : `<div class="empty-state"><div class="ic">📦</div><p>${
    Orders.filter === 'pending' ? 'Aucune commande en attente. Tout a été livré 🎉' : 'Aucune commande ici. Ajoutez-en une avec le bouton +.'
  }</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Suivi</span><h2>Commandes</h2></div>
      <button class="btn btn-primary btn-sm" onclick="Orders.openForm()">+ Nouvelle commande</button>
    </div>
    <div class="tag-row" style="margin-bottom:12px">
      ${chip('pending', 'À livrer', pending.length)}
      ${chip('delivered', 'Livrées', delivered.length)}
      ${chip('all', 'Toutes', all.length)}
    </div>
    <div class="list">${list}</div>
  `;
};

/* ---------- Formulaire ---------- */
Orders.openForm = function (id) {
  const o = id ? Orders.get(id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const clientOpts = DB.data.clients.map(c => `<option value="${Utils.escapeHtml(c.name)}"></option>`).join('');
  const bookOpts = DB.data.books.map(b => `<option value="${Utils.escapeHtml(b.title)}"></option>`).join('');
  Utils.openModal(`
    <div class="modal-header">
      <h3>${o ? 'Modifier la commande' : 'Nouvelle commande'}</h3>
      <button class="modal-close" onclick="Utils.closeModal()">✕</button>
    </div>
    ${o ? '' : `<button class="btn btn-outline btn-block mb-8" onclick="Pages.pickContact()">📇 Choisir depuis mes contacts</button>`}
    <div class="form-group">
      <label>Nom du client *</label>
      <input type="text" id="f-name" list="o-clients" value="${o ? Utils.escapeHtml(o.name) : ''}" placeholder="Nom du client" oninput="Orders.onNameInput()">
      <datalist id="o-clients">${clientOpts}</datalist>
    </div>
    <div class="form-group">
      <label>Téléphone</label>
      <input type="tel" id="f-phone" value="${o ? Utils.escapeHtml(o.phone || '') : ''}" placeholder="+221 77 000 00 00">
    </div>
    <div class="form-group">
      <label>Livre commandé *</label>
      <input type="text" id="o-title" list="o-books" value="${o ? Utils.escapeHtml(o.title) : ''}" placeholder="Titre du livre" oninput="Orders.onTitleInput()">
      <datalist id="o-books">${bookOpts}</datalist>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Quantité</label>
        <input type="number" id="o-qty" min="1" value="${o ? (Number(o.qty) || 1) : 1}" oninput="Orders.updateTotal()">
      </div>
      <div class="form-group">
        <label>Prix unitaire (FCFA)</label>
        <input type="number" id="o-price" min="0" value="${o ? (Number(o.price) || 0) : ''}" oninput="Orders.updateTotal()">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Déjà payé (avance)</label>
        <input type="number" id="o-paid" min="0" value="${o ? (Number(o.paid) || 0) : 0}" oninput="Orders.updateTotal()">
      </div>
      <div class="form-group">
        <label>Date de commande</label>
        <input type="date" id="o-date" value="${o ? (o.date || today).slice(0, 10) : today}">
      </div>
    </div>
    <div class="meta" id="o-total" style="margin-bottom:10px;font-weight:600"></div>
    <div class="form-group">
      <label>Remarque</label>
      <textarea id="o-notes" rows="2" placeholder="Ex. : livraison à Mbour, paiement Wave…">${o ? Utils.escapeHtml(o.notes || '') : ''}</textarea>
    </div>
    <div class="tag-row mt-16">
      <button class="btn btn-primary" onclick="Orders.save('${o ? o.id : ''}')">💾 Enregistrer</button>
      ${o ? `<button class="btn btn-danger" onclick="Orders.remove('${o.id}')">🗑 Supprimer</button>` : ''}
      <button class="btn btn-outline" onclick="Utils.closeModal()">Annuler</button>
    </div>
  `);
  Orders.updateTotal();
};

// Client déjà enregistré : remplit son téléphone
Orders.onNameInput = function () {
  const name = document.getElementById('f-name').value.trim().toLowerCase();
  const c = DB.data.clients.find(x => x.name.trim().toLowerCase() === name);
  const phone = document.getElementById('f-phone');
  if (c && c.phone && !phone.value) phone.value = c.phone;
};

// Livre déjà enregistré : remplit son prix
Orders.onTitleInput = function () {
  const t = document.getElementById('o-title').value.trim().toLowerCase();
  const b = DB.data.books.find(x => x.title.trim().toLowerCase() === t);
  const price = document.getElementById('o-price');
  if (b && !Number(price.value)) { price.value = b.price || 0; Orders.updateTotal(); }
};

Orders.updateTotal = function () {
  const el = document.getElementById('o-total');
  if (!el) return;
  const total = (Number(document.getElementById('o-qty').value) || 1) * (Number(document.getElementById('o-price').value) || 0);
  const paid = Number(document.getElementById('o-paid').value) || 0;
  el.textContent = 'Total : ' + Utils.money(total) + ' · Reste à payer : ' + Utils.money(Math.max(0, total - paid));
};

Orders.save = function (id) {
  const name = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const title = document.getElementById('o-title').value.trim();
  if (!name) { Utils.toast('Le nom du client est obligatoire.', 'err'); return; }
  if (!title) { Utils.toast('Indiquez le livre commandé.', 'err'); return; }
  const payload = {
    name, phone, title,
    qty: Math.max(1, Number(document.getElementById('o-qty').value) || 1),
    price: Number(document.getElementById('o-price').value) || 0,
    paid: Number(document.getElementById('o-paid').value) || 0,
    date: document.getElementById('o-date').value || new Date().toISOString().slice(0, 10),
    notes: document.getElementById('o-notes').value.trim()
  };
  if (id) {
    Object.assign(Orders.get(id), payload);
    Utils.toast('Commande mise à jour ✅');
  } else {
    payload.id = Orders.nextId();
    payload.status = 'pending';
    payload.createdAt = new Date().toISOString();
    Orders.all().push(payload);
    // Enregistre aussi le client s'il n'existe pas encore
    const known = DB.data.clients.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (!known) DB.addClient({ name, phone, city: '', address: '', notes: '' });
    Utils.toast('Commande enregistrée ✅');
  }
  DB.save();
  Utils.closeModal();
  Orders.filter = 'pending';
  Router.render();
};

Orders.setStatus = function (id, status) {
  const o = Orders.get(id);
  if (!o) return;
  o.status = status;
  o.deliveredAt = status === 'delivered' ? new Date().toISOString() : '';
  DB.save();
  Utils.toast(status === 'delivered' ? 'Marquée comme livrée ✅' : 'Remise dans « À livrer »');
  Router.render();
};

Orders.remove = function (id) {
  if (!confirm('Supprimer définitivement cette commande ?')) return;
  DB.data.orders = Orders.all().filter(o => o.id !== id);
  DB.save();
  Utils.closeModal();
  Utils.toast('Commande supprimée');
  Router.render();
};

Orders.whatsapp = function (id) {
  const o = Orders.get(id);
  if (!o || !o.phone) { Utils.toast('Pas de numéro de téléphone.', 'err'); return; }
  const text = 'Assalamou alaykoum ' + o.name + ', concernant votre commande de « ' + o.title + ' », ';
  window.open('https://wa.me/' + Pages.waNumber(o.phone) + '?text=' + encodeURIComponent(text), '_blank');
};


/* ---------- Commande -> vente avec reçu ---------- */
Orders.toSale = function (id) {
  const o = Orders.get(id);
  if (!o) return;
  const norm = s => String(s || '').trim().toLowerCase();

  // Client : retrouvé par son nom, sinon créé
  let client = DB.data.clients.find(c => norm(c.name) === norm(o.name));
  if (!client) client = DB.addClient({ name: o.name, phone: o.phone || '', city: '', address: '', notes: '' });

  // Livre : retrouvé par son titre
  const book = DB.data.books.find(b => norm(b.title) === norm(o.title));
  const qty = Math.max(1, Number(o.qty) || 1);
  const price = Number(o.price) || (book ? Number(book.price) || 0 : 0);
  const total = qty * price;
  const paid = Math.min(Number(o.paid) || 0, total);

  Pages.saleDraft = {
    clientId: client.id,
    items: book ? [{ bookId: book.id, title: book.title, price, qty, isEbook: DB.isEbook(book) }] : [],
    discount: 0,
    paid,
    paymentStatus: (total > 0 && paid >= total) ? 'Payé' : (paid > 0 ? 'Partiel' : 'En attente'),
    method: 'Espèces',
    date: new Date().toISOString().slice(0, 16),
    orderId: o.id
  };
  if (!book) Utils.toast('Livre introuvable dans vos livres : ajoutez-le à la vente.', 'warn');
  Router.go('sales/new?client=' + client.id);
};

// Appelé quand la vente est enregistrée : la commande passe en « livrée »
Orders.linkSale = function (orderId, saleId) {
  const o = Orders.get(orderId);
  if (!o) return;
  o.saleId = saleId;
  o.status = 'delivered';
  o.deliveredAt = new Date().toISOString();
  DB.save();
};
