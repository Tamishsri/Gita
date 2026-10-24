/* eslint-disable no-restricted-globals */
// Sakha service worker — the offline engine.
//
// Built by the `living-gita-sw` Vite plugin, which replaces the two
// placeholders below with the hashed build manifest and a content version.
//
//  · App shell:   precached on install, served cache-first.
//  · Wisdom data: all 18 chapters (701 verses) gathered into a durable cache.
//  · Offline API: when the network is unreachable, /api/* is answered here —
//                 search, verse lookup, daily verse and even /api/chat — by the
//                 shared Wisdom Engine, the same code the server runs.

/*__WISDOM_ENGINE__*/

const VERSION = '__BUILD_VERSION__';
const PRECACHE = __PRECACHE_MANIFEST__;

const SHELL_CACHE = `lg-shell-${VERSION}`;
const WISDOM_CACHE = 'lg-wisdom-v1';
const FONT_CACHE = 'lg-fonts-v1';
const RUNTIME_CACHE = 'lg-runtime-v1';
// Recitations in a human voice: each verse once, then from the device.
const VOICE_CACHE = 'lg-voice-v1';
const KEEP = new Set([SHELL_CACHE, WISDOM_CACHE, FONT_CACHE, RUNTIME_CACHE, VOICE_CACHE]);

const CHAPTER_COUNT = 18;
const NETWORK_TIMEOUT_MS = 4500;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(PRECACHE);
        // Begin gathering the verses, but never let a slow API block install.
        gatherWisdom().catch(() => {});
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith('lg-') && !KEEP.has(name)).map((name) => caches.delete(name)));
        await self.clients.claim();
        gatherWisdom().catch(() => {});
    })());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'GATHER_WISDOM') event.waitUntil?.(gatherWisdom());
});

// ---------------------------------------------------------------------------
// Gathering the corpus
// ---------------------------------------------------------------------------

let gathering = null;

function gatherWisdom() {
    if (gathering) return gathering;
    gathering = (async () => {
        const cache = await caches.open(WISDOM_CACHE);
        const urls = ['/api/verses/chapters', ...Array.from({ length: CHAPTER_COUNT }, (_, i) => `/api/verses/chapters/${i + 1}`)];
        let verses = 0;
        for (const url of urls) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) continue;
                await cache.put(url, response.clone());
                if (url !== '/api/verses/chapters') {
                    const data = await response.json();
                    verses += Array.isArray(data.verses) ? data.verses.length : 0;
                }
            } catch {
                // offline or server down — try again on the next activation
            }
        }
        corpusMemo = null;
        const chapters = (await cache.keys()).filter((request) => /\/api\/verses\/chapters\/\d+$/.test(request.url)).length;
        if (chapters >= CHAPTER_COUNT && verses > 0) {
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            clients.forEach((client) => client.postMessage({ type: 'WISDOM_READY', verses }));
        }
    })().finally(() => {
        gathering = null;
    });
    return gathering;
}

let corpusMemo = null;

async function getCorpus() {
    if (corpusMemo) return corpusMemo;
    const cache = await caches.open(WISDOM_CACHE);
    const verses = [];
    const chapters = [];
    for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter++) {
        const response = await cache.match(`/api/verses/chapters/${chapter}`);
        if (!response) continue;
        const { verses: chapterVerses = [], ...meta } = await response.json();
        chapters.push(meta);
        verses.push(...chapterVerses);
    }
    corpusMemo = { verses, chapters };
    return corpusMemo;
}

// ---------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        if (url.pathname === '/api/chat' && request.method === 'POST') {
            event.respondWith(networkOr(request, () => offlineChat(request)));
            return;
        }
        if (request.method !== 'GET') return;

        if (request.mode === 'navigate') {
            event.respondWith(navigation(request));
        } else if (/^\/api\/voice\/[^/]+$/.test(url.pathname)) {
            event.respondWith(recitation(request));
        } else if (url.pathname.startsWith('/api/')) {
            event.respondWith(api(request, url));
        } else if (url.pathname.startsWith('/assets/')) {
            event.respondWith(cacheFirst(request, SHELL_CACHE));
        } else {
            event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
        }
        return;
    }

    if (request.method !== 'GET') return;
    if (url.hostname === 'fonts.googleapis.com') {
        event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    } else if (url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(request, FONT_CACHE));
    }
});

