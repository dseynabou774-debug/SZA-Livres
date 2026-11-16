/* =========================================================
   pages2.js — Ventes, Reçus, Rapports, Recherche, Sauvegarde, Réglages
   ========================================================= */

/* ---------------------------------------------------------
   SALES — list
--------------------------------------------------------- */
Pages.sales = function () {
  const sales = [...DB.data.sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  const listHtml = sales.length ? sales.map(s => {
    const client = DB.getClient(s.clientId);
    return `
      <div class="list-item" onclick="Router.go('receipt/${s.id}')">
        <div class="avatar">${client ? Utils.escapeHtml(client.name.slice(0,1).toUpperCase()) : '🧾'}</div>
        <div class="content">
          <div class="title">${client ? Utils.escapeHtml(client.name) : 'Client supprimé'}</div>
          <div class="meta">${Utils.dateTimeFmt(s.date)} · ${Utils.money(s.total)}${s.discount ? ` <span class="gold-text">(- ${Utils.money(s.discount)})</span>` : ''}</div>
        </div>
        <div class="trail">${Utils.statusBadge(s.status)}${Pages.cashButton(s)}<button class="icon-btn" title="Supprimer" style="background:transparent;color:var(--danger);width:32px;height:32px" onclick="event.stopPropagation(); Pages.removeSale('${s.id}')">🗑</button></div>
      </div>`;
  }).join('') : `<div class="empty-state"><div class="ic">🧾</div><p>Aucune vente enregistrée. Créez votre première vente avec le bouton +.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Transactions</span><h2>Gestion des ventes</h2></div>
      <button class="btn btn-primary btn-sm" onclick="Router.go('sales/new')">+ Nouvelle vente</button>
    </div>
    <div class="list">${listHtml}</div>
  `;
};

/* ---------------------------------------------------------
   SALES — new sale wizard
--------------------------------------------------------- */
Pages.saleDraft = null;

Pages.saleNew = function (presetClientId) {
  if (!Pages.saleDraft) {
    Pages.saleDraft = { clientId: presetClientId || '', items: [], discount: 0, paid: 0, paymentStatus: 'Payé', method: 'Espèces', date: new Date().toISOString().slice(0, 16) };
  }
  const d = Pages.saleDraft;
  const clients = DB.data.clients;
  // Physical books only show up while in stock; e-books are always available (unlimited stock)
  const books = DB.data.books.filter(b => b.type === 'ebook' || b.stock > 0);

  const clientOptions = clients.map(c => `<option value="${c.id}" ${d.clientId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)} (${Utils.escapeHtml(c.phone||'')})</option>`).join('');

  const subtotal = d.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.min(Number(d.discount || 0), subtotal);
  const total = Math.max(0, subtotal - discount);
  const remaining = Math.max(0, total - Number(d.paid || 0));

  const itemsHtml = d.items.length ? d.items.map((it, idx) => `
    <div class="sale-line">
      <div class="name">${Utils.escapeHtml(it.title)}${it.isEbook ? ' <span class="badge badge-ok" style="font-size:.6rem">E-book</span>' : ''}</div>
      <input type="number" min="1" value="${it.qty}" onchange="Pages.updateSaleQty(${idx}, this.value)">
      <div>${Utils.money(it.qty * it.price)}</div>
      <button class="icon-btn" style="background:transparent;color:var(--danger)" onclick="Pages.removeSaleItem(${idx})">✕</button>
    </div>`).join('') : `<div class="text-muted" style="font-size:.85rem">Aucun livre sélectionné.</div>`;

  const bookPicker = books.map(b => `<option value="${b.id}">${Utils.escapeHtml(b.title)} ${b.type==='ebook'?'💻':'📄'} — ${Utils.money(b.price)} (${b.type==='ebook' ? 'illimité' : 'stock: '+b.stock})</option>`).join('');

  return `
    <div class="page-title">
      <div><span class="eyebrow">Nouvelle transaction</span><h2>Créer une vente</h2></div>
      <button class="btn btn-outline btn-sm" onclick="Pages.saleDraft=null; Router.go('sales')">Annuler</button>
    </div>

    <div class="card mb-8">
      <div class="form-group">
        <label>Client *</label>
        <select id="sale-client" onchange="Pages.saleDraft.clientId=this.value">
          <option value="">— Sélectionner un client —</option>
          ${clientOptions}
        </select>
      </div>
      <button class="btn btn-outline btn-sm" onclick="Pages.quickAddClient()">+ Nouveau client rapide</button>
    </div>

    <div class="card mb-8">
      <div class="form-group">
        <label>Ajouter un livre ou e-book</label>
        <select id="sale-book-picker">
          <option value="">— Choisir un article —</option>
          ${bookPicker}
        </select>
      </div>
      <button class="btn btn-primary btn-sm" onclick="Pages.addSaleItem()">+ Ajouter à la vente</button>
      <div class="mt-16" id="sale-items">${itemsHtml}</div>
    </div>

    <div class="card mb-8">
      <div class="form-group">
        <label>Réduction (${DB.data.settings.currency})</label>
        <input type="number" id="sale-discount" min="0" value="${d.discount}" oninput="Pages.saleDraft.discount=Number(this.value)||0; Pages.refreshSaleTotals()">
      </div>
      <div class="form-group">
        <label>Statut de paiement *</label>
        <div class="tag-row">
          <span class="chip ${d.paymentStatus==='Payé'?'active':''}" onclick="Pages.setPaymentStatus('Payé')">✅ Payé en totalité</span>
          <span class="chip ${d.paymentStatus==='Partiel'?'active':''}" onclick="Pages.setPaymentStatus('Partiel')">🟡 Paiement partiel</span>
          <span class="chip ${d.paymentStatus==='En attente'?'active':''}" onclick="Pages.setPaymentStatus('En attente')">⏳ En attente</span>
        </div>
      </div>
      <div class="form-group" id="partial-paid-field" style="${d.paymentStatus==='Partiel' ? '' : 'display:none'}">
        <label>Montant payé (${DB.data.settings.currency})</label>
        <input type="number" id="sale-paid" min="0" value="${d.paid}" oninput="Pages.saleDraft.paid=Number(this.value)||0; Pages.refreshSaleTotals()">
      </div>
      <div class="form-group">
        <label>Mode de paiement</label>
        <select id="sale-method" onchange="Pages.saleDraft.method=this.value">
          ${['Espèces','Orange Money','Wave','Virement'].map(m=>`<option ${d.method===m?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="form-group mt-16">
        <label>Date et heure</label>
        <input type="datetime-local" id="sale-date" value="${d.date}" onchange="Pages.saleDraft.date=this.value">
      </div>
      <div class="total-box" id="sale-totals">
        ${Pages.saleTotalsHtml(subtotal, discount, total, d.paid, remaining, d.paymentStatus)}
      </div>
    </div>

    <button class="btn btn-primary btn-block" onclick="Pages.confirmSale()">✅ Enregistrer la vente</button>
  `;
};

Pages.setPaymentStatus = function (status) {
  const d = Pages.saleDraft;
  const subtotal = d.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.min(Number(d.discount || 0), subtotal);
  const total = Math.max(0, subtotal - discount);
  d.paymentStatus = status;
  if (status === 'Payé') d.paid = total;
  else if (status === 'En attente') d.paid = 0;
  else if (status === 'Partiel' && d.paid >= total) d.paid = 0; // let the user type a partial amount
  Router.render();
};

Pages.saleTotalsHtml = function (subtotal, discount, total, paid, remaining, status) {
  return `
    <div class="row"><span>Sous-total</span><span>${Utils.money(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span>Réduction</span><span>- ${Utils.money(discount)}</span></div>` : ''}
    <div class="row"><span>Total à payer</span><span>${Utils.money(total)}</span></div>
    <div class="row"><span>Payé</span><span>${Utils.money(paid)}</span></div>
    <div class="row grand"><span>Reste à payer</span><span>${Utils.money(remaining)}</span></div>
    ${status ? `<div class="row mt-8"><span>Statut</span><span>${status === 'Payé' ? '✅ Payé en totalité' : status === 'Partiel' ? '🟡 Paiement partiel' : '⏳ En attente'}</span></div>` : ''}
  `;
};

Pages.addSaleItem = function () {
  const sel = document.getElementById('sale-book-picker');
  const bookId = sel.value;
  if (!bookId) return;
  const book = DB.getBook(bookId);
  const existing = Pages.saleDraft.items.find(i => i.bookId === bookId);
  if (existing) { existing.qty += 1; }
  else { Pages.saleDraft.items.push({ bookId, title: book.title, price: book.price, qty: 1, isEbook: DB.isEbook(book) }); }
  Router.render();
};

Pages.updateSaleQty = function (idx, val) {
  const q = Math.max(1, Number(val) || 1);
  Pages.saleDraft.items[idx].qty = q;
  Router.render();
};

Pages.removeSaleItem = function (idx) {
  Pages.saleDraft.items.splice(idx, 1);
  Router.render();
};

Pages.refreshSaleTotals = function () {
  const d = Pages.saleDraft;
  const subtotal = d.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.min(Number(d.discount || 0), subtotal);
  const total = Math.max(0, subtotal - discount);
  const remaining = Math.max(0, total - Number(d.paid || 0));
  document.getElementById('sale-totals').innerHTML = Pages.saleTotalsHtml(subtotal, discount, total, d.paid, remaining, d.paymentStatus);
};

Pages.quickAddClient = function () {
  Utils.openModal(`
    <div class="modal-header"><h3>Nouveau client rapide</h3><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
    <div class="form-group"><label>Nom complet *</label><input type="text" id="qc-name" placeholder="Nom du client"></div>
    <div class="form-group"><label>Téléphone</label><input type="tel" id="qc-phone" placeholder="+221 77 000 00 00"></div>
    <div class="form-group"><label>Ville</label><input type="text" id="qc-city" placeholder="Ville"></div>
    <button class="btn btn-primary btn-block" onclick="Pages.saveQuickClient()">💾 Enregistrer</button>
  `);
};

Pages.saveQuickClient = function () {
  const name = document.getElementById('qc-name').value.trim();
  if (!name) { Utils.toast('Le nom est obligatoire.', 'err'); return; }
  const c = DB.addClient({ name, phone: document.getElementById('qc-phone').value.trim(), city: document.getElementById('qc-city').value.trim(), address: '', notes: '' });
  Pages.saleDraft.clientId = c.id;
  Utils.closeModal();
  Utils.toast('Client ajouté ✅');
  Router.render();
};

Pages.confirmSale = function () {
  const d = Pages.saleDraft;
  if (!d.clientId) { Utils.toast('Veuillez sélectionner un client.', 'err'); return; }
  if (!d.items.length) { Utils.toast('Ajoutez au moins un livre.', 'err'); return; }
  const subtotal = d.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.min(Number(d.discount || 0), subtotal);
  const total = Math.max(0, subtotal - discount);

  let paid;
  if (d.paymentStatus === 'Payé') paid = total;
  else if (d.paymentStatus === 'En attente') paid = 0;
  else paid = Math.min(Math.max(0, Number(d.paid || 0)), total); // Partiel

  // Safety net: keep the status consistent with the actual amount paid,
  // even if the paid amount was edited after choosing "Paiement partiel".
  let status = d.paymentStatus;
  if (status === 'Partiel') {
    if (paid <= 0) status = 'En attente';
    else if (paid >= total && total > 0) status = 'Payé';
  }

  const remaining = Math.max(0, total - paid);
  const sale = {
    clientId: d.clientId,
    items: d.items.map(it => ({ bookId: it.bookId, title: it.title, price: it.price, qty: it.qty, isEbook: !!it.isEbook })),
    subtotal, discount, total, paid, remaining,
    method: d.method,
    date: new Date(d.date).toISOString(),
    status
  };
  const saved = DB.addSale(sale);
  Pages.saleDraft = null;
  Utils.toast('Vente enregistrée ✅');
  Router.go('receipt/' + saved.id);
};

/* ---------------------------------------------------------
   RECEIPT
--------------------------------------------------------- */
Pages.receipt = function (id) {
  const s = DB.getSale(id);
  if (!s) return `<div class="empty-state"><p>Reçu introuvable.</p></div>`;
  const client = DB.getClient(s.clientId);
  const set = DB.data.settings;
  const subtotal = s.subtotal != null ? s.subtotal : s.items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const discount = Number(s.discount || 0);

  const rowsHtml = s.items.map(it => `
    <tr><td>${Utils.escapeHtml(it.title)}${it.isEbook ? ' <span class="badge badge-ok" style="font-size:.6rem">E-book</span>' : ''}</td><td>${it.qty}</td><td>${Utils.money(it.price)}</td><td>${Utils.money(it.price*it.qty)}</td></tr>
  `).join('');

  const payRows = (s.payments || []).map(p => `<div class="stock-row" style="font-size:.78rem"><span class="text-muted">${Utils.dateFmt(p.at)} · ${Utils.escapeHtml(p.method || '')}</span><strong>${Utils.money(p.amount)}</strong></div>`).join('');
  const ebookLinks = s.items.filter(it => it.isEbook).map(it => {
    const book = DB.getBook(it.bookId);
    return (book && book.downloadLink) ? `<div class="stock-row"><span class="text-muted">📎 ${Utils.escapeHtml(it.title)}</span><a href="${Utils.escapeHtml(book.downloadLink)}" target="_blank" style="color:var(--emerald-700);font-weight:700;font-size:.8rem">Lien de téléchargement</a></div>` : '';
  }).join('');

  const low = DB.data.books.filter(b => (s.items||[]).some(it=>it.bookId===b.id) && DB.bookStatus(b)!=='disponible');
  const alertHtml = low.length ? `<div class="alert-banner mt-8">⚠️ Attention : ${low.map(b=>Utils.escapeHtml(b.title)).join(', ')} — ce livre est presque en rupture de stock.</div>` : '';

  return `
    <div class="page-title">
      <div><span class="eyebrow">Reçu de vente</span><h2>Reçu N° ${s.id}</h2></div>
      <button class="btn btn-outline btn-sm" onclick="Router.go('sales')">← Retour aux ventes</button>
    </div>
    ${alertHtml}
    <div class="receipt" id="receipt-print-area">
      <div class="receipt-inner">
        <div class="receipt-top">
          <div class="receipt-logo">${set.logo ? `<img src="${set.logo}">` : ''}</div>
          <div class="receipt-brand">
            <h2>${Utils.escapeHtml(set.academyName)}</h2>
            <div class="receipt-tagline">${Utils.escapeHtml(set.tagline || '')}</div>
          </div>
          <div class="receipt-qr" id="qr-${s.id}"></div>
        </div>
      </div>
      <div class="receipt-banner">Reçu de paiement</div>
      <div class="receipt-meta-grid">
        <div><div class="m-label">N° Reçu</div><div class="m-value">${s.id}</div></div>
        <div><div class="m-label">Date</div><div class="m-value">${Utils.dateTimeFmt(s.date)}</div></div>
        <div><div class="m-label">Client</div><div class="m-value">${client ? Utils.escapeHtml(client.name) : '—'}</div></div>
        <div><div class="m-label">Téléphone</div><div class="m-value">${client ? Utils.escapeHtml(client.phone||'—') : '—'}</div></div>
      </div>
      <div style="padding:0 24px;">
        <table>
          <thead><tr><th>Désignation</th><th>Qté</th><th>Prix unit.</th><th>Montant</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${discount > 0 ? `
      <div class="receipt-sub-rows" style="padding-top:6px;">
        <div class="stock-row"><span class="text-muted">Sous-total</span><strong>${Utils.money(subtotal)}</strong></div>
        <div class="stock-row"><span class="text-muted">Réduction accordée</span><strong class="gold-text">- ${Utils.money(discount)}</strong></div>
      </div>` : ''}
      <div class="receipt-total-row"><span>Total à payer</span><span class="amt">${Utils.money(s.total)}</span></div>
      <div class="receipt-sub-rows">
        <div class="stock-row"><span class="text-muted">Montant payé</span><strong class="gold-text">${Utils.money(s.paid)}</strong></div>
        <div class="stock-row"><span class="text-muted">Reste à payer</span><strong>${Utils.money(s.remaining)}</strong></div>
        <div class="stock-row"><span class="text-muted">Mode de paiement</span><strong>${Utils.escapeHtml(s.method)}</strong></div>
        <div class="stock-row"><span class="text-muted">Statut</span>${Utils.statusBadge(s.status)}</div>
        ${payRows ? `<div class="text-muted" style="font-size:.7rem;margin-top:8px;text-transform:uppercase;letter-spacing:.4px">Paiements reçus</div>${payRows}` : ''}
        ${ebookLinks}
      </div>
      <div class="receipt-sign">
        <div>Signature du client<div class="line"></div></div>
        <div>${Utils.escapeHtml(set.academyName)}<div class="line"></div></div>
      </div>
      <div class="receipt-footer-bar">Merci pour votre confiance ! · ${Utils.escapeHtml(set.academyName)} — ${Utils.escapeHtml(set.tagline || '')}</div>
    </div>
    <div class="receipt-actions">
      <button class="btn btn-primary btn-sm" onclick="Pages.downloadReceiptPDF('${s.id}')">⬇️ PDF</button>
      <button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Imprimer</button>
      <button class="btn btn-outline btn-sm" onclick="Pages.copyReceipt('${s.id}')">📋 Copier</button>
      <button class="btn btn-gold btn-sm" onclick="Pages.shareReceiptWhatsApp('${s.id}')">📲 WhatsApp</button>
    </div>
    ${Pages.paymentSection(s)}
    ${Pages.deliverySection(s)}
    <div class="receipt-actions" style="grid-template-columns:1fr">
      <button class="btn btn-danger btn-sm" onclick="Pages.removeSale('${s.id}')">🗑 Supprimer ce reçu / cette vente</button>
    </div>
  `;
};

/* ---------------------------------------------------------
   LIVRAISON DES E-BOOKS (PDF filigrané + audio via WhatsApp)
--------------------------------------------------------- */
Pages.deliverySection = function (s) {
  const seen = {};
  const books = s.items
    .map(it => DB.getBook(it.bookId))
    .filter(b => b && b.type === 'ebook' && !seen[b.id] && (seen[b.id] = true));
  if (!books.length) return '';
  const paid = s.status === 'Payé';
  const deliveries = s.deliveries || [];

  const rows = books.map(b => {
    const sentPdf = deliveries.filter(d => d.bookId === b.id && d.kind === 'pdf').length;
    const sentAudio = deliveries.filter(d => d.bookId === b.id && d.kind === 'audio').length;
    let actions;
    if (!paid) {
      actions = `<div class="text-muted" style="font-size:.8rem">🔒 Livraison disponible dès que le paiement est complet.</div>`;
    } else if (b.filesEnabled === false) {
      actions = `<div class="text-muted" style="font-size:.8rem">🚫 Livraison désactivée pour cet e-book (voir sa fiche).</div>`;
    } else if (!b.pdfName && !b.audioName) {
      actions = `<div class="text-muted" style="font-size:.8rem">Aucun fichier importé. Ajoutez le PDF dans la fiche de l'e-book.</div>`;
    } else {
      const pdfOk = b.pdfName && !b.pdfMissing;
      const audioOk = b.audioName && !b.audioMissing;
      const lost = (b.pdfName && b.pdfMissing ? 'le PDF' : '') + (b.pdfName && b.pdfMissing && b.audioName && b.audioMissing ? ' et ' : '') + (b.audioName && b.audioMissing ? "l'audio" : '');
      actions = `<div class="tag-row">
        ${pdfOk ? `<button class="btn btn-primary btn-sm" onclick="Pages.sendEbook('${s.id}','${b.id}','pdf')">📄 PDF filigrané</button>` : ''}
        ${audioOk ? `<button class="btn btn-gold btn-sm" onclick="Pages.sendEbook('${s.id}','${b.id}','audio')">🎧 Audio</button>` : ''}
      </div>
      ${lost ? `<div style="font-size:.78rem;color:var(--danger)">⚠️ ${lost} introuvable sur cet appareil : réimportez-le dans la fiche de l'e-book.</div>` : ''}`;
    }
    const sentLine = (sentPdf || sentAudio)
      ? `<div style="font-size:.74rem;color:var(--ok)">✅ Déjà envoyé : ${sentPdf ? sentPdf + ' PDF' : ''}${sentPdf && sentAudio ? ' · ' : ''}${sentAudio ? sentAudio + ' audio' : ''}</div>` : '';
    return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:8px">
      <div class="title">💻 ${Utils.escapeHtml(b.title)}</div>${sentLine}${actions}</div>`;
  }).join('');

  return `
    <div class="section-block mt-16">
      <h3>📤 Livraison des e-books</h3>
      <div class="list">${rows}</div>
      <div class="text-muted" style="font-size:.72rem;margin-top:8px">Le PDF est personnalisé (nom, téléphone et n° de reçu du client en filigrane sur chaque page) puis envoyé directement sur WhatsApp, sans lien.</div>
    </div>`;
};

Pages.sendEbook = async function (saleId, bookId, kind) {
  const book0 = DB.getBook(bookId);
  Utils.toast(book0 && book0[kind + 'Path'] ? '☁️ Téléchargement depuis Supabase…' : (kind === 'pdf' ? 'Préparation du PDF filigrané…' : "Préparation de l'audio…"));
  try {
    const file = await Delivery.prepare(saleId, bookId, kind);
    Delivery.ready = { file, saleId, bookId, kind };
    const sale = DB.getSale(saleId);
    const book = DB.getBook(bookId);
    const client = DB.getClient(sale.clientId);
    Utils.openModal(`
      <div class="modal-header"><h3>${kind === 'pdf' ? '📄 PDF prêt' : '🎧 Audio prêt'}</h3><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
      <div class="card mb-8">
        <div class="stock-row"><span class="text-muted">E-book</span><strong>${Utils.escapeHtml(book.title)}</strong></div>
        <div class="stock-row"><span class="text-muted">Client</span><strong>${client ? Utils.escapeHtml(client.name) : '—'}</strong></div>
        <div class="stock-row"><span class="text-muted">Téléphone</span><strong>${client ? Utils.escapeHtml(client.phone || '—') : '—'}</strong></div>
        <div class="stock-row"><span class="text-muted">Fichier</span><strong>${Utils.escapeHtml(file.name)} (${Pages.fmtSize(file.size)})</strong></div>
        ${kind === 'pdf' ? '<div class="text-muted mt-8" style="font-size:.76rem">🔖 Filigrane ajouté sur chaque page : nom, téléphone, n° de reçu.</div>' : ''}
      </div>
      <button class="btn btn-primary btn-block" onclick="Pages.shareReady()">📲 Envoyer sur WhatsApp</button>
      <button class="btn btn-outline btn-block mt-8" onclick="Pages.saveReady()">⬇️ Enregistrer sur l'appareil</button>
    `);
  } catch (e) {
    console.error(e);
    Utils.toast(e.message || 'Impossible de préparer le fichier.', 'err');
  }
};

Pages.shareReady = async function () {
  const r = Delivery.ready;
  if (!r) return;
  const sale = DB.getSale(r.saleId);
  const book = DB.getBook(r.bookId);
  const client = DB.getClient(sale.clientId);
  const text = Delivery.message(sale, book, r.kind);
  try {
    if (navigator.canShare && navigator.canShare({ files: [r.file] })) {
      await navigator.share({ files: [r.file], text });
      DB.registerDelivery(r.saleId, r.bookId, r.kind);
      Utils.toast('Fichier envoyé ✅');
    } else {
      // Navigateur sans partage de fichiers (ordinateur) : on enregistre le fichier
      // et on ouvre la conversation WhatsApp du client pour l'y joindre.
      Delivery.download(r.file);
      const num = Delivery.waNumber(client ? client.phone : '');
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
      DB.registerDelivery(r.saleId, r.bookId, r.kind);
      Utils.toast('Fichier enregistré — joignez-le dans la conversation WhatsApp.', 'warn');
    }
    Delivery.ready = null;
    Utils.closeModal();
    Router.render();
  } catch (e) {
    if (e && e.name === 'AbortError') return; // l'utilisateur a annulé
    console.error(e);
    Utils.toast("Envoi impossible. Utilisez « Enregistrer sur l'appareil » puis joignez le fichier dans WhatsApp.", 'err');
  }
};

Pages.saveReady = function () {
  const r = Delivery.ready;
  if (!r) return;
  Delivery.download(r.file);
  DB.registerDelivery(r.saleId, r.bookId, r.kind);
  Utils.toast('Fichier enregistré ✅');
  Delivery.ready = null;
  Utils.closeModal();
  Router.render();
};

Pages.removeSale = function (id) {
  const s = DB.getSale(id);
  if (!s) return;
  const hasPaper = s.items.some(it => { const b = DB.getBook(it.bookId); return b ? b.type !== 'ebook' : !it.isEbook; });
  const msg = `Supprimer définitivement le reçu ${id} ?\n\n` +
    `• La vente sera retirée des statistiques, du chiffre d'affaires et des bénéfices.\n` +
    (hasPaper ? `• Le stock des livres papier sera remis automatiquement.\n` : '') +
    `\nCette action est irréversible.`;
  if (!confirm(msg)) return;
  DB.deleteSale(id);
  Utils.toast('Reçu supprimé, statistiques recalculées ✅');
  Router.go('sales');
};

Pages.renderReceiptQR = function (id) {
  const holder = document.getElementById('qr-' + id);
  if (!holder || typeof QRCode === 'undefined') return;
  holder.innerHTML = '';
  const set = DB.data.settings;
  const text = `${set.academyName} | Reçu ${id}`;
  try {
    new QRCode(holder, { text, width: 70, height: 70, colorDark: '#1d3823', colorLight: '#ffffff' });
  } catch (e) { console.warn('QR non généré', e); }
};

Pages.receiptText = function (id) {
  const s = DB.getSale(id);
  const client = DB.getClient(s.clientId);
  const set = DB.data.settings;
  const subtotal = s.subtotal != null ? s.subtotal : s.items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const discount = Number(s.discount || 0);
  const ebookLinkLines = s.items.filter(it => it.isEbook).map(it => {
    const book = DB.getBook(it.bookId);
    return (book && book.downloadLink) ? `📎 ${it.title} : ${book.downloadLink}` : null;
  }).filter(Boolean);
  const lines = [
    `🧾 ${set.academyName}`,
    `${set.phone} — ${set.address}`,
    ``,
    `Client : ${client ? client.name : '—'}`,
    `Date : ${Utils.dateTimeFmt(s.date)}`,
    ``,
    ...s.items.map(it => `${it.title}${it.isEbook ? ' (E-book)' : ''} x${it.qty} = ${Utils.money(it.price*it.qty)}`),
    ``,
    `Sous-total : ${Utils.money(subtotal)}`,
    ...(discount > 0 ? [`Réduction : - ${Utils.money(discount)}`] : []),
    `Total à payer : ${Utils.money(s.total)}`,
    `Payé : ${Utils.money(s.paid)}`,
    `Reste à payer : ${Utils.money(s.remaining)}`,
    `Statut : ${s.status === 'Partiel' ? 'Paiement partiel' : s.status}`,
    ...(s.payments && s.payments.length ? ['', 'Paiements reçus :', ...s.payments.map(p => `- ${Utils.dateFmt(p.at)} : ${Utils.money(p.amount)} (${p.method})`)] : []),
    ...(ebookLinkLines.length ? ['', ...ebookLinkLines] : []),
    ``,
    `Merci pour votre confiance 🌿`
  ];
  return lines.join('\n');
};

Pages.copyReceipt = function (id) {
  const text = Pages.receiptText(id);
  navigator.clipboard.writeText(text).then(() => Utils.toast('Reçu copié dans le presse-papiers ✅'))
    .catch(() => Utils.toast('Impossible de copier.', 'err'));
};

Pages.shareReceiptWhatsApp = async function (id) {
  const el = document.getElementById('receipt-print-area');
  if (!el || !window.html2canvas) { Utils.toast('Chargement en cours, réessayez dans un instant.', 'warn'); return; }
  Utils.toast('Préparation du reçu...', 'ok');
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Blob non généré');
    const text = Pages.receiptText(id);
    const file = new File([blob], `Recu_${id}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text, title: `Reçu ${id} — ${DB.data.settings.academyName}` });
      Utils.toast('Reçu partagé ✅');
    } else {
      // Fallback for browsers without file sharing support (e.g. desktop):
      // download the receipt image, then open WhatsApp with the text ready to send.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Recu_${id}.png`; a.click();
      URL.revokeObjectURL(url);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      Utils.toast("Image du reçu téléchargée — joignez-la à la conversation WhatsApp qui vient de s'ouvrir.", 'warn');
    }
  } catch (e) {
    console.error(e);
    Utils.toast("Impossible de préparer le partage. Utilisez le bouton PDF puis partagez-le manuellement.", 'err');
  }
};

Pages.downloadReceiptPDF = function (id) {
  const el = document.getElementById('receipt-print-area');
  if (!window.html2canvas || !window.jspdf) { Utils.toast('Chargement du générateur PDF, réessayez dans un instant.', 'warn'); return; }
  html2canvas(el, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`Recu_${id}.pdf`);
    Utils.toast('PDF téléchargé ✅');
  });
};

/* ---------------------------------------------------------
   REPORTS
--------------------------------------------------------- */
Pages.reportsTab = 'global';
Pages.setReportsTab = function (tab) {
  Pages.reportsTab = tab;
  Router.render();
};

Pages.reports = function () {
  const tab = Pages.reportsTab || 'global';
  const tabsHtml = `
    <div class="tag-row mb-8">
      <span class="chip ${tab==='global'?'active':''}" onclick="Pages.setReportsTab('global')">🌐 Global</span>
      <span class="chip ${tab==='papier'?'active':''}" onclick="Pages.setReportsTab('papier')">📄 Livres papier</span>
      <span class="chip ${tab==='ebook'?'active':''}" onclick="Pages.setReportsTab('ebook')">💻 E-books</span>
    </div>
  `;
  const body = tab === 'papier' ? Pages.reportsByType('papier')
    : tab === 'ebook' ? Pages.reportsByType('ebook')
    : Pages.reportsGlobal();

  return `
    <div class="page-title">
      <div><span class="eyebrow">Statistiques</span><h2>Rapports</h2></div>
    </div>
    ${tabsHtml}
    ${body}
  `;
};

Pages.reportPeriods = function () {
  return [
    { label: "Aujourd'hui", start: Utils.startOfToday() },
    { label: 'Cette semaine', start: Utils.startOfWeek() },
    { label: 'Ce mois', start: Utils.startOfMonth() },
    { label: 'Cette année', start: Utils.startOfYear() }
  ];
};

Pages.reportsGlobal = function () {
  const now = new Date();
  const cards = Pages.reportPeriods().map(p => {
    const sales = DB.salesBetween(p.start, now);
    const stats = DB.computeSalesStats(sales);
    return `<div class="stat-card"><span class="ic">📅</span><div class="label">${p.label}</div><div class="value">${Utils.money(stats.revenue)}</div><div class="text-muted" style="font-size:.7rem;margin-top:4px">${sales.length} vente(s)${stats.discount ? ' · -' + Utils.money(stats.discount) + ' réduc.' : ''}</div></div>`;
  }).join('');

  const best = DB.bestSellers(6);
  const max = Math.max(1, ...best.map(b => b.sold || 0));
  const bars = best.length ? `<div class="bars">${best.map(b => `
    <div class="bar-col"><div class="bar" style="height:${Math.max(6, (b.sold/max)*100)}%"></div><div class="bar-label">${Utils.escapeHtml(b.title.slice(0,10))}${b.title.length>10?'…':''}</div></div>
  `).join('')}</div>` : `<div class="empty-state"><div class="ic">📊</div><p>Pas encore de données de ventes.</p></div>`;

  const t = DB.totals();

  return `
    <div class="grid-stats">${cards}</div>
    <div class="section-block">
      <h3>💳 Suivi des paiements</h3>
      <div class="grid-stats">
        <div class="stat-card" style="border-left-color:var(--danger)"><span class="ic">⏳</span><div class="label">Paiements en attente</div><div class="value">${t.pending}</div></div>
        <div class="stat-card" style="border-left-color:var(--warn)"><span class="ic">🟡</span><div class="label">Paiements partiels</div><div class="value">${t.partial}</div></div>
        <div class="stat-card"><span class="ic">💵</span><div class="label">Reste à encaisser</div><div class="value">${Utils.money(t.totalRemaining)}</div></div>
      </div>
    </div>
    <div class="section-block">
      <h3>💰 Chiffre d'affaires total : <span class="gold-text">${Utils.money(t.revenue)}</span></h3>
      <h3 class="mt-8">📈 Bénéfice total : <span class="gold-text">${Utils.money(t.profit)}</span></h3>
      <h3 class="mt-8">🏷️ Réductions accordées : <span class="gold-text">${Utils.money(t.totalDiscounts)}</span></h3>
    </div>
    <div class="section-block">
      <h3>📄💻 Répartition des ventes</h3>
      <div class="grid-stats" style="grid-template-columns:repeat(2,1fr)">
        <div class="stat-card"><span class="ic">📄</span><div class="label">Livres papier vendus</div><div class="value">${t.papierSold}</div></div>
        <div class="stat-card"><span class="ic">💻</span><div class="label">E-books vendus</div><div class="value">${t.ebookSold}</div></div>
      </div>
    </div>
    <div class="section-block">
      <h3>🏆 Meilleurs livres (tous produits)</h3>
      <div class="card">${bars}</div>
    </div>
  `;
};

Pages.reportsByType = function (type) {
  const now = new Date();
  const label = type === 'papier' ? 'Livres papier' : 'E-books';
  const icon = type === 'papier' ? '📄' : '💻';
  const cards = Pages.reportPeriods().map(p => {
    const sales = DB.salesBetween(p.start, now);
    const stats = DB.computeSalesStats(sales);
    const rev = type === 'papier' ? stats.papierRevenue : stats.ebookRevenue;
    const qty = type === 'papier' ? stats.papierQty : stats.ebookQty;
    return `<div class="stat-card"><span class="ic">📅</span><div class="label">${p.label}</div><div class="value">${Utils.money(rev)}</div><div class="text-muted" style="font-size:.7rem;margin-top:4px">${qty} unité(s) vendue(s)</div></div>`;
  }).join('');

  const best = DB.bestSellers(6, type);
  const max = Math.max(1, ...best.map(b => b.sold || 0));
  const bars = best.length ? `<div class="bars">${best.map(b => `
    <div class="bar-col"><div class="bar" style="height:${Math.max(6, (b.sold/max)*100)}%"></div><div class="bar-label">${Utils.escapeHtml(b.title.slice(0,10))}${b.title.length>10?'…':''}</div></div>
  `).join('')}</div>` : `<div class="empty-state"><div class="ic">📊</div><p>Pas encore de vente pour cette catégorie.</p></div>`;

  const t = DB.totals();
  const revenue = type === 'papier' ? t.papierRevenue : t.ebookRevenue;
  const profit = type === 'papier' ? t.papierProfit : t.ebookProfit;
  const sold = type === 'papier' ? t.papierSold : t.ebookSold;

  return `
    <div class="grid-stats">${cards}</div>
    <div class="section-block">
      <h3>${icon} ${label} vendus : <span class="gold-text">${sold}</span></h3>
      <h3 class="mt-8">💰 Chiffre d'affaires ${label.toLowerCase()} : <span class="gold-text">${Utils.money(revenue)}</span></h3>
      <h3 class="mt-8">📈 Bénéfice ${label.toLowerCase()} : <span class="gold-text">${Utils.money(profit)}</span></h3>
      ${type === 'ebook' ? (() => { const d = DB.totalDeliveries(); return `<h3 class="mt-8">📤 Fichiers envoyés aux clients : <span class="gold-text">${d.pdf} PDF · ${d.audio} audio</span></h3>`; })() : ''}
    </div>
    <div class="section-block">
      <h3>🏆 ${label} les plus vendus</h3>
      <div class="card">${bars}</div>
    </div>
  `;
};

/* ---------------------------------------------------------
   SEARCH
--------------------------------------------------------- */
Pages.search = function (query = '') {
  const q = query.trim().toLowerCase();
  let bookResults = [], clientResults = [];
  if (q) {
    bookResults = DB.data.books.filter(b => b.title.toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q));
    clientResults = DB.data.clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q));
  }
  const bookHtml = bookResults.map(b => `
    <div class="list-item" onclick="Pages.openBookForm('${b.id}')">
      <div class="avatar">${DB.isEbook(b) ? '💻' : '📘'}</div>
      <div class="content"><div class="title">${Utils.escapeHtml(b.title)}</div><div class="meta">${Utils.escapeHtml(b.author||'')} · ${Utils.money(b.price)} · ${DB.isEbook(b) ? 'E-book' : 'Papier'}</div></div>
    </div>`).join('');
  const clientHtml = clientResults.map(c => `
    <div class="list-item" onclick="Router.go('clients/${c.id}')">
      <div class="avatar">${Utils.escapeHtml(c.name.slice(0,1).toUpperCase())}</div>
      <div class="content"><div class="title">${Utils.escapeHtml(c.name)}</div><div class="meta">${Utils.escapeHtml(c.phone||'')}</div></div>
    </div>`).join('');

  const resultsHtml = !q ? `<div class="empty-state"><div class="ic">🔍</div><p>Tapez un titre, un nom de client ou un numéro de téléphone.</p></div>`
    : (bookResults.length === 0 && clientResults.length === 0)
      ? `<div class="empty-state"><div class="ic">😕</div><p>Aucun résultat trouvé.</p></div>`
      : `
        ${bookResults.length ? `<div class="section-block"><h3>📚 Livres (${bookResults.length})</h3><div class="list">${bookHtml}</div></div>` : ''}
        ${clientResults.length ? `<div class="section-block"><h3>👥 Clients (${clientResults.length})</h3><div class="list">${clientHtml}</div></div>` : ''}
      `;

  return `
    <div class="page-title"><div><span class="eyebrow">Recherche instantanée</span><h2>Rechercher</h2></div></div>
    <div class="search-bar">
      <span class="ic">🔍</span>
      <input type="text" id="global-search" placeholder="Titre, client ou téléphone..." value="${Utils.escapeHtml(query)}" oninput="Pages.refreshSearch(this.value)" autofocus>
    </div>
    <div id="search-results">${resultsHtml}</div>
  `;
};

