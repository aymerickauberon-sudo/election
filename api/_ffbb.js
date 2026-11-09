// Lecture des données publiques du site competitions.ffbb.com
// Les pages sont rendues par Next.js : les données (équipes, calendrier, salle)
// sont présentes en JSON dans les scripts `self.__next_f.push([1,"..."])`.

export const BASE = 'https://competitions.ffbb.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const CORS_PROXIES = [
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

export async function fetchUrl(url, headers = {}) {
  if (typeof window === 'undefined') {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
    return r;
  }
  let lastErr;
  for (const makeProxy of CORS_PROXIES) {
    try {
      const r = await fetch(makeProxy(url));
      if (r.ok) return r;
      lastErr = new Error(`Proxy HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`Impossible de récupérer ${url}`);
}

export async function fetchPage(path, base = BASE) {
  const r = await fetchUrl(base + path, { 'Accept': 'text/html' });
  return r.text();
}

// Reconstitue le flux de données Next.js contenu dans la page
export function decodeFlight(html) {
  const out = [];
  const re = /<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch { /* morceau illisible : ignoré */ }
  }
  return out.join('');
}

// Fin d'un objet JSON qui commence à `start` (gère les chaînes et l'imbrication)
function objectEnd(text, start) {
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Tous les objets {"id":"...", ...} qui contiennent la clé `marker` juste après l'id
export function extractObjects(text, marker) {
  const found = new Map();
  let i = -1;
  while ((i = text.indexOf(marker, i + 1)) >= 0) {
    const start = text.lastIndexOf('{"id":"', i);
    if (start < 0 || i - start > 60) continue;
    const end = objectEnd(text, start);
    if (end < 0) continue;
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (obj && obj.id && !found.has(obj.id)) found.set(obj.id, obj);
    } catch { /* objet tronqué : ignoré */ }
  }
  return [...found.values()];
}

// Équipes engagées du club
export async function getClubTeams(clubPath, base = BASE) {
  const data = decodeFlight(await fetchPage(clubPath, base));
  return extractObjects(data, '"categorie":"')
    .filter(t => typeof t.url_competition === 'string' && t.url_competition.startsWith(clubPath + '/equipes/'))
    .map(t => ({
      id: t.id,
      numeroEquipe: t.numeroEquipe || '',
      categorie: t.categorie || '',
      competition: t.competition || '',
      label: t.label || '',
      sexe: t.sexe || '',
      type: t.type || '',
      logo: t.logo || null,
      url: t.url_competition,
    }));
}

// Calendrier d'une équipe
export async function getTeamMatches(team, base = BASE) {
  const data = decodeFlight(await fetchPage(team.url, base));
  return extractObjects(data, '"date_rencontre":"').map(m => ({
    id: m.id,
    date: m.date_rencontre,            // heure locale (Paris), sans fuseau
    joue: !!m.joue,
    journee: m.numeroJournee || '',
    url: m.url_competition || '',
    equipe1: side(m.idEngagementEquipe1, m.nomEquipe1),
    equipe2: side(m.idEngagementEquipe2, m.nomEquipe2),
  }));
}

function side(eng, fallbackName) {
  if (eng && typeof eng === 'object') {
    return {
      id: eng.id || null,
      nom: eng.nom || fallbackName || '',
      numero: eng.numeroEquipe || '',
      logoId: eng.idOrganisme?.logo?.id || null,
    };
  }
  return { id: null, nom: fallbackName || '', numero: '' };
}

// Salle d'un match
export async function getVenue(matchUrl, base = BASE) {
  const data = decodeFlight(await fetchPage(matchUrl, base));
  const m = data.match(/"type":"salle","informations":(\[[^\[\]]*\])/);
  if (!m) return null;
  try {
    const infos = JSON.parse(m[1]);
    const get = l => (infos.find(x => x.label === l) || {}).value || '';
    return { nom: get('Nom'), adresse: get('Adresse') };
  } catch { return null; }
}
