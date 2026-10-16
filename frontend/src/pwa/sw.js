/* eslint-disable no-restricted-globals */
// Living Gita service worker — the offline engine.
//
// Built by the `living-gita-sw` Vite plugin, which replaces the two
// placeholders below with the hashed build manifest and a content version.
//
//  · App shell:   precached on install, served cache-first.
//  · Wisdom data: all 18 chapters (701 verses) gathered into a durable cache.
//  · Offline API: when the network is unreachable, /api/* is answered here —
//                 search, verse lookup, daily verse and even /api/chat, using
//                 the same scoring as Backend/src/services/aiService.js.
//                 Crisis detection is mirrored exactly so safety never degrades.

const VERSION = '__BUILD_VERSION__';
const PRECACHE = __PRECACHE_MANIFEST__;

const SHELL_CACHE = `lg-shell-${VERSION}`;
const WISDOM_CACHE = 'lg-wisdom-v1';
const FONT_CACHE = 'lg-fonts-v1';
const RUNTIME_CACHE = 'lg-runtime-v1';
const KEEP = new Set([SHELL_CACHE, WISDOM_CACHE, FONT_CACHE, RUNTIME_CACHE]);

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
    headers: { 'Content-Type': 'application/json', 'X-Living-Gita': 'offline' }
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

