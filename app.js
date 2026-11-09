import { drawPoster, loadFonts, FORMATS } from './poster.js';
import { buildWeekend } from './api/_build.js';
import { mountTopNav } from './services.js';

mountTopNav('weekend-match');

const DEFAULT_CLUB_PATH = '/ligues/idf/comites/0095/clubs/idf0095045';

const $ = s => document.querySelector(s);
const state = { samedi: null, vendredi: false, format: 'story', matches: [], badges: {} };

// ---------- Renommages mémorisés (dans ce navigateur) ----------
const RENAME_KEY = 'affiche-renommages-v1';
const loadRenames = () => { try { return JSON.parse(localStorage.getItem(RENAME_KEY)) || {}; } catch { return {}; } };
const saveRenames = r => { try { localStorage.setItem(RENAME_KEY, JSON.stringify(r)); } catch { /* stockage indisponible */ } };
let renames = loadRenames();
const RENAMABLE = ['domicile', 'exterieur', 'salle', 'adresse'];

// ---------- Utilitaires date ----------
const pad = n => String(n).padStart(2, '0');
const addDays = (iso, d) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const heureTexte = h => { if (!h) return ''; const [H, M] = h.split(':'); return M === '00' ? `${Number(H)}h` : `${Number(H)}h${M}`; };
const jourLong = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function fromApi(m) {
  const orig = { domicile: m.domicile, exterieur: m.exterieur, salle: (m.salle || '').toUpperCase(), adresse: m.adresse };
  const r = {};
  for (const k of RENAMABLE) r[k] = renames[orig[k]] ?? orig[k];
  return {
    id: m.id, include: true, _orig: orig, ...r,
    categorie: m.categorie, competition: m.competition, badge: m.badge, url: m.url,
    date: ddmm(m.date), jour: m.date, heure: heureTexte(m.heure), heureManquante: !m.heure,
  };
}
const dateTexte = m => (m.heure ? `${m.date} - ${m.heure}` : m.date);

// ---------- Chargement ----------
async function fetchMatchesData() {
  const q = new URLSearchParams();
  if (state.samedi) q.set('samedi', state.samedi);
  if (state.vendredi) q.set('vendredi', '1');
  try {
    const r = await fetch('api/matches?' + q);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await r.json();
      if (!r.ok) throw new Error(data.erreur || r.statusText);
      return data;
    }
  } catch (e) {
    if (e.message && !/fetch|network/i.test(e.message)) throw e;
  }
  // Fallback statique (GitHub Pages / Live Server sans backend Node)
  return buildWeekend({
    clubPath: DEFAULT_CLUB_PATH,
    saturday: state.samedi || undefined,
    includeFriday: state.vendredi,
  });
}

async function charger() {
  const btn = $('#charger');
  btn.disabled = true; btn.textContent = 'Lecture du site FFBB…';
  $('#message').textContent = '';
  try {
    const data = await fetchMatchesData();
    state.samedi = data.samedi;
    state.matches = data.matchs.map(fromApi);
    for (const m of data.matchs) if (m.badge) state.badges[m.competition] = m.badge;
    const n = state.matches.length;
    $('#message').textContent = n
      ? `${n} match${n > 1 ? 's' : ''} trouvé${n > 1 ? 's' : ''}.`
      : 'Aucun match trouvé sur le site FFBB pour ce week-end.';
    if (data.erreurs?.length) $('#message').textContent += ` (${data.erreurs.length} équipe(s) illisible(s))`;
  } catch (e) {
    $('#message').textContent = 'Erreur : ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Récupérer les matchs';
    majSemaine(); liste(); dessiner();
  }
}

function majSemaine() {
  if (!state.samedi) return;
  const debut = state.vendredi ? addDays(state.samedi, -1) : state.samedi;
  $('#semaine').textContent = `${jourLong(debut)} → ${jourLong(addDays(state.samedi, 1))}`;
}

