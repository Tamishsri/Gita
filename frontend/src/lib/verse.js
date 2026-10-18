import { numberWords } from './speech';
import { playChime } from './chime';
import { haptic } from './haptics';
import { appName } from './brand';

// ---------------------------------------------------------------------------
// Reading a verse
// ---------------------------------------------------------------------------

export const verseNumber = (verse) => verse?.verse ?? verse?.verse_number;

export const verseRef = (verse) => `${verse.chapter}.${verseNumber(verse)}`;

export const verseCitation = (verse) => `Chapter ${verse.chapter}, Verse ${verseNumber(verse)}`;

export const verseKey = (verse) => verse?.id || `${verse.chapter}_${verseNumber(verse)}`;

export function verseMeaning(verse, language = 'en') {
    if (!verse) return '';
    if (language === 'hi' && verse.meaning_hi) return verse.meaning_hi;
    return verse.meaning_en || verse.translation_en || verse.simple || verse.meaning_hi || '';
}

// Break a śloka into its traditional half-lines, ending each at a daṇḍa (। or ॥).
// Verse numerals that trail a double daṇḍa ("॥ १ ॥") stay with their line.
export function sanskritLines(text) {
    if (!text) return [];
    const parts = text
        .replace(/([।॥]+)\s*/g, '$1\n')
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean);

    return parts.reduce((lines, part) => {
        if (/^[\d०-९\s।॥]+$/.test(part) && lines.length) {
            lines[lines.length - 1] = `${lines[lines.length - 1]} ${part}`;
        } else {
            lines.push(part);
        }
        return lines;
    }, []);
}

export function speechTextFor(verse, language = 'en') {
    const meaning = verseMeaning(verse, language);
    if (language === 'hi') return verse.meaning_hi || verse.sanskrit || meaning;
    return `${meaning}. Bhagavad Gita, ${verseCitation(verse)}.`;
}

/** A verse as a recitation: the śloka, then its meaning, then where it comes from. */
export function speechSectionsFor(verse, language = 'en') {
    const chapter = Number(verse.chapter);
    const number = Number(verse.verse || verse.verse_number);
    const meaning = verseMeaning(verse, language);
    const source = language === 'hi'
        ? `भगवद्गीता, अध्याय ${chapter}, श्लोक ${number}।`
        : `Bhagavad Gita, chapter ${numberWords(chapter)}, verse ${numberWords(number)}.`;
    return [
        verse.sanskrit ? { text: verse.sanskrit, lang: 'hi', sanskrit: true } : null,
        meaning ? { text: meaning, lang: language === 'hi' ? 'hi' : 'en' } : null,
        { text: source, lang: language === 'hi' ? 'hi' : 'en' }
    ].filter(Boolean);
}

export function verseShareText(verse, language = 'en') {
    const meaning = verseMeaning(verse, language);
    const sanskrit = verse.sanskrit ? `${verse.sanskrit}\n\n` : '';
    return `${sanskrit}"${meaning}"\n\n— Bhagavad Gita ${verseRef(verse)}\n🪔 ${appName(language)}`;
}

// Accepts "2.47", "2:47", "2_47", "2 47", "BG 2.47", "ch 2 v 47", "chapter 2 verse 47".
export function parseVerseRef(query) {
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
    return { chapter, verse, id: `${chapter}_${verse}` };
}

// ---------------------------------------------------------------------------
// Clipboard (with a fallback for plain-http LAN testing on phones)
// ---------------------------------------------------------------------------

export async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy path
    }

    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Saved line — only ever one (aparigraha: holding lightly)
// ---------------------------------------------------------------------------

export const SAVED_LINE_KEY = 'savedLine';
export const SAVED_LINE_EVENT = 'savedLineUpdated';

export function readSavedLine() {
    try {
        const raw = localStorage.getItem(SAVED_LINE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveLine(text, verse = null) {
    if (!text) return false;
    const replaced = Boolean(readSavedLine());
    const line = {
        text,
        savedAt: new Date().toISOString(),
        citation: verse ? verseCitation(verse) : undefined,
        verseId: verse ? verseKey(verse) : undefined
    };
    localStorage.setItem(SAVED_LINE_KEY, JSON.stringify(line));
    window.dispatchEvent(new Event(SAVED_LINE_EVENT));
    playChime('soft');
    haptic('success');
    return { replaced };
}

export function releaseSavedLine() {
    localStorage.removeItem(SAVED_LINE_KEY);
    window.dispatchEvent(new Event(SAVED_LINE_EVENT));
}

// ---------------------------------------------------------------------------
// Reflections journal
// ---------------------------------------------------------------------------

export const REFLECTIONS_KEY = 'userReflections';
export const REFLECTIONS_EVENT = 'userReflectionsUpdated';

export function readReflections() {
    try {
        const parsed = JSON.parse(localStorage.getItem(REFLECTIONS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeReflections(list) {
    if (list.length) {
        localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(list));
    } else {
        localStorage.removeItem(REFLECTIONS_KEY);
    }
    window.dispatchEvent(new Event(REFLECTIONS_EVENT));
}

export function addReflection({ verse = null, citation, verseText, note, kind = 'verse' }) {
    const entry = {
        id: `${Date.now()}`,
        verseId: verse ? verseKey(verse) : undefined,
        citation: citation || (verse ? verseCitation(verse) : 'Bhagavad Gita'),
        verseText: verseText ?? (verse ? verseMeaning(verse) || verse.sanskrit : ''),
        note: note.trim(),
        kind,
        date: new Date().toISOString()
    };
    writeReflections([entry, ...readReflections()]);
    playChime('soft');
    haptic('success');
    return entry;
}

// ---------------------------------------------------------------------------
// Wisdom card — opened from anywhere, rendered once at the app root
// ---------------------------------------------------------------------------

export const WISDOM_CARD_EVENT = 'lg:wisdom-card';

export function openWisdomCard(verse, language) {
    if (!verse) return;
    window.dispatchEvent(new CustomEvent(WISDOM_CARD_EVENT, { detail: { verse, language } }));
}