Pages.refreshSearch = function (q) {
  document.getElementById('search-results').innerHTML = Pages.search(q).match(/<div id="search-results">([\s\S]*)<\/div>\s*$/)[1];
};

/* ---------------------------------------------------------
   BACKUP
--------------------------------------------------------- */
Pages.backup = function () {
  const lastBackup = localStorage.getItem(DB_KEY + '_last_backup_at');
  return `
    <div class="page-title"><div><span class="eyebrow">Données</span><h2>Sauvegarde</h2></div></div>
    <div class="card mb-8">
      <h3>💾 Sauvegarde automatique</h3>
      <p class="text-muted mt-8" style="font-size:.85rem">Toutes vos données sont automatiquement enregistrées sur cet appareil à chaque modification.</p>
      <p class="text-muted mt-8" style="font-size:.8rem">Dernière sauvegarde : ${lastBackup ? Utils.dateTimeFmt(lastBackup) : '—'}</p>
    </div>
    <div class="card mb-8" id="files-audit"><h3>🔎 État des fichiers e-books</h3><p class="text-muted mt-8" style="font-size:.8rem">Vérification en cours…</p></div>
    <div class="card mb-8">
      <h3>⬇️ Export</h3>
      <p class="text-muted mt-8" style="font-size:.85rem">Téléchargez une copie complète de vos données (livres, clients, ventes, réglages) au format JSON. Les fichiers PDF et audio des e-books ne sont pas inclus (trop volumineux) : gardez-en une copie sur votre téléphone ou votre ordinateur.</p>
      <button class="btn btn-primary mt-16" onclick="Pages.exportData()">Exporter les données (JSON)</button>
    </div>
    <div class="card mb-8">
      <h3>⬆️ Import</h3>
      <p class="text-muted mt-8" style="font-size:.85rem">Restaurez vos données à partir d'un fichier JSON exporté précédemment. Cela remplacera les données actuelles.</p>
      <div class="upload-box mt-16">
        <div>📁 Choisir un fichier JSON</div>
        <input type="file" accept="application/json" id="import-file" onchange="Pages.importData(this.files[0])">
      </div>
    </div>
  `;
};

