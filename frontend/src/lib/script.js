// Read the śloka in your own script.
//
// The Brahmic scripts of India share one phonetic layout, and Unicode encodes
// them in parallel blocks — क (U+0915) sits at the same offset as ক, ક, క, ಕ,
// ക… So Devanagari Sanskrit can be carried into Bengali, Gujarati, Gurmukhi,
// Odia, Telugu, Kannada and Malayalam by shifting each letter into the target
// block, with fallbacks where a script lacks a letter. Tamil, which has no
// voiced or aspirated stops, follows the scholarly convention of superscript
// numerals (க² for ख, க³ for ग, க⁴ for घ). IAST comes straight from the corpus.

export const SCRIPTS = [
    { id: 'deva', label: 'Devanagari', native: 'देवनागरी', sample: 'धर्म', font: null },
    { id: 'iast', label: 'Roman (IAST)', native: 'IAST', sample: 'dharma', font: null },
    { id: 'beng', label: 'Bengali', native: 'বাংলা', sample: 'ধর্ম', base: 0x0980, font: 'Noto Serif Bengali', script: 'Bengali' },
    { id: 'gujr', label: 'Gujarati', native: 'ગુજરાતી', sample: 'ધર્મ', base: 0x0a80, font: 'Noto Serif Gujarati', script: 'Gujarati' },
    { id: 'guru', label: 'Gurmukhi', native: 'ਗੁਰਮੁਖੀ', sample: 'ਧਰ੍ਮ', base: 0x0a00, font: 'Noto Serif Gurmukhi', script: 'Gurmukhi' },
    { id: 'orya', label: 'Odia', native: 'ଓଡ଼ିଆ', sample: 'ଧର୍ମ', base: 0x0b00, font: 'Noto Serif Oriya', script: 'Oriya' },
    { id: 'telu', label: 'Telugu', native: 'తెలుగు', sample: 'ధర్మ', base: 0x0c00, font: 'Noto Serif Telugu', script: 'Telugu' },
    { id: 'knda', label: 'Kannada', native: 'ಕನ್ನಡ', sample: 'ಧರ್ಮ', base: 0x0c80, font: 'Noto Serif Kannada', script: 'Kannada' },
    { id: 'mlym', label: 'Malayalam', native: 'മലയാളം', sample: 'ധര്മ', base: 0x0d00, font: 'Noto Serif Malayalam', script: 'Malayalam' },
    { id: 'taml', label: 'Tamil', native: 'தமிழ்', sample: 'த⁴ர்ம', font: 'Noto Serif Tamil', script: 'Tamil' }
];

export const scriptById = (id) => SCRIPTS.find((script) => script.id === id) || SCRIPTS[0];

// Letters a script lacks, carried in the closest conventional form.
const FALLBACKS = {
    beng: { 'व': 'ব', 'ॐ': 'ওঁ' },
    guru: { 'ऋ': 'ਰਿ', 'ृ': '੍ਰਿ', 'ॠ': 'ਰੀ', 'ष': 'ਸ਼', 'ऽ': '', 'ॐ': 'ਓਂ', 'ऌ': 'ਲ੍ਰਿ' },
    orya: { 'ॐ': 'ଓଁ' },
    telu: { 'ॐ': 'ఓం' },
    knda: { 'ॐ': 'ಓಂ' },
    mlym: { 'ॐ': 'ഓം' },
    gujr: {}
};

const SHARED = new Set(['।', '॥', ' ', '\n']);

