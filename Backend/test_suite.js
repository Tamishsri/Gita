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
    console.log('[1/7] Testing Data Loader & All 18 Chapters...');
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
    console.log('\n[2/7] Testing Multi-Dimensional Search...');
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
    console.log('\n[3/7] Testing AI Service Mood Matching...');
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
    console.log('\n[4/7] Testing Crisis Safety Protocols & Helplines...');
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
    console.log('\n[5/7] Testing Hindi Response & Translations...');
    const hindiResult = await aiService.generateResponse({
        text: 'मुझे बहुत चिंता हो रही है',
        mood: 'anxious',
        settings: { language: 'hi', depth: 'deep' }
    });
    assert(hindiResult && hindiResult.verse, `Hindi input returned appropriate verse BG ${hindiResult.verse?.chapter}.${hindiResult.verse?.verse || hindiResult.verse?.verse_number}`);
    assert(hindiResult.message.length > 20, `Generated contemplative response in Hindi`);

    // 6. HTTP API — the real Express app on an ephemeral port
    console.log('\n[6/7] Testing HTTP Endpoints...');
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

    // 7. Offline engine parity — the service worker must keep the same safety net
    console.log('\n[7/7] Testing Offline Engine Parity...');
    const fs = require('fs');
    const path = require('path');
    const swSource = fs.readFileSync(path.join(__dirname, '../frontend/src/pwa/sw.js'), 'utf8');
    const serviceSource = fs.readFileSync(path.join(__dirname, 'src/services/aiService.js'), 'utf8');
    const keywordList = (source) => {
        const block = source.match(/CRISIS_KEYWORDS\s*=\s*\[([\s\S]*?)\];/);
        if (!block) return [];
        // eslint-disable-next-line no-new-func
        return Function(`return [${block[1]}];`)();
    };
    const backendKeywords = keywordList(serviceSource);
    const offlineKeywords = keywordList(swSource);
    const missing = backendKeywords.filter((keyword) => !offlineKeywords.includes(keyword));
    assert(backendKeywords.length > 10 && missing.length === 0, `Offline crisis detection covers all ${backendKeywords.length} backend keywords${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
    assert(['14416', '1800-891-4416', '+91 9999 666 555', '988'].every((line) => swSource.includes(line)), 'Offline crisis response carries every helpline number');

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
