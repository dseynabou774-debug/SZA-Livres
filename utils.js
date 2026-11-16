/* =========================================================
   utils.js — Fonctions utilitaires partagées
   ========================================================= */

const Utils = {
  money(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString('fr-FR') + ' ' + (DB.data.settings.currency || 'FCFA');
  },

  dateFmt(d) {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  dateTimeFmt(d) {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  },

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  toast(msg, type = 'ok') {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s ease';
      setTimeout(() => el.remove(), 300);
    }, 2600);
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  openModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="active-modal-overlay"><div class="modal">${html}</div></div>`;
    const overlay = document.getElementById('active-modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Utils.closeModal();
    });
  },

  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },

  startOfToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  },
  startOfWeek() {
    const d = new Date(); const day = (d.getDay() + 6) % 7; // lundi=0
    d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d;
  },
  startOfMonth() {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  },
  startOfYear() {
    const d = new Date(); d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d;
  },
  now() { return new Date(); },

  // Réduit une photo (couverture, logo) avant de la stocker. Une photo de téléphone
  // pèse plusieurs Mo et saturerait vite le stockage local de l'application.
  compressImage(file, maxSide = 700, quality = 0.82, type = 'image/jpeg') {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL(type, quality));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
      img.src = url;
    });
  },

  uidShort() {
    return Math.random().toString(36).slice(2, 8);
  },

  // Renders the payment status badge consistently everywhere (sales list,
  // client history, receipt, reports...).
  statusBadge(status) {
    if (status === 'Payé') return '<span class="badge badge-ok">Payé</span>';
    if (status === 'Partiel') return '<span class="badge badge-warn">Paiement partiel</span>';
    return '<span class="badge badge-danger">En attente</span>';
  }
};
