/* ---------------------------------------------------------
   AUDIOBOOKS — connexion Supabase pour téléchargements sécurisés
--------------------------------------------------------- */
const Audiobooks = {};

// S'assure d'avoir un jeton de session valide (pas expiré) avant d'appeler
// une Edge Function. Si le jeton est périmé, on le rafraîchit automatiquement ;
// si le rafraîchissement échoue, on force une reconnexion complète.
Audiobooks.getFreshSession = async function () {
  let { data: { session } } = await sb.auth.getSession();

  const isExpired = !session || (session.expires_at && session.expires_at * 1000 < Date.now() + 10000);

  if (isExpired) {
    const { data: refreshed, error: refreshErr } = await sb.auth.refreshSession();
    if (refreshErr || !refreshed || !refreshed.session) {
      // Le jeton est irrécupérable : on repart d'une connexion propre.
      await sb.auth.signOut();
      if (!(await Ebooks.ensureLogin())) return null;
      const retry = await sb.auth.getSession();
      session = retry.data.session;
    } else {
      session = refreshed.session;
    }
  }

  return session;
};

Audiobooks.listAll = async function () {
  if (!(await Ebooks.ensureLogin())) return [];
  const { data, error } = await sb.from('audio_products').select('*').order('title');
  if (error) { Utils.toast('Erreur chargement audios : ' + error.message, 'err'); return []; }
  return data || [];
};

Audiobooks.getInfo = async function (audioId) {
  const { data, error } = await sb.from('audio_products').select('*').eq('id', audioId).single();
  if (error) return null;
  return data;
};

Audiobooks.generateLink = async function (audioId, buyerName, buyerContact) {
  if (!(await Ebooks.ensureLogin())) return null;
  const session = await Audiobooks.getFreshSession();
  if (!session) return null;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-audio-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ audio_id: audioId, buyer_name: buyerName, buyer_contact: buyerContact })
  });
  const json = await res.json();
  if (!res.ok) { Utils.toast('Erreur lien audio : ' + (json.error || 'inconnue'), 'err'); return null; }
  return json.access_token;
};

Audiobooks.uploadFile = async function (file) {
  if (!(await Ebooks.ensureLogin())) return null;
  const path = `${Date.now()}_${file.name}`;
  const { error } = await sb.storage.from('Audio-Livres').upload(path, file, { upsert: true });
  if (error) { Utils.toast('Erreur upload audio : ' + error.message, 'err'); return null; }
  return path;
};

Audiobooks.createProduct = async function (payload) {
  if (!(await Ebooks.ensureLogin())) return null;
  const session = await Audiobooks.getFreshSession();
  if (!session) return null;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-audio-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) { Utils.toast('Erreur création audio : ' + (json.error || 'inconnue'), 'err'); return null; }
  return json.product;
};

Audiobooks.updateProduct = async function (audioId, payload) {
  if (!(await Ebooks.ensureLogin())) return false;
  const { error } = await sb.from('audio_products').update(payload).eq('id', audioId);
  if (error) { Utils.toast('Erreur mise à jour : ' + error.message, 'err'); return false; }
  return true;
};

Audiobooks.getDownloadUrl = async function (accessToken) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-audio-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken })
  });
  const json = await res.json();
  if (!res.ok) { Utils.toast('Erreur téléchargement : ' + (json.error || 'inconnue'), 'err'); return null; }
  return json;
};
