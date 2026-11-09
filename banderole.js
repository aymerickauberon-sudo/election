import { MACCABI_LOGO } from './logo-maccabi.js';
import { mountTopNav } from './services.js';

mountTopNav('banderole-score');

const BANNER_W = 1600;
const BANNER_H = 698;
const NAVY = '#0A0E1C';
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Barlow:wght@600;700&family=Barlow+Condensed:ital,wght@0,800;1,900&display=swap';

const FORMATS = {
  auto:   { label: 'Photo d’origine', w: 1600, h: 1066 },
  post:   { label: 'Post 4:5',        w: 1080, h: 1350 },
  square: { label: 'Carré 1:1',       w: 1080, h: 1080 },
  story:  { label: 'Story 9:16',      w: 1080, h: 1920 },
  wide:   { label: 'Paysage 16:9',    w: 1600, h: 900  },
  banner: { label: 'Banderole seule', w: 1600, h: 698  },
};

const F = {
  name:  { family: 'Barlow Condensed', weight: 800, style: 'normal', size: 78 },
  score: { family: 'Barlow Condensed', weight: 900, style: 'italic', size: 132 },
  label: { family: 'Barlow', weight: 700, style: 'normal', size: 17 },
  info:  { family: 'Barlow', weight: 600, style: 'normal', size: 17 },
};
const css = (f, size) => `${f.style} ${f.weight} ${size ?? f.size}px "${f.family}"`;
const $ = s => document.querySelector(s);
const mctx = document.createElement('canvas').getContext('2d');
const measure = (txt, f, size) => { mctx.font = css(f, size); return mctx.measureText(txt).width; };
const spacedWidth = (txt, f, ls) => {
  const ch = [...txt];
  return ch.reduce((a, c) => a + measure(c, f), 0) + ls * Math.max(0, ch.length - 1);
};

const state = {
  home: { name: 'MACCABI\nSARCELLES', score: '78', logo: null },
  away: { name: 'ÉQUIPE\nADVERSE', score: '64', logo: null },
  top: 'SCORE FINAL',
  info: '',
  bg: 'fade',
  accent: '#3D4BC9',
  scale: 2,
  format: 'auto',
  photo: null, // { src, width, height }
  photoZoom: 1,
  photoPanX: 0,
  photoPanY: 0,
  bannerScale: 100, // % de la largeur
  bannerOffsetY: 0, // décalage vertical en px (repère 1600)
};

const imgCache = new Map();
function loadImg(src) {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src));
  return new Promise(res => {
    const im = new Image();
    if (/^https?:\/\//i.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => { imgCache.set(src, im); res(im); };
    im.onerror = () => res(null);
    im.src = src;
  });
}

// Dimensions logiques du canevas selon le format choisi et la photo importée
function getStageDims() {
  if (state.format === 'banner') {
    return { W: BANNER_W, H: BANNER_H };
  }
  if (state.format === 'auto') {
    if (state.photo && state.photo.width && state.photo.height) {
      const ratio = state.photo.height / state.photo.width;
      const w = 1600;
      const h = Math.max(698, Math.min(2800, Math.round(w * ratio)));
      return { W: w, H: h };
    }
    return { W: 1600, H: 1000 };
  }
  const fmt = FORMATS[state.format] || FORMATS.post;
  return { W: fmt.w, H: fmt.h };
}

