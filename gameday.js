import { drawPoster, buildSvg, loadFonts, loadImage, W } from './gameday-poster.js';
import { processPlayerImage } from './gameday-pipeline.js';
import { buildWeekend } from './api/_build.js';
import { mountTopNav } from './services.js';

mountTopNav('gameday');

const $ = s => document.querySelector(s);
const MACCABI = 'assets/gd_maccabi.png';
const PLAYER = 'assets/gd_player.webp';
const DEFAULT_CLUB_PATH = '/ligues/idf/comites/0095/clubs/idf0095045';
const KEY = 'gameday-v1';

// Contenu de départ : l'affiche d'origine
const d = {
  topLeft: 'CHAMPIONNAT\nPRÉ RÉGIONAL', topRight: 'SAISON\n2026 / 2027',
  date: '17/10', time: '20h30',
  team1: 'MACCABI SARCELLES', team2: 'COULOMMIERS BRIE BASKET',
  gym: 'GYMNASE ALBERT CAMUS', address: '20 rue Raymond Radiguet, 95200 SARCELLES',
  slogan: 'Venez soutenir une équipe soudée\nqui se bat avec caractère et détermination.',
  cheer: 'Allez Maccabi Sarcelles !!!',
  logo1: MACCABI, logo2: 'assets/gd_exemple_adversaire.png', badge: 'assets/gd_exemple_badge.png',
  playerPhoto: PLAYER, bgPhoto: null,
  crop: { on: false, zoom: 1, dx: 0, dy: 0 },
  bgCrop: { on: false, zoom: 1, dx: 0, dy: 0 },
};
const TEXTS = ['topLeft', 'topRight', 'date', 'time', 'team1', 'team2', 'gym', 'address', 'slogan', 'cheer'];
const state = { samedi: null, matches: [], selected: null };
let activeTouchTarget = 'player'; // 'player' | 'bg'

// ---------- Mémoire locale (textes et logos FFBB, pas les photos importées) ----------
function save() {
  try {
    const keep = {};
    for (const k of TEXTS) keep[k] = d[k];
    for (const k of ['logo1', 'logo2', 'badge']) keep[k] = d[k] && d[k].length < 400000 ? d[k] : null;
    keep.crop = d.crop;
    keep.bgCrop = d.bgCrop;
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch { /* stockage indisponible */ }
}
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) {
      Object.assign(d, s, {
        crop: { ...d.crop, ...(s.crop || {}) },
        bgCrop: { ...d.bgCrop, ...(s.bgCrop || {}) },
      });
    }
  } catch { /* rien */ }
}

// ---------- Dates ----------
const addDays = (iso, n) => { const t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const jour = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const heure = h => (h ? `${Number(h.slice(0, 2))}h${h.slice(3, 5)}` : '');
function saison(iso) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `SAISON\n${start} / ${start + 1}`;
}

// "PNM" → PRÉ NATIONAL, "RM3" → RÉGIONAL 3, "DMU18-3" → CHAMPIONNAT U18 / DÉPARTEMENTAL 3…
function championnat(code, label) {
  const m = /^(PN|PR|N|R|D)([MF])(U\d+)?-?(\d+)?$/i.exec(code || '');
  if (!m) return (label ? `${label}` : 'MATCH').toUpperCase().replace(/\s*-\s*/, '\n');
  const niveau = { PN: 'PRÉ NATIONAL', PR: 'PRÉ RÉGIONAL', N: 'NATIONAL', R: 'RÉGIONAL', D: 'DÉPARTEMENTAL' }[m[1].toUpperCase()];
  const l1 = ['CHAMPIONNAT', m[3] ? m[3].toUpperCase() : '', m[2].toUpperCase() === 'F' ? 'FÉMININ' : ''].filter(Boolean).join(' ');
  return `${l1}\n${niveau}${m[4] ? ' ' + m[4] : ''}`;
}
const adresse = a => (a || '').replace(/(\d{5}\s+)(.+)$/, (_, cp, ville) => cp + ville.toUpperCase());

// ---------- Matchs FFBB (avec fallback navigateur statique) ----------
async function fetchGamedayMatches() {
  const q = new URLSearchParams({ logos: '1', vendredi: '1' });
  if (state.samedi) q.set('samedi', state.samedi);
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
  return buildWeekend({
    clubPath: DEFAULT_CLUB_PATH,
    saturday: state.samedi || undefined,
    includeFriday: true,
    withLogos: true,
  });
}