function withTimeout(promise, ms = NETWORK_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

async function networkOr(request, fallback) {
    try {
        const response = await withTimeout(fetch(request.clone()), 12000);
        if (response.ok || response.status < 500) return response;
        throw new Error(`HTTP ${response.status}`);
    } catch {
        return fallback();
    }
}

async function navigation(request) {
    try {
        const response = await withTimeout(fetch(request));
        if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/index.html', response.clone());
        }
        return response;
    } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
    }
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}

// A recitation never changes (its URL carries the revision): kept once, played from here after.
async function recitation(request) {
    const cache = await caches.open(VOICE_CACHE);
    const cached = await cache.match(request.url);
    if (cached) return cached;
    const response = await fetch(request.url, { credentials: 'same-origin' });
    if (response.status === 200 && (response.headers.get('content-type') || '').startsWith('audio/')) {
        cache.put(request.url, response.clone()).catch(() => {});
    }
    return response;
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    return cached || (await network) || Response.error();
}

// ---------------------------------------------------------------------------
// API: network first, then cache, then compute from the gathered corpus
// ---------------------------------------------------------------------------

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Sakha': 'offline' }
});

async function api(request, url) {
    const path = url.pathname;
    const isCorpus = /^\/api\/verses\/chapters(\/\d+)?$/.test(path);

    // Chapters never change: serve instantly from the wisdom cache, refresh quietly.
    if (isCorpus) {
        const cache = await caches.open(WISDOM_CACHE);
        const cached = await cache.match(path);
        const network = fetch(request)
            .then((response) => {
                if (response.ok) {
                    cache.put(path, response.clone());
                    corpusMemo = null;
                }
                return response;
            })
            .catch(() => null);
        return cached || (await network) || json({ msg: 'Offline and not yet saved on this device' }, 503);
    }

    try {
        const response = await withTimeout(fetch(request));
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        if (response.status < 500) return response;
        throw new Error(`HTTP ${response.status}`);
    } catch {
        const cached = await (await caches.open(RUNTIME_CACHE)).match(request);
        if (cached && !path.startsWith('/api/daily')) return cached;
        return offlineApi(path, url.searchParams, cached);
    }
}

// ---------------------------------------------------------------------------
// Offline answers — computed by the same Wisdom Engine the server runs
// (shared/wisdom-engine.js, inlined above as self.WisdomEngine).
// ---------------------------------------------------------------------------

const Engine = self.WisdomEngine;

function timeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
}

async function offlineApi(path, params, cachedDaily) {
    const { verses } = await getCorpus();
    if (!verses.length) {
        if (cachedDaily) return cachedDaily;
        return json({ msg: 'Offline — the verses have not been saved on this device yet.' }, 503);
    }

    if (path === '/api/verses/search') {
        const limit = parseInt(params.get('limit') || '20', 10);
        const { match, results } = Engine.searchVerses(verses, params.get('q') || '');
        return json({ count: results.length, match, results: results.slice(0, limit), offline: true });
    }

    if (path === '/api/daily') {
        const requested = params.get('date');
        const date = Engine.isValidDate(requested) ? requested : new Date().toISOString().split('T')[0];
        return json({ verse: Engine.dailyVerse(verses, date), date, offline: true });
    }

    if (path === '/api/verses/random') {
        return json(verses[Math.floor(Math.random() * verses.length)]);
    }

    const byId = path.match(/^\/api\/verses\/([^/]+)$/);
    if (byId) {
        const verse = verses.find((item) => item.id === decodeURIComponent(byId[1]));
        return verse ? json(verse) : json({ msg: 'Verse not found' }, 404);
    }

    return json({ msg: 'Unavailable offline' }, 503);
}

async function offlineChat(request) {
    let body = {};
    try {
        body = await request.json();
    } catch {
        // empty body
    }

    // Crisis support never depends on the corpus being saved.
    if (Engine.detectCrisis(body.text) || (!body.text && Engine.detectCrisis(body.mood))) {
        return json(Engine.respond(body, { verses: [], chapters: [], offline: true }));
    }

    const { verses, chapters } = await getCorpus();
    if (!verses.length) {
        const hindi = body.settings?.language === 'hi';
        return json({
            message: hindi
                ? 'आप ऑफ़लाइन हैं, और श्लोक अभी इस उपकरण पर सहेजे नहीं गए हैं। एक गहरी सांस लें — संपर्क लौटने पर अभयारण्य फिर मिलेगा।'
                : "You're offline, and the verses haven't been gathered onto this device yet. Take a breath — the sanctuary will return with the connection.",
            verse: null,
            context: { offline: true }
        });
    }

    return json(Engine.respond(body, { verses, chapters, timeOfDay: timeOfDay(), offline: true }));
}
