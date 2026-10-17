/*
 * Living Gita — Wisdom Engine
 *
 * The single source of truth for how the sanctuary listens and answers:
 * crisis detection, emotion understanding (English, Hindi, Hinglish), verse
 * selection, search, and the daily verse.
 *
 * It is pure (no I/O, no globals) and runs in three places:
 *   - the Express API             require('../../../shared/wisdom-engine')
 *   - the offline service worker  inlined by the Vite plugin as self.WisdomEngine
 *   - the test suite
 * so the online and offline sanctuaries can never drift apart.
 */
(function (root, factory) {
    const engine = factory();
    if (typeof module === 'object' && module.exports) module.exports = engine;
    else root.WisdomEngine = engine;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const ENGINE_VERSION = '2.0.0';

    // -----------------------------------------------------------------------
    // Text normalisation
    // -----------------------------------------------------------------------

    // Keep letters, combining marks (Devanagari matras) and digits. Sentence
    // punctuation becomes a "|" clause marker (so negation never leaks across
    // clauses); everything else becomes a space. Padded so phrases match on
    // word edges.
    function normalise(text) {
        if (!text || typeof text !== 'string') return ' ';
        const cleaned = text
            .toLowerCase()
            .replace(/[’`]/g, "'")
            .replace(/[‌‍]/g, '')
            .replace(/[.,;:!?।॥]+/g, ' | ')
            .replace(/[^\p{L}\p{M}\p{N}'|]+/gu, ' ')
            .replace(/'/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return ` ${cleaned} `;
    }

    // A term matches on word boundaries. "worr*" is a prefix (worry, worried…).
    function findTerm(normalised, term) {
        const prefix = term.endsWith('*');
        const needle = ` ${prefix ? term.slice(0, -1) : term}${prefix ? '' : ' '}`;
        return normalised.indexOf(needle);
    }

    const has = (normalised, term) => findTerm(normalised, term) !== -1;

    // -----------------------------------------------------------------------
    // Crisis detection — human support before scripture, always.
    // Deliberately broad: a false positive shows helplines; a false negative
    // can cost a life.
    // -----------------------------------------------------------------------

    const CRISIS_TERMS = [
        // English
        'suicid*', 'sucid*', 'suicd*', 'kill myself', 'killing myself', 'kms', 'end my life', 'ending my life',
        'end it all', 'take my life', 'take my own life', 'want to die', 'wanna die', 'want to be dead',
        'wish i was dead', 'wish i were dead', 'better off dead', 'better off without me', 'no reason to live',
        'nothing to live for', 'dont want to live', 'do not want to live', 'dont want to be alive',
        'do not want to be alive', 'cant go on anymore', 'cannot go on anymore', 'cant go on living',
        'cannot go on living', 'no point living', 'no point in living', 'life is pointless', 'hurt myself',
        'harm myself', 'self harm', 'selfharm', 'cut myself', 'cutting myself', 'overdose', 'all my pills',
        'all the pills', 'hang myself', 'jump off a', 'disappear forever', 'never wake up', 'not wake up tomorrow',
        'unalive', 'end everything', 'give up on life',
        // Hindi
        'आत्महत्या', 'खुदकुशी', 'ख़ुदकुशी', 'मरना चाहता', 'मरना चाहती', 'मर जाना चाहता', 'मर जाना चाहती',
        'मर जाऊं', 'मर जाऊँ', 'मरना है', 'जीना नहीं चाहता', 'जीना नहीं चाहती', 'जीने का मन नहीं',
        'जीवन समाप्त', 'जिंदगी खत्म', 'ज़िंदगी खत्म', 'जिंदगी ख़त्म', 'खुद को खत्म', 'अपनी जान ले', 'जान दे दूं',
        'जान दे दूँ',
        // Hinglish
        'marna hai', 'marna chahta', 'marna chahti', 'mar jana chahta', 'mar jana chahti', 'mar jaana',
        'mar jaun', 'jeena nahi chahta', 'jeena nahi chahti', 'jeene ka mann nahi', 'jeene ka man nahi',
        'jine ka man nahi', 'suicide kar*', 'khudkushi', 'jaan de du*', 'khud ko khatam', 'zindagi khatam',
        'zindagi khatm'
    ];

    const CRISIS_RESPONSE = {
        hi: 'मुझे लगता है कि आप बहुत गहरे दर्द से गुजर रहे हैं। यह एक ऐसा पल है जहाँ किसी इंसान की मदद जरूरी है। कृपया किसी भरोसेमंद व्यक्ति, काउंसलर या सहायता हेल्पलाइन से तुरंत संपर्क करें। आप अकेले नहीं हैं।\n\nमुफ्त एवं गोपनीय सहायता:\n• Tele-MANAS (भारत): 14416 या 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• अंतर्राष्ट्रीय हेल्पलाइन: https://findahelpline.com',
        en: "I sense you're going through deep pain. This is a moment where human support is essential. Please reach out to someone you trust, a counselor, or a crisis helpline right now. You do not have to carry this alone.\n\nFree & Confidential Support:\n• Tele-MANAS (India): 14416 or 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• 988 Suicide & Crisis Lifeline (US/Canada): Call or Text 988\n• Worldwide Helplines: https://findahelpline.com"
    };

    function detectCrisis(text) {
        const normalised = normalise(text);
        if (normalised === ' ') return false;
        return CRISIS_TERMS.some((term) => has(normalised, term));
    }

    // -----------------------------------------------------------------------
    // Emotion lexicon
    //   terms:    what people actually say (English, Hindi, Hinglish)
    //   concepts: what to look for in a verse's tone, themes and situations
    //   en/hi:    how to name the feeling back, grammatically
    // -----------------------------------------------------------------------

    const EMOTIONS = {
        anxiety: {
            terms: ['anxious', 'anxiety', 'worr*', 'nervous', 'panic*', 'uneasy', 'restless*', 'overthink*', 'racing', 'on edge',
                'tension', 'tense', 'chinta', 'ghabrahat', 'bechain*', 'चिंता', 'चिंतित', 'घबराहट', 'बेचैन*', 'परेशान*'],
            concepts: ['fear', 'anxiety', 'freedom from anxiety', 'worry', 'worrying', 'uncertainty', 'restless', 'calm', 'steady', 'equanimity', 'emotional stability', 'staying calm', 'overthinking', 'security', 'trusting god', 'divine assurance', 'managing stress'],
            en: { adj: 'anxious', noun: 'anxiety' },
            hi: { noun: 'चिंता', g: 'f' }
        },
        fear: {
            terms: ['afraid', 'fear*', 'scared', 'terrified', 'frightened', 'dread*', 'darr', 'dar lag*', 'डर*', 'भय', 'डरा*', 'डरी'],
            concepts: ['fear', 'fearlessness', 'overcoming fear', 'do not fear', 'courage', 'protection', 'reassurance', 'reassuring', 'protective', 'divine assurance', 'final refuge', 'security'],
            en: { adj: 'afraid', noun: 'fear' },
            hi: { noun: 'डर', g: 'm' }
        },
        stress: {
            terms: ['stress*', 'pressure', 'overwhelm*', 'burnout', 'burnt out', 'burned out', 'workload', 'deadline*', 'too much',
                'exhausted', 'drained', 'tired', 'thak*', 'तनाव', 'दबाव', 'थक*', 'बोझ'],
            concepts: ['stress', 'managing stress', 'handling pressure', 'burnout', 'avoiding burnout', 'doing difficult tasks', 'balance', 'equanimity', 'detached action', 'steady', 'surrender', 'emotional overwhelm'],
            en: { adj: 'overwhelmed', noun: 'stress' },
            hi: { noun: 'तनाव', g: 'm' }
        },
        anger: {
            terms: ['angry', 'anger', 'furious', 'rage', 'mad at', 'irritat*', 'frustrat*', 'annoyed', 'resent*', 'hate', 'humiliat*',
                'gussa', 'gussa*', 'naraz', 'गुस्सा', 'गुस्से', 'क्रोध*', 'नाराज़*', 'नाराज*', 'चिढ़*'],
            concepts: ['anger', 'managing anger', 'self-control', 'self control', 'battling inner demons', 'mastering your thoughts', 'calm', 'forgiveness', 'desire', 'patience', 'tolerance', 'not disturbed by others'],
            en: { adj: 'angry', noun: 'anger' },
            hi: { noun: 'क्रोध', g: 'm' }
        },
        sadness: {
            terms: ['sad', 'sadness', 'depress*', 'unhappy', 'miserable', 'cry*', 'tears', 'hopeless*', 'heavy heart', 'feel down', 'feeling down',
                'udaas', 'udas', 'dukhi', 'उदास*', 'दुखी', 'दुःख*', 'दुख', 'रो रहा', 'रो रही', 'निराश*'],
            concepts: ['grief', 'sorrow', 'sadness', 'compassion', 'hope', 'hopeful', 'comforting', 'enduring a hard time', 'staying strong in pain', 'bad phase', 'impermanence', 'resilient', 'end of grief', 'reassuring'],
            en: { adj: 'low', noun: 'sadness' },
            hi: { noun: 'उदासी', g: 'f' }
        },
        grief: {
            terms: ['grief', 'griev*', 'passed away', 'died', 'death of', 'lost my', 'funeral', 'mourn*', 'miss him', 'miss her',
                'shok', 'शोक', 'मृत्यु', 'गुज़र गए', 'गुजर गए', 'खो दिया', 'नहीं रहे'],
            concepts: ['grief', 'death', 'fear of death', 'soul', 'eternal', 'eternal nature', 'end of grief', 'immortality', 'compassion', 'cycle of life'],
            en: { adj: 'heavy with grief', noun: 'grief' },
            hi: { noun: 'शोक', g: 'm' }
        },
        loneliness: {
            terms: ['lonely', 'loneliness', 'alone', 'isolated', 'nobody', 'no one', 'abandoned', 'left out', 'misunderstood',
                'akela', 'akeli', 'akelapan', 'अकेला', 'अकेली', 'अकेलापन', 'अकेले'],
            concepts: ['never feeling alone', 'never lost', 'feeling loved', 'seeking a friend', 'friend', 'friendship', 'intimacy', 'divine presence', 'feeling god', 'being misunderstood', 'caring', 'affectionate', 'loving', 'intimate', 'reassured', 'security'],
            en: { adj: 'alone', noun: 'loneliness' },
            hi: { noun: 'अकेलापन', obl: 'अकेलेपन', g: 'm' }
        },
        confusion: {
            terms: ['confus*', 'unsure', 'uncertain', 'dilemma', 'cant decide', 'cannot decide', 'should i', 'what should',
                'which path', 'direction', 'doubt*', 'lost', 'samajh nahi', 'उलझन', 'भ्रम', 'असमंजस', 'दुविधा', 'समझ नहीं'],
            concepts: ['confusion', 'clarity', 'seeking clarity', 'guidance', 'seeking guidance', 'doubt', 'duty', 'swadharma', 'decision', 'knowledge', 'wisdom'],
            en: { adj: 'uncertain', noun: 'confusion' },
            hi: { noun: 'उलझन', g: 'f' }
        },
        guilt: {
            terms: ['guilt*', 'ashamed', 'shame', 'regret*', 'my fault', 'forgive me', 'messed up', 'पछतावा', 'शर्म*', 'गलती', 'ग़लती'],
            concepts: ['seeking forgiveness', 'forgiveness', 'overcoming a dark past', 'starting over', 'redemption', 'redemptive', 'freedom from sin', 'liberation from all sin', 'divine grace', 'purification'],
            en: { adj: 'weighed down by guilt', noun: 'guilt' },
            hi: { noun: 'पछतावा', obl: 'पछतावे', g: 'm' }
        },
        unworthiness: {
            terms: ['worthless', 'useless', 'not good enough', 'inadequate', 'insecure', 'self doubt', 'hate myself', 'a disappointment',
                'loser', 'no confidence', 'बेकार', 'नाकाम*', 'nikamma', 'bekaar'],
            concepts: ['negative self-talk', 'being your own best friend', 'mind as friend', 'self-motivation', 'self-help', 'self-doubt', 'confidence', 'trying to boost confidence', 'inner strength', 'overcoming weakness', 'self-pity', 'empowering', 'encouraging'],
            en: { adj: 'not good enough', noun: 'self-doubt' },
            hi: { noun: 'आत्म-संदेह', g: 'm' }
        },
        failure: {
            // Situations like "exam" are context, not feelings — they match verses as keywords instead.
            terms: ['failed', 'failing', 'failure', 'fail', 'rejected', 'rejection', 'lost the', 'fail ho', 'असफल*', 'हार गया', 'हार गई'],
            concepts: ['fear of failure', 'results', 'detachment', 'karma yoga', 'duty without expectation', 'effort', 'resilience', 'determination', 'detached action'],
            en: { adj: 'discouraged', noun: 'disappointment' },
            hi: { noun: 'निराशा', g: 'f' }
        },
        envy: {
            terms: ['jealous*', 'envy', 'envious', 'compar*', 'ईर्ष्या', 'जलन'],
            concepts: ['envy', 'desire', 'contentment', 'equal vision', 'detachment', 'humility', 'satisfaction'],
            en: { adj: 'envious', noun: 'envy' },
            hi: { noun: 'ईर्ष्या', g: 'f' }
        },
        heartbreak: {
            terms: ['breakup', 'broke up', 'break up', 'divorce*', 'betray*', 'cheated', 'heartbroken', 'heartbreak', 'my ex',
                'relationship', 'relationship ended', 'left me', 'dhokha', 'धोखा', 'दिल टूट*', 'रिश्ता', 'रिश्ते'],
            // Comfort first: a broken heart needs holding before it hears "detachment".
            concepts: ['feeling hurt', 'emotional pain', 'comfort in loss', 'letting go of the past', 'starting a new chapter', 'learning to let go', 'letting go', 'enduring a hard time', 'staying strong in pain', 'impermanence', 'love'],
            en: { adj: 'heartbroken', noun: 'heartbreak' },
            hi: { noun: 'दर्द', g: 'm' }
        },
        purpose: {
            terms: ['purpose', 'meaning', 'meaningless', 'career', 'my job', 'quit', 'calling', 'passion', 'what am i doing',
                'मकसद', 'उद्देश्य', 'नौकरी'],
            concepts: ['duty', 'swadharma', 'purpose', 'karma yoga', 'call to action', 'action', 'dedication', 'destiny', 'leadership'],
            en: { adj: 'searching for your path', noun: 'search for purpose' },
            hi: { noun: 'उद्देश्य की खोज', g: 'f' }
        },
        craving: {
            terms: ['addict*', 'craving*', 'cant stop', 'cannot stop', 'smoking', 'drinking', 'porn', 'scrolling', 'temptation', 'लत'],
            concepts: ['addiction', 'overcoming cravings', 'sense control', 'self-control', 'discipline', 'desire', 'self-discipline', 'pratyahara'],
            en: { adj: 'pulled by cravings', noun: 'craving' },
            hi: { noun: 'लालसा', g: 'f' }
        },
        peace: {
            terms: ['peace', 'peaceful', 'calm', 'stillness', 'quiet', 'meditat*', 'serenity', 'shanti', 'sukoon', 'शांति', 'शान्ति', 'सुकून', 'ध्यान'],
            concepts: ['peace', 'meditation', 'stillness', 'serenity', 'finding peace', 'finding inner peace', 'calm', 'peaceful', 'meditative', 'samadhi'],
            en: { adj: 'drawn to stillness', noun: 'longing for peace' },
            hi: { noun: 'शांति की चाह', g: 'f' }
        },
        gratitude: {
            terms: ['grateful', 'gratitude', 'thankful', 'thank god', 'blessed', 'happy', 'joy*', 'khush', 'shukr*',
                'आभार*', 'कृतज्ञ*', 'खुश', 'प्रसन्न', 'धन्य'],
            concepts: ['gratitude', 'joy', 'joyful', 'contentment', 'happiness', 'devotion', 'devotional', 'blissful', 'loving', 'worshipful'],
            en: { adj: 'grateful', noun: 'gratitude' },
            hi: { noun: 'कृतज्ञता', g: 'f' }
        }
    };

    // The moods offered on the home screen, plus a few common free-text names.
    const MOOD_TO_EMOTION = {
        anxious: 'anxiety', anxiety: 'anxiety', worried: 'anxiety', overthinking: 'anxiety', indecision: 'confusion',
        stressed: 'stress', stress: 'stress', overwhelmed: 'stress', burnout: 'stress',
        angry: 'anger', anger: 'anger',
        sad: 'sadness', sadness: 'sadness', depressed: 'sadness', hopeless: 'sadness',
        grief: 'grief', loss: 'grief',
        lonely: 'loneliness', lost: 'confusion',
        confused: 'confusion', confusion: 'confusion',
        fear: 'fear', afraid: 'fear',
        peace: 'peace', calm: 'peace',
        happy: 'gratitude', grateful: 'gratitude', gratitude: 'gratitude', joy: 'gratitude',
        guilt: 'guilt', 'self-blame': 'guilt', 'self-doubt': 'unworthiness'
    };

    const NEGATIONS = new Set(['not', 'no', 'never', 'isnt', 'arent', 'wasnt', 'dont', 'doesnt', 'didnt', 'hardly', 'barely', 'nor', 'without']);
    const POST_NEGATIONS = new Set(['nahi', 'nahin', 'नहीं', 'ना', 'न']);

    const CLAUSE_BREAKS = new Set(['|', 'but', 'just', 'and', 'though', 'although', 'yet', 'so', 'par', 'lekin', 'पर', 'लेकिन']);

    // Look a few words either side of a match, never across a clause:
    // "not angry, just tired" negates "angry" but keeps "tired".
    function negated(normalised, index) {
        const before = [];
        for (const word of normalised.slice(0, index).trim().split(' ').reverse()) {
            if (CLAUSE_BREAKS.has(word) || before.length === 3) break;
            before.push(word);
        }
        if (before.some((word) => NEGATIONS.has(word))) return true;
        const after = [];
        for (const word of normalised.slice(index).trim().split(' ').slice(1)) {
            if (CLAUSE_BREAKS.has(word) || after.length === 3) break;
            after.push(word);
        }
        return after.some((word) => POST_NEGATIONS.has(word));
    }

    // Ties go to the more specific feeling.
    const SPECIFICITY = ['grief', 'heartbreak', 'failure', 'guilt', 'envy', 'craving', 'loneliness', 'unworthiness', 'fear',
        'anger', 'sadness', 'anxiety', 'stress', 'purpose', 'confusion', 'peace', 'gratitude'];

    function detectEmotions(text) {
        const normalised = normalise(text);
        const found = [];
        Object.entries(EMOTIONS).forEach(([name, emotion]) => {
            let hits = 0;
            emotion.terms.forEach((term) => {
                const index = findTerm(normalised, term);
                if (index !== -1 && !negated(normalised, index)) hits += term.includes(' ') ? 2 : 1;
            });
            if (hits) found.push({ name, hits });
        });
        return found
            .sort((a, b) => b.hits - a.hits || SPECIFICITY.indexOf(a.name) - SPECIFICITY.indexOf(b.name))
            .map((item) => item.name);
    }

    function emotionFromMood(mood) {
        if (!mood) return null;
        const key = String(mood).toLowerCase().trim();
        if (MOOD_TO_EMOTION[key]) return MOOD_TO_EMOTION[key];
        return detectEmotions(key)[0] || null;
    }

    // -----------------------------------------------------------------------
    // Content keywords: the nouns of someone's situation ("exam", "boss")
    // -----------------------------------------------------------------------

    const STOP_WORDS = new Set((
        'a about above after again all also am an and any are as at be because been before being below between both but by can ' +
        'could did do does doing down during each even ever every few for from further get gets getting got had has have having he ' +
        'her here hers him his how i if im in into is it its ive just know like lot made make me might more most much my myself ' +
        'need no nor not now of off on once only or other our out over own really same say she should so some still such ' +
        'than that thats the their them then there these they thing things think this those through to today too under until up ' +
        'us very want was we were what when where which while who whom why will with would yes yet you your feel feeling feels ' +
        'felt going gonna honestly literally always anymore everything nothing something someone anyone people time day days ' +
        'way ok okay please help mujhe mujhko mera meri mere hai hain ho raha rahi rahe tha thi bahut bhi kya kyun ki ka ke ' +
        'मुझे मेरा मेरी मेरे है हैं हो रहा रही रहे था थी बहुत भी क्या क्यों की का के को में से पर और यह वह'
    ).split(' '));

    function stem(word) {
        return word
            .replace(/(ings|ing|edly|ed|ies|es|s|ly|ness|ful)$/u, '')
            .replace(/(.)\1$/u, '$1');
    }

    function contentKeywords(text) {
        return [...new Set(normalise(text).trim().split(' ').filter((word) => word.length > 3 && !STOP_WORDS.has(word)))];
    }

    // -----------------------------------------------------------------------
    // Verse scoring
    // -----------------------------------------------------------------------

    const NARRATIVE = /^(sanjaya|dhritarashtra|duryodhana)\b/i;

    function isNarrative(verse) {
        return NARRATIVE.test(verse.meaning_en || '') || (verse.chapter === 1 && Number(verse.verse || verse.verse_number) < 28);
    }

    const lower = (list) => (Array.isArray(list) ? list.map((item) => String(item).toLowerCase()) : []);

    const TIME_CONCEPTS = {
        morning: ['action', 'clarity', 'duty', 'knowledge', 'karma'],
        afternoon: ['steadiness', 'karma', 'action', 'work'],
        night: ['peace', 'surrender', 'meditation', 'devotion', 'calm']
    };

    function conceptMatches(field, concept) {
        return field === concept || field.includes(concept) || (concept.length > 4 && concept.includes(field));
    }

    // Warmth. Someone who arrives hurting should meet a verse that holds them
    // (2.40 "no effort is lost"), not one that describes what to avoid
    // (18.34, rajasic resolve) or warns. Joy and peace need no such care.
    const WARM_TONES = ['reassuring', 'encouraging', 'promising', 'compassionate', 'hopeful', 'loving', 'protective', 'comforting',
        'empowering', 'assuring', 'validating', 'affectionate', 'joyful', 'peaceful', 'calm', 'intimate', 'accepting', 'guiding',
        'benevolent', 'motivational', 'self-assuring', 'uplifting', 'gentle', 'consoling', 'liberating', 'steady', 'elevating',
        'trusting', 'patient', 'serene', 'blissful', 'rewarding', 'radiant'];
    const COLD_TONES = ['warning', 'deluded', 'cautionary', 'stern', 'greedy', 'harsh', 'critical', 'painful', 'tragic', 'desperate',
        'fearful', 'regretful', 'confused', 'corrective', 'attached', 'outcome-focused', 'impossible by effort', 'grace dependent',
        // Arjuna's own terror before the cosmic form (11.23–31) mirrors fear; it does not answer it.
        'disturbed', 'panicked', 'unstable', 'disoriented', 'begging', 'terrified', 'trembling'];
    const COLD_THEMES = ['rajasic', 'tamasic', 'demonic', 'asuric', 'futility', 'hell'];
    const NO_WARMTH_NEEDED = ['peace', 'gratitude'];

    function warmth(tones, themes, profile) {
        if (!profile.primary || NO_WARMTH_NEEDED.includes(profile.primary)) return 0;
        let delta = 0;
        if (tones.some((tone) => WARM_TONES.includes(tone))) delta += 10;
        if (tones.some((tone) => COLD_TONES.includes(tone))) delta -= 14;
        if (themes.some((theme) => COLD_THEMES.some((cold) => theme.includes(cold)))) delta -= 14;
        return delta;
    }

    function scoreVerse(verse, profile, helpsByChapter) {
        let score = verse.meaning_en ? 10 : 0;
        const tones = lower(verse.emotional_tone);
        const themes = lower(verse.core_theme);
        const situations = lower(verse.life_situations);
        const meaning = (verse.meaning_en || '').toLowerCase();

        profile.concepts.forEach(({ concept, weight }) => {
            if (tones.some((tone) => conceptMatches(tone, concept))) score += 12 * weight;
            if (situations.some((situation) => situation.includes(concept))) score += 10 * weight;
            if (themes.some((theme) => conceptMatches(theme, concept))) score += 8 * weight;
            if (concept.length > 3 && meaning.includes(concept)) score += 2 * weight;
        });

        // The person's own words, matched against what each verse is about.
        profile.keywords.forEach((keyword) => {
            const root = stem(keyword);
            if (root.length < 4) return;
            if (situations.some((situation) => situation.includes(root))) score += 7;
            if (themes.some((theme) => theme.includes(root))) score += 5;
            if (meaning.includes(root)) score += 2;
        });

        // Chapter relevance counts once, not once per tag.
        const helps = helpsByChapter.get(verse.chapter) || [];
        const chapterHits = profile.concepts.filter(({ concept }) => helps.some((h) => h.includes(concept) || concept.includes(h))).length;
        score += Math.min(chapterHits, 2) * 4;

        if (profile.timeOfDay && themes.some((theme) => TIME_CONCEPTS[profile.timeOfDay]?.some((t) => theme.includes(t)))) score += 2;
        if (verse.notification_short && verse.notification_short.en) score += 2;
        if (isNarrative(verse)) score -= 40;
        score += warmth(tones, themes, profile);

        return score;
    }

    function buildProfile({ text, mood, history = [], timeOfDay }) {
        const textEmotions = detectEmotions(text);
        // A follow-up like "how do I live this?" carries the feeling from before.
        const carried = textEmotions.length ? [] : detectEmotions(history.slice(-3).join(' '));
        const moodEmotion = emotionFromMood(mood);
        const emotions = [...new Set([...textEmotions, ...carried, ...(moodEmotion ? [moodEmotion] : [])])].slice(0, 3);

        const weights = new Map();
        const addConcepts = (name, weight) => {
            (EMOTIONS[name]?.concepts || []).forEach((concept) => weights.set(concept, Math.max(weights.get(concept) || 0, weight)));
        };
        textEmotions.forEach((name, index) => addConcepts(name, index === 0 ? 1 : 0.7));
        carried.forEach((name) => addConcepts(name, 0.6));
        if (moodEmotion) addConcepts(moodEmotion, text && textEmotions.length ? 0.5 : 1);

        // A free-text mood such as a chapter theme ("fear of death") is a concept too.
        if (mood && !MOOD_TO_EMOTION[String(mood).toLowerCase()]) {
            weights.set(String(mood).toLowerCase(), Math.max(weights.get(String(mood).toLowerCase()) || 0, 0.8));
        }

        return {
            emotions,
            primary: textEmotions[0] || carried[0] || moodEmotion || null,
            concepts: [...weights.entries()].map(([concept, weight]) => ({ concept, weight })),
            keywords: contentKeywords(text),
            timeOfDay
        };
    }

    function rankVerses(verses, chapters, profile) {
        const helpsByChapter = new Map((chapters || []).map((chapter) => [chapter.chapter, lower(chapter.helps_with)]));
        return verses
            .map((verse) => ({ verse, score: scoreVerse(verse, profile, helpsByChapter) }))
            .sort((a, b) => b.score - a.score);
    }

    // Choose among the strongest few, weighted towards the best, never
    // repeating what this person has recently been shown.
    function pickVerse(ranked, { exclude = [], random = Math.random } = {}) {
        const excluded = new Set(exclude);
        const pool = ranked.filter((item) => !excluded.has(item.verse.id));
        const candidates = (pool.length ? pool : ranked).slice(0, 12);
        if (!candidates.length) return null;
        const best = candidates[0].score;
        const floor = best > 0 ? best * 0.66 : best - 1;
        const shortlist = candidates.filter((item) => item.score >= floor).slice(0, 6);
        // Linear, softened weights: the best verse is likeliest, but every
        // strong match gets its turn over the days.
        const weights = shortlist.map((item) => Math.max(item.score - floor, 0) + 6);
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let roll = random() * total;
        for (let i = 0; i < shortlist.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return shortlist[i].verse;
        }
        return shortlist[0].verse;
    }

    // -----------------------------------------------------------------------
    // Composing the reply
    // -----------------------------------------------------------------------

    const ACKS = {
        // Built on the noun, never the adjective: "your search for purpose"
        // reads naturally where "feeling searching for your path" would not.
        en: [
            (e) => `Thank you for naming your ${e.noun}.`,
            (e) => `You can bring your ${e.noun} here, just as it is.`,
            (e) => `There is room here for your ${e.noun}.`,
            (e) => `I hear your ${e.noun} in what you wrote.`
        ],
        hi: [
            // Masculine nouns take their oblique form before a postposition (अकेलेपन के साथ).
            (e) => `आपके शब्दों में मुझे ${e.obl || e.noun} का आभास हो रहा है।`,
            (e) => `${e.noun} महसूस करना पूरी तरह से स्वाभाविक है।`,
            (e) => `अभी ${e.g === 'f' ? 'अपनी' : 'अपने'} ${e.obl || e.noun} के साथ रहना ठीक है।`,
            (e) => `${e.g === 'f' ? 'अपनी' : 'अपना'} ${e.noun} साझा करने के लिए धन्यवाद।`
        ]
    };

    const NEUTRAL_ACKS = {
        en: ['Thank you for bringing this here.', 'I am listening.', 'Thank you for saying what is on your heart.'],
        hi: ['इसे यहाँ लाने के लिए धन्यवाद।', 'मैं सुन रहा हूँ।', 'अपने मन की बात कहने के लिए धन्यवाद।']
    };

    // The verse is the answer; these lines only turn the reader toward it.
    const REFLECTIONS = {
        en: ['Here is what the Gita says.', 'The Gita begins with someone who felt deeply, as you do. Read this slowly.', 'The Gita speaks to this directly.', 'Read this slowly, and let it answer in its own time.'],
        hi: ['गीता इस पर यह कहती है।', 'गीता एक ऐसे व्यक्ति से शुरू होती है जो आपकी तरह गहराई से महसूस करता था। इसे धीरे-धीरे पढ़ें।', 'गीता इससे सीधे बात करती है।', 'इसे धीरे-धीरे पढ़ें, और इसे अपने समय में उत्तर देने दें।']
    };

    const GROUNDING = {
        en: ['Take one slow breath before you go on.', 'Nothing needs to be solved in this moment.', 'Feelings come and go, the Gita says (2.14). You are the one who stays.', 'You are more than what you feel right now.'],
        hi: ['आगे बढ़ने से पहले एक धीमी साँस लें।', 'इस पल में कुछ भी सुलझाना ज़रूरी नहीं।', 'गीता कहती है, भाव आते और जाते हैं (2.14)। आप वह हैं जो बना रहता है।', 'आप अभी जो महसूस कर रहे हैं, उससे कहीं अधिक हैं।']
    };

    const MIRROR = {
        en: ["It sounds like there's a lot happening right now.", 'That can feel very heavy.', 'I hear the weight in your words.', 'Sometimes just naming it helps.', "You're carrying quite a bit."],
        hi: ['ऐसा लगता है कि इस समय बहुत कुछ हो रहा है।', 'यह बहुत भारी महसूस हो सकता है।', 'मैं आपके शब्दों में वजन सुन सकता हूँ।', 'कभी-कभी इसे नाम देना ही मदद करता है।', 'आप बहुत कुछ ढो रहे हैं।']
    };

    const ANOTHER = {
        en: ['Here is another light on the same moment.', 'Another verse, for the same heart.', 'Let this one sit beside the last.'],
        hi: ['इसी क्षण के लिए एक और प्रकाश।', 'उसी मन के लिए एक और श्लोक।', 'इसे पिछले श्लोक के साथ रहने दें।']
    };

    const UNHEARD = {
        en: "I may not have the right words for this — but you don't have to find them alone.",
        hi: 'हो सकता है मेरे पास इसके लिए सही शब्द न हों — पर आपको उन्हें अकेले नहीं ढूँढना है।'
    };

    const MIRROR_TERMS = ['drowning', 'cant take', 'cannot take', 'too much', 'breaking down', 'falling apart', 'collapsing', 'cant breathe', 'सह नहीं', 'टूट रहा', 'टूट रही'];

    function shouldMirror(text) {
        const normalised = normalise(text);
        return MIRROR_TERMS.some((term) => has(normalised, term));
    }

    // -----------------------------------------------------------------------
    // Guidance — the verse, carried into plain words and one small step.
    // Every bridge is anchored in a teaching the Gita actually gives.
    //   practice: which of the app's practices fits the step
    // -----------------------------------------------------------------------

    const GUIDANCE = {
        anxiety: {
            practice: 'breaths',
            en: {
                bridge: 'Anxiety lives in the future, in outcomes you cannot hold yet. The Gita keeps bringing you back to what is here — this breath, this task, this step. You are asked to stand steady in the storm, like the ocean that stays itself as rivers rush in (2.70).',
                step: 'Name one thing that is truly in your hands today, and do only that.'
            },
            hi: {
                bridge: 'चिंता भविष्य में रहती है — उन परिणामों में जो अभी आपके हाथ में नहीं। गीता बार-बार आपको यहाँ लौटाती है — इस सांस, इस काम, इस कदम पर। जैसे नदियाँ समुद्र में गिरती हैं और समुद्र अडिग रहता है (2.70), वैसे ही आप भी स्थिर रह सकते हैं।',
                step: 'आज जो सचमुच आपके हाथ में है, ऐसी एक बात चुनें — और केवल वही करें।'
            }
        },
        fear: {
            practice: 'breaths',
            en: {
                bridge: 'Fear says you are alone with what is coming. The Gita answers that what you truly are cannot be cut, burned or broken (2.23) — and that you are not facing this unprotected. "Do not fear" is its closing promise (18.66).',
                step: 'Say the fear out loud, in one plain sentence. Fear named is fear made smaller.'
            },
            hi: {
                bridge: 'डर कहता है कि आने वाले के सामने आप अकेले हैं। गीता उत्तर देती है कि आपका सच्चा स्वरूप न कटता है, न जलता है, न टूटता है (2.23) — और आप असुरक्षित नहीं हैं। "मा शुचः — शोक मत करो" उसका अंतिम आश्वासन है (18.66)।',
                step: 'अपने डर को एक सीधे वाक्य में ज़ोर से कहें। जिसे नाम मिल जाए, वह डर छोटा हो जाता है।'
            }
        },
        stress: {
            practice: 'breaths',
            en: {
                bridge: 'When everything feels urgent, the Gita separates two things: the work, which is yours, and the weight of the result, which never was (2.47). Put down the second. Carry only the first, one piece at a time.',
                step: 'Write the three things pressing on you. Circle one. Let the other two wait an hour.'
            },
            hi: {
                bridge: 'जब सब कुछ ज़रूरी लगने लगे, गीता दो चीज़ें अलग करती है: कर्म, जो आपका है, और परिणाम का बोझ, जो कभी आपका नहीं था (2.47)। दूसरे को नीचे रख दें। केवल पहले को उठाएँ — एक-एक करके।',
                step: 'जो तीन बातें आप पर दबाव डाल रही हैं, उन्हें लिखें। एक चुनें। बाकी दो को एक घंटा इंतज़ार करने दें।'
            }
        },
        anger: {
            practice: 'dhyana',
            en: {
                bridge: 'The Gita traces anger to its root: we dwell on something, become attached, want it — and when the wanting is blocked, anger rises and clouds judgment (2.62–63). Seeing the chain is how you step off it before it carries you.',
                step: 'Before you reply to anyone, wait for one slow breath. Let the first words go unsaid.'
            },
            hi: {
                bridge: 'गीता क्रोध की जड़ तक जाती है: हम किसी बात का चिंतन करते हैं, उससे आसक्ति होती है, कामना जागती है — और जब कामना रुकती है, क्रोध उठता है और विवेक धुंधला हो जाता है (2.62–63)। इस श्रृंखला को देख लेना ही उससे उतर जाने का रास्ता है।',
                step: 'किसी को उत्तर देने से पहले एक धीमी सांस लें। पहले शब्दों को अनकहा रहने दें।'
            }
        },
        sadness: {
            practice: 'journal',
            en: {
                bridge: 'The Gita does not rush you out of sorrow. It reminds you that feelings come and go like winter and summer — they arrive, and they pass (2.14). This heaviness is a season, not the whole of you.',
                step: 'Do one gentle thing for your body — water, sunlight, a short walk — and write one line about how it felt.'
            },
            hi: {
                bridge: 'गीता आपको दुख से जल्दी बाहर नहीं धकेलती। वह याद दिलाती है कि भावनाएँ सर्दी-गर्मी की तरह आती-जाती हैं (2.14)। यह भारीपन एक ऋतु है, आपका पूरा अस्तित्व नहीं।',
                step: 'अपने शरीर के लिए एक कोमल काम करें — पानी, धूप, थोड़ी सैर — और उसके बारे में एक पंक्ति लिखें।'
            }
        },
        grief: {
            practice: 'journal',
            en: {
                bridge: 'The Gita’s very first teaching was spoken to a man overwhelmed by grief. Its comfort: the one you love was never only a body. What they truly are was not born and does not die (2.20) — and your love for them does not end either.',
                step: 'Write down one memory of them, as fully as you can. Let it be kept.'
            },
            hi: {
                bridge: 'गीता का पहला उपदेश शोक में डूबे एक व्यक्ति को दिया गया था। उसका सांत्वना-वचन: जिसे आप प्रेम करते हैं, वह केवल शरीर नहीं था। उसका सच्चा स्वरूप न जन्म लेता है, न मरता है (2.20) — और आपका प्रेम भी समाप्त नहीं होता।',
                step: 'उनकी एक स्मृति जितनी पूरी हो सके, लिख लें। उसे सहेज कर रखें।'
            }
        },
        loneliness: {
            practice: 'japa',
            en: {
                bridge: 'The Gita says that whoever sees the divine in all things is never lost to it, and it is never lost to them (6.30). However alone this feels, you are not unseen — and you are not as separate as the loneliness says.',
                step: 'Reach out to one person with a short, honest message. It need not be about how you feel.'
            },
            hi: {
                bridge: 'गीता कहती है कि जो सबमें ईश्वर को देखता है, वह उससे कभी दूर नहीं होता, और ईश्वर उससे कभी दूर नहीं होता (6.30)। यह अकेलापन जितना भी गहरा लगे, आप अनदेखे नहीं हैं।',
                step: 'किसी एक व्यक्ति को छोटा-सा सच्चा संदेश भेजें। ज़रूरी नहीं कि वह आपकी भावनाओं के बारे में हो।'
            }
        },
        confusion: {
            practice: 'journal',
            en: {
                bridge: 'Arjuna was so confused he put down his bow and asked to be taught (2.7). The Gita’s way through is not a perfect answer but your own dharma — it is better to walk your own path imperfectly than another’s well (3.35).',
                step: 'Write the two choices side by side. Under each, write who you would be becoming. Then ask: which one is mine?'
            },
            hi: {
                bridge: 'अर्जुन इतने उलझन में थे कि उन्होंने धनुष रख दिया और शिक्षा माँगी (2.7)। गीता का रास्ता कोई पूर्ण उत्तर नहीं, बल्कि आपका अपना धर्म है — अपना मार्ग अधूरा चलना भी, दूसरे का मार्ग अच्छी तरह चलने से श्रेष्ठ है (3.35)।',
                step: 'दोनों विकल्प आमने-सामने लिखें। हर एक के नीचे लिखें कि उससे आप क्या बनेंगे। फिर पूछें: इनमें से मेरा कौन-सा है?'
            }
        },
        guilt: {
            practice: 'journal',
            en: {
                bridge: 'The Gita never says you are your mistakes. It says even the heaviest past can be crossed in the boat of understanding (4.36). Guilt is useful only as far as it turns you — learn, set right what you can, and begin again.',
                step: 'Write one thing you can set right, and the smallest first step toward it.'
            },
            hi: {
                bridge: 'गीता कभी नहीं कहती कि आप अपनी गलतियाँ हैं। वह कहती है कि सबसे भारी अतीत भी ज्ञान की नौका से पार किया जा सकता है (4.36)। अपराध-बोध तभी उपयोगी है जब वह आपको मोड़ दे — सीखें, जो सुधर सके उसे सुधारें, और फिर से शुरू करें।',
                step: 'एक बात लिखें जिसे आप सुधार सकते हैं, और उसकी ओर सबसे छोटा पहला कदम।'
            }
        },
        unworthiness: {
            practice: 'journal',
            en: {
                bridge: 'The Gita says your own mind can be your best friend or your worst enemy (6.5) — so lift yourself, never lower yourself. The voice saying you are not enough is a habit of the mind, not the truth about you.',
                step: 'Write one thing you did with care today, however small. Read it back slowly.'
            },
            hi: {
                bridge: 'गीता कहती है कि आपका अपना मन आपका सबसे अच्छा मित्र भी है और सबसे बड़ा शत्रु भी (6.5) — इसलिए स्वयं को उठाएँ, कभी गिराएँ नहीं। "तुम काफ़ी नहीं हो" कहने वाली आवाज़ मन की आदत है, आपका सच नहीं।',
                step: 'आज आपने जो एक काम ध्यान से किया, चाहे कितना छोटा हो, उसे लिखें। फिर धीरे से पढ़ें।'
            }
        },
        failure: {
            practice: 'sankalpa',
            en: {
                bridge: 'A result is an event, not a verdict on who you are. The Gita asks for full effort and open hands about the outcome (2.47), and promises that no sincere effort is ever wasted (2.40). Failing at something is not failing as someone.',
                step: 'Set one intention for your effort tomorrow — about how you will work, not what you will get.'
            },
            hi: {
                bridge: 'परिणाम एक घटना है, आपके बारे में कोई फ़ैसला नहीं। गीता पूरा प्रयास और परिणाम के प्रति खुले हाथ माँगती है (2.47), और वचन देती है कि कोई सच्चा प्रयास कभी व्यर्थ नहीं जाता (2.40)। किसी काम में असफल होना, व्यक्ति के रूप में असफल होना नहीं है।',
                step: 'कल के प्रयास के लिए एक संकल्प लें — इस बारे में कि आप कैसे काम करेंगे, न कि आपको क्या मिलेगा।'
            }
        },
        envy: {
            practice: 'japa',
            en: {
                bridge: 'Comparison makes someone else’s path the measure of yours. The Gita says your own dharma, even imperfectly lived, is better than another’s (3.35) — their story is not your assignment.',
                step: 'Write three things in your own life you would not trade. Let gratitude answer comparison.'
            },
            hi: {
                bridge: 'तुलना किसी और के मार्ग को आपके मार्ग का पैमाना बना देती है। गीता कहती है कि अपना धर्म, अधूरा जिया हुआ भी, दूसरे के धर्म से श्रेष्ठ है (3.35) — उनकी कहानी आपका काम नहीं।',
                step: 'अपने जीवन की तीन ऐसी बातें लिखें जिन्हें आप किसी से नहीं बदलेंगे। तुलना का उत्तर कृतज्ञता से दें।'
            }
        },
        heartbreak: {
            practice: 'breaths',
            en: {
                bridge: 'Love is not the problem — clinging is. The Gita teaches non-attachment, not coldness: to love fully while holding lightly, so a loss can wound you without destroying you. Joy and sorrow both pass (2.14); you remain.',
                step: 'Let yourself feel it for ten minutes — no fixing, no texting. Then do one kind thing for yourself.'
            },
            hi: {
                bridge: 'प्रेम समस्या नहीं है — पकड़ कर रखना है। गीता अनासक्ति सिखाती है, कठोरता नहीं: पूरे मन से प्रेम करना और हल्के हाथों से थामना, ताकि खोना घाव दे पर नष्ट न करे। सुख और दुख दोनों गुज़र जाते हैं (2.14); आप बने रहते हैं।',
                step: 'दस मिनट इसे महसूस होने दें — न कुछ सुधारें, न किसी को संदेश भेजें। फिर अपने लिए एक दयालु काम करें।'
            }
        },
        purpose: {
            practice: 'sankalpa',
            en: {
                bridge: 'The Gita’s answer to "what should I do with my life" is svadharma — work that fits your nature, offered without craving its fruit (3.35, 18.47). Purpose is not found all at once; it is uncovered by doing your part well.',
                step: 'Write down what you lose track of time doing, and one way to give it to someone this week.'
            },
            hi: {
                bridge: 'गीता का उत्तर "मैं अपने जीवन का क्या करूँ" के लिए स्वधर्म है — वह कर्म जो आपके स्वभाव के अनुरूप हो, फल की लालसा के बिना अर्पित (3.35, 18.47)। उद्देश्य एक साथ नहीं मिलता; अपना काम अच्छी तरह करते-करते प्रकट होता है।',
                step: 'लिखें कि किस काम में आप समय भूल जाते हैं, और इस सप्ताह उसे किसी को देने का एक तरीका।'
            }
        },
        craving: {
            practice: 'breaths',
            en: {
                bridge: 'Arjuna said the mind is as restless as the wind (6.34). Krishna did not disagree — he said it is trained through steady practice and gentle letting go (6.35). You do not have to win the whole war today; only this one urge.',
                step: 'When the urge comes, wait for one full 4-7-8 breath before you decide anything.'
            },
            hi: {
                bridge: 'अर्जुन ने कहा कि मन वायु की तरह चंचल है (6.34)। कृष्ण ने इनकार नहीं किया — उन्होंने कहा कि उसे अभ्यास और वैराग्य से साधा जाता है (6.35)। आज पूरा युद्ध जीतना ज़रूरी नहीं; केवल यह एक इच्छा।',
                step: 'जब इच्छा उठे, कोई भी निर्णय लेने से पहले एक पूरी 4-7-8 सांस लें।'
            }
        },
        peace: {
            practice: 'dhyana',
            en: {
                bridge: 'Peace, the Gita says, is not something you acquire but something you uncover. When wanting grows quiet, peace is already there (2.71) — like a lamp in a windless place that does not flicker (6.19).',
                step: 'Sit for five minutes with nothing to do. When thoughts come, let them pass like clouds.'
            },
            hi: {
                bridge: 'गीता कहती है कि शांति पाई नहीं जाती, प्रकट होती है। जब कामनाएँ शांत होती हैं, शांति पहले से वहीं होती है (2.71) — जैसे वायुरहित स्थान में दीपक की लौ नहीं काँपती (6.19)।',
                step: 'पाँच मिनट बिना कुछ किए बैठें। विचार आएँ तो उन्हें बादलों की तरह गुज़र जाने दें।'
            }
        },
        gratitude: {
            practice: 'japa',
            en: {
                bridge: 'Gratitude is bhakti in its simplest form — noticing that what you have was given. The Gita says even a leaf, a flower, a little water, offered with love, is received (9.26).',
                step: 'Offer this feeling back: thank one person by name today, in words they can hear.'
            },
            hi: {
                bridge: 'कृतज्ञता भक्ति का सबसे सरल रूप है — यह देखना कि जो आपके पास है, वह दिया गया है। गीता कहती है कि प्रेम से अर्पित एक पत्ता, एक फूल, थोड़ा-सा जल भी स्वीकार होता है (9.26)।',
                step: 'इस भावना को लौटाएँ: आज किसी एक व्यक्ति का नाम लेकर, उसे सुनाई देने वाले शब्दों में धन्यवाद दें।'
            }
        }
    };

    const NEUTRAL_GUIDANCE = {
        practice: 'journal',
        en: {
            bridge: 'Read it slowly, twice. Ask: where in my life is this already true — and where am I being asked to live it?',
            step: 'Write one sentence about what this verse asks of you today.'
        },
        hi: {
            bridge: 'इसे धीरे-धीरे दो बार पढ़ें। पूछें: मेरे जीवन में यह कहाँ पहले से सच है — और कहाँ मुझसे इसे जीने को कहा जा रहा है?',
            step: 'एक वाक्य लिखें कि यह श्लोक आज आपसे क्या माँगता है।'
        }
    };

    // The verse's own life-situation tag that best matches this person.
    function matchingSituation(verse, profile) {
        const situations = lower(verse.life_situations);
        if (!situations.length) return null;
        let best = null;
        let bestScore = 0;
        situations.forEach((situation) => {
            let score = 0;
            profile.concepts.forEach(({ concept, weight }) => {
                if (situation.includes(concept)) score += 2 * weight;
            });
            profile.keywords.forEach((keyword) => {
                const root = stem(keyword);
                if (root.length > 3 && situation.includes(root)) score += 3;
            });
            if (score > bestScore) {
                bestScore = score;
                best = situation;
            }
        });
        return best;
    }

    // -----------------------------------------------------------------------
    // Āśīrvāda — every answer ends with a blessing. The Gita meets despair
    // with a smile (2.10); a reply should leave the reader lighter.
    // -----------------------------------------------------------------------

    const BLESSINGS = {
        anxiety: { en: 'May the next step be enough, and may you take it gently.', hi: 'अगला एक क़दम ही काफ़ी हो, और आप उसे कोमलता से उठाएँ।' },
        fear: { en: 'May you remember what in you cannot be harmed — and walk on unafraid.', hi: 'आपको याद रहे कि आपके भीतर जो है, उसे कोई चोट नहीं पहुँचा सकता — और आप निर्भय आगे बढ़ें।' },
        stress: { en: 'May you set down what is not yours to carry, and do the rest with a steady heart.', hi: 'जो आपका बोझ नहीं, वह उतर जाए, और बाक़ी आप स्थिर मन से करें।' },
        anger: { en: 'May the fire in you become light, not smoke.', hi: 'आपके भीतर की आग धुआँ नहीं, प्रकाश बने।' },
        sadness: { en: 'May this heaviness soften, and may gentleness find you today.', hi: 'यह भारीपन हल्का हो, और आज कोमलता आप तक पहुँचे।' },
        grief: { en: 'May love outlast the loss, and may you feel held.', hi: 'प्रेम इस खोने से बड़ा रहे, और आप स्वयं को थामा हुआ महसूस करें।' },
        loneliness: { en: 'May you know you are seen — by the One who dwells in every heart (18.61).', hi: 'आप जानें कि आपको देखा जा रहा है — उसके द्वारा जो हर हृदय में बसता है (18.61)।' },
        confusion: { en: 'May the way grow clear, one honest step at a time.', hi: 'रास्ता साफ़ हो — एक-एक सच्चे क़दम से।' },
        guilt: { en: 'May you be as kind to yourself as you would be to a friend. Even the deepest wrong can be crossed (4.36).', hi: 'आप स्वयं के प्रति वैसे ही दयालु हों जैसे किसी मित्र के प्रति। सबसे गहरी भूल भी पार की जा सकती है (4.36)।' },
        unworthiness: { en: 'May you see yourself as the Gita sees you — dear, and enough.', hi: 'आप स्वयं को वैसे देखें जैसे गीता आपको देखती है — प्रिय, और पर्याप्त।' },
        failure: { en: 'May you rise again, freer for having tried. No effort on this path is ever lost (2.40).', hi: 'आप फिर उठें, प्रयास करके और मुक्त होकर। इस मार्ग पर कोई प्रयास व्यर्थ नहीं जाता (2.40)।' },
        envy: { en: 'May your own path feel like enough — it is the one made for you (3.35).', hi: 'आपका अपना मार्ग आपको पर्याप्त लगे — वही आपके लिए बना है (3.35)।' },
        heartbreak: { en: 'May your heart mend wider than it broke.', hi: 'आपका हृदय जितना टूटा, उससे अधिक खुलकर जुड़े।' },
        purpose: { en: 'May you find the work that is truly yours, and give it your whole heart.', hi: 'आपको वह काम मिले जो सचमुच आपका है, और आप उसे पूरा हृदय दें।' },
        craving: { en: 'May you find the joy that needs nothing from outside (5.21).', hi: 'आपको वह आनंद मिले जिसे बाहर से कुछ नहीं चाहिए (5.21)।' },
        peace: { en: 'May this stillness stay with you, like a lamp that does not flicker.', hi: 'यह स्थिरता आपके साथ रहे, उस दीये की तरह जो काँपता नहीं।' },
        gratitude: { en: 'May your joy become an offering, and return to you many times over.', hi: 'आपका आनंद एक अर्पण बने, और कई गुना होकर लौटे।' }
    };

    const NEUTRAL_BLESSING = { en: 'May you leave a little lighter than you came.', hi: 'आप जितने आए थे, उससे थोड़े हल्के होकर जाएँ।' };

    function guidanceFor(verse, profile, lang) {
        const entry = (profile.primary && GUIDANCE[profile.primary]) || NEUTRAL_GUIDANCE;
        const simple = verse.notification_short && (verse.notification_short[lang] || verse.notification_short.en);
        const situation = lang === 'en' ? matchingSituation(verse, profile) : null;
        return {
            simple: simple || null,
            situation,
            bridge: entry[lang].bridge,
            step: entry[lang].step,
            practice: entry.practice,
            blessing: ((profile.primary && BLESSINGS[profile.primary]) || NEUTRAL_BLESSING)[lang],
            emotion: profile.primary
        };
    }

    const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

    function acknowledge(profile, lang, random) {
        const emotion = profile.primary && EMOTIONS[profile.primary];
        if (!emotion) return pick(NEUTRAL_ACKS[lang], random);
        return pick(ACKS[lang], random)(emotion[lang]);
    }

    /**
     * @param {{ text?: string, mood?: string, settings?: object, history?: string[], exclude?: string[] }} input
     * @param {{ verses: object[], chapters: object[], timeOfDay?: string, random?: () => number, offline?: boolean }} corpus
     */
    function respond(input, corpus) {
        const { text = null, mood = null, settings = {}, history = [], exclude = [], another = false } = input || {};
        const { verses = [], chapters = [], timeOfDay = null, random = Math.random, offline = false } = corpus || {};
        const lang = settings.language === 'hi' ? 'hi' : 'en';
        const depth = settings.depth || 'standard';
        const extra = offline ? { offline: true } : {};

        if (detectCrisis(text) || (!text && detectCrisis(mood))) {
            return { message: CRISIS_RESPONSE[lang], verse: null, context: { crisis_detected: true, ...extra } };
        }

        if (text && shouldMirror(text)) {
            return {
                message: `${pick(MIRROR[lang], random)}\n\n${pick(GROUNDING[lang], random)}`,
                verse: null,
                context: { mirrored: true, ...extra }
            };
        }

        const profile = buildProfile({ text, mood, history, timeOfDay });
        const verse = pickVerse(rankVerses(verses, chapters, profile), { exclude, random });
        if (!verse) {
            return {
                message: lang === 'hi' ? 'क्षमा करें, अभी श्लोक तक नहीं पहुँच पा रहे। थोड़ी देर में फिर कोशिश करें।' : 'The verses are out of reach just now. Please try again in a moment.',
                verse: null,
                context: { ...extra }
            };
        }

        const verseText = (lang === 'hi' ? verse.meaning_hi : verse.meaning_en) || verse.meaning_en || verse.meaning_hi;
        const context = {
            emotion: profile.primary,
            emotions: profile.emotions,
            engine: ENGINE_VERSION,
            ...extra
        };

        if (settings.silentMode) {
            return { message: `"${verseText}"`, verse, context: { ...context, silent_mode: true } };
        }

        const heard = Boolean(profile.primary || profile.keywords.length || mood);
        const ack = another
            ? pick(ANOTHER[lang], random)
            : heard ? acknowledge(profile, lang, random) : UNHEARD[lang];
        const ground = pick(GROUNDING[lang], random);
        const guidance = guidanceFor(verse, profile, lang);

        let message;
        if (depth === 'brief') {
            message = `${ack}\n\n"${verseText}"`;
            guidance.bridge = null;
        } else if (depth === 'deep') {
            const invitation = lang === 'hi' ? 'इस विचार के साथ कुछ पल बैठें।' : 'Sit with this thought for a moment.';
            message = [`${ack} ${pick(REFLECTIONS[lang], random)}`, `"${verseText}"`, `${ground} ${invitation}`].join('\n\n');
        } else {
            message = [`${ack} ${pick(REFLECTIONS[lang], random)}`, `"${verseText}"`, ground].join('\n\n');
        }

        return { message, verse, guidance, context: { ...context, self_limited: !heard || undefined } };
    }

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------

    function parseVerseRef(query) {
        if (!query) return null;
        const cleaned = String(query).trim().toLowerCase().replace(/^(bg|gita|bhagavad\s*gita|ch(apter)?\.?)\s*/, '');
        const match = cleaned.match(/^(\d{1,2})\s*(?:[.:_,\-/]|\s)\s*(?:v(?:erse)?\.?\s*)?(\d{1,3})$/);
        if (!match) return null;
        const chapter = Number(match[1]);
        const verse = Number(match[2]);
        return chapter >= 1 && chapter <= 18 && verse >= 1 ? `${chapter}_${verse}` : null;
    }

    const includesText = (value, query) => typeof value === 'string' && value.toLowerCase().includes(query);
    const anyIncludes = (list, query) => Array.isArray(list) && list.some((item) => includesText(item, query));

    function searchScore(verse, query) {
        let score = 0;
        if (anyIncludes(verse.core_theme, query)) score += 6;
        if (anyIncludes(verse.emotional_tone, query)) score += 5;
        if (anyIncludes(verse.life_situations, query)) score += 4;
        if (includesText(verse.meaning_en, query)) score += 3;
        if (includesText(verse.meaning_hi, query) || includesText(verse.simple, query) || includesText(verse.iast, query)
            || (typeof verse.sanskrit === 'string' && verse.sanskrit.includes(query))) score += 1;
        return score;
    }

    function searchVerses(verses, rawQuery) {
        const query = String(rawQuery || '').trim().toLowerCase();
        if (!query) return { match: 'none', results: [] };
        const ref = parseVerseRef(query);
        if (ref) {
            const verse = verses.find((item) => item.id === ref);
            return { match: 'reference', results: verse ? [verse] : [] };
        }
        const results = verses
            .map((verse, index) => ({ verse, index, score: searchScore(verse, query) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map((item) => item.verse);
        return { match: 'text', results };
    }

    // -----------------------------------------------------------------------
    // Daily verse
    //
    // Walks a curated pool (verses with a one-line essence, never narration)
    // with a stride coprime to its size, so every verse appears exactly once
    // before any repeats and neighbouring days land far apart.
    // -----------------------------------------------------------------------

    const DAILY_STRIDE = 7919; // prime, larger than the corpus — always coprime to the pool size

    function isValidDate(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    }

    function dailyVerse(verses, date) {
        const pool = verses.filter((verse) => verse.notification_short && verse.notification_short.en && !isNarrative(verse));
        const source = pool.length ? pool : verses;
        if (!source.length) return null;
        const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
        const index = (((day * DAILY_STRIDE) % source.length) + source.length) % source.length;
        return source[index];
    }

    return {
        ENGINE_VERSION,
        CRISIS_TERMS,
        BLESSINGS,
        EMOTIONS,
        normalise,
        detectCrisis,
        detectEmotions,
        emotionFromMood,
        buildProfile,
        rankVerses,
        pickVerse,
        respond,
        isNarrative,
        parseVerseRef,
        searchVerses,
        searchScore,
        dailyVerse,
        isValidDate
    };
});