async function charger() {
  const btn = $('#charger'); btn.disabled = true; btn.textContent = 'Lecture du site FFBB…';
  $('#message').textContent = '';
  try {
    const data = await fetchGamedayMatches();
    state.samedi = data.samedi; state.matches = data.matchs; state.selected = null;
    $('#message').textContent = data.matchs.length
      ? 'Touchez un match ci-dessous pour remplir automatiquement l\'affiche.'
      : 'Aucun match trouvé sur le site FFBB pour ce week-end.';
  } catch (e) {
    $('#message').textContent = 'Erreur : ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Récupérer les matchs';
    if (state.samedi) $('#semaine').textContent = `${jour(addDays(state.samedi, -1))} → ${jour(addDays(state.samedi, 1))}`;
    listeMatchs();
  }
}

function listeMatchs() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  $('#matchs').innerHTML = state.matches.map((m, i) => `
    <button type="button" class="match" data-i="${i}" aria-pressed="${state.selected === i}">
      <span><b>${esc(m.domicile)}</b> vs <b>${esc(m.exterieur)}</b></span>
      <span class="q">${esc(m.categorie)} · ${esc(jour(m.date))}${m.heure ? ' · ' + heure(m.heure) : ' · ⚠ Horaire à fixer'}</span>
    </button>`).join('');
}

$('#matchs').addEventListener('click', e => {
  const b = e.target.closest('.match'); if (!b) return;
  const m = state.matches[Number(b.dataset.i)];
  state.selected = Number(b.dataset.i);
  // l'équipe qui reçoit est toujours en premier (domicile = en haut)
  Object.assign(d, {
    team1: m.domicile, team2: m.exterieur,
    date: ddmm(m.date), time: heure(m.heure),
    gym: (m.salle || '').toUpperCase(), address: adresse(m.adresse),
    topLeft: championnat(m.competition, m.competitionLabel), topRight: saison(m.date),
    logo1: m.domicileEstClub ? MACCABI : (m.logoDomicile || null),
    logo2: m.exterieurEstClub ? MACCABI : (m.logoExterieur || null),
    badge: m.badge || null,
  });
  $('#message').textContent = m.heure ? 'Match chargé dans l\'affiche.' : 'L\'horaire n\'est pas encore fixé sur le site FFBB : complète le champ Heure.';
  remplir(); listeMatchs(); dessiner();
});

// ---------- Formulaire ----------
function remplir() {
  for (const k of TEXTS) $('#' + k).value = d[k] || '';
  document.querySelectorAll('.slot').forEach(s => {
    const src = d[s.dataset.slot];
    s.querySelector('.vign').style.backgroundImage = src ? `url("${src}")` : 'none';
  });
  $('#c-' + (d.crop.on ? 'on' : 'off')).checked = true;
  $('#recadrage').hidden = !d.crop.on;
  $('#zoom').value = Math.round(d.crop.zoom * 100);
  $('#zoomVal').textContent = `${Math.round(d.crop.zoom * 100)}%`;
  $('#dx').value = d.crop.dx; $('#dy').value = d.crop.dy;

  $('#bgc-' + (d.bgCrop.on ? 'on' : 'off')).checked = true;
  $('#bgRecadrage').hidden = !d.bgCrop.on;
  $('#bgZoom').value = Math.round(d.bgCrop.zoom * 100);
  $('#bgZoomVal').textContent = `${Math.round(d.bgCrop.zoom * 100)}%`;
  $('#bgDx').value = d.bgCrop.dx; $('#bgDy').value = d.bgCrop.dy;

  $('#affiche').classList.toggle('drag', d.crop.on || d.bgCrop.on);
}

for (const k of TEXTS) $('#' + k).addEventListener('input', e => { d[k] = e.target.value; dessiner(); });

$('#inverser').addEventListener('click', () => {
  [d.team1, d.team2] = [d.team2, d.team1];
  [d.logo1, d.logo2] = [d.logo2, d.logo1];
  remplir(); dessiner();
});

const lireFichier = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

document.querySelectorAll('.slot').forEach(s => {
  const k = s.dataset.slot;
  s.querySelector('input[type=file]').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    d[k] = await lireFichier(f); e.target.value = ''; remplir(); dessiner();
  });
  s.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => {
    d[k] = b.dataset.a === 'maccabi' ? MACCABI : null; remplir(); dessiner();
  }));
});

let rawPlayerPhoto = PLAYER;
let isDefaultPlayer = true;

