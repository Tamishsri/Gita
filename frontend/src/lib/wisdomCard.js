import { sanskritLines, verseMeaning, verseNumber, verseRef } from './verse';

// Renders a verse as a museum-print card on an offscreen canvas.
// Everything is drawn procedurally — gradients, grain, mandala, frame and
// lotus — so the PNG is crisp at full resolution and needs no assets.

export const CARD_FORMATS = {
    portrait: { width: 1080, height: 1350, label: 'Portrait', hint: '4:5 · feed' },
    square: { width: 1080, height: 1080, label: 'Square', hint: '1:1 · post' },
    story: { width: 1080, height: 1920, label: 'Story', hint: '9:16 · status' }
};

const GOLD = '#d4af37';
const GOLD_LIGHT = '#ecd48a';
const IVORY = '#f1e8d4';
const IVORY_SOFT = 'rgba(241, 232, 212, 0.72)';

const FONTS = {
    devanagari: '"Noto Serif Devanagari", "Nirmala UI", "Kohinoor Devanagari", serif',
    display: '"Playfair Display", Georgia, serif',
    sacred: '"Cinzel", "Playfair Display", serif',
    ui: '"Inter", system-ui, sans-serif'
};

export async function ensureCardFonts() {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    const loads = [
        `500 48px ${FONTS.devanagari}`,
        `400 48px ${FONTS.devanagari}`,
        `italic 400 48px ${FONTS.display}`,
        `400 48px ${FONTS.display}`,
        `600 32px ${FONTS.sacred}`,
        `400 32px ${FONTS.sacred}`
    ].map((font) => document.fonts.load(font, 'धर्म Gita ABC').catch(() => null));
    await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 2500))]);
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function wrap(ctx, text, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !line) {
            line = candidate;
        } else {
            lines.push(line);
            line = word;
        }
    });
    if (line) lines.push(line);
    return lines;
}

function spacedWidth(ctx, text, spacing) {
    return [...text].reduce((total, char) => total + ctx.measureText(char).width + spacing, -spacing);
}

// Letter-spaced caps (never used for Devanagari, where spacing breaks ligatures).
function drawSpaced(ctx, text, x, y, spacing) {
    let cursor = x - spacedWidth(ctx, text, spacing) / 2;
    [...text].forEach((char) => {
        ctx.fillText(char, cursor, y);
        cursor += ctx.measureText(char).width + spacing;
    });
}

// ---------------------------------------------------------------------------
// Ornament
// ---------------------------------------------------------------------------

function grain(ctx, width, height) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 160;
    const tctx = tile.getContext('2d');
    const image = tctx.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
        const value = 200 + Math.random() * 55;
        image.data[i] = value;
        image.data[i + 1] = value * 0.95;
        image.data[i + 2] = value * 0.85;
        image.data[i + 3] = Math.random() * 16;
    }
    tctx.putImageData(image, 0, 0);
    ctx.save();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

function background(ctx, width, height) {
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#0d121b');
    base.addColorStop(0.5, '#0a0e14');
    base.addColorStop(1, '#110d07');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const crown = ctx.createRadialGradient(width / 2, height * 0.3, 0, width / 2, height * 0.3, width * 0.85);
    crown.addColorStop(0, 'rgba(212, 175, 55, 0.20)');
    crown.addColorStop(0.45, 'rgba(212, 175, 55, 0.06)');
    crown.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = crown;
    ctx.fillRect(0, 0, width, height);

    const ember = ctx.createRadialGradient(width / 2, height * 1.05, 0, width / 2, height * 1.05, width * 0.7);
    ember.addColorStop(0, 'rgba(180, 110, 40, 0.18)');
    ember.addColorStop(1, 'rgba(180, 110, 40, 0)');
    ctx.fillStyle = ember;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    grain(ctx, width, height);
}