Pages.exportData = function () {
  const blob = new Blob([DB.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sauvegarde_livres_sza_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  Utils.toast('Export terminé ✅');
};

Pages.importData = function (file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      DB.importJSON(reader.result);
      Utils.toast('Importation réussie ✅');
      Router.render();
    } catch (e) {
      Utils.toast('Fichier invalide.', 'err');
    }
  };
  reader.readAsText(file);
};

/* ---------------------------------------------------------
   SETTINGS
--------------------------------------------------------- */
Pages.settings = function () {
  const s = DB.data.settings;
  return `
    <div class="page-title"><div><span class="eyebrow">Configuration</span><h2>Réglages</h2></div></div>
    <div class="card mb-8">
      <div class="upload-box" id="logo-box">
        ${s.logo ? `<img src="${s.logo}">` : '<div style="font-size:2rem">🖼️</div><div>Logo de l\'académie</div>'}
        <input type="file" accept="image/*" id="logo-input">
      </div>
      <div class="form-group mt-16">
        <label>Nom de l'académie</label>
        <input type="text" id="set-name" value="${Utils.escapeHtml(s.academyName)}">
      </div>
      <div class="form-group">
        <label>Slogan / Devise de l'académie</label>
        <input type="text" id="set-tagline" value="${Utils.escapeHtml(s.tagline || '')}" placeholder="Ex : Savoir utile pour une vie meilleure">
      </div>
      <div class="form-group">
        <label>Téléphone</label>
        <input type="tel" id="set-phone" value="${Utils.escapeHtml(s.phone)}">
      </div>
      <div class="form-group">
        <label>Adresse</label>
        <input type="text" id="set-address" value="${Utils.escapeHtml(s.address)}">
      </div>
      <div class="form-group">
        <label>Devise</label>
        <input type="text" id="set-currency" value="${Utils.escapeHtml(s.currency)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Couleur émeraude</label>
          <input type="color" id="set-emerald" value="${s.colorEmerald}">
        </div>
        <div class="form-group">
          <label>Couleur dorée</label>
          <input type="color" id="set-gold" value="${s.colorGold}">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Pages.saveSettings()">💾 Enregistrer les réglages</button>
    </div>

    <div class="card mb-8">
      <h3>☁️ Supabase (fichiers e-books)</h3>
      <p class="text-muted mt-8" style="font-size:.78rem">Vos PDF et audios restent dans Supabase : l'application les télécharge au moment de l'envoi au client.</p>
      <div class="form-group mt-16">
        <label>Adresse du projet (Project URL)</label>
        <input type="text" id="set-sburl" value="${Utils.escapeHtml(s.supabaseUrl || '')}" placeholder="https://xxxx.supabase.co">
      </div>
      <div class="form-group">
        <label>Clé « anon public »</label>
        <input type="text" id="set-sbkey" value="${Utils.escapeHtml(s.supabaseKey || '')}" placeholder="eyJ… ou sb_publishable_…">
      </div>
      <div class="form-group">
        <label>Nom du bucket (dossier Storage)</label>
        <input type="text" id="set-sbbucket" value="${Utils.escapeHtml(s.supabaseBucket || '')}" placeholder="ex : livres">
      </div>
      <div class="tag-row">
        <button class="btn btn-primary btn-sm" onclick="Pages.saveCloud()">💾 Enregistrer</button>
        <button class="btn btn-outline btn-sm" onclick="Pages.testCloud()">🔌 Tester la connexion</button>
      </div>
      <div class="text-muted mt-8" style="font-size:.72rem">⚠️ Utilisez uniquement la clé « anon public ». La clé « service_role » est secrète : ne la saisissez jamais ici.</div>
    </div>

    <div class="card mb-8">
      <h3>🔒 Sécurité</h3>
      <div class="stock-row mt-16">
        <span>Protéger l'application par mot de passe</span>
        <input type="checkbox" id="set-pwd-enabled" ${s.passwordEnabled ? 'checked' : ''} style="width:20px;height:20px">
      </div>
      <div class="form-group mt-16">
        <label>Mot de passe</label>
        <input type="password" id="set-password" placeholder="Nouveau mot de passe" value="">
      </div>
      <button class="btn btn-outline btn-block" onclick="Pages.saveSecurity()">Mettre à jour la sécurité</button>
    </div>
  `;
};

