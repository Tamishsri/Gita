import { sanskritLines, verseMeaning, verseNumber, verseRef } from './verse';
import { ensureScriptFont, scriptById, transliterate } from './script';
import { BRAND } from './brand';

// Renders a verse as a lamplit manuscript page on an offscreen canvas.
// Everything is drawn procedurally — paper grain, mandala, double rule, the
// lamp — so the PNG is crisp at full resolution and needs no assets.

export const CARD_FORMATS = {
    portrait: { width: 1080, height: 1350, label: 'portrait', hint: '4:5' },
    square: { width: 1080, height: 1080, label: 'square', hint: '1:1' },
    story: { width: 1080, height: 1920, label: 'story', hint: '9:16' }
};

const MARIGOLD = '#e3a14a';
const MARIGOLD_LIGHT = '#f2c987';
const KUMKUM = '#c8553a';
const IVORY = '#efe4cd';
const IVORY_SOFT = 'rgba(239, 228, 205, 0.74)';

const FONTS = {
    sanskrit: '"Tiro Devanagari Sanskrit", "Noto Serif Devanagari", "Nirmala UI", serif',
    display: '"Cormorant Garamond", Georgia, serif',
    ui: '"Mukta", "Noto Sans Devanagari", system-ui, sans-serif'
};

function scriptFont(scriptId) {
    const script = scriptById(scriptId);
    return script.font ? `"${script.font}", ${FONTS.sanskrit}` : FONTS.sanskrit;
}

export async function ensureCardFonts(scriptId = 'deva') {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    await Promise.race([ensureScriptFont(scriptId), new Promise((resolve) => setTimeout(resolve, 2500))]);
    const loads = [
        `400 48px ${FONTS.sanskrit}`,
        `italic 400 48px ${FONTS.sanskrit}`,
        `italic 500 48px ${FONTS.display}`,
        `500 48px ${FONTS.display}`,
        `500 32px ${FONTS.ui}`,
        `400 32px ${FONTS.ui}`,
        `400 48px ${scriptFont(scriptId)}`
    ].map((font) => document.fonts.load(font, 'धर्म Gita ABC ধর্ম ધર્મ ధర్మ ಧರ್ಮ ധര്മ த⁴ர்ம').catch(() => null));
    await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 3000))]);
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

// Letter-spaced Latin capitals; never used for Indic scripts, where spacing
// would break the ligatures.
function drawSpaced(ctx, text, x, y, spacing) {
    if (/[^ -ɏ\s·—]/.test(text)) {
        ctx.fillText(text, x - ctx.measureText(text).width / 2, y);
        return;
    }
    let cursor = x - spacedWidth(ctx, text, spacing) / 2;
    [...text].forEach((char) => {
        ctx.fillText(char, cursor, y);
        cursor += ctx.measureText(char).width + spacing;
    });
}

function centred(ctx, text, x, y) {
    ctx.fillText(text, x - ctx.measureText(text).width / 2, y);
}

// ---------------------------------------------------------------------------
// Ornament
// ---------------------------------------------------------------------------

function grain(ctx, width, height) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 180;
    const tctx = tile.getContext('2d');
    const image = tctx.createImageData(180, 180);
    for (let i = 0; i < image.data.length; i += 4) {
        const value = 210 + Math.random() * 45;
        image.data[i] = value;
        image.data[i + 1] = value * 0.93;
        image.data[i + 2] = value * 0.8;
        image.data[i + 3] = Math.random() * 15;
    }
    tctx.putImageData(image, 0, 0);
    ctx.save();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

function background(ctx, width, height, lampY) {
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#0f1018');
    base.addColorStop(0.55, '#0c0d14');
    base.addColorStop(1, '#120d09');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const lamp = ctx.createRadialGradient(width / 2, lampY, 0, width / 2, lampY, width * 0.9);
    lamp.addColorStop(0, 'rgba(232, 170, 92, 0.24)');
    lamp.addColorStop(0.35, 'rgba(232, 170, 92, 0.07)');
    lamp.addColorStop(1, 'rgba(232, 170, 92, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.78);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    grain(ctx, width, height);
}

function mandala(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(227, 161, 74, 0.06)';
    ctx.lineWidth = 1.5;
    [1, 0.8, 0.58].forEach((scale) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
        ctx.stroke();
    });
    const petals = 16;
    for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.58);
        ctx.quadraticCurveTo(radius * 0.12, -radius * 0.79, 0, -radius * 0.99);
        ctx.quadraticCurveTo(-radius * 0.12, -radius * 0.79, 0, -radius * 0.58);
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function frame(ctx, width, height) {
    const outer = 42;
    const inner = 58;
    ctx.save();
    ctx.strokeStyle = 'rgba(227, 161, 74, 0.62)';
    ctx.lineWidth = 2;
    ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);
    ctx.strokeStyle = 'rgba(227, 161, 74, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);

    // Bindu at the head and foot of the page, kolam dots at the corners.
    [[width / 2, outer], [width / 2, height - outer]].forEach(([x, y]) => {
        ctx.fillStyle = '#0c0d14';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = KUMKUM;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
    });
    [[inner, inner], [width - inner, inner], [inner, height - inner], [width - inner, height - inner]].forEach(([x, y]) => {
        ctx.fillStyle = MARIGOLD;
        [[0, 0, 3.5], [14, 0, 2], [0, 14, 2], [-14, 0, 2], [0, -14, 2]].forEach(([dx, dy, r]) => {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
            ctx.fill();
        });
    });
    ctx.restore();
}

