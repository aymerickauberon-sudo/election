// Affiche "Game Day" : rendu canvas fidèle à la maquette (777 × 1382) + export SVG.
export const W = 777, H = 1382;
export const CYAN = '#24B5E9';
const CX = 388.5;

export const FONTS = {
  team: { family: 'Anton', weight: 400, style: 'normal', size: 82.5 },
  top: { family: 'Archivo Narrow', weight: 500, style: 'normal', size: 16.3, ls: 2.67 },
  date: { family: 'Archivo Narrow', weight: 600, style: 'normal', size: 35 },
  gym: { family: 'Archivo', weight: 700, style: 'normal', size: 28.9 },
  addr: { family: 'Archivo Narrow', weight: 500, style: 'normal', size: 22 },
  slogan: { family: 'Archivo Narrow', weight: 400, style: 'normal', size: 22.5, ls: 1.27 },
};
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@700&family=Archivo+Narrow:wght@400;500;600&display=swap';
const css = (f, size) => `${f.style} ${f.weight} ${size ?? f.size}px "${f.family}"`;

export async function loadFonts() {
  await Promise.all(Object.values(FONTS).map(f => document.fonts.load(css(f), 'AÉé0')));
}

// Logos en filigrane (rotation 5,1571°), comme sur la maquette
const TILES = [[13.7407,689.0],[136.243,700.056],[258.745,711.112],[381.247,722.168],[503.749,733.224],[2.05542,818.474],[124.558,829.53],[247.06,840.586],[369.562,851.642],[492.064,862.698],[735.076,884.631],[-9.62988,947.948],[112.872,959.004],[235.374,970.06],[357.876,981.116],[480.378,992.172],[602.881,1003.23],[723.391,1014.1],[-21.3152,1077.42],[101.187,1088.48],[223.689,1099.53],[346.191,1110.59],[468.693,1121.65],[591.195,1132.7],[711.706,1143.58],[-33.0005,1206.9],[89.5017,1217.95],[212.004,1229.01],[334.506,1240.06],[457.008,1251.12],[579.51,1262.18],[700.02,1273.05],[-44.6858,1336.37],[77.8164,1347.42],[200.318,1358.48],[322.821,1369.54],[445.323,1380.59]];

// Cadre fixe de la photo du joueur
export const PLAYER_FRAME = { x: 77, y: 45, w: 903, h: 1368 };
// Zone de la photo de fond (le haut de l'affiche)
const BG_ZONE = { x: 0, y: -34, w: 777, h: 864 };

