/* ---------------------------------------------------------
   FILIGRANE — PDF personnalisé par client (nom, téléphone, reçu)
   Dépend de : pdf-lib (window.PDFLib), ebooks.js (Ebooks, sb), utils.js (Utils)
--------------------------------------------------------- */

// Garde seulement les caractères que la police standard sait écrire
Ebooks._safeText = function (font, text) {
  let out = '';
  for (const ch of String(text || '')) {
    try { font.widthOfTextAtSize(ch, 10); out += ch; } catch (e) { /* caractère non supporté */ }
  }
  return out.replace(/\s+/g, ' ').trim();
};

Ebooks._slug = function (s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'client';
};

// Applique le filigrane sur toutes les pages. Renvoie des octets PDF.
Ebooks.applyWatermark = async function (pdfBytes, opts) {
  const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const light = await doc.embedFont(StandardFonts.Helvetica);

  const name = Ebooks._safeText(bold, opts.name) || 'Client';
  const phone = Ebooks._safeText(bold, opts.phone);
  const ref = Ebooks._safeText(bold, opts.ref);
  const main = Ebooks._safeText(bold, phone ? `${name} - ${phone}` : name);
  const foot = Ebooks._safeText(light,
    `Exemplaire personnel de ${name}${phone ? ' - ' + phone : ''}${ref ? ' - Reçu n° ' + ref : ''}. Reproduction et partage interdits.`);

  const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const diag = Math.sqrt(width * width + height * height);

    // Texte diagonal, centré, adapté à la taille de la page
    const unit = bold.widthOfTextAtSize(main, 1);
    const size = Math.min(34, (diag * 0.62) / unit);
    const tw = unit * size;
    page.drawText(main, {
      x: width / 2 - (tw / 2) * cos + (size / 3) * sin,
      y: height / 2 - (tw / 2) * sin - (size / 3) * cos,
      size, font: bold, color: rgb(0.35, 0.35, 0.35), opacity: 0.16, rotate: degrees(45)
    });

    // Ligne discrète en bas de chaque page
    const fsize = 7;
    const fw = light.widthOfTextAtSize(foot, fsize);
    const fs = fw > width - 40 ? fsize * (width - 40) / fw : fsize;
    page.drawText(foot, {
      x: Math.max(20, (width - light.widthOfTextAtSize(foot, fs)) / 2), y: 12,
      size: fs, font: light, color: rgb(0.3, 0.3, 0.3), opacity: 0.7
    });
  }

  doc.setSubject(foot);
  doc.setKeywords([name, phone, ref].filter(Boolean));
  return await doc.save();
};

// Récupère le PDF original du livre dans le stockage privé
Ebooks.fetchOriginal = async function (bookId) {
  if (!(await Ebooks.ensureLogin())) return null;
  const info = await Ebooks.getInfo(bookId);
  if (!info || !info.storage_path) {
    Utils.toast('Aucun fichier PDF envoyé pour ce livre', 'err'); return null;
  }
  let { data, error } = await sb.storage.from('E-books').download(info.storage_path);
  if (error || !data) {
    const { data: signed, error: sErr } = await sb.storage.from('E-books').createSignedUrl(info.storage_path, 300);
    if (sErr || !signed) { Utils.toast('Lecture du PDF impossible : ' + (sErr?.message || error?.message), 'err'); return null; }
    const res = await fetch(signed.signedUrl);
    if (!res.ok) { Utils.toast('Lecture du PDF impossible', 'err'); return null; }
    data = await res.blob();
  }
  return { bytes: await data.arrayBuffer(), info };
};

// Génère le PDF filigrané : { blob, filename }
Ebooks.makeWatermarked = async function (bookId, clientName, clientPhone, ref) {
  if (!window.PDFLib) { Utils.toast('Module filigrane non chargé, vérifiez la connexion', 'err'); return null; }
  const orig = await Ebooks.fetchOriginal(bookId);
  if (!orig) return null;
  try {
    const bytes = await Ebooks.applyWatermark(orig.bytes, { name: clientName, phone: clientPhone, ref });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const filename = `${Ebooks._slug(orig.info.title || 'livre')}_${Ebooks._slug(clientName)}.pdf`;
    return { blob, filename };
  } catch (e) {
    Utils.toast('Erreur filigrane : ' + e.message, 'err'); return null;
  }
};

// Génère puis partage (WhatsApp, etc.) ou télécharge le PDF filigrané
Ebooks.sendWatermarked = async function (bookId, clientName, clientPhone, ref) {
  Utils.toast('Création du PDF filigrané…');
  const out = await Ebooks.makeWatermarked(bookId, clientName, clientPhone, ref);
  if (!out) return false;
  const file = new File([out.blob], out.filename, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: out.filename }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out.blob); a.download = out.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  Utils.toast('PDF filigrané prêt ✅');
  return true;
};
