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
    console.log('[1/9] Testing Data Loader & All 18 Chapters...');
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
    console.log('\n[2/9] Testing Multi-Dimensional Search...');
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
    console.log('\n[3/9] Testing AI Service Mood Matching...');
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
    console.log('\n[4/9] Testing Crisis Safety Protocols & Helplines...');
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
    console.log('\n[5/9] Testing Hindi Response & Translations...');
    const hindiResult = await aiService.generateResponse({
        text: 'मुझे बहुत चिंता हो रही है',
        mood: 'anxious',
        settings: { language: 'hi', depth: 'deep' }
    });
    assert(hindiResult && hindiResult.verse, `Hindi input returned appropriate verse BG ${hindiResult.verse?.chapter}.${hindiResult.verse?.verse || hindiResult.verse?.verse_number}`);
    assert(hindiResult.message.length > 20, `Generated contemplative response in Hindi`);

    // 6. HTTP API — the real Express app on an ephemeral port
    console.log('\n[6/9] Testing HTTP Endpoints...');
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
    console.log('\n[7/9] Testing Offline Engine Is The Shared Engine...');
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
    console.log('\n[8/9] Testing AI Safety, Understanding & Variety...');
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
    const blessedNeutral = engine.respond({ text: 'I was walking home tonight and kept thinking about the conversation we had at dinner' }, { ...corpus, random: seeded(5) });
    assert(/^May /.test(blessedEn.guidance?.blessing || '') && /[ऀ-ॿ]/.test(blessedHi.guidance?.blessing || '') && Boolean(blessedNeutral.guidance?.blessing), 'Answers carry a blessing — English, Hindi, and when no feeling is named');

    // ------------------------------------------------------------------
    console.log('\n[9/9] Testing Understanding Anyone, In Their Own Words...');
    const say = (text, extra = {}, seed = 3) => engine.respond({ text, history: [], ...extra }, { ...corpus, random: seeded(seed), timeOfDay: 'afternoon' });
    const verseExists = (ref) => allVerses.some((v) => v.id === ref.replace('.', '_'));

    // The person's name opens the reply, and the counsel fits their situation.
    const tamish = say('I am feeling scared about my career', { person: { name: 'Tamish' } });
    assert(/^Tamish, /.test(tamish.message) && /2\.47/.test(tamish.guidance.bridge) && /^Tamish — may/.test(tamish.guidance.blessing),
        `A named person is answered by name, with counsel for their situation ("${tamish.message.split('\n')[0]}")`);

    // The whole spectrum: every feeling the lexicon knows is reachable in plain words.
    const spectrum = {
        lust: 'I keep having lustful thoughts', emptiness: 'I just feel numb and empty', pride: 'my ego is getting out of control',
        love: 'I think I am falling for her', devotion: 'I want to feel closer to Krishna', inertia: 'I have no motivation to do anything',
        envy: 'I am jealous of my cousin', craving: 'I cannot stop smoking', purpose: 'what am i doing with my life',
        guilt: 'I lied to my best friend', heartbreak: 'she cheated on me', grief: 'my grandfather passed away',
        loneliness: 'I feel so alone', unworthiness: 'I feel like a burden to everyone', failure: 'I failed my exam',
        confusion: 'I dont know what to do', stress: 'I am so overwhelmed', anger: 'I am furious at my brother',
        sadness: 'I feel so sad today', fear: 'I am terrified of tomorrow', anxiety: 'I am so anxious', peace: 'I feel peaceful today',
        gratitude: 'I got into IIT'
    };
    const unreached = Object.entries(spectrum).filter(([feeling, text]) => engine.detectEmotions(text)[0] !== feeling);
    assert(unreached.length === 0 && Object.keys(spectrum).length === Object.keys(engine.EMOTIONS).length,
        `All ${Object.keys(engine.EMOTIONS).length} feelings are understood${unreached.length ? ` — missed: ${unreached.map(([f, t]) => `"${t}"→${engine.detectEmotions(t)[0]} (want ${f})`).join(' | ')}` : ''}`);

    // Desire is met without shame, as the Gita meets it.
    const lust = say('I keep having lustful thoughts and I feel ashamed');
    const lustVerses = Array.from({ length: 12 }, (_, i) => say('I keep having lustful thoughts and I feel ashamed', {}, i + 1).verse);
    assert(/7\.11/.test(lust.guidance.bridge) && !/sinner|sinful|dirty|disgusting/i.test(`${lust.message} ${lust.guidance.bridge}`)
        && lustVerses.every((v) => !/sinners?\b/i.test(v.meaning_en) && !/\bsin|sinner|evil/i.test(v.notification_short?.en || '')),
        'Lust is answered with the Gita’s own balance (7.11), never with shame');

    // Not every message is a feeling.
    const hello = say('namaste');
    const thanks = say('thank you, that really helped');
    const karma = say('what is karma?');
    const karmaHi = say('कर्म क्या है?');
    const who = say('who are you?');
    assert(hello.verse === null && /Namaste/.test(hello.message) && thanks.context.intent === 'thanks' && karma.verse?.id === '2_47'
        && karmaHi.context.language === 'hi' && /[ऀ-ॿ]/.test(karmaHi.message) && who.context.intent === 'self' && /on this device/.test(who.message),
        'Greetings, thanks, "what is karma?" (English and Hindi) and "who are you?" are each answered as what they are');

    const explain = say('I dont understand', { lastVerseId: '2_47' });
    assert(explain.context.intent === 'explain' && explain.message.includes('Focus on the work, not the reward'),
        '"I don\'t understand" re-explains the last verse in plain words');

    const why = say('why do bad things happen to good people');
    const gibberish = say('asdfgh');
    assert(why.context.intent === 'concept' && why.verse && gibberish.verse === null && gibberish.context.intent === 'smalltalk',
        'A real question gets a real answer; small talk and gibberish get a gentle question back, not a random verse');

    // Safety: hurt by someone else → help first. Figures of speech are not alarms.
    const unsafe = say('my husband hits me when he drinks');
    const figure = say('it hit me hard that I am getting older');
    assert(unsafe.context.safety && unsafe.message.includes('112') && unsafe.verse === null && !figure.context.safety,
        'Someone being hurt at home is given emergency lines first; "it hit me hard" is not mistaken for violence');

    // Unseen words still find their situation and its counsel.
    const founder = say('my investors pulled out of the startup and I have to tell my team tomorrow');
    assert(founder.guidance.counselled && founder.context.topics[0] === 'work' && !engine.isNarrative(founder.verse),
        'A message with no feeling words still finds its situation and fitting counsel');

    // Mixed messages: heavy feelings lead; others' good news is not the person's joy.
    const autopilot = say('Lately I feel like I am living on autopilot. My friends are getting married and moving forward and I feel stuck and empty.');
    assert(autopilot.context.emotion !== 'gratitude' && !/wonderful/i.test(autopilot.message),
        'Someone else\'s good news inside a heavy message is not mistaken for joy');

    const iCheated = engine.detectEmotions('I cheated on my partner')[0];
    const cheatedOn = engine.detectEmotions('my partner cheated on me')[0];
    const forgive = engine.detectEmotions('main apne aap ko kabhi maaf nahi kar paunga')[0];
    assert(iCheated === 'guilt' && cheatedOn === 'heartbreak' && forgive === 'guilt',
        'Who did what is understood: "I cheated" is guilt, "cheated on me" is heartbreak; "maaf nahi kar paunga" is guilt');

    const career = say('my parents want me to become a doctor but I love music');
    const okay = say('hmm ok', { history: ['I feel lost'] });
    const tumour = say('I went to the doctor and they found a tumour', { history: ['I feel lost'] });
    assert(career.guidance.counselled && /3\.35/.test(career.guidance.bridge) && !career.context.topics.includes('health')
        && okay.context.intent === 'ack' && okay.verse === null && /2\.13|2\.23|18\.66/.test(tumour.guidance.bridge),
        'A career someone else chose is a question of svadharma; "hmm ok" is met with patience; a new diagnosis outweighs an earlier mood');

    const devanagari = say('मुझे अपने भविष्य की बहुत चिंता है');
    assert(devanagari.context.language === 'hi' && /[ऀ-ॿ]/.test(devanagari.guidance.bridge), 'Writing in Devanagari is answered in Hindi');

    // Memory from the person's own device shapes the reply.
    const remembered = say('my exams are tomorrow and I am so anxious', {
        person: { name: 'Riya', topics: { study: { count: 2, last: new Date(Date.now() - 2 * 86400000).toISOString() } }, sankalpa: { en: 'Steadiness', hi: 'धैर्य' } }
    });
    const recurring = say('I feel anxious again', { person: { recurring: { anxiety: 3 } } });
    assert(remembered.context.remembered && /before, too/.test(remembered.message) && /Steadiness/.test(remembered.guidance.bridge)
        && recurring.context.remembered && /visited you before/.test(recurring.message),
        'What the person carried before, and the intention they set today, are woven into the reply');

    const burden = say('I feel like a burden to everyone');
    assert(burden.context.concern && /14416/.test(burden.message), 'Warning signs short of crisis add a quiet line pointing to a human');

    // Integrity: every verse the counsel cites is a real verse.
    const cited = new Set();
    const collect = (text) => (String(text).match(/\((\d{1,2}\.\d{1,2})(?:[–,]\s?\d{1,2}(?:\.\d{1,2})?)*\)/g) || [])
        .flatMap((group) => group.match(/\d{1,2}\.\d{1,2}/g)).forEach((ref) => cited.add(ref));
    Object.values(engine.COUNSEL).forEach((entry) => ['en', 'hi'].forEach((lang) => ['ack', 'bridge', 'step'].forEach((key) => collect(entry[lang][key]))));
    Object.values(engine.GLOSSARY).forEach((entry) => ['en', 'hi'].forEach((lang) => collect(entry[lang].body)));
    Object.values(engine.BLESSINGS).forEach((entry) => collect(entry.en));
    const anchorIds = [...Object.values(engine.ANCHORS.emotions), ...Object.values(engine.ANCHORS.topics)].flat();
    const badRefs = [...cited].filter((ref) => !verseExists(ref));
    const badAnchors = anchorIds.filter((id) => !allVerses.find((v) => v.id === id) || engine.isNarrative(allVerses.find((v) => v.id === id)));
    const incomplete = Object.entries(engine.COUNSEL).filter(([, e]) => !['en', 'hi'].every((l) => e[l]?.ack && e[l]?.bridge && e[l]?.step)).map(([k]) => k);
    const brokenAliases = Object.entries(engine.COUNSEL_ALIASES).filter(([, target]) => !engine.COUNSEL[target]).map(([k]) => k);
    assert(!badRefs.length && !badAnchors.length && !incomplete.length && !brokenAliases.length && cited.size > 40,
        `Every cited verse (${cited.size}) and anchor (${anchorIds.length}) is real; all ${Object.keys(engine.COUNSEL).length} counsels speak both languages${badRefs.length ? ` — missing refs: ${badRefs}` : ''}${badAnchors.length ? ` — bad anchors: ${badAnchors}` : ''}${incomplete.length ? ` — incomplete: ${incomplete}` : ''}${brokenAliases.length ? ` — broken aliases: ${brokenAliases}` : ''}`);

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
