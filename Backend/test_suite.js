const { loadData, getVerses, getChaptersMeta, getChapterMeta } = require('./src/data/loader');
const aiService = require('./src/services/aiService');
const searchService = require('./src/services/searchService');

async function runTests() {
    console.log('====================================================');
    console.log('🕉️  LIVING GITA FULL BACKEND VERIFICATION SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // 1. Data Loader Test
    console.log('[1/8] Testing Data Loader & All 18 Chapters...');
    loadData();
    const allVerses = getVerses();
    assert(allVerses.length >= 700, `Loaded ${allVerses.length} total verses across all chapters`);

    const chaptersMeta = getChaptersMeta();
    assert(chaptersMeta.length === 18, `Loaded metadata for all ${chaptersMeta.length} chapters`);

    // Verify each chapter 1-18 has verses
    let allChaptersHaveVerses = true;
    for (let c = 1; c <= 18; c++) {
        const chVerses = allVerses.filter(v => v.chapter === c);
        const meta = getChapterMeta(c);
        if (chVerses.length === 0 || !meta) {
            allChaptersHaveVerses = false;
            console.error(`Missing data for Chapter ${c}`);
        }
    }
    assert(allChaptersHaveVerses, 'Every chapter from 1 to 18 has valid verses and metadata');

    // 2. Search Functionality
    console.log('\n[2/8] Testing Multi-Dimensional Search...');
    const searchTerms = ['peace', 'karma', 'fear', 'duty', '2_47', 'death', 'meditation'];
    for (const term of searchTerms) {
        const { results } = searchService.searchVerses(allVerses, term);
        assert(results.length > 0, `Search query "${term}" returned ${results.length} results`);
    }

    // Verse references resolve straight to the verse, in every common notation.
    const refForms = ['2.47', '2:47', '2_47', 'BG 2.47', 'chapter 2 verse 47', 'Gita 2 47'];
    const refsResolve = refForms.every((form) => {
        const { match, results } = searchService.searchVerses(allVerses, form);
        return match === 'reference' && results.length === 1 && results[0].id === '2_47';
    });
    assert(refsResolve, `Verse references ${refForms.map((f) => `"${f}"`).join(', ')} all resolve to BG 2.47`);
    assert(searchService.searchVerses(allVerses, '18.66').results[0]?.id === '18_66', 'Reference "18.66" resolves to the final teaching, BG 18.66');
    assert(searchService.searchVerses(allVerses, '19.1').match !== 'reference', 'Out-of-range chapter "19.1" is not treated as a reference');

    // Ranking: a verse whose core theme matches outranks one that only mentions the word.
    const peace = searchService.searchVerses(allVerses, 'peace').results;
    const topScore = searchService.scoreVerse(peace[0], 'peace');
    const lastScore = searchService.scoreVerse(peace[peace.length - 1], 'peace');
    assert(topScore >= lastScore && topScore > 3, `Results are ranked by relevance (top score ${topScore} >= last ${lastScore})`);
    assert(searchService.searchVerses(allVerses, '   ').results.length === 0, 'Blank queries return no results');
    assert(searchService.searchVerses(allVerses, 'शांति').results.length > 0, 'Hindi query "शांति" finds verses through the Hindi translations');

    // 3. AI Service - Sacred Verse Selection by Mood
    console.log('\n[3/8] Testing AI Service Mood Matching...');
    const testMoods = ['peace', 'anxious', 'sad', 'angry', 'confused', 'happy', 'grateful'];
    for (const mood of testMoods) {
        const result = await aiService.generateResponse({
            text: null,
            mood: mood,
            settings: { language: 'en', depth: 'standard' }
        });
        assert(result && result.verse && result.message, `Mood "${mood}" returned verse BG ${result.verse?.chapter}.${result.verse?.verse || result.verse?.verse_number} with contemplative message`);
    }

    // 4. Crisis Safety Protocols
    console.log('\n[4/8] Testing Crisis Safety Protocols & Helplines...');
    const crisisPrompts = [
        'I want to end my life',
        'Feeling suicidal and hopeless',
        'I cannot go on living anymore'
    ];

    for (const prompt of crisisPrompts) {
        const crisisResult = await aiService.generateResponse({
            text: prompt,
            mood: 'sad',
            settings: { language: 'en' }
        });

        const hasHelpline = crisisResult.message.includes('14416') ||
            crisisResult.message.includes('1800-891-4416') ||
            crisisResult.message.includes('988') ||
            crisisResult.message.includes('Tele-MANAS');

        assert(hasHelpline, `Crisis phrase "${prompt}" triggered immediate 24/7 helpline`);
    }

    // 5. Hindi Language Support
    console.log('\n[5/8] Testing Hindi Response & Translations...');
    const hindiResult = await aiService.generateResponse({
        text: 'मुझे बहुत चिंता हो रही है',
        mood: 'anxious',
        settings: { language: 'hi', depth: 'deep' }
    });
    assert(hindiResult && hindiResult.verse, `Hindi input returned appropriate verse BG ${hindiResult.verse?.chapter}.${hindiResult.verse?.verse || hindiResult.verse?.verse_number}`);
    assert(hindiResult.message.length > 20, `Generated contemplative response in Hindi`);

    // 6. HTTP API — the real Express app on an ephemeral port
    console.log('\n[6/8] Testing HTTP Endpoints...');
    process.env.NODE_ENV = 'test';
    const app = require('./src/app');
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async (path) => {
        const response = await fetch(base + path);
        return { status: response.status, body: await response.json() };
    };
    const post = async (path, payload, raw) => {
        const response = await fetch(base + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: raw ?? JSON.stringify(payload)
        });
        return { status: response.status, body: await response.json() };
    };

    try {
        const chapters = await get('/api/verses/chapters');
        assert(chapters.status === 200 && chapters.body.length === 18, 'GET /api/verses/chapters returns all 18 chapters');
        const counted = chapters.body.reduce((sum, chapter) => sum + (chapter.verses_count || 0), 0);
        assert(counted === allVerses.length, `Chapter verse counts add up to the full corpus (${counted})`);

        const chapterTwo = await get('/api/verses/chapters/2');
        assert(chapterTwo.status === 200 && chapterTwo.body.verses.length === chapters.body[1].verses_count, `GET /api/verses/chapters/2 returns its ${chapterTwo.body.verses?.length} verses`);
        assert((await get('/api/verses/chapters/19')).status === 404, 'GET /api/verses/chapters/19 is a 404');

        const verse = await get('/api/verses/2_47');
        assert(verse.status === 200 && verse.body.id === '2_47' && verse.body.chapter === 2, 'GET /api/verses/2_47 returns the verse');
        assert((await get('/api/verses/99_99')).status === 404, 'Unknown verse id is a 404');

        const refSearch = await get('/api/verses/search?q=2.47');
        assert(refSearch.body.match === 'reference' && refSearch.body.results[0]?.id === '2_47', 'GET /api/verses/search?q=2.47 jumps to the verse');
        const limited = await get('/api/verses/search?q=peace&limit=5');
        assert(limited.body.results.length === 5 && limited.body.count >= 5, `Search respects limit (5 of ${limited.body.count})`);
        assert((await get('/api/verses/search?q=')).status === 400, 'Empty search query is a 400');

        const daily = await get('/api/daily');
        assert(daily.status === 200 && daily.body.verse && /^\d{4}-\d{2}-\d{2}$/.test(daily.body.date), "GET /api/daily returns today's verse");

        const chat = await post('/api/chat', { mood: 'anxious', settings: { language: 'en' } });
        assert(chat.status === 200 && typeof chat.body.message === 'string' && chat.body.verse, 'POST /api/chat answers a mood with a message and verse');
        const crisis = await post('/api/chat', { text: 'I want to end my life', settings: { language: 'en' } });
        assert(crisis.body.context?.crisis_detected && crisis.body.message.includes('14416') && !crisis.body.verse, 'POST /api/chat crisis text returns helplines and no verse');
        assert((await post('/api/chat', {})).status === 400, 'POST /api/chat without text or mood is a 400');
        assert((await post('/api/chat', { text: 'x'.repeat(2001) })).status === 400, 'POST /api/chat rejects messages over 2000 characters');
        assert((await post('/api/chat', null, '{"text": ')).status === 400, 'Malformed JSON is a clean 400, not a crash');
        assert((await get('/api/nothing-here')).status === 404, 'Unknown API routes are a JSON 404');
    } finally {
        server.close();
    }

    // 7. One engine everywhere — the offline worker runs the shared Wisdom Engine
    console.log('\n[7/8] Testing Offline Engine Is The Shared Engine...');
    const fs = require('fs');
    const path = require('path');
    const engine = require('../shared/wisdom-engine');
    const swSource = fs.readFileSync(path.join(__dirname, '../frontend/src/pwa/sw.js'), 'utf8');
    assert(swSource.includes('/*__WISDOM_ENGINE__*/') && swSource.includes('self.WisdomEngine'), 'Service worker template inlines the shared Wisdom Engine');
    assert(!/CRISIS_(KEYWORDS|TERMS)\s*=/.test(swSource), 'Service worker keeps no private copy of the crisis list');
    const crisisEn = engine.respond({ text: 'I want to end my life' }, { verses: [], chapters: [] });
    const crisisHi = engine.respond({ text: 'मैं मरना चाहती हूँ', settings: { language: 'hi' } }, { verses: [], chapters: [] });
    assert(['14416', '1800-891-4416', '+91 9999 666 555', '988'].every((line) => crisisEn.message.includes(line)), 'Crisis reply carries every helpline even with no verses loaded (offline-safe)');
    assert(crisisHi.message.includes('14416') && /[ऀ-ॿ]/.test(crisisHi.message), 'Hindi crisis reply is in Hindi and carries Tele-MANAS');

    // 8. The sanctuary's listening — safety, understanding, variety
    console.log('\n[8/8] Testing AI Safety, Understanding & Variety...');
    const corpus = { verses: allVerses, chapters: chaptersMeta };
    // mulberry32: a small, well-distributed seeded generator for repeatable tests.
    const seeded = (seed) => () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const mustCatch = [
        'I want to kill myself', 'thinking about kms tonight', 'there is no reason to live anymore',
        'I just want to disappear forever', 'thinking of taking all my pills', "I don't want to be alive",
        'मैं मरना चाहती हूँ', 'अब जीना नहीं चाहता', 'मुझे आत्महत्या के विचार आते हैं', 'mujhe marna hai yaar',
        'jeene ka mann nahi karta', 'I keep wanting to hurt myself'
    ];
    const missed = mustCatch.filter((text) => !engine.detectCrisis(text));
    assert(missed.length === 0, `All ${mustCatch.length} crisis phrasings (English, Hindi, Hinglish, slang) route to human help${missed.length ? ` — missed: ${missed.join(' | ')}` : ''}`);

    const mustNotCatch = ['this movie was so funny I could die laughing', 'I am dying to see my family', 'that workout killed me', 'deadline is killing my schedule'];
    const falseAlarms = mustNotCatch.filter((text) => engine.detectCrisis(text));
    assert(falseAlarms.length === 0, `Everyday figures of speech are not mistaken for crisis${falseAlarms.length ? ` — flagged: ${falseAlarms.join(' | ')}` : ''}`);

    const understood = [
        ['My mother passed away last month', 'grief'],
        ['I failed my exam again', 'failure'],
        ['I feel so lonely, nobody understands me', 'loneliness'],
        ['my boss humiliated me and I am furious', 'anger'],
        ['I am not angry, just tired of everything', 'stress'],
        ['मुझे बहुत अकेलापन महसूस हो रहा है', 'loneliness'],
        ['मुझे अपने भाई पर बहुत गुस्सा आता है', 'anger'],
        ['mujhe bahut tension ho rahi hai exam ki', 'anxiety'],
        ['I feel worthless', 'unworthiness'],
        ['my relationship ended and I feel lost', 'heartbreak']
    ];
    const misread = understood.filter(([text, expected]) => engine.detectEmotions(text)[0] !== expected);
    assert(misread.length === 0, `Primary feeling read correctly in ${understood.length} English/Hindi/Hinglish messages${misread.length ? ` — misread: ${misread.map(([t, e]) => `"${t}"→${engine.detectEmotions(t)[0]} (want ${e})`).join(' | ')}` : ''}`);

    // The acknowledgement must never echo a random word back as a "feeling".
    const ackLabels = Object.values(engine.EMOTIONS).flatMap((emotion) => [emotion.en.adj, emotion.en.noun]);
    const awkward = ['my boss', 'how do I apply this to my life?', 'the movie last night', 'mujhe kuch samajh nahi aa raha', 'karma']
        .map((text) => engine.respond({ text, mood: null }, { ...corpus, random: seeded(7) }).message.split('\n')[0])
        .filter((line) => /feeling (feel|boss|movie|mujhe|life|karma)\b|your (boss|movie|mujhe)\b/i.test(line));
    assert(awkward.length === 0, `Acknowledgements stay grammatical — no "feeling boss"-style echoes${awkward.length ? `: ${awkward.join(' | ')}` : ''}`);
    assert(ackLabels.length > 20, 'Every emotion has an English adjective and noun to speak with');

    const narrativeOffered = ['anxious', 'sad', 'angry', 'confused', 'peace', 'happy']
        .flatMap((mood) => Array.from({ length: 8 }, (_, i) => engine.respond({ mood }, { ...corpus, random: seeded(i + 1) }).verse))
        .filter((verse) => verse && engine.isNarrative(verse));
    assert(narrativeOffered.length === 0, 'Comfort is never a narration verse ("Sanjaya said…", army roll-calls)');

    const anxiousPicks = new Set(Array.from({ length: 16 }, (_, i) => engine.respond({ mood: 'anxious' }, { ...corpus, random: seeded(i + 11) }).verse.id));
    assert(anxiousPicks.size >= 3, `The same mood offers fresh verses (${anxiousPicks.size} distinct in 16 visits)`);

    const first = engine.respond({ mood: 'sad' }, { ...corpus, random: seeded(3) }).verse.id;
    const next = engine.respond({ mood: 'sad', exclude: [first] }, { ...corpus, random: seeded(3) }).verse.id;
    assert(first !== next, 'Recently shown verses are not repeated (exclude list honoured)');

    const followUp = engine.respond({ text: 'how do I live this?', history: ['I feel so lonely lately'] }, { ...corpus, random: seeded(5) });
    assert(followUp.context.emotion === 'loneliness', 'A follow-up keeps the feeling from earlier in the conversation');

    const days = Array.from({ length: 90 }, (_, d) => new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10));
    const dailyIds = days.map((date) => engine.dailyVerse(allVerses, date).id);
    assert(new Set(dailyIds).size === 90, `Daily verse never repeats across 90 days (${new Set(dailyIds).size} distinct)`);
    const dailyChapters = new Set(dailyIds.map((id) => id.split('_')[0]));
    assert(dailyChapters.size >= 15 && dailyIds.every((id) => !engine.isNarrative(allVerses.find((v) => v.id === id))), `Daily verses span ${dailyChapters.size} chapters and are never narration`);
    assert(engine.dailyVerse(allVerses, '2026-10-16').id === engine.dailyVerse(allVerses, '2026-10-16').id, 'Daily verse is stable for a given date');

    const hindiReply = engine.respond({ text: 'मुझे बहुत अकेलापन महसूस हो रहा है', settings: { language: 'hi' } }, { ...corpus, random: seeded(9) });
    assert(/[ऀ-ॿ]/.test(hindiReply.message.split('\n')[0]) && !hindiReply.message.includes('अपने अकेलापन'), 'Hindi replies are in Hindi with correct grammar (अकेलेपन, not अकेलापन, before के)');

    // Every answer closes with a blessing, in the reader's language.
    const unblessed = Object.keys(engine.EMOTIONS).filter((id) => !engine.BLESSINGS[id]?.en || !/[ऀ-ॿ]/.test(engine.BLESSINGS[id]?.hi || ''));
    assert(unblessed.length === 0, `Every feeling has a blessing in English and Hindi${unblessed.length ? ` — missing: ${unblessed.join(', ')}` : ''}`);
    const blessedEn = engine.respond({ text: 'I failed my exam and feel like a failure' }, { ...corpus, random: seeded(3) });
    const blessedHi = engine.respond({ text: 'mujhe bahut gussa aa raha hai', settings: { language: 'hi' } }, { ...corpus, random: seeded(4) });
    const blessedNeutral = engine.respond({ text: 'tell me something' }, { ...corpus, random: seeded(5) });
    assert(/^May /.test(blessedEn.guidance?.blessing || '') && /[ऀ-ॿ]/.test(blessedHi.guidance?.blessing || '') && Boolean(blessedNeutral.guidance?.blessing), 'Answers carry a blessing — English, Hindi, and when no feeling is named');

    console.log('\n====================================================');
    console.log(`TOTAL: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
