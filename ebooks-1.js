/* ---------------------------------------------------------
   EBOOKS — connexion Supabase pour téléchargements sécurisés
--------------------------------------------------------- */
const SUPABASE_URL = 'https://tpivirycaomrgfjzhoel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Kdv-5yqVudvcluAUVosUfg_HAwEhLRA';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Ebooks = {};

Ebooks.isLoggedIn = async function () {
  const { data } = await sb.auth.getSession();
  if (!data.session) return false;
  // getSession() renvoie ce qui est en cache localement, même si le jeton
  // n'est plus accepté par le serveur. On vérifie donc pour de vrai auprès
  // du serveur, et on tente un rafraîchissement silencieux si besoin.
  const { data: userCheck, error: userErr } = await sb.auth.getUser();
  if (!userErr && userCheck && userCheck.user) return true;
  const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession();
  return !refreshErr && !!refreshed && !!refreshed.session;
};

Ebooks.login = async function () {
  const email = prompt('Email admin Supabase :');
  if (!email) return false;
  const password = prompt('Mot de passe admin :');
  if (!password) return false;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { Utils.toast('Connexion admin échouée : ' + error.message, 'err'); return false; }
  Utils.toast('Connecté en tant qu\'admin ✅');
  return true;
};

Ebooks.ensureLogin = async function () {
  if (await Ebooks.isLoggedIn()) return true;
  return await Ebooks.login();
};

Ebooks.syncBook = async function (bookId, title, active) {
  if (!(await Ebooks.ensureLogin())) return null;
  const { data, error } = await sb.from('books')
    .upsert({ id: bookId, title, active }, { onConflict: 'id' })
    .select().single();
  if (error) { Utils.toast('Erreur synchro livre : ' + error.message, 'err'); return null; }
  return data;
};

Ebooks.uploadFile = async function (bookId, file) {
  if (!(await Ebooks.ensureLogin())) return false;
  const path = `${bookId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await sb.storage.from('E-books').upload(path, file, { upsert: true });
  if (upErr) { Utils.toast('Erreur upload : ' + upErr.message, 'err'); return false; }

  const { data: current } = await sb.from('books').select('version').eq('id', bookId).single();
  const newVersion = (current?.version || 0) + 1;

  const { error: updErr } = await sb.from('books')
    .update({ storage_path: path, version: newVersion, updated_at: new Date().toISOString() })
    .eq('id', bookId);
  if (updErr) { Utils.toast('Erreur mise à jour : ' + updErr.message, 'err'); return false; }

  Utils.toast('Fichier e-book envoyé ✅');
  return true;
};

Ebooks.toggleActive = async function (bookId, active) {
  if (!(await Ebooks.ensureLogin())) return false;
  const { error } = await sb.from('books').update({ active }).eq('id', bookId);
  if (error) { Utils.toast('Erreur : ' + error.message, 'err'); return false; }
  return true;
};

Ebooks.getInfo = async function (bookId) {
  const { data, error } = await sb.from('books').select('*').eq('id', bookId).single();
  if (error) return null;
  return data;
};

Ebooks.generateLink = async function (bookId, clientName, clientPhone) {
  if (!(await Ebooks.ensureLogin())) return null;
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ book_id: bookId, client_name: clientName, client_phone: clientPhone })
  });
  const json = await res.json();
  if (!res.ok) { Utils.toast('Erreur lien : ' + (json.error || 'inconnue'), 'err'); return null; }
  return json.link;
};
