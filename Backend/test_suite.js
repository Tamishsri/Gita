const { loadData, getVerses, getChaptersMeta, getChapterMeta } = require('./src/data/loader');
const aiService = require('./src/services/aiService');
const searchService = require('./src/services/searchService');

async function runTests() {
    console.log('====================================================');
    console.log('🕉️  SAKHA FULL VERIFICATION SUITE');
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
    console.log('[1/12] Testing Data Loader & All 18 Chapters...');
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
    console.log('\n[2/12] Testing Multi-Dimensional Search...');
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
    console.log('\n[3/12] Testing AI Service Mood Matching...');
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
    console.log('\n[4/12] Testing Crisis Safety Protocols & Helplines...');
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
    console.log('\n[5/12] Testing Hindi Response & Translations...');
    const hindiResult = await aiService.generateResponse({
        text: 'मुझे बहुत चिंता हो रही है',
        mood: 'anxious',
        settings: { language: 'hi', depth: 'deep' }
    });
    assert(hindiResult && hindiResult.verse, `Hindi input returned appropriate verse BG ${hindiResult.verse?.chapter}.${hindiResult.verse?.verse || hindiResult.verse?.verse_number}`);
    assert(hindiResult.message.length > 20, `Generated contemplative response in Hindi`);

    // 6. HTTP API — the real Express app on an ephemeral port
    console.log('\n[6/12] Testing HTTP Endpoints...');
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
    console.log('\n[7/12] Testing Offline Engine Is The Shared Engine...');
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
    console.log('\n[8/12] Testing AI Safety, Understanding & Variety...');
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
    console.log('\n[9/12] Testing Understanding Anyone, In Their Own Words...');
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


    // ------------------------------------------------------------------
    console.log('\n[10/12] Testing Engine 4 — Reading Between The Lines...');

    // A graded set: each message, and what a good listener would hear in it.
    const readings = [
        ['im so lonley and anxous', { primary: 'loneliness', corrected: true }],
        ['i feel depresed', { primary: 'sadness', corrected: true }],
        ['I got the job but I am scared I will fail', { primary: 'fear', mixed: true, time: 'future' }],
        ['I used to be anxious all the time but now I feel much better', { primary: 'peace', relief: true }],
        ['I wish I felt better', { relief: false }],
        ['nothing makes me feel better anymore', { relief: false }],
        ['a bit nervous about the interview', { primary: 'anxiety', intensity: 'low' }],
        ['I AM SO DONE WITH EVERYONE!!', { primary: 'anger', intensity: 'high' }],
        ['sooo saaad today', { primary: 'sadness', intensity: 'high' }],
        ['😢😢', { primary: 'sadness' }],
        ['my mom is depressed', { care: 'mind' }],
        ['I think my brother is lonely', { care: 'mind' }],
        ['my dad has cancer', { care: 'health' }],
        ['मेरी माँ बहुत बीमार है', { care: 'health' }],
        ['I am so worried about my sister', { care: 'worry' }],
        ['mujhe papa ki bahut chinta hai', { care: 'worry' }],
        ['my friend said I am useless', { care: null, primary: 'unworthiness' }],
        ['my boyfriend left me and I feel lost', { care: null }],
        ['I have cancer and my mom is worried', { care: null }],
        ["I'll be fine, it is just a cold", { care: null }],
        ['I just want to vent', { ask: 'vent' }],
        ['how do i stop overthinking', { ask: 'how', primary: 'anxiety' }],
        ['why do I always get so angry', { ask: 'why', primary: 'anger' }],
        ['give me a verse about patience', { ask: 'verse', about: 'patience' }],
        ['गीता क्रोध के बारे में क्या कहती है', { ask: 'verse', about: 'क्रोध' }],
        ['my boss yelled at me in front of everyone', { primary: 'anger' }]
    ];
    const misheard = readings.filter(([text, want]) => {
        const r = engine.understand(text);
        const got = { primary: r.primary, mixed: r.mixed, time: r.time, relief: r.relief, intensity: r.intensity, care: r.care ? r.care.mode : null,
            ask: r.ask, about: r.about, corrected: r.corrections.length > 0 };
        return Object.entries(want).some(([key, value]) => got[key] !== value);
    });
    assert(misheard.length === 0, `${readings.length} graded messages read as a friend would — typos, "but", relief, intensity, whose feeling, what is asked${misheard.length ? ` — misheard: ${misheard.map(([t]) => `"${t}" → ${JSON.stringify(engine.understand(t), ['primary', 'mixed', 'time', 'relief', 'intensity', 'care', 'mode', 'ask', 'about'])}`).join(' | ')}` : ''}`);

    // Forgiving spelling must never "fix" a real word.
    const everyday = ['working', 'taking', 'facing', 'quite', 'lower', 'trained', 'madness', 'calming', 'words', 'sense', 'along', 'brief',
        'board', 'worse', 'hearing', 'lasting', 'changing', 'reflection', 'thinking', 'lovely', 'sacred', 'angel', 'tried'];
    const gitaWords = new Set();
    allVerses.forEach((v) => engine.normalise([v.meaning_en, ...(v.life_situations || []), ...(v.core_theme || [])].join(' ')).trim().split(' ').forEach((w) => gitaWords.add(w)));
    const wronglyFixed = [...everyday, ...gitaWords].filter((word) => engine.understand(`i was ${word}`).corrections.length);
    assert(wronglyFixed.length === 0, `Typos are forgiven, real words never "corrected" (${everyday.length} everyday words, all ${gitaWords.size} words of the Gita's own text)${wronglyFixed.length ? ` — changed: ${wronglyFixed.slice(0, 12).join(', ')}` : ''}`);

    // Caring for someone: the one who writes is the one answered.
    const carer = say('my mom is depressed and i dont know how to help her', { person: { name: 'Asha' } });
    const carerVerses = Array.from({ length: 10 }, (_, i) => say('my mom is depressed and i dont know how to help her', {}, i + 1).verse);
    const worrier = say('I am so worried about my brother');
    const carerHi = say('मेरी माँ बहुत बीमार है');
    assert(/^Asha, it hurts to watch your mother/.test(carer.message) && /6\.32/.test(carer.guidance.bridge) && /14416/.test(carer.message)
        && carer.guidance.focus === 'step' && /care stay steady/.test(carer.guidance.blessing) && carer.context.emotion === null
        && carerVerses.every((v) => !/sinners?\b/i.test(`${v.meaning_en} ${v.notification_short?.en || ''}`))
        && /^Worrying about your brother/.test(worrier.message) && /9\.22/.test(worrier.guidance.bridge) && !/14416/.test(worrier.message)
        && carerHi.message.startsWith('अपनी माँ') && /[ऀ-ॿ]/.test(carerHi.guidance.bridge),
        'Someone caring for a loved one is answered as the carer — by name, with 6.32, a helpline for families, and no verse about sinners');

    // Asked to listen: no homework, and listening carries into the next message.
    const ventOpen = say('I just want to vent');
    const vent = say('I just want to vent, my boss yelled at me again in front of everyone');
    const ventNext = say('he called me useless in the meeting', { history: ['I just want to vent'] });
    assert(ventOpen.context.intent === 'listen' && ventOpen.verse === null && vent.context.listening && vent.guidance.step === null
        && vent.guidance.bridge === null && /Not advice/.test(vent.message) && ventNext.context.listening && ventNext.guidance.step === null,
        '"I just want to vent" is met with listening — no advice, no step — and listening carries into what comes next');

    // "How do I…?" leads with the step; "why do I…?" answers why, once.
    const how = say('how do i stop overthinking');
    const whyAngry = say('why do I always get so angry');
    assert(how.guidance.focus === 'step' && /You asked what to do/.test(how.message)
        && /\(2\.62\)/.test(whyAngry.message) && !/\(2\.62/.test(whyAngry.guidance.bridge || '') && !/more than anyone should/.test(whyAngry.message),
        '"How do I…" leads with the step; "why do I…" is answered with where the feeling comes from, without repeating itself');

    // Asking for a verse gets a verse on that subject; a concept stays a concept.
    const patience = say('give me a verse about patience');
    const karmaAsk = say('what does the gita say about karma');
    const angerHi = say('गीता क्रोध के बारे में क्या कहती है');
    const patienceVerse = patience.verse && `${patience.verse.meaning_en} ${(patience.verse.core_theme || []).join(' ')} ${(patience.verse.emotional_tone || []).join(' ')} ${patience.verse.notification_short?.en || ''}`;
    assert(/^Here is what the Gita says about patience\./.test(patience.message) && /patien|gradual|little by little|steady|tolera|endur/i.test(patienceVerse)
        && karmaAsk.context.intent === 'concept' && karmaAsk.verse?.id === '2_47' && angerHi.context.ask === 'verse' && angerHi.message.startsWith('क्रोध'),
        '"Give me a verse about patience" is answered with one (English and Hindi); "what does the Gita say about karma" explains karma');

    // Unsure? Ask, with answers one tap away — and every answer is understood.
    const unclear = say('I was walking home and kept thinking about the conversation we had at dinner and I dont know');
    const small = say('today was weird');
    const unclearHi = say('आज कुछ अजीब सा था, पता नहीं क्यों', { settings: { language: 'hi' } });
    const chips = [...(unclear.clarify?.options || []), ...(small.clarify?.options || []), ...(unclearHi.clarify?.options || [])];
    const unheardChips = chips.filter((option) => !engine.understand(option.text).primary);
    assert(unclear.clarify?.options.length === 6 && small.clarify?.options.length === 7 && unclearHi.clarify && /[ऀ-ॿ]/.test(unclearHi.clarify.options[0].label)
        && unclear.message.includes(unclear.clarify.question) && unheardChips.length === 0,
        `When unsure, Sakha asks — with ${chips.length} one-tap answers (English and Hindi), every one of which it then understands${unheardChips.length ? ` — not understood: ${unheardChips.map((o) => o.text).join(' | ')}` : ''}`);

    // The conversation has a shape: lighter, heavier, or still here.
    const easing = say('i feel a bit calmer now', { history: ['I am so anxious about my results tomorrow'] });
    const heavier = say('IM SO SCARED I CANT DO THIS!!', { history: ['i am a bit nervous about my exam'] });
    const lingering = say('I am still anxious about my career', { history: ['I am feeling scared about my career'] });
    assert(easing.context.trajectory === 'easing' && /lighter than when we began/.test(easing.message)
        && heavier.context.trajectory === 'heavier' && /weighing more/.test(heavier.message)
        && lingering.context.trajectory === 'lingering' && /still here/.test(lingering.message),
        'Across a conversation Sakha notices when it is easing, growing heavier, or still here — and says so');

    // Counsel is never repeated within a conversation.
    const firstTime = say('I am scared about my career');
    const secondTime = say('I am scared about my career', { used: ['anxiety:work'] });
    assert(firstTime.context.counsel === 'anxiety:work' && secondTime.context.counsel === undefined
        && secondTime.guidance.bridge !== firstTime.guidance.bridge && !secondTime.message.startsWith(firstTime.message.split('\n')[0]),
        'The same counsel is never given twice in one conversation');

    // Intensity and mixed feelings shape the first words.
    const loud = say('I AM SO DONE WITH EVERYONE!!');
    const soft = say('a bit nervous about the interview');
    const mixed = say('I got the job but I am scared I will fail');
    const relieved = say('I used to be anxious all the time but now I feel much better');
    assert(/more than anyone should|pressing on you|heavy thing to carry/.test(loud.message) && /small unease/.test(soft.message)
        && /both can be true/.test(mixed.message) && mixed.context.emotion === 'fear' && relieved.context.emotion === 'peace'
        && /eased|worst of it/.test(relieved.message) && !/both can be true/.test(autopilot.message),
        'Intensity, mixed news and relief each change how Sakha first answers');

    // Integrity: every verse the new counsel cites, and every care anchor, is real.
    const newCited = new Set();
    const collectNew = (text) => (String(text).match(/\((\d{1,2}\.\d{1,2})(?:[–,]\s?\d{1,2}(?:\.\d{1,2})?)*\)/g) || [])
        .flatMap((group) => group.match(/\d{1,2}\.\d{1,2}/g)).forEach((ref) => newCited.add(ref));
    Object.values(engine.CARE_COUNSEL).forEach((entry) => ['en', 'hi'].forEach((lang) => { collectNew(entry[lang].bridge); collectNew(entry[lang].step); }));
    Object.values(engine.ROOTS).forEach((entry) => ['en', 'hi'].forEach((lang) => collectNew(entry[lang])));
    const careAnchors = Object.values(engine.CARE).flatMap((entry) => entry.anchors);
    const badNew = [...newCited].filter((ref) => !verseExists(ref));
    const badCare = careAnchors.filter((id) => !allVerses.find((v) => v.id === id) || engine.isNarrative(allVerses.find((v) => v.id === id)));
    const rootsHalf = Object.entries(engine.ROOTS).filter(([, e]) => !e.en || !/[ऀ-ॿ]/.test(e.hi || '')).map(([k]) => k);
    assert(!badNew.length && !badCare.length && !rootsHalf.length && newCited.size >= 12,
        `Care counsel and "why" answers cite ${newCited.size} real verses in both languages; ${careAnchors.length} care anchors are real${badNew.length ? ` — missing: ${badNew}` : ''}${badCare.length ? ` — bad anchors: ${badCare}` : ''}${rootsHalf.length ? ` — one language only: ${rootsHalf}` : ''}`);

    // Fast enough to feel instant on a phone.
    const long = 'I have been feeling so lost lately, my job is stressful and my parents keep asking about marriage, '.repeat(18);
    const started = Date.now();
    for (let i = 0; i < 60; i++) say(i % 2 ? long.slice(0, 1990) : 'im so lonley and anxous about my carrer', { history: ['I feel lost', 'work is hard'] }, i);
    const perReply = (Date.now() - started) / 60;
    assert(perReply < 60, `Each reply is composed in ${perReply.toFixed(1)} ms on average, long messages included`);

    // ------------------------------------------------------------------
    console.log('\n[11/12] Testing Engine 5 — An Answer Shaped For Each Person...');

    // The Gita's four paths, read from every verse.
    const pathCounts = { karma: 0, jnana: 0, bhakti: 0, dhyana: 0 };
    allVerses.filter((v) => !engine.isNarrative(v)).forEach((v) => engine.versePaths(allVerses, v.id).forEach((id) => { pathCounts[id] += 1; }));
    const knownPaths = [['2_47', 'karma'], ['3_8', 'karma'], ['2_20', 'jnana'], ['2_23', 'jnana'], ['9_22', 'bhakti'], ['18_66', 'bhakti'], ['6_35', 'dhyana'], ['6_19', 'dhyana']];
    const mispathed = knownPaths.filter(([id, path]) => !engine.versePaths(allVerses, id).includes(path));
    assert(Object.values(pathCounts).every((count) => count >= 60) && !mispathed.length,
        `Every verse is read for the path it walks — action ${pathCounts.karma}, understanding ${pathCounts.jnana}, devotion ${pathCounts.bhakti}, stillness ${pathCounts.dhyana}${mispathed.length ? ` — wrong: ${mispathed.map(([id]) => id)}` : ''}`);

    // What has helped a person before is what Sakha leans toward.
    const shareOf = (path, person) => {
        const picks = Array.from({ length: 24 }, (_, i) => say('I feel lost and anxious about everything', { person }, i + 1).verse);
        return picks.filter((v) => engine.versePaths(allVerses, v.id).includes(path)).length / picks.length;
    };
    const leanings = ['karma', 'jnana', 'bhakti', 'dhyana'].map((path) => ({ path, before: shareOf(path, null), after: shareOf(path, { paths: { [path]: 6 } }) }));
    const unmoved = leanings.filter(({ before, after }) => after <= before);
    assert(!unmoved.length, `Answers lean toward the path that has helped each person (${leanings.map(({ path, before, after }) => `${path} ${Math.round(before * 100)}%→${Math.round(after * 100)}%`).join(', ')})`);

    // Three voices.
    const gentle = say('I feel so anxious today');
    const plainly = say('I feel so anxious today', { person: { voice: 'direct' } });
    const explained = say('I feel so anxious today', { person: { voice: 'teacher' } });
    assert(plainly.message.length < gentle.message.length * 0.75 && plainly.guidance.focus === 'step' && !/Here is what the Gita says/.test(plainly.message)
        && /People turn to this verse for/.test(explained.message) && /\(2\.47\)/.test(explained.message) && plainly.context.voice === 'direct',
        'Each person is spoken to as they asked: gently, plainly (verse and step first) or explaining more (why it happens, and the moments the verse is for)');

    // What someone asked Sakha to keep in mind about their life.
    const student = say('I feel so tired and heavy today', { person: { context: 'I am preparing for UPSC this year and live away from home' } });
    const carerSad = say('I feel sad', { person: { context: 'My mother has dementia and I look after her' } });
    const carerAngry = say('I am so angry today', { person: { context: 'My mother has dementia and I look after her' } });
    const tiredCarerHi = say('मैं बहुत थक गई हूँ', { person: { context: 'मेरी माँ बहुत बीमार है' } });
    assert(student.context.standing === 'study' && /With your studies on your mind/.test(student.message)
        && /^Watching your mother/.test(carerSad.message) && carerSad.context.care?.mode === 'health'
        && carerAngry.context.standing === undefined && !carerAngry.context.care
        && tiredCarerHi.message.startsWith('अपनी माँ') && /अपनी माँ की सेहत/.test(tiredCarerHi.message),
        'What a person told Sakha about their life shapes the answer — exams, a mother who is ill — without colouring unrelated anger');

    // "Not quite" — and what would help instead.
    const firstAnswer = say('I am anxious about my job interview');
    const practical = say(null, { history: ['I am anxious about my job interview'], retry: { reason: 'practical' }, exclude: [firstAnswer.verse.id] });
    const gentler = say(null, { history: ['I am anxious about my job interview'], retry: { reason: 'comfort' }, exclude: [firstAnswer.verse.id] });
    const deeper = say(null, { history: ['I feel lost'], retry: { reason: 'deeper' } });
    const notMine = say(null, { history: ['I am anxious about my job interview'], retry: { reason: 'situation' } });
    const notMineHi = say(null, { history: ['मुझे बहुत चिंता है'], retry: { reason: 'situation' }, settings: { language: 'hi' } });
    const topicChips = [...(notMine.clarify?.options || []), ...(notMineHi.clarify?.options || [])];
    const unplaced = topicChips.filter((option) => !engine.understand(option.text).topics.length);
    assert(/more practical/.test(practical.message) && practical.guidance.focus === 'step' && practical.verse.id !== firstAnswer.verse.id
        && /gentler/.test(gentler.message) && /People turn to this verse for/.test(deeper.message)
        && notMine.verse === null && topicChips.length === 14 && !unplaced.length,
        `"Not quite" answers again — gentler, more practical, deeper — or asks what it is about, with ${topicChips.length} one-tap answers it understands${unplaced.length ? ` — not placed: ${unplaced.map((o) => o.text).join(' | ')}` : ''}`);

    // The device learns from the answer's path.
    assert(Array.isArray(firstAnswer.context.paths) && firstAnswer.context.engine === engine.ENGINE_VERSION && Number(engine.ENGINE_VERSION.split('.')[0]) >= 5,
        'Each answer says which path its verse walks, so the device can learn what helps — and nothing about it leaves the device');

    // ------------------------------------------------------------------
    console.log('\n[12/12] Testing Engine 6 — Many People, Many Conversations...');
    {

    // A whole conversation, as the app holds it: history, counsel used, verses shown, words already said.
    const converse = (turns, extra = {}, seed = 5) => {
        const history = []; const used = []; const exclude = []; const said = []; const replies = [];
        turns.forEach((text, i) => {
            const r = engine.respond({ text, history: [...history], used: [...used], exclude: [...exclude], said: [...said], ...extra }, { ...corpus, random: seeded(seed + i), timeOfDay: 'evening' });
            history.push(text);
            if (r.context?.counsel) used.push(r.context.counsel);
            if (r.verse) exclude.push(r.verse.id);
            said.push(r.message.split('\n\n')[0]);
            if (r.guidance?.step) said.push(r.guidance.step);
            replies.push(r);
        });
        return replies;
    };

    // Help first: violence someone witnesses at home, and quieter warning signs.
    const witnessed = ['my dad hits my mom', 'he beats my sister every night', 'my husband hit my son'].map((t) => say(t));
    const disappearing = say('I feel like disappearing');
    const nothing = say('nothing matters anymore');
    assert(witnessed.every((r) => r.context.safety && r.verse === null) && !say('it hit me hard that I am getting older').context.safety
        && disappearing.context.concern && disappearing.context.intent !== 'smalltalk' && /14416/.test(disappearing.message) && nothing.context.concern,
        'Violence seen at home gets emergency help; "I feel like disappearing" and "nothing matters" are met with care and a helpline, never small talk');

    // Questions of conscience and practice are answered as what they are.
    const money = say('is it wrong to want money');
    const jealous = say('is it wrong to feel jealous of my friend');
    const paisa = say('kya paise chahna galat hai');
    const krodh = say('क्या गुस्सा करना पाप है');
    const after = say('what happens after death');
    const meditate = say('how do i meditate');
    assert(money.context.intent === 'ethics' && money.verse?.id === '7_11' && /^Wanting, by itself, is not wrong/.test(money.message)
        && /^Feeling it is not wrong/.test(jealous.message) && paisa.context.intent === 'ethics' && /[ऀ-ॿ]/.test(krodh.message.split('\n')[0])
        && after.context.concept === 'rebirth' && meditate.context.concept === 'dhyana',
        '"Is it wrong to want money?", "…to feel jealous?" (English, Hinglish, Hindi), "what happens after death", "how do I meditate" are each answered as the question they are');

    // Never the same words twice in one conversation.
    const heartbreakChat = converse(['she left me for someone else', 'i keep checking her instagram', 'i miss her so much', 'i still cant stop thinking about her', 'it hurts']);
    const openings = heartbreakChat.map((r) => r.message.split('\n\n')[0]);
    const steps = heartbreakChat.map((r) => r.guidance?.step).filter(Boolean);
    const sameOpening = openings.filter((line, i) => openings.indexOf(line) !== i);
    const sameStep = steps.filter((step, i) => steps.indexOf(step) !== i);
    assert(!sameOpening.length && !sameStep.length,
        `Across a five-message conversation no opening line and no step is ever repeated${sameOpening.length ? ` — repeated: ${sameOpening[0]}` : ''}${sameStep.length ? ` — step: ${sameStep[0]}` : ''}`);

    // Listening lasts, and a situation is named once.
    const venting = converse(['I just need to vent', 'my parents never listen to me', 'and today they said I am a disappointment', 'my family always compares me']);
    const familyLines = venting.filter((r) => /Family is where we love most/.test(r.message)).length;
    assert(venting.slice(1).every((r) => r.context.listening && r.guidance?.step == null) && familyLines <= 1,
        'Once someone asks only to be heard, every reply after listens — and the situation is named once, not every time');

    // Learning a person's own words.
    const unclear = say('meh');
    const clarified = say('I feel sad about this', { history: ['meh'] });
    const lexicon = clarified.context.learn ? { [clarified.context.learn.phrase]: { [clarified.context.learn.feeling]: 1 } } : {};
    const later = say('meh', { person: { lexicon } });
    const notLearned = [say('nothing matters anymore', { history: ['fine i guess'] }), say('should i text her', { history: ['she left me', 'i keep checking her instagram'] })];
    assert(unclear.context.intent === 'smalltalk' && clarified.context.learn?.phrase === 'meh' && clarified.context.learn?.feeling === 'sadness'
        && later.context.emotion === 'sadness' && /I remember what “meh” means for you/.test(later.message) && notLearned.every((r) => !r.context.learn),
        'Sakha learns a person’s own word for a feeling when they clarify it ("meh" → sad), remembers it next time, and never learns from masking or carried messages');

    // Something coming up, remembered as a label and a day.
    const events = [['i have a mock test tomorrow', 'exam', 'tomorrow'], ['my interview is on friday', 'interview', 'friday'],
        ['surgery tomorrow for my mom', 'surgery', 'tomorrow'], ['kal mera exam hai', 'exam', 'tomorrow'], ['मेरी परीक्षा कल है', 'exam', 'tomorrow']];
    const missedEvents = events.filter(([t, kind, when]) => { const e = say(t).context.event; return !e || e.kind !== kind || e.when !== when; });
    assert(!missedEvents.length && !say('this exam is killing me').context.event,
        `Upcoming exams, interviews and surgeries are noticed in three languages, so Sakha can ask how they went${missedEvents.length ? ` — missed: ${missedEvents.map(([t]) => t).join(' | ')}` : ''}`);

    // A carer, in Hindi, over a conversation.
    const sunita = converse(['आज बहुत थकान है', 'मुझे डर लगता है कि उन्हें कुछ हो न जाए'], { person: { name: 'सुनीता', context: 'मेरे पति को कैंसर है और मैं उनकी देखभाल करती हूँ' } });
    assert(sunita[0].context.care?.mode === 'health' && /अपने पति/.test(sunita[0].message) && sunita[0].message.split('\n\n')[0] !== sunita[1].message.split('\n\n')[0]
        && /प्रेम|थका|थामे/.test(sunita[1].message.split('\n\n')[0]),
        'A wife caring for her husband with cancer (in Hindi) is answered as his carer — and her second message is met freshly, as her own fear');

    // Everyday words, read rightly.
    const everydayReads = [['mujhe khud se nafrat ho rahi hai', 'unworthiness'], ["i'm not okay", 'sadness'], ['feeling low key off today', 'sadness'],
        ['my mind wont shut up at night', 'anxiety'], ['im dying of boredom', 'inertia'], ['kinda burnt out ngl', 'stress']];
    const misreadEveryday = everydayReads.filter(([t, want]) => engine.understand(t).primary !== want);
    assert(!misreadEveryday.length && engine.understand('my parents keep comparing me to my cousin').primary !== 'envy'
        && !engine.understand('im dying of boredom').topics.includes('loss'),
        `Everyday and slang phrasings are read rightly — self-hatred, "not okay", "low key off", a racing mind at night, boredom, burnout${misreadEveryday.length ? ` — misread: ${misreadEveryday.map(([t]) => `"${t}"→${engine.understand(t).primary}`).join(' | ')}` : ''}`);

    // Verses about death are kept for grief, fear and illness.
    const deathWords = /\b(death|dying|die|slain|reincarnation|rebirth|never born|garments|goodbye|grief|funeral)\b/i;
    const lowDays = Array.from({ length: 12 }, (_, i) => say("i'm not okay", {}, i + 1).verse);
    const griefDays = Array.from({ length: 8 }, (_, i) => say('my mother passed away', {}, i + 1).verse);
    const deathOnLowDays = lowDays.filter((v) => deathWords.test(`${(v.core_theme || []).join(' ')} ${(v.life_situations || []).join(' ')} ${v.notification_short?.en || ''}`));
    assert(deathOnLowDays.length <= 1 && griefDays.some((v) => deathWords.test(`${(v.core_theme || []).join(' ')} ${(v.life_situations || []).join(' ')} ${v.notification_short?.en || ''}`)),
        `An ordinary low day is not answered with verses about death (${deathOnLowDays.length} of 12); grief still is`);

    // When a step cannot repeat, the new one suits the feeling.
    const grieving = converse(['my husband passed away last month', 'why did god take him', 'I keep setting out two cups of tea']);
    assert(grieving.slice(1).every((r) => !/smallest next action|ten minutes and do only|three tasks/i.test(r.guidance?.step || '')),
        'Someone grieving is never handed a productivity task when a step is replaced');
    }
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
