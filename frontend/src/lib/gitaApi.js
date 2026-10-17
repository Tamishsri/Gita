// Thin, memoised client for the Sakha API. The corpus never changes
// while the app is open, so chapter and verse lookups are cached for the
// session (and by the service worker across sessions).

import { localDateKey } from './path';

const memo = new Map();

function remember(key, load) {
    if (!memo.has(key)) {
        memo.set(key, load().catch((error) => {
            memo.delete(key);
            throw error;
        }));
    }
    return memo.get(key);
}

async function getJSON(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
        const error = new Error(`Request failed: ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

export const fetchChapters = () => remember('chapters', () => getJSON('/api/verses/chapters'));

export const fetchChapter = (chapter) =>
    remember(`chapter:${chapter}`, () => getJSON(`/api/verses/chapters/${chapter}`));

export const fetchVerse = (id) => remember(`verse:${id}`, () => getJSON(`/api/verses/${encodeURIComponent(id)}`));

// The person's *local* date, so the verse turns over at their midnight.
export const fetchDaily = () => {
    const date = localDateKey();
    return remember(`daily:${date}`, () => getJSON(`/api/daily?date=${date}`));
};

export function searchVerses(query, { limit = 20, signal } = {}) {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return getJSON(`/api/verses/search?${params}`, { signal });
}

/**
 * @param {{ text?: string, mood?: string, settings?: object, history?: string[], exclude?: string[], another?: boolean }} request
 */
export function askSanctuary({ text, mood, settings, history = [], exclude = [], another = false }) {
    return getJSON('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood, settings, history, exclude, another })
    });
}