// ---------- Scène de la banderole dans son repère de référence (1600 × 698) ----------
function bannerScene() {
  const W = BANNER_W, H = BANNER_H, CX = W / 2;
  const items = [];
  const boxH = 150, boxTop = 470, mid = boxTop + boxH / 2;
  const cell = 150, divGap = 12, divW = 3, pad = 30;
  const coreW = pad * 2 + cell * 2 + divGap * 2 + divW;
  const skew = boxH * Math.tan(11 * Math.PI / 180);
  const x0 = CX - (coreW + skew) / 2;
  const boxL = x0, boxR = x0 + coreW + skew;

  if (state.bg !== 'none') items.push({ t: 'bg', mode: state.bg });

  // bloc score blanc incliné
  items.push({
    t: 'poly', fill: '#FFFFFF', shadow: true,
    pts: [[x0 + skew, boxTop], [x0 + skew + coreW, boxTop], [x0 + coreW, boxTop + boxH], [x0, boxTop + boxH]],
  });
  // séparateur incliné
  const dh = 96, dSkew = dh * Math.tan(11 * Math.PI / 180);
  items.push({ t: 'line', x1: CX + dSkew / 2, y1: mid - dh / 2, x2: CX - dSkew / 2, y2: mid + dh / 2, w: divW, stroke: NAVY, opacity: 0.16 });

  // scores
  const off = cell / 2 + divGap + divW / 2;
  for (const [s, dx] of [[state.home.score, -off], [state.away.score, off]]) {
    const txt = (s || '').trim() || '0';
    let size = F.score.size;
    const w = measure(txt, F.score, size);
    if (w > cell - 8) size *= (cell - 8) / w;
    items.push({ t: 'text', str: txt, x: CX + dx, y: mid + size * 0.35, f: F.score, size, anchor: 'middle', fill: NAVY });
  }

  // texte au-dessus et en dessous
  const lsTop = 17 * 0.3, lsInfo = 17 * 0.18;
  if (state.top.trim()) {
    const t = state.top.trim().toUpperCase();
    items.push({ t: 'text', str: t, x: CX - spacedWidth(t, F.label, lsTop) / 2, y: boxTop - 22, f: F.label, anchor: 'start', ls: lsTop, fill: '#FFFFFF', opacity: 0.85 });
  }
  if (state.info.trim()) {
    const t = state.info.trim().toUpperCase();
    items.push({ t: 'text', str: t, x: CX - spacedWidth(t, F.info, lsInfo) / 2, y: boxTop + boxH + 38, f: F.info, anchor: 'start', ls: lsInfo, fill: '#FFFFFF', opacity: 0.75 });
  }

  // équipes : nom collé au logo, de part et d'autre du score
  const gapBox = 44, gapLogo = 34, logoBox = { w: 124, h: 127 }, margin = 64;
  for (const side of ['home', 'away']) {
    const team = state[side], left = side === 'home';
    const logo = team.logo;
    let edge = left ? boxL - gapBox : boxR + gapBox;
    if (logo) {
      const r = Math.min(logoBox.w / logo.width, logoBox.h / logo.height);
      const lw = logo.width * r, lh = logo.height * r;
      const lx = left ? edge - logoBox.w + (logoBox.w - lw) / 2 : edge + (logoBox.w - lw) / 2;
      items.push({ t: 'img', src: logo.src, x: lx, y: mid - lh / 2, w: lw, h: lh });
      edge = left ? edge - logoBox.w - gapLogo : edge + logoBox.w + gapLogo;
    }
    const lines = team.name.toUpperCase().split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
    if (!lines.length) continue;
    const maxW = left ? edge - margin : W - margin - edge;
    let size = F.name.size;
    const widest = Math.max(...lines.map(l => measure(l, F.name, size)));
    if (widest > maxW) size *= maxW / widest;
    if (lines.length === 3) size *= 0.82;
    const lh = size * 0.9, cap = size * 0.7;
    const blockH = cap + lh * (lines.length - 1);
    const y1 = mid - blockH / 2 + cap;
    lines.forEach((l, i) => items.push({ t: 'text', str: l, x: edge, y: y1 + i * lh, f: F.name, size, anchor: left ? 'end' : 'start', fill: '#FFFFFF' }));
  }

  if (state.accent) items.push({ t: 'rect', x: 0, y: H - 6, w: W, h: 6, fill: state.accent });
  return items;
}

const FADE = [[0, 0], [0.26, 0.5], [0.5, 0.92], [0.64, 1], [1, 1]];

