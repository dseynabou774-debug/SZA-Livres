/* ---------------------------------------------------------
   AUDIOBOOKS — connexion Supabase pour téléchargements sécurisés
--------------------------------------------------------- */
const Audiobooks = {};

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
  const { data: { session } } = await sb.auth.getSession();
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
