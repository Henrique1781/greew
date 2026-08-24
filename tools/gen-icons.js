/* Gera os icones do app (PWA + Android) sem dependencias externas.
   uso: node tools/gen-icons.js
   saida: www/icons/icon-192.png, www/icons/icon-512.png,
          assets/icon.png (1024), assets/splash.png (2732)              */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAIZ = path.join(__dirname, '..');
const OUT_WWW = path.join(RAIZ, 'www', 'icons');
const OUT_ASSETS = path.join(RAIZ, 'assets');

/* ---------- PNG minimo (RGBA, sem filtro) ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- geometria ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by, r) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  const dx = wx - vx * t, dy = wy - vy * t;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

/* escudo estilizado: circulo com corte reto no topo */
function sdShield(px, py, cx, cy, R) {
  const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - R;
  const topo = (cy - R * 0.86) - py;
  return Math.max(d, topo);
}

const BG = [8, 9, 10];
const ACC = [245, 178, 26];

/**
 * @param {number} W largura/altura em px
 * @param {object} op { marca: raio do escudo relativo ao lado, fundo: 'rounded'|'solido' }
 */
function desenhar(W, op) {
  op = op || {};
  const marca = op.marca === undefined ? 0.30 : op.marca;
  const buf = Buffer.alloc(W * W * 4);
  const cx = W / 2, cy = W / 2;
  const R = W * marca;
  const anel = R * 0.185;
  const aa = Math.max(W * 0.0015, 0.7);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      let r, g, b, a;

      if (op.fundo === 'solido') {
        r = BG[0]; g = BG[1]; b = BG[2]; a = 1;
      } else {
        const dBg = sdRoundRect(px, py, cx, cy, W / 2, W / 2, W * 0.22);
        const cv = clamp(0.5 - dBg / (aa * 2), 0, 1);
        r = BG[0]; g = BG[1]; b = BG[2]; a = cv;
      }

      const dSh = sdShield(px, py, cx, cy * 1.02, R);
      const dAnel = Math.abs(dSh + anel / 2) - anel / 2;
      const cvAnel = clamp(0.5 - dAnel / (aa * 2), 0, 1);

      const w = R * 0.16;
      const d1 = sdSegment(px, py, cx - R * 0.46, cy * 1.02 + R * 0.02, cx - R * 0.10, cy * 1.02 + R * 0.36, w);
      const d2 = sdSegment(px, py, cx - R * 0.10, cy * 1.02 + R * 0.36, cx + R * 0.52, cy * 1.02 - R * 0.40, w);
      const cvChk = clamp(0.5 - Math.min(d1, d2) / (aa * 2), 0, 1);

      const cv = Math.max(cvAnel, cvChk);
      if (cv > 0) {
        r = mix(r, ACC[0], cv);
        g = mix(g, ACC[1], cv);
        b = mix(b, ACC[2], cv);
        a = Math.max(a, cv);
      }

      const i = (y * W + x) * 4;
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(W, W, buf);
}

[OUT_WWW, OUT_ASSETS].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

fs.writeFileSync(path.join(OUT_WWW, 'icon-192.png'), desenhar(192));
fs.writeFileSync(path.join(OUT_WWW, 'icon-512.png'), desenhar(512));
console.log('www/icons/icon-192.png e icon-512.png');

/* Android: icone 1024 e splash 2732 (usados pelo @capacitor/assets) */
fs.writeFileSync(path.join(OUT_ASSETS, 'icon.png'), desenhar(1024, { marca: 0.26 }));
console.log('assets/icon.png (1024)');

fs.writeFileSync(path.join(OUT_ASSETS, 'splash.png'), desenhar(2732, { marca: 0.10, fundo: 'solido' }));
console.log('assets/splash.png (2732)');

fs.copyFileSync(path.join(OUT_ASSETS, 'splash.png'), path.join(OUT_ASSETS, 'splash-dark.png'));
console.log('assets/splash-dark.png');