// Calcule le placement (cover + zoom + panX/panY) de la photo sur le canevas (W × H)
function computePhotoPlacement(W, H) {
  if (!state.photo) return null;
  const im = imgCache.get(state.photo.src);
  if (!im) return null;
  const iw = state.photo.width || im.naturalWidth || W;
  const ih = state.photo.height || im.naturalHeight || H;
  const baseScale = Math.max(W / iw, H / ih);
  const sc = baseScale * (state.photoZoom || 1);
  const dw = iw * sc;
  const dh = ih * sc;
  const maxDx = Math.max(0, (dw - W) / 2);
  const maxDy = Math.max(0, (dh - H) / 2);
  const dx = (W - dw) / 2 + (state.photoPanX / 100) * maxDx;
  const dy = (H - dh) / 2 + (state.photoPanY / 100) * maxDy;
  return { im, x: dx, y: dy, w: dw, h: dh };
}

// Calcule la transformation de la banderole (1600×698) sur le canevas (W × H)
function computeBannerTransform(W, H) {
  const baseScale = W / BANNER_W;
  const bScale = baseScale * ((state.bannerScale || 100) / 100);
  const bw = BANNER_W * bScale;
  const bh = BANNER_H * bScale;
  const bx = (W - bw) / 2;
  const by = H - bh - (state.bannerOffsetY || 0) * baseScale;
  return { bx, by, bScale, bw, bh };
}