async function offlineApi(path, params, cachedDaily) {
    const { verses } = await getCorpus();
    if (!verses.length) {
        if (cachedDaily) return cachedDaily;
        return json({ msg: 'Offline — the verses have not been saved on this device yet.' }, 503);
    }

    if (path === '/api/verses/search') {
        const query = (params.get('q') || '').toLowerCase().trim();
        const limit = parseInt(params.get('limit') || '20', 10);
        const results = searchCorpus(verses, query);
        return json({ count: results.length, results: results.slice(0, limit), offline: true });
    }

    if (path === '/api/daily') {
        const today = new Date().toISOString().split('T')[0];
        const seed = today.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return json({ verse: verses[seed % verses.length], date: today, offline: true });
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

// Mirrors Backend/src/services/searchService.js parseVerseRef.
function parseRef(query) {
    const cleaned = query.trim().toLowerCase().replace(/^(bg|gita|bhagavad\s*gita|ch(apter)?\.?)\s*/, '');
    const match = cleaned.match(/^(\d{1,2})\s*(?:[.:_,\-/]|\s)\s*(?:v(?:erse)?\.?\s*)?(\d{1,3})$/);
    if (!match) return null;
    const chapter = Number(match[1]);
    const verse = Number(match[2]);
    return chapter >= 1 && chapter <= 18 && verse >= 1 ? `${chapter}_${verse}` : null;
}

// Mirrors Backend/src/services/searchService.js searchVerses (same weights, same tie-break).
function searchCorpus(verses, query) {
    if (!query) return [];
    const ref = parseRef(query);
    if (ref) return verses.filter((verse) => verse.id === ref);
    const has = (value) => typeof value === 'string' && value.toLowerCase().includes(query);
    const scored = [];
    verses.forEach((verse, index) => {
        let score = 0;
        if (verse.core_theme?.some(has)) score += 6;
        if (verse.emotional_tone?.some(has)) score += 5;
        if (verse.life_situations?.some(has)) score += 4;
        if (has(verse.meaning_en)) score += 3;
        if (has(verse.meaning_hi) || has(verse.simple) || has(verse.iast) || (verse.sanskrit || '').includes(query)) score += 1;
        if (score) scored.push({ verse, score, index });
    });
    return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((item) => item.verse);
}

// ---------------------------------------------------------------------------
// Offline sanctuary — mirrors Backend/src/services/aiService.js
// ---------------------------------------------------------------------------

const CRISIS_KEYWORDS = [
    'suicid', 'kill myself', 'end my life', 'end it all', 'no point living', 'cannot go on living',
    'cant go on living', 'hurt myself', 'self harm', 'self-harm', 'want to die', 'better off dead',
    "don't want to live", 'dont want to live', 'take my life', 'end everything',
    'आत्महत्या', 'मरना चाहता', 'जीवन समाप्त'
];

const CRISIS_RESPONSE = {
    hi: 'मुझे लगता है कि आप बहुत गहरे दर्द से गुजर रहे हैं। यह एक ऐसा पल है जहाँ किसी इंसान की मदद जरूरी है। कृपया किसी भरोसेमंद व्यक्ति, काउंसलर या सहायता हेल्पलाइन से तुरंत संपर्क करें। आप अकेले नहीं हैं।\n\nमुफ्त एवं गोपनीय सहायता:\n• Tele-MANAS (भारत): 14416 या 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• अंतर्राष्ट्रीय हेल्पलाइन: https://findahelpline.com',
    en: "I sense you're going through deep pain. This is a moment where human support is essential. Please reach out to someone you trust, a counselor, or a crisis helpline right now. You do not have to carry this alone.\n\nFree & Confidential Support:\n• Tele-MANAS (India): 14416 or 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• 988 Suicide & Crisis Lifeline (US/Canada): Call or Text 988\n• Worldwide Helplines: https://findahelpline.com"
};

const ACKNOWLEDGEMENTS = {
    en: ["I hear that you're feeling {emotion}.", 'It is completely natural to feel {emotion}.', "It's okay to be with your {emotion} right now."],
    hi: ['मैं समझ सकता हूँ कि आप {emotion} महसूस कर रहे हैं।', '{emotion} महसूस करना पूरी तरह से स्वाभाविक है।', 'अभी अपने {emotion} के साथ रहना ठीक है।']
};
const REFLECTIONS = {
    en: ['The Gita offers a gentle perspective on this.', 'This ancient wisdom speaks softly to this moment.', 'Let this verse wash over you, without pressure.'],
    hi: ['गीता इस पर एक सौम्य दृष्टिकोण प्रदान करती है।', 'यह प्राचीन ज्ञान इस पल के लिए है।', 'बिना किसी दबाव के इस श्लोक को आत्मसात करें।']
};
const GROUNDING = {
    en: ['Take a breath. You are safe.', 'There is nothing you need to fix right now.', 'This feeling will pass, like a cloud.', 'You are enough, just as you are.'],
    hi: ['एक गहरी सांस लें। आप सुरक्षित हैं।', 'अभी आपको कुछ भी ठीक करने की आवश्यकता नहीं है।', 'यह भावना एक बादल की तरह गुजर जाएगी।', 'आप जैसे हैं, पर्याप्त हैं।']
};
const MIRROR = {
    en: ["It sounds like there's a lot happening right now.", 'That can feel very heavy.', 'I hear the weight in your words.'],
    hi: ['ऐसा लगता है कि इस समय बहुत कुछ हो रहा है।', 'यह बहुत भारी महसूस हो सकता है।', 'मैं आपके शब्दों में वजन सुन सकता हूँ।']
};
const TAG_MAP = {
    anxious: ['fear', 'uncertainty', 'peace', 'anxiety', 'calm', 'doubt'],
    anxiety: ['fear', 'uncertainty', 'peace', 'anxiety', 'calm', 'doubt'],
    worried: ['fear', 'uncertainty', 'results', 'anticipation'],
    stress: ['stress', 'action', 'peace', 'pressure', 'duty'],
    stressed: ['stress', 'action', 'peace', 'pressure', 'duty'],
    sad: ['grief', 'compassion', 'soul', 'sadness', 'depression'],
    angry: ['anger', 'self-control', 'peace', 'reaction', 'calm'],
    anger: ['anger', 'self-control', 'peace', 'reaction', 'calm'],
    lost: ['confusion', 'guidance', 'faith', 'direction', 'purpose'],
    confused: ['confusion', 'knowledge', 'guidance', 'clarity', 'duty'],
    peace: ['peace', 'meditation', 'devotion', 'calm', 'stillness'],
    happy: ['joy', 'bhakti', 'gratitude', 'contentment'],
    grateful: ['gratitude', 'joy', 'bhakti', 'devotion', 'contentment'],
    overwhelmed: ['stress', 'peace', 'surrender', 'emotional overwhelm', 'balance'],
    hopeless: ['faith', 'compassion', 'hope', 'inner strength']
};
const STOP_WORDS = new Set('a about above after again all am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my myself no nor not now of off on once only or other our out over own same so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why with would you your'.split(' '));

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function detectCrisis(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function shouldMirror(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return ['overwhelmed', 'drowning', "can't take", 'too much', 'breaking', 'collapsing'].some((word) => lower.includes(word));
}

function analyse(text, mood) {
    let tags = [];
    if (mood) {
        const m = mood.toLowerCase();
        tags.push(m, ...(TAG_MAP[m] || []));
    }
    if (text) {
        text.toLowerCase().split(/[^a-zA-Z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)).forEach((word) => {
            tags.push(word, ...(TAG_MAP[word] || []));
        });
    }
    return [...new Set(tags)];
}

function bestVerse(verses, chapters, tags) {
    const lowerTags = tags.map((tag) => tag.toLowerCase());
    const helps = new Map(chapters.map((chapter) => [chapter.chapter, (chapter.helps_with || []).map((h) => h.toLowerCase())]));
    let best = null;
    let bestScore = -1;
    verses.forEach((verse) => {
        let score = verse.meaning_en ? 10 : 0;
        (verse.emotional_tone || []).forEach((tone) => {
            const t = tone.toLowerCase();
            lowerTags.forEach((tag) => { if (t === tag || t.includes(tag) || tag.includes(t)) score += 12; });
        });
        (verse.life_situations || []).forEach((situation) => {
            const s = situation.toLowerCase();
            lowerTags.forEach((tag) => { if (s.includes(tag)) score += 10; });
        });
        (verse.core_theme || []).forEach((theme) => {
            const t = theme.toLowerCase();
            lowerTags.forEach((tag) => { if (t === tag || t.includes(tag) || tag.includes(t)) score += 8; });
        });
        const chapterHelps = helps.get(verse.chapter) || [];
        lowerTags.forEach((tag) => { if (chapterHelps.some((h) => h.includes(tag) || tag.includes(h))) score += 7; });
        const meaning = (verse.meaning_en || '').toLowerCase();
        lowerTags.forEach((tag) => { if (tag.length > 3 && meaning.includes(tag)) score += 3; });
        score += Math.random() * 3;
        if (score > bestScore) {
            bestScore = score;
            best = verse;
        }
    });
    return best;
}

async function offlineChat(request) {
    let body = {};
    try {
        body = await request.json();
    } catch {
        // empty body
    }
    const { text, mood, settings = {} } = body;
    const lang = settings.language === 'hi' ? 'hi' : 'en';

    if (detectCrisis(text)) {
        return json({ message: CRISIS_RESPONSE[lang], verse: null, context: { crisis_detected: true, offline: true } });
    }

    const { verses, chapters } = await getCorpus();
    if (!verses.length) {
        return json({
            message: lang === 'hi'
                ? 'आप ऑफ़लाइन हैं, और श्लोक अभी इस उपकरण पर सहेजे नहीं गए हैं। एक गहरी सांस लें — संपर्क लौटने पर अभयारण्य फिर मिलेगा।'
                : "You're offline, and the verses haven't been gathered onto this device yet. Take a breath — the sanctuary will return with the connection.",
            verse: null,
            context: { offline: true }
        });
    }

    if (shouldMirror(text)) {
        return json({ message: `${pick(MIRROR[lang])}\n\n${pick(GROUNDING[lang])}`, verse: null, context: { mirrored: true, offline: true } });
    }

    const tags = analyse(text, mood);
    const verse = bestVerse(verses, chapters, tags);
    const verseText = lang === 'hi' ? verse.meaning_hi : verse.meaning_en;

    if (settings.silentMode) {
        return json({ message: `"${verseText}"`, verse, context: { silent_mode: true, offline: true } });
    }

    const emotion = (mood || tags[0] || 'uncertainty').toLowerCase();
    const ack = pick(ACKNOWLEDGEMENTS[lang]).replace('{emotion}', emotion);
    const depth = settings.depth || 'standard';
    const message = depth === 'brief'
        ? `${ack}\n\n"${verseText}"`
        : `${ack} ${pick(REFLECTIONS[lang])}\n\n"${verseText}"\n\n${pick(GROUNDING[lang])}`;

    return json({ message, verse, context: { offline: true, detected_tags: tags } });
}
