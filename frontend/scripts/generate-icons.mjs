// Generates the Sakha app icons — the peacock-feather mark on a dawn tile —
// with no dependencies:
// a signed-distance-field rasteriser (4×4 supersampled) and a tiny PNG encoder.
//
//   node scripts/generate-icons.mjs
//
// Writes public/icons/*.png and public/favicon.svg.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARK_COLORS, MARK_DROPS, MARK_EYE, MARK_GLINT, MARK_QUILL, QUILL_PATH, dropPath, sdDrop } from '../src/lib/sakhaMark.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes) {
    let c = 0xffffffff;
    for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8; // bit depth
    header[9] = 6; // RGBA
    const raw = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0; // filter: none
        rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

// ---------------------------------------------------------------------------
// The Sakha mark on a dawn tile (geometry shared with the app: src/lib/sakhaMark.js)
// ---------------------------------------------------------------------------

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixColor = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

const [GOLD_DROP, TEAL_DROP] = MARK_DROPS;
const C = Object.fromEntries(Object.entries(MARK_COLORS).map(([key, value]) => [key, hex(value)]));
const DAWN_CENTRE = hex('#fff8ea');
const DAWN_EDGE = hex('#f3dcb8');
const SUN = hex('#ffcf86');

function sdRoundBox(px, py, half, radius) {
    const qx = Math.abs(px) - half + radius;
    const qy = Math.abs(py) - half + radius;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdSegment(px, py, ax, ay, bx, by) {
    const pax = px - ax;
    const pay = py - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay));
    return Math.hypot(pax - bax * h, pay - bay * h);
}

// Returns [r, g, b, a] for a point in icon space (-1..1, y up).
function shade(x, y, { contentScale, rounded }) {
    if (rounded && sdRoundBox(x, y, 1, 0.48) > 0) return [0, 0, 0, 0];

    // Dawn: warm paper, brighter where the sun is rising behind the mark.
    const r = Math.hypot(x, y - 0.25);
    let color = mixColor(DAWN_CENTRE, DAWN_EDGE, clamp(r / 1.35));
    color = mixColor(color, SUN, Math.exp(-(r * r) / 0.35) * 0.28);

    // Into the mark's own box (100 units, y down), centred on its middle.
    const X = 50 + (x / contentScale) * 50;
    const Y = 53.5 - (y / contentScale) * 50;

    if (sdSegment(X, Y, MARK_QUILL.from[0], MARK_QUILL.from[1], MARK_QUILL.to[0], MARK_QUILL.to[1]) < MARK_QUILL.width / 2) {
        color = C.goldDeep;
    }
    if (sdDrop(X, Y, GOLD_DROP) < 0) {
        const t = clamp((Y - 12) / 72);
        color = t < 0.55 ? mixColor(C.goldLight, C.gold, t / 0.55) : mixColor(C.gold, C.goldDeep, (t - 0.55) / 0.45);
    }
    const teal = sdDrop(X, Y, TEAL_DROP);
    if (teal < 0.65) {
        color = teal > -0.65 ? C.seam : mixColor(C.teal, C.tealDeep, clamp((Y - 32) / 48));
    }
    const ex = (X - MARK_EYE.cx) / MARK_EYE.rx;
    const ey = (Y - MARK_EYE.cy) / MARK_EYE.ry;
    if (ex * ex + ey * ey < 1) {
        color = mixColor(C.blue, C.blueDeep, clamp(Math.hypot(X - 47, Y - 61) / 13));
    }
    if (Math.hypot(X - MARK_GLINT.cx, Y - MARK_GLINT.cy) < MARK_GLINT.r) color = C.glint;

    return [...color, 1];
}

function render(size, options) {
    const pixels = Buffer.alloc(size * size * 4);
    const samples = 4;
    for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const x = ((i + (sx + 0.5) / samples) / size) * 2 - 1;
                    const y = 1 - ((j + (sy + 0.5) / samples) / size) * 2;
                    const [cr, cg, cb, ca] = shade(x, y, options);
                    r += cr * ca;
                    g += cg * ca;
                    b += cb * ca;
                    a += ca;
                }
            }
            const n = samples * samples;
            const offset = (j * size + i) * 4;
            pixels[offset] = a ? Math.round(r / a) : 0;
            pixels[offset + 1] = a ? Math.round(g / a) : 0;
            pixels[offset + 2] = a ? Math.round(b / a) : 0;
            pixels[offset + 3] = Math.round((a / n) * 255);
        }
    }
    return encodePng(size, pixels);
}

const ICONS = [
    { file: 'icon-192.png', size: 192, contentScale: 0.78, rounded: true },
    { file: 'icon-512.png', size: 512, contentScale: 0.78, rounded: true },
    { file: 'icon-maskable-512.png', size: 512, contentScale: 0.62, rounded: false },
    { file: 'icon-maskable-192.png', size: 192, contentScale: 0.62, rounded: false },
    { file: 'apple-touch-icon.png', size: 180, contentScale: 0.72, rounded: false },
    { file: 'favicon-32.png', size: 32, contentScale: 0.94, rounded: true },
    { file: 'shortcut-96.png', size: 96, contentScale: 0.78, rounded: true }
];

for (const icon of ICONS) {
    writeFileSync(resolve(outDir, icon.file), render(icon.size, icon));
    console.log(`  ✓ icons/${icon.file} (${icon.size}×${icon.size})`);
}

// Crisp vector favicon from the very same geometry.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs>
<radialGradient id="dawn" cx="50" cy="38" r="70" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8ea"/><stop offset="1" stop-color="#f3dcb8"/></radialGradient>
<linearGradient id="gold" x1="0" y1="12" x2="0" y2="84" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${MARK_COLORS.goldLight}"/><stop offset="0.55" stop-color="${MARK_COLORS.gold}"/><stop offset="1" stop-color="${MARK_COLORS.goldDeep}"/></linearGradient>
<linearGradient id="teal" x1="0" y1="32" x2="0" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${MARK_COLORS.teal}"/><stop offset="1" stop-color="${MARK_COLORS.tealDeep}"/></linearGradient>
<radialGradient id="blue" cx="47" cy="61" r="13" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${MARK_COLORS.blue}"/><stop offset="1" stop-color="${MARK_COLORS.blueDeep}"/></radialGradient>
</defs>
<rect width="100" height="100" rx="24" fill="url(#dawn)"/>
<g transform="translate(50 50) scale(0.94) translate(-50 -53.5)">
<path d="${QUILL_PATH}" fill="none" stroke="${MARK_COLORS.goldDeep}" stroke-width="${MARK_QUILL.width}" stroke-linecap="round"/>
<path d="${dropPath(GOLD_DROP)}" fill="url(#gold)"/>
<path d="${dropPath(TEAL_DROP)}" fill="url(#teal)" stroke="${MARK_COLORS.seam}" stroke-width="1.3"/>
<ellipse cx="${MARK_EYE.cx}" cy="${MARK_EYE.cy}" rx="${MARK_EYE.rx}" ry="${MARK_EYE.ry}" fill="url(#blue)"/>
<circle cx="${MARK_GLINT.cx}" cy="${MARK_GLINT.cy}" r="${MARK_GLINT.r}" fill="${MARK_COLORS.glint}"/>
</g>
</svg>
`;
writeFileSync(resolve(root, 'public/favicon.svg'), favicon);
console.log('  ✓ favicon.svg');