// ---------- Rendu canvas (Photo + Banderole par-dessus) ----------
function drawCanvas(cv, exportScale = 1) {
  const { W, H } = getStageDims();
  cv.width = Math.round(W * exportScale);
  cv.height = Math.round(H * exportScale);
  const ctx = cv.getContext('2d');
  ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // 1. Dessiner la photo de fin de match en arrière-plan (si présente et pas en mode "banderole seule")
  if (state.format !== 'banner' && state.photo) {
    const p = computePhotoPlacement(W, H);
    if (p) {
      ctx.drawImage(p.im, p.x, p.y, p.w, p.h);
    }
  }

  // 2. Dessiner la banderole de score par-dessus en bas de l'image
  const { bx, by, bScale } = computeBannerTransform(W, H);
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(bScale, bScale);

  // Si la banderole est décalée vers le haut ou réduite, prolonger le fond sombre jusqu'en bas de la photo
  const extraBottom = Math.ceil((H - (by + BANNER_H * bScale)) / bScale);
  if (extraBottom > 0 && state.bg !== 'none') {
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, BANNER_H - 2, BANNER_W, extraBottom + 4);
  }

  for (const it of bannerScene()) {
    ctx.save();
    if (it.t === 'bg') {
      if (it.mode === 'solid') {
        ctx.fillStyle = NAVY;
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, BANNER_H);
        FADE.forEach(([o, a]) => g.addColorStop(o, `rgba(10,14,28,${a})`));
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, BANNER_W, BANNER_H);
    } else if (it.t === 'poly') {
      if (it.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 40 * exportScale * bScale;
        ctx.shadowOffsetY = 18 * exportScale * bScale;
      }
      ctx.beginPath();
      it.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = it.fill;
      ctx.strokeStyle = it.fill;
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();
    } else if (it.t === 'line') {
      ctx.globalAlpha = it.opacity;
      ctx.strokeStyle = it.stroke;
      ctx.lineWidth = it.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(it.x1, it.y1);
      ctx.lineTo(it.x2, it.y2);
      ctx.stroke();
    } else if (it.t === 'rect') {
      ctx.fillStyle = it.fill;
      ctx.fillRect(it.x, it.y, it.w, it.h);
    } else if (it.t === 'img') {
      const im = imgCache.get(it.src);
      if (im) ctx.drawImage(im, it.x, it.y, it.w, it.h);
    } else if (it.t === 'text') {
      ctx.globalAlpha = it.opacity ?? 1;
      ctx.fillStyle = it.fill;
      ctx.font = css(it.f, it.size);
      if (it.ls) {
        let x = it.x;
        ctx.textAlign = 'left';
        for (const c of it.str) {
          ctx.fillText(c, x, it.y);
          x += ctx.measureText(c).width + it.ls;
        }
      } else {
        ctx.textAlign = it.anchor === 'end' ? 'right' : it.anchor === 'middle' ? 'center' : 'left';
        ctx.fillText(it.str, it.x, it.y);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Rendu SVG ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => Math.round(v * 100) / 100;

function buildSvg() {
  const { W, H } = getStageDims();
  const { bx, by, bScale } = computeBannerTransform(W, H);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<defs><style>@import url('${FONT_LINK.replace(/&/g, '&amp;')}');</style>`);
  out.push(`<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">${FADE.map(([o, a]) => `<stop offset="${o}" stop-color="${NAVY}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
  out.push(`<filter id="shadow" x="-20%" y="-30%" width="140%" height="180%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.35"/></filter></defs>`);

  if (state.format !== 'banner' && state.photo) {
    const p = computePhotoPlacement(W, H);
    if (p) {
      out.push(`<image x="${num(p.x)}" y="${num(p.y)}" width="${num(p.w)}" height="${num(p.h)}" xlink:href="${state.photo.src}" preserveAspectRatio="none"/>`);
    }
  }

  out.push(`<g transform="translate(${num(bx)}, ${num(by)}) scale(${num(bScale)})">`);
  for (const it of bannerScene()) {
    if (it.t === 'bg') out.push(`<rect width="${BANNER_W}" height="${BANNER_H}" fill="${it.mode === 'solid' ? NAVY : 'url(#fade)'}"/>`);
    else if (it.t === 'poly') {
      const p = it.pts.map(([x, y]) => `${num(x)},${num(y)}`).join(' ');
      out.push(`<polygon points="${p}" fill="${it.fill}" stroke="${it.fill}" stroke-width="10" stroke-linejoin="round"${it.shadow ? ' filter="url(#shadow)"' : ''}/>`);
    } else if (it.t === 'line') out.push(`<line x1="${num(it.x1)}" y1="${num(it.y1)}" x2="${num(it.x2)}" y2="${num(it.y2)}" stroke="${it.stroke}" stroke-opacity="${it.opacity}" stroke-width="${it.w}" stroke-linecap="round"/>`);
    else if (it.t === 'rect') out.push(`<rect x="${num(it.x)}" y="${num(it.y)}" width="${num(it.w)}" height="${num(it.h)}" fill="${it.fill}"/>`);
    else if (it.t === 'img') out.push(`<image x="${num(it.x)}" y="${num(it.y)}" width="${num(it.w)}" height="${num(it.h)}" xlink:href="${it.src}"/>`);
    else if (it.t === 'text') {
      const fam = it.f.family === 'Barlow' ? "Barlow, 'Helvetica Neue', Arial, sans-serif" : "'Barlow Condensed', 'Arial Narrow', sans-serif";
      out.push(`<text x="${num(it.x)}" y="${num(it.y)}" font-family="${esc(fam)}" font-weight="${it.f.weight}" font-style="${it.f.style}" font-size="${num(it.size ?? it.f.size)}" fill="${it.fill}"${it.opacity != null ? ` fill-opacity="${it.opacity}"` : ''}${it.anchor !== 'start' ? ` text-anchor="${it.anchor}"` : ''}${it.ls ? ` letter-spacing="${num(it.ls)}"` : ''}>${esc(it.str)}</text>`);
    }
  }
  out.push('</g></svg>');
  return out.join('\n');
}

// ---------- Gestion de la photo du match & des logos ----------
async function setPhoto(src) {
  if (!src) {
    state.photo = null;
    $('#photoThumb').style.backgroundImage = 'none';
    $('#photoStatus').textContent = 'Aucune photo importée (clique sur « Importer une photo » ou glisse une image sur l’aperçu).';
    $('#removePhoto').hidden = true;
    render();
    return;
  }
  const im = await loadImg(src);
  if (!im) {
    $('#status').textContent = "Cette photo n'a pas pu être lue. Essaie un fichier JPG, PNG ou WebP.";
    return;
  }
  state.photo = { src, width: im.naturalWidth || 1600, height: im.naturalHeight || 1000 };
  state.photoZoom = 1;
  state.photoPanX = 0;
  state.photoPanY = 0;
  if (state.format === 'banner') {
    state.format = 'auto';
  }
  $('#photoThumb').style.backgroundImage = `url("${src}")`;
  $('#photoStatus').textContent = `Photo active (${state.photo.width} × ${state.photo.height} px) — glisse sur l'image pour cadrer.`;
  $('#removePhoto').hidden = false;
  // Bascule automatiquement sur l'onglet Photo & Format sur mobile lors d'un import
  const photoTabBtn = document.querySelector('.mobile-tab[data-tab="photo"]');
  if (photoTabBtn && window.innerWidth < 768) photoTabBtn.click();
  syncForm();
  render();
}

async function setLogo(side, src) {
  if (!src) {
    state[side].logo = null;
  } else {
    const im = await loadImg(src);
    if (!im) {
      $('#status').textContent = "Ce logo n'a pas pu être lu. Essaie un PNG ou un JPG.";
      return;
    }
    state[side].logo = { src, width: im.naturalWidth || 100, height: im.naturalHeight || 100 };
  }
  $('#' + side + 'Thumb').style.backgroundImage = src ? `url("${src}")` : 'none';
  render();
}

let raf = 0;
function render() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    drawCanvas($('#cv'), 1);
    const { W, H } = getStageDims();
    $('#dimLabel').textContent = `${W * state.scale} × ${H * state.scale} px`;
    save();
  });
}