async function applyPlayerPipeline() {
  const st = $('#pipelineStatus');
  const usePipeline = $('#playerPipeline')?.checked ?? true;
  if (!usePipeline) {
    d.playerPhoto = rawPlayerPhoto;
    if (st) st.textContent = 'Retouche Pro désactivée (image brute affichée).';
    dessiner();
    return;
  }
  if (st) st.textContent = 'Application du pipeline Retouche Pro + Halo bleu…';
  try {
    const res = await processPlayerImage(rawPlayerPhoto, { cropToBbox: !isDefaultPlayer });
    d.playerPhoto = res.dataUrl;
    if (st) {
      st.textContent = `Retouche Pro active · ${res.width} × ${res.height} px · Transparence conservée : ${res.hasTransparency ? 'oui' : 'non'}`;
    }
  } catch {
    d.playerPhoto = rawPlayerPhoto;
    if (st) st.textContent = 'Impossible d’appliquer la retouche sur cette image.';
  }
  dessiner();
}

$('#playerFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  rawPlayerPhoto = await lireFichier(f);
  isDefaultPlayer = false;
  e.target.value = '';
  d.crop = { on: true, zoom: 1, dx: 0, dy: 0 };
  activeTouchTarget = 'player';
  remplir();
  await applyPlayerPipeline();
});
$('#playerReset').addEventListener('click', async () => {
  rawPlayerPhoto = PLAYER;
  isDefaultPlayer = true;
  d.crop = { on: false, zoom: 1, dx: 0, dy: 0 };
  remplir();
  await applyPlayerPipeline();
});
$('#playerPipeline').addEventListener('change', applyPlayerPipeline);

$('#bgFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  d.bgPhoto = await lireFichier(f);
  e.target.value = '';
  d.bgCrop = { on: true, zoom: 1, dx: 0, dy: 0 };
  activeTouchTarget = 'bg';
  remplir();
  dessiner();
});
$('#bgReset').addEventListener('click', () => {
  d.bgPhoto = null;
  d.bgCrop = { on: false, zoom: 1, dx: 0, dy: 0 };
  remplir();
  dessiner();
});

document.querySelectorAll('input[name=crop]').forEach(r => r.addEventListener('change', () => {
  d.crop.on = r.value === 'on';
  if (d.crop.on) activeTouchTarget = 'player';
  remplir(); dessiner();
}));
$('#zoom').addEventListener('input', e => {
  activeTouchTarget = 'player';
  d.crop.zoom = Number(e.target.value) / 100;
  $('#zoomVal').textContent = `${e.target.value}%`;
  dessiner();
});
$('#dx').addEventListener('input', e => { activeTouchTarget = 'player'; d.crop.dx = Number(e.target.value); dessiner(); });
$('#dy').addEventListener('input', e => { activeTouchTarget = 'player'; d.crop.dy = Number(e.target.value); dessiner(); });
$('#cropReset').addEventListener('click', () => { activeTouchTarget = 'player'; d.crop = { on: true, zoom: 1, dx: 0, dy: 0 }; remplir(); dessiner(); });

document.querySelectorAll('input[name=bgCrop]').forEach(r => r.addEventListener('change', () => {
  d.bgCrop.on = r.value === 'on';
  if (d.bgCrop.on) activeTouchTarget = 'bg';
  remplir(); dessiner();
}));
$('#bgZoom').addEventListener('input', e => {
  activeTouchTarget = 'bg';
  d.bgCrop.zoom = Number(e.target.value) / 100;
  $('#bgZoomVal').textContent = `${e.target.value}%`;
  dessiner();
});
$('#bgDx').addEventListener('input', e => { activeTouchTarget = 'bg'; d.bgCrop.dx = Number(e.target.value); dessiner(); });
$('#bgDy').addEventListener('input', e => { activeTouchTarget = 'bg'; d.bgCrop.dy = Number(e.target.value); dessiner(); });
$('#bgCropReset').addEventListener('click', () => { activeTouchTarget = 'bg'; d.bgCrop = { on: true, zoom: 1, dx: 0, dy: 0 }; remplir(); dessiner(); });

// Glisser 1 doigt + pincer 2 doigts la photo active (joueur ou fond) sur l'aperçu
const cv = $('#affiche');
const pointers = new Map();
let drag = null;
let pinch = null;

function getActiveCropObj() {
  if (activeTouchTarget === 'bg' && d.bgCrop.on) return { target: 'bg', obj: d.bgCrop };
  if (activeTouchTarget === 'player' && d.crop.on) return { target: 'player', obj: d.crop };
  if (d.bgCrop.on) return { target: 'bg', obj: d.bgCrop };
  if (d.crop.on) return { target: 'player', obj: d.crop };
  return null;
}

