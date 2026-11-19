/* =========================================================
   catalog.js — Boutique clients
   Génère le catalogue public (catalogue.json) affiché par la page
   boutique.html : les clients voient les livres, e-books et audios,
   puis commandent sur WhatsApp. Aucune donnée privée n'est publiée
   (ni prix de revient, ni stock exact, ni ventes, ni clients).
   ========================================================= */

const Catalog = {
  DEFAULT_WA: '+221 76 427 98 47', // numéro déjà utilisé sur votre page de vente
  DEFAULT_NOTE: 'Paiement par Orange Money, Wave ou espèces. Les e-books et les audios vous sont envoyés sur WhatsApp après paiement.'
};

Catalog.whatsappDisplay = function () {
  return DB.data.settings.shopWhatsapp || Catalog.DEFAULT_WA;
};
Catalog.whatsapp = function () {
  return Pages.waNumber(Catalog.whatsappDisplay());
};
Catalog.note = function () {
  const n = DB.data.settings.shopNote;
  return (n === undefined || n === null) ? Catalog.DEFAULT_NOTE : n;
};
Catalog.includeAudio = function () {
  return DB.data.settings.shopIncludeAudio !== false;
};
Catalog.shopUrl = function () {
  return new URL('boutique.html', location.href).href.split('#')[0].split('?')[0];
};

// Disponibilité affichée aux clients (jamais le stock exact)
Catalog.statusOf = function (b) {
  const s = DB.bookStatus(b);
  return s === 'rupture' ? 'rupture' : (s === 'alerte' ? 'limite' : 'disponible');
};

// Miniature légère de la couverture (le catalogue doit rester rapide à charger sur téléphone)
Catalog.thumb = async function (cover) {
  if (!cover) return '';
  if (!String(cover).startsWith('data:')) return String(cover);
  try { return (await window.shrinkImage(cover, 420, 0.7)) || ''; } catch (e) { return ''; }
};

// ---------- Audios : un seul produit par livre ----------
// Les chapitres d'un même livre (« Chapitre 2 … », « Chapitre 8 et Fin du livre … »)
// sont regroupés en un seul audio dans la boutique.
Catalog.CHAPTER_RE = /^\s*(chapitre|chap\.?|partie)\s*\d+\s*(et\s+fin(\s+du\s+livre)?)?\s*[:\-–—.]*\s*/i;