function diya(ctx, cx, cy, size) {
    const unit = size / 120;
    ctx.save();
    ctx.translate(cx - 60 * unit, cy - 60 * unit);
    ctx.scale(unit, unit);

    const halo = ctx.createRadialGradient(60, 52, 0, 60, 52, 60);
    halo.addColorStop(0, 'rgba(246, 200, 121, 0.5)');
    halo.addColorStop(0.45, 'rgba(227, 154, 69, 0.14)');
    halo.addColorStop(1, 'rgba(227, 154, 69, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(60, 52, 60, 0, Math.PI * 2);
    ctx.fill();

    const flame = ctx.createLinearGradient(60, 20, 60, 74);
    flame.addColorStop(0, '#fff3d6');
    flame.addColorStop(0.35, '#f7c56e');
    flame.addColorStop(0.8, '#e2832f');
    flame.addColorStop(1, '#b4502a');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(60, 22);
    ctx.bezierCurveTo(70, 38, 75, 50, 70, 62);
    ctx.bezierCurveTo(67, 70, 53, 70, 50, 62);
    ctx.bezierCurveTo(45, 50, 51, 38, 60, 22);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 248, 232, 0.85)';
    ctx.beginPath();
    ctx.moveTo(60, 46);
    ctx.bezierCurveTo(64, 53, 64, 60, 60, 65);
    ctx.bezierCurveTo(56, 60, 56, 53, 60, 46);
    ctx.fill();

    const clay = ctx.createLinearGradient(0, 74, 0, 100);
    clay.addColorStop(0, '#c0703f');
    clay.addColorStop(1, '#6e3418');
    ctx.fillStyle = clay;
    ctx.beginPath();
    ctx.moveTo(22, 76);
    ctx.bezierCurveTo(30, 98, 90, 98, 98, 76);
    ctx.bezierCurveTo(92, 79, 74, 81, 60, 81);
    ctx.bezierCurveTo(46, 81, 28, 79, 22, 76);
    ctx.fill();
    ctx.fillStyle = KUMKUM;
    ctx.beginPath();
    ctx.arc(60, 88, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function kolamRule(ctx, cx, y, half = 130) {
    ctx.save();
    ctx.strokeStyle = 'rgba(227, 161, 74, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx - 34, y);
    ctx.moveTo(cx + 34, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(227, 161, 74, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - 13, y, 13, 9, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 13, y, 13, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = KUMKUM;
    ctx.beginPath();
    ctx.arc(cx, y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function measureBlock(ctx, { sanskrit, meaning, essence, hindi, width, sanskritSize, meaningSize, includeSanskrit, sanskritFamily, italicSanskrit }) {
    const sanskritFont = `${italicSanskrit ? 'italic ' : ''}400 ${sanskritSize}px ${sanskritFamily}`;
    const meaningFont = hindi ? `400 ${meaningSize}px ${FONTS.ui}` : `italic 500 ${meaningSize}px ${FONTS.display}`;
    const essenceSize = Math.round(meaningSize * 0.66);
    const essenceFont = `400 ${essenceSize}px ${FONTS.ui}`;
    const sanskritLeading = sanskritSize * 1.7;
    const meaningLeading = meaningSize * (hindi ? 1.75 : 1.42);
    const essenceLeading = essenceSize * 1.6;

    let sanskritRows = [];
    if (includeSanskrit && sanskrit.length) {
        ctx.font = sanskritFont;
        sanskritRows = sanskrit.flatMap((line) => wrap(ctx, line, width));
    }
    ctx.font = meaningFont;
    const meaningRows = wrap(ctx, `“${meaning}”`, width - 20);
    ctx.font = essenceFont;
    const essenceRows = essence ? wrap(ctx, essence, width - 60) : [];

    const dividerSpace = sanskritRows.length ? 96 : 0;
    const essenceSpace = essenceRows.length ? 46 : 0;
    const height = sanskritRows.length * sanskritLeading + dividerSpace + meaningRows.length * meaningLeading + essenceSpace + essenceRows.length * essenceLeading;
    return { sanskritRows, meaningRows, essenceRows, sanskritFont, meaningFont, essenceFont, sanskritLeading, meaningLeading, essenceLeading, dividerSpace, essenceSpace, height };
}

/**
 * @param {object} verse
 * @param {{ format?: string, language?: string, includeSanskrit?: boolean, includeEssence?: boolean, script?: string, labels?: object }} options
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderWisdomCard(verse, {
    format = 'portrait',
    language = 'en',
    includeSanskrit = true,
    includeEssence = true,
    script = 'deva',
    labels = {}
} = {}) {
    await ensureCardFonts(script);

    const { width, height } = CARD_FORMATS[format] || CARD_FORMATS.portrait;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const cx = width / 2;
    const headerTop = format === 'story' ? 220 : 128;
    background(ctx, width, height, headerTop);
    mandala(ctx, cx, height * 0.52, width * 0.4);
    frame(ctx, width, height);

    const hindi = language === 'hi' && Boolean(verse.meaning_hi);
    const meaning = verseMeaning(verse, hindi ? 'hi' : 'en');
    const sanskrit = sanskritLines(transliterate(verse.sanskrit, script, verse.iast));
    const essenceText = includeEssence && verse.notification_short ? (verse.notification_short[hindi ? 'hi' : 'en'] || verse.notification_short.en) : null;

    // Header: the lamp, the name of the text, and where this verse lives.
    diya(ctx, cx, headerTop, 104);
    ctx.fillStyle = MARIGOLD_LIGHT;
    ctx.font = `400 32px ${FONTS.sanskrit}`;
    centred(ctx, 'श्रीमद्भगवद्गीता', cx, headerTop + 90);
    ctx.fillStyle = 'rgba(239, 228, 205, 0.55)';
    ctx.font = `500 21px ${FONTS.ui}`;
    drawSpaced(ctx, labels.chapterLine || `CHAPTER ${verse.chapter} · VERSE ${verseNumber(verse)}`, cx, headerTop + 128, 5);

    // Footer: the name, quietly.
    const footerBase = height - (format === 'story' ? 210 : 122);
    ctx.fillStyle = MARIGOLD;
    ctx.font = `500 30px ${FONTS.display}`;
    drawSpaced(ctx, labels.brand || BRAND.name.en.toUpperCase(), cx, footerBase, 10);
    ctx.fillStyle = 'rgba(239, 228, 205, 0.45)';
    ctx.font = `italic 500 24px ${FONTS.display}`;
    centred(ctx, labels.tagline || 'a quiet sanctuary', cx, footerBase + 38);

    // Body — shrink type until everything fits between header and footer.
    const top = headerTop + 196;
    const bottom = footerBase - 140;
    const available = bottom - top;
    const textWidth = width - 2 * (format === 'square' ? 150 : 140);
    const italicSanskrit = script === 'iast';

    let layout = null;
    let sanskritSize = format === 'story' ? 50 : 44;
    let meaningSize = format === 'story' ? 52 : hindi ? 38 : 46;
    let showSanskrit = includeSanskrit;
    let showEssence = Boolean(essenceText);
    for (let attempt = 0; attempt < 50; attempt++) {
        layout = measureBlock(ctx, {
            sanskrit, meaning, essence: showEssence ? essenceText : null, hindi, width: textWidth,
            sanskritSize, meaningSize, includeSanskrit: showSanskrit, sanskritFamily: scriptFont(script), italicSanskrit
        });
        if (layout.height <= available) break;
        if (showEssence && attempt > 6) showEssence = false;
        else if (sanskritSize > 30) sanskritSize -= 2;
        if (meaningSize > 28) meaningSize -= 2;
        else if (showSanskrit && sanskritSize <= 30) showSanskrit = false;
    }

    let y = top + Math.max(0, (available - layout.height) / 2);

    if (layout.sanskritRows.length) {
        ctx.font = layout.sanskritFont;
        ctx.fillStyle = IVORY;
        ctx.shadowColor = 'rgba(232, 170, 92, 0.22)';
        ctx.shadowBlur = 16;
        layout.sanskritRows.forEach((row) => {
            y += layout.sanskritLeading;
            centred(ctx, row, cx, y - layout.sanskritLeading * 0.3);
        });
        ctx.shadowBlur = 0;
        kolamRule(ctx, cx, y + layout.dividerSpace / 2 - 8);
        y += layout.dividerSpace;
    }

    ctx.font = layout.meaningFont;
    ctx.fillStyle = IVORY_SOFT;
    layout.meaningRows.forEach((row) => {
        y += layout.meaningLeading;
        centred(ctx, row, cx, y - layout.meaningLeading * 0.3);
    });

    if (layout.essenceRows.length) {
        y += layout.essenceSpace;
        ctx.font = layout.essenceFont;
        ctx.fillStyle = 'rgba(242, 201, 135, 0.78)';
        layout.essenceRows.forEach((row) => {
            y += layout.essenceLeading;
            centred(ctx, row, cx, y - layout.essenceLeading * 0.3);
        });
    }

    ctx.fillStyle = MARIGOLD;
    ctx.font = `500 22px ${FONTS.ui}`;
    drawSpaced(ctx, labels.citation || `BHAGAVAD GITA ${verseRef(verse)}`, cx, Math.min(y + 70, footerBase - 80), 4);

    return canvas;
}

export function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), 'image/png');
    });
}

export function cardFileName(verse, format) {
    return `${BRAND.slug}-BG-${verse.chapter}.${verseNumber(verse)}-${format}.png`;
}
