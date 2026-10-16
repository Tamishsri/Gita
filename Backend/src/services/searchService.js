// Verse search across all 701 verses.
//
// - Verse references ("2.47", "2:47", "2_47", "BG 18.66", "chapter 2 verse 47")
//   resolve directly to that verse.
// - Everything else is a ranked substring search: a match in a verse's core
//   themes outranks one in its emotional tone, then life situations, then the
//   translation text, then transliteration / Sanskrit / Hindi.
//
// The frontend service worker mirrors this logic for offline search
// (frontend/src/pwa/sw.js → searchCorpus); keep the two in step.

const FIELD_WEIGHTS = {
    core_theme: 6,
    emotional_tone: 5,
    life_situations: 4,
    meaning_en: 3,
    other: 1
};

function parseVerseRef(query) {
    if (!query) return null;
    const cleaned = query
        .trim()
        .toLowerCase()
        .replace(/^(bg|gita|bhagavad\s*gita|ch(apter)?\.?)\s*/, '');
    const match = cleaned.match(/^(\d{1,2})\s*(?:[.:_,\-/]|\s)\s*(?:v(?:erse)?\.?\s*)?(\d{1,3})$/);
    if (!match) return null;
    const chapter = Number(match[1]);
    const verse = Number(match[2]);
    if (chapter < 1 || chapter > 18 || verse < 1) return null;
    return `${chapter}_${verse}`;
}

const includes = (value, query) => typeof value === 'string' && value.toLowerCase().includes(query);
const anyIncludes = (list, query) => Array.isArray(list) && list.some((item) => includes(item, query));

function scoreVerse(verse, query) {
    let score = 0;
    if (anyIncludes(verse.core_theme, query)) score += FIELD_WEIGHTS.core_theme;
    if (anyIncludes(verse.emotional_tone, query)) score += FIELD_WEIGHTS.emotional_tone;
    if (anyIncludes(verse.life_situations, query)) score += FIELD_WEIGHTS.life_situations;
    if (includes(verse.meaning_en, query)) score += FIELD_WEIGHTS.meaning_en;
    if (
        includes(verse.meaning_hi, query) ||
        includes(verse.simple, query) ||
        includes(verse.iast, query) ||
        (typeof verse.sanskrit === 'string' && verse.sanskrit.includes(query))
    ) {
        score += FIELD_WEIGHTS.other;
    }
    return score;
}

/**
 * @param {object[]} verses  the full corpus, in canonical order
 * @param {string} rawQuery
 * @returns {{ match: 'reference' | 'text' | 'none', results: object[] }}
 */
function searchVerses(verses, rawQuery) {
    const query = (rawQuery || '').trim().toLowerCase();
    if (!query) return { match: 'none', results: [] };

    const ref = parseVerseRef(query);
    if (ref) {
        const verse = verses.find((item) => item.id === ref);
        return { match: 'reference', results: verse ? [verse] : [] };
    }

    const results = verses
        .map((verse, index) => ({ verse, index, score: scoreVerse(verse, query) }))
        .filter((item) => item.score > 0)
        // Highest score first; canonical order breaks ties so results are stable.
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((item) => item.verse);

    return { match: 'text', results };
}

module.exports = { searchVerses, parseVerseRef, scoreVerse };
