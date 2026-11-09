// Assemble les matchs d'un week-end pour l'affiche
import { BASE, fetchUrl, getClubTeams, getTeamMatches, getVenue } from './_ffbb.js';

const DAY = 86400000;

// Date du jour à Paris, au format YYYY-MM-DD
export function todayParis() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const iso = d => d.toISOString().slice(0, 10);
const parse = s => new Date(s + 'T12:00:00Z');

// Samedi visé : celui de la semaine en cours (aujourd'hui si on est samedi),
// le samedi suivant si on est dimanche.
export function targetSaturday(today = todayParis()) {
  const d = parse(today);
  const dow = d.getUTCDay(); // 0 = dimanche
  const delta = dow === 0 ? 6 : 6 - dow;
  return iso(new Date(d.getTime() + delta * DAY));
}

function cleanName(nom) {
  return (nom || '')
    .replace(/^IE\s*-\s*/i, '')          // "IE - " = inter-équipes
    .replace(/\s*-\s*1$/, '')            // équipe 1 : pas de suffixe
    .replace(/\bBASKET[\s-]?BALL\b/gi, 'BB')
    .replace(/\s+/g, ' ').trim();
}

function displayName(side, isClub, clubNumbers) {
  let n = cleanName(side.nom);
  const num = side.numero;
  if (isClub) {
    // "MACCABI SARCELLES" pour l'équipe 1, "MACCABI SARCELLES 2" pour la 2
    n = n.replace(/\s*-\s*\d+$/, '');
    if (num && num !== '1' && clubNumbers > 1) n += ' ' + num;
  } else if (num && num !== '1' && !/-\s*\d+$/.test(n)) {
    n += ' - ' + num;
  }
  return n;
}

const YOUTH_ORDER = ['U21', 'U20', 'U18', 'U17', 'U15', 'U13', 'U11', 'U9', 'U7'];

function categoryLabel(team, num, sameCat) {
  const fem = team.sexe === 'F';
  if (team.categorie === 'SE') {
    if (fem) return sameCat > 1 ? `Senior F${num}` : 'Senior F';
    return sameCat > 1 ? `Senior ${num}` : 'Senior';
  }
  let l = team.categorie + (fem ? ' F' : '');
  if (sameCat > 1) l += ' ' + num;
  return l;
}

function sortKey(team, num) {
  const se = team.categorie === 'SE' ? 0 : 1;
  const sex = team.sexe === 'F' ? 1 : 0;
  const yi = YOUTH_ORDER.indexOf(team.categorie);
  const age = se === 0 ? 0 : (yi < 0 ? 99 : yi);
  return [se, se === 0 ? sex : age, se === 0 ? 0 : sex, Number(num) || 1];
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

const clubLogoUrl = id => id ? `https://api.ffbb.app/assets/${id}?height=300&format=png` : null;

function toBase64(ab) {
  if (typeof Buffer !== 'undefined') return Buffer.from(ab).toString('base64');
  const bytes = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function badgeDataUrl(logo) {
  if (!logo) return null;
  const pngUrl = /format=/.test(logo) ? logo.replace(/format=\w+/, 'format=png') : logo;
  try {
    let r;
    try {
      r = await fetch(pngUrl);
      if (!r.ok) throw new Error();
    } catch {
      r = await fetchUrl(pngUrl);
    }
    const ab = await r.arrayBuffer();
    return 'data:image/png;base64,' + toBase64(ab);
  } catch { return null; }
}

export async function buildWeekend({ clubPath, saturday, includeFriday = false, withLogos = false, base = BASE }) {
  const sat = saturday || targetSaturday();
  const from = iso(new Date(parse(sat).getTime() - (includeFriday ? DAY : 0)));
  const to = iso(new Date(parse(sat).getTime() + DAY));

  const teams = await getClubTeams(clubPath, base);
  const clubIds = new Set(teams.map(t => t.id));

  // nombre d'équipes par catégorie+sexe (pour "Senior 1" / "Senior 2")
  const counts = {};
  for (const t of teams) {
    if (t.type && t.type !== 'DIV') continue;
    const k = t.categorie + t.sexe; counts[k] = (counts[k] || 0) + 1;
  }

  const perTeam = await Promise.all(teams.map(async t => {
    try { return { team: t, matches: await getTeamMatches(t, base) }; }
    catch (e) { return { team: t, matches: [], error: String(e.message || e) }; }
  }));

  const seen = new Set();
  const selected = [];
  for (const { team, matches } of perTeam) {
    for (const m of matches) {
      const day = (m.date || '').slice(0, 10);
      if (day < from || day > to || seen.has(m.id)) continue;
      if (/EXEMPT/i.test(m.equipe1.nom) || /EXEMPT/i.test(m.equipe2.nom)) continue;
      seen.add(m.id);
      selected.push({ team, m });
    }
  }

  const badgeCache = {};
  const out = await Promise.all(selected.map(async ({ team, m }) => {
    const homeIsClub = clubIds.has(m.equipe1.id);
    const awayIsClub = clubIds.has(m.equipe2.id);
    const n = counts[team.categorie + team.sexe] || 1;
    // le numéro d'équipe (1, 2…) est donné côté match, pas dans la liste du club
    const clubSide = homeIsClub ? m.equipe1 : m.equipe2;
    const num = clubSide.numero || team.numeroEquipe || '1';
    const time = (m.date || '').slice(11, 16);
    if (!(team.competition in badgeCache)) badgeCache[team.competition] = badgeDataUrl(team.logo);
    const logo = side => {
      if (!withLogos || clubIds.has(side.id) || !side.logoId) return null;
      const k = 'club:' + side.logoId;
      if (!(k in badgeCache)) badgeCache[k] = badgeDataUrl(clubLogoUrl(side.logoId));
      return badgeCache[k];
    };
    const [venue, badge, logoDomicile, logoExterieur] = await Promise.all([
      m.url ? getVenue(m.url, base).catch(() => null) : null,
      badgeCache[team.competition],
      logo(m.equipe1),
      logo(m.equipe2),
    ]);
    return {
      id: m.id,
      date: m.date.slice(0, 10),
      heure: time && time !== '00:00' ? time : null, // 00:00 = horaire pas encore fixé
      categorie: categoryLabel(team, num, n),
      competition: team.competition,
      competitionLabel: team.label,
      domicile: displayName(m.equipe1, homeIsClub, n),
      exterieur: displayName(m.equipe2, awayIsClub, n),
      aDomicile: homeIsClub,
      salle: venue ? venue.nom : '',
      adresse: venue ? venue.adresse : '',
      badge,
      ...(withLogos ? { logoDomicile, logoExterieur, domicileEstClub: homeIsClub, exterieurEstClub: awayIsClub } : {}),
      categorieCode: team.categorie,
      sexe: team.sexe,
      url: m.url ? base + m.url : null,
      _sort: sortKey(team, num),
    };
  }));

  out.sort((a, b) => cmp(a._sort, b._sort) || a.date.localeCompare(b.date));
  out.forEach(o => delete o._sort);

  return {
    samedi: sat, du: from, au: to,
    equipes: teams.map(t => ({ categorie: t.categorie, sexe: t.sexe, competition: t.competition, label: t.label })),
    erreurs: perTeam.filter(p => p.error).map(p => ({ equipe: p.team.label, erreur: p.error })),
    matchs: out,
  };
}