function save() {
  try {
    localStorage.setItem('banderole-v2', JSON.stringify({
      home: { name: state.home.name, score: state.home.score, logo: state.home.logo?.src === MACCABI_LOGO ? 'maccabi' : null },
      away: { name: state.away.name, score: state.away.score, logo: state.away.logo?.src === MACCABI_LOGO ? 'maccabi' : null },
      top: state.top,
      info: state.info,
      bg: state.bg,
      accent: state.accent,
      scale: state.scale,
      format: state.format,
      bannerScale: state.bannerScale,
      bannerOffsetY: state.bannerOffsetY,
    }));
  } catch {}
}

function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('banderole-v2') || localStorage.getItem('banderole-v1'));
    if (!s) return null;
    for (const k of ['top', 'info', 'bg', 'accent', 'scale', 'format', 'bannerScale', 'bannerOffsetY']) {
      if (k in s && s[k] != null) state[k] = s[k];
    }
    for (const side of ['home', 'away']) {
      if (s[side]?.name != null) state[side].name = s[side].name;
      if (s[side]?.score != null) state[side].score = s[side].score;
    }
    return s;
  } catch { return null; }
}

function syncForm() {
  $('#homeName').value = state.home.name;
  $('#awayName').value = state.away.name;
  $('#homeScore').value = state.home.score;
  $('#awayScore').value = state.away.score;
  $('#top').value = state.top;
  $('#info').value = state.info;
  $('#formatSelect').value = state.format;
  $('#photoZoom').value = Math.round(state.photoZoom * 100);
  $('#photoZoomVal').textContent = `${Math.round(state.photoZoom * 100)}%`;
  $('#photoPanX').value = state.photoPanX;
  $('#photoPanY').value = state.photoPanY;
  $('#bannerScale').value = state.bannerScale;
  $('#bannerScaleVal').textContent = `${state.bannerScale}%`;
  $('#bannerOffsetY').value = state.bannerOffsetY;
  const bgRadio = document.querySelector(`input[name=bg][value="${state.bg}"]`);
  if (bgRadio) bgRadio.checked = true;
  const scRadio = document.querySelector(`input[name=scale][value="${state.scale}"]`);
  if (scRadio) scRadio.checked = true;
  document.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === state.accent)));
}

// ---------- Événements Photo & Cadrage ----------
function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = () => setPhoto(r.result);
  r.readAsDataURL(file);
}

$('#photoFile').addEventListener('change', e => {
  handlePhotoFile(e.target.files[0]);
  e.target.value = '';
});
$('#photoFileTop').addEventListener('change', e => {
  handlePhotoFile(e.target.files[0]);
  e.target.value = '';
});
$('#removePhoto').addEventListener('click', () => setPhoto(null));
$('#resetFraming').addEventListener('click', () => {
  state.photoZoom = 1;
  state.photoPanX = 0;
  state.photoPanY = 0;
  state.bannerScale = 100;
  state.bannerOffsetY = 0;
  syncForm();
  render();
});

