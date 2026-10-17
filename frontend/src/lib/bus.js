// Small app-wide intents that any component can raise and the app root
// handles — opening a practice, a verse, or a panel — so deep components never
// need callbacks threaded through every layer.

export const PRACTICE_EVENT = 'lg:open-practice';
export const VERSE_EVENT = 'lg:open-verse';

export function openPractice(id, payload = {}) {
    window.dispatchEvent(new CustomEvent(PRACTICE_EVENT, { detail: { id, ...payload } }));
}

export function openVerse(verse) {
    window.dispatchEvent(new CustomEvent(VERSE_EVENT, { detail: { verse } }));
}

export function verseLink(verse) {
    const id = verse?.id || `${verse.chapter}_${verse.verse || verse.verse_number}`;
    return `${window.location.origin}/?verse=${encodeURIComponent(id)}`;
}
