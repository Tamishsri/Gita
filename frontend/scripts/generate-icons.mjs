// Generates the Living Gita app icons with no dependencies:
// a signed-distance-field rasteriser (4×4 supersampled) and a tiny PNG encoder.
//
//   node scripts/generate-icons.mjs
//
// Writes public/icons/*.png and public/favicon.svg.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Geometry (normalised coordinates, y up, icon spans -1..1)
// ---------------------------------------------------------------------------

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixColor = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

// Inigo Quilez's vesica: a vertical petal of half-height b and half-width w.
function sdVesica(px, py, halfHeight, halfWidth) {
    const r = (halfHeight * halfHeight + halfWidth * halfWidth) / (2 * halfWidth);
    const d = r - halfWidth;
    const x = Math.abs(px);
    const y = Math.abs(py);
    const b = Math.sqrt(r * r - d * d);
    return (y - b) * d > x * b ? Math.hypot(x, y - b) : Math.hypot(x + d, y) - r;
}

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

// Lotus in the same units as LotusMark.jsx (a -50..50 box, y down) scaled to 1/50.
const S = 1 / 50;
const PETALS = [
    { angle: -66, h: 17, w: 8, shade: 0.72 },
    { angle: 66, h: 17, w: 8, shade: 0.72 },
    { angle: -34, h: 22, w: 9, shade: 0.86 },
    { angle: 34, h: 22, w: 9, shade: 0.86 },
    { angle: 0, h: 26, w: 10, shade: 1 }
].map((petal) => {
    const rad = (petal.angle * Math.PI) / 180;
    // Petal centre: pivot (0, 12) then rotate (0, -h) — in y-down units.
    const cx = Math.sin(rad) * petal.h; // rotate (0,-h) by angle (y-down, clockwise)
    const cy = 12 - Math.cos(rad) * petal.h;
    return { ...petal, rad, cx: cx * S, cy: -cy * S, h: petal.h * S, w: petal.w * S };
});

const INK = [10, 14, 20];
const INK_TOP = [27, 34, 48];
const GOLD_LIGHT = [246, 223, 150];
const GOLD = [212, 175, 55];
const GOLD_DEEP = [150, 112, 32];

function goldAt(y) {
    const t = clamp((y + 0.6) / 1.2);
    return t > 0.5 ? mixColor(GOLD, GOLD_LIGHT, (t - 0.5) * 2) : mixColor(GOLD_DEEP, GOLD, t * 2);
}

// Returns [r, g, b, a] (0-255, alpha 0-1) for a point in icon space.
function shade(x, y, { contentScale, rounded }) {
    if (rounded && sdRoundBox(x, y, 1, 0.44) > 0) return [0, 0, 0, 0];

    // Background: night sky with a warm glow behind the lotus.
    const r = Math.hypot(x, y + 0.1);
    let color = mixColor(INK_TOP, INK, clamp((1 - y) / 2 * 1.1));
    const glow = Math.exp(-(r * r) / 0.22) * 0.32;
    color = mixColor(color, GOLD, glow * 0.5);

    // Content in its own scaled space so maskable icons keep a safe zone.
    const px = x / contentScale;
    const py = y / contentScale;

    // Rings
    const ring = Math.abs(Math.hypot(px, py) - 0.9) - 0.022;
    if (ring < 0) color = goldAt(py);
    const inner = Math.abs(Math.hypot(px, py) - 0.8) - 0.006;
    if (inner < 0) color = mixColor(color, GOLD, 0.55);

    // Petals, back to front, each with a dark separating edge.
    for (const petal of PETALS) {
        const cos = Math.cos(-petal.rad);
        const sin = Math.sin(-petal.rad);
        const dx = px - petal.cx;
        const dy = py - petal.cy;
        // rotate into petal space (y up); petal angle is clockwise in y-down = clockwise visual
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const d = sdVesica(lx, ly, petal.h, petal.w);
        if (d < 0) {
            const tip = clamp((ly / petal.h + 1) / 2);
            color = mixColor(mixColor(GOLD_DEEP, GOLD_LIGHT, tip), GOLD, 0.25).map((v) => v * petal.shade);
            if (d > -0.03) color = mixColor(color, INK, 0.85);
        }
    }

    // Water line and bindu
    if (sdSegment(px, py, -0.54, -0.3, 0.54, -0.3) < 0.035) color = goldAt(py);
    if (Math.hypot(px, py - 0.76) < 0.075) color = GOLD_LIGHT;

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
    { file: 'icon-192.png', size: 192, contentScale: 0.86, rounded: true },
    { file: 'icon-512.png', size: 512, contentScale: 0.86, rounded: true },
    { file: 'icon-maskable-512.png', size: 512, contentScale: 0.7, rounded: false },
    { file: 'icon-maskable-192.png', size: 192, contentScale: 0.7, rounded: false },
    { file: 'apple-touch-icon.png', size: 180, contentScale: 0.78, rounded: false },
    { file: 'favicon-32.png', size: 32, contentScale: 0.98, rounded: true },
    { file: 'shortcut-96.png', size: 96, contentScale: 0.86, rounded: true }
];

for (const icon of ICONS) {
    writeFileSync(resolve(outDir, icon.file), render(icon.size, icon));
    console.log(`  ✓ icons/${icon.file} (${icon.size}×${icon.size})`);
}

// Crisp vector favicon drawn from the same geometry.
const petalPath = (h, w) => {
    const r = (h * h + w * w) / (2 * w);
    return `M0 ${-h}A${r} ${r} 0 0 1 0 ${h}A${r} ${r} 0 0 1 0 ${-h}Z`;
};
const svgPetals = [[-66, 17, 8, 0.6], [66, 17, 8, 0.6], [-34, 22, 9, 0.8], [34, 22, 9, 0.8], [0, 26, 10, 1]]
    .map(([angle, h, w, opacity]) => `<path d="${petalPath(h, w)}" transform="rotate(${angle}) translate(0 ${-h})" fill="url(#g)" fill-opacity="${opacity}" stroke="#0a0e14" stroke-width="1.8"/>`)
    .join('');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">
<defs><linearGradient id="g" x1="0" y1="-40" x2="0" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f6df96"/><stop offset="1" stop-color="#b48f2a"/></linearGradient>
<radialGradient id="bg" cx="0" cy="-5" r="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1d2433"/><stop offset="1" stop-color="#0a0e14"/></radialGradient></defs>
<rect x="-50" y="-50" width="100" height="100" rx="22" fill="url(#bg)"/>
<g transform="scale(0.86)"><circle r="45" fill="none" stroke="#d4af37" stroke-width="2.2"/><g transform="translate(0 12)">${svgPetals}<path d="M-27 3H27" stroke="#d4af37" stroke-width="3.2" stroke-linecap="round"/></g><circle cy="-38" r="3.8" fill="#f6df96"/></g>
</svg>
`;
writeFileSync(resolve(root, 'public/favicon.svg'), favicon);
console.log('  ✓ favicon.svg');