$('#formatSelect').addEventListener('change', e => {
  state.format = e.target.value;
  render();
});
$('#photoZoom').addEventListener('input', e => {
  state.photoZoom = Number(e.target.value) / 100;
  $('#photoZoomVal').textContent = `${e.target.value}%`;
  render();
});
$('#photoPanX').addEventListener('input', e => {
  state.photoPanX = Number(e.target.value);
  render();
});
$('#photoPanY').addEventListener('input', e => {
  state.photoPanY = Number(e.target.value);
  render();
});
$('#bannerScale').addEventListener('input', e => {
  state.bannerScale = Number(e.target.value);
  $('#bannerScaleVal').textContent = `${e.target.value}%`;
  render();
});
$('#bannerOffsetY').addEventListener('input', e => {
  state.bannerOffsetY = Number(e.target.value);
  render();
});

// Glisser-déposer d'un fichier image sur la zone d'aperçu + déplacement de la photo à la souris/doigt
const viewEl = $('#view');
viewEl.addEventListener('dragover', e => {
  e.preventDefault();
  viewEl.classList.add('dragover');
});
viewEl.addEventListener('dragleave', () => viewEl.classList.remove('dragover'));
viewEl.addEventListener('drop', e => {
  e.preventDefault();
  viewEl.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) handlePhotoFile(file);
});

// Déplacement interactif de la photo sur le canvas (1 doigt = déplacer, 2 doigts = pincer/zoomer)
const cvEl = $('#cv');
const pointers = new Map();
let dragStart = null;
let pinchStart = null;

cvEl.addEventListener('pointerdown', e => {
  if (!state.photo || state.format === 'banner') return;
  cvEl.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragStart = { x: e.clientX, y: e.clientY, panX: state.photoPanX, panY: state.photoPanY };
    pinchStart = null;
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    pinchStart = { dist: Math.max(10, dist), zoom: state.photoZoom };
    dragStart = null;
  }
});

cvEl.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && pinchStart) {
    const [p1, p2] = [...pointers.values()];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const nextZoom = Math.max(1, Math.min(2.5, pinchStart.zoom * (dist / pinchStart.dist)));
    state.photoZoom = Math.round(nextZoom * 50) / 50;
    $('#photoZoom').value = Math.round(state.photoZoom * 100);
    $('#photoZoomVal').textContent = `${Math.round(state.photoZoom * 100)}%`;
    render();
    return;
  }
  if (!dragStart) return;
  const rect = cvEl.getBoundingClientRect();
  const dx = ((e.clientX - dragStart.x) / rect.width) * 200;
  const dy = ((e.clientY - dragStart.y) / rect.height) * 200;
  state.photoPanX = Math.max(-100, Math.min(100, Math.round(dragStart.panX + dx)));
  state.photoPanY = Math.max(-100, Math.min(100, Math.round(dragStart.panY + dy)));
  $('#photoPanX').value = state.photoPanX;
  $('#photoPanY').value = state.photoPanY;
  render();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) dragStart = null;
}
cvEl.addEventListener('pointerup', endPointer);
cvEl.addEventListener('pointercancel', endPointer);

// Onglets rapides mobile + agrandissement aperçu + boutons +/- score
const mobileTabs = $('#mobileTabs');
if (mobileTabs) {
  mobileTabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    const tab = btn.dataset.tab;
    mobileTabs.querySelectorAll('.mobile-tab').forEach(b => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-tab-panel]').forEach(p => {
      p.classList.toggle('mobile-hidden', p.dataset.tabPanel !== tab);
    });
  });
}

const togglePreviewBtn = $('#togglePreviewSize');
if (togglePreviewBtn) {
  togglePreviewBtn.addEventListener('click', () => {
    const stage = $('#stageSection');
    const expanded = stage.classList.toggle('expanded');
    togglePreviewBtn.textContent = expanded ? 'Réduire' : 'Agrandir';
  });
}

document.querySelectorAll('button[data-score-step]').forEach(btn => {
  btn.addEventListener('click', () => {
    const [side, deltaStr] = btn.dataset.scoreStep.split(':');
    const delta = Number(deltaStr);
    const cur = parseInt(state[side].score, 10) || 0;
    const next = Math.max(0, Math.min(999, cur + delta));
    state[side].score = String(next).padStart(2, '0');
    $('#' + side + 'Score').value = state[side].score;
    render();
  });
});