cv.addEventListener('pointerdown', e => {
  const active = getActiveCropObj();
  if (!active) return;
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    drag = { target: active.target, x: e.clientX, y: e.clientY, dx: active.obj.dx, dy: active.obj.dy };
    pinch = null;
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    pinch = { target: active.target, dist: Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y)), zoom: active.obj.zoom };
    drag = null;
  }
});
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinch) {
    const [p1, p2] = [...pointers.values()];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const isBg = pinch.target === 'bg';
    const targetObj = isBg ? d.bgCrop : d.crop;
    const maxZ = isBg ? 3.0 : 2.5;
    const z = Math.max(0.5, Math.min(maxZ, pinch.zoom * (dist / pinch.dist)));
    targetObj.zoom = Math.round(z * 50) / 50;
    const pct = Math.round(targetObj.zoom * 100);
    $(isBg ? '#bgZoom' : '#zoom').value = pct;
    $(isBg ? '#bgZoomVal' : '#zoomVal').textContent = `${pct}%`;
    dessiner();
    return;
  }
  if (!drag) return;
  const isBg = drag.target === 'bg';
  const targetObj = isBg ? d.bgCrop : d.crop;
  const k = W / cv.clientWidth;
  const maxX = isBg ? 600 : 500;
  targetObj.dx = Math.max(-maxX, Math.min(maxX, Math.round(drag.dx + (e.clientX - drag.x) * k)));
  targetObj.dy = Math.max(-600, Math.min(600, Math.round(drag.dy + (e.clientY - drag.y) * k)));
  $(isBg ? '#bgDx' : '#dx').value = targetObj.dx;
  $(isBg ? '#bgDy' : '#dy').value = targetObj.dy;
  dessiner();
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) drag = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);

// Onglets rapides mobile
const gdMobileTabs = $('#gdMobileTabs');
if (gdMobileTabs) {
  gdMobileTabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    const tab = btn.dataset.tab;
    gdMobileTabs.querySelectorAll('.mobile-tab').forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-tab-panel]').forEach(p => {
      p.classList.toggle('mobile-hidden', p.dataset.tabPanel !== tab);
    });
  });
}

const togglePreviewBtn = $('#toggleGdPreview');
if (togglePreviewBtn) {
  togglePreviewBtn.addEventListener('click', () => {
    const stage = $('#gdStage');
    const expanded = stage.classList.toggle('expanded');
    togglePreviewBtn.textContent = expanded ? 'Réduire' : 'Agrandir';
  });
}

// ---------- Rendu ----------
let enCours = false, encore = false;
async function dessiner() {
  if (enCours) { encore = true; return; }
  enCours = true;
  try { await drawPoster(cv, d, 1); save(); }
  finally { enCours = false; if (encore) { encore = false; dessiner(); } }
}

// ---------- Export PNG, SVG & Partage ----------
function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const slug = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nom = ext => `game-day-${slug(d.team1)}-vs-${slug(d.team2)}.${ext}`.slice(0, 90);

async function genererPngBlob() {
  const c = document.createElement('canvas');
  await drawPoster(c, d, 2);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (blob) return blob;
  const dataUrl = c.toDataURL('image/png');
  const res = await fetch(dataUrl);
  return res.blob();
}

$('#png').addEventListener('click', async () => {
  const b = $('#png'); b.disabled = true;
  try {
    telecharger(await genererPngBlob(), nom('png'));
  } catch (e) {
    $('#message').textContent = 'Erreur export PNG : ' + e.message;
  } finally {
    b.disabled = false;
  }
});

$('#svg').addEventListener('click', async () => {
  const b = $('#svg'); b.disabled = true;
  try { telecharger(new Blob([await buildSvg(d)], { type: 'image/svg+xml' }), nom('svg')); }
  finally { b.disabled = false; }
});

$('#partager').addEventListener('click', async () => {
  try {
    const file = new File([await genererPngBlob()], nom('png'), { type: 'image/png' });
    await navigator.share({ files: [file], title: 'Game Day – Maccabi Sarcelles' });
  } catch (e) {
    if (e.name !== 'AbortError') $('#message').textContent = 'Partage impossible : ' + e.message;
  }
});
if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }))) {
  $('#partager').hidden = true;
}

$('#prec').addEventListener('click', () => { if (state.samedi) { state.samedi = addDays(state.samedi, -7); charger(); } });
$('#suiv').addEventListener('click', () => { if (state.samedi) { state.samedi = addDays(state.samedi, 7); charger(); } });
$('#charger').addEventListener('click', charger);

restore();
remplir();
await loadFonts();
await Promise.all([PLAYER, MACCABI].map(loadImage));
await applyPlayerPipeline();
charger();

