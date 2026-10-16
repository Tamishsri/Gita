// Thin, memoised client for the Living Gita API. The corpus never changes
// while the app is open, so chapter and verse lookups are cached for the
// session (and by the service worker across sessions).

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

const todayKey = () => new Date().toISOString().slice(0, 10);

export const fetchChapters = () => remember('chapters', () => getJSON('/api/verses/chapters'));

export const fetchChapter = (chapter) =>
    remember(`chapter:${chapter}`, () => getJSON(`/api/verses/chapters/${chapter}`));

export const fetchVerse = (id) => remember(`verse:${id}`, () => getJSON(`/api/verses/${encodeURIComponent(id)}`));

export const fetchDaily = () => remember(`daily:${todayKey()}`, () => getJSON('/api/daily'));

export function searchVerses(query, { limit = 20, signal } = {}) {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    return getJSON(`/api/verses/search?${params}`, { signal });
}

export function askSanctuary({ text, mood, settings }) {
    return getJSON('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood, settings })
    });
}
