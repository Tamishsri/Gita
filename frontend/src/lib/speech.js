// Shaping text for the ear: which voice to use, what to leave unsaid, and
// where a reader would breathe. Used by the verse reader (hooks/useVoiceReader).

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let cachedVoices = synth ? synth.getVoices() : [];

if (synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => {
        cachedVoices = synth.getVoices();
    });
}

export const speechSupported = () => Boolean(synth);

const NATURAL = /natural|neural|online|premium|enhanced|siri|wavenet/i;
const ROBOTIC = /espeak|compact|robot|novelty|whisper|bad news|bells|boing|bubbles|cellos|trinoids|zarvox|albert|jester|organ/i;
const KNOWN_GOOD = {
    en: ['Neerja', 'Prabhat', 'Aria', 'Jenny', 'Sonia', 'Libby', 'Ava', 'Samantha', 'Serena', 'Daniel', 'Google UK English Female', 'Google US English'],
    hi: ['Swara', 'Madhur', 'Lekha', 'Google हिन्दी', 'Kiyara']
};

/** The most natural-sounding voice this device has for the language (or null). */
export function pickVoice(lang, voices = cachedVoices.length ? cachedVoices : synth?.getVoices() || []) {
    const wanted = lang === 'hi' ? 'hi' : 'en';
    let best = null;
    let bestScore = -Infinity;
    voices.forEach((voice) => {
        const code = (voice.lang || '').toLowerCase().replace('_', '-');
        if (!code.startsWith(wanted)) return;
        let score = 0;
        if (NATURAL.test(voice.name)) score += 6;
        if (ROBOTIC.test(voice.name)) score -= 12;
        if (KNOWN_GOOD[wanted].some((name) => voice.name.includes(name))) score += 4;
        if (wanted === 'en' && code === 'en-in') score += 2;
        if (wanted === 'en' && code === 'en-gb') score += 1;
        if (voice.localService === false) score += 1;
        if (voice.default) score += 0.5;
        if (score > bestScore) {
            bestScore = score;
            best = voice;
        }
    });
    return best;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
    'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 47 → "forty-seven" (for chapter and verse numbers, said as words). */
export function numberWords(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return String(value);
    if (n < 20) return ONES[n];
    if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
    return String(n);
}

/** Clean text for the ear: no quotation marks, no bracketed references. */
export function forSpeech(text, lang = 'en') {
    let out = String(text || '')
        .replace(/[“”"«»]/g, '')
        .replace(/\s*\((\d{1,2})\.(\d{1,2})(?:[–,-]\s?\d{1,2}(?:\.\d{1,2})?)*\)/g, '')
        .replace(/\s*\[[^\]]*\]/g, '')
        .replace(/…|\.\.\./g, ',')
        .replace(/\s+/g, ' ')
        .trim();
    if (lang === 'en') out = out.replace(/\bBG\b/g, 'Bhagavad Gita');
    return out;
}

/**
 * Split text into phrases, each with the pause that follows it (ms) — the
 * small breath at a comma, the longer one at a full stop; for a śloka, a rest
 * at the half-line (।) and a longer one at the end of the verse (॥).
 * @returns {{ text: string, pause: number }[]}
 */
export function phrasesOf(text, { sanskrit = false } = {}) {
    const source = sanskrit
        ? String(text || '').replace(/[०-९]+/g, '').replace(/॥\s*[-–.]?\s*॥/g, '॥')
        : String(text || '');
    const parts = [];
    let current = '';
    const push = (pause) => {
        const phrase = current.replace(/\s+/g, ' ').trim();
        if (phrase && /[\p{L}\p{N}]/u.test(phrase)) parts.push({ text: phrase, pause });
        else if (parts.length && pause > parts[parts.length - 1].pause) parts[parts.length - 1].pause = pause;
        current = '';
    };
    for (const char of source) {
        if (sanskrit && char === '॥') { push(900); continue; }
        if (sanskrit && char === '।') { push(520); continue; }
        if (sanskrit && char === '\n') { push(420); continue; }
        current += char;
        if ('.?!।'.includes(char)) push(sanskrit ? 520 : 420);
        else if (';:—–'.includes(char)) push(260);
        else if (char === ',' && current.trim().split(' ').length > 3) push(160);
    }
    push(0);
    return parts;
}