function mandala(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.075)';
    ctx.lineWidth = 1.5;

    [1, 0.82, 0.62, 0.4].forEach((scale) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
        ctx.stroke();
    });

    const petals = 16;
    for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.4);
        ctx.quadraticCurveTo(radius * 0.13, -radius * 0.71, 0, -radius * 0.98);
        ctx.quadraticCurveTo(-radius * 0.13, -radius * 0.71, 0, -radius * 0.4);
        ctx.stroke();
        ctx.restore();
    }

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.045)';
    for (let i = 0; i < 48; i++) {
        ctx.save();
        ctx.rotate((i / 48) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 1.02);
        ctx.lineTo(0, -radius * 1.1);
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function frame(ctx, width, height) {
    const outer = 40;
    const inner = 58;
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);

    // Corner gems with short flourishes.
    const corners = [[inner, inner, 1, 1], [width - inner, inner, -1, 1], [inner, height - inner, 1, -1], [width - inner, height - inner, -1, -1]];
    corners.forEach(([x, y, dx, dy]) => {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 9, y);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 9, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + dx * 18, y);
        ctx.lineTo(x + dx * 70, y);
        ctx.moveTo(x, y + dy * 18);
        ctx.lineTo(x, y + dy * 70);
        ctx.stroke();
    });
    ctx.restore();
}

function lotus(ctx, cx, cy, size, color = GOLD) {
    const petal = (h, w) => {
        const r = (h * h + w * w) / (2 * w);
        const theta = Math.asin(h / r);
        ctx.beginPath();
        ctx.arc(-(r - w), 0, r, -theta, theta);
        ctx.arc(r - w, 0, r, Math.PI - theta, Math.PI + theta);
        ctx.closePath();
    };
    const unit = size / 100;
    const layers = [[-66, 17, 8, 0.5], [66, 17, 8, 0.5], [-34, 22, 9, 0.75], [34, 22, 9, 0.75], [0, 26, 10, 1]];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(unit, unit);
    ctx.translate(0, 12);
    layers.forEach(([angle, h, w, alpha]) => {
        ctx.save();
        ctx.rotate((angle * Math.PI) / 180);
        ctx.translate(0, -h);
        petal(h, w);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#0a0e14';
        ctx.stroke();
        ctx.restore();
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-27, 3);
    ctx.lineTo(27, 3);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy - 38 * unit, 3.6 * unit, 0, Math.PI * 2);
    ctx.fill();
}