function brahmic(text, script) {
    const fallbacks = FALLBACKS[script.id] || {};
    const belongs = new RegExp(`\\p{Script=${script.script}}`, 'u');
    let out = '';
    for (const char of text) {
        if (fallbacks[char] !== undefined) {
            out += fallbacks[char];
            continue;
        }
        const code = char.codePointAt(0);
        if (SHARED.has(char) || code < 0x0900 || code > 0x097f) {
            out += char;
            continue;
        }
        const mapped = String.fromCodePoint(script.base + (code - 0x0900));
        out += belongs.test(mapped) ? mapped : char;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Tamil, with superscript numerals for the sounds Tamil does not write
// ---------------------------------------------------------------------------

const TAMIL_CONSONANTS = {
    'क': ['க', ''], 'ख': ['க', '²'], 'ग': ['க', '³'], 'घ': ['க', '⁴'], 'ङ': ['ங', ''],
    'च': ['ச', ''], 'छ': ['ச', '²'], 'ज': ['ஜ', ''], 'झ': ['ஜ', '²'], 'ञ': ['ஞ', ''],
    'ट': ['ட', ''], 'ठ': ['ட', '²'], 'ड': ['ட', '³'], 'ढ': ['ட', '⁴'], 'ण': ['ண', ''],
    'त': ['த', ''], 'थ': ['த', '²'], 'द': ['த', '³'], 'ध': ['த', '⁴'], 'न': ['ந', ''],
    'प': ['ப', ''], 'फ': ['ப', '²'], 'ब': ['ப', '³'], 'भ': ['ப', '⁴'], 'म': ['ம', ''],
    'य': ['ய', ''], 'र': ['ர', ''], 'ल': ['ல', ''], 'ळ': ['ள', ''], 'व': ['வ', ''],
    'श': ['ஶ', ''], 'ष': ['ஷ', ''], 'स': ['ஸ', ''], 'ह': ['ஹ', '']
};

const TAMIL_VOWELS = {
    'अ': 'அ', 'आ': 'ஆ', 'इ': 'இ', 'ई': 'ஈ', 'उ': 'உ', 'ऊ': 'ஊ', 'ऋ': 'ரு', 'ॠ': 'ரூ',
    'ए': 'ஏ', 'ऐ': 'ஐ', 'ओ': 'ஓ', 'औ': 'ஔ', 'ऌ': 'லு'
};

const TAMIL_SIGNS = {
    'ा': 'ா', 'ि': 'ி', 'ी': 'ீ', 'ु': 'ு', 'ू': 'ூ', 'ृ': '்ரு', 'ॄ': '்ரூ',
    'े': 'ே', 'ै': 'ை', 'ो': 'ோ', 'ौ': 'ௌ', '्': '்'
};

const TAMIL_OTHER = { 'ं': 'ம்', 'ँ': 'ம்', 'ः': 'ஃ', 'ऽ': '’', 'ॐ': 'ஓம்', '़': '' };

function tamil(text) {
    let out = '';
    let pending = '';
    const flush = () => {
        out += pending;
        pending = '';
    };
    for (const char of text) {
        if (TAMIL_CONSONANTS[char]) {
            flush();
            const [letter, mark] = TAMIL_CONSONANTS[char];
            out += letter;
            pending = mark; // the numeral follows the whole syllable
        } else if (TAMIL_SIGNS[char]) {
            out += TAMIL_SIGNS[char];
            if (char !== '्') flush();
        } else if (TAMIL_VOWELS[char]) {
            flush();
            out += TAMIL_VOWELS[char];
        } else if (TAMIL_OTHER[char] !== undefined) {
            flush();
            out += TAMIL_OTHER[char];
        } else {
            const code = char.codePointAt(0);
            flush();
            out += code >= 0x0966 && code <= 0x096f ? String.fromCodePoint(0x0be6 + code - 0x0966) : char;
        }
    }
    flush();
    return out;
}

/**
 * @param {string} devanagari  the śloka in Devanagari
 * @param {string} scriptId    one of SCRIPTS
 * @param {string} [iast]      the corpus' romanisation, used for 'iast'
 */
export function transliterate(devanagari, scriptId, iast) {
    if (!devanagari) return devanagari;
    if (!scriptId || scriptId === 'deva') return devanagari;
    if (scriptId === 'iast') return iast || devanagari;
    if (scriptId === 'taml') return tamil(devanagari);
    const script = scriptById(scriptId);
    return script.base ? brahmic(devanagari, script) : devanagari;
}

// Fonts for other scripts are fetched only when someone chooses them.
// Resolves once the stylesheet is in, so canvas drawing can wait for it.
const requested = new Map();

export function ensureScriptFont(scriptId) {
    const script = scriptById(scriptId);
    if (!script.font || typeof document === 'undefined') return Promise.resolve();
    if (requested.has(script.font)) return requested.get(script.font);
    const ready = new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(script.font)}:wght@400;500&display=swap`;
        link.onload = resolve;
        link.onerror = resolve;
        document.head.appendChild(link);
    });
    requested.set(script.font, ready);
    return ready;
}

export function scriptFontFamily(scriptId) {
    const script = scriptById(scriptId);
    if (scriptId === 'iast') return 'var(--font-sanskrit)';
    return script.font ? `"${script.font}", var(--font-sanskrit)` : 'var(--font-sanskrit)';
}