Pages.saveSettings = async function () {
  const logoBox = document.getElementById('logo-box');
  const logoImg = logoBox.querySelector('img');
  DB.data.settings.academyName = document.getElementById('set-name').value.trim() || DB.data.settings.academyName;
  DB.data.settings.tagline = document.getElementById('set-tagline').value.trim();
  DB.data.settings.phone = document.getElementById('set-phone').value.trim();
  DB.data.settings.address = document.getElementById('set-address').value.trim();
  DB.data.settings.currency = document.getElementById('set-currency').value.trim() || 'FCFA';
  DB.data.settings.colorEmerald = document.getElementById('set-emerald').value;
  DB.data.settings.colorGold = document.getElementById('set-gold').value;
  if (logoImg) DB.data.settings.logo = logoImg.getAttribute('src');
  DB.save();
  App.applyTheme();
  App.renderShell();
  Utils.toast('Réglages enregistrés ✅');
  Router.render();
};

Pages.saveSecurity = function () {
  const enabled = document.getElementById('set-pwd-enabled').checked;
  const pwd = document.getElementById('set-password').value;
  DB.data.settings.passwordEnabled = enabled;
  if (pwd) DB.data.settings.password = btoa(unescape(encodeURIComponent(pwd)));
  if (enabled && !DB.data.settings.password) {
    Utils.toast('Veuillez définir un mot de passe.', 'err');
    DB.data.settings.passwordEnabled = false;
    return;
  }
  DB.save();
  Utils.toast('Sécurité mise à jour ✅');
};