// ---------- Liste éditable ----------
const champ = (m, i, k, label, extra = '') =>
  `<label class="f ${extra}"><span>${label}</span><input data-i="${i}" data-k="${k}" value="${esc(m[k] || '')}"></label>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function liste() {
  const badgeOpts = m => ['<option value="">Aucun badge</option>',
    ...Object.entries(state.badges).map(([c, b]) => `<option value="${c}" ${m.badge === b ? 'selected' : ''}>${c}</option>`)].join('');
  const defaultOpen = window.innerWidth >= 960;
  const nbActifs = state.matches.filter(m => m.include).length;
  const tabBtnListe = $('#tabBtnListe');
  if (tabBtnListe) tabBtnListe.textContent = `1. Matchs (${nbActifs}/${state.matches.length})`;

  $('#liste').innerHTML = state.matches.map((m, i) => {
    const isOpen = m._open ?? defaultOpen;
    const warnHeure = m.heureManquante && !m.heure;
    return `
    <div class="carte ${m.include ? '' : 'off'} ${isOpen ? 'open' : ''}" data-card="${i}">
      <div class="tete">
        <label class="inc"><input type="checkbox" data-i="${i}" data-k="include" ${m.include ? 'checked' : ''}> ${esc(m.categorie || 'Match')}</label>
        <div class="resume-match" data-i="${i}" data-a="toggle" title="Afficher ou réduire les détails">
          <div class="resume-equipes">${esc(m.domicile || '')} vs ${esc(m.exterieur || '')}</div>
          <div class="resume-meta">
            <span>${esc(dateTexte(m) || 'Date à définir')}</span>
            ${m.salle ? `<span>· ${esc(m.salle)}</span>` : ''}
            ${warnHeure ? '<span class="badge-warn">⚠ Horaire non fixé</span>' : ''}
          </div>
        </div>
        <span class="act">
          <button type="button" data-i="${i}" data-a="toggle" title="Modifier ce match">${isOpen ? '▴' : '✎'}</button>
          <button type="button" data-i="${i}" data-a="up" title="Monter">↑</button>
          <button type="button" data-i="${i}" data-a="down" title="Descendre">↓</button>
          <button type="button" data-i="${i}" data-a="del" title="Supprimer">✕</button>
        </span>
      </div>
      <div class="carte-details">
        <div class="grille">
          ${champ(m, i, 'categorie', 'Catégorie')}
          <label class="f"><span>Badge</span><select data-i="${i}" data-k="badgeSel">${badgeOpts(m)}</select></label>
          ${champ(m, i, 'domicile', 'Domicile', 'large')}
          ${champ(m, i, 'exterieur', 'Extérieur', 'large')}
          ${champ(m, i, 'salle', 'Salle')}
          ${champ(m, i, 'adresse', 'Adresse')}
          ${champ(m, i, 'date', 'Date')}
          ${champ(m, i, 'heure', warnHeure ? 'Heure ⚠ non fixée sur la FFBB' : 'Heure', warnHeure ? 'warn' : '')}
        </div>
        ${m.url ? `<a class="src" href="${esc(m.url)}" target="_blank" rel="noopener">Voir le match sur le site FFBB</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

$('#liste').addEventListener('input', e => {
  const t = e.target, i = Number(t.dataset.i), k = t.dataset.k;
  if (k === undefined || Number.isNaN(i)) return;
  const m = state.matches[i];
  const card = t.closest('.carte');
  if (k === 'include') {
    m.include = t.checked;
    card.classList.toggle('off', !t.checked);
    const nbActifs = state.matches.filter(x => x.include).length;
    const tabBtnListe = $('#tabBtnListe');
    if (tabBtnListe) tabBtnListe.textContent = `1. Matchs (${nbActifs}/${state.matches.length})`;
  } else if (k === 'badgeSel') {
    m.badge = state.badges[t.value] || null;
  } else {
    m[k] = t.value;
    if (k === 'heure') t.closest('.f').classList.remove('warn');
    if (k === 'categorie') {
      const incLbl = card.querySelector('.inc');
      if (incLbl && incLbl.lastChild) incLbl.lastChild.textContent = ' ' + (m.categorie || 'Match');
    }
    const eqEl = card.querySelector('.resume-equipes');
    if (eqEl) eqEl.textContent = `${m.domicile || ''} vs ${m.exterieur || ''}`;
    const metaEl = card.querySelector('.resume-meta');
    if (metaEl) {
      const warnHeure = m.heureManquante && !m.heure;
      metaEl.innerHTML = `<span>${esc(dateTexte(m) || 'Date à définir')}</span>${m.salle ? `<span>· ${esc(m.salle)}</span>` : ''}${warnHeure ? '<span class="badge-warn">⚠ Horaire non fixé</span>' : ''}`;
    }
    // mémorise le renommage pour les prochaines affiches
    const o = m._orig?.[k];
    if (RENAMABLE.includes(k) && o) {
      if (t.value && t.value !== o) renames[o] = t.value; else delete renames[o];
      saveRenames(renames);
    }
  }
  dessiner();
});

$('#liste').addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const i = Number(b.dataset.i), a = b.dataset.a, L = state.matches;
  if (a === 'toggle') {
    const card = b.closest('.carte');
    const open = !card.classList.contains('open');
    L[i]._open = open;
    card.classList.toggle('open', open);
    const toggleBtn = card.querySelector('button[data-a="toggle"]');
    if (toggleBtn) toggleBtn.textContent = open ? '▴' : '✎';
    return;
  }
  if (a === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
  if (a === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
  if (a === 'del') L.splice(i, 1);
  liste(); dessiner();
});

$('#ajouter').addEventListener('click', () => {
  state.matches.push({ include: true, _open: true, categorie: 'Senior 1', domicile: 'MACCABI SARCELLES', exterieur: 'ADVERSAIRE',
    salle: 'GYMNASE ALBERT CAMUS', adresse: '22 Rue Raymond Radiguet, 95200 Sarcelles',
    date: state.samedi ? ddmm(state.samedi) : '', heure: '', badge: null });
  liste(); dessiner();
});

// ---------- Rendu ----------
let pending = null;
let renderPromise = Promise.resolve();

function effectuerRendu() {
  const visibles = state.matches.filter(m => m.include).map(m => ({ ...m, dateTexte: dateTexte(m) }));
  renderPromise = drawPoster($('#affiche'), visibles, state.format, { subtitle: $('#soustitre').checked }).then(() => {
    $('#alerte').textContent = visibles.length > 6
      ? 'Beaucoup de matchs : les blocs sont réduits. Décoche-en quelques-uns pour garder une affiche lisible.' : '';
  });
  return renderPromise;
}

function dessiner() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    effectuerRendu();
  }, 120);
}

async function blobAffiche() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
    await effectuerRendu();
  } else {
    await renderPromise;
  }
  const canvas = $('#affiche');
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (blob) return blob;
  const dataUrl = canvas.toDataURL('image/png');
  const r = await fetch(dataUrl);
  return r.blob();
}
const nomFichier = () => `weekend-match-${state.samedi || 'affiche'}-${state.format}.png`;

$('#telecharger').addEventListener('click', async () => {
  try {
    const blob = await blobAffiche();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) {
    $('#message').textContent = 'Téléchargement PNG impossible : ' + e.message;
  }
});

$('#partager').addEventListener('click', async () => {
  const file = new File([await blobAffiche()], nomFichier(), { type: 'image/png' });
  try { await navigator.share({ files: [file], title: 'Weekend Match' }); }
  catch (e) { if (e.name !== 'AbortError') $('#message').textContent = 'Partage impossible : ' + e.message; }
});
if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }))) {
  $('#partager').hidden = true;
}

document.querySelectorAll('input[name=format]').forEach(r => r.addEventListener('change', () => {
  state.format = r.value; dessiner();
}));
$('#soustitre').addEventListener('change', dessiner);
$('#vendredi').addEventListener('change', e => { state.vendredi = e.target.checked; charger(); });
$('#prec').addEventListener('click', () => { if (state.samedi) { state.samedi = addDays(state.samedi, -7); charger(); } });
$('#suiv').addEventListener('click', () => { if (state.samedi) { state.samedi = addDays(state.samedi, 7); charger(); } });
$('#charger').addEventListener('click', charger);
$('#oublier').addEventListener('click', () => {
  renames = {}; saveRenames(renames);
  $('#message').textContent = 'Renommages oubliés. Recharge les matchs pour revenir aux noms FFBB.';
});

// Onglets mobile Liste vs Aperçu
const wmMobileTabs = $('#wmMobileTabs');
if (wmMobileTabs) {
  wmMobileTabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-wm-tab]');
    if (!btn) return;
    const tab = btn.dataset.wmTab;
    wmMobileTabs.querySelectorAll('.mobile-tab').forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    $('#panelListe').classList.toggle('wm-panel-hidden', tab !== 'liste');
    $('#panelApercu').classList.toggle('wm-panel-hidden', tab !== 'apercu');
  });
}

await loadFonts();
dessiner();
charger();