Catalog.normKey = function (title) {
  let t = String(title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(Catalog.CHAPTER_RE, '');
  return t.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
};
Catalog.cleanTitle = function (title) {
  const t = String(title || '').replace(Catalog.CHAPTER_RE, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
Catalog.hash = function (s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
Catalog.groupCfg = function (id) {
  return (DB.data.settings.shopAudioGroups || {})[id] || {};
};

Catalog.audioGroups = function (audios) {
  const map = {}, order = [];
  (audios || []).forEach(a => {
    if (a.active === false) return;
    const key = Catalog.normKey(a.title);
    if (!key) return;
    if (!map[key]) { map[key] = { key, id: 'AG' + Catalog.hash(key), members: [] }; order.push(key); }
    map[key].members.push(a);
  });
  return order.map(k => {
    const g = map[k], m = g.members;
    g.title = m.map(a => Catalog.cleanTitle(a.title)).sort((x, y) => x.length - y.length)[0];
    g.count = m.length;
    g.sum = m.reduce((s, a) => s + (Number(a.price) || 0), 0);
    g.minutes = Math.round(m.reduce((s, a) => s + (Number(a.duration_seconds) || 0), 0) / 60);
    g.language = [...new Set(m.map(a => String(a.language || '').trim()).filter(Boolean))].join(', ');
    g.description = ((m.find(a => a.description && String(a.description).trim()) || {}).description || '').trim();
    const cfg = Catalog.groupCfg(g.id);
    g.show = cfg.show !== false;
    g.price = (cfg.price !== undefined && cfg.price !== null && cfg.price !== '') ? Number(cfg.price) : g.sum;
    return g;
  });
};

// L'audio reprend la couverture du livre du même titre
Catalog.coverFor = async function (key) {
  const b = DB.data.books.find(x => x.cover && Catalog.normKey(x.title) === key);
  return b ? await Catalog.thumb(b.cover) : '';
};

Catalog.toggleAudioGroup = function (id, on) {
  const all = DB.data.settings.shopAudioGroups = DB.data.settings.shopAudioGroups || {};
  all[id] = Object.assign({}, all[id], { show: !!on });
  DB.save(); Router.render();
};
Catalog.setAudioPrice = function (id, value) {
  const all = DB.data.settings.shopAudioGroups = DB.data.settings.shopAudioGroups || {};
  const v = String(value).trim();
  all[id] = Object.assign({}, all[id], { price: v === '' ? undefined : Math.max(0, Math.round(Number(v) || 0)) });
  DB.save(); Router.render();
};
Catalog.loadAudios = async function () {
  Utils.toast('Chargement de vos audios…');
  try { await Pages.loadAudioCache(true); Router.render(); }
  catch (e) { Utils.toast("Impossible de charger les audios (connexion admin ?).", 'err'); }
};

Catalog.build = async function () {
  const set = DB.data.settings;
  const items = [];
  const books = [...DB.data.books]
    .filter(b => b.shop !== false)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  for (const b of books) {
    items.push({
      id: b.id,
      type: b.type === 'ebook' ? 'ebook' : 'papier',
      title: b.title || '',
      author: b.author || '',
      category: b.category || '',
      description: b.description || '',
      price: Number(b.price) || 0,
      status: Catalog.statusOf(b),
      cover: await Catalog.thumb(b.cover)
    });
  }
  let audioCount = 0, audioProblem = false;
  if (Catalog.includeAudio()) {
    try {
      const audios = await Pages.loadAudioCache();
      for (const g of Catalog.audioGroups(audios)) {
        if (!g.show) continue;
        const intro = g.count > 1
          ? 'Audio complet en ' + g.count + ' chapitres' + (g.minutes ? ' (environ ' + g.minutes + ' min)' : '') + '.'
          : '';
        items.push({
          id: g.id,
          type: 'audio',
          title: g.title + ' — version audio',
          author: g.language ? 'Audio en ' + g.language : 'Version audio',
          category: '',
          description: [g.description, intro].filter(Boolean).join('\n\n'),
          price: g.price,
          status: 'disponible',
          duration: g.minutes || 0,
          cover: await Catalog.coverFor(g.key)
        });
        audioCount++;
      }
    } catch (e) { audioProblem = true; }
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    shop: {
      name: set.academyName || 'Seyda Zeynab Academy',
      tagline: set.tagline || '',
      whatsapp: Catalog.whatsapp(),
      phone: set.phone || '',
      address: set.address || '',
      note: Catalog.note()
    },
    items,
    _audioCount: audioCount,
    _audioProblem: audioProblem
  };
};

// Génère catalogue.json et l'enregistre dans les téléchargements du téléphone
Catalog.download = async function () {
  Utils.toast('Préparation du catalogue…');
  let data;
  try { data = await Catalog.build(); }
  catch (e) { console.error(e); Utils.toast('Impossible de préparer le catalogue.', 'err'); return; }
  const audioCount = data._audioCount, audioProblem = data._audioProblem;
  delete data._audioCount; delete data._audioProblem;
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'catalogue.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  DB.data.settings.shopLastGen = { at: data.generatedAt, count: data.items.length, audios: audioCount, size: json.length };
  DB.save();
  if (audioProblem) Utils.toast("Catalogue prêt, mais les audios n'ont pas pu être chargés (connexion admin ?).", 'warn');
  else Utils.toast('catalogue.json enregistré ✅ Envoyez-le maintenant sur GitHub.');
  Router.render();
};

Catalog.toggle = function (bookId, on) {
  const b = DB.getBook(bookId);
  if (!b) return;
  b.shop = !!on;
  DB.save();
  Router.render();
};

Catalog.saveField = function (key, value) {
  DB.data.settings[key] = value;
  DB.save();
  Utils.toast('Enregistré ✅');
};

Catalog.copyLink = function () {
  navigator.clipboard.writeText(Catalog.shopUrl())
    .then(() => Utils.toast('Lien copié ✅'))
    .catch(() => Utils.toast('Copie impossible : recopiez le lien à la main.', 'err'));
};
Catalog.shareLink = function () {
  const text = 'Assalamou alaykoum 🌿 Découvrez nos livres, e-books et audios, et commandez directement ici : ' + Catalog.shopUrl();
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
};
Catalog.openShop = function (preview) {
  window.open(Catalog.shopUrl() + (preview ? '?apercu=1' : ''), '_blank');
};

Pages.catalog = function () {
  const s = DB.data.settings;
  const url = Catalog.shopUrl();
  const books = [...DB.data.books].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const shown = books.filter(b => b.shop !== false).length;
  const last = s.shopLastGen;
  let audioBlock = '';
  if (Catalog.includeAudio()) {
    if (!Pages.audioCache) {
      audioBlock = `<button class="btn btn-outline btn-sm mt-8" onclick="Catalog.loadAudios()">🎧 Charger la liste de mes audios</button>`;
    } else {
      const groups = Catalog.audioGroups(Pages.audioCache);
      audioBlock = groups.length ? `
        <p class="meta mt-8" style="margin-bottom:6px">Les chapitres d'un même livre sont regroupés en <strong>un seul audio</strong> dans la boutique. Le prix par défaut est la somme des chapitres.</p>
        ${groups.map(g => `
          <div class="list-item" style="${g.show ? '' : 'opacity:.55'};margin-bottom:8px;flex-wrap:wrap">
            <input type="checkbox" ${g.show ? 'checked' : ''} onchange="Catalog.toggleAudioGroup('${g.id}', this.checked)" style="width:22px;height:22px;flex-shrink:0">
            <div class="content" style="min-width:140px">
              <div class="title">🎧 ${Utils.escapeHtml(g.title)}</div>
              <div class="meta">${g.count} chapitre(s)${g.minutes ? ' · ' + g.minutes + ' min' : ''} · somme ${Utils.money(g.sum)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <input type="number" min="0" value="${g.price}" onchange="Catalog.setAudioPrice('${g.id}', this.value)" style="width:92px;padding:8px;border-radius:8px;border:1.5px solid var(--cream-dark);background:var(--cream)">
              <span class="meta">${Utils.escapeHtml(DB.data.settings.currency || 'FCFA')}</span>
            </div>
          </div>`).join('')}` : `<p class="meta mt-8">Aucun audio trouvé.</p>`;
    }
  }

  const rows = books.length ? books.map(b => {
    const on = b.shop !== false;
    const st = Catalog.statusOf(b);
    const badge = st === 'rupture' ? '<span class="badge badge-danger">Rupture</span>'
      : st === 'limite' ? '<span class="badge badge-warn">Stock faible</span>'
      : '<span class="badge badge-ok">Disponible</span>';
    const thumb = b.cover
      ? `<img src="${b.cover}" alt="" style="width:42px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0">`
      : `<div class="avatar">${b.type === 'ebook' ? '💻' : '📘'}</div>`;
    return `
      <label class="list-item" style="cursor:pointer;${on ? '' : 'opacity:.55'}">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="Catalog.toggle('${b.id}', this.checked)" style="width:22px;height:22px;flex-shrink:0">
        ${thumb}
        <div class="content">
          <div class="title">${Utils.escapeHtml(b.title)}</div>
          <div class="meta">${b.type === 'ebook' ? '💻 E-book' : '📄 Papier'} · ${Utils.money(b.price)}</div>
        </div>
        <div class="trail">${badge}</div>
      </label>`;
  }).join('') : `<div class="empty-state"><div class="ic">📚</div><p>Ajoutez d'abord des livres dans la bibliothèque.</p></div>`;

  return `
    <div class="page-title">
      <div><span class="eyebrow">Vente en ligne</span><h2>Boutique clients</h2></div>
    </div>
    <p class="meta" style="margin-bottom:14px">Vos clients ouvrent un lien, voient vos livres exposés, choisissent et envoient leur commande sur WhatsApp.</p>

    <div class="card mb-8">
      <h3 style="font-size:1rem">🔗 Le lien à donner à vos clients</h3>
      <input type="text" readonly value="${Utils.escapeHtml(url)}" onclick="this.select()" style="width:100%;margin-top:10px;padding:10px;border-radius:10px;border:1.5px solid var(--cream-dark);background:var(--cream);font-size:.82rem">
      <div class="tag-row mt-16">
        <button class="btn btn-primary btn-sm" onclick="Catalog.copyLink()">📋 Copier le lien</button>
        <button class="btn btn-gold btn-sm" onclick="Catalog.shareLink()">📲 Partager sur WhatsApp</button>
        <button class="btn btn-outline btn-sm" onclick="Catalog.openShop(false)">🌐 Voir la boutique</button>
      </div>
    </div>

    <div class="card mb-8">
      <h3 style="font-size:1rem">⚙️ Réglages de la boutique</h3>
      <div class="form-group mt-16">
        <label>Numéro WhatsApp qui reçoit les commandes</label>
        <input type="tel" value="${Utils.escapeHtml(Catalog.whatsappDisplay())}" onchange="Catalog.saveField('shopWhatsapp', this.value.trim())">
      </div>
      <div class="form-group">
        <label>Message affiché aux clients (paiement, livraison…)</label>
        <textarea rows="3" onchange="Catalog.saveField('shopNote', this.value.trim())">${Utils.escapeHtml(Catalog.note())}</textarea>
      </div>
      <div class="stock-row">
        <span>Afficher aussi mes audios</span>
        <input type="checkbox" ${Catalog.includeAudio() ? 'checked' : ''} onchange="Catalog.saveField('shopIncludeAudio', this.checked); Router.render()" style="width:22px;height:22px">
      </div>
      ${audioBlock}
    </div>

    <div class="section-block">
      <h3>📚 Livres affichés dans la boutique (${shown} sur ${books.length})</h3>
      <p class="meta" style="margin-bottom:10px">Cochez ce que vos clients doivent voir. Les prix de revient, le stock exact et vos ventes ne sont jamais publiés.</p>
      <div class="list">${rows}</div>
    </div>

    <div class="card mb-8" style="border-left:4px solid var(--gold)">
      <h3 style="font-size:1rem">📤 Publier la boutique</h3>
      <p class="meta mt-8">À faire après chaque ajout ou changement de prix :</p>
      <ol style="margin:10px 0 0 18px;font-size:.88rem;line-height:1.55">
        <li>Appuyez sur « Générer le catalogue » : le fichier <strong>catalogue.json</strong> est enregistré dans les Téléchargements.</li>
        <li>Sur GitHub : <strong>Add file → Upload files</strong>, choisissez <strong>catalogue.json</strong>, puis <strong>Commit changes</strong>.</li>
        <li>Après 1 à 2 minutes, la boutique est à jour pour tous vos clients.</li>
      </ol>
      <div class="tag-row mt-16">
        <button class="btn btn-primary" onclick="Catalog.download()">📤 Générer le catalogue</button>
        <button class="btn btn-outline" onclick="Catalog.openShop(true)">👁 Aperçu sur ce téléphone</button>
      </div>
      <p class="meta mt-8">${last ? `Dernier catalogue généré le ${Utils.dateTimeFmt(last.at)} : ${last.count} produit(s)${last.audios ? ' dont ' + last.audios + ' audio(s)' : ''}.` : 'Aucun catalogue généré pour le moment.'}</p>
    </div>
  `;
};
