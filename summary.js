/* =========================================================
   summary.js — Résumé du mois : ce qu'il faut recopier dans
   l'application Business Manager (argent réellement encaissé).
   ========================================================= */

const Summary = { y: new Date().getFullYear(), m: new Date().getMonth() };

Summary.label = function () {
  const s = new Date(Summary.y, Summary.m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

Summary.shift = function (n) {
  const d = new Date(Summary.y, Summary.m + n, 1);
  Summary.y = d.getFullYear();
  Summary.m = d.getMonth();
  Router.render();
};

Summary.compute = function () {
  const start = new Date(Summary.y, Summary.m, 1, 0, 0, 0);
  const end = new Date(Summary.y, Summary.m + 1, 0, 23, 59, 59, 999);
  const sales = DB.salesBetween(start, end);
  const st = DB.computeSalesStats(sales);
  let papier = 0, ebook = 0, audio = 0;
  sales.forEach(s => {
    const items = s.items || [];
    const sub = s.subtotal != null ? Number(s.subtotal)
      : items.reduce((a, it) => a + Number(it.price || 0) * Number(it.qty || 0), 0);
    const paid = Number(s.paid || 0);
    items.forEach(it => {
      const line = Number(it.price || 0) * Number(it.qty || 0);
      const part = paid * (sub > 0 ? line / sub : 0);
      if (it.isAudio) { audio += part; return; }
      const book = DB.getBook(it.bookId);
      const isE = book ? book.type === 'ebook' : !!it.isEbook;
      if (isE) ebook += part; else papier += part;
    });
  });
  return { count: sales.length, st, papier, ebook, audio, paid: st.revenue };
};

Summary.text = function () {
  const r = Summary.compute();
  return 'Livres et ebooks – ' + Summary.label() + '\n' +
    'Encaissé : ' + Utils.money(r.paid) + '\n' +
    'Reste à encaisser : ' + Utils.money(r.st.totalRemaining) + '\n' +
    'Bénéfice encaissé : ' + Utils.money(r.st.paidProfit) + '\n' +
    'Ventes : ' + r.count;
};

Summary.copy = function (what) {
  const r = Summary.compute();
  const text = what === 'line'
    ? 'Livres et ebooks – ' + Summary.label() + ' : ' + Utils.money(r.paid)
    : Summary.text();
  navigator.clipboard.writeText(text)
    .then(() => Utils.toast('Copié ✅ Collez-le dans Business Manager'))
    .catch(() => Utils.toast('Copie impossible, recopiez à la main.', 'err'));
};

Pages.summary = function () {
  const r = Summary.compute();
  const row = (label, val) =>
    `<div class="stock-row"><span class="text-muted">${label}</span><strong>${Utils.money(val)}</strong></div>`;
  return `
    <div class="page-title">
      <div><span class="eyebrow">Comptabilité</span><h2>Résumé du mois</h2></div>
    </div>
    <div class="tag-row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <button class="btn btn-outline btn-sm" onclick="Summary.shift(-1)">‹</button>
      <strong>${Summary.label()}</strong>
      <button class="btn btn-outline btn-sm" onclick="Summary.shift(1)">›</button>
    </div>
    <div class="grid-stats">
      <div class="stat-card"><span class="ic">💰</span><div class="label">Encaissé</div><div class="value">${Utils.money(r.paid)}</div></div>
      <div class="stat-card"><span class="ic">⏳</span><div class="label">Reste à encaisser</div><div class="value">${Utils.money(r.st.totalRemaining)}</div></div>
      <div class="stat-card"><span class="ic">✅</span><div class="label">Bénéfice encaissé</div><div class="value">${Utils.money(r.st.paidProfit)}</div></div>
      <div class="stat-card"><span class="ic">🧾</span><div class="label">Ventes</div><div class="value">${r.count}</div></div>
    </div>
    <div class="section-block">
      <h3>Encaissé par type</h3>
      ${row('📄 Livres papier', r.papier)}
      ${row('💻 E-books', r.ebook)}
      ${row('🎧 Audios', r.audio)}
    </div>
    <div class="section-block">
      <h3>À recopier dans Business Manager</h3>
      <p class="meta">Catégorie « Livres et ebooks » · montant encaissé :</p>
      <h3 class="gold-text">${Utils.money(r.paid)}</h3>
      <div class="tag-row mt-16">
        <button class="btn btn-primary btn-sm" onclick="Summary.copy('line')">📋 Copier la ligne</button>
        <button class="btn btn-outline btn-sm" onclick="Summary.copy('full')">📋 Copier le résumé</button>
      </div>
    </div>
  `;
};