// ---------- Événements Équipes & Textes ----------
for (const side of ['home', 'away']) {
  $('#' + side + 'Name').addEventListener('input', e => { state[side].name = e.target.value; render(); });
  $('#' + side + 'Score').addEventListener('input', e => { state[side].score = e.target.value; render(); });
  $('#' + side + 'File').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(side, r.result);
    r.readAsDataURL(f);
    e.target.value = '';
  });
  $('#' + side + 'Maccabi').addEventListener('click', () => setLogo(side, MACCABI_LOGO));
  $('#' + side + 'None').addEventListener('click', () => setLogo(side, null));
}

$('#top').addEventListener('input', e => { state.top = e.target.value; render(); });
$('#info').addEventListener('input', e => { state.info = e.target.value; render(); });
document.querySelectorAll('input[name=bg]').forEach(r => r.addEventListener('change', () => { state.bg = r.value; render(); }));
document.querySelectorAll('input[name=scale]').forEach(r => r.addEventListener('change', () => { state.scale = Number(r.value); render(); }));
document.querySelectorAll('input[name=view]').forEach(r => r.addEventListener('change', () => { $('#view').className = 'view ' + r.value; }));
$('#swatches').addEventListener('click', e => {
  const b = e.target.closest('.sw');
  if (!b) return;
  state.accent = b.dataset.c;
  syncForm();
  render();
});
$('#swap').addEventListener('click', () => {
  [state.home, state.away] = [state.away, state.home];
  syncForm();
  for (const side of ['home', 'away']) {
    $('#' + side + 'Thumb').style.backgroundImage = state[side].logo ? `url("${state[side].logo.src}")` : 'none';
  }
  render();
});

// ---------- Téléchargement PNG, SVG & Partage ----------
const fileBase = () => {
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `banderole-${slug(state.home.name) || 'domicile'}-${slug(state.away.name) || 'exterieur'}`.slice(0, 80);
};

async function generatePngBlob() {
  const cv = document.createElement('canvas');
  drawCanvas(cv, state.scale);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  if (blob) return blob;
  const dataUrl = cv.toDataURL('image/png');
  const r = await fetch(dataUrl);
  return r.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

$('#savePng').addEventListener('click', async () => {
  const st = $('#status');
  st.textContent = 'Génération du PNG…';
  try {
    const blob = await generatePngBlob();
    const filename = fileBase() + '.png';
    downloadBlob(blob, filename);
    st.textContent = `${filename} téléchargé.`;
  } catch (e) {
    st.textContent = 'Erreur lors du téléchargement PNG : ' + e.message;
  }
});

$('#saveSvg').addEventListener('click', () => {
  const st = $('#status');
  try {
    const svg = buildSvg();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const filename = fileBase() + '.svg';
    downloadBlob(blob, filename);
    st.textContent = `${filename} téléchargé.`;
  } catch (e) {
    st.textContent = 'Erreur lors du téléchargement SVG : ' + e.message;
  }
});

$('#shareBtn').addEventListener('click', async () => {
  const st = $('#status');
  try {
    const blob = await generatePngBlob();
    const file = new File([blob], fileBase() + '.png', { type: 'image/png' });
    await navigator.share({ files: [file], title: 'Score Maccabi Sarcelles' });
  } catch (e) {
    if (e.name !== 'AbortError') st.textContent = 'Partage impossible : ' + e.message;
  }
});
if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }))) {
  $('#shareBtn').hidden = true;
}

(async function start() {
  const saved = restore();
  syncForm();
  await Promise.all([css(F.name), css(F.score), css(F.label), css(F.info)].map(f => document.fonts.load(f, 'AÉ0')));
  const homeLogo = saved ? (saved.home.logo === 'maccabi' ? MACCABI_LOGO : null) : MACCABI_LOGO;
  const awayLogo = saved && saved.away.logo === 'maccabi' ? MACCABI_LOGO : null;
  await setLogo('home', homeLogo);
  await setLogo('away', awayLogo);
  render();
})();

