// Dessin de l'affiche "Weekend Match" sur un <canvas>.
// Toutes les coordonnées sont dans le repère de l'affiche d'origine (777 px de large).

export const W = 777;
export const FORMATS = {
  story: { h: 1367, label: 'Story 9:16', bg: 'assets/bg_story.jpg',
    title: { x: 162.4, y: 66, w: 445.1, h: 221 },
    subtitle: { x: 144, y: 323, w: 490, h: 24 },
    zone: [455, 1235] },
  post: { h: 971, label: 'Post 4:5', bg: 'assets/bg_post.jpg',
    title: { x: 254.5, y: 26, w: 268, h: 133 },
    subtitle: { x: 166.5, y: 170, w: 444, h: 21.7 },
    zone: [205, 945] },
};
export const EXPORT_WIDTH = 1080;

const CX = 388.5;          // axe central
const BADGE_X = 722;        // centre des badges
const BLOCK_TOP = 50, BLOCK_BOTTOM = 66, BLOCK_H = BLOCK_TOP + BLOCK_BOTTOM;
const MAX_SPACING = 202;    // écart entre deux matchs sur l'affiche d'origine

const F = {
  label: [500, 17, '"Archivo Narrow"'],
  team: [400, 34, '"Bebas Neue"'],
  gym: [700, 20, 'Archivo'],
  addr: [500, 17, '"Archivo Narrow"'],
  date: [500, 24.8, '"Archivo Narrow"'],
};
const font = ([w, s, f], k = 1) => `${w} ${s * k}px ${f}`;

export async function loadFonts() {
  await Promise.all(Object.values(F).map(f => document.fonts.load(font(f), 'AÉé0')));
}

const imgCache = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise(res => {
      const im = new Image();
      if (/^https?:\/\//i.test(src)) im.crossOrigin = 'anonymous';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}

function ink(ctx, text) {
  const m = ctx.measureText(text);
  return { L: m.actualBoundingBoxLeft, R: m.actualBoundingBoxRight, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight };
}

// Texte aligné à gauche dont l'encre commence exactement en x
function textAt(ctx, text, x, y) {
  const { L } = ink(ctx, text);
  ctx.fillText(text, x + L, y);
}

function centered(ctx, text, y) {
  const { L, R } = ink(ctx, text);
  ctx.fillText(text, CX - (L + R) / 2 + L, y);
}

function drawMatch(ctx, m, T, sc, imgs) {
  ctx.save();
  ctx.translate(CX, T);
  ctx.scale(sc, sc);
  ctx.translate(-CX, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';

  // Catégorie
  ctx.font = font(F.label);
  centered(ctx, m.categorie || '', -36);

  // Équipes + VS (réduction automatique si la ligne est trop longue)
  const g1 = 5, g2 = 5, vsw = 63, maxLine = 610;
  let k = 1, w1, w2;
  for (let i = 0; i < 30; i++) {
    ctx.font = font(F.team, k);
    ctx.letterSpacing = `${1.5 * k}px`;
    w1 = ink(ctx, m.domicile || '').w;
    w2 = ink(ctx, m.exterieur || '').w;
    if (w1 + w2 + g1 + g2 + vsw <= maxLine) break;
    k *= 0.97;
  }
  const left = CX - (w1 + g1 + vsw + g2 + w2) / 2;
  const vsx = left + w1 + g1;
  textAt(ctx, m.domicile || '', left, 0);
  textAt(ctx, m.exterieur || '', vsx + vsw + g2, 0);
  ctx.letterSpacing = '0px';
  if (imgs.vs) ctx.drawImage(imgs.vs, vsx, -27, vsw, 31);

  // Salle + adresse
  const gap = 10, maxInfo = 640;
  let k2 = 1, wg, wa;
  for (let i = 0; i < 30; i++) {
    ctx.font = font(F.gym, k2); wg = m.salle ? ink(ctx, m.salle).w : 0;
    ctx.font = font(F.addr, k2); wa = m.adresse ? ink(ctx, m.adresse).w : 0;
    if (wg + wa + (wg && wa ? gap : 0) <= maxInfo) break;
    k2 *= 0.97;
  }
  const gl = CX - (wg + wa + (wg && wa ? gap : 0)) / 2;
  if (m.salle) { ctx.font = font(F.gym, k2); textAt(ctx, m.salle, gl, 27); }
  if (m.adresse) { ctx.font = font(F.addr, k2); textAt(ctx, m.adresse, gl + wg + (wg ? gap : 0), 27); }

  // Date
  ctx.font = font(F.date);
  centered(ctx, m.dateTexte || '', 59);

  // Badge de la compétition
  const b = imgs.badges.get(m.badge);
  if (b) {
    const bh = 43, bw = bh * b.naturalWidth / b.naturalHeight;
    ctx.drawImage(b, BADGE_X - bw / 2, -15, bw, bh);
  }
  ctx.restore();
}

export async function drawPoster(canvas, matches, format = 'story', opts = {}) {
  const fmt = FORMATS[format];
  const scale = (opts.width || EXPORT_WIDTH) / W;

  const [bg, title, subtitle, vs, ...badgeImgs] = await Promise.all([
    loadImage(fmt.bg), loadImage('assets/title.png'), loadImage('assets/subtitle.png'), loadImage('assets/vs.png'),
    ...matches.map(m => loadImage(m.badge)),
  ]);
  const badges = new Map(matches.map((m, i) => [m.badge, badgeImgs[i]]));

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(fmt.h * scale);
  const ctx = canvas.getContext('2d');

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (bg) ctx.drawImage(bg, 0, 0, W, fmt.h);
  else { ctx.fillStyle = '#2D3387'; ctx.fillRect(0, 0, W, fmt.h); }
  const t = fmt.title, s = fmt.subtitle;
  if (title) ctx.drawImage(title, t.x, t.y, t.w, t.h);
  if (subtitle && opts.subtitle !== false) ctx.drawImage(subtitle, s.x, s.y, s.w, s.h);

  const n = matches.length;
  if (!n) return;
  const [y0, y1] = fmt.zone;
  const avail = y1 - y0;
  let spacing = n > 1 ? Math.min(MAX_SPACING, (avail - BLOCK_H) / (n - 1)) : 0;
  // trop de matchs : on réduit chaque bloc pour qu'ils ne se chevauchent pas
  const sc = n > 1 ? Math.min(1, spacing / 128) : 1;
  const total = BLOCK_H * sc + spacing * (n - 1);
  const T1 = y0 + BLOCK_TOP * sc + (avail - total) / 2;
  matches.forEach((m, i) => drawMatch(ctx, m, T1 + i * spacing, sc, { vs, badges }));
}
