// "Your Path" — a private, on-device record of how someone has used the
// sanctuary: moods named, verses received, practices kept. It powers the Path
// page, keeps the sanctuary from repeating verses, and never leaves the device.

export const PATH_KEY = 'lgPath';
export const PATH_EVENT = 'lgPathUpdated';
const MAX_EVENTS = 3000;

/** @typedef {'mood'|'verse'|'breaths'|'japa'|'dhyana'|'sankalpa'|'sandhya'|'reflection'|'walk'|'learned'} PathKind */

export function readPath() {
    try {
        const events = JSON.parse(localStorage.getItem(PATH_KEY) || '[]');
        return Array.isArray(events) ? events : [];
    } catch {
        return [];
    }
}

/**
 * @param {PathKind} kind
 * @param {object} [data]
 */
export function recordPath(kind, data = {}) {
    try {
        const events = readPath();
        events.push({ kind, at: new Date().toISOString(), ...data });
        localStorage.setItem(PATH_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
        window.dispatchEvent(new Event(PATH_EVENT));
    } catch {
        // storage full or disabled — the path simply isn't kept
    }
}

export function releasePath() {
    localStorage.removeItem(PATH_KEY);
    window.dispatchEvent(new Event(PATH_EVENT));
}

// Verse ids shown recently, newest last — sent so answers stay fresh.
export function recentVerseIds(limit = 30) {
    const ids = [];
    const events = readPath();
    for (let i = events.length - 1; i >= 0 && ids.length < limit; i--) {
        const id = events[i].kind === 'verse' && events[i].verseId;
        if (id && !ids.includes(id)) ids.push(id);
    }
    return ids.reverse();
}

export function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function eventsOn(dateKey, events = readPath()) {
    return events.filter((event) => localDateKey(new Date(event.at)) === dateKey);
}
