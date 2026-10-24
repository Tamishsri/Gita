const { getVerses } = require('../data/loader');

// Recitation in a human voice (ElevenLabs), for the verses only.
//
// · Only verses are ever spoken. A request names a verse and a part — never
//   free text — so the key cannot be used to say anything else, and nothing a
//   person writes ever leaves their device for this.
// · Each recitation is generated once: the CDN keeps it for a year and the
//   device keeps it too (the service worker), so all 701 verses cost a few
//   thousand generations at most, ever.
// · Without ELEVENLABS_API_KEY the status says so, and the app recites with
//   the device's own voice instead.

const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE = 'uuyFQegRan8rpIQCGu9K'; // "Viraj": a calm, warm Hindi narrator for devotional reading
const DEFAULT_MODEL = 'eleven_multilingual_v2';
// Bump when the text or the voice settings change, so cached recitations are replaced.
const REVISION = 1;
const PARTS = ['sloka', 'meaning'];
const LANGUAGES = ['en', 'hi'];
const TIMEOUT_MS = 30000;

const config = () => ({
    key: String(process.env.ELEVENLABS_API_KEY || '').trim(),
    voice: String(process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE).trim(),
    model: String(process.env.ELEVENLABS_MODEL || DEFAULT_MODEL).trim()
});

// v3-generation models take no <break> tags; v2 models rest where they are placed.
const takesBreaks = (model) => !/v3|v4/.test(model);
const rest = (model, seconds) => (takesBreaks(model) ? ` <break time="${seconds}s" /> ` : ' ');

/** The śloka as a reciter breathes it: a rest at each half-line, none of the verse numbers. */
function slokaText(verse, model) {
    const halfLines = String(verse.sanskrit || '')
        .replace(/[०-९0-9]+/g, '')
        .replace(/ऽ/g, '')
        .replace(/॥\s*[-–.]?\s*॥/g, '॥')
        .split(/[।॥|\n]+/)
        .map((line) => line.replace(/[^\p{L}\p{M}\s-]/gu, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    return halfLines.map((line) => `${line}।`).join(rest(model, 0.7)).trim();
}

/** The meaning, as the app shows it, then where it is from. */
function meaningText(verse, lang, model) {
    const raw = lang === 'hi' && verse.meaning_hi ? verse.meaning_hi : verse.meaning_en || verse.translation_en || verse.simple || verse.meaning_hi || '';
    const meaning = String(raw)
        .replace(/[“”"«»]/g, '')
        .replace(/\s*\((\d{1,2})\.(\d{1,2})(?:[–,-]\s?\d{1,2}(?:\.\d{1,2})?)*\)/g, '')
        .replace(/\s*\[[^\]]*\]/g, '')
        .replace(/…|\.\.\./g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
    const [chapter, number] = String(verse.id).split('_');
    const source = lang === 'hi' ? `भगवद्गीता, अध्याय ${chapter}, श्लोक ${number}।` : `Bhagavad Gita, chapter ${chapter}, verse ${number}.`;
    return `${meaning}${rest(model, 1)}${source}`;
}

// The voice, set for each part: the śloka slower and steadier, the meaning warmer.
const VOICE_SETTINGS = {
    sloka: { stability: 0.62, similarity_boost: 0.8, style: 0.12, use_speaker_boost: true, speed: 0.88 },
    meaning: { stability: 0.5, similarity_boost: 0.8, style: 0.22, use_speaker_boost: true, speed: 0.94 }
};

// A few recent recitations, kept by this instance between CDN misses.
const memory = new Map();
const MEMORY_LIMIT = 24;
const remember = (key, audio) => {
    memory.set(key, audio);
    if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
};

// Generations per visitor, per instance — the CDN answers repeats without reaching here.
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_LIMIT = 24;
const visitors = new Map();
function allowed(ip) {
    const now = Date.now();
    const recent = (visitors.get(ip) || []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= WINDOW_LIMIT) {
        visitors.set(ip, recent);
        return false;
    }
    recent.push(now);
    visitors.set(ip, recent);
    if (visitors.size > 5000) visitors.delete(visitors.keys().next().value);
    return true;
}

async function synthesise(text, part, lang, { key, voice, model }) {
    const body = { text, model_id: model, voice_settings: VOICE_SETTINGS[part] };
    // Only the turbo and flash models accept a language to hold to.
    if (/turbo|flash/.test(model)) body.language_code = part === 'sloka' ? 'hi' : lang;
    const url = `${ENDPOINT}/${encodeURIComponent(voice)}?output_format=mp3_44100_128`;
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            if (response.ok) return Buffer.from(await response.arrayBuffer());
            const retriable = response.status === 429 || response.status >= 500;
            if (!retriable || attempt === 1) {
                const detail = await response.text().catch(() => '');
                const error = new Error(`ElevenLabs ${response.status}: ${detail.slice(0, 200)}`);
                error.status = response.status;
                throw error;
            }
        } finally {
            clearTimeout(timer);
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
    }
    throw new Error('ElevenLabs: no response');
}

// @desc    Whether a human recitation voice is available
// @route   GET /api/voice
exports.status = (req, res) => {
    const { key } = config();
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.json({ available: Boolean(key), voice: 'Viraj', revision: REVISION });
};

// @desc    One verse, recited: the śloka, or its meaning
// @route   GET /api/voice/:id?part=sloka|meaning&lang=en|hi
exports.recite = async (req, res) => {
    const noStore = () => res.set('Cache-Control', 'no-store');
    try {
        const settings = config();
        if (!settings.key) {
            noStore();
            return res.status(503).json({ msg: 'Recitation voice is not configured' });
        }
        const id = String(req.params.id || '');
        const part = PARTS.includes(req.query.part) ? req.query.part : null;
        const lang = LANGUAGES.includes(req.query.lang) ? req.query.lang : 'en';
        if (!/^\d{1,2}_\d{1,3}$/.test(id) || !part) {
            noStore();
            return res.status(400).json({ msg: 'Ask for a verse id like 2_47 and part=sloka or part=meaning' });
        }
        const verse = getVerses().find((item) => item.id === id);
        if (!verse || (part === 'sloka' && !verse.sanskrit)) {
            noStore();
            return res.status(404).json({ msg: 'No such verse' });
        }

        const cacheKey = `${REVISION}:${settings.voice}:${settings.model}:${id}:${part}:${part === 'sloka' ? 'sa' : lang}`;
        let audio = memory.get(cacheKey);
        if (!audio) {
            const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
            if (!allowed(ip)) {
                noStore();
                res.set('Retry-After', '120');
                return res.status(429).json({ msg: 'Too many recitations at once — try again in a minute' });
            }
            const text = part === 'sloka' ? slokaText(verse, settings.model) : meaningText(verse, lang, settings.model);
            audio = await synthesise(text, part, lang, settings);
            remember(cacheKey, audio);
        }

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(audio.length),
            // The same verse always sounds the same: keep it at the edge and on the device.
            'Cache-Control': 'public, max-age=2592000, s-maxage=31536000, immutable'
        });
        return res.send(audio);
    } catch (err) {
        console.error(err.message);
        noStore();
        return res.status(502).json({ msg: 'The recitation voice could not be reached' });
    }
};

exports._internal = { slokaText, meaningText, REVISION };
