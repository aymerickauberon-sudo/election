// Pipeline de retouche automatique "Game Day" (portage fidèle du script Python PIL / NumPy / OpenCV) :
// 1. Color grading subtil : contraste (×1.13), saturation modérée (×1.08), ombres froides (B +5.5, R -1.2)
// 2. Netteté : PIL ImageEnhance.Sharpness(1.22) + UnsharpMask(radius=1.4, percent=75, threshold=4)
// 3. Halo bleu externe : dilatation elliptique 11×11 sur l'alpha, soustraction, flou gaussien (sigma=10),
//    couleur RGB(8, 75, 255) avec alpha plafonné à 75 uniquement à l'extérieur du joueur
// 4. Alpha composite du joueur retouché sur le halo + recadrage automatique (bbox alpha + pad=28 px)

function makeGaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / s2);
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return { kernel, radius };
}

// Élément structurant elliptique 11×11 (équivalent cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
const ELLIPSE_11 = (() => {
  const pts = [];
  const rx = 5, ry = 5;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0) {
        pts.push([dx, dy]);
      }
    }
  }
  return pts;
})();

// Filtre PIL ImageEnhance.Sharpness(1.22) : noyau 3×3 [[1,1,1],[1,5,1],[1,1,1]] / 13
function applyPilSharpness(rgb, w, h, factor = 1.22) {
  const out = new Uint8ClampedArray(rgb.length);
  const amount = factor - 1; // 0.22
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        out[idx] = rgb[idx];
        out[idx + 1] = rgb[idx + 1];
        out[idx + 2] = rgb[idx + 2];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const i = idx + c;
        const sum =
          rgb[i - w * 3 - 3] + rgb[i - w * 3] + rgb[i - w * 3 + 3] +
          rgb[i - 3] + rgb[i] * 5 + rgb[i + 3] +
          rgb[i + w * 3 - 3] + rgb[i + w * 3] + rgb[i + w * 3 + 3];
        const blurred = sum / 13;
        out[i] = Math.round(rgb[i] + (rgb[i] - blurred) * amount);
      }
    }
  }
  return out;
}

// Flou gaussien séparable sur 3 canaux RGB + UnsharpMask(radius=1.4, percent=75, threshold=4)
function applyUnsharpMask(rgb, w, h, radius = 1.4, percent = 75, threshold = 4) {
  const { kernel, radius: r } = makeGaussianKernel(radius);
  const tmp = new Float32Array(rgb.length);
  const blurred = new Float32Array(rgb.length);

  // Passe horizontale
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const wgt = kernel[k + r];
        const p = (row + xx) * 3;
        sr += rgb[p] * wgt;
        sg += rgb[p + 1] * wgt;
        sb += rgb[p + 2] * wgt;
      }
      const dst = (row + x) * 3;
      tmp[dst] = sr;
      tmp[dst + 1] = sg;
      tmp[dst + 2] = sb;
    }
  }

  // Passe verticale
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const wgt = kernel[k + r];
        const p = (yy * w + x) * 3;
        sr += tmp[p] * wgt;
        sg += tmp[p + 1] * wgt;
        sb += tmp[p + 2] * wgt;
      }
      const dst = (y * w + x) * 3;
      blurred[dst] = sr;
      blurred[dst + 1] = sg;
      blurred[dst + 2] = sb;
    }
  }

  const out = new Uint8ClampedArray(rgb.length);
  const scale = percent / 100;
  for (let i = 0; i < rgb.length; i++) {
    const orig = rgb[i];
    const diff = orig - blurred[i];
    if (Math.abs(diff) >= threshold) {
      out[i] = Math.round(orig + diff * scale);
    } else {
      out[i] = orig;
    }
  }
  return out;
}

// Flou gaussien séparable 1 canal (pour le halo externe sigmaX=10)
function gaussianBlur1C(src, w, h, sigma = 10) {
  const { kernel, radius: r } = makeGaussianKernel(sigma);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        s += src[row + xx] * kernel[k + r];
      }
      tmp[row + x] = s;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        s += tmp[yy * w + x] * kernel[k + r];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

// Dilatation elliptique 11×11 + soustraction : outer = cv2.subtract(cv2.dilate(alpha, kernel), alpha)
function computeOuterContour(alpha, w, h) {
  const outer = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const a = alpha[row + x];
      if (a === 255) continue; // Si alpha == 255, dilated - alpha == 0
      let maxA = a;
      for (let i = 0; i < ELLIPSE_11.length; i++) {
        const nx = x + ELLIPSE_11[i][0];
        const ny = y + ELLIPSE_11[i][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const v = alpha[ny * w + nx];
          if (v > maxA) {
            maxA = v;
            if (maxA === 255) break;
          }
        }
      }
      outer[row + x] = maxA - a;
    }
  }
  return outer;
}

/**
 * Applique le pipeline de retouche Game Day à une image (dataURL ou URL)
 * et renvoie une Promise<{ dataUrl, width, height, hasTransparency }>.
 */