/* logo file input binding happens after render via App.bindDynamicInputs */


/* ---------------------------------------------------------
   PAIEMENTS : encaisser le solde d'une vente en attente / partielle
--------------------------------------------------------- */
Pages.cashButton = function (s) {
  if (s.status === 'Payé') return '';
  return `<button class="icon-btn" title="Encaisser" style="background:transparent;color:var(--emerald-700);width:32px;height:32px" onclick="event.stopPropagation(); Pages.openPayment('${s.id}')">💰</button>`;
};

Pages.paymentSection = function (s) {
  let html = '';
  if (s.status !== 'Payé') {
    html += `
    <div class="card mt-16" style="border-left:4px solid var(--gold)">
      <h3 style="font-size:1rem">💰 Paiement à encaisser</h3>
      <div class="stock-row mt-8"><span class="text-muted">Déjà payé</span><strong>${Utils.money(s.paid)}</strong></div>
      <div class="stock-row"><span class="text-muted">Reste à payer</span><strong style="color:var(--danger)">${Utils.money(s.remaining)}</strong></div>
      <button class="btn btn-gold btn-block mt-16" onclick="Pages.openPayment('${s.id}')">💰 Enregistrer un paiement</button>
    </div>`;
  }
  if (s.payments && s.payments.length) {
    html += `
    <div class="card mt-16">
      <h3 style="font-size:1rem">🧾 Historique des paiements</h3>
      ${s.payments.map((p, i) => `
        <div class="stock-row mt-8">
          <span class="text-muted">${Utils.dateTimeFmt(p.at)} · ${Utils.escapeHtml(p.method || '')}</span>
          <span><strong>${Utils.money(p.amount)}</strong>
          <button class="icon-btn" title="Retirer ce paiement" style="background:transparent;color:var(--danger);width:28px;height:28px;display:inline-flex" onclick="Pages.removePayment('${s.id}', ${i})">✕</button></span>
        </div>`).join('')}
    </div>`;
  }
  return html;
};