const cache = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!cache.has(src)) cache.set(src, new Promise(res => {
    const im = new Image();
    if (/^https?:\/\//i.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  }));
  return cache.get(src);
}

const mctx = document.createElement('canvas').getContext('2d');
function measure(text, f, size) {
  mctx.font = css(f, size);
  const m = mctx.measureText(text);
  return { adv: m.width, L: m.actualBoundingBoxLeft, R: m.actualBoundingBoxRight };
}
function spaced(text, f, size, ls) {
  const ch = [...text];
  let w = 0; for (const c of ch) w += measure(c, f, size).adv;
  return w + ls * Math.max(0, ch.length - 1);
}

// Placement de la photo du joueur dans son cadre fixe
export function playerRect(img, crop) {
  const F = PLAYER_FRAME;
  const s0 = F.h / img.height;                      // hauteur du cadre, comme la maquette
  const z = crop?.on ? crop.zoom : 1;
  const w = img.width * s0 * z, h = img.height * s0 * z;
  const x = F.x + (F.w - w) / 2 + (crop?.on ? crop.dx : 0);
  const y = F.y + (crop?.on ? crop.dy : 0);
  return { x, y, w, h };
}

export function bgRect(img, bgCrop) {
  const z = BG_ZONE;
  const s0 = Math.max(z.w / img.width, z.h / img.height);
  const zoom = bgCrop?.on ? (bgCrop.zoom || 1) : 1;
  const w = img.width * s0 * zoom, h = img.height * s0 * zoom;
  const x = z.x + (z.w - w) / 2 + (bgCrop?.on ? (bgCrop.dx || 0) : 0);
  const y = z.y + (z.h - h) / 2 + (bgCrop?.on ? (bgCrop.dy || 0) : 0);
  return { x, y, w, h };
}

// ---------- Fond (photo, joueur, dégradés, filigranes, décor) ----------
export async function drawBackground(ctx, d) {
  const [bg, player, tile, dots, overlay] = await Promise.all([
    loadImage(d.bgPhoto || 'assets/gd_bg.jpg'), loadImage(d.playerPhoto),
    loadImage('assets/gd_tile.png'), loadImage('assets/gd_dots.webp'), loadImage('assets/gd_overlay.webp'),
  ]);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (bg) {
    const r = bgRect(bg, d.bgCrop);
    ctx.save();
    ctx.beginPath();
    ctx.rect(BG_ZONE.x, BG_ZONE.y, BG_ZONE.w, BG_ZONE.h);
    ctx.clip();
    ctx.globalAlpha = 0.47;
    ctx.drawImage(bg, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  let g = ctx.createLinearGradient(576.457, -59.9567, 76.0581, 834.678);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, '#2D3387');
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  if (player) {
    const r = playerRect(player, d.crop);
    ctx.save();
    if (d.crop?.on) { const F = PLAYER_FRAME; ctx.beginPath(); ctx.rect(F.x, F.y, F.w, F.h); ctx.clip(); }
    ctx.drawImage(player, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  g = ctx.createLinearGradient(500, 453, 278.485, 841.217);
  g.addColorStop(0, 'rgba(0,10,45,0)'); g.addColorStop(1, '#000A2D');
  ctx.fillStyle = g; ctx.fillRect(0, 453, W, 929);

  if (tile) {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'soft-light';
    for (const [x, y] of TILES) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(5.1571 * Math.PI / 180);
      ctx.drawImage(tile, -0.29, 0, 123.6, 144); ctx.restore();
    }
    ctx.restore();
  }
  if (dots) {
    ctx.save(); ctx.globalCompositeOperation = 'overlay';
    for (const [x, y, s, a] of [[2.48242, -274.213, 402.62, 45], [1049.02, -274.309, 521.071, 114.452]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * Math.PI / 180); ctx.drawImage(dots, 0, 0, s, s); ctx.restore();
    }
    ctx.restore();
  }
  return overlay;
}

// ---------- Éléments modifiables : une description, deux rendus ----------
export function layout(d, imgs) {
  const items = [];
  const T = FONTS;

  // logos du bas (domicile, extérieur, compétition)
  const slots = [
    { im: imgs.logo1, w: 80, h: 100 }, { im: imgs.logo2, w: 80, h: 100 }, { im: imgs.badge, w: 42, h: 78 },
  ].filter(s => s.im);
  if (slots.length) {
    const sizes = slots.map(s => { const r = Math.min(s.w / s.im.width, s.h / s.im.height); return [s.im.width * r, s.im.height * r]; });
    const gap = 18, total = sizes.reduce((a, [w]) => a + w, 0) + gap * (slots.length - 1);
    let x = CX - total / 2;
    slots.forEach((s, i) => { const [w, h] = sizes[i]; items.push({ t: 'img', src: s.im.src, x, y: 1200 - h / 2, w, h }); x += w + gap; });
  }

  // haut gauche / haut droite
  const lines = s => (s || '').toUpperCase().split('\n').map(l => l.trim()).slice(0, 2);
  lines(d.topLeft).forEach((l, i) => l && items.push({ t: 'text', str: l, x: 51.6, y: 87.2 + i * 25, f: T.top, ls: T.top.ls, fill: '#FFFFFF' }));
  lines(d.topRight).forEach((l, i) => l && items.push({ t: 'text', str: l, x: 747.5 - spaced(l, T.top, T.top.size, T.top.ls), y: 87.2 + i * 25, f: T.top, ls: T.top.ls, fill: '#FFFFFF' }));

  // pastille date + heure
  const date = (d.date || '').trim(), time = (d.time || '').trim();
  if (date || time) {
    const wd = date ? measure(date, T.date).adv : 0, wt = time ? measure(time, T.date).adv : 0;
    const w = 15.7 + wd + (date && time ? 10.3 : 0) + wt + 14.7;
    items.push({ t: 'pill', x: 52, y: 651, w, h: 52.6, r: 14.4 });
    if (date) items.push({ t: 'text', str: date, x: 52 + 15.7, y: 691.7, f: T.date, fill: '#FFFFFF' });
    if (time) items.push({ t: 'text', str: time, x: 52 + 15.7 + wd + (date ? 10.3 : 0), y: 691.7, f: T.date, fill: CYAN });
  }

  // équipes : domicile en haut, extérieur en bas
  const fit = (s, maxW) => {
    let size = T.team.size; const m = measure(s, T.team, size); const w = m.L + m.R;
    if (w > maxW) size *= maxW / w;
    return size;
  };
  const team = (s, size, base) => { const m = measure(s, T.team, size); items.push({ t: 'text', str: s, x: 391 - (m.L + m.R) / 2 + m.L, y: base, f: T.team, size, fill: '#FFFFFF', glow: true }); };
  const t1 = (d.team1 || '').toUpperCase().trim(), t2 = (d.team2 || '').toUpperCase().trim();
  if (t1) team(t1, fit(t1, 678), 795);
  if (t2) { const s2 = fit(t2, 678); team(t2, s2, 836.9 + s2 * 0.87); }
  items.push({ t: 'img', src: 'assets/gd_vs.png', x: 322, y: 782, w: 133, h: 66, shadow: true });

  // salle + adresse, avec l'icône de lieu
  const gym = (d.gym || '').toUpperCase().trim(), addr = (d.address || '').trim();
  if (gym || addr) {
    let k = 1, wg, wa;
    for (let i = 0; i < 25; i++) {
      wg = gym ? measure(gym, T.gym, T.gym.size * k).adv : 0; wa = addr ? measure(addr, T.addr, T.addr.size * k).adv : 0;
      if (Math.max(wg, wa) <= 560) break; k *= 0.97;
    }
    const total = 54 + 21.8 + Math.max(wg, wa), left = CX - total / 2, tx = left + 54 + 21.8;
    items.push({ t: 'img', src: 'assets/gd_pin.png', x: left, y: 940, w: 54, h: 54 });
    if (gym) items.push({ t: 'text', str: gym, x: tx, y: 962.1, f: T.gym, size: T.gym.size * k, fill: '#FFFFFF' });
    if (addr) items.push({ t: 'text', str: addr, x: tx, y: 990.2, f: T.addr, size: T.addr.size * k, fill: '#FFFFFF' });
  }

  // slogan (2 lignes blanches + 1 ligne bleue)
  const sl = (d.slogan || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  const rows = [...sl.map(s => [s, '#FFFFFF']), ...(d.cheer?.trim() ? [[d.cheer.trim(), CYAN]] : [])];
  const y0 = 1114.3 - 26 * (rows.length - 1);
  rows.forEach(([s, c], i) => {
    let size = T.slogan.size, w = spaced(s, T.slogan, size, T.slogan.ls);
    if (w > 640) { size *= 640 / w; w = spaced(s, T.slogan, size, T.slogan.ls * size / T.slogan.size); }
    const ls = T.slogan.ls * size / T.slogan.size;
    items.push({ t: 'text', str: s, x: 387 - w / 2, y: y0 + i * 26, f: T.slogan, size, ls, fill: c });
  });
  return items;
}

function drawItems(ctx, items, images) {
  for (const it of items) {
    ctx.save();
    if (it.t === 'img') {
      const im = images.get(it.src);
      if (im) {
        if (it.shadow) { ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 20; }
        ctx.drawImage(im, it.x, it.y, it.w, it.h);
      }
    } else if (it.t === 'pill') {
      ctx.shadowColor = 'rgba(0,0,0,0.64)'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.roundRect(it.x, it.y, it.w, it.h, it.r); ctx.fillStyle = '#000'; ctx.fill();
      ctx.shadowColor = 'transparent';
      const g = ctx.createLinearGradient(41.615, 643.707, 91.0339, 764.652); g.addColorStop(0, CYAN); g.addColorStop(1, '#C8C7C3');
      ctx.beginPath(); ctx.roundRect(it.x + 1, it.y + 1, it.w - 2, it.h - 2, it.r - 1); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
    } else if (it.t === 'text') {
      ctx.font = css(it.f, it.size); ctx.fillStyle = it.fill; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const paint = () => {
        if (it.ls) { let x = it.x; for (const c of it.str) { ctx.fillText(c, x, it.y); x += ctx.measureText(c).width + it.ls; } }
        else ctx.fillText(it.str, it.x, it.y);
      };
      if (it.glow) {
        ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 70; paint(); paint();
        ctx.shadowBlur = 20; paint(); ctx.shadowColor = 'transparent';
      }
      paint();
    }
    ctx.restore();
  }
}

async function imagesFor(items) {
  const srcs = [...new Set(items.filter(i => i.t === 'img').map(i => i.src))];
  const loaded = await Promise.all(srcs.map(loadImage));
  return new Map(srcs.map((s, i) => [s, loaded[i]]));
}

async function logoImages(d) {
  const [logo1, logo2, badge] = await Promise.all([loadImage(d.logo1), loadImage(d.logo2), loadImage(d.badge)]);
  return { logo1, logo2, badge };
}

export async function drawPoster(canvas, d, scale = 1) {
  const logos = await logoImages(d);
  const items = layout(d, logos);
  const images = await imagesFor(items);
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const overlay = await drawBackground(ctx, d);
  if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
  drawItems(ctx, items, images);
}

// ---------- SVG : fond en image, textes et logos en éléments séparés ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = v => Math.round(v * 100) / 100;

async function toDataUrl(src) {
  if (!src || src.startsWith('data:')) return src;
  const im = await loadImage(src); if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  c.getContext('2d').drawImage(im, 0, 0);
  return c.toDataURL('image/png');
}

export async function buildSvg(d) {
  const bgc = document.createElement('canvas'); bgc.width = W * 2; bgc.height = H * 2;
  const bctx = bgc.getContext('2d'); bctx.setTransform(2, 0, 0, 2, 0, 0);
  const overlay = await drawBackground(bctx, d);
  if (overlay) bctx.drawImage(overlay, 0, 0, W, H);
  const bgUrl = bgc.toDataURL('image/jpeg', 0.92);

  const items = layout(d, await logoImages(d));
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><style>@import url('${FONT_CSS.replace(/&/g, '&amp;')}');</style>`,
    `<filter id="glow" x="-30%" y="-150%" width="160%" height="400%"><feDropShadow dx="0" dy="0" stdDeviation="35" flood-color="#000" flood-opacity="1"/><feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#000" flood-opacity="1"/></filter>`,
    `<filter id="shadow" x="-30%" y="-50%" width="160%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#000" flood-opacity="1"/></filter>`,
    `<filter id="pillShadow" x="-20%" y="-60%" width="140%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#000" flood-opacity="0.64"/></filter>`,
    `<linearGradient id="pillStroke" gradientUnits="userSpaceOnUse" x1="41.615" y1="643.707" x2="91.0339" y2="764.652"><stop stop-color="${CYAN}"/><stop offset="1" stop-color="#C8C7C3"/></linearGradient></defs>`,
    `<image id="fond" x="0" y="0" width="${W}" height="${H}" xlink:href="${bgUrl}"/>`];
  const urls = new Map();
  for (const it of items) if (it.t === 'img' && !urls.has(it.src)) urls.set(it.src, await toDataUrl(it.src));
  for (const it of items) {
    if (it.t === 'img') { const u = urls.get(it.src); if (u) out.push(`<image x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}" xlink:href="${u}"${it.shadow ? ' filter="url(#shadow)"' : ''}/>`); }
    else if (it.t === 'pill') {
      out.push(`<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}" rx="${it.r}" fill="#000000" filter="url(#pillShadow)"/>`);
      out.push(`<rect x="${n(it.x + 1)}" y="${n(it.y + 1)}" width="${n(it.w - 2)}" height="${n(it.h - 2)}" rx="${it.r - 1}" fill="none" stroke="url(#pillStroke)" stroke-width="2"/>`);
    } else if (it.t === 'text') {
      const fam = `'${it.f.family}', sans-serif`;
      out.push(`<text x="${n(it.x)}" y="${n(it.y)}" font-family="${esc(fam)}" font-weight="${it.f.weight}" font-size="${n(it.size ?? it.f.size)}" fill="${it.fill}"${it.ls ? ` letter-spacing="${n(it.ls)}"` : ''}${it.glow ? ' filter="url(#glow)"' : ''}>${esc(it.str)}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