export async function processPlayerImage(src, opts = { cropToBbox: true, maxDim: 2000 }) {
  const img = await new Promise((res, rej) => {
    const im = new Image();
    if (/^https?:\/\//i.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Impossible de charger l'image du joueur"));
    im.src = src;
  });

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const maxDim = opts.maxDim || 2000;
  if (Math.max(w, h) > maxDim) {
    const sc = maxDim / Math.max(w, h);
    w = Math.round(w * sc);
    h = Math.round(h * sc);
  }

  // On ajoute une marge initiale si le sujet touche les bords pour ne pas couper le halo
  const initPad = 32;
  const cw = w + initPad * 2;
  const ch = h + initPad * 2;

  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, initPad, initPad, w, h);

  const imgData = ctx.getImageData(0, 0, cw, ch);
  const rgba = imgData.data;
  const numPixels = cw * ch;

  const color = new Uint8ClampedArray(numPixels * 3);
  const alpha = new Uint8Array(numPixels);
  let minOrigAlpha = 255;

  // 1. Color grading : contraste (1.13), saturation (1.08), ombres froides (+5.5 B, -1.2 R)
  for (let i = 0; i < numPixels; i++) {
    const p = i * 4;
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    const a = rgba[p + 3];
    alpha[i] = a;
    if (i >= initPad * cw && i < (ch - initPad) * cw && a < minOrigAlpha) minOrigAlpha = a;

    if (a === 0) continue;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const r1 = Math.min(255, Math.max(0, (r - 127.5) * 1.13 + 127.5));
    const g1 = Math.min(255, Math.max(0, (g - 127.5) * 1.13 + 127.5));
    const b1 = Math.min(255, Math.max(0, (b - 127.5) * 1.13 + 127.5));

    const colorLum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
    let r2 = colorLum + (r1 - colorLum) * 1.08;
    let g2 = colorLum + (g1 - colorLum) * 1.08;
    let b2 = colorLum + (b1 - colorLum) * 1.08;

    const shadow = Math.min(1, Math.max(0, (150 - lum) / 150)) * (a / 255);
    r2 -= shadow * 1.2;
    b2 += shadow * 5.5;

    const cIdx = i * 3;
    color[cIdx] = Math.round(Math.min(255, Math.max(0, r2)));
    color[cIdx + 1] = Math.round(Math.min(255, Math.max(0, g2)));
    color[cIdx + 2] = Math.round(Math.min(255, Math.max(0, b2)));
  }

  // 2. Netteté : Sharpness(1.22) + UnsharpMask(radius=1.4, percent=75, threshold=4)
  const sharp1 = applyPilSharpness(color, cw, ch, 1.22);
  const sharp2 = applyUnsharpMask(sharp1, cw, ch, 1.4, 75, 4);

  // 3. Halo bleu externe derrière le détourage (RGB: 8, 75, 255, alpha max 75)
  const outer = computeOuterContour(alpha, cw, ch);
  const glowBlur = gaussianBlur1C(outer, cw, ch, 10);

  // 4. Alpha composite (subject over glow_rgba) + détection de la bounding box
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  let foundBbox = false;

  for (let y = 0; y < ch; y++) {
    const row = y * cw;
    for (let x = 0; x < cw; x++) {
      const i = row + x;
      const p = i * 4;
      const cIdx = i * 3;

      const gNorm = glowBlur[i] / 255.0;
      const glowA = Math.min(75, Math.max(0, Math.round(gNorm * 105)));

      const sa = alpha[i] / 255.0;
      const da = glowA / 255.0;
      const outA = sa + da * (1 - sa);

      if (outA <= 0) {
        rgba[p] = 0;
        rgba[p + 1] = 0;
        rgba[p + 2] = 0;
        rgba[p + 3] = 0;
        continue;
      }

      const sr = sharp2[cIdx];
      const sg = sharp2[cIdx + 1];
      const sb = sharp2[cIdx + 2];

      rgba[p] = Math.round((sr * sa + 8 * da * (1 - sa)) / outA);
      rgba[p + 1] = Math.round((sg * sa + 75 * da * (1 - sa)) / outA);
      rgba[p + 2] = Math.round((sb * sa + 255 * da * (1 - sa)) / outA);
      const finalAlpha = Math.round(outA * 255);
      rgba[p + 3] = finalAlpha;

      if (finalAlpha > 0) {
        foundBbox = true;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x + 1 > x1) x1 = x + 1;
        if (y + 1 > y1) y1 = y + 1;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 5. Recadrage autour du sujet avec marge pad = 28 px pour conserver le halo
  if (opts.cropToBbox !== false && foundBbox) {
    const pad = 28;
    const bx0 = Math.max(0, x0 - pad);
    const by0 = Math.max(0, y0 - pad);
    const bx1 = Math.min(cw, x1 + pad);
    const by1 = Math.min(ch, y1 + pad);
    const bw = Math.max(1, bx1 - bx0);
    const bh = Math.max(1, by1 - by0);

    const outCv = document.createElement('canvas');
    outCv.width = bw;
    outCv.height = bh;
    outCv.getContext('2d').drawImage(cv, bx0, by0, bw, bh, 0, 0, bw, bh);
    return {
      dataUrl: outCv.toDataURL('image/png'),
      width: bw,
      height: bh,
      hasTransparency: minOrigAlpha < 255,
    };
  }

  // Sans recadrage bbox (ex. photo d'origine déjà calée sur le repère) : retirer uniquement initPad
  const outCv = document.createElement('canvas');
  outCv.width = w;
  outCv.height = h;
  outCv.getContext('2d').drawImage(cv, initPad, initPad, w, h, 0, 0, w, h);
  return {
    dataUrl: outCv.toDataURL('image/png'),
    width: w,
    height: h,
    hasTransparency: minOrigAlpha < 255,
  };
}