Pages.openPayment = function (saleId) {
  const s = DB.getSale(saleId);
  if (!s) return;
  const client = DB.getClient(s.clientId);
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  Utils.openModal(`
    <div class="modal-header"><h3>💰 Enregistrer un paiement</h3><button class="modal-close" onclick="Utils.closeModal()">✕</button></div>
    <div class="card mb-8">
      <div class="stock-row"><span class="text-muted">Client</span><strong>${client ? Utils.escapeHtml(client.name) : '—'}</strong></div>
      <div class="stock-row"><span class="text-muted">Total</span><strong>${Utils.money(s.total)}</strong></div>
      <div class="stock-row"><span class="text-muted">Déjà payé</span><strong>${Utils.money(s.paid)}</strong></div>
      <div class="stock-row"><span class="text-muted">Reste à payer</span><strong style="color:var(--danger)">${Utils.money(s.remaining)}</strong></div>
    </div>
    <div class="form-group">
      <label>Montant reçu (${DB.data.settings.currency})</label>
      <input type="number" id="pay-amount" min="1" max="${s.remaining}" value="${s.remaining}">
      <button type="button" class="btn btn-outline btn-sm mt-8" onclick="document.getElementById('pay-amount').value=${s.remaining}">Solde complet : ${Utils.money(s.remaining)}</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Mode de paiement</label>
        <select id="pay-method">${['Espèces', 'Orange Money', 'Wave', 'Virement'].map(m => `<option ${(s.method || 'Espèces') === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Date et heure</label>
        <input type="datetime-local" id="pay-date" value="${local}">
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="Pages.savePayment('${s.id}')">✅ Enregistrer le paiement</button>
  `);
};

Pages.savePayment = function (saleId) {
  const s = DB.getSale(saleId);
  if (!s) return;
  const amount = Math.round(Number(document.getElementById('pay-amount').value) || 0);
  if (amount <= 0) { Utils.toast('Saisissez un montant supérieur à 0.', 'err'); return; }
  if (amount > s.remaining) { Utils.toast('Le montant dépasse le reste à payer (' + Utils.money(s.remaining) + ').', 'err'); return; }
  const method = document.getElementById('pay-method').value;
  const dateVal = document.getElementById('pay-date').value;
  const at = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
  const updated = DB.addPayment(saleId, amount, method, at);
  if (!updated) { Utils.toast("Paiement non enregistré.", 'err'); return; }
  Utils.closeModal();
  const hasEbook = updated.items.some(it => { const b = DB.getBook(it.bookId); return b && b.type === 'ebook'; });
  Utils.toast(updated.status === 'Payé'
    ? (hasEbook ? 'Paiement complet ✅ — e-books prêts à être envoyés' : 'Paiement complet ✅')
    : 'Paiement partiel enregistré ✅');
  Router.render();
};

Pages.removePayment = function (saleId, index) {
  const s = DB.getSale(saleId);
  if (!s || !s.payments || !s.payments[index]) return;
  const p = s.payments[index];
  if (!confirm('Retirer ce paiement de ' + Utils.money(p.amount) + ' ?\n\nLe reste à payer et le statut seront recalculés.')) return;
  DB.deletePayment(saleId, index);
  Utils.toast('Paiement retiré, statut recalculé ✅');
  Router.render();
};

/* ---------------------------------------------------------
   ÉTAT DES FICHIERS E-BOOKS (page Sauvegarde)
--------------------------------------------------------- */
Pages.loadFilesAudit = async function () {
  const box = document.getElementById('files-audit');
  if (!box) return;
  const ebooks = DB.data.books.filter(b => b.type === 'ebook');
  let info = { persisted: null, usage: null, quota: null };
  try { info = await FileStore.storageInfo(); } catch (e) { /* ignore */ }
  const rows = [];
  for (const b of ebooks) {
    const line = async (kind, label) => {
      if (!b[kind + 'Name']) return label + ' : —';
      if (b[kind + 'Path']) return label + ' : ☁️ Supabase (' + Utils.escapeHtml(b[kind + 'Path']) + ')';
      let ok = false;
      try { ok = await FileStore.exists(b.id, kind); } catch (e) { /* ignore */ }
      return label + ' : ' + (ok ? '✅ stocké (' + Pages.fmtSize(b[kind + 'Size']) + ')' : '⚠️ introuvable, à réimporter');
    };
    rows.push(`<div class="list-item" style="flex-direction:column;align-items:stretch;gap:2px">
      <div class="title">${Utils.escapeHtml(b.title)}</div>
      <div class="meta" style="white-space:normal">${await line('pdf', '📄 PDF')}</div>
      <div class="meta" style="white-space:normal">${await line('audio', '🎧 Audio')}</div></div>`);
  }
  const prot = info.persisted === true
    ? '✅ Stockage protégé : le navigateur ne supprimera pas vos fichiers automatiquement.'
    : info.persisted === false
      ? '⚠️ Stockage non protégé : le navigateur peut effacer les fichiers si le téléphone manque de place.'
      : 'Protection du stockage : information indisponible.';
  const usage = info.usage != null
    ? `<div class="text-muted" style="font-size:.76rem">Espace utilisé : ${Pages.fmtSize(info.usage)}${info.quota ? ' sur ' + Pages.fmtSize(info.quota) + ' disponibles' : ''}</div>` : '';
  box.innerHTML = `<h3>🔎 État des fichiers e-books</h3>
    <p class="mt-8" style="font-size:.82rem">${prot}</p>${usage}
    ${info.persisted === false ? '<button class="btn btn-gold btn-sm mt-8" onclick="Pages.protectStorage()">🛡 Protéger le stockage</button>' : ''}
    <div class="list mt-16">${rows.length ? rows.join('') : '<div class="text-muted" style="font-size:.82rem">Aucun e-book enregistré.</div>'}</div>
    <div class="text-muted mt-8" style="font-size:.72rem">Astuce : installer l'application (bouton ⬇️ en haut) augmente les chances que le stockage soit protégé.</div>`;
};

Pages.protectStorage = async function () {
  const ok = await FileStore.persist();
  Utils.toast(ok ? 'Stockage protégé ✅' : "Le navigateur n'a pas accordé la protection. Installez l'application puis réessayez.", ok ? 'ok' : 'warn');
  Pages.loadFilesAudit();
};


/* ---------------------------------------------------------
   RÉGLAGES SUPABASE
--------------------------------------------------------- */
Pages.saveCloud = function () {
  let url = document.getElementById('set-sburl').value.trim().replace(/\/+$/, '');
  const key = document.getElementById('set-sbkey').value.trim();
  const bucket = document.getElementById('set-sbbucket').value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (Cloud.isSecretKey(key)) {
    alert("⚠️ Cette clé est une clé SECRÈTE (service_role / secret). Elle donne un accès total à votre compte Supabase et ne doit jamais être mise dans une application.\n\nUtilisez la clé « anon public » (Supabase → Settings → API).");
    return false;
  }
  const s = DB.data.settings;
  s.supabaseUrl = url; s.supabaseKey = key; s.supabaseBucket = bucket;
  DB.save();
  Utils.toast('Réglages Supabase enregistrés ✅');
  return true;
};

Pages.testCloud = async function () {
  if (!Pages.saveCloud()) return;
  Utils.toast('Test de la connexion…');
  try {
    await Cloud.ping();
    alert("✅ Connexion à Supabase réussie : l'adresse et la clé sont valides.\n\nPour vérifier un fichier précis, ouvrez la fiche d'un e-book et appuyez sur « Tester ce chemin ».");
  } catch (e) {
    alert('❌ ' + e.message);
  }
};
