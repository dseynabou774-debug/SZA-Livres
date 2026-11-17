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
      (audios || []).forEach(a => {
        if (a.active === false) return;
        items.push({
          id: 'A' + a.id,
          type: 'audio',
          title: a.title || '',
          author: a.language ? 'Audio en ' + a.language : '',
          category: '',
          description: a.description || '',
          price: Number(a.price) || 0,
          status: 'disponible',
          duration: a.duration_seconds ? Math.round(a.duration_seconds / 60) : 0,
          cover: ''
        });
        audioCount++;
      });
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
        <input type="checkbox" ${Catalog.includeAudio() ? 'checked' : ''} onchange="Catalog.saveField('shopIncludeAudio', this.checked)" style="width:22px;height:22px">
      </div>
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