function divider(ctx, cx, y, half = 120) {
    ctx.save();
    const left = ctx.createLinearGradient(cx - half, 0, cx - 18, 0);
    left.addColorStop(0, 'rgba(212, 175, 55, 0)');
    left.addColorStop(1, 'rgba(212, 175, 55, 0.75)');
    ctx.strokeStyle = left;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx - 18, y);
    ctx.stroke();

    const right = ctx.createLinearGradient(cx + 18, 0, cx + half, 0);
    right.addColorStop(0, 'rgba(212, 175, 55, 0.75)');
    right.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = right;
    ctx.beginPath();
    ctx.moveTo(cx + 18, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();

    ctx.fillStyle = GOLD_LIGHT;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(cx, y - 7);
    ctx.lineTo(cx + 7, y);
    ctx.lineTo(cx, y + 7);
    ctx.lineTo(cx - 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function measureBlock(ctx, { sanskrit, meaning, hindi, width, sanskritSize, meaningSize, includeSanskrit }) {
    const sanskritFont = `500 ${sanskritSize}px ${FONTS.devanagari}`;
    const meaningFont = hindi ? `400 ${meaningSize}px ${FONTS.devanagari}` : `italic 400 ${meaningSize}px ${FONTS.display}`;
    const sanskritLeading = sanskritSize * 1.62;
    const meaningLeading = meaningSize * (hindi ? 1.72 : 1.5);

    let sanskritRows = [];
    if (includeSanskrit && sanskrit.length) {
        ctx.font = sanskritFont;
        sanskritRows = sanskrit.flatMap((line) => wrap(ctx, line, width));
    }
    ctx.font = meaningFont;
    const meaningRows = wrap(ctx, `“${meaning}”`, width - 20);

    const dividerSpace = sanskritRows.length ? 104 : 0;
    const height = sanskritRows.length * sanskritLeading + dividerSpace + meaningRows.length * meaningLeading;
    return { sanskritRows, meaningRows, sanskritFont, meaningFont, sanskritLeading, meaningLeading, dividerSpace, height };
}

/**
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderWisdomCard(verse, { format = 'portrait', language = 'en', includeSanskrit = true } = {}) {
    await ensureCardFonts();

    const { width, height } = CARD_FORMATS[format] || CARD_FORMATS.portrait;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    background(ctx, width, height);
    mandala(ctx, width / 2, height * 0.5, width * 0.4);
    frame(ctx, width, height);

    const cx = width / 2;
    const hindi = language === 'hi' && Boolean(verse.meaning_hi);
    const meaning = verseMeaning(verse, hindi ? 'hi' : 'en');
    const sanskrit = sanskritLines(verse.sanskrit);

    // Header
    const headerTop = format === 'story' ? 210 : 130;
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.55)';
    ctx.shadowBlur = 26;
    lotus(ctx, cx, headerTop + 4, 84);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD_LIGHT;
    ctx.font = `500 30px ${FONTS.devanagari}`;
    const title = 'श्रीमद्भगवद्गीता';
    ctx.fillText(title, cx - ctx.measureText(title).width / 2, headerTop + 78);
    ctx.fillStyle = 'rgba(241, 232, 212, 0.58)';
    ctx.font = `600 21px ${FONTS.sacred}`;
    drawSpaced(ctx, `CHAPTER ${verse.chapter} · VERSE ${verseNumber(verse)}`, cx, headerTop + 118, 6);

    // Footer
    const footerBase = height - (format === 'story' ? 200 : 118);
    ctx.fillStyle = GOLD;
    ctx.font = `600 26px ${FONTS.sacred}`;
    drawSpaced(ctx, 'LIVING GITA', cx, footerBase, 11);
    ctx.fillStyle = 'rgba(241, 232, 212, 0.45)';
    ctx.font = `italic 400 22px ${FONTS.display}`;
    const tagline = 'a quiet sanctuary';
    ctx.fillText(tagline, cx - ctx.measureText(tagline).width / 2, footerBase + 38);

    // Body — shrink type until everything fits between header and footer.
    const top = headerTop + 190;
    const bottom = footerBase - 150;
    const available = bottom - top;
    const textWidth = width - 2 * (format === 'square' ? 150 : 140);

    let layout = null;
    let sanskritSize = format === 'story' ? 50 : 44;
    let meaningSize = format === 'story' ? 46 : hindi ? 36 : 40;
    let showSanskrit = includeSanskrit;
    for (let attempt = 0; attempt < 40; attempt++) {
        layout = measureBlock(ctx, { sanskrit, meaning, hindi, width: textWidth, sanskritSize, meaningSize, includeSanskrit: showSanskrit });
        if (layout.height <= available) break;
        if (sanskritSize > 30) sanskritSize -= 2;
        if (meaningSize > 26) meaningSize -= 2;
        else if (showSanskrit && sanskritSize <= 30) showSanskrit = false; // last resort: let the translation breathe
    }

    let y = top + Math.max(0, (available - layout.height) / 2);

    if (layout.sanskritRows.length) {
        ctx.font = layout.sanskritFont;
        ctx.fillStyle = IVORY;
        ctx.shadowColor = 'rgba(212, 175, 55, 0.25)';
        ctx.shadowBlur = 18;
        layout.sanskritRows.forEach((row) => {
            y += layout.sanskritLeading;
            ctx.fillText(row, cx - ctx.measureText(row).width / 2, y - layout.sanskritLeading * 0.28);
        });
        ctx.shadowBlur = 0;
        divider(ctx, cx, y + layout.dividerSpace / 2 - 6, 130);
        y += layout.dividerSpace;
    }

    ctx.font = layout.meaningFont;
    ctx.fillStyle = IVORY_SOFT;
    layout.meaningRows.forEach((row) => {
        y += layout.meaningLeading;
        ctx.fillText(row, cx - ctx.measureText(row).width / 2, y - layout.meaningLeading * 0.3);
    });

    // Citation
    ctx.fillStyle = GOLD;
    ctx.font = `400 24px ${FONTS.sacred}`;
    drawSpaced(ctx, `— BHAGAVAD GITA ${verseRef(verse)} —`, cx, Math.min(y + 74, footerBase - 84), 4);

    return canvas;
}

export function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), 'image/png');
    });
}

export function cardFileName(verse, format) {
    return `Living-Gita-BG-${verse.chapter}.${verseNumber(verse)}-${format}.png`;
}
