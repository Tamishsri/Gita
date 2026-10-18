/*
 * Sakha — Wisdom Engine
 *
 * The single source of truth for how the sanctuary listens and answers:
 * crisis detection; understand(), which reads a message the way a friend
 * would (feelings and how strongly, whose they are, then or now, what is
 * being asked — in English, Hindi and Hinglish, typos and emoji included);
 * verse selection, search, and the daily verse.
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

    const ENGINE_VERSION = '6.0.0';

    // -----------------------------------------------------------------------
    // Text normalisation
    // -----------------------------------------------------------------------

    // Keep letters, combining marks (Devanagari matras) and digits. Sentence
    // punctuation becomes a "|" clause marker (so negation never leaks across
    // clauses); everything else becomes a space. Stretched words ("sooo
    // saaad") fold back to their letters. Padded so phrases match on word edges.
    function normalise(text) {
        if (!text || typeof text !== 'string') return ' ';
        const cleaned = text
            .toLowerCase()
            .replace(/(\p{L})\1{2,}/gu, '$1')
            .replace(/[’`]/g, "'")
            // "I'll" is "I will", never "ill"; "won't" is a "not".
            .replace(/\b(i|you|we|they|he|she|it|that|this|things|everything)'ll\b/g, '$1 will')
            .replace(/\bwon't\b/g, 'will not')
            .replace(/[‌‍]/g, '')
            .replace(/[.,;:!?।॥]+/g, ' | ')
            .replace(/[^\p{L}\p{M}\p{N}'|]+/gu, ' ')
            .replace(/'/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word) => SHORTHAND[word] ?? word)
            .filter(Boolean)
            .join(' ');
        return ` ${cleaned} `;
    }

    // How people actually type: texting shorthand and the many spellings of
    // Hinglish. Folded to one form so "jeena nhi chahta" is heard exactly like
    // "jeena nahi chahta" — by the crisis check first of all.
    const SHORTHAND = {
        u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', idk: 'i dont know', rn: 'right now',
        bc: 'because', cuz: 'because', coz: 'because', bcoz: 'because', bcz: 'because', tbh: 'honestly', ngl: 'honestly',
        gf: 'girlfriend', bf: 'boyfriend', bff: 'friend', mom: 'mother', mum: 'mother', mommy: 'mother', mummy: 'mother',
        mumma: 'mother', maa: 'mother', moms: 'mother', mums: 'mother', dad: 'father', daddy: 'father', papa: 'father',
        dads: 'father', bro: 'brother', sis: 'sister', mommys: 'mother',
        nhi: 'nahi', nahin: 'nahi', nai: 'nahi', nhin: 'nahi', kyu: 'kyun', kyon: 'kyun', kyoon: 'kyun',
        bht: 'bahut', bohot: 'bahut', boht: 'bahut', bhot: 'bahut', bhut: 'bahut', bahot: 'bahut',
        h: 'hai', hu: 'hoon', hun: 'hoon', hoo: 'hoon', mai: 'main', kr: 'kar', krna: 'karna', krta: 'karta', krti: 'karti',
        rha: 'raha', rhi: 'rahi', rhe: 'rahe', gya: 'gaya', gyi: 'gayi', gye: 'gaye', pta: 'pata', skta: 'sakta',
        skti: 'sakti', kch: 'kuch', kuchh: 'kuch', sb: 'sab', jb: 'jab', tb: 'tab', kb: 'kab', yr: 'yaar', yrr: 'yaar'
    };

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
        'unalive', 'end everything', 'give up on life', 'tired of living', 'tired of life', 'done with life', 'done with living',
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
                'tension', 'tense', 'chinta', 'ghabrahat', 'bechain*', 'pareshan*', 'replay*', 'cant stop thinking', 'keep thinking about', 'what if', 'preshan*', 'dara hua', 'dari hui', 'mind wont shut up',
                'mind wont stop', 'cant switch off', 'racing thoughts', 'thoughts wont stop', 'mind is racing', 'cant turn off my mind', 'चिंता', 'चिंतित', 'घबराहट', 'बेचैन*', 'परेशान*'],
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
            terms: ['stress*', 'pressure', 'overwhelm*', 'forcing me', 'force kar*', 'pressurising me', 'pressurizing me', 'dabav', 'thak gaya', 'thak gayi', 'burnout', 'burnt out', 'burned out', 'workload', 'deadline*', 'too much',
                'exhausted', 'drained', 'tired', 'thak*', 'done with everything', 'so done', 'had enough', 'fed up', 'rough week', 'tough week',
                'hectic', 'so much to do', 'तनाव', 'दबाव', 'थक*',
                'थकान', 'बोझ'],
            concepts: ['stress', 'managing stress', 'handling pressure', 'burnout', 'avoiding burnout', 'doing difficult tasks', 'balance', 'equanimity', 'detached action', 'steady', 'surrender', 'emotional overwhelm'],
            en: { adj: 'overwhelmed', noun: 'stress' },
            hi: { noun: 'तनाव', g: 'm' }
        },
        anger: {
            terms: ['angry', 'anger', 'furious', 'rage', 'mad at', 'irritat*', 'frustrat*', 'annoyed', 'resent*', 'hate', 'humiliat*',
                'gussa', 'gussa*', 'naraz', 'krodh*', 'pissed', 'fed up with', 'sick of everyone', 'done with everyone', 'sick and tired of',
                'yelled at me', 'shouted at me', 'screamed at me', 'insulted me', 'disrespected me', 'disrespect*', 'chillaya', 'chillata',
                'chillati', 'chilla rahe', 'डांटा', 'डाँटा', 'चिल्ला*',
                'गुस्सा', 'गुस्से', 'ग़ुस्सा', 'ग़ुस्से', 'क्रोध*', 'नाराज़*', 'नाराज*', 'चिढ़*'],
            concepts: ['anger', 'managing anger', 'self-control', 'self control', 'battling inner demons', 'mastering your thoughts', 'calm', 'forgiveness', 'desire', 'patience', 'tolerance', 'not disturbed by others'],
            en: { adj: 'angry', noun: 'anger' },
            hi: { noun: 'क्रोध', g: 'm' }
        },
        sadness: {
            terms: ['sad', 'sadness', 'depress*', 'unhappy', 'miserable', 'cry*', 'tears', 'hopeless*', 'heavy heart', 'feel down', 'feeling down',
                'not okay', 'not ok', 'not fine', 'not doing well', 'not good', 'feeling off', 'feel off', 'not myself', 'not feeling myself',
                'feel like disappearing', 'want to disappear', 'want to vanish', 'rough day', 'bad day', 'hard day', 'low today', 'feeling low', 'keep pretending', 'pretending to be', 'bura laga', 'bura lag raha', 'bura lagta', 'it hurts', 'really hurt', 'so hurt', 'pretend to be fine', 'fake smile', 'hiding my pain', 'hide my pain', 'brave face', 'dil bhari', 'rona aa',
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
                'never listen to me', 'dont listen to me', 'doesnt listen to me', 'nobody listens', 'no one listens', 'dont understand me',
                'nobody understands', 'no one understands',
                'akela', 'akeli', 'akelapan', 'अकेला', 'अकेली', 'अकेलापन', 'अकेले'],
            concepts: ['never feeling alone', 'never lost', 'feeling loved', 'seeking a friend', 'friend', 'friendship', 'intimacy', 'divine presence', 'feeling god', 'being misunderstood', 'caring', 'affectionate', 'loving', 'intimate', 'reassured', 'security'],
            en: { adj: 'alone', noun: 'loneliness' },
            hi: { noun: 'अकेलापन', obl: 'अकेलेपन', g: 'm' }
        },
        confusion: {
            terms: ['confus*', 'unsure', 'uncertain', 'dilemma', 'cant decide', 'cannot decide', 'should i', 'what should', 'dont know what to do', 'what do i do',
                'which path', 'direction', 'doubt*', 'lost', 'samajh nahi', 'उलझन', 'भ्रम', 'असमंजस', 'दुविधा', 'समझ नहीं'],
            concepts: ['confusion', 'clarity', 'seeking clarity', 'guidance', 'seeking guidance', 'doubt', 'duty', 'swadharma', 'decision', 'knowledge', 'wisdom'],
            en: { adj: 'uncertain', noun: 'confusion' },
            hi: { noun: 'उलझन', g: 'f' }
        },
        guilt: {
            terms: ['guilt*', 'ashamed', 'shame', 'regret*', 'my fault', 'forgive me', 'messed up', 'i cheated', 'i lied', 'i betrayed', 'i hurt her', 'i hurt him', 'i hurt my',
                'cant forgive myself', 'cannot forgive myself', 'never forgive myself', 'maaf nahi', 'maaf nahin', 'khud ko maaf', 'apne aap ko maaf', 'galti ho gayi', 'galti ki', 'खुद को माफ़', 'ख़ुद को माफ़', 'माफ़ नहीं', 'पछतावा', 'शर्म*', 'गलती', 'ग़लती'],
            concepts: ['seeking forgiveness', 'forgiveness', 'overcoming a dark past', 'starting over', 'redemption', 'redemptive', 'freedom from sin', 'liberation from all sin', 'divine grace', 'purification'],
            en: { adj: 'weighed down by guilt', noun: 'guilt' },
            hi: { noun: 'पछतावा', obl: 'पछतावे', g: 'm' }
        },
        unworthiness: {
            terms: ['worthless', 'useless', 'not good enough', 'inadequate', 'insecure', 'self doubt', 'hate myself', 'smarter than me', 'better than me',
                'not as good as', 'not smart enough', 'a burden', 'burden to', 'nobody needs me', 'no one needs me', 'imposter', 'impostor', 'a disappointment',
                'comparing me', 'compare me', 'compares me', 'compared me', 'never good enough', 'khud se nafrat', 'apne aap se nafrat',
                'खुद से नफ़रत', 'ख़ुद से नफ़रत', 'खुद से नफरत',
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
            terms: ['breakup', 'broke up', 'break up', 'divorce*', 'betrayed me', 'heartbroken', 'heartbreak', 'my ex',
                'relationship', 'relationship ended', 'left me', 'cheated on me', 'cheating on me', 'doesnt love me', 'does not love me', 'one sided', 'unrequited', 'ghosted', 'rejected me', 'moved on from me', 'dhokha', 'धोखा', 'दिल टूट*', 'रिश्ता', 'रिश्ते'],
            // Comfort first: a broken heart needs holding before it hears "detachment".
            concepts: ['feeling hurt', 'emotional pain', 'comfort in loss', 'letting go of the past', 'starting a new chapter', 'learning to let go', 'letting go', 'enduring a hard time', 'staying strong in pain', 'impermanence', 'love'],
            en: { adj: 'heartbroken', noun: 'heartbreak' },
            hi: { noun: 'दर्द', g: 'm' }
        },
        purpose: {
            terms: ['purpose', 'calling', 'passion', 'follow my heart', 'what am i doing with my life', 'my purpose', 'purpose in life', 'what should i do with my life',
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
        lust: {
            // Kāma. Named plainly and met without shame — the Gita itself does (7.11, 3.37).
            terms: ['lust*', 'horny', 'sexual thought*', 'sexual urge*', 'sexual desire*', 'sexual fantas*', 'fantasiz*', 'fantasis*',
                'masturbat*', 'nofap', 'no fap', 'porn', 'sexual', 'cant stop thinking about her body', 'cant stop thinking about his body',
                'vasna', 'kaam vasna', 'hawas', 'वासना', 'हवस', 'काम वासना', 'कामवासना'],
            concepts: ['desire', 'kama', 'lust', 'sense control', 'self-control', 'mastering desire', 'overcoming cravings', 'higher purpose', 'discipline'],
            en: { adj: 'pulled by desire', noun: 'desire' },
            hi: { noun: 'वासना', g: 'f' }
        },
        emptiness: {
            terms: ['empty', 'emptiness', 'numb', 'feel nothing', 'feeling nothing', 'dead inside', 'hollow', 'nothing matters',
                'whats the point', 'what is the point', 'directionless', 'autopilot', 'going through the motions', 'meaningless',
                'khaali', 'khali', 'khalipan', 'sunapan', 'खाली', 'ख़ाली', 'खालीपन', 'ख़ालीपन', 'सूनापन'],
            concepts: ['purpose', 'meaning', 'soul', 'happiness within', 'inner joy', 'self-knowledge', 'eternal nature', 'divine presence'],
            en: { adj: 'empty', noun: 'emptiness' },
            hi: { noun: 'ख़ालीपन', obl: 'ख़ालीपन', g: 'm' }
        },
        pride: {
            terms: ['my ego', 'egoistic', 'egotistic', 'arrogant', 'arrogance', 'look down on', 'better than everyone', 'superior to',
                'too proud', 'ahankar', 'ahankaar', 'ghamand', 'घमंड', 'अहंकार', 'अभिमान'],
            concepts: ['humility', 'free from ego', 'ego', 'false ego', 'not the doer', 'surrender', 'equal vision'],
            en: { adj: 'caught in ego', noun: 'pride' },
            hi: { noun: 'अहंकार', obl: 'अहंकार', g: 'm' }
        },
        love: {
            terms: ['in love', 'love her', 'love him', 'falling for', 'fell for', 'crush on', 'butterflies', 'attracted to', 'my soulmate',
                'pyaar ho gaya', 'pyar ho gaya', 'pyaar hai', 'प्यार हो गया', 'प्रेम हो गया'],
            concepts: ['love', 'devotion', 'friendship', 'caring', 'affectionate', 'compassion', 'loving'],
            en: { adj: 'in love', noun: 'love' },
            hi: { noun: 'प्रेम', obl: 'प्रेम', g: 'm' }
        },
        devotion: {
            terms: ['closer to god', 'closer to krishna', 'love krishna', 'love for krishna', 'love god', 'bhakti', 'surrender to god',
                'feel god', 'feel krishna', 'chanting', 'kirtan', 'bhajan', 'devotion', 'भक्ति', 'भजन', 'कीर्तन'],
            concepts: ['devotion', 'bhakti', 'devotional', 'surrender', 'divine presence', 'loving', 'worshipful'],
            en: { adj: 'drawn to the Divine', noun: 'devotion' },
            hi: { noun: 'भक्ति', g: 'f' }
        },
        inertia: {
            terms: ['lazy', 'laziness', 'unmotivated', 'no motivation', 'not motivated', 'cant get up', 'cant get out of bed',
                'bored', 'boredom', 'so boring',
                'procrastinat*', 'wasting time', 'wasting my time', 'waste my time', 'cant start', 'cant focus on anything', 'aalas', 'aalsi', 'आलस', 'आलसी'],
            concepts: ['action', 'call to action', 'overcoming weakness', 'discipline', 'determination', 'inner strength', 'self-motivation'],
            en: { adj: 'stuck', noun: 'feeling of being stuck' },
            hi: { noun: 'आलस', obl: 'आलस', g: 'm' }
        },
        peace: {
            terms: ['peace', 'peaceful', 'calm', 'stillness', 'quiet', 'meditat*', 'serenity', 'shanti', 'sukoon', 'शांति', 'शान्ति', 'सुकून', 'ध्यान'],
            concepts: ['peace', 'meditation', 'stillness', 'serenity', 'finding peace', 'finding inner peace', 'calm', 'peaceful', 'meditative', 'samadhi'],
            en: { adj: 'drawn to stillness', noun: 'longing for peace' },
            hi: { noun: 'शांति की चाह', g: 'f' }
        },
        gratitude: {
            terms: ['grateful', 'gratitude', 'thankful', 'thank god', 'blessed', 'happy', 'joy*', 'khush', 'shukr*',
                'आभार*', 'कृतज्ञ*', 'खुश', 'प्रसन्न', 'धन्य', 'feel good', 'feeling good', 'feel great', 'feeling great', 'good day',
                'great day', 'mann accha', 'man accha', 'मन अच्छा', 'ख़ुश',
                // Good news arrives in many words.
                'i passed', 'passed my', 'passed the', 'got selected', 'got the job', 'got a job', 'got the offer', 'got promoted',
                'got into', 'got admission', 'cracked', 'i made it', 'got through', 'nailed it', 'cleared my', 'got the promotion', 'got a promotion', 'proud of myself', 'so excited', 'good news', 'celebrat*', 'i got engaged', 'we got engaged', 'im getting married', 'i am getting married', 'it worked',
                'finally did it', 'so relieved', 'relieved', 'pass ho gaya', 'pass ho gayi', 'select ho gaya', 'select ho gayi',
                'naukri lag gayi', 'खुशखबरी', 'पास हो गया', 'पास हो गई', 'चयन हो गया'],
            concepts: ['gratitude', 'joy', 'joyful', 'contentment', 'happiness', 'devotion', 'devotional', 'blissful', 'loving', 'worshipful'],
            en: { adj: 'grateful', noun: 'gratitude' },
            hi: { noun: 'कृतज्ञता', g: 'f' }
        }
    };

    // -----------------------------------------------------------------------
    // Life situations — what a feeling is about. A person rarely says "I feel
    // anxiety"; they say "my exams", "my father", "the loan". Each situation
    // brings its own verses, a human acknowledgement, and a label the person's
    // private memory can keep (never their words).
    // -----------------------------------------------------------------------

    const TOPICS = {
        study: {
            terms: ['exam*', 'test', 'tests', 'marks', 'grades', 'result*', 'college', 'school', 'study', 'studies', 'studying',
                'padhai', 'board exam*', 'boards', 'jee', 'neet', 'upsc', 'cat exam', 'semester', 'assignment*', 'university',
                'percentage', 'rank', 'iit', 'iim', 'nit', 'admission', 'entrance', 'driving test', 'परीक्षा', 'पढ़ाई', 'नतीजे', 'कॉलेज', 'स्कूल'],
            concepts: ['results', 'effort', 'duty without expectation', 'focus', 'discipline', 'steadiness', 'detached action', 'fear of failure'],
            label: { en: 'your studies', hi: 'पढ़ाई' },
            line: { en: 'Studies, results, and what others expect of you — that is a lot to hold at once.', hi: 'पढ़ाई, नतीजे और दूसरों की उम्मीदें — यह एक साथ बहुत कुछ थामना है।' }
        },
        work: {
            terms: ['job', 'jobs', 'boss', 'office', 'career', 'colleague*', 'coworker*', 'manager', 'salary', 'fired', 'laid off',
                'layoff*', 'interview*', 'business', 'startup', 'investor*', 'client*', 'workplace', 'internship', 'placement*', 'offer letter', 'hired', 'company', 'at work', 'go to work', 'my work', 'from work', 'after work', 'work life', 'work from home', 'naukri', 'kaam', 'नौकरी', 'काम', 'बॉस', 'दफ़्तर', 'दफ्तर'],
            concepts: ['duty', 'karma yoga', 'doing your job', 'work', 'action', 'detached action', 'excellence in action', 'career'],
            label: { en: 'your work', hi: 'काम' },
            line: { en: 'Work can take more than our hours; it can take our peace too.', hi: 'काम कभी-कभी हमारे घंटों से ज़्यादा ले लेता है — हमारी शांति भी।' }
        },
        family: {
            terms: ['mother', 'father', 'parents', 'parent', 'family', 'brother', 'sister', 'son', 'daughter', 'husband', 'wife',
                'in laws', 'inlaws', 'grandmother', 'grandfather', 'kids', 'children', 'my child', 'my baby', 'bachche', 'bacche', 'बच्चे', 'बच्चों', 'nani', 'dadi', 'nana', 'dada', 'ghar wale', 'gharwale', 'bhai',
                'behen', 'bahen', 'pati', 'patni', 'saas', 'परिवार', 'माँ', 'मां', 'पिता', 'पापा', 'भाई', 'बहन', 'पति', 'पत्नी', 'घरवाले'],
            concepts: ['family', 'relationships', 'duty', 'love', 'compassion', 'forgiveness', 'patience', 'attachment'],
            label: { en: 'your family', hi: 'परिवार' },
            line: { en: 'Family is where we love most — and so where it can hurt most.', hi: 'परिवार वह जगह है जहाँ हम सबसे ज़्यादा प्रेम करते हैं — और इसलिए वहीं सबसे ज़्यादा चोट भी लगती है।' }
        },
        love: {
            terms: ['girlfriend', 'boyfriend', 'partner', 'crush', 'in love', 'love her', 'love him', 'relationship', 'situationship',
                'breakup', 'my ex', 'dating', 'pyaar', 'pyar', 'mohabbat', 'प्यार', 'प्रेम'],
            concepts: ['love', 'attachment', 'letting go', 'relationships', 'devotion', 'feeling hurt', 'emotional pain'],
            label: { en: 'love', hi: 'प्रेम' },
            line: { en: 'Matters of the heart go deeper than anything we can explain.', hi: 'दिल की बातें उससे कहीं गहरी होती हैं जितना हम समझा पाते हैं।' }
        },
        marriage: {
            terms: ['marriage', 'married', 'marry', 'wedding', 'arranged marriage', 'shaadi ke liye', 'shaadi ka', 'marriage pressure', 'shaadi', 'shadi', 'rishta', 'rishte', 'rishtey',
                'vivah', 'शादी', 'विवाह', 'रिश्ता', 'रिश्ते'],
            concepts: ['swadharma', 'duty', 'decision', 'clarity', 'family', 'love', 'equanimity'],
            label: { en: 'marriage', hi: 'शादी' },
            line: { en: 'Marriage carries so many hopes — yours, and everyone else’s.', hi: 'शादी के साथ कितनी उम्मीदें जुड़ी होती हैं — आपकी भी, और सबकी भी।' }
        },
        friendship: {
            terms: ['friend', 'friends', 'friendship', 'dost', 'dosti', 'yaar log', 'best friend', 'left out', 'ignored me',
                'ignoring me', 'दोस्त', 'दोस्ती'],
            concepts: ['friendship', 'friend', 'loneliness', 'forgiveness', 'equanimity', 'caring'],
            label: { en: 'your friendships', hi: 'दोस्ती' },
            line: { en: 'When a friendship wavers, it shakes more than we expect.', hi: 'जब कोई दोस्ती डगमगाती है, तो वह हमें उम्मीद से ज़्यादा हिला देती है।' }
        },
        health: {
            terms: ['sick', 'illness', 'ill', 'disease', 'hospital', 'surgery', 'operation', 'cancer', 'diagnos*', 'doctor said', 'doctors said', 'saw a doctor', 'health',
                'chronic', 'pain in', 'my body', 'therapy', 'medicine*', 'chemo*', 'tumou*', 'tumor*', 'biopsy', 'scan results', 'icu', 'dialysis', 'pregnan*', 'miscarriage', 'bimar*', 'beemar*', 'sehat', 'tabiyat', 'बीमार*', 'अस्पताल', 'इलाज', 'ऑपरेशन', 'सेहत', 'तबीयत',
                'कैंसर', 'कीमो*', 'डायलिसिस', 'ट्यूमर', 'डिमेंशिया'],
            concepts: ['body', 'impermanence', 'enduring a hard time', 'staying strong in pain', 'courage', 'fear of death', 'surrender', 'soul'],
            label: { en: 'your health', hi: 'सेहत' },
            line: { en: 'When the body struggles, the mind carries it too.', hi: 'जब शरीर संघर्ष करता है, तो मन भी उसका भार उठाता है।' }
        },
        loss: {
            terms: ['died', 'death', 'passed away', 'funeral', 'is dying', 'was dying', 'lost my', 'no more with us', 'mar gaya', 'mar gayi',
                'chal base', 'guzar gaye', 'गुजर गए', 'गुज़र गए', 'मृत्यु', 'मौत', 'नहीं रहे'],
            concepts: ['death', 'soul', 'eternal', 'immortality', 'grief', 'comfort in loss', 'impermanence', 'cycle of life'],
            label: { en: 'your loss', hi: 'बिछड़ना' },
            line: { en: 'Losing someone changes the shape of every ordinary day.', hi: 'किसी को खोना हर साधारण दिन का आकार बदल देता है।' }
        },
        money: {
            terms: ['money', 'debt', 'loan', 'loans', 'emi', 'bills', 'rent', 'broke', 'financial*', 'finances', 'savings', 'poor',
                'poverty', 'paisa', 'paise', 'paison', 'karza', 'karz', 'पैसा', 'पैसे', 'पैसों', 'कर्ज', 'क़र्ज़', 'उधार'],
            concepts: ['contentment', 'security', 'trust', 'duty', 'detachment', 'divine assurance', 'protection'],
            label: { en: 'money', hi: 'पैसा' },
            line: { en: 'Money worries have a way of reaching into everything.', hi: 'पैसों की चिंता धीरे-धीरे हर चीज़ में उतर आती है।' }
        },
        future: {
            terms: ['future', 'what if', 'what will happen', 'uncertain*', 'tomorrow', 'next year', 'settle', 'settled', 'aage kya',
                'bhavishya', 'भविष्य', 'आगे क्या'],
            concepts: ['uncertainty', 'trusting god', 'surrender', 'action', 'faith', 'divine assurance', 'steady'],
            label: { en: 'the future', hi: 'भविष्य' },
            line: { en: 'Not knowing what comes next is one of the hardest things to sit with.', hi: 'आगे क्या होगा, यह न जानना सबसे कठिन बातों में से एक है।' }
        },
        faith: {
            terms: ['god', 'bhagwan', 'bhagavan', 'ishwar', 'krishna', 'prayer', 'pray', 'praying', 'faith', 'believe in', 'religion',
                'spiritual*', 'temple', 'mandir', 'karma', 'sin', 'paap', 'भगवान', 'ईश्वर', 'प्रार्थना', 'आस्था', 'पाप', 'मंदिर'],
            concepts: ['devotion', 'faith', 'surrender', 'divine presence', 'bhakti', 'trusting god', 'divine assurance', 'grace'],
            label: { en: 'faith', hi: 'आस्था' },
            line: { en: 'Questions of faith are part of the path, not a step away from it.', hi: 'आस्था के प्रश्न मार्ग का हिस्सा हैं, उससे दूर जाना नहीं।' }
        },
        meaning: {
            terms: ['meaning of life', 'point of life', 'point to life', 'point in life', 'any point', 'purpose of life', 'purpose in life', 'why am i here', 'why do we live', 'why are we here', 'who am i', 'why do i exist', 'existence',
                'what is life', 'meaningless', 'pointless', 'zindagi ka matlab', 'जीवन का अर्थ', 'मैं कौन हूँ'],
            concepts: ['purpose', 'self-knowledge', 'soul', 'swadharma', 'meaning', 'knowledge', 'eternal nature'],
            label: { en: 'the meaning of it all', hi: 'जीवन का अर्थ' },
            line: { en: 'These are the very questions Arjuna asked on the battlefield.', hi: 'यही प्रश्न अर्जुन ने रणभूमि में पूछे थे।' }
        },
        self: {
            terms: ['confidence', 'self esteem', 'selfesteem', 'my looks', 'ugly', 'fat', 'body image', 'insecure', 'compare myself',
                'comparing myself', 'comparison', 'compare my life', 'not enough', 'imposter', 'impostor', 'how i see myself', 'the way i see myself', 'self worth', 'khud se nafrat',
                'आत्मविश्वास', 'हीन'],
            concepts: ['self-worth', 'confidence', 'inner strength', 'equal vision', 'swadharma', 'mind as friend', 'being your own best friend'],
            label: { en: 'how you see yourself', hi: 'स्वयं को देखने का ढंग' },
            line: { en: 'The way we see ourselves colours everything else we see.', hi: 'हम स्वयं को जैसे देखते हैं, वही बाक़ी सब कुछ रंग देता है।' }
        },
        habits: {
            terms: ['procrastinat*', 'lazy', 'laziness', 'discipline', 'cant focus', 'cannot focus', 'distract*', 'screen time', 'scrolling',
                'addict*', 'smoking', 'alcohol', 'drinking', 'porn', 'gaming', 'aalas', 'आलस', 'लत'],
            concepts: ['self-control', 'discipline', 'sense control', 'practice', 'determination', 'abhyasa', 'mastering your thoughts'],
            label: { en: 'your habits', hi: 'आदतें' },
            line: { en: 'Habits are strong — and wanting to change one is already a beginning.', hi: 'आदतें मज़बूत होती हैं — और किसी एक को बदलना चाहना ही शुरुआत है।' }
        },
        sleep: {
            terms: ['cant sleep', 'cannot sleep', 'couldnt sleep', 'insomnia', 'nightmare*', 'awake at night', 'awake for hours', 'no sleep',
                'at night', 'every night', 'all night',
                'not sleeping', 'sleepless', 'up all night', 'neend nahi', 'नींद नहीं', 'सो नहीं'],
            concepts: ['peace', 'calm', 'meditation', 'steady', 'stillness', 'surrender'],
            label: { en: 'rest', hi: 'नींद' },
            line: { en: 'A mind that will not rest makes the night very long.', hi: 'जो मन आराम नहीं करता, वह रात को बहुत लंबा बना देता है।' }
        },
        decision: {
            terms: ['should i', 'decide', 'decision', 'choose', 'choice', 'dilemma', 'torn between', 'or should', 'want me to become',
                'want me to be a', 'expect me to', 'pressure to become', 'follow my passion', 'follow my dream*', 'my dream', 'my passion',
                'career choice', 'which career', 'which stream', 'which course', 'kya karu', 'kya karun',
                'kya karoon', 'kya kru', 'क्या करूँ', 'क्या करूं', 'फ़ैसला', 'फैसला'],
            concepts: ['swadharma', 'duty', 'decision', 'clarity', 'seeking clarity', 'right action', 'guidance'],
            label: { en: 'a decision', hi: 'एक फ़ैसला' },
            line: { en: 'Standing between two paths is exactly where the Gita begins.', hi: 'दो राहों के बीच खड़े होना — गीता ठीक यहीं से शुरू होती है।' }
        },
        conflict: {
            terms: ['fight', 'fighting', 'fought', 'argument', 'argue*', 'conflict', 'quarrel', 'shouted', 'yelled', 'insulted',
                'jhagda', 'jhagra', 'ladai', 'झगड़ा', 'लड़ाई', 'बहस'],
            concepts: ['anger', 'forgiveness', 'patience', 'tolerance', 'equanimity', 'self-control', 'not disturbed by others'],
            label: { en: 'a conflict', hi: 'एक झगड़ा' },
            line: { en: 'Conflict with someone close leaves an echo long after the words.', hi: 'किसी अपने से झगड़ा शब्दों के बाद भी देर तक गूँजता रहता है।' }
        },
        injustice: {
            terms: ['unfair', 'not fair', 'injustice', 'why me', 'deserve this', 'nobody cares', 'taken for granted', 'cheated me', 'bad things happen', 'suffering', 'why does god',
                'used me', 'betrayed', 'anyay', 'अन्याय', 'मेरे साथ ही क्यों'],
            concepts: ['equanimity', 'karma', 'patience', 'faith', 'divine assurance', 'tolerance', 'forgiveness'],
            label: { en: 'unfairness', hi: 'अन्याय' },
            line: { en: '"Why me?" is one of the oldest cries there is — and it deserves to be heard.', hi: '"मेरे साथ ही क्यों?" — यह सबसे पुरानी पुकारों में से है, और इसे सुना जाना चाहिए।' }
        }
    };

    const TOPIC_PRIORITY = ['loss', 'health', 'marriage', 'money', 'study', 'work', 'decision', 'family', 'love', 'conflict', 'injustice',
        'friendship', 'habits', 'self', 'faith', 'meaning', 'future', 'sleep'];

    function detectTopics(text) {
        return topicsIn(normalise(text));
    }

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
        guilt: 'guilt', 'self-blame': 'guilt', 'self-doubt': 'unworthiness',
        empty: 'emptiness', numb: 'emptiness', lustful: 'lust', desire: 'lust', ego: 'pride', proud: 'pride',
        love: 'love', 'in love': 'love', devoted: 'devotion', devotion: 'devotion', lazy: 'inertia', stuck: 'inertia', unmotivated: 'inertia'
    };

    const NEGATIONS = new Set(['not', 'no', 'never', 'isnt', 'arent', 'wasnt', 'dont', 'doesnt', 'didnt', 'hardly', 'barely', 'nor', 'without']);
    const POST_NEGATIONS = new Set(['nahi', 'nahin', 'नहीं', 'ना', 'न']);

    const CLAUSE_BREAKS = new Set(['|', 'but', 'just', 'and', 'though', 'although', 'yet', 'so', 'par', 'lekin', 'पर', 'लेकिन']);

    // Look a few words either side of a match, never across a clause:
    // "not angry, just tired" negates "angry" but keeps "tired".
    function negated(normalised, index, span = 1) {
        const before = [];
        for (const word of normalised.slice(0, index).trim().split(' ').reverse()) {
            if (CLAUSE_BREAKS.has(word) || before.length === 3) break;
            before.push(word);
        }
        if (before.some((word) => NEGATIONS.has(word))) return true;
        const after = [];
        // Skip the matched phrase's own words: "maaf nahi" is not negated by its own "nahi".
        for (const word of normalised.slice(index).trim().split(' ').slice(span)) {
            if (CLAUSE_BREAKS.has(word) || after.length === 3) break;
            after.push(word);
        }
        return after.some((word) => POST_NEGATIONS.has(word));
    }

    // Ties go to the more specific feeling.
    const SPECIFICITY = ['grief', 'heartbreak', 'lust', 'failure', 'guilt', 'envy', 'craving', 'loneliness', 'unworthiness',
        'emptiness', 'fear', 'anger', 'pride', 'sadness', 'anxiety', 'stress', 'inertia', 'purpose', 'confusion', 'devotion',
        'love', 'peace', 'gratitude'];

    // The feelings in a message, strongest first (see understand()).
    function detectEmotions(text) {
        return understand(text).feelings.map((feeling) => feeling.id);
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
        'मुझे मेरा मेरी मेरे है हैं हो रहा रही रहे था थी बहुत भी क्या क्यों की का के को में से पर और यह वह ' +
        'main hoon kar karna karta karti nahi sab kuch aur toh ye yeh wo woh kaise kab kahan apne apna apni saath liye lag ' +
        'laga lagta lagti kyunki phir abhi bas yaar hota hoti hote gaya gayi gaye wala wali sakta sakti pata ' +
        'actually basically kind sort maybe guess lately also again around back thats theres whats dont cant wont didnt ' +
        'isnt wasnt doesnt havent hasnt'
    ).split(' '));

    function stem(word) {
        return word
            .replace(/(ings|ing|edly|ed|ies|es|s|ly|ness|ful)$/u, '')
            .replace(/(.)\1$/u, '$1');
    }

    function contentKeywords(text) {
        return [...new Set(normalise(text).trim().split(' ').filter((word) => word.length > 3 && !STOP_WORDS.has(word)))];
    }

    // =======================================================================
    // Understanding
    //
    // Before answering, read the message the way a friend would. The result
    // is a reading: which feelings are in it and how strongly, whose feelings
    // they are, when it happened and whether it has eased, what the person is
    // asking for, and how sure we can be. Everything after this answers the
    // reading, not the raw words.
    // =======================================================================

    // --- A face often says more than the words around it -------------------

    const EMOJI_FEELINGS = [
        ['heartbreak', ['💔']],
        ['sadness', ['😢', '😭', '😞', '😔', '☹', '🙁', '😿', '🥀']],
        ['anger', ['😡', '😠', '🤬', '💢']],
        ['fear', ['😨', '😱']],
        ['anxiety', ['😰', '😟', '😥', '😓', '😬']],
        ['stress', ['😩', '😫', '🥵', '🤯']],
        ['loneliness', ['🥺']],
        ['emptiness', ['😶', '😐', '🫥']],
        ['inertia', ['😴', '🥱']],
        ['peace', ['😌', '🧘', '☮']],
        ['gratitude', ['😊', '😄', '😁', '🥳', '🎉', '😀', '😃', '🤩', '🥰', '😍', '❤', '💖', '💗']]
    ];

    function emojiFeelings(raw) {
        const found = new Map();
        EMOJI_FEELINGS.forEach(([id, marks]) => {
            const count = marks.reduce((sum, mark) => sum + raw.split(mark).length - 1, 0);
            if (count) found.set(id, Math.min(count, 3));
        });
        return found;
    }

    // --- Forgiving spelling, the way people type when they are hurting -----
    // "im so lonley and anxous" is read as "lonely" and "anxious". Only a
    // feeling word is ever the target, the first letter must agree, a swapped
    // letter only counts when the keys sit side by side, and a word that is
    // already real (in the lexicons, the Gita's own text, or this list) is
    // never touched: "working" stays working, "quite" stays quite.

    const NOT_TYPOS = new Set(('lovely lively likely lately tried tries sacred single simple angle angel scarf stare stared ' +
        'piece dress press bless blessed house horse nurse purse curse hours greet great trust thrust earth death depth linger ' +
        'finger longer danger ranger manager hanger hunger sorry story steady ready heady saddle paddle reader leader border ' +
        'mirror error terror treasure measure nature mature lesson lessen tenses tennis cared shared share along brief carer ' +
        'cried board worse ankle hated rated dated mated gated eager eagle hurry hurts heard heart hearts scare spare shore ' +
        'score store fears years wears bears gears nears dears pears hears clear sadly badly madly gladly glade grade grace ' +
        'place space trace brace bread tread treat cheat cheap sheep sleep sweep steep creep shine whine spine swine stone ' +
        'phone shone drone prone throne angst amused abused accused excused focused cursed nursed versed suppose oppose expose ' +
        'quite quiet quit lower closer loose lose loves lover loner drainage trained training facing racing lasting calming ' +
        'working words works taking takes sense dense madness bearing hearing changing reflection thinking homeless ' +
        'homelessness devotional deviation').split(' '));

    // Common forms of the feeling words people misspell most.
    const EXTRA_TARGETS = ['worried', 'worry', 'worrying', 'stressed', 'stressful', 'overwhelmed', 'overthinking', 'frustrated',
        'frustrating', 'depressed', 'depression', 'hopeless', 'hopelessness', 'confused', 'confusing', 'jealous', 'jealousy',
        'guilty', 'regret', 'regretting', 'humiliated', 'irritated', 'resentful', 'restless', 'panicking', 'dreading', 'grieving',
        'mourning', 'crying', 'addicted', 'addiction', 'procrastinating', 'embarrassed', 'disappointed', 'heartbroken', 'exhausted',
        'miserable', 'insecure', 'worthless', 'useless', 'anxious', 'lonely', 'scared', 'terrified', 'nervous', 'devastated'];
    // Feeling words too close to everyday words to ever be guessed at.
    const NEVER_TARGET = new Set(['racing', 'calling', 'direction', 'quiet', 'tense', 'tears', 'loser', 'peace', 'happy', 'alone',
        'tired', 'shame', 'sexual', 'passion', 'smoking', 'drinking', 'cracked', 'nobody', 'failed', 'purpose', 'funeral',
        'pressure', 'relationship', 'chanting', 'calling', 'tension', 'scrolling', 'stillness', 'blessed', 'drained', 'empty']);

    const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const KEY_AT = new Map();
    KEY_ROWS.forEach((row, r) => [...row].forEach((key, c) => KEY_AT.set(key, [r, c])));
    function besideOnKeyboard(a, b) {
        const [ra, ca] = KEY_AT.get(a) || [];
        const [rb, cb] = KEY_AT.get(b) || [];
        if (ra === undefined || rb === undefined) return false;
        if (ra === rb) return Math.abs(ca - cb) === 1;
        if (rb === ra - 1) return cb === ca || cb === ca + 1;
        if (rb === ra + 1) return cb === ca || cb === ca - 1;
        return false;
    }

    let vocabularyCache = null;

    function feelingVocabulary() {
        if (vocabularyCache) return vocabularyCache;
        const targets = new Set(EXTRA_TARGETS);
        const known = new Set([...NOT_TYPOS, ...STOP_WORDS, ...EXTRA_TARGETS]);
        const prefixes = [];
        const addTerm = (term, isTarget) => {
            const words = term.split(' ');
            words.forEach((word) => {
                if (!/^[a-z]+\*?$/.test(word)) return;
                if (word.endsWith('*')) {
                    prefixes.push(word.slice(0, -1));
                    return;
                }
                known.add(word);
                if (isTarget && words.length === 1 && word.length >= 5 && !NEVER_TARGET.has(word)) targets.add(word);
            });
        };
        Object.values(EMOTIONS).forEach((emotion) => emotion.terms.forEach((term) => addTerm(term, true)));
        Object.values(TOPICS).forEach((topic) => topic.terms.forEach((term) => addTerm(term, false)));
        Object.values(GLOSSARY).forEach((entry) => entry.terms.forEach((term) => addTerm(term, false)));
        vocabularyCache = { targets: [...targets], known, prefixes };
        return vocabularyCache;
    }

    // Optimal string alignment distance. Inserting, dropping or swapping two
    // neighbouring letters costs 1; replacing a letter costs 1 only when the
    // keys are side by side (a slipped finger), otherwise 2. Gives up as soon
    // as the answer must exceed `max`.
    function typoDistance(a, b, max) {
        if (Math.abs(a.length - b.length) > max) return max + 1;
        let before = null;
        let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
        for (let i = 1; i <= a.length; i++) {
            const current = [i];
            let rowMin = i;
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : besideOnKeyboard(a[i - 1], b[j - 1]) ? 1 : 2;
                let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
                current[j] = value;
                if (value < rowMin) rowMin = value;
            }
            if (rowMin > max) return max + 1;
            before = previous;
            previous = current;
        }
        return previous[b.length];
    }

    function correctSpelling(normalised, lexicon) {
        const { targets, known, prefixes } = feelingVocabulary();
        const corrections = [];
        const words = normalised.trim().split(' ').map((word) => {
            if (word.length < 5 || !/^[a-z]+$/.test(word) || known.has(word) || lexicon?.has(word)) return word;
            if (prefixes.some((root) => word.startsWith(root))) return word;
            const max = word.length >= 9 ? 2 : 1;
            let best = null;
            let bestDistance = max + 1;
            for (const candidate of targets) {
                if (candidate[0] !== word[0]) continue;
                const distance = typoDistance(word, candidate, Math.min(max, bestDistance - 1));
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = candidate;
                    if (distance === 1) break;
                }
            }
            if (!best) return word;
            corrections.push({ from: word, to: best });
            return best;
        });
        return { text: ` ${words.join(' ')} `, corrections };
    }

    // --- What follows "but" is usually what matters ------------------------

    const CONTRAST = new Set(['but', 'however', 'though', 'although', 'yet', 'lekin', 'magar', 'लेकिन', 'मगर', 'किंतु', 'परंतु']);

    function splitClauses(normalised) {
        const clauses = [];
        let words = [];
        let contrasted = false;
        const close = (nextContrasted) => {
            if (words.length) clauses.push({ words, contrasted });
            words = [];
            contrasted = nextContrasted;
        };
        normalised.trim().split(' ').forEach((word) => {
            if (word === '|') close(false);
            else if (CONTRAST.has(word)) close(true);
            else if (word) words.push(word);
        });
        close(false);
        clauses.forEach((clause, index) => {
            clause.text = ` ${clause.words.join(' ')} `;
            clause.weight = clause.contrasted ? 1.35 : 1;
            if (clause.contrasted && clauses[index - 1]) clauses[index - 1].weight = Math.min(clauses[index - 1].weight, 0.7);
        });
        return clauses;
    }

    // --- "A bit nervous" is not "SO scared!!" -------------------------------

    const INTENSIFIERS = new Set(['so', 'soo', 'very', 'really', 'extremely', 'too', 'super', 'deeply', 'completely', 'totally',
        'absolutely', 'incredibly', 'terribly', 'awfully', 'utterly', 'insanely', 'bahut', 'itna', 'itni', 'kaafi', 'bilkul',
        'ekdum', 'atyant', 'बहुत', 'इतना', 'इतनी', 'बेहद', 'काफ़ी', 'काफी', 'बिलकुल', 'बिल्कुल']);
    const DIMINISHERS = new Set(['bit', 'little', 'slightly', 'somewhat', 'kinda', 'mildly', 'less', 'thoda', 'thodi', 'halka',
        'थोड़ा', 'थोड़ी']);

    function intensityOf(raw, multipliers) {
        const letters = raw.match(/[A-Za-z]/g) || [];
        const capitals = letters.filter((char) => char >= 'A' && char <= 'Z').length;
        const shouting = letters.length >= 8 && capitals / letters.length > 0.6;
        const exclaims = /!{2,}|\?{2,}/.test(raw);
        const stretched = /(\p{L})\1{2,}/u.test(raw);
        const strongest = multipliers.length ? Math.max(...multipliers) : 1;
        const softest = multipliers.length ? Math.min(...multipliers) : 1;
        let score = strongest > 1 ? 1.5 : softest < 1 ? 0.6 : 1;
        if (shouting) score += 0.5;
        if (exclaims) score += 0.25;
        if (stretched) score += 0.25;
        return { score, level: score >= 1.4 ? 'high' : score <= 0.7 ? 'low' : 'medium' };
    }

    // --- Then, now, or still to come ---------------------------------------

    const PAST_MARKERS = ['used to', 'had been', 'last year', 'last month', 'last week', 'back then', 'in the past', 'years ago',
        'months ago', 'weeks ago', 'when i was', 'pehle', 'पहले'];
    const FUTURE_MARKERS = ['will', 'tomorrow', 'next week', 'next month', 'next year', 'going to', 'gonna', 'what if', 'soon',
        'upcoming', 'coming up', 'hoga', 'hogi', 'agle', 'aane wala', 'aane wali', 'होगा', 'होगी', 'आने वाला', 'अगले'];
    const RELIEF_TERMS = ['better now', 'feel better', 'feeling better', 'much better', 'okay now', 'ok now', 'fine now', 'lighter now',
        'relieved', 'healed', 'over it', 'moved on', 'got through it', 'made it through', 'calmer now', 'at peace now',
        'ab theek', 'ab thik', 'behtar', 'बेहतर', 'अब ठीक'];
    const RELIEF_BLOCKERS = new Set([...NEGATIONS, 'want', 'wish', 'hope', 'need', 'cant', 'cannot', 'nothing', 'nobody', 'if',
        'to', 'would', 'will', 'never', 'chahta', 'chahti', 'काश']);

    function timeOf(clauseText) {
        if (FUTURE_MARKERS.some((term) => has(clauseText, term))) return 'future';
        if (PAST_MARKERS.some((term) => has(clauseText, term))) return 'past';
        return 'present';
    }

    function reliefIn(clauseText) {
        return RELIEF_TERMS.some((term) => {
            const index = findTerm(clauseText, term);
            if (index === -1) return false;
            const before = clauseText.slice(0, index).trim().split(' ').slice(-3);
            return !before.some((word) => RELIEF_BLOCKERS.has(word));
        });
    }

    // --- Whose feeling is it: theirs, or someone they love? ----------------

    const RELATIONS = {
        mother: ['mother', 'ammi', 'mata', 'माँ', 'मां', 'मम्मी', 'माता'],
        father: ['father', 'pitaji', 'abba', 'पापा', 'पिता', 'पिताजी'],
        sister: ['sister', 'behen', 'bahen', 'didi', 'बहन', 'दीदी'],
        brother: ['brother', 'bhai', 'bhaiya', 'भाई', 'भैया'],
        partner: ['wife', 'husband', 'girlfriend', 'boyfriend', 'partner', 'fiance', 'fiancee', 'pati', 'patni', 'पति', 'पत्नी'],
        child: ['son', 'daughter', 'child', 'kid', 'kids', 'children', 'beta', 'beti', 'बेटा', 'बेटी', 'बच्चा', 'बच्चे'],
        friend: ['friend', 'best friend', 'dost', 'दोस्त'],
        grandparent: ['grandmother', 'grandfather', 'grandma', 'grandpa', 'nani', 'dadi', 'nana', 'dada', 'दादी', 'नानी', 'दादा', 'नाना']
    };
    const SELF_WORDS = new Set(['i', 'im', 'ive', 'id', 'me', 'myself', 'mujhe', 'main', 'mujhko', 'मैं', 'मुझे', 'मुझको']);
    const HELPING = ['how do i help', 'how can i help', 'how to help', 'help my', 'help him', 'help her', 'help them', 'support my',
        'support him', 'support her', 'take care of my', 'caring for my', 'look after my', 'unki madad', 'madad karu', 'madad karun',
        'kaise help', 'उनकी मदद', 'मदद करूँ', 'देखभाल'];
    const ILLNESS = ['sick', 'ill', 'illness', 'health', 'cancer', 'hospital', 'hospitalised', 'hospitalized', 'icu', 'surgery',
        'chemo*', 'diagnos*', 'disease', 'dementia', 'alzheimer*', 'stroke', 'heart attack', 'tumou*', 'tumor*', 'bimar*',
        'beemar*', 'बीमार*', 'अस्पताल', 'कैंसर', 'बीमारी', 'कीमो*', 'डायलिसिस', 'ट्यूमर', 'डिमेंशिया', 'ऑपरेशन', 'इलाज'];
    // Feelings that, seen in someone else, call for care (not anger, envy…).
    const CARE_FEELINGS = ['sadness', 'anxiety', 'fear', 'stress', 'loneliness', 'emptiness', 'unworthiness', 'failure', 'inertia',
        'heartbreak', 'confusion', 'craving', 'guilt'];
    const WORRY_FEELINGS = ['anxiety', 'fear', 'sadness', 'stress'];
    const CARE_LINKS = new Set(['about', 'for', 'of', 'ki', 'ke', 'ka', 'की', 'के', 'का', 'को']);
    const RELATION_WORDS = new Set(Object.values(RELATIONS).flat().filter((term) => !term.includes(' ')));
    const OTHER_PEOPLE = new Set(['he', 'she', 'they', 'him', 'her', 'them', 'his', 'hes', 'shes', 'theyre', 'everyone', 'woh', 'wo',
        'vo', 'unhe', 'unko', 'use', 'usko', 'वह', 'वो', 'उन्हें', 'उसे', 'उसको']);

    function firstIndex(text, terms) {
        return terms.reduce((first, term) => {
            const at = findTerm(text, term);
            return at !== -1 && (first === -1 || at < first) ? at : first;
        }, -1);
    }

    // The particular word someone used, when it says more than the category:
    // "your husband" is warmer than "your partner".
    const RELATION_WORDS_SPECIFIC = {
        husband: 'husband', pati: 'husband', 'पति': 'husband', wife: 'wife', patni: 'wife', 'पत्नी': 'wife',
        girlfriend: 'girlfriend', boyfriend: 'boyfriend', son: 'son', beta: 'son', 'बेटा': 'son', daughter: 'daughter', beti: 'daughter',
        'बेटी': 'daughter', grandmother: 'grandmother', grandma: 'grandmother', nani: 'grandmother', dadi: 'grandmother', 'दादी': 'grandmother',
        'नानी': 'grandmother', grandfather: 'grandfather', grandpa: 'grandfather', nana: 'grandfather', dada: 'grandfather', 'दादा': 'grandfather',
        'नाना': 'grandfather'
    };

    function relationIn(clauseText) {
        let best = null;
        Object.entries(RELATIONS).forEach(([relation, terms]) => {
            terms.forEach((term) => {
                const index = findTerm(clauseText, term);
                if (index !== -1 && (!best || index < best.index)) best = { relation: RELATION_WORDS_SPECIFIC[term] || relation, index };
            });
        });
        return best;
    }

    const wordsBetween = (text, from, to) => text.slice(Math.min(from, to), Math.max(from, to)).trim().split(' ').slice(1);

    // Is the feeling at `index` the speaker's own? "I'm scared" and "mujhe
    // papa ki chinta hai" — yes. "I think my mom is depressed" — no, it is hers.
    // span: the matched phrase's length — "left me", "hates me" land on the speaker.
    function ownedBySelf(clause, index, span = 1) {
        const after = clause.text.slice(index).trim().split(' ').slice(0, span + 1);
        if (after.some((word) => SELF_WORDS.has(word))) return true;
        const before = clause.text.slice(0, index).trim().split(' ').filter(Boolean).slice(-5);
        let self = -1;
        let other = -1;
        before.forEach((word, i) => {
            if (SELF_WORDS.has(word)) self = i;
            else if (RELATION_WORDS.has(word) || OTHER_PEOPLE.has(word)) other = i;
        });
        if (self === -1) return false;
        return other < self || CARE_LINKS.has(before[other + 1]);
    }

    function careIn(clauses, heavyAt, topHeavy, normalised) {
        const selfIll = clauses.some((clause) => {
            const at = firstIndex(clause.text, ILLNESS);
            return at !== -1 && clause.text.slice(0, at).trim().split(' ').slice(-3).some((word) => SELF_WORDS.has(word));
        });
        if (selfIll) return null;
        const order = [...clauses.keys()].sort((a, b) => (heavyAt?.clause === b) - (heavyAt?.clause === a));
        for (const clauseIndex of order) {
            const clause = clauses[clauseIndex];
            const found = relationIn(clause.text);
            if (!found) continue;
            const illAt = firstIndex(clause.text, ILLNESS);
            const state = illAt !== -1 && !has(clause.text, 'mental health') ? 'health' : 'mind';
            const feeling = heavyAt && heavyAt.clause === clauseIndex ? heavyAt : null;
            const own = feeling ? ownedBySelf(clause, feeling.index, feeling.span) : false;
            // "my mom is depressed", "I think my brother is lonely"
            if (feeling && !own && CARE_FEELINGS.includes(topHeavy.id) && feeling.index > found.index) return { relation: found.relation, state, kind: 'theirs' };
            // "my dad has cancer", "my mom's health"
            if (illAt !== -1 && found.index < illAt && !wordsBetween(clause.text, found.index, illAt).some((word) => SELF_WORDS.has(word))) {
                return { relation: found.relation, state, kind: 'theirs' };
            }
            // "I'm so worried about my brother", "mujhe papa ki chinta hai"
            if (feeling && own && WORRY_FEELINGS.includes(topHeavy.id)) {
                const between = wordsBetween(clause.text, feeling.index, found.index);
                if (between.length <= 3 && between.some((word) => CARE_LINKS.has(word))) return { relation: found.relation, state, kind: 'worry' };
            }
        }
        if (HELPING.some((term) => has(normalised, term))) {
            const found = relationIn(normalised);
            const ill = firstIndex(normalised, ILLNESS) !== -1 && !has(normalised, 'mental health');
            return { relation: found ? found.relation : 'someone', state: ill ? 'health' : 'mind', kind: 'helping' };
        }
        return null;
    }

    // --- What are they asking for? -----------------------------------------

    const ASKS = {
        vent: ['just want to vent', 'need to vent', 'just vent', 'just listen', 'just need someone to listen', 'need someone to listen',
            'dont want advice', 'dont need advice', 'no advice', 'just want to talk', 'just need to talk', 'bas sun lo', 'bas sunna',
            'sirf sun', 'बस सुनो', 'बस सुन लो', 'सिर्फ़ सुनो'],
        how: ['how do i', 'how can i', 'how to', 'what should i do', 'what can i do', 'what do i do', 'any advice', 'help me', 'tips',
            'kya karu', 'kya karun', 'kaise', 'कैसे', 'क्या करूँ', 'क्या करूं'],
        why: ['why do i', 'why am i', 'why does', 'why is', 'why cant i', 'why me', 'kyun', 'क्यों']
    };
    const ABOUT = '([\\p{L}\\p{M}]+(?: [\\p{L}\\p{M}]+)?)';
    const VERSE_ASKS = [
        new RegExp(`(?:verse|verses|shlok|shloka|shlokas|sloka|श्लोक) (?:about|on|for|regarding) ${ABOUT}`, 'u'),
        new RegExp(`(?:gita|geeta|गीता) (?:say|says|said|teach|teaches|tell|tells) (?:me )?(?:about )?${ABOUT}`, 'u'),
        new RegExp(`${ABOUT} (?:par|पर) (?:koi |कोई |ek |एक )?(?:verse|shlok|shloka|श्लोक)`, 'u'),
        new RegExp(`(?:gita|geeta|गीता) (?:mein |में )?${ABOUT} (?:ke bare me|ke bare mein|ke baare me|ke baare mein|par|के बारे में|पर) (?:kya |क्या )?(?:kehti|kahti|batati|कहती|बताती)`, 'u')
    ];

    function askOf(normalised) {
        for (const pattern of VERSE_ASKS) {
            const match = normalised.match(pattern);
            const about = match ? match[1].split(' ').filter((word) => !STOP_WORDS.has(word) && !['koi', 'ek', 'कोई', 'एक'].includes(word)).join(' ') : '';
            if (about) return { ask: 'verse', about };
        }
        for (const kind of ['vent', 'how', 'why']) {
            if (ASKS[kind].some((term) => has(normalised, term))) return { ask: kind, about: null };
        }
        return { ask: null, about: null };
    }

    // --- The reading -------------------------------------------------------

    function topicsIn(normalised) {
        if (normalised.trim() === '') return [];
        return Object.entries(TOPICS)
            .map(([id, topic]) => ({ id, hits: topic.terms.reduce((sum, term) => sum + (has(normalised, term) ? (term.includes(' ') ? 2 : 1) : 0), 0) }))
            .filter((item) => item.hits > 0)
            .sort((a, b) => b.hits - a.hits || TOPIC_PRIORITY.indexOf(a.id) - TOPIC_PRIORITY.indexOf(b.id))
            .map((item) => item.id);
    }

    const LIGHT = ['peace', 'gratitude', 'love', 'devotion'];
    const EMPTY_READING = Object.freeze({
        feelings: [], primary: null, topics: [], intensity: 'medium', intensityScore: 1, time: 'present', relief: false, care: null,
        mixed: false, ask: null, about: null, corrections: [], emoji: [], learned: [], masking: false, event: null, confidence: 0,
        normalised: ' ', words: 0
    });

    /**
     * Read one message. Pure; run it once per message.
     * @param {string} text
     * @param {{ lexicon?: Set<string> }} [options] lexicon: real words (the Gita's own) never "corrected"
     * @returns {{ feelings: {id: string, score: number}[], primary: string|null, topics: string[], intensity: 'low'|'medium'|'high',
     *   intensityScore: number, time: 'past'|'present'|'future', relief: boolean, care: {relation: string, state: string}|null,
     *   ask: 'vent'|'how'|'why'|'verse'|null, about: string|null, corrections: {from: string, to: string}[], emoji: string[],
     *   confidence: number, normalised: string, words: number }}
     */
    // "I'm fine, I guess" after something heavy is rarely fine.
    const MASKING_TERMS = ['fine i guess', 'im fine i guess', 'i guess im fine', 'its nothing', 'it doesnt matter', 'doesnt matter',
        'never mind', 'nevermind', 'nvm', 'its fine', 'im fine', 'i am fine', 'whatever', 'forget it', 'leave it', 'sab theek hai',
        'theek hoon', 'koi baat nahi', 'chhodo', 'कोई बात नहीं', 'सब ठीक है', 'छोड़ो'];

    // Something coming up that Sakha can ask about afterwards — as a label
    // and a day, never the words.
    const EVENT_KINDS = {
        exam: ['exam', 'exams', 'test', 'mock test', 'paper', 'boards', 'board exam', 'neet', 'jee', 'upsc', 'cat exam', 'pariksha',
            'परीक्षा', 'इम्तिहान', 'पेपर'],
        interview: ['interview', 'interviews', 'इंटरव्यू'],
        surgery: ['surgery', 'operation', 'ऑपरेशन'],
        results: ['result', 'results', 'रिज़ल्ट', 'नतीजा', 'नतीजे'],
        presentation: ['presentation', 'pitch', 'viva', 'demo'],
        appointment: ['appointment', 'scan', 'biopsy', 'checkup', 'check up'],
        wedding: ['wedding', 'शादी'],
        hearing: ['hearing', 'court date'],
        match: ['match', 'tournament', 'competition', 'performance', 'audition']
    };
    const EVENT_WHEN = [
        ['dayafter', ['day after tomorrow', 'parso', 'परसों']],
        ['tomorrow', ['tomorrow', 'kal', 'कल']],
        ['today', ['today', 'tonight', 'this evening', 'aaj', 'आज']],
        ['nextweek', ['next week', 'agle hafte', 'अगले हफ़्ते', 'अगले सप्ताह']],
        ['monday', ['monday', 'on monday']], ['tuesday', ['tuesday']], ['wednesday', ['wednesday']], ['thursday', ['thursday']],
        ['friday', ['friday']], ['saturday', ['saturday']], ['sunday', ['sunday']]
    ];

    function eventIn(normalised) {
        const kind = Object.keys(EVENT_KINDS).find((id) => EVENT_KINDS[id].some((term) => has(normalised, term)));
        if (!kind) return null;
        const when = EVENT_WHEN.find(([, terms]) => terms.some((term) => has(normalised, term)));
        return when ? { kind, when: when[0] } : null;
    }

    function understand(text, { lexicon = null, personal = null } = {}) {
        if (!text || typeof text !== 'string') return { ...EMPTY_READING };
        const raw = text.slice(0, 4000);
        const emoji = emojiFeelings(raw);
        const { text: normalised, corrections } = correctSpelling(normalise(raw), lexicon);
        if (normalised.trim() === '' && !emoji.size) return { ...EMPTY_READING };

        const clauses = splitClauses(normalised);
        const scores = new Map();
        const where = new Map(); // feeling → its strongest mention: { clause, index, score }
        const multipliers = [];

        clauses.forEach((clause, clauseIndex) => {
            Object.entries(EMOTIONS).forEach(([id, emotion]) => {
                emotion.terms.forEach((term) => {
                    const index = findTerm(clause.text, term);
                    if (index === -1 || negated(clause.text, index, term.split(' ').length)) return;
                    const before = clause.text.slice(0, index).trim().split(' ').slice(-2);
                    const multiplier = before.some((word) => INTENSIFIERS.has(word)) ? 1.5 : before.some((word) => DIMINISHERS.has(word)) ? 0.6 : 1;
                    multipliers.push(multiplier);
                    const score = (term.includes(' ') ? 2 : 1) * clause.weight * multiplier;
                    scores.set(id, (scores.get(id) || 0) + score);
                    if (!where.has(id) || score > where.get(id).score) where.set(id, { clause: clauseIndex, index, score, span: term.split(' ').length });
                });
            });
        });
        emoji.forEach((count, id) => scores.set(id, (scores.get(id) || 0) + count));

        // Words this person has taught Sakha: for them, "meh" means sad.
        const learnedHits = [];
        if (personal && typeof personal === 'object') {
            Object.entries(personal).forEach(([phrase, feelings]) => {
                if (typeof phrase !== 'string' || !phrase.trim() || !feelings || typeof feelings !== 'object') return;
                const index = findTerm(normalised, phrase);
                if (index === -1 || negated(normalised, index, phrase.split(' ').length)) return;
                const [feeling, count] = Object.entries(feelings).filter(([id]) => EMOTIONS[id]).sort((a, b) => b[1] - a[1])[0] || [];
                if (!feeling) return;
                scores.set(feeling, (scores.get(feeling) || 0) + Math.min(2, 1 + (Number(count) || 0) * 0.25));
                learnedHits.push(phrase);
            });
        }

        // A light feeling leads only when it clearly outweighs a heavy one:
        // "my friends are moving on and I feel stuck" is not joy.
        const anyHeavy = [...scores.keys()].some((id) => !LIGHT.includes(id));
        const feelings = [...scores.entries()]
            .map(([id, score]) => ({ id, score: score - (LIGHT.includes(id) && anyHeavy ? 1.5 : 0) }))
            .sort((a, b) => b.score - a.score || SPECIFICITY.indexOf(a.id) - SPECIFICITY.indexOf(b.id));

        // When it happened, and whether it has eased.
        const sortFeelings = () => feelings.sort((a, b) => b.score - a.score || SPECIFICITY.indexOf(a.id) - SPECIFICITY.indexOf(b.id));
        const heaviest = () => feelings.find((feeling) => !LIGHT.includes(feeling.id)) || null;
        let topHeavy = heaviest();
        let heavyAt = topHeavy ? where.get(topHeavy.id) || null : null;
        const time = timeOf(heavyAt ? clauses[heavyAt.clause].text : normalised);
        // "I'm scared I'll fail" is fear of failing, not a failure.
        if (time === 'future' && topHeavy?.id === 'failure' && feelings.some((feeling) => feeling.id === 'fear' || feeling.id === 'anxiety')) {
            topHeavy.score -= 1;
            sortFeelings();
            topHeavy = heaviest();
            heavyAt = where.get(topHeavy.id) || null;
        }
        const reliefAt = clauses.findIndex((clause) => reliefIn(clause.text));
        const relief = reliefAt !== -1 && (!heavyAt || reliefAt >= heavyAt.clause || time === 'past');
        if (relief) {
            const peace = feelings.find((feeling) => feeling.id === 'peace');
            if (peace) peace.score += 3;
            else feelings.push({ id: 'peace', score: 3 });
            sortFeelings();
        }

        // Good news of their own beside the heavy part: "I got the job, but…".
        const light = feelings.find((feeling) => LIGHT.includes(feeling.id) && where.has(feeling.id));
        const lightAt = light ? where.get(light.id) : null;
        const mixed = Boolean(topHeavy && lightAt && !relief && lightAt.clause !== heavyAt?.clause
            && ownedBySelf(clauses[lightAt.clause], lightAt.index, lightAt.span));

        // Whose feeling is it — theirs, or someone they love?
        const topics = topicsIn(normalised);
        const grieving = topics.includes('loss') || topHeavy?.id === 'grief';
        const care = grieving ? null : careIn(clauses, heavyAt, topHeavy, normalised);
        if (care) {
            care.own = heavyAt && ownedBySelf(clauses[heavyAt.clause], heavyAt.index, heavyAt.span) ? topHeavy.id : null;
            // Worry, when nothing is said yet about how they are.
            care.mode = care.kind === 'worry' && care.state === 'mind' ? 'worry' : care.state;
        }

        const { ask, about } = askOf(normalised);
        const { score: intensityScore, level: intensity } = intensityOf(raw, multipliers);
        const best = feelings[0]?.score || 0;
        const confidence = Math.min(1, Math.max(0, best) / 2 + (topics.length ? 0.35 : 0) + (ask ? 0.25 : 0) + (care ? 0.4 : 0));

        return {
            feelings,
            primary: feelings[0]?.id || null,
            topics,
            intensity,
            intensityScore,
            time,
            relief,
            mixed,
            care,
            ask,
            about,
            corrections,
            emoji: [...emoji.keys()],
            learned: learnedHits,
            masking: wordCount(normalised) <= 8 && MASKING_TERMS.some((term) => has(normalised, term)),
            event: eventIn(normalised),
            confidence: Math.round(confidence * 100) / 100,
            normalised,
            words: wordCount(normalised)
        };
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
    const NO_WARMTH_NEEDED = ['peace', 'gratitude', 'love', 'devotion'];

    // Someone already ashamed should not be handed a verse about sinners.
    const SHAME_SENSITIVE = ['lust', 'unworthiness', 'emptiness', 'sadness', 'loneliness', 'heartbreak', 'failure', 'craving'];
    const SHAME_WORDS = /\b(sin|sins|sinful|sinner|sinners|demon\w*|hell|wicked|evil-doer\w*)\b/i;

    // The plain-words headline is what a person reads first; the classic verses
    // on desire (3.37–41) may say "sin" in full translation, and stay welcome.
    function shameFraming(verse, profile) {
        if (!SHAME_SENSITIVE.includes(profile.primary) && !profile.care) return 0;
        let penalty = 0;
        if (SHAME_WORDS.test(verse.notification_short?.en || '')) penalty -= 22;
        if (/\b(sinners?|most sinful)\b/i.test(verse.meaning_en || '')) penalty -= 14;
        return penalty;
    }

    function warmth(tones, themes, profile) {
        if (NO_WARMTH_NEEDED.includes(profile.primary)) return 0;
        let delta = 0;
        if (tones.some((tone) => WARM_TONES.includes(tone))) delta += 10;
        if (tones.some((tone) => COLD_TONES.includes(tone))) delta -= 14;
        if (themes.some((theme) => COLD_THEMES.some((cold) => theme.includes(cold)))) delta -= 14;
        return delta;
    }

    // Rare words carry meaning: "chemotherapy" says more than "life". Each word
    // a person uses is weighed by how few verses mention it (inverse document
    // frequency), so even words no lexicon lists still find their verse.
    const indexCache = typeof WeakMap === 'function' ? new WeakMap() : null;

    function verseWords(verse) {
        const parts = [verse.meaning_en, verse.meaning_hi, verse.notification_short?.en, verse.notification_short?.hi,
            ...(verse.life_situations || []), ...(verse.core_theme || [])];
        return normalise(parts.filter(Boolean).join(' ')).trim().split(' ').filter((word) => word.length > 2 && word !== '|');
    }

    function corpusIndex(verses) {
        if (indexCache && indexCache.has(verses)) return indexCache.get(verses);
        const df = new Map();
        // Every word the Gita's text uses is a real word, never a typo to correct.
        const lexicon = new Set();
        verses.forEach((verse) => {
            const words = verseWords(verse);
            words.forEach((word) => lexicon.add(word));
            new Set(words.map(stem)).forEach((root) => df.set(root, (df.get(root) || 0) + 1));
        });
        // Each verse's fields, lower-cased once, and what each concept or word
        // matches across the whole Gita — worked out the first time it is
        // needed and remembered, so a reply costs lookups, not scans.
        const prepared = new Map(verses.map((verse) => [verse.id, {
            tones: lower(verse.emotional_tone),
            themes: lower(verse.core_theme),
            situations: lower(verse.life_situations),
            meaning: (verse.meaning_en || '').toLowerCase(),
            meaningHi: verse.meaning_hi || '',
            short: `${verse.notification_short?.en || ''} ${verse.notification_short?.hi || ''}`.toLowerCase()
        }]));
        prepared.forEach((fields) => { fields.paths = pathsOf(fields); });
        const index = { df, lexicon, prepared, conceptHits: new Map(), wordHits: new Map(), size: verses.length || 1 };
        if (indexCache) indexCache.set(verses, index);
        return index;
    }

    function idf(index, root) {
        const count = index.df.get(root);
        return count ? Math.log(1 + index.size / count) : 0;
    }

    function remembered(cache, key, build) {
        if (!cache.has(key)) {
            if (cache.size > 4000) cache.clear();
            cache.set(key, build());
        }
        return cache.get(key);
    }

    // Points each verse earns for one concept (before its weight).
    function conceptHits(index, concept) {
        return remembered(index.conceptHits, concept, () => {
            const hits = new Map();
            index.prepared.forEach((fields, id) => {
                let points = 0;
                if (fields.tones.some((tone) => conceptMatches(tone, concept))) points += 12;
                if (fields.situations.some((situation) => situation.includes(concept))) points += 10;
                if (fields.themes.some((theme) => conceptMatches(theme, concept))) points += 8;
                if (concept.length > 3 && fields.meaning.includes(concept)) points += 2;
                if (points) hits.set(id, points);
            });
            return hits;
        });
    }

    // Points each verse earns for one of the person's own words (before its rarity).
    function wordHits(index, root) {
        return remembered(index.wordHits, root, () => {
            const hits = new Map();
            index.prepared.forEach((fields, id) => {
                let points = 0;
                if (fields.situations.some((situation) => situation.includes(root))) points += 2;
                if (fields.themes.some((theme) => theme.includes(root))) points += 1.6;
                if (fields.short.includes(root)) points += 1.4;
                if (fields.meaning.includes(root) || fields.meaningHi.includes(root)) points += 0.6;
                if (points) hits.set(id, points);
            });
            return hits;
        });
    }

    function scoreVerse(verse, profile, context) {
        const { helpsByChapter, index, resonance, concepts, words } = context;
        let score = verse.meaning_en ? 10 : 0;
        const { tones, themes, paths = [] } = index.prepared.get(verse.id) || { tones: lower(verse.emotional_tone), themes: lower(verse.core_theme) };

        concepts.forEach(({ hits, weight }) => { score += (hits.get(verse.id) || 0) * weight; });
        // The person's own words, matched against what each verse is about,
        // weighted by how rare each word is in the Gita.
        words.forEach(({ hits, weight }) => { score += (hits.get(verse.id) || 0) * weight; });

        score += profile.anchors?.get(verse.id) || 0;

        // Verses about death and rebirth are for grief and for fear of dying —
        // not for an ordinary low day.
        const fields = index.prepared.get(verse.id);
        if (!profile.deathWelcome && fields && DEATH_THEMES.test(`${themes.join(' ')} ${fields.situations.join(' ')} ${fields.short}`)) score -= 18;

        // The path that has helped this person before.
        if (profile.paths && paths.length) score += 18 * Math.max(...paths.map((id) => profile.paths[id] || 0));

        // Verses like the ones this person has kept before speak their language.
        if (resonance.chapters.has(verse.chapter)) score += 2;
        if (themes.some((theme) => resonance.themes.has(theme))) score += 3;

        // Chapter relevance counts once, not once per tag.
        const helps = helpsByChapter.get(verse.chapter) || [];
        const chapterHits = profile.concepts.filter(({ concept }) => helps.some((h) => h.includes(concept) || concept.includes(h))).length;
        score += Math.min(chapterHits, 2) * 4;

        if (profile.timeOfDay && themes.some((theme) => TIME_CONCEPTS[profile.timeOfDay]?.some((t) => theme.includes(t)))) score += 2;
        if (verse.notification_short && verse.notification_short.en) score += 2;
        if (isNarrative(verse)) score -= 40;
        score += warmth(tones, themes, profile);
        score += shameFraming(verse, profile);

        return score;
    }

    // When a person names no feeling and no situation, lean toward verses that
    // steady and console rather than toward whatever their words brush against.
    const COMFORT_CONCEPTS = ['reassuring', 'hope', 'comforting', 'peace', 'enduring a hard time', 'divine assurance', 'encouraging'];
    const COMFORT_ANCHORS = ['2_14', '9_22', '18_66', '2_40', '6_5', '5_29'];

    // Caring for someone is its own situation: the verse is chosen for the one
    // who cares, not for the feeling they describe in someone else.
    const CARE = {
        health: { anchors: ['6_32', '2_13', '18_66', '9_22', '12_13', '2_14'], concepts: ['compassion', 'caring', 'service', 'enduring a hard time', 'divine assurance'] },
        mind: { anchors: ['6_32', '12_13', '9_22', '18_66', '2_47', '5_29'], concepts: ['compassion', 'friendship', 'kindness', 'caring', 'patience'] },
        worry: { anchors: ['9_22', '18_66', '2_47', '6_32', '2_14', '12_13'], concepts: ['divine assurance', 'surrender', 'faith', 'protection', 'caring'] }
    };

    // Situations someone can ask Sakha to keep in mind ("I'm preparing for
    // UPSC", "my mother has dementia"), answered as part of their life.
    const STANDING_TOPICS = ['study', 'work', 'family', 'marriage', 'health', 'loss', 'money', 'future', 'love', 'friendship', 'faith',
        'habits', 'decision', 'conflict'];

    // What someone looking after a loved one often feels, and is answered as a carer.
    const CARER_FEELINGS = ['sadness', 'stress', 'anxiety', 'fear', 'loneliness', 'emptiness', 'guilt', 'inertia'];
    // Feelings that usually belong to a person's whole situation (not anger or
    // envy, which are about something in particular).
    const STANDING_FEELINGS = [...CARER_FEELINGS, 'failure', 'unworthiness', 'confusion', 'purpose', 'heartbreak', 'grief'];

    function standingOf(person, lexicon) {
        const note = typeof person?.context === 'string' ? person.context.trim().slice(0, 600) : '';
        if (!note) return null;
        const read = understand(note, { lexicon });
        if (read.care) {
            return { topics: read.care.state === 'health' ? ['health', 'family'] : ['family'], care: { relation: read.care.relation, state: read.care.state } };
        }
        const topics = read.topics.filter((id) => STANDING_TOPICS.includes(id));
        return topics.length ? { topics, care: null } : null;
    }

    function standingLabel(standing, lang) {
        if (standing.care) {
            const who = RELATION_NAMES[standing.care.relation][lang];
            if (lang === 'hi') return `${who} की ${standing.care.state === 'health' ? 'सेहत' : 'हालत'}`;
            return `${who}’s ${standing.care.state === 'health' ? 'health' : 'wellbeing'}`;
        }
        return TOPICS[standing.topics[0]].label[lang];
    }

    function buildProfile({ text, mood, history = [], timeOfDay, person = null, reading = null, lexicon = null, retry = null }) {
        const read = reading || understand(text, { lexicon });
        const care = read.care;
        // "A verse about patience": the subject they ask for is the whole need.
        const subject = read.ask === 'verse' && read.about ? understand(read.about, { lexicon }) : null;
        const textEmotions = subject ? subject.feelings.map((feeling) => feeling.id)
            : care && !care.own ? [] : read.feelings.map((feeling) => feeling.id);
        // A follow-up like "how do I live this?" carries the feeling from before.
        const carried = textEmotions.length || care || subject ? [] : detectEmotions(history.slice(-3).join(' '));
        const moodEmotion = emotionFromMood(mood);
        const emotions = [...new Set([...textEmotions, ...carried, ...(moodEmotion ? [moodEmotion] : [])])].slice(0, 3);

        const weights = new Map();
        const addConcepts = (name, weight) => {
            (EMOTIONS[name]?.concepts || []).forEach((concept) => weights.set(concept, Math.max(weights.get(concept) || 0, weight)));
        };
        textEmotions.forEach((name, index) => addConcepts(name, index === 0 ? 1 : 0.7));
        carried.forEach((name) => addConcepts(name, 0.6));
        if (moodEmotion) addConcepts(moodEmotion, text && textEmotions.length ? 0.5 : 1);

        // What the feeling is about: their situation, or the one from earlier.
        const textTopics = subject ? subject.topics : read.topics;
        const carriedTopics = textTopics.length || subject ? [] : detectTopics(history.slice(-3).join(' '));
        let topics = [...new Set([...textTopics, ...carriedTopics])].slice(0, 3);
        // Nothing said about what it is about? What they told Sakha about
        // their life is part of the answer ("I'm so tired" while preparing for exams).
        const firstFeeling = textEmotions[0] || carried[0] || moodEmotion;
        const standing = !topics.length && !care && !subject && STANDING_FEELINGS.includes(firstFeeling) ? standingOf(person, lexicon) : null;
        if (standing) topics = standing.topics.slice(0, 2);
        const carer = standing?.care && CARER_FEELINGS.includes(firstFeeling)
            ? { ...standing.care, mode: standing.care.state, kind: 'standing', own: firstFeeling } : null;
        const caring = care || carer;
        // For a carer, the situation is the backdrop; the verse is for them.
        const topicScale = caring ? 0.5 : 1;
        topics.forEach((id, index) => {
            TOPICS[id].concepts.forEach((concept) => weights.set(concept, Math.max(weights.get(concept) || 0, (index === 0 ? 0.55 : 0.35) * topicScale)));
        });
        if (caring) CARE[caring.mode].concepts.forEach((concept) => weights.set(concept, Math.max(weights.get(concept) || 0, 0.8)));
        if ((!emotions.length && !topics.length && !care && !subject) || retry === 'comfort') {
            COMFORT_CONCEPTS.forEach((concept) => weights.set(concept, Math.max(weights.get(concept) || 0, retry === 'comfort' ? 0.8 : 0.35)));
        }

        // A situation named without a feeling ("my investors pulled out") still
        // carries one; take the feeling most people in that place would have.
        // (Also when the only feeling is carried over from earlier: a new, serious situation is answered for itself.)
        const inferred = !textEmotions.length && !caring && !subject && textTopics.length && read.words >= 6 ? TOPIC_DEFAULT[textTopics[0]] || null : null;
        if (inferred) addConcepts(inferred, 0.5);

        // Hand-chosen verses for this feeling and situation come first.
        const anchors = new Map();
        const anchor = (ids, top, step) => (ids || []).forEach((id, index) => anchors.set(id, Math.max(anchors.get(id) || 0, top - index * step)));
        if (caring) anchor(CARE[caring.mode].anchors, 30, 2);
        emotions.forEach((name, index) => anchor(ANCHORS.emotions[name], index === 0 ? (caring ? 12 : 26) : 10, index === 0 ? 2 : 1));
        if (inferred) anchor(ANCHORS.emotions[inferred], 14, 1);
        if ((!emotions.length && !topics.length && !caring && !subject) || retry === 'comfort') anchor(COMFORT_ANCHORS, 18, 1);
        const topicTop = caring ? 6 : standing ? 9 : 16;
        topics.forEach((id, index) => anchor(ANCHORS.topics[id], index === 0 ? topicTop : (caring ? 3 : 8), index === 0 ? 2 : 1));

        // A free-text mood such as a chapter theme ("fear of death") is a
        // concept too — and so is the subject of a verse they ask for.
        const freeText = subject ? read.about : mood && !MOOD_TO_EMOTION[String(mood).toLowerCase()] ? String(mood).toLowerCase() : null;
        if (freeText) weights.set(freeText, Math.max(weights.get(freeText) || 0, subject ? 1 : 0.8));

        return {
            emotions,
            primary: textEmotions[0] || carried[0] || moodEmotion || null,
            fresh: textEmotions[0] || null,
            concepts: [...weights.entries()].map(([concept, weight]) => ({ concept, weight })),
            keywords: contentKeywords(subject ? read.about : read.normalised),
            topics,
            inferred,
            anchors,
            care: caring,
            ask: read.ask,
            about: read.about,
            relief: read.relief,
            intensity: read.intensity,
            time: read.time,
            standing,
            paths: pathAffinity(person, retry),
            // Grief, fear, illness, or a question about death: verses on death belong here.
            deathWelcome: ['grief', 'fear'].includes(textEmotions[0] || carried[0] || moodEmotion) || topics.includes('loss') || topics.includes('health')
                || Boolean(caring) || /death|die|soul|rebirth|atman|mort/.test(String(mood || '')),
            resonant: Array.isArray(person?.resonant) ? person.resonant.slice(0, 40) : [],
            timeOfDay
        };
    }

    // -----------------------------------------------------------------------
    // The four paths. The Gita offers more than one way through: action
    // (karma), understanding (jñāna), devotion (bhakti) and stillness
    // (dhyāna). Each person leans toward one; Sakha learns which, on their
    // device, and leans with them.
    // -----------------------------------------------------------------------

    const PATHS = {
        karma: ['action', 'duty', 'duties', 'work', 'karma', 'effort', 'service', 'svadharma', 'swadharma', 'sacrifice', 'yajna',
            'responsib', 'perform', 'leadership', 'fruits', 'determination', 'do your', 'deeds'],
        jnana: ['knowledge', 'wisdom', 'soul', 'self-realization', 'atman', 'eternal', 'understand', 'discrimination', 'intellect',
            'truth', 'brahman', 'ignorance', 'impermanen', 'clarity', 'realiz', 'immortal', 'never born', 'unchanging', 'wise'],
        bhakti: ['devotion', 'devotee', 'surrender', 'faith', 'worship', 'grace', 'refuge', 'dear to me', 'dear to god', 'offer',
            'remember me', 'think of me', 'friend of all', 'beloved', 'take refuge'],
        dhyana: ['meditat', 'stillness', 'still mind', 'discipline', 'senses', 'sense control', 'breath', 'pranayama', 'concentrat',
            'samadhi', 'solitude', 'restless', 'self-control', 'calm', 'posture', 'pratyahara', 'steady mind', 'control the mind',
            'mind is', 'quiet']
    };
    const PATH_IDS = Object.keys(PATHS);
    const DEATH_THEMES = /\b(death|dying|die|dies|slain|killing|reincarnation|rebirth|immortal\w*|never born|garments|bodies|transmigration|goodbye|grief|mourning|funeral|loss of a)\b/;

    function pathsOf(fields) {
        const headline = `${fields.themes.join(' ')} ${fields.situations.join(' ')} ${fields.short}`;
        const scores = PATH_IDS.map((id) => ({
            id,
            score: PATHS[id].reduce((sum, term) => sum + (headline.includes(term) ? 2 : 0) + (fields.meaning.includes(term) ? 1 : 0), 0)
        }));
        const top = Math.max(...scores.map((item) => item.score));
        if (top < 2) return [];
        return scores.filter((item) => item.score >= Math.max(2, top * 0.6)).map((item) => item.id);
    }

    function versePaths(verses, id) {
        return verses.length ? corpusIndex(verses).prepared.get(id)?.paths || [] : [];
    }

    // How strongly this person leans to each path, 0–1: what they chose,
    // what has helped them, and what they just asked for ("something practical").
    const RETRY_LEANS = { practical: 'karma', deeper: 'jnana', comfort: 'bhakti' };

    function pathAffinity(person, retry) {
        const raw = {};
        PATH_IDS.forEach((id) => {
            const value = Number(person?.paths?.[id]);
            raw[id] = Number.isFinite(value) && value > 0 ? value : 0;
        });
        const top = Math.max(...Object.values(raw));
        const affinity = {};
        PATH_IDS.forEach((id) => { affinity[id] = top > 0 ? raw[id] / top : 0; });
        if (retry && RETRY_LEANS[retry]) affinity[RETRY_LEANS[retry]] = Math.max(affinity[RETRY_LEANS[retry]], retry === 'comfort' ? 0.6 : 1);
        return Object.values(affinity).some((value) => value > 0) ? affinity : null;
    }

    function rankVerses(verses, chapters, profile) {
        const helpsByChapter = new Map((chapters || []).map((chapter) => [chapter.chapter, lower(chapter.helps_with)]));
        const index = corpusIndex(verses);
        const kept = new Set(profile.resonant || []);
        const resonance = { chapters: new Set(), themes: new Set() };
        if (kept.size) {
            verses.forEach((verse) => {
                if (!kept.has(verse.id)) return;
                resonance.chapters.add(verse.chapter);
                lower(verse.core_theme).forEach((theme) => resonance.themes.add(theme));
            });
        }
        const concepts = profile.concepts.map(({ concept, weight }) => ({ hits: conceptHits(index, concept), weight }));
        const words = profile.keywords.map(stem).filter((root) => root.length >= 3)
            .map((root) => ({ hits: wordHits(index, root), weight: Math.min(idf(index, root), 4.5) }))
            .filter((word) => word.weight > 0);
        const context = { helpsByChapter, index, resonance, concepts, words };
        return verses
            .map((verse) => ({ verse, score: scoreVerse(verse, profile, context) }))
            .sort((a, b) => b.score - a.score);
    }

    // Choose among the strongest few, weighted towards the best, never
    // repeating what this person has recently been shown.
    // focused: a verse asked for by subject — only the closest few will do.
    function pickVerse(ranked, { exclude = [], random = Math.random, focused = false } = {}) {
        const excluded = new Set(exclude);
        const pool = ranked.filter((item) => !excluded.has(item.verse.id));
        const candidates = (pool.length ? pool : ranked).slice(0, 12);
        if (!candidates.length) return null;
        const best = candidates[0].score;
        const floor = best > 0 ? best * (focused ? 0.88 : 0.7) : best - 1;
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

    const LIGHT_REFLECTIONS = {
        en: ['Here is a verse to carry this with you.', 'The Gita has a word for moments like this.', 'A verse to hold alongside this feeling.'],
        hi: ['इस भाव के साथ रखने के लिए एक श्लोक।', 'ऐसे पलों के लिए गीता के पास एक बात है।', 'इस एहसास के साथ थामने को एक श्लोक।']
    };

    const LIGHT_GROUNDING = {
        en: ['Let yourself enjoy this fully.', 'Remember how this feels — it will steady you on harder days.', 'Stay with this a moment longer.'],
        hi: ['इसका पूरा आनंद लीजिए।', 'याद रखिए यह कैसा लगता है — कठिन दिनों में यही आपको स्थिर रखेगा।', 'इसके साथ एक पल और रहिए।']
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

    // Warning signs short of crisis: answered with the verse, and a quiet
    // reminder that a human is a phone call away.
    const CONCERN_TERMS = ['a burden', 'burden to', 'cant do this anymore', 'cannot do this anymore', 'no way out', 'trapped',
        'nothing matters', 'feel like disappearing', 'want to vanish', 'no point anymore', 'whats the point of anything',
        'kuch matter nahi karta',
        'want to disappear', 'giving up', 'give up', 'tired of everything', 'nobody would care', 'no one would care',
        'nobody would notice', 'hopeless', 'thak gaya hoon zindagi se', 'sab khatam', 'बोझ हूँ', 'सब ख़त्म', 'सब खत्म'];

    const CONCERN_LINE = {
        en: 'If these thoughts ever turn toward hurting yourself, please reach a person — Tele-MANAS (14416, India) is free and answers at any hour. You deserve that care.',
        hi: 'अगर ये विचार कभी ख़ुद को चोट पहुँचाने की ओर मुड़ें, तो कृपया किसी इंसान से बात कीजिए — टेली-मानस (14416) निःशुल्क है और हर समय उपलब्ध है। आप उस देखभाल के हक़दार हैं।'
    };

    function detectConcern(text) {
        const normalised = normalise(text);
        return normalised !== ' ' && CONCERN_TERMS.some((term) => has(normalised, term));
    }

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

    // Feelings added in engine 3: desire, emptiness, ego, romantic love, devotion, inertia.
    Object.assign(GUIDANCE, {
        lust: {
            practice: 'breaths',
            en: {
                bridge: 'Desire is not shameful. The Gita even says the Divine is present in desire that does not go against dharma (7.11). What it warns about is being ruled by it — the quiet slide from dwelling on something, to attachment, to craving, to frustration (2.62–63). The answer is not hating yourself; it is catching the very first thought, and giving that energy somewhere better (2.59).',
                step: 'When the pull comes, don’t argue with it — stand up, take three slow breaths, and change what your hands are doing for ten minutes.'
            },
            hi: {
                bridge: 'इच्छा शर्म की बात नहीं है। गीता तो यहाँ तक कहती है कि जो काम धर्म के विरुद्ध नहीं, उसमें ईश्वर स्वयं है (7.11)। गीता जिससे सावधान करती है, वह है उसके वश में हो जाना — किसी बात पर बार-बार सोचना, फिर आसक्ति, फिर लालसा, फिर झुँझलाहट (2.62–63)। उत्तर स्वयं से घृणा करना नहीं, बल्कि पहले ही विचार को पकड़ना और उस ऊर्जा को किसी बेहतर दिशा में देना है (2.59)।',
                step: 'जब खिंचाव आए, उससे बहस मत कीजिए — उठिए, तीन धीमी साँसें लीजिए, और दस मिनट के लिए अपने हाथों का काम बदल दीजिए।'
            }
        },
        emptiness: {
            practice: 'dhyana',
            en: {
                bridge: 'Feeling empty is not proof that nothing is there. The Gita says there is a joy within you that depends on nothing outside (5.21) — covered, not gone. Arjuna, too, felt the meaning drain out of everything before he found it again (2.7).',
                step: 'Do one small thing today only because it is good — water a plant, call someone, step outside. Meaning often returns through the hands before the head.'
            },
            hi: {
                bridge: 'ख़ालीपन महसूस करना इस बात का प्रमाण नहीं कि भीतर कुछ नहीं है। गीता कहती है कि आपके भीतर एक आनंद है जो बाहर की किसी चीज़ पर निर्भर नहीं (5.21) — ढका हुआ है, गया नहीं। अर्जुन ने भी सब कुछ अर्थहीन होते देखा था, फिर उसे दोबारा पाया (2.7)।',
                step: 'आज एक छोटा काम सिर्फ़ इसलिए कीजिए क्योंकि वह अच्छा है — पौधे को पानी, किसी को फ़ोन, बाहर कुछ क़दम। अर्थ अक्सर मन से पहले हाथों के रास्ते लौटता है।'
            }
        },
        pride: {
            practice: 'japa',
            en: {
                bridge: 'Noticing your own ego is rarer than you think — most people never do. The Gita names humility as the first mark of real knowledge (13.8), and reminds us that it is the deluded who think "I alone am the doer" (3.27). Much of what you are good at was, in some part, given.',
                step: 'Today, give one person credit out loud for something you would usually take credit for yourself.'
            },
            hi: {
                bridge: 'अपना अहंकार पहचान पाना जितना लगता है उससे दुर्लभ है — अधिकतर लोग कभी नहीं पहचानते। गीता विनम्रता को सच्चे ज्ञान का पहला लक्षण बताती है (13.8), और याद दिलाती है कि मोहग्रस्त ही सोचता है "मैं अकेला कर्ता हूँ" (3.27)। आप जिसमें अच्छे हैं, उसका बहुत कुछ किसी न किसी रूप में दिया हुआ है।',
                step: 'आज किसी एक व्यक्ति को उस बात का श्रेय खुलकर दीजिए जिसका श्रेय आप आमतौर पर स्वयं लेते हैं।'
            }
        },
        love: {
            practice: 'journal',
            en: {
                bridge: 'Love is one of the ways the Divine shows itself — "whatever is beautiful comes from a spark of my splendour" (10.41). The Gita’s only caution is about clinging: love that needs to possess turns into worry (2.62). Love that wishes the other well, whatever happens, stays light (12.13).',
                step: 'Do one kind thing for them today that asks for nothing back.'
            },
            hi: {
                bridge: 'प्रेम उन रास्तों में से है जिनसे ईश्वर स्वयं को प्रकट करते हैं — "जो कुछ भी सुंदर है, वह मेरे तेज के अंश से है" (10.41)। गीता की एकमात्र सावधानी जकड़ने के बारे में है: जो प्रेम अधिकार चाहता है, वह चिंता बन जाता है (2.62)। जो प्रेम हर हाल में दूसरे का भला चाहता है, वह हल्का रहता है (12.13)।',
                step: 'आज उनके लिए एक ऐसा अच्छा काम कीजिए जो बदले में कुछ न माँगे।'
            }
        },
        devotion: {
            practice: 'japa',
            en: {
                bridge: 'This longing is itself the answer. "As people approach me, so I receive them" (4.11) — and the Gita asks for nothing grand: a leaf, a flower, a little water, offered with love (9.26). The Divine’s longing for you is older than yours (9.29).',
                step: 'Offer the first act of tomorrow — a glass of water, a breath, a word — silently, as a gift.'
            },
            hi: {
                bridge: 'यह चाह स्वयं उत्तर है। "जो जैसे मेरी ओर आता है, मैं उसे वैसे ही स्वीकार करता हूँ" (4.11) — और गीता कुछ बड़ा नहीं माँगती: एक पत्ता, एक फूल, थोड़ा जल, प्रेम से अर्पित (9.26)। आपके लिए ईश्वर की चाह आपकी चाह से पुरानी है (9.29)।',
                step: 'कल का पहला काम — एक गिलास पानी, एक साँस, एक शब्द — मौन में, एक भेंट की तरह अर्पित कीजिए।'
            }
        },
        inertia: {
            practice: 'sankalpa',
            en: {
                bridge: 'Heaviness like this is tamas — the guṇa of inertia — and the Gita meets it kindly but firmly: "Stand up" (2.3). Action is better than inaction (3.8), and you are your own best friend when you lift yourself, even a little (6.5). Motivation usually comes after starting, not before.',
                step: 'Pick the smallest possible version of the thing — two minutes of it — and do only that, right now.'
            },
            hi: {
                bridge: 'ऐसा भारीपन तमस् है — जड़ता का गुण — और गीता उससे दयालु पर दृढ़ होकर मिलती है: "उठो" (2.3)। कर्म न करने से कर्म करना श्रेष्ठ है (3.8), और जब आप स्वयं को थोड़ा भी ऊपर उठाते हैं, तब आप अपने सबसे अच्छे मित्र होते हैं (6.5)। प्रेरणा अक्सर शुरू करने के बाद आती है, पहले नहीं।',
                step: 'उस काम का सबसे छोटा संभव रूप चुनिए — बस दो मिनट का — और अभी सिर्फ़ वही कीजिए।'
            }
        }
    });

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
    // Voice — how a friend would first answer each feeling. Spoken to the
    // person, never about them.
    // -----------------------------------------------------------------------

    const VOICE = {
        anxiety: {
            en: ['That sounds like a lot of worry to carry.', 'I can hear how much this is weighing on your mind.'],
            hi: ['यह बहुत सारी चिंता है उठाने को।', 'मैं समझ सकता हूँ कि यह आपके मन पर कितना भारी है।']
        },
        fear: {
            en: ['I can hear how scared you’re — and that is okay.', 'Fear like this is so human.'],
            hi: ['मैं समझ सकता हूँ कि आप कितने डरे हुए हैं — और यह ठीक है।', 'ऐसा डर बहुत मानवीय है।']
        },
        stress: {
            en: ['It sounds like you’re carrying too much right now.', 'That’s a lot of pressure for one person.'],
            hi: ['लगता है आप इस समय बहुत कुछ उठाए हुए हैं।', 'एक व्यक्ति के लिए यह बहुत दबाव है।']
        },
        anger: {
            en: ['That sounds really frustrating. Your anger makes sense.', 'Anger usually means something important was hurt.'],
            hi: ['यह सचमुच झुँझलाने वाला लगता है। आपका गुस्सा समझ में आता है।', 'गुस्से का अर्थ अक्सर होता है कि कुछ ज़रूरी चीज़ आहत हुई है।']
        },
        sadness: {
            en: ['I’m sorry you’re feeling this low.', 'That sounds heavy. Thank you for not keeping it inside.'],
            hi: ['मुझे दुख है कि आप इतना उदास महसूस कर रहे हैं।', 'यह भारी लगता है। इसे भीतर न रखने के लिए धन्यवाद।']
        },
        grief: {
            en: ['I’m so sorry for your loss.', 'Grief is love with nowhere to go. I’m here.'],
            hi: ['आपके खोने का मुझे बहुत दुख है।', 'शोक वह प्रेम है जिसे जाने की कोई जगह नहीं मिलती। मैं यहाँ हूँ।']
        },
        loneliness: {
            en: ['Feeling alone is so hard. I’m glad you wrote.', 'You’re not as alone as it feels right now — I’m here.'],
            hi: ['अकेलापन बहुत कठिन होता है। मुझे ख़ुशी है कि आपने लिखा।', 'आप उतने अकेले नहीं जितना इस समय लगता है — मैं यहाँ हूँ।']
        },
        confusion: {
            en: ['Not knowing which way to go is unsettling.', 'It’s okay not to have the answer yet.'],
            hi: ['किस ओर जाएँ, यह न जानना बेचैन करता है।', 'अभी उत्तर न होना ठीक है।']
        },
        guilt: {
            en: ['Carrying guilt is exhausting. It also shows how much you care.', 'Regret like this means your conscience is alive.'],
            hi: ['अपराधबोध ढोना थका देता है। यह यह भी दिखाता है कि आपको कितनी परवाह है।', 'ऐसा पछतावा बताता है कि आपका विवेक जीवित है।']
        },
        unworthiness: {
            en: ['It hurts to feel like you’re not enough.', 'The voice telling you that you’re not enough isn’t the whole truth.'],
            hi: ['यह महसूस करना दुख देता है कि आप पर्याप्त नहीं।', 'जो आवाज़ कहती है कि आप पर्याप्त नहीं, वह पूरा सच नहीं है।']
        },
        failure: {
            en: ['Falling short of something you worked for really hurts.', 'A setback like this can shake you. It doesn’t define you.'],
            hi: ['जिसके लिए मेहनत की, उसमें पीछे रह जाना सचमुच दुख देता है।', 'ऐसी ठोकर हिला सकती है। पर वह आपकी पहचान नहीं।']
        },
        envy: {
            en: ['Comparison can quietly steal so much joy.', 'Envy is very human. Noticing it’s the first step.'],
            hi: ['तुलना चुपचाप बहुत सारा आनंद चुरा लेती है।', 'ईर्ष्या बहुत मानवीय है। इसे पहचान लेना पहला क़दम है।']
        },
        heartbreak: {
            en: ['I’m so sorry. Heartbreak is one of the hardest pains there is.', 'When someone we love leaves, the whole world tilts.'],
            hi: ['मुझे बहुत दुख है। दिल टूटना सबसे कठिन दर्दों में से है।', 'जब कोई प्रिय चला जाता है, तो पूरी दुनिया डगमगा जाती है।']
        },
        purpose: {
            en: ['Searching for your purpose is a meaningful search.', 'Wanting your life to mean something is a good sign.'],
            hi: ['अपने उद्देश्य की खोज एक सार्थक खोज है।', 'जीवन को अर्थपूर्ण बनाने की चाह एक अच्छा संकेत है।']
        },
        craving: {
            en: ['Cravings can be so strong. Wanting to be free of them takes courage.', 'That pull is real — and so is your wish to be free.'],
            hi: ['लालसाएँ बहुत प्रबल हो सकती हैं। उनसे मुक्त होना चाहना साहस है।', 'वह खिंचाव सच्चा है — और मुक्त होने की आपकी चाह भी।']
        },
        lust: {
            en: ['Thank you for being honest about this. Desire is human — nothing here is judged.', 'It takes honesty to name this. There is no shame here.'],
            hi: ['इस बारे में ईमानदार होने के लिए धन्यवाद। इच्छा मानवीय है — यहाँ कुछ भी परखा नहीं जाता।', 'इसे नाम देने के लिए ईमानदारी चाहिए। यहाँ कोई शर्म नहीं।']
        },
        emptiness: {
            en: ['Feeling empty is its own kind of heavy.', 'Numbness is often a tired heart, resting. I’m here.'],
            hi: ['ख़ालीपन अपने ढंग का भारीपन है।', 'सुन्नपन अक्सर एक थका हुआ हृदय होता है जो विश्राम कर रहा है। मैं यहाँ हूँ।']
        },
        pride: {
            en: ['Noticing your own ego takes real honesty.', 'It’s rare, and good, that you can see this in yourself.'],
            hi: ['अपना अहंकार पहचानने के लिए सच्ची ईमानदारी चाहिए।', 'यह दुर्लभ और अच्छा है कि आप इसे अपने भीतर देख पा रहे हैं।']
        },
        love: {
            en: ['How lovely — love changes everything it touches.', 'That’s a beautiful thing to feel.'],
            hi: ['कितना सुंदर — प्रेम जिसे छूता है, उसे बदल देता है।', 'यह महसूस करना कितना सुंदर है।']
        },
        devotion: {
            en: ['That longing for the Divine is precious.', 'What a beautiful thing to want.'],
            hi: ['ईश्वर के लिए यह चाह अनमोल है।', 'कितनी सुंदर चाह है।']
        },
        inertia: {
            en: ['Feeling stuck is frustrating — and very common.', 'Some days everything feels heavy to start.'],
            hi: ['अटका हुआ महसूस करना झुँझलाने वाला है — और बहुत आम भी।', 'कुछ दिन हर शुरुआत भारी लगती है।']
        },
        peace: {
            en: ['What a gift, to feel this stillness.', 'Peace like this is worth noticing.'],
            hi: ['इस स्थिरता को महसूस करना कितना बड़ा उपहार है।', 'ऐसी शांति पर ध्यान देना चाहिए।']
        },
        gratitude: {
            en: ['That’s wonderful — I’m glad with you.', 'Joy deserves to be noticed. Thank you for bringing it here.'],
            hi: ['यह बहुत अच्छा है — मुझे आपके साथ ख़ुशी है।', 'आनंद पर ध्यान दिया जाना चाहिए। इसे यहाँ लाने के लिए धन्यवाद।']
        }
    };

    // -----------------------------------------------------------------------
    // Anchors — verses chosen by hand for each feeling and each situation.
    // They are the first place the engine looks; everything else it finds is
    // weighed against them. (Checked line by line against the corpus.)
    // -----------------------------------------------------------------------

    const ANCHORS = {
        emotions: {
            anxiety: ['2_47', '18_66', '9_22', '2_48', '6_35', '2_14'],
            fear: ['2_23', '18_66', '4_10', '9_31', '2_40', '6_40', '2_20'],
            stress: ['2_48', '2_50', '5_10', '6_17', '18_66', '2_47'],
            anger: ['2_63', '2_62', '5_26', '16_2', '12_13', '2_56', '5_23'],
            sadness: ['2_14', '6_5', '6_22', '9_22', '18_66', '2_3'],
            grief: ['2_20', '2_22', '2_13', '2_11', '2_27', '2_12'],
            loneliness: ['6_30', '4_3', '18_64', '5_29', '9_29', '10_20', '18_61'],
            confusion: ['18_63', '3_35', '2_7', '18_47', '2_41', '4_34'],
            guilt: ['4_36', '9_30', '18_66', '6_40', '4_37', '9_31'],
            unworthiness: ['6_5', '9_29', '18_64', '12_14', '6_6', '15_7'],
            failure: ['2_40', '2_47', '6_40', '2_48', '2_38', '4_22', '6_44'],
            envy: ['3_35', '18_47', '16_3', '4_22', '6_32', '12_13'],
            heartbreak: ['2_14', '2_70', '5_21', '2_71', '6_30', '2_62'],
            purpose: ['3_35', '18_46', '18_47', '3_19', '2_50', '18_45'],
            craving: ['2_62', '3_39', '6_35', '2_59', '5_22', '2_58', '6_26'],
            lust: ['7_11', '2_62', '3_37', '3_41', '2_59', '6_35', '2_60'],
            emptiness: ['5_21', '6_22', '6_20', '15_7', '2_20', '6_5'],
            pride: ['13_8', '3_27', '16_4', '12_13', '18_58', '5_18'],
            love: ['12_13', '10_41', '6_32', '9_29', '12_14'],
            devotion: ['9_26', '9_22', '4_11', '18_65', '12_8', '9_34'],
            inertia: ['2_3', '3_8', '6_5', '6_16', '18_39', '6_17'],
            peace: ['6_19', '2_70', '2_71', '5_29', '6_27', '6_15'],
            gratitude: ['9_26', '9_27', '10_41', '2_48', '12_14']
        },
        topics: {
            work: ['2_47', '3_8', '2_50', '18_46', '3_19', '3_35'],
            study: ['2_47', '2_40', '6_5', '2_48', '6_26', '2_41'],
            family: ['12_13', '6_9', '12_15', '16_3', '5_18', '3_20'],
            love: ['12_13', '2_62', '2_14', '6_32', '2_71'],
            friendship: ['12_13', '6_9', '4_3', '5_29', '12_18'],
            health: ['2_14', '2_23', '6_17', '18_66', '2_20', '9_22'],
            loss: ['2_20', '2_22', '2_13', '2_27', '2_11'],
            money: ['9_22', '4_22', '2_47', '2_70', '18_66'],
            future: ['18_66', '9_22', '2_47', '6_40', '2_40'],
            faith: ['9_22', '4_11', '9_26', '7_21', '7_16', '18_65'],
            meaning: ['3_35', '2_20', '15_7', '18_46', '10_20'],
            self: ['6_5', '6_6', '3_35', '9_29', '12_14'],
            habits: ['6_26', '6_35', '6_5', '2_58', '3_41', '6_17'],
            sleep: ['6_17', '6_19', '2_70', '18_66', '5_21'],
            decision: ['18_63', '3_35', '18_47', '2_41', '2_48'],
            marriage: ['3_35', '18_63', '2_48', '12_13', '18_47'],
            conflict: ['12_13', '16_3', '12_18', '2_56', '16_2'],
            injustice: ['5_15', '12_18', '2_47', '18_66', '2_38', '6_32']
        }
    };

    // When someone names a situation but no feeling ("my investors pulled
    // out"), this is the feeling most people in that place carry.
    const TOPIC_DEFAULT = {
        work: 'anxiety', study: 'anxiety', family: 'sadness', love: 'confusion', friendship: 'sadness', health: 'anxiety',
        loss: 'grief', money: 'anxiety', future: 'anxiety', faith: 'confusion', meaning: 'confusion', self: 'unworthiness',
        habits: 'guilt', decision: 'confusion', marriage: 'stress', conflict: 'anger', injustice: 'anger', sleep: 'anxiety'
    };

    // -----------------------------------------------------------------------
    // Counsel — what the Gita says to a feeling inside a particular life.
    //   ack:    the first words, naming both ("…about your career")
    //   bridge: the teaching, carried into that situation
    //   step:   one small thing to do today
    // -----------------------------------------------------------------------

    const COUNSEL = {
        'anxiety:work': {
            en: {
                ack: 'It’s frightening when your work and your future feel uncertain.',
                bridge: 'Worry about a career lives in a future that has not happened yet. Krishna\'s answer to Arjuna was not "everything will work out" — it was "your right is to the work, never to its fruits" (2.47). Today\'s effort is yours; the result was never yours to carry. And nothing sincere is wasted: even a little of this effort protects you from great fear (2.40).',
                step: 'Write down the one piece of work that is truly in your hands this week. Give it your best hour tomorrow — and let the rest wait.'
            },
            hi: {
                ack: 'जब काम और आगे का रास्ता अनिश्चित लगे, तो डर लगना स्वाभाविक है।',
                bridge: 'करियर की चिंता उस भविष्य में रहती है जो अभी आया ही नहीं। अर्जुन को कृष्ण का उत्तर "सब ठीक हो जाएगा" नहीं था, बल्कि "तुम्हारा अधिकार कर्म पर है, फल पर कभी नहीं" (2.47)। आज का प्रयास आपका है; परिणाम का बोझ कभी आपका था ही नहीं। और सच्चा प्रयास व्यर्थ नहीं जाता — इसका थोड़ा-सा भी बड़े भय से बचाता है (2.40)।',
                step: 'इस सप्ताह जो एक काम सचमुच आपके हाथ में है, उसे लिख लीजिए। कल अपना सबसे अच्छा एक घंटा उसे दीजिए — बाक़ी को इंतज़ार करने दीजिए।'
            }
        },
        'anxiety:study': {
            en: {
                ack: 'Exam worry can make every hour feel like it’s being measured.',
                bridge: 'The Gita was spoken to someone frozen before the biggest test of his life. Its advice: put your whole heart into the preparation, and loosen your grip on the result (2.47). Marks are a fruit — they come later, and they are not the measure of you. Even a little steady effort counts forever (2.40).',
                step: 'Plan only today\'s study, in three small blocks. When your mind runs to the result, bring it gently back to the page — again and again (6.26).'
            },
            hi: {
                ack: 'परीक्षा की चिंता हर घंटे को नापा-तौला सा महसूस कराती है।',
                bridge: 'गीता उस व्यक्ति से कही गई थी जो अपने जीवन की सबसे बड़ी परीक्षा से पहले जम गया था। उसकी सलाह: तैयारी में पूरा मन लगाइए, और नतीजे पर पकड़ ढीली कीजिए (2.47)। अंक फल हैं — वे बाद में आते हैं, और वे आपकी पहचान नहीं। थोड़ा-सा स्थिर प्रयास भी हमेशा गिना जाता है (2.40)।',
                step: 'सिर्फ़ आज की पढ़ाई तय कीजिए, तीन छोटे हिस्सों में। जब मन नतीजे की ओर भागे, उसे धीरे से पन्ने पर लौटाइए — बार-बार (6.26)।'
            }
        },
        'anxiety:future': {
            en: {
                ack: 'Not knowing what is ahead can keep the mind running all night.',
                bridge: 'The Gita does not hand you a map of the future. It offers something steadier: "I carry what you lack and protect what you have" (9.22). Your part is the next right step; the road beyond it is held by something larger than your worry. "Do not grieve" (18.66) was said to people standing exactly where you are.',
                step: 'Write the question that scares you. Under it, write only the next step you can take this week. Leave the rest of the page empty — it is not yours yet.'
            },
            hi: {
                ack: 'आगे क्या होगा, यह न जानना मन को रात भर दौड़ाता रहता है।',
                bridge: 'गीता भविष्य का नक़्शा नहीं देती। वह कुछ ज़्यादा स्थिर देती है: "जो तुम्हारे पास नहीं, वह मैं लाता हूँ; जो है, उसकी रक्षा करता हूँ" (9.22)। आपका काम अगला सही क़दम है; उसके आगे का रास्ता आपकी चिंता से कहीं बड़ी शक्ति ने थामा है। "शोक मत करो" (18.66) ठीक आपकी जगह खड़े लोगों से कहा गया था।',
                step: 'जो प्रश्न आपको डराता है, उसे लिखिए। उसके नीचे सिर्फ़ वह अगला क़दम लिखिए जो आप इस सप्ताह उठा सकते हैं। बाक़ी पन्ना ख़ाली छोड़ दीजिए — वह अभी आपका नहीं।'
            }
        },
        'anxiety:health': {
            en: {
                ack: 'When it’s your body — or the body of someone you love — fear goes very deep.',
                bridge: 'The Gita\'s first comfort is about exactly this: the body changes, as it did from childhood to youth to age, but what you truly are is untouched (2.13, 2.23). That does not make the hospital less real. It means the fear does not get the last word. Do what the doctors ask, and let the rest be carried (18.66).',
                step: 'Before the next appointment, sit for one minute and breathe slowly. Say quietly: "My body is being cared for. I am more than my body."'
            },
            hi: {
                ack: 'जब बात अपने शरीर की हो — या किसी अपने के — तो डर बहुत गहरा उतरता है।',
                bridge: 'गीता की पहली सांत्वना ठीक इसी के बारे में है: शरीर बदलता है, जैसे बचपन से जवानी और बुढ़ापे तक, पर आप जो सचमुच हैं, उसे कुछ नहीं छूता (2.13, 2.23)। इससे अस्पताल कम सच नहीं हो जाता। इसका अर्थ है कि अंतिम शब्द डर का नहीं होगा। डॉक्टर जो कहें, वह कीजिए — और बाक़ी को थामे जाने दीजिए (18.66)।',
                step: 'अगली मुलाक़ात से पहले एक मिनट बैठकर धीरे साँस लीजिए। मन में कहिए: "मेरे शरीर की देखभाल हो रही है। मैं अपने शरीर से कहीं अधिक हूँ।"'
            }
        },
        'anxiety:money': {
            en: {
                ack: 'Money worries have a way of following you into every room.',
                bridge: 'The Gita is honest that we must act — "action is better than inaction" (3.8). It also says the one who leans on the Divine is looked after: "I carry what you lack and preserve what you have" (9.22). Do the practical things fully. Then let contentment with what is here (4.22) quiet the voice that says it is never enough.',
                step: 'Write every money worry on one page, with one small action beside each. Do the smallest one today. Paper holds fear better than the mind does.'
            },
            hi: {
                ack: 'पैसों की चिंता हर कमरे तक आपके पीछे-पीछे चली आती है।',
                bridge: 'गीता साफ़ कहती है कि कर्म ज़रूरी है — "कर्म न करने से कर्म करना श्रेष्ठ है" (3.8)। वह यह भी कहती है कि जो ईश्वर पर भरोसा रखता है, उसकी देखभाल होती है: "जो तुम्हारे पास नहीं, वह मैं लाता हूँ; जो है, उसकी रक्षा करता हूँ" (9.22)। व्यावहारिक काम पूरे मन से कीजिए। फिर जो पास है उसमें संतोष (4.22) उस आवाज़ को शांत करे जो कहती है कि कभी काफ़ी नहीं।',
                step: 'हर चिंता एक पन्ने पर लिखिए, और हर एक के आगे एक छोटा क़दम। सबसे छोटा आज कर डालिए। काग़ज़ डर को मन से बेहतर थामता है।'
            }
        },
        'anxiety:family': {
            en: {
                ack: 'Worrying about the people you love is one of the heaviest kinds of worry.',
                bridge: 'You can love your family fully and still not control what happens to them. The Gita asks for exactly that balance: care with your whole heart, act where you can, and leave the outcome to a hand larger than yours (2.47, 18.66). Your steadiness is itself a gift to them.',
                step: 'Do one caring thing for them today that is fully in your hands — a call, a meal, a word. Let that be enough for today.'
            },
            hi: {
                ack: 'अपनों की चिंता सबसे भारी चिंताओं में से एक है।',
                bridge: 'आप अपने परिवार से पूरा प्रेम कर सकते हैं और फिर भी जो उनके साथ होता है, उस पर नियंत्रण नहीं रख सकते। गीता ठीक यही संतुलन माँगती है: पूरे हृदय से परवाह कीजिए, जहाँ कर सकते हैं वहाँ कर्म कीजिए, और परिणाम उस हाथ पर छोड़िए जो आपसे बड़ा है (2.47, 18.66)। आपकी स्थिरता अपने आप में उनके लिए एक उपहार है।',
                step: 'आज उनके लिए एक ऐसा काम कीजिए जो पूरी तरह आपके हाथ में हो — एक फ़ोन, एक भोजन, एक बात। आज के लिए उतना काफ़ी है।'
            }
        },
        'anxiety:love': {
            en: {
                ack: 'Love can make the heart restless — wondering, waiting, overthinking.',
                bridge: 'The Gita knows how the mind works: dwelling on someone becomes attachment, attachment becomes longing, longing becomes restlessness (2.62). The way out is not to love less, but to cling less — to care for them and let them be free. A love that does not grasp can finally rest (2.71).',
                step: 'For today, do not check, do not re-read, do not rehearse conversations. Each time the thought comes, breathe once and wish them well.'
            },
            hi: {
                ack: 'प्रेम मन को बेचैन कर सकता है — सोचते, इंतज़ार करते, ज़रूरत से ज़्यादा सोचते।',
                bridge: 'गीता मन की चाल पहचानती है: किसी के बारे में बार-बार सोचना आसक्ति बनता है, आसक्ति लालसा, और लालसा बेचैनी (2.62)। रास्ता कम प्रेम करना नहीं, कम जकड़ना है — उनकी परवाह करना और उन्हें स्वतंत्र रहने देना। जो प्रेम पकड़ता नहीं, वह आख़िरकार विश्राम कर पाता है (2.71)।',
                step: 'आज न जाँचिए, न दोबारा पढ़िए, न बातचीत का अभ्यास कीजिए। हर बार जब विचार आए, एक साँस लीजिए और उनके लिए शुभकामना कीजिए।'
            }
        },
        'stress:work': {
            en: {
                ack: 'It sounds like work is asking for more than you have right now.',
                bridge: 'The Gita calls yoga "skill in action" (2.50) — and skill includes knowing what not to carry. Do your work as an offering, fully, without welding yourself to every outcome (2.47). And it is practical about the body: rest and work in balance (6.17). Exhaustion is not devotion.',
                step: 'List everything on your plate. Circle the three things that truly matter this week. For one other item, ask for help — or let it go.'
            },
            hi: {
                ack: 'लगता है काम इस समय आपसे उससे ज़्यादा माँग रहा है जितना आपके पास है।',
                bridge: 'गीता योग को "कर्मों में कुशलता" कहती है (2.50) — और कुशलता में यह जानना भी शामिल है कि क्या नहीं उठाना। अपना काम अर्पण की तरह, पूरे मन से कीजिए, पर हर परिणाम से ख़ुद को जोड़े बिना (2.47)। गीता शरीर के बारे में भी व्यावहारिक है: काम और विश्राम में संतुलन (6.17)। थककर चूर होना भक्ति नहीं है।',
                step: 'अपने सारे काम लिखिए। इस सप्ताह सचमुच ज़रूरी तीन पर गोला बनाइए। किसी एक और काम के लिए मदद माँगिए — या उसे छोड़ दीजिए।'
            }
        },
        'stress:study': {
            en: {
                ack: 'So much to study and so little time — that pressure is real.',
                bridge: 'Arjuna, too, felt the weight of everything at once. Krishna\'s advice was to steady the mind before acting: "evenness of mind is yoga" (2.48). One focused hour is worth more than five anxious ones — the Gita praises a mind that is one-pointed (2.41).',
                step: 'Choose one subject and one chapter for the next hour. Phone in another room. When the hour ends, take three breaths before the next.'
            },
            hi: {
                ack: 'इतना पढ़ना और इतना कम समय — यह दबाव सच्चा है।',
                bridge: 'अर्जुन ने भी सब कुछ एक साथ का बोझ महसूस किया था। कृष्ण की सलाह थी कि कर्म से पहले मन को स्थिर करो: "समत्वं योग उच्यते" (2.48)। एकाग्र एक घंटा घबराए हुए पाँच घंटों से बेहतर है — गीता एकनिष्ठ बुद्धि की प्रशंसा करती है (2.41)।',
                step: 'अगले एक घंटे के लिए एक विषय और एक अध्याय चुनिए। फ़ोन दूसरे कमरे में। घंटा पूरा होने पर अगले से पहले तीन साँसें लीजिए।'
            }
        },
        'stress:marriage': {
            en: {
                ack: 'Pressure about marriage from the people you love is one of the hardest kinds — love and duty pulling in different directions.',
                bridge: 'The Gita was spoken to someone caught between loyalty to his family and what he knew was right. Its answer was neither rebellion nor giving in, but clarity: know your own dharma (3.35), act from steadiness rather than fear (2.48), and speak honestly — "reflect on this fully, then do as you wish" (18.63). You can honour your family and still be truthful about your own heart.',
                step: 'Write, in three sentences, what you want them to understand. Choose a calm moment — not during an argument — and say just those three sentences.'
            },
            hi: {
                ack: 'अपनों की ओर से शादी का दबाव सबसे कठिन दबावों में से है — प्रेम और कर्तव्य अलग-अलग दिशाओं में खींचते हैं।',
                bridge: 'गीता उस व्यक्ति से कही गई थी जो अपने परिवार के प्रति निष्ठा और जो उसे सही लगता था, उसके बीच फँसा था। उसका उत्तर न विद्रोह था, न हार मान लेना — बल्कि स्पष्टता: अपना धर्म पहचानो (3.35), डर से नहीं, स्थिरता से कर्म करो (2.48), और ईमानदारी से बात करो — "इस पर पूरी तरह विचार करो, फिर जैसा चाहो वैसा करो" (18.63)। आप अपने परिवार का सम्मान करते हुए भी अपने मन के प्रति सच्चे रह सकते हैं।',
                step: 'तीन वाक्यों में लिखिए कि आप उन्हें क्या समझाना चाहते हैं। कोई शांत पल चुनिए — झगड़े के बीच नहीं — और सिर्फ़ वही तीन वाक्य कहिए।'
            }
        },
        'anxiety:sleep': {
            en: {
                ack: 'A mind that won’t switch off makes the night very long.',
                bridge: 'At night the mind replays and rehearses, because it is trying to keep you safe. The Gita’s image of a settled mind is "a lamp in a windless place" (6.19) — not a mind with no thoughts, but one the wind no longer pushes around. Nothing has to be solved before morning. Balance in sleep and waking is itself part of yoga (6.17).',
                step: 'Keep a notebook by your bed. Write each circling thought as one line, and tell yourself: "It’s on the page — I can pick it up tomorrow." Then breathe out slowly, longer than you breathe in.'
            },
            hi: {
                ack: 'जो मन बंद ही न हो, वह रात को बहुत लंबा बना देता है।',
                bridge: 'रात में मन बातें दोहराता और पहले से अभ्यास करता है, क्योंकि वह आपको सुरक्षित रखना चाहता है। गीता में शांत मन की छवि है "वायुरहित स्थान में दीपक" (6.19) — ऐसा मन जिसमें विचार न हों, ऐसा नहीं; बल्कि ऐसा जिसे हवा अब इधर-उधर नहीं धकेलती। सुबह से पहले कुछ भी सुलझाना ज़रूरी नहीं। सोने और जागने में संतुलन स्वयं योग का हिस्सा है (6.17)।',
                step: 'बिस्तर के पास एक कॉपी रखिए। हर घूमता विचार एक पंक्ति में लिखिए, और स्वयं से कहिए: "यह पन्ने पर है — कल उठा लूँगा/लूँगी।" फिर धीरे साँस छोड़िए, लेने से ज़्यादा लंबी।'
            }
        },
        'unworthiness:work': {
            en: {
                ack: 'Feeling like the least capable person in the room is exhausting.',
                bridge: 'Comparison at work makes someone else’s strengths the measure of your worth. The Gita says your own way of working, even imperfect, is better than imitating another’s (3.35) — and that what is yours is the quality of your effort, not how it ranks (2.47). Most people in that room feel the same way, quietly.',
                step: 'Write three things you did well at work this month. Then ask one colleague the question you have been afraid to ask — curiosity is not weakness.'
            },
            hi: {
                ack: 'कमरे में सबसे कम सक्षम होने का एहसास बहुत थका देता है।',
                bridge: 'काम पर तुलना किसी और की ख़ूबियों को आपके मूल्य का पैमाना बना देती है। गीता कहती है कि आपका अपना काम करने का ढंग, अधूरा भी, किसी और की नक़ल से बेहतर है (3.35) — और आपका है आपके प्रयास का गुण, न कि उसकी रैंक (2.47)। उस कमरे में ज़्यादातर लोग चुपचाप ऐसा ही महसूस करते हैं।',
                step: 'इस महीने काम पर आपने जो तीन चीज़ें अच्छी कीं, उन्हें लिखिए। फिर किसी सहकर्मी से वह प्रश्न पूछिए जिसे पूछने से आप डरते रहे हैं — जिज्ञासा कमज़ोरी नहीं है।'
            }
        },
        'guilt:love': {
            en: {
                ack: 'Carrying what you did in a relationship is heavy — and it says something good that it weighs on you.',
                bridge: 'The Gita does not excuse wrong action, and it does not condemn the person who did it. Even the most burdened can cross over (4.36), and honest knowledge — seeing clearly what happened and why — burns old actions the way fire burns wood (4.37). The way forward is truth and repair, not endless shame.',
                step: 'Write honestly what happened and what led to it. Then choose one truthful step — a conversation, an apology, a boundary — and take it from steadiness, not panic.'
            },
            hi: {
                ack: 'रिश्ते में आपने जो किया, उसे ढोना भारी है — और यह अच्छी बात कहता है कि वह आपको भारी लग रहा है।',
                bridge: 'गीता ग़लत कर्म को उचित नहीं ठहराती, और उसे करने वाले व्यक्ति को दोषी भी नहीं ठहराती। सबसे भारी बोझ वाला भी पार हो सकता है (4.36), और सच्चा ज्ञान — साफ़ देखना कि क्या हुआ और क्यों — पुराने कर्मों को वैसे जला देता है जैसे आग लकड़ी को (4.37)। आगे का रास्ता सच और सुधार है, अंतहीन शर्म नहीं।',
                step: 'ईमानदारी से लिखिए कि क्या हुआ और किस वजह से हुआ। फिर एक सच्चा क़दम चुनिए — एक बातचीत, एक माफ़ी, एक सीमा — और उसे घबराहट से नहीं, स्थिरता से उठाइए।'
            }
        },
        'stress:family': {
            en: {
                ack: 'Carrying everyone at home can leave no room for you.',
                bridge: 'Duty to family is real dharma — but the Gita never asks you to break while doing it. It praises the one "by whom no one is disturbed, and who is disturbed by no one" (12.15). Care for them, and let some of the weight rest on God, not only on you (18.66).',
                step: 'Take fifteen minutes today that belong only to you — a walk, a cup of tea, silence. It is not selfish; it is how you keep giving.'
            },
            hi: {
                ack: 'घर में सबका बोझ उठाते-उठाते अपने लिए कोई जगह नहीं बचती।',
                bridge: 'परिवार के प्रति कर्तव्य सच्चा धर्म है — पर गीता कभी नहीं कहती कि उसे निभाते हुए आप टूट जाएँ। वह उसकी प्रशंसा करती है "जिससे कोई व्याकुल नहीं होता और जो किसी से व्याकुल नहीं होता" (12.15)। उनकी देखभाल कीजिए, और थोड़ा बोझ ईश्वर पर भी रहने दीजिए, सिर्फ़ आप पर नहीं (18.66)।',
                step: 'आज पंद्रह मिनट सिर्फ़ अपने लिए रखिए — एक सैर, एक कप चाय, थोड़ा मौन। यह स्वार्थ नहीं; इसी से आप देते रह पाते हैं।'
            }
        },
        'sadness:love': {
            en: {
                ack: 'When love hurts, the sadness reaches everywhere.',
                bridge: 'The Gita does not tell you not to feel this. It tells you that feelings — even this one — come and go like seasons (2.14), and that you are the one who remains. There is a joy within you that no one else gave you, so no one can take it away (5.21).',
                step: 'Write them a letter you will never send. Say everything. Then close the page — you have let it out without needing anything back.'
            },
            hi: {
                ack: 'जब प्रेम दुख देता है, तो उदासी हर जगह फैल जाती है।',
                bridge: 'गीता यह नहीं कहती कि ऐसा महसूस मत कीजिए। वह कहती है कि भाव — यह भाव भी — ऋतुओं की तरह आते-जाते हैं (2.14), और आप वह हैं जो बने रहते हैं। आपके भीतर एक आनंद है जो किसी और ने नहीं दिया, इसलिए कोई छीन भी नहीं सकता (5.21)।',
                step: 'उन्हें एक पत्र लिखिए जो आप कभी नहीं भेजेंगे। सब कुछ कह दीजिए। फिर पन्ना बंद कर दीजिए — आपने बदले में कुछ चाहे बिना मन हल्का कर लिया।'
            }
        },
        'sadness:family': {
            en: {
                ack: 'Sadness at home is hard, because home is where we go to feel better.',
                bridge: 'The Gita sees family clearly — love, duty, and hurt too. It asks for a heart that is "friendly and compassionate to all, without ill will" (12.13), and that includes you. You can love them and still be hurt by them. Both can be true.',
                step: 'Tell one person in your family one true, gentle sentence about how you feel — or write it first, if saying it is too hard.'
            },
            hi: {
                ack: 'घर में उदासी कठिन होती है, क्योंकि घर ही वह जगह है जहाँ हम बेहतर महसूस करने जाते हैं।',
                bridge: 'गीता परिवार को साफ़ देखती है — प्रेम, कर्तव्य, और चोट भी। वह ऐसा हृदय माँगती है जो "सबके प्रति मित्रवत और करुणामय हो, द्वेष से रहित" (12.13) — और इसमें आप स्वयं भी शामिल हैं। आप उनसे प्रेम कर सकते हैं और फिर भी उनसे आहत हो सकते हैं। दोनों सच हो सकते हैं।',
                step: 'परिवार में किसी एक से अपने मन की एक सच्ची, कोमल बात कहिए — या अगर कहना कठिन हो, तो पहले लिख लीजिए।'
            }
        },
        'sadness:friendship': {
            en: {
                ack: 'Feeling distant from friends can make the whole world feel quieter.',
                bridge: 'Friendships change, and it hurts when they do. The Gita\'s ideal is a heart that stays "the same toward friend and foe" (12.18) — not cold, but steady, so your worth does not rise and fall with who replies. And Krishna himself says, "I am the friend of all beings" (5.29). You are never without a friend.',
                step: 'Reach out to one person you have not spoken to in a while — no reason needed. Just: "thinking of you."'
            },
            hi: {
                ack: 'दोस्तों से दूरी पूरी दुनिया को थोड़ा और ख़ामोश कर देती है।',
                bridge: 'दोस्तियाँ बदलती हैं, और जब बदलती हैं तो दुख होता है। गीता का आदर्श ऐसा हृदय है जो "मित्र और शत्रु के प्रति समान रहे" (12.18) — ठंडा नहीं, स्थिर — ताकि आपका मूल्य इस पर न टिका हो कि किसका जवाब आया। और कृष्ण स्वयं कहते हैं, "मैं सब प्राणियों का मित्र हूँ" (5.29)। आप कभी मित्रहीन नहीं हैं।',
                step: 'किसी ऐसे व्यक्ति से संपर्क कीजिए जिससे बहुत दिनों से बात नहीं हुई — बिना किसी कारण के। बस: "तुम्हारी याद आई।"'
            }
        },
        'sadness:self': {
            en: {
                ack: 'It hurts to feel this way about yourself.',
                bridge: 'The Gita has a striking line: "you are your own best friend, and your own worst enemy" (6.5). Right now the voice inside is being an enemy. The practice is to lift yourself by your own self — to start speaking to yourself the way a true friend would.',
                step: 'Write the harshest thing you said to yourself this week. Beside it, write what a loving friend would say instead. Read the second one aloud.'
            },
            hi: {
                ack: 'अपने बारे में ऐसा महसूस करना दुख देता है।',
                bridge: 'गीता की एक अद्भुत पंक्ति है: "मनुष्य स्वयं ही अपना मित्र है और स्वयं ही अपना शत्रु" (6.5)। इस समय भीतर की आवाज़ शत्रु बनी हुई है। अभ्यास यह है कि स्वयं से स्वयं को ऊपर उठाएँ — अपने आप से वैसे बात करना शुरू करें जैसे एक सच्चा मित्र करता।',
                step: 'इस सप्ताह आपने स्वयं से जो सबसे कठोर बात कही, उसे लिखिए। उसके आगे लिखिए कि एक प्रेम करने वाला मित्र उसकी जगह क्या कहता। दूसरी पंक्ति ज़ोर से पढ़िए।'
            }
        },
        'grief:loss': {
            en: {
                ack: 'I’m so sorry. Losing someone changes the shape of every day.',
                bridge: 'The Gita\'s very first teaching was spoken to a man overwhelmed by grief. Its comfort is this: the one you love was never only a body. "As a person sets aside worn-out clothes and puts on new ones" (2.22), so the self moves on — it was not born and does not die (2.20). Your love for them does not end either. It changes form, as they did.',
                step: 'Write down one memory of them as fully as you can — the room, the voice, the words. Keep it in your journal.'
            },
            hi: {
                ack: 'मुझे बहुत दुख है। किसी को खोना हर दिन का आकार बदल देता है।',
                bridge: 'गीता की पहली शिक्षा शोक में डूबे एक व्यक्ति से कही गई थी। उसकी सांत्वना यह है: जिन्हें आप प्रेम करते हैं, वे कभी केवल शरीर नहीं थे। "जैसे मनुष्य पुराने वस्त्र छोड़कर नए पहनता है" (2.22), वैसे ही आत्मा आगे बढ़ती है — वह न जन्मी, न मरती है (2.20)। उनके लिए आपका प्रेम भी समाप्त नहीं होता। वह रूप बदलता है, जैसे उन्होंने बदला।',
                step: 'उनकी एक याद जितनी पूरी हो सके उतनी लिखिए — वह कमरा, वह आवाज़, वे शब्द। उसे अपनी डायरी में रख लीजिए।'
            }
        },
        'anger:family': {
            en: {
                ack: 'Anger at family is complicated — because you also love them.',
                bridge: 'The Gita takes anger seriously: it clouds memory and judgment, and we say things we cannot take back (2.63). It does not ask you to pretend nothing happened. It asks you to wait until the fire settles, then speak from steadiness, not heat. Forgiveness, it says, is a mark of a divine heart (16.3) — when you are ready, not before.',
                step: 'Before you say anything, take three slow breaths and wait an hour. Then write, in one sentence, what you actually need from them.'
            },
            hi: {
                ack: 'परिवार पर गुस्सा उलझा हुआ होता है — क्योंकि आप उनसे प्रेम भी करते हैं।',
                bridge: 'गीता क्रोध को गंभीरता से लेती है: वह स्मृति और विवेक को ढक देता है, और हम ऐसी बातें कह देते हैं जो वापस नहीं ले सकते (2.63)। वह यह नहीं कहती कि ऐसा दिखाइए जैसे कुछ हुआ ही नहीं। वह कहती है कि आग ठंडी होने तक रुकिए, फिर गर्मी से नहीं, स्थिरता से बोलिए। क्षमा, वह कहती है, दैवी हृदय का लक्षण है (16.3) — जब आप तैयार हों, उससे पहले नहीं।',
                step: 'कुछ कहने से पहले तीन धीमी साँसें लीजिए और एक घंटा रुकिए। फिर एक वाक्य में लिखिए कि आपको उनसे वास्तव में क्या चाहिए।'
            }
        },
        'anger:work': {
            en: {
                ack: 'Anger at work is hard — you often can’t even show it.',
                bridge: 'The Gita\'s advice for the workplace is surprisingly modern: do your part with excellence (2.50), and do not let someone else\'s behaviour decide your state of mind. The one "who is not disturbed by others" (12.15) keeps their power. Anger, it warns, ends in poor judgment (2.63) — exactly what you cannot afford at work.',
                step: 'Write the message you want to send — then do not send it. Tomorrow, rewrite it with only the facts and one clear request.'
            },
            hi: {
                ack: 'काम पर गुस्सा कठिन है — अक्सर आप उसे दिखा भी नहीं सकते।',
                bridge: 'दफ़्तर के लिए गीता की सलाह आश्चर्यजनक रूप से आधुनिक है: अपना काम उत्कृष्टता से कीजिए (2.50), और किसी और के व्यवहार को अपने मन की स्थिति तय न करने दीजिए। "जो दूसरों से व्याकुल नहीं होता" (12.15), उसकी शक्ति उसके पास रहती है। क्रोध, वह चेताती है, विवेक के नाश में समाप्त होता है (2.63) — ठीक वही जो काम पर आप नहीं झेल सकते।',
                step: 'जो संदेश भेजना चाहते हैं, उसे लिखिए — पर भेजिए मत। कल उसे दोबारा लिखिए, सिर्फ़ तथ्यों और एक स्पष्ट माँग के साथ।'
            }
        },
        'anger:conflict': {
            en: {
                ack: 'After a fight, the mind keeps replaying every word.',
                bridge: 'The Gita describes this exactly: replaying it feeds the anger, anger clouds judgment, and we lose ourselves (2.62–63). The way back is not winning the argument in your head. It is letting the heat pass, then choosing what you want the relationship to be. "Free from anger, the wise find peace everywhere" (5.26).',
                step: 'Each time the argument replays today, say inwardly "not now", and take one slow breath. Decide tomorrow, not tonight, what to say.'
            },
            hi: {
                ack: 'झगड़े के बाद मन हर शब्द को बार-बार दोहराता रहता है।',
                bridge: 'गीता ठीक यही बताती है: बार-बार दोहराना क्रोध को बढ़ाता है, क्रोध विवेक को ढकता है, और हम स्वयं को खो देते हैं (2.62–63)। लौटने का रास्ता मन में बहस जीतना नहीं है। गर्मी को गुज़रने दीजिए, फिर चुनिए कि आप यह रिश्ता कैसा चाहते हैं। "क्रोध से मुक्त ज्ञानी हर जगह शांति पाते हैं" (5.26)।',
                step: 'आज जब भी झगड़ा मन में दोहराए, भीतर कहिए "अभी नहीं", और एक धीमी साँस लीजिए। क्या कहना है, यह आज रात नहीं, कल तय कीजिए।'
            }
        },
        'anger:injustice': {
            en: {
                ack: 'Being treated unfairly leaves a deep sting.',
                bridge: 'The Gita does not say unfairness does not matter — Arjuna\'s whole battle is about injustice. But it separates two things: what was done to you, and what you do now. Do what is right, steadily, without letting resentment poison you (2.38). And each person carries their own karma; you do not have to carry theirs (5.15).',
                step: 'Write what happened in plain facts. Then write one thing you can rightly do about it — and one thing you choose to let go.'
            },
            hi: {
                ack: 'अन्याय का व्यवहार एक गहरी चुभन छोड़ जाता है।',
                bridge: 'गीता यह नहीं कहती कि अन्याय से कोई फ़र्क़ नहीं पड़ता — अर्जुन का पूरा युद्ध अन्याय के बारे में है। पर वह दो बातें अलग करती है: आपके साथ जो हुआ, और अब आप क्या करते हैं। जो सही है, वह स्थिरता से कीजिए, कड़वाहट को ज़हर बनने दिए बिना (2.38)। और हर व्यक्ति अपना कर्म स्वयं ढोता है; आपको उनका नहीं ढोना (5.15)।',
                step: 'जो हुआ उसे सीधे तथ्यों में लिखिए। फिर एक बात लिखिए जो आप इसके बारे में उचित रूप से कर सकते हैं — और एक बात जिसे आप छोड़ना चुनते हैं।'
            }
        },
        'confusion:decision': {
            en: {
                ack: 'Standing between two paths is exactly where the Gita begins.',
                bridge: 'Arjuna stood exactly here — torn, unsure, unable to choose (2.7). Krishna did not decide for him. He gave him a way to see: choose the path that is truly yours, even if imperfect, over one that only looks better (3.35). And at the very end he says, "reflect on this fully, then do as you wish" (18.63). The choice is yours — made from clarity, not fear.',
                step: 'Write both options. Under each, answer one question: "If fear and other people\'s opinions did not exist, which would I choose?" Sleep on it before deciding.'
            },
            hi: {
                ack: 'दो राहों के बीच खड़े होना — गीता ठीक यहीं से शुरू होती है।',
                bridge: 'अर्जुन ठीक यहीं खड़े थे — दुविधा में, अनिश्चित, चुन पाने में असमर्थ (2.7)। कृष्ण ने उनके लिए निर्णय नहीं लिया। उन्होंने देखने का एक ढंग दिया: वह मार्ग चुनिए जो सचमुच आपका है, भले अधूरा हो, उसके बजाय जो बस बेहतर दिखता है (3.35)। और अंत में वे कहते हैं, "इस पर पूरी तरह विचार करो, फिर जैसा चाहो वैसा करो" (18.63)। चुनाव आपका है — डर से नहीं, स्पष्टता से किया हुआ।',
                step: 'दोनों विकल्प लिखिए। हर एक के नीचे एक प्रश्न का उत्तर दीजिए: "अगर डर और दूसरों की राय न होती, तो मैं क्या चुनता/चुनती?" निर्णय से पहले एक रात सो लीजिए।'
            }
        },
        'confusion:work': {
            en: {
                ack: 'Not knowing which direction to take in your work is unsettling.',
                bridge: 'The Gita\'s answer to career confusion is svadharma — your own path, shaped by your nature (18.47). It is better to do your own work imperfectly than to succeed at someone else\'s. The question is not "what pays most" or "what impresses", but "what work can I offer as worship?" (18.46).',
                step: 'Write three moments when work felt meaningful to you, even briefly. Look for what they share — that thread is a clue to your svadharma.'
            },
            hi: {
                ack: 'काम में कौन-सी दिशा लें, यह न जानना बेचैन करता है।',
                bridge: 'करियर की उलझन का गीता का उत्तर है स्वधर्म — आपका अपना मार्ग, जो आपके स्वभाव से बना है (18.47)। किसी और के काम में सफल होने से बेहतर है अपना काम अधूरा करना। प्रश्न यह नहीं कि "सबसे ज़्यादा पैसा किसमें है" या "किससे लोग प्रभावित होंगे", बल्कि यह कि "कौन-सा काम मैं पूजा की तरह अर्पित कर सकता हूँ?" (18.46)।',
                step: 'ऐसे तीन पल लिखिए जब काम आपको अर्थपूर्ण लगा, भले थोड़ी देर के लिए। देखिए उनमें क्या समान है — वही धागा आपके स्वधर्म का संकेत है।'
            }
        },
        'confusion:love': {
            en: {
                ack: 'Matters of the heart can leave you unsure of what you feel or want.',
                bridge: 'The Gita would say: before you decide what to do, steady the mind (2.48). A confused heart chooses from fear or longing; a steady one chooses from clarity. Ask what love would look like if it did not need to possess (2.71) — that answer is usually the true one.',
                step: 'Spend ten minutes writing honestly: "What I want. What I fear. What I know." Read it again tomorrow morning.'
            },
            hi: {
                ack: 'दिल की बातें कभी-कभी यह भी नहीं समझने देतीं कि हम क्या महसूस करते हैं या क्या चाहते हैं।',
                bridge: 'गीता कहेगी: क्या करना है, यह तय करने से पहले मन को स्थिर कीजिए (2.48)। उलझा हुआ हृदय डर या लालसा से चुनता है; स्थिर हृदय स्पष्टता से। पूछिए कि अगर प्रेम को अधिकार की ज़रूरत न होती, तो वह कैसा दिखता (2.71) — वही उत्तर अक्सर सच्चा होता है।',
                step: 'दस मिनट ईमानदारी से लिखिए: "मैं क्या चाहता/चाहती हूँ। मुझे किस बात का डर है। मैं क्या जानता/जानती हूँ।" कल सुबह इसे फिर पढ़िए।'
            }
        },
        'confusion:meaning': {
            en: {
                ack: 'These are the very questions Arjuna asked.',
                bridge: 'The Gita was given for exactly these questions. Its answer starts within: you are "an eternal part" of the Divine (15.7), not an accident. Meaning is not found by thinking alone — it is found by living your own dharma (3.35) and offering your work as worship (18.46). Clarity tends to come while walking, not before.',
                step: 'For one week, end each day by writing one moment that felt true. At the end of the week, read them together.'
            },
            hi: {
                ack: 'ये वही प्रश्न हैं जो अर्जुन ने पूछे थे।',
                bridge: 'गीता ठीक इन्हीं प्रश्नों के लिए दी गई थी। उसका उत्तर भीतर से शुरू होता है: आप ईश्वर के "सनातन अंश" हैं (15.7), कोई संयोग नहीं। अर्थ केवल सोचने से नहीं मिलता — अपने धर्म को जीने (3.35) और अपने काम को पूजा की तरह अर्पित करने (18.46) से मिलता है। स्पष्टता अक्सर चलते-चलते आती है, पहले नहीं।',
                step: 'एक सप्ताह तक हर दिन के अंत में एक ऐसा पल लिखिए जो सच्चा लगा। सप्ताह के अंत में सबको साथ पढ़िए।'
            }
        },
        'confusion:faith': {
            en: {
                ack: 'Doubt about faith isn’t a failure — it’s part of the path.',
                bridge: 'The Gita welcomes seekers who question. Krishna says four kinds of people come to him, including the troubled and the curious (7.16). Whatever form your faith takes, it is he who makes it steady (7.21). You do not need certainty to begin — only honesty.',
                step: 'Write your honest question to God, exactly as it is. You do not have to answer it. Asking is already a kind of prayer.'
            },
            hi: {
                ack: 'आस्था पर संदेह असफलता नहीं — यह मार्ग का हिस्सा है।',
                bridge: 'गीता प्रश्न पूछने वाले साधकों का स्वागत करती है। कृष्ण कहते हैं कि चार प्रकार के लोग उनके पास आते हैं, जिनमें दुखी और जिज्ञासु भी हैं (7.16)। आपकी आस्था जिस भी रूप में हो, उसे स्थिर वही करते हैं (7.21)। शुरू करने के लिए निश्चितता नहीं, केवल ईमानदारी चाहिए।',
                step: 'ईश्वर से अपना ईमानदार प्रश्न लिखिए, जैसा है वैसा। उसका उत्तर देना ज़रूरी नहीं। पूछना अपने आप में एक प्रार्थना है।'
            }
        },
        'loneliness:friendship': {
            en: {
                ack: 'Feeling alone even among people is one of the quietest kinds of pain.',
                bridge: 'The Gita has words for exactly this: "one who sees me everywhere, and everything in me — I am never lost to them, and they are never lost to me" (6.30). Krishna calls himself "the friend of all beings" (5.29). Loneliness is real, but you are not unaccompanied.',
                step: 'Send one honest message today — not "how are you", but "I have been missing having someone to talk to." Let one person in.'
            },
            hi: {
                ack: 'लोगों के बीच रहकर भी अकेलापन महसूस करना सबसे शांत दर्दों में से एक है।',
                bridge: 'गीता के पास ठीक इसके लिए शब्द हैं: "जो मुझे सब जगह देखता है और सबको मुझमें, उससे मैं कभी दूर नहीं होता, और वह मुझसे कभी दूर नहीं होता" (6.30)। कृष्ण स्वयं को "सब प्राणियों का मित्र" कहते हैं (5.29)। अकेलापन सच है, पर आप बिना साथ के नहीं हैं।',
                step: 'आज एक ईमानदार संदेश भेजिए — "कैसे हो" नहीं, बल्कि "मुझे किसी से बात करने की कमी महसूस हो रही थी।" किसी एक को भीतर आने दीजिए।'
            }
        },
        'loneliness:love': {
            en: {
                ack: 'Longing for someone to share your life with is a deep and human ache.',
                bridge: 'The Gita sees that ache and answers it twice. First: you are already deeply loved — "you are very dear to me" (18.64). Second: love grows from wholeness, not emptiness; one who is content within (2.55) loves more freely when love comes. The waiting does not mean you are unworthy of it.',
                step: 'Do one thing this week that you would love to share with someone — and do it fully, for yourself, first.'
            },
            hi: {
                ack: 'किसी के साथ जीवन बाँटने की चाह एक गहरी और मानवीय कसक है।',
                bridge: 'गीता उस कसक को देखती है, और उसका दो बार उत्तर देती है। पहला: आप पहले से गहराई से प्रिय हैं — "तुम मुझे अत्यंत प्रिय हो" (18.64)। दूसरा: प्रेम ख़ालीपन से नहीं, पूर्णता से बढ़ता है; जो भीतर संतुष्ट है (2.55), वह प्रेम आने पर अधिक खुलकर प्रेम करता है। इंतज़ार का अर्थ यह नहीं कि आप उसके योग्य नहीं।',
                step: 'इस सप्ताह एक ऐसा काम कीजिए जिसे आप किसी के साथ बाँटना चाहते — और पहले स्वयं के लिए, पूरे मन से कीजिए।'
            }
        },
        'loneliness:family': {
            en: {
                ack: 'Feeling alone inside your own family is a particular kind of loneliness.',
                bridge: 'Sometimes the people closest to us cannot see us clearly. The Gita does not make you wait for them to: "I am seated in the heart of every being" (10.20) — including yours. You are seen. And in the meantime, it asks you to be your own friend (6.5).',
                step: 'Find one person — inside the family or outside it — who can listen, and tell them one true thing this week.'
            },
            hi: {
                ack: 'अपने ही परिवार में अकेलापन एक अलग तरह का अकेलापन है।',
                bridge: 'कभी-कभी सबसे क़रीबी लोग हमें साफ़ नहीं देख पाते। गीता आपको उनकी प्रतीक्षा नहीं कराती: "मैं हर प्राणी के हृदय में स्थित हूँ" (10.20) — आपके भी। आपको देखा जा रहा है। और तब तक वह आपसे अपना मित्र बनने को कहती है (6.5)।',
                step: 'एक व्यक्ति खोजिए — परिवार के भीतर या बाहर — जो सुन सके, और इस सप्ताह उसे एक सच्ची बात बताइए।'
            }
        },
        'failure:study': {
            en: {
                ack: 'A result like this can feel like it says something about you. It doesn’t.',
                bridge: 'The Gita was made for this moment. "Your right is to the effort, never to its fruit" (2.47) — a result is one fruit, on one day. Your worth was never in a marksheet. And it promises: "on this path, no effort is ever lost" (2.40). What you learned while preparing is still yours.',
                step: 'Write three things you understand now that you did not a year ago. Then choose one small step for the next attempt — just one.'
            },
            hi: {
                ack: 'ऐसा नतीजा लगता है जैसे आपके बारे में कुछ कह रहा हो। वह नहीं कहता।',
                bridge: 'गीता इसी पल के लिए बनी है। "तुम्हारा अधिकार प्रयास पर है, फल पर कभी नहीं" (2.47) — नतीजा एक दिन का एक फल है। आपका मूल्य कभी अंकपत्र में नहीं था। और वह वचन देती है: "इस मार्ग में कोई प्रयास व्यर्थ नहीं जाता" (2.40)। तैयारी में जो सीखा, वह अब भी आपका है।',
                step: 'तीन ऐसी बातें लिखिए जो आप आज समझते हैं और एक साल पहले नहीं समझते थे। फिर अगले प्रयास के लिए एक छोटा क़दम चुनिए — सिर्फ़ एक।'
            }
        },
        'failure:work': {
            en: {
                ack: 'When work doesn’t go the way you hoped, it can shake your confidence.',
                bridge: 'The Gita asks you to stay "the same in success and failure" (2.48) — not because results do not matter, but because you are more than any one result. Your effort was real. "One who does good never comes to a bad end" (6.40). This is a chapter, not the whole story.',
                step: 'Write what this taught you in one sentence, and one thing you will do differently. Then close the file for today.'
            },
            hi: {
                ack: 'जब काम उम्मीद के मुताबिक़ न हो, तो आत्मविश्वास डगमगा सकता है।',
                bridge: 'गीता कहती है कि "सफलता और असफलता में समान रहो" (2.48) — इसलिए नहीं कि परिणाम मायने नहीं रखते, बल्कि इसलिए कि आप किसी एक परिणाम से कहीं अधिक हैं। आपका प्रयास सच्चा था। "भलाई करने वाले की कभी दुर्गति नहीं होती" (6.40)। यह एक अध्याय है, पूरी कहानी नहीं।',
                step: 'एक वाक्य में लिखिए कि इससे आपने क्या सीखा, और एक बात जो आप अलग ढंग से करेंगे। फिर आज के लिए वह फ़ाइल बंद कर दीजिए।'
            }
        },
        'unworthiness:self': {
            en: {
                ack: 'It’s painful to carry the feeling that you’re not enough.',
                bridge: 'The Gita never measures you by comparison. It says you are "an eternal part" of the Divine (15.7), and calls those who love God "very dear" (12.14). The voice saying you are not enough is the mind acting as an enemy (6.6) — and a mind can be taught to be a friend again.',
                step: 'Each morning this week, say one true and kind thing about yourself aloud — even if it feels awkward. Especially if it does.'
            },
            hi: {
                ack: 'यह एहसास ढोना दर्दनाक है कि आप पर्याप्त नहीं हैं।',
                bridge: 'गीता आपको कभी तुलना से नहीं नापती। वह कहती है कि आप ईश्वर के "सनातन अंश" हैं (15.7), और जो उनसे प्रेम करते हैं, उन्हें वे "अत्यंत प्रिय" कहते हैं (12.14)। जो आवाज़ कहती है कि आप पर्याप्त नहीं, वह शत्रु बना हुआ मन है (6.6) — और मन को फिर से मित्र बनना सिखाया जा सकता है।',
                step: 'इस सप्ताह हर सुबह अपने बारे में एक सच्ची और दयालु बात ज़ोर से कहिए — भले अटपटा लगे। ख़ासकर तब, जब अटपटा लगे।'
            }
        },
        'unworthiness:love': {
            en: {
                ack: 'Feeling unworthy of love is one of the loneliest feelings there is.',
                bridge: 'The Gita turns this around: you do not earn love by being enough — you are already loved. "Hear my supreme word: you are very dear to me" (18.64). Someone\'s choice not to love you is about their path, not your worth (3.35).',
                step: 'Write the names of three people who have truly cared for you. Read the list whenever the feeling returns.'
            },
            hi: {
                ack: 'प्रेम के योग्य न होने का एहसास सबसे अकेले एहसासों में से है।',
                bridge: 'गीता इसे पलट देती है: पर्याप्त होकर आप प्रेम नहीं कमाते — आप पहले से प्रिय हैं। "मेरा परम वचन सुनो: तुम मुझे अत्यंत प्रिय हो" (18.64)। किसी का आपसे प्रेम न करना उनके मार्ग की बात है, आपके मूल्य की नहीं (3.35)।',
                step: 'ऐसे तीन लोगों के नाम लिखिए जिन्होंने सचमुच आपकी परवाह की। जब यह एहसास लौटे, वह सूची पढ़िए।'
            }
        },
        'guilt:family': {
            en: {
                ack: 'Guilt toward family can sit very heavily.',
                bridge: 'The Gita offers real hope for regret: even the most burdened "can cross over on the boat of knowledge" (4.36). Guilt is useful only as long as it turns you toward repair; after that, it has done its work. "I will free you; do not grieve" (18.66).',
                step: 'If an apology is owed, write it today — simply, without excuses. If it cannot be given, write it anyway, and keep it.'
            },
            hi: {
                ack: 'परिवार के प्रति अपराधबोध बहुत भारी होकर बैठ जाता है।',
                bridge: 'गीता पछतावे के लिए सच्ची आशा देती है: सबसे भारी बोझ वाला भी "ज्ञान की नौका से पार हो सकता है" (4.36)। अपराधबोध तब तक उपयोगी है जब तक वह आपको सुधार की ओर मोड़े; उसके बाद उसका काम पूरा हो जाता है। "मैं तुम्हें मुक्त करूँगा; शोक मत करो" (18.66)।',
                step: 'अगर कोई माफ़ी बाक़ी है, आज लिखिए — सीधे, बिना बहानों के। अगर दी नहीं जा सकती, तब भी लिखिए, और रख लीजिए।'
            }
        },
        'guilt:habits': {
            en: {
                ack: 'Slipping back into a habit you’re fighting can bring a wave of shame.',
                bridge: 'The Gita is realistic: "the mind is restless and hard to tame — but it can be held by practice and detachment" (6.35). Practice means falling and returning, again and again (6.26). Shame keeps the cycle going; gentleness breaks it. One slip is not who you are.',
                step: 'Do not punish yourself today. Notice what came just before the slip — the time, the feeling, the place — and write it down. Tomorrow\'s change begins there.'
            },
            hi: {
                ack: 'जिस आदत से लड़ रहे हैं, उसमें फिर फिसल जाना शर्म की लहर ला सकता है।',
                bridge: 'गीता यथार्थवादी है: "मन चंचल है और वश में करना कठिन — पर अभ्यास और वैराग्य से वश में होता है" (6.35)। अभ्यास का अर्थ है गिरना और लौटना, बार-बार (6.26)। शर्म इस चक्र को चलाती रहती है; कोमलता उसे तोड़ती है। एक फिसलन आपकी पहचान नहीं।',
                step: 'आज स्वयं को सज़ा मत दीजिए। देखिए कि फिसलने से ठीक पहले क्या था — समय, भाव, जगह — और उसे लिख लीजिए। कल का बदलाव वहीं से शुरू होता है।'
            }
        },
        'heartbreak:love': {
            en: {
                ack: 'A broken heart hurts in a way that is hard to explain to anyone.',
                bridge: 'The Gita does not rush you past this pain. It says pleasure and pain come and go like seasons — "bear them patiently" (2.14). What you gave was real, and it was never wasted. And there is a joy within you that does not depend on any one person (5.21). It is still there, under the hurt.',
                step: 'Let yourself grieve today — and do one small thing that belongs only to you. Not to forget them, but to remember yourself.'
            },
            hi: {
                ack: 'टूटा दिल ऐसे दुख देता है जिसे किसी को समझाना कठिन है।',
                bridge: 'गीता आपको इस दर्द से जल्दी आगे नहीं धकेलती। वह कहती है कि सुख और दुख ऋतुओं की तरह आते-जाते हैं — "इन्हें धैर्य से सहो" (2.14)। आपने जो दिया वह सच्चा था, और कभी व्यर्थ नहीं गया। और आपके भीतर एक आनंद है जो किसी एक व्यक्ति पर निर्भर नहीं (5.21)। वह अब भी वहीं है, चोट के नीचे।',
                step: 'आज स्वयं को शोक करने दीजिए — और एक छोटा काम कीजिए जो सिर्फ़ आपका हो। उन्हें भूलने के लिए नहीं, स्वयं को याद रखने के लिए।'
            }
        },
        'envy:self': {
            en: {
                ack: 'Comparing yourself to others can quietly drain the joy from your own life.',
                bridge: 'Comparison makes someone else\'s path the measure of yours. The Gita says your own path, even imperfectly lived, is better than another\'s done perfectly (3.35). Their highlights are not your assignment. "Whatever is beautiful comes from a spark of my splendour" (10.41) — and that includes what is beautiful in you.',
                step: 'Mute three accounts that make you feel small. Then write three things in your own life you would not trade.'
            },
            hi: {
                ack: 'दूसरों से तुलना धीरे-धीरे आपके अपने जीवन का आनंद सोख लेती है।',
                bridge: 'तुलना किसी और के मार्ग को आपके मार्ग का पैमाना बना देती है। गीता कहती है कि आपका अपना मार्ग, अधूरा जिया हुआ भी, किसी और के पूरी तरह निभाए मार्ग से बेहतर है (3.35)। उनकी चमक-दमक आपका काम नहीं। "जो कुछ भी सुंदर है, वह मेरे तेज के अंश से है" (10.41) — और इसमें आपके भीतर का सौंदर्य भी शामिल है।',
                step: 'ऐसे तीन अकाउंट म्यूट कीजिए जो आपको छोटा महसूस कराते हैं। फिर अपने जीवन की तीन ऐसी चीज़ें लिखिए जिन्हें आप किसी के बदले न दें।'
            }
        },
        'envy:work': {
            en: {
                ack: 'Watching others move ahead at work can sting.',
                bridge: 'The Gita\'s answer is svadharma: better your own work done imperfectly than another\'s done perfectly (18.47). Their promotion is their path. One who is "content with whatever comes, free of envy, the same in success and failure" is never bound, it says (4.22).',
                step: 'Congratulate the person you envy — sincerely, in one line. Then write one skill you will grow this month, for yourself, not against them.'
            },
            hi: {
                ack: 'काम पर दूसरों को आगे बढ़ते देखना चुभ सकता है।',
                bridge: 'गीता का उत्तर स्वधर्म है: दूसरे का काम अच्छी तरह करने से अपना काम अधूरा करना बेहतर है (18.47)। उनकी तरक़्क़ी उनका मार्ग है। "जो मिले उसमें संतुष्ट, ईर्ष्या से मुक्त, सफलता और असफलता में समान" — ऐसा व्यक्ति, वह कहती है, कभी बँधता नहीं (4.22)।',
                step: 'जिससे ईर्ष्या है, उसे सच्चे मन से एक पंक्ति में बधाई दीजिए। फिर एक कौशल लिखिए जो आप इस महीने बढ़ाएँगे — अपने लिए, उनके ख़िलाफ़ नहीं।'
            }
        },
        'lust:love': {
            en: {
                ack: 'Desire for someone can be overwhelming — and it’s nothing to be ashamed of.',
                bridge: 'The Gita does not treat desire as dirty: the Divine is present "in desire that does not go against dharma" (7.11). Its caution is about being ruled by it — dwelling on someone, then clinging, then craving (2.62). Desire held with respect for the other person can grow into love. Desire that only wants to take tends to leave you emptier.',
                step: 'When the pull is strong, pause and ask: "What do I actually want here — closeness, comfort, to be seen?" Name it honestly. That is how steering it begins.'
            },
            hi: {
                ack: 'किसी के प्रति इच्छा बहुत प्रबल हो सकती है — और इसमें शर्म की कोई बात नहीं।',
                bridge: 'गीता इच्छा को गंदा नहीं मानती: ईश्वर "उस काम में है जो धर्म के विरुद्ध नहीं" (7.11)। उसकी सावधानी उसके वश में होने के बारे में है — किसी पर बार-बार सोचना, फिर चिपकना, फिर लालसा (2.62)। दूसरे के प्रति सम्मान के साथ रखी इच्छा प्रेम बन सकती है। जो इच्छा केवल लेना चाहती है, वह अक्सर और ख़ाली छोड़ जाती है।',
                step: 'जब खिंचाव प्रबल हो, रुककर पूछिए: "मुझे यहाँ वास्तव में क्या चाहिए — निकटता, सांत्वना, देखा जाना?" ईमानदारी से उसे नाम दीजिए। उसे दिशा देना यहीं से शुरू होता है।'
            }
        },
        'lust:habits': {
            en: {
                ack: 'Fighting a habit like this takes real courage — and you’re already fighting.',
                bridge: 'The Gita describes this struggle precisely: the senses are so strong they "carry away even a wise mind" (2.60), and desire is never satisfied by feeding it (3.39). But it also gives the way: "stop the enemy at the gate" (3.41) — catch the first thought, before the habit takes over — and replace the lower pull with a higher one (2.59). Relapse is not the end; returning is the practice (6.26).',
                step: 'Find your most common trigger moment — late at night, alone, phone in bed. Change one thing about it tonight: let the phone charge outside the room.'
            },
            hi: {
                ack: 'ऐसी आदत से लड़ने के लिए सच्चा साहस चाहिए — और आप लड़ ही रहे हैं।',
                bridge: 'गीता इस संघर्ष को सटीक बताती है: इंद्रियाँ इतनी प्रबल हैं कि "ज्ञानी के मन को भी बहा ले जाती हैं" (2.60), और इच्छा पूरी करने से कभी शांत नहीं होती (3.39)। पर वह रास्ता भी देती है: "शत्रु को द्वार पर ही रोको" (3.41) — आदत हावी होने से पहले पहला विचार पकड़ो — और नीचे के खिंचाव की जगह ऊँचा लक्ष्य रखो (2.59)। फिसलना अंत नहीं; लौटना ही अभ्यास है (6.26)।',
                step: 'अपना सबसे आम कमज़ोर पल पहचानिए — देर रात, अकेले, बिस्तर में फ़ोन। आज रात उसमें एक बात बदलिए: फ़ोन कमरे के बाहर चार्ज हो।'
            }
        },
        'inertia:study': {
            en: {
                ack: 'When you can’t make yourself study, it’s easy to feel stuck and guilty at the same time.',
                bridge: 'This heaviness is tamas, and the Gita\'s first word to a stuck Arjuna was simple: "Stand up" (2.3). You do not need to feel motivated first — action is better than inaction (3.8), and motivation usually arrives after starting. Lift yourself by your own self (6.5), even a little.',
                step: 'Set a timer for ten minutes and study only one page. When it rings, you may stop — but you probably will not.'
            },
            hi: {
                ack: 'जब पढ़ने का मन ही न करे, तो अटके होने और अपराधबोध का एहसास एक साथ होता है।',
                bridge: 'यह भारीपन तमस् है, और अटके हुए अर्जुन से गीता का पहला शब्द सीधा था: "उठो" (2.3)। पहले प्रेरित महसूस करना ज़रूरी नहीं — कर्म न करने से कर्म करना श्रेष्ठ है (3.8), और प्रेरणा अक्सर शुरू करने के बाद आती है। स्वयं से स्वयं को ऊपर उठाइए (6.5), थोड़ा ही सही।',
                step: 'दस मिनट का टाइमर लगाइए और सिर्फ़ एक पन्ना पढ़िए। घंटी बजे तो रुक सकते हैं — पर शायद रुकेंगे नहीं।'
            }
        },
        'inertia:work': {
            en: {
                ack: 'Some days, work feels impossible to start.',
                bridge: 'The Gita is kind but firm about this heaviness: "do your work, for action is better than inaction" (3.8). It does not ask for heroics — just the next small act, done as an offering. Balance helps too: enough sleep and enough rest make starting easier (6.17).',
                step: 'Write the smallest possible first step of the task — something that takes five minutes — and do only that, now.'
            },
            hi: {
                ack: 'कुछ दिन काम शुरू करना असंभव-सा लगता है।',
                bridge: 'गीता ऐसे भारीपन के प्रति दयालु पर दृढ़ है: "अपना कर्म करो, क्योंकि कर्म न करने से कर्म करना श्रेष्ठ है" (3.8)। वह वीरता नहीं माँगती — बस अगला छोटा काम, अर्पण की तरह किया हुआ। संतुलन भी मदद करता है: पर्याप्त नींद और विश्राम शुरुआत को आसान बनाते हैं (6.17)।',
                step: 'अपने काम का सबसे छोटा संभव पहला क़दम लिखिए — कुछ ऐसा जो पाँच मिनट ले — और अभी सिर्फ़ वही कीजिए।'
            }
        },
        'emptiness:meaning': {
            en: {
                ack: 'Feeling empty, as if you’re only going through the motions, is exhausting in its own way.',
                bridge: 'The Gita would say the emptiness is not the truth about you — it is a cloud over it. There is a joy within that needs nothing from outside (5.21); once it is found, "even great sorrow cannot shake you" (6.22). And you are not random: "you are my eternal part" (15.7). Meaning often returns through small, true actions before it returns as a feeling.',
                step: 'Do one thing today purely because it is good — not useful, not impressive. Notice how you feel afterwards.'
            },
            hi: {
                ack: 'ख़ालीपन महसूस करना, जैसे बस दिन काट रहे हों, अपने ढंग से थका देने वाला है।',
                bridge: 'गीता कहेगी कि यह ख़ालीपन आपका सच नहीं — उस पर छाया एक बादल है। भीतर एक आनंद है जिसे बाहर से कुछ नहीं चाहिए (5.21); वह मिल जाए तो "बड़ा दुख भी विचलित नहीं कर पाता" (6.22)। और आप कोई संयोग नहीं: "तुम मेरे सनातन अंश हो" (15.7)। अर्थ अक्सर भावना बनकर लौटने से पहले छोटे, सच्चे कामों के रास्ते लौटता है।',
                step: 'आज एक काम सिर्फ़ इसलिए कीजिए क्योंकि वह अच्छा है — उपयोगी या प्रभावशाली होने के लिए नहीं। फिर देखिए कि बाद में कैसा लगता है।'
            }
        },
        'gratitude:study': {
            en: {
                ack: 'That’s wonderful news — all that effort, and here is its fruit.',
                bridge: 'Enjoy this fully; you earned it. The Gita would add one gentle thing: offer it (9.27). Success held lightly stays sweet — and the same steadiness that carried you here (2.48) will carry you through whatever comes next.',
                step: 'Thank one person who helped you get here — a teacher, a parent, a friend — by name, today.'
            },
            hi: {
                ack: 'बहुत अच्छी ख़बर है — इतनी मेहनत, और यह रहा उसका फल।',
                bridge: 'इसका पूरा आनंद लीजिए; आपने इसे कमाया है। गीता बस एक कोमल बात जोड़ेगी: इसे अर्पित कीजिए (9.27)। हल्के से थामी सफलता मीठी बनी रहती है — और जिस स्थिरता ने आपको यहाँ पहुँचाया (2.48), वही आगे भी साथ देगी।',
                step: 'जिसने यहाँ तक पहुँचने में मदद की — कोई शिक्षक, माता-पिता, मित्र — उसे आज नाम लेकर धन्यवाद दीजिए।'
            }
        },
        'gratitude:work': {
            en: {
                ack: 'Congratulations — this is worth celebrating.',
                bridge: 'The Gita calls work done well a form of worship (18.46). Let this success be an offering too — enjoyed, shared, and held lightly (9.27). Remember how this moment feels; the same balance (2.48) will steady you on harder days.',
                step: 'Celebrate with someone today, and write one line about what you did right — for a future day that will need it.'
            },
            hi: {
                ack: 'बधाई हो — यह जश्न मनाने लायक़ है।',
                bridge: 'गीता अच्छे से किए गए काम को पूजा का एक रूप कहती है (18.46)। इस सफलता को भी एक अर्पण बनने दीजिए — आनंद से, बाँटकर, हल्के हाथों से थामी हुई (9.27)। इस पल का एहसास याद रखिए; वही संतुलन (2.48) कठिन दिनों में आपको स्थिर रखेगा।',
                step: 'आज किसी के साथ जश्न मनाइए, और एक पंक्ति लिखिए कि आपने क्या सही किया — किसी ऐसे दिन के लिए जब इसकी ज़रूरत होगी।'
            }
        },
        'gratitude:love': {
            en: {
                ack: 'What beautiful news — I’m so glad for you.',
                bridge: 'Love is one of the ways the Divine shows itself: "whatever is beautiful comes from a spark of my splendour" (10.41). The Gita\'s blessing for love is that it stays generous — feeling the other\'s joy as your own (6.32), and never needing to possess.',
                step: 'Write down what you love about this moment, so you can read it again on an ordinary day.'
            },
            hi: {
                ack: 'कितनी सुंदर ख़बर है — मुझे आपके लिए बहुत ख़ुशी है।',
                bridge: 'प्रेम उन रास्तों में से है जिनसे ईश्वर स्वयं को प्रकट करते हैं: "जो कुछ भी सुंदर है, वह मेरे तेज के अंश से है" (10.41)। प्रेम के लिए गीता का आशीर्वाद है कि वह उदार बना रहे — दूसरे के सुख को अपना सुख माने (6.32), और कभी अधिकार न चाहे।',
                step: 'इस पल में आपको क्या प्रिय है, वह लिख लीजिए, ताकि किसी साधारण दिन फिर पढ़ सकें।'
            }
        }
    };

    // Where no counsel is written for the exact pair, a close one speaks.
    const COUNSEL_ALIASES = {
        'fear:work': 'anxiety:work', 'fear:study': 'anxiety:study', 'fear:future': 'anxiety:future', 'fear:health': 'anxiety:health',
        'fear:money': 'anxiety:money', 'fear:family': 'anxiety:family', 'fear:love': 'anxiety:love', 'fear:decision': 'confusion:decision',
        'anxiety:decision': 'confusion:decision', 'stress:decision': 'confusion:decision', 'stress:money': 'anxiety:money',
        'stress:future': 'anxiety:future', 'stress:health': 'anxiety:health', 'confusion:future': 'anxiety:future',
        'sadness:loss': 'grief:loss', 'heartbreak:loss': 'grief:loss', 'sadness:study': 'failure:study', 'sadness:work': 'failure:work',
        'sadness:meaning': 'emptiness:meaning', 'emptiness:work': 'confusion:work', 'purpose:work': 'confusion:work',
        'purpose:meaning': 'confusion:meaning', 'loneliness:meaning': 'emptiness:meaning', 'heartbreak:family': 'sadness:family',
        'anger:love': 'anger:conflict', 'anger:friendship': 'anger:conflict', 'sadness:conflict': 'anger:conflict',
        'unworthiness:study': 'failure:study', 'heartbreak:injustice': 'heartbreak:love',
        'craving:habits': 'guilt:habits', 'inertia:habits': 'inertia:work', 'envy:friendship': 'envy:self',
        'sadness:health': 'anxiety:health',
        'anxiety:marriage': 'stress:marriage', 'fear:marriage': 'stress:marriage', 'confusion:marriage': 'stress:marriage',
        'sadness:marriage': 'stress:marriage', 'anger:marriage': 'stress:marriage', 'gratitude:marriage': 'gratitude:love',
        'stress:sleep': 'anxiety:sleep', 'fear:sleep': 'anxiety:sleep', 'guilt:sleep': 'anxiety:sleep', 'sadness:sleep': 'anxiety:sleep', 'grief:family': 'grief:loss', 'gratitude:family': 'gratitude:love',
        'love:love': 'gratitude:love', 'loneliness:self': 'unworthiness:self', 'confusion:self': 'unworthiness:self',
        'heartbreak:friendship': 'sadness:friendship', 'stress:self': 'unworthiness:self', 'anxiety:self': 'unworthiness:self'
    };

    // Which feeling the counsel answers: what they wrote now; else the feeling
    // their situation carries, when that has counsel; else what came before.
    function counselFeeling(profile) {
        if (profile.fresh) return profile.fresh;
        if (profile.inferred && counselFor(profile.inferred, profile.topics)) return profile.inferred;
        return profile.primary || profile.inferred || null;
    }

    // The counsel written for this feeling in this situation, as its key
    // ("anxiety:work"), so a conversation can avoid hearing it twice.
    function counselKeyFor(emotion, topics) {
        if (!emotion) return null;
        const ordered = [...topics].sort((a, b) => TOPIC_PRIORITY.indexOf(a) - TOPIC_PRIORITY.indexOf(b));
        for (const topic of ordered) {
            const key = `${emotion}:${topic}`;
            if (COUNSEL[key]) return key;
            if (COUNSEL[COUNSEL_ALIASES[key]]) return COUNSEL_ALIASES[key];
        }
        return null;
    }

    function counselFor(emotion, topics) {
        const key = counselKeyFor(emotion, topics);
        return key ? COUNSEL[key] : null;
    }

    // -----------------------------------------------------------------------
    // Caring for someone — a parent in hospital, a brother who is struggling.
    // The one who writes is the one being answered.
    // -----------------------------------------------------------------------

    const RELATION_NAMES = {
        mother: { en: 'your mother', hi: 'अपनी माँ' },
        father: { en: 'your father', hi: 'अपने पिता' },
        sister: { en: 'your sister', hi: 'अपनी बहन' },
        brother: { en: 'your brother', hi: 'अपने भाई' },
        partner: { en: 'your partner', hi: 'अपने जीवनसाथी' },
        child: { en: 'your child', hi: 'अपने बच्चे' },
        friend: { en: 'your friend', hi: 'अपने दोस्त' },
        grandparent: { en: 'your grandparent', hi: 'अपने बुज़ुर्गों' },
        husband: { en: 'your husband', hi: 'अपने पति' },
        wife: { en: 'your wife', hi: 'अपनी पत्नी' },
        girlfriend: { en: 'your girlfriend', hi: 'अपनी गर्लफ़्रेंड' },
        boyfriend: { en: 'your boyfriend', hi: 'अपने बॉयफ़्रेंड' },
        son: { en: 'your son', hi: 'अपने बेटे' },
        daughter: { en: 'your daughter', hi: 'अपनी बेटी' },
        grandmother: { en: 'your grandmother', hi: 'अपनी दादी-नानी' },
        grandfather: { en: 'your grandfather', hi: 'अपने दादा-नाना' },
        someone: { en: 'someone you love', hi: 'किसी अपने' }
    };

    const CARE_COUNSEL = {
        health: {
            practice: 'breaths',
            en: {
                ack: (who) => `Watching ${who} go through this is its own kind of pain.`,
                bridge: 'The Gita’s picture of the dearest person is one who feels another’s sorrow as their own (6.32) — which is exactly what you are doing. It also asks you to give your part fully and let go of what is not in your hands (2.47): the healing is the doctors’ work and the body’s; your love and your presence are yours. The body changes, as it always has, but who they truly are is untouched (2.13). And you are not carrying them alone (18.66).',
                step: 'Do one practical thing for them today — and one small thing for yourself. A carer who rests can keep caring.'
            },
            hi: {
                ack: (who) => `${who} को इससे गुज़रते देखना अपने आप में एक दर्द है।`,
                bridge: 'गीता की नज़र में सबसे प्रिय वह है जो दूसरे के दुःख को अपना दुःख मानता है (6.32) — और आप ठीक यही कर रहे हैं। गीता यह भी कहती है कि अपना हिस्सा पूरे मन से कीजिए और जो आपके हाथ में नहीं, उसे छोड़ दीजिए (2.47): इलाज डॉक्टरों और शरीर का काम है; आपका प्रेम और आपकी उपस्थिति आपकी है। शरीर बदलता है, जैसे हमेशा बदलता आया है, पर वे सचमुच जो हैं, उसे कुछ नहीं छूता (2.13)। और आप उन्हें अकेले नहीं थाम रहे (18.66)।',
                step: 'आज उनके लिए एक व्यावहारिक काम कीजिए — और एक छोटा काम अपने लिए भी। जो देखभाल करने वाला आराम करता है, वही देखभाल करता रह पाता है।'
            }
        },
        mind: {
            practice: 'breaths',
            en: {
                ack: (who) => `It hurts to watch ${who} struggle inside, and not be able to fix it.`,
                bridge: 'You cannot lift another person’s mind for them — the Gita says each of us must raise ourselves (6.5). But you can be the friend it describes: kind, steady, without judgement (12.13), feeling their sorrow as your own (6.32) without drowning in it. Speak gently and truthfully (17.15). Your part is presence, not repair — the outcome was never yours to carry (2.47).',
                step: 'Ask them one gentle question today — "How are you, really?" — and then just listen, without fixing. If they seem to be sinking, help them reach someone trained.'
            },
            hi: {
                ack: (who) => `${who} को भीतर-ही-भीतर जूझते देखना, और उसे ठीक न कर पाना — यह बहुत दुखता है।`,
                bridge: 'किसी और का मन आप उसके लिए नहीं उठा सकते — गीता कहती है कि हर व्यक्ति को स्वयं अपने को ऊपर उठाना होता है (6.5)। पर आप वह मित्र बन सकते हैं जिसका गीता वर्णन करती है: दयालु, स्थिर, बिना किसी निर्णय के (12.13), उनके दुःख को अपना मानते हुए (6.32), पर उसमें डूबे बिना। कोमलता और सच्चाई से बोलिए (17.15)। आपका काम साथ होना है, ठीक करना नहीं — परिणाम का बोझ कभी आपका था ही नहीं (2.47)।',
                step: 'आज उनसे एक कोमल प्रश्न पूछिए — "आप सच में कैसे हैं?" — और फिर बस सुनिए, सुधारने की कोशिश किए बिना। अगर वे डूबते-से लगें, तो किसी प्रशिक्षित व्यक्ति तक पहुँचने में उनकी मदद कीजिए।'
            }
        }
    };

    // Worry for someone, when nothing is said yet about how they are.
    CARE_COUNSEL.worry = {
        practice: 'breaths',
        en: {
            ack: (who) => `Worrying about ${who} is love that has nowhere to go yet.`,
            bridge: 'Worry is love leaning into a future you cannot hold. The Gita’s answer is to do what is yours — call, visit, ask, be there (2.47) — and to entrust the rest: "I carry what they lack and preserve what they have" (9.22). Your love is real either way. The fear does not have to be.',
            step: 'Reach out to them today — one message, no agenda. And when the worry returns tonight, say quietly: "They are held, and so am I."'
        },
        hi: {
            ack: (who) => `${who} की चिंता वह प्रेम है जिसे अभी कोई रास्ता नहीं मिला।`,
            bridge: 'चिंता वह प्रेम है जो उस भविष्य की ओर झुका है जिसे आप थाम नहीं सकते। गीता का उत्तर है कि जो आपका है वह कीजिए — फ़ोन, मुलाक़ात, एक प्रश्न, साथ होना (2.47) — और बाक़ी सौंप दीजिए: "जो उनके पास नहीं, वह मैं लाता हूँ; जो है, उसकी रक्षा करता हूँ" (9.22)। आपका प्रेम हर हाल में सच है। डर का होना ज़रूरी नहीं।',
            step: 'आज उन्हें एक संदेश भेजिए — बिना किसी कारण के। और रात को जब चिंता लौटे, मन में कहिए: "वे थामे हुए हैं, और मैं भी।"'
        }
    };

    const CARE_BLESSING = { en: 'May your care stay steady — and may someone care for you, too.', hi: 'आपकी देखभाल स्थिर रहे — और कोई आपकी भी देखभाल करे।' };

    const CARE_LINE = {
        en: 'Tele-MANAS (14416, India) helps families too — you can call for them, or with them.',
        hi: 'टेली-मानस (14416) परिवारों की भी मदद करता है — आप उनके लिए, या उनके साथ, कॉल कर सकते हैं।'
    };

    // -----------------------------------------------------------------------
    // "Why do I always…?" The Gita rarely answers why with a reason; it
    // shows where a feeling comes from, which is often the first loosening.
    // -----------------------------------------------------------------------

    const ROOTS = {
        anxiety: {
            en: 'The Gita’s answer to "why" is that the mind runs ahead to outcomes it cannot hold, and suffers there (2.47). Worry is the mind living in a tomorrow that has not come.',
            hi: '"क्यों" का गीता का उत्तर यह है कि मन उन परिणामों तक दौड़ जाता है जिन्हें वह थाम नहीं सकता, और वहीं दुःख पाता है (2.47)। चिंता मन का उस कल में रहना है जो अभी आया ही नहीं।'
        },
        anger: {
            en: 'The Gita traces anger to its root: dwelling on something breeds attachment, attachment breeds desire, and desire that is blocked becomes anger (2.62). The fire usually starts with something you wanted very much.',
            hi: 'गीता क्रोध को उसकी जड़ तक ले जाती है: किसी चीज़ का बार-बार चिंतन आसक्ति लाता है, आसक्ति से कामना जन्मती है, और रुकी हुई कामना क्रोध बन जाती है (2.62)। यह आग अक्सर किसी ऐसी चीज़ से शुरू होती है जिसे आप बहुत चाहते थे।'
        },
        sadness: {
            en: 'The Gita says joy and sorrow arise from our contact with the world, and they come and go like winter and summer (2.14). This heaviness is a season, not who you are.',
            hi: 'गीता कहती है कि सुख और दुःख संसार के संपर्क से उठते हैं, और सर्दी-गर्मी की तरह आते-जाते हैं (2.14)। यह भारीपन एक मौसम है — आपकी पहचान नहीं।'
        },
        fear: {
            en: 'Fear, the Gita suggests, comes from forgetting what in you cannot be harmed — "weapons do not cut it, fire does not burn it" (2.23).',
            hi: 'गीता के अनुसार भय तब आता है जब हम भूल जाते हैं कि हमारे भीतर क्या है जिसे कोई हानि नहीं पहुँचा सकती — "इसे शस्त्र काट नहीं सकते, आग जला नहीं सकती" (2.23)।'
        },
        stress: {
            en: 'The Gita says the strain comes less from the work itself than from our grip on how it must turn out (2.47). Evenness — doing your part and letting the rest be — is what it calls yoga (2.48).',
            hi: 'गीता कहती है कि बोझ काम से कम, और इस पकड़ से ज़्यादा आता है कि परिणाम कैसा होना ही चाहिए (2.47)। समता — अपना काम करना और बाक़ी को होने देना — इसी को गीता योग कहती है (2.48)।'
        },
        craving: {
            en: 'The Gita names desire plainly: born of restlessness (rajas), never satisfied, like a fire that grows the more you feed it (3.37, 3.39). It is not a flaw in you — it is a force in nature, and it can be steered.',
            hi: 'गीता कामना को साफ़ नाम देती है: रजोगुण से जन्मी, कभी तृप्त न होने वाली, उस आग की तरह जो जितना खिलाओ उतनी बढ़ती है (3.37, 3.39)। यह आपकी कमी नहीं — प्रकृति की एक शक्ति है, जिसे दिशा दी जा सकती है।'
        },
        loneliness: {
            en: 'The Gita’s answer is that you are never truly unaccompanied: the One who dwells in every heart dwells in yours (18.61). Loneliness is real — and it is not the whole truth.',
            hi: 'गीता का उत्तर है कि आप कभी सचमुच अकेले नहीं: जो हर हृदय में बसता है, वह आपके हृदय में भी है (18.61)। अकेलापन सच है — पर पूरा सच नहीं।'
        },
        guilt: {
            en: 'Guilt is the conscience doing its work. The Gita does not ask you to drown in it, but to act rightly from here: even the one who has erred most crosses over on the raft of understanding (4.36).',
            hi: 'अपराध-बोध अंतरात्मा का काम है। गीता आपसे उसमें डूबने को नहीं कहती, बल्कि यहाँ से सही कर्म करने को: सबसे अधिक भूल करने वाला भी ज्ञान की नाव से पार हो जाता है (4.36)।'
        },
        confusion: {
            en: 'Confusion, the Gita shows, comes when two duties pull at once — Arjuna himself said, "my mind is confused about what is right" (2.7). It is the beginning of clarity, not its absence.',
            hi: 'गीता दिखाती है कि उलझन तब आती है जब दो कर्तव्य एक साथ खींचते हैं — स्वयं अर्जुन ने कहा था, "मेरा मन धर्म के विषय में मोहित है" (2.7)। यह स्पष्टता की शुरुआत है, उसका अभाव नहीं।'
        },
        default: {
            en: 'The Gita rarely answers "why" with a reason. It offers a way of seeing instead: feelings arise and pass, like seasons (2.14), and you are the one who watches them.',
            hi: 'गीता "क्यों" का उत्तर अक्सर किसी कारण से नहीं देती। वह देखने का एक ढंग देती है: भाव मौसमों की तरह उठते और गुज़रते हैं (2.14), और आप वह हैं जो उन्हें देखता है।'
        }
    };
    ROOTS.lust = ROOTS.craving;

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
        gratitude: { en: 'May your joy become an offering, and return to you many times over.', hi: 'आपका आनंद एक अर्पण बने, और कई गुना होकर लौटे।' },
        lust: { en: 'May desire become energy you steer, not a current that steers you.', hi: 'इच्छा ऐसी ऊर्जा बने जिसे आप दिशा दें — ऐसी धारा नहीं जो आपको बहा ले जाए।' },
        emptiness: { en: 'May something small and good find you today, and remind you that you are not empty — only resting.', hi: 'आज कोई छोटी, अच्छी बात आप तक पहुँचे, और याद दिलाए कि आप ख़ाली नहीं — बस विश्राम में हैं।' },
        pride: { en: 'May you stand tall and bow easily — both at once.', hi: 'आप सिर ऊँचा रखें और सहजता से झुक भी सकें — दोनों एक साथ।' },
        love: { en: 'May your love be a lamp, never a chain.', hi: 'आपका प्रेम दीपक बने, ज़ंजीर कभी नहीं।' },
        devotion: { en: 'May your longing for the Divine be met by the Divine’s longing for you (9.29).', hi: 'ईश्वर के लिए आपकी चाह का उत्तर आपके लिए ईश्वर की चाह से मिले (9.29)।' },
        inertia: { en: 'May the first small step be easy, and the next one easier.', hi: 'पहला छोटा क़दम आसान हो, और अगला उससे भी आसान।' }
    };

    const NEUTRAL_BLESSING = { en: 'May you leave a little lighter than you came.', hi: 'आप जितने आए थे, उससे थोड़े हल्के होकर जाएँ।' };

    // counselKey: the counsel chosen for this reply (null when it was already
    // given in this conversation, so the general guidance speaks instead).
    function guidanceFor(verse, profile, lang, { counselKey = null } = {}) {
        const feeling = counselFeeling(profile);
        const care = profile.care ? CARE_COUNSEL[profile.care.mode] : null;
        const counsel = counselKey ? COUNSEL[counselKey]?.[lang] : null;
        const base = (feeling && GUIDANCE[feeling]) || NEUTRAL_GUIDANCE;
        const entry = care ? { practice: care.practice, [lang]: care[lang] }
            : counsel ? { practice: base.practice, [lang]: { bridge: counsel.bridge, step: counsel.step } } : base;
        const simple = verse.notification_short && (verse.notification_short[lang] || verse.notification_short.en);
        const situation = lang === 'en' ? matchingSituation(verse, profile) : null;
        return {
            simple: simple || null,
            situation,
            bridge: entry[lang].bridge,
            step: entry[lang].step,
            practice: entry.practice,
            blessing: care ? CARE_BLESSING[lang] : ((feeling && BLESSINGS[feeling]) || NEUTRAL_BLESSING)[lang],
            counselled: Boolean(counsel || care),
            emotion: profile.primary
        };
    }

    const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];

    // What Sakha already said in this conversation, made comparable.
    const plainText = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();

    // Pick from a list, avoiding anything already said in this conversation.
    function pickFresh(list, random, said = []) {
        if (!said.length) return pick(list, random);
        const spoken = said.map(plainText);
        const fresh = list.filter((item) => {
            const sample = plainText(typeof item === 'function' ? item({ noun: '', obl: '', g: 'm' }) : item).slice(0, 40);
            return !spoken.some((line) => sample && line.includes(sample));
        });
        return pick(fresh.length ? fresh : list, random);
    }

    function acknowledge(profile, lang, random, said = []) {
        const emotion = profile.primary && EMOTIONS[profile.primary];
        if (!emotion) return pickFresh(NEUTRAL_ACKS[lang], random, said);
        // Two heavy feelings at once are named together: "your grief — and your anger too".
        const second = profile.emotions.find((name) => name !== profile.primary && HEAVY(name));
        if (HEAVY(profile.primary) && second && EMOTIONS[second] && !['lust', 'pride', 'emptiness', 'inertia'].includes(profile.primary)) {
            return PERSONAL.both[lang](emotion[lang].noun, EMOTIONS[second][lang].noun);
        }
        const voice = VOICE[profile.primary]?.[lang];
        return voice ? pickFresh(voice, random, said) : pickFresh(ACKS[lang], random, said)(emotion[lang]);
    }

    // -----------------------------------------------------------------------
    // Understanding what kind of message this is. Not everything is a feeling:
    // people say hello, say thank you, ask what karma means, ask who they are
    // talking to, or simply didn't understand the last verse.
    // -----------------------------------------------------------------------

    const GREETINGS = {
        devotional: [
            { terms: ['jai shri krishna', 'jai shree krishna', 'jai sri krishna', 'जय श्री कृष्ण'], reply: { en: 'Jai Shri Krishna', hi: 'जय श्री कृष्ण' } },
            { terms: ['radhe radhe', 'radhey radhey', 'राधे राधे'], reply: { en: 'Radhe Radhe', hi: 'राधे राधे' } },
            { terms: ['hare krishna', 'hare krsna', 'हरे कृष्ण'], reply: { en: 'Hare Krishna', hi: 'हरे कृष्ण' } },
            { terms: ['ram ram', 'jai shri ram', 'jai siya ram', 'राम राम', 'जय श्री राम', 'जय सिया राम'], reply: { en: 'Ram Ram', hi: 'राम राम' } }
        ],
        plain: ['hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heyy', 'hola', 'namaste', 'namaskar', 'namaskaram', 'pranam', 'vanakkam',
            'good morning', 'good afternoon', 'good evening', 'good night', 'sat sri akal', 'नमस्ते', 'नमस्कार', 'प्रणाम', 'सुप्रभात']
    };

    const THANKS_TERMS = ['thank you', 'thanks', 'thank u', 'thanku', 'thankyou', 'thx', 'ty', 'dhanyavad', 'dhanyawad', 'shukriya',
        'धन्यवाद', 'शुक्रिया', 'that helped', 'this helped', 'it helped', 'helped me', 'feel better now', 'feeling better',
        'better now', 'feel lighter', 'accha laga', 'acha laga', 'अच्छा लगा'];
    const WANTING = ['want', 'how', 'need', 'wish', 'can i', 'could', 'chahta', 'chahti', 'चाहता', 'चाहती', 'kaise', 'कैसे'];

    const ACK_TERMS = ['ok', 'okay', 'okk', 'okay okay', 'ok ok', 'hmm', 'hm', 'hmm ok', 'hmmm', 'k', 'yes', 'yeah', 'yep', 'fine', 'alright',
        'i see', 'got it', 'right', 'sure', 'acha', 'accha', 'achha', 'theek hai', 'thik hai', 'thik h', 'haan', 'ha', 'ठीक है', 'अच्छा', 'हाँ', 'हम्म',
        'hm ok', 'ok hm'];

    const SELF_TERMS = ['who are you', 'what are you', 'what can you do', 'how does this work', 'how do you work', 'are you real',
        'are you ai', 'are you an ai', 'are you a bot', 'are you human', 'are you a person', 'are you krishna', 'are you god',
        'what is sakha', 'tum kaun ho', 'aap kaun ho', 'aap kon ho', 'tum kon ho', 'तुम कौन हो', 'आप कौन हैं', 'आप कौन हो'];

    const EXPLAIN_TERMS = ['i dont understand', 'i do not understand', 'dont get it', 'didnt understand', 'did not understand',
        'not clear', 'what does that mean', 'what does this mean', 'what do you mean', 'explain', 'simpler', 'simple words',
        'easy words', 'elaborate', 'in detail', 'samajh nahi', 'samjha nahi', 'samjhi nahi', 'samjhao', 'samjhaiye', 'matlab kya',
        'iska matlab', 'iska kya matlab', 'how do i apply', 'how to apply', 'how can i apply', 'apply this', 'how do i live this',
        'what should i do with this', 'what do i do now', 'समझ नहीं', 'समझाइए', 'समझाओ', 'इसका मतलब', 'इसका अर्थ'];

    const QUESTION_CUES = ['what is', 'whats', 'what are', 'what does', 'what do', 'what happens', 'is there', 'why do', 'why does', 'why is', 'why are', 'meaning of', 'define', 'explain', 'tell me about',
        'who is', 'who was', 'who are', 'kya hai', 'kya hota', 'kya hote', 'kya matlab', 'kaun hai', 'kaun the', 'kon hai',
        'matlab', 'kya hai', 'क्या है', 'क्या होता', 'क्या होती', 'कौन है', 'कौन थे', 'का अर्थ', 'का मतलब', 'मतलब', 'बताइए', 'बताओ'];

    // A plain-words glossary. Each entry is anchored in the verse that
    // teaches it, so the answer is the Gita's, not ours.
    const GLOSSARY = {
        dharma: {
            terms: ['dharma', 'dharm', 'svadharma', 'swadharma', 'धर्म', 'स्वधर्म'],
            verse: '3_35',
            en: { title: 'Dharma — what is rightly yours to do', body: 'Dharma is the right way to act for who you are and where you stand — your duty, but also your nature. The Gita says it is better to live your own dharma imperfectly than someone else\'s perfectly (3.35). So the question is not "what would look best?" but "what is mine to do?"' },
            hi: { title: 'धर्म — जो सचमुच आपका करने योग्य है', body: 'धर्म का अर्थ है आप जो हैं और जहाँ खड़े हैं, उसके अनुसार सही ढंग से कर्म करना — आपका कर्तव्य, और आपका स्वभाव भी। गीता कहती है कि दूसरे के धर्म को अच्छी तरह निभाने से अपना धर्म अधूरा निभाना भी बेहतर है (3.35)। इसलिए प्रश्न यह नहीं कि "क्या अच्छा दिखेगा?", बल्कि यह कि "मेरा करने योग्य क्या है?"' }
        },
        karma: {
            terms: ['karma', 'karm', 'nishkama', 'nishkam', 'कर्म', 'निष्काम'],
            verse: '2_47',
            en: { title: 'Karma — action, and letting go of its fruit', body: 'Karma simply means action — and the trace every action leaves. The Gita\'s teaching is not "you get what you deserve" but "act fully, and let go of the fruit" (2.47). The effort is yours to give; the outcome is not yours to own.' },
            hi: { title: 'कर्म — कर्म करना, और उसके फल को छोड़ना', body: 'कर्म का अर्थ है कार्य — और हर कार्य जो छाप छोड़ता है। गीता की शिक्षा "जैसा करोगे वैसा भरोगे" भर नहीं है, बल्कि "पूरे मन से कर्म करो और फल को छोड़ दो" है (2.47)। प्रयास देना आपका काम है; परिणाम पर आपका अधिकार नहीं।' }
        },
        yoga: {
            terms: ['yoga', 'yog', 'योग'],
            verse: '2_48',
            en: { title: 'Yoga — steadiness of mind', body: 'In the Gita, yoga is not exercise. It means union, and steadiness: "evenness of mind is called yoga" (2.48) — acting well while staying the same in success and failure. There are several paths — action (karma), knowledge (jñāna), devotion (bhakti), meditation (dhyāna) — all leading to the same calm centre.' },
            hi: { title: 'योग — मन की स्थिरता', body: 'गीता में योग व्यायाम नहीं है। इसका अर्थ है जुड़ना, और स्थिर रहना: "समत्वं योग उच्यते" — मन की समता ही योग है (2.48), यानी सफलता और असफलता में एक-सा रहते हुए अच्छे से कर्म करना। इसके कई मार्ग हैं — कर्म, ज्ञान, भक्ति, ध्यान — और सब उसी शांत केंद्र तक ले जाते हैं।' }
        },
        atman: {
            terms: ['atman', 'atma', 'aatma', 'aatman', 'the soul', 'soul', 'आत्मा'],
            verse: '2_20',
            en: { title: 'Ātman — the self that does not break', body: 'The ātman is your true self — not your body, your thoughts or your roles, but the awareness beneath them. The Gita says it is never born and never dies (2.20); weapons cannot cut it and fire cannot burn it (2.23). Whatever you are going through is happening to you. It is not who you are.' },
            hi: { title: 'आत्मा — वह स्वरूप जो टूटता नहीं', body: 'आत्मा आपका सच्चा स्वरूप है — आपका शरीर, विचार या भूमिकाएँ नहीं, बल्कि उनके नीचे की चेतना। गीता कहती है कि यह न जन्म लेती है, न मरती है (2.20); इसे शस्त्र काट नहीं सकते, आग जला नहीं सकती (2.23)। आप जिससे गुज़र रहे हैं, वह आपके साथ हो रहा है — वह आप नहीं हैं।' }
        },
        moksha: {
            terms: ['moksha', 'moksh', 'mukti', 'liberation', 'nirvana', 'मोक्ष', 'मुक्ति'],
            verse: '2_71',
            en: { title: 'Moksha — freedom', body: 'Moksha is freedom — from fear, from the endless pull of wanting, from the cycle of birth and death. The Gita says it begins in this very life: one who lets go of "I" and "mine" and moves free of craving "attains peace" (2.71).' },
            hi: { title: 'मोक्ष — मुक्ति', body: 'मोक्ष मुक्ति है — भय से, इच्छाओं के अनंत खिंचाव से, जन्म-मृत्यु के चक्र से। गीता कहती है कि यह इसी जीवन में शुरू होता है: जो "मैं" और "मेरा" छोड़कर कामना से मुक्त होकर चलता है, वह "शांति पाता है" (2.71)।' }
        },
        bhakti: {
            terms: ['bhakti', 'bhakt', 'devotion', 'भक्ति', 'भक्त'],
            verse: '9_26',
            en: { title: 'Bhakti — love turned toward God', body: 'Bhakti is devotion — love turned toward the Divine. The Gita says it needs no wealth or ritual: "a leaf, a flower, a fruit or a little water, offered with love — I accept it" (9.26). It is the simplest path, and open to anyone, in any state.' },
            hi: { title: 'भक्ति — ईश्वर की ओर मुड़ा प्रेम', body: 'भक्ति ईश्वर के प्रति प्रेम है। गीता कहती है कि इसके लिए धन या विधि-विधान ज़रूरी नहीं: "पत्र, पुष्प, फल या थोड़ा जल — प्रेम से अर्पित हो तो मैं स्वीकार करता हूँ" (9.26)। यह सबसे सरल मार्ग है, हर किसी के लिए, हर हाल में।' }
        },
        guna: {
            terms: ['guna', 'gunas', 'sattva', 'satva', 'rajas', 'tamas', 'गुण', 'सत्त्व', 'सत्व', 'रजस्', 'रजोगुण', 'तमस्', 'तमोगुण'],
            verse: '14_5',
            en: { title: 'The three guṇas', body: 'The guṇas are the three qualities that colour everything in nature, including your moods: sattva (clarity, calm), rajas (drive, restlessness) and tamas (heaviness, inertia) (14.5). None of them is you. Noticing which one is strong today is already the first step beyond it (14.23).' },
            hi: { title: 'तीन गुण', body: 'गुण प्रकृति के तीन रंग हैं जो हर चीज़ को रंगते हैं — आपके मन को भी: सत्त्व (स्पष्टता, शांति), रजस् (दौड़, बेचैनी) और तमस् (भारीपन, आलस) (14.5)। इनमें से कोई भी आप नहीं हैं। आज कौन-सा गुण प्रबल है, यह देख लेना ही उससे आगे बढ़ने का पहला क़दम है (14.23)।' }
        },
        maya: {
            terms: ['maya', 'माया', 'illusion'],
            verse: '7_14',
            en: { title: 'Māyā — the veil', body: 'Māyā is the power that makes the passing world seem like all there is. The Gita calls it hard to cross — yet those who turn to the Divine go beyond it (7.14). It is why things feel so permanent while they hurt, and why they change anyway.' },
            hi: { title: 'माया — परदा', body: 'माया वह शक्ति है जो इस बदलते संसार को ही सब कुछ दिखाती है। गीता इसे पार करना कठिन बताती है — फिर भी जो ईश्वर की शरण लेते हैं, वे इसके पार चले जाते हैं (7.14)। इसीलिए दुःख के समय सब कुछ स्थायी लगता है — और फिर भी बदल जाता है।' }
        },
        krishna: {
            terms: ['krishna', 'krsna', 'kanha', 'kanhaiya', 'shri krishna', 'shree krishna', 'कृष्ण', 'कान्हा', 'श्रीकृष्ण'],
            verse: '10_20',
            en: { title: 'Krishna', body: 'In the Gita, Krishna is Arjuna\'s charioteer, friend and teacher — and, as he reveals, the Divine itself: "I am the Self seated in the heart of every being" (10.20). He does not speak from a throne but from beside Arjuna, in the chariot, as a friend.' },
            hi: { title: 'कृष्ण', body: 'गीता में कृष्ण अर्जुन के सारथी, सखा और गुरु हैं — और, जैसा वे स्वयं बताते हैं, स्वयं ईश्वर: "मैं हर प्राणी के हृदय में स्थित आत्मा हूँ" (10.20)। वे सिंहासन से नहीं, रथ में अर्जुन के पास बैठकर, एक मित्र की तरह बोलते हैं।' }
        },
        arjuna: {
            terms: ['arjuna', 'arjun', 'अर्जुन'],
            verse: '2_7',
            en: { title: 'Arjuna', body: 'Arjuna is a great warrior who, on the eve of battle, breaks down — grieving, confused, unable to act. The Gita begins with his despair (2.7), not his strength. That is why it speaks so well to anyone who feels lost: it was spoken first to someone who was.' },
            hi: { title: 'अर्जुन', body: 'अर्जुन एक महान योद्धा हैं जो युद्ध से ठीक पहले टूट जाते हैं — शोक में, उलझन में, कुछ करने में असमर्थ। गीता उनकी शक्ति से नहीं, उनकी निराशा से शुरू होती है (2.7)। इसीलिए यह हर उस व्यक्ति से इतनी गहराई से बात करती है जो खोया हुआ महसूस करता है — क्योंकि यह पहले ऐसे ही व्यक्ति से कही गई थी।' }
        },
        gita: {
            terms: ['gita', 'geeta', 'bhagavad gita', 'bhagwad gita', 'bhagavad geeta', 'गीता', 'भगवद्गीता', 'भगवद गीता'],
            verse: '4_3',
            en: { title: 'The Bhagavad Gītā', body: 'The Bhagavad Gītā — "the song of the Divine" — is a 700-verse conversation inside the Mahābhārata, between Krishna and Arjuna on a battlefield. It answers the oldest questions: how to act, how to bear pain, what lasts. Krishna says he shares it because Arjuna is his friend (4.3).' },
            hi: { title: 'भगवद्गीता', body: 'भगवद्गीता — "ईश्वर का गीत" — महाभारत के भीतर 700 श्लोकों का संवाद है, रणभूमि में कृष्ण और अर्जुन के बीच। यह सबसे पुराने प्रश्नों का उत्तर देती है: कैसे कर्म करें, दुःख कैसे सहें, क्या शाश्वत है। कृष्ण कहते हैं कि वे यह इसलिए कह रहे हैं क्योंकि अर्जुन उनके सखा हैं (4.3)।' }
        },
        om: {
            terms: ['om', 'aum', 'ॐ', 'ओम', 'ओ३म्'],
            verse: '8_13',
            en: { title: 'Om', body: 'Om is the sacred sound of the whole — beginning, middle and end. The Gita says one who remembers the Divine while chanting Om reaches the highest (8.13). Chanting it slowly, even three times, can gather a scattered mind.' },
            hi: { title: 'ॐ', body: 'ॐ सम्पूर्ण का पवित्र नाद है — आरंभ, मध्य और अंत। गीता कहती है कि जो ॐ का उच्चारण करते हुए ईश्वर का स्मरण करता है, वह परम गति पाता है (8.13)। इसे धीरे-धीरे, तीन बार भी जपना बिखरे मन को समेट सकता है।' }
        },
        dhyana: {
            terms: ['dhyana', 'dhyan', 'meditation', 'meditate', 'ध्यान'],
            verse: '6_19',
            practice: 'dhyana',
            en: { title: 'Dhyāna — meditation', body: 'Dhyāna is sitting still and letting the mind rest on one thing. The Gita is practical about it — a quiet place, a steady seat, the body upright, the gaze soft (6.11–13) — and promises a mind like "a lamp in a windless place" (6.19). Five minutes is a real beginning.' },
            hi: { title: 'ध्यान', body: 'ध्यान का अर्थ है शांत बैठकर मन को एक चीज़ पर टिकने देना। गीता इस बारे में व्यावहारिक है — शांत स्थान, स्थिर आसन, सीधा शरीर, कोमल दृष्टि (6.11–13) — और ऐसे मन का वचन देती है जो "वायुरहित स्थान में दीपक" जैसा हो (6.19)। पाँच मिनट भी एक सच्ची शुरुआत है।' }
        },
        surrender: {
            terms: ['surrender', 'sharanagati', 'sharan', 'samarpan', 'शरणागति', 'शरण', 'समर्पण'],
            verse: '18_66',
            en: { title: 'Surrender — setting the weight down', body: 'Surrender in the Gita is not giving up. It is setting down a weight you were never meant to carry alone: "take refuge in me alone; I will free you; do not grieve" (18.66). You still act. You simply stop gripping the outcome.' },
            hi: { title: 'शरणागति — बोझ नीचे रखना', body: 'गीता में समर्पण हार मानना नहीं है। यह उस बोझ को नीचे रखना है जिसे आपको अकेले कभी नहीं उठाना था: "मेरी शरण में आओ; मैं तुम्हें मुक्त करूँगा; शोक मत करो" (18.66)। आप कर्म करते रहते हैं — बस परिणाम को जकड़ना छोड़ देते हैं।' }
        },
        detachment: {
            terms: ['detachment', 'non attachment', 'nonattachment', 'vairagya', 'anasakti', 'वैराग्य', 'अनासक्ति'],
            verse: '6_35',
            en: { title: 'Detachment — caring without clutching', body: 'Detachment does not mean not caring. It means caring fully about the work and the people while loosening your grip on how things must turn out. The Gita pairs it with practice: "by practice and detachment the restless mind is held" (6.35).' },
            hi: { title: 'वैराग्य — परवाह करना, जकड़ना नहीं', body: 'वैराग्य का अर्थ परवाह न करना नहीं है। इसका अर्थ है काम और लोगों की पूरी परवाह करते हुए इस पकड़ को ढीला करना कि सब कुछ कैसा होना ही चाहिए। गीता इसे अभ्यास के साथ जोड़ती है: "अभ्यास और वैराग्य से चंचल मन वश में होता है" (6.35)।' }
        },
        rebirth: {
            terms: ['reincarnation', 'rebirth', 'punarjanm', 'punarjanam', 'punar janm', 'after death', 'life after death', 'पुनर्जन्म', 'मृत्यु के बाद'],
            verse: '2_22',
            en: { title: 'What happens after death', body: 'The Gita teaches that the self moves on as a person changes clothes: "as one sets aside worn garments and puts on new ones, the self takes on new bodies" (2.22). Death, in this view, is a change of form — not the end of who someone is.' },
            hi: { title: 'मृत्यु के बाद क्या होता है', body: 'गीता सिखाती है कि आत्मा वैसे ही आगे बढ़ती है जैसे कोई वस्त्र बदलता है: "जैसे मनुष्य पुराने वस्त्र छोड़कर नए पहन लेता है, वैसे ही आत्मा नए शरीर धारण करती है" (2.22)। इस दृष्टि से मृत्यु रूप का बदलना है — व्यक्ति के होने का अंत नहीं।' }
        },
        sthitaprajna: {
            terms: ['sthitaprajna', 'sthita prajna', 'sthitpragya', 'steady wisdom', 'स्थितप्रज्ञ'],
            verse: '2_56',
            en: { title: 'Sthitaprajña — steady wisdom', body: 'A sthitaprajña is a person of steady wisdom — "not shaken by sorrow, not craving pleasure, free of fear and anger" (2.56). It is the Gita\'s picture of a calm, grown-up heart: something to grow toward, not a test to pass.' },
            hi: { title: 'स्थितप्रज्ञ — स्थिर बुद्धि', body: 'स्थितप्रज्ञ वह है जिसकी बुद्धि स्थिर है — "दुःख में जो विचलित नहीं होता, सुख की लालसा नहीं रखता, भय और क्रोध से मुक्त है" (2.56)। यह एक शांत, परिपक्व हृदय की गीता की छवि है: जिसकी ओर बढ़ना है, कोई परीक्षा नहीं जिसे पास करना है।' }
        },
        suffering: {
            terms: ['bad things happen', 'why is there suffering', 'why do people suffer', 'why do we suffer', 'why does god allow',
                'why god allows', 'suffering', 'dukh kyun', 'दुख क्यों', 'दुःख क्यों'],
            verse: '2_14',
            en: { title: 'Why do bad things happen?', body: 'The Gita does not pretend suffering is not real, and it does not blame the one who suffers. It offers three ways of seeing. Pain and pleasure are passing contacts, like winter and summer — they come and go (2.14). The deepest part of you is never harmed by them (2.23). And God "takes no one’s sin or merit"; it is our not-seeing that makes the world look cruel or random (5.15). It does not answer every "why" — but it shows how to bear it, and who you are while you do.' },
            hi: { title: 'बुरी बातें क्यों होती हैं?', body: 'गीता यह नहीं दिखाती कि दुख सच्चा नहीं, और न ही दुखी व्यक्ति को दोष देती है। वह देखने के तीन ढंग देती है। सुख और दुख आते-जाते संपर्क हैं, सर्दी और गर्मी की तरह (2.14)। आपका सबसे गहरा स्वरूप उनसे कभी आहत नहीं होता (2.23)। और ईश्वर "किसी का पाप या पुण्य नहीं लेते"; हमारा न देख पाना ही संसार को क्रूर या बेतरतीब दिखाता है (5.15)। यह हर "क्यों" का उत्तर नहीं देती — पर यह दिखाती है कि उसे कैसे सहें, और सहते हुए आप कौन हैं।' }
        },
        avatar: {
            terms: ['avatar', 'avatara', 'avtaar', 'avtar', 'अवतार'],
            verse: '4_7',
            en: { title: 'Avatāra — the Divine taking form', body: 'An avatāra is the Divine taking form in the world. "Whenever goodness declines and wrong rises, I come forth" (4.7) — Krishna\'s promise that the world is never abandoned.' },
            hi: { title: 'अवतार — ईश्वर का रूप लेना', body: 'अवतार ईश्वर का संसार में रूप लेना है। "जब-जब धर्म की हानि और अधर्म की वृद्धि होती है, तब-तब मैं प्रकट होता हूँ" (4.7) — कृष्ण का वचन कि यह संसार कभी अकेला नहीं छोड़ा जाता।' }
        },
        brahman: {
            terms: ['brahman', 'brahm', 'ब्रह्म'],
            verse: '5_18',
            en: { title: 'Brahman — the one reality', body: 'Brahman is the one reality behind everything — beyond form, yet present in all. That is why the Gita says the wise see the same Self in a scholar, a cow, an elephant, a dog and an outcast (5.18).' },
            hi: { title: 'ब्रह्म — एक ही सत्य', body: 'ब्रह्म वह एक सत्य है जो हर चीज़ के पीछे है — रूप से परे, फिर भी सब में उपस्थित। इसीलिए गीता कहती है कि ज्ञानी विद्वान, गाय, हाथी, कुत्ते और चांडाल में एक ही आत्मा देखते हैं (5.18)।' }
        }
    };

    // Practices someone can ask how to do.
    const HOW_CONCEPTS = ['dhyana', 'yoga', 'bhakti', 'surrender', 'detachment', 'om', 'karma'];

    const ETHICS_PATTERNS = [
        / (?:is it|isnt it|is it really|would it be) (?:wrong|bad|a sin|sinful|selfish|okay|ok|fine|normal|alright|allowed) (?:to|if i|that i) (.+)/,
        / (?:kya|क्या) (.+) (?:galat|paap|गलत|ग़लत|पाप) (?:hai|है)/,
        / (?:am i|is it) (?:a bad person|wrong|selfish) (?:for|to|because) (.+)/
    ];

    function ethicsQuestion(normalised) {
        const clean = normalised.replace(/\|/g, ' ');
        for (const pattern of ETHICS_PATTERNS) {
            const match = clean.match(pattern);
            if (!match) continue;
            const about = match[1].trim().split(' ').filter((word) => word && !['i', 'to', 'me', 'my', 'a', 'an', 'the', 'so', 'much'].includes(word)).slice(0, 5).join(' ');
            if (!about) continue;
            const feeling = understand(about).primary;
            return { about, feeling: feeling && HEAVY(feeling) ? feeling : null };
        }
        return null;
    }

    const ETHICS = {
        want: {
            verse: '7_11',
            en: {
                title: 'Wanting, by itself, is not wrong.',
                body: 'The Gita does not ask you to stop wanting. Krishna says he is present in desire itself — "I am desire that does not go against dharma" (7.11). What it warns against is wanting that rules you: desire that hardens into craving, and craving that turns to anger when it is blocked (3.37, 2.62). So the question is not "is it wrong to want this?" but "does this wanting keep me honest, kind and free?" If it does, pursue it fully — and hold the outcome lightly (2.47).'
            },
            hi: {
                title: 'चाहना अपने आप में ग़लत नहीं है।',
                body: 'गीता आपसे चाहना छोड़ने को नहीं कहती। कृष्ण कहते हैं कि वे स्वयं कामना में भी हैं — "धर्म के विरुद्ध न जाने वाली कामना मैं हूँ" (7.11)। वह उस चाह से सावधान करती है जो आप पर राज करने लगे: जो लालसा बन जाए, और रुकने पर क्रोध (3.37, 2.62)। इसलिए प्रश्न यह नहीं कि "क्या यह चाहना ग़लत है?", बल्कि यह कि "क्या यह चाह मुझे सच्चा, दयालु और मुक्त रखती है?" अगर हाँ, तो पूरे मन से उसके लिए कर्म कीजिए — और परिणाम को हल्के हाथों से थामिए (2.47)।'
            }
        },
        feel: {
            verse: '2_14',
            en: {
                title: 'Feeling it is not wrong.',
                body: 'Feelings arrive like weather; the Gita calls them contacts with the world that come and go, like winter and summer (2.14). What matters is what you do while one passes: not acting from it in a way you will regret (2.63), and not hating yourself for having it. Notice it, name it, and let it move through you without letting it steer.'
            },
            hi: {
                title: 'ऐसा महसूस करना ग़लत नहीं है।',
                body: 'भाव मौसम की तरह आते हैं; गीता उन्हें संसार के संपर्क कहती है जो सर्दी-गर्मी की तरह आते-जाते हैं (2.14)। मायने यह रखता है कि जब तक वह भाव है, आप क्या करते हैं: उसके बहाव में ऐसा कुछ न करें जिसका पछतावा हो (2.63), और उसे महसूस करने के लिए ख़ुद से नफ़रत न करें। उसे देखिए, नाम दीजिए, और बिना उसे दिशा सौंपे गुज़र जाने दीजिए।'
            }
        }
    };

    function lookupConcept(normalised) {
        for (const [id, entry] of Object.entries(GLOSSARY)) {
            if (entry.terms.some((term) => has(normalised, term))) return { id, ...entry };
        }
        return null;
    }

    const QUESTION_START = /^\s*(why|how|what|who|where|when|is|are|am|can|could|should|will|would|do|does|did|kya|kyun|kyu|kaise|kab|kahan|kaun|क्या|क्यों|कैसे|कब|कहाँ|कौन)\b/iu;
    const isQuestion = (text) => /\?\s*$/.test(String(text || '')) || QUESTION_START.test(String(text || ''));

    const wordCount = (normalised) => normalised.trim().split(' ').filter((word) => word && word !== '|').length;

    function detectIntent(text, { lastVerseId = null, reading = null } = {}) {
        const read = reading || understand(text);
        const normalised = read.normalised;
        if (normalised.trim() === '') return null;
        const words = read.words;
        const feelings = read.feelings.filter((feeling) => !LIGHT_FEELINGS.includes(feeling.id));

        // "What does the Gita say about karma?" is a question about karma;
        // "…about anger" is a request for a verse, answered as one.
        if (read.ask === 'verse') {
            const concept = lookupConcept(` ${read.about} `);
            return concept ? { kind: 'concept', concept } : null;
        }
        // "Is it wrong to want money?" — a question of conscience, not a feeling.
        const ethics = ethicsQuestion(normalised);
        if (ethics) return { kind: 'ethics', ...ethics };
        // "What is karma?" — or just "karma?" — or "how do I meditate?"
        const concept = lookupConcept(normalised);
        if (concept && (QUESTION_CUES.some((cue) => has(normalised, cue)) || words <= 2) && words <= 14) {
            return { kind: 'concept', concept };
        }
        if (concept && read.ask === 'how' && HOW_CONCEPTS.includes(concept.id) && words <= 9) return { kind: 'concept', concept };
        if (SELF_TERMS.some((term) => has(normalised, term)) && words <= 10) return { kind: 'self', godQuestion: has(normalised, 'are you krishna') || has(normalised, 'are you god') };
        if (lastVerseId && words <= 12 && EXPLAIN_TERMS.some((term) => has(normalised, term))) return { kind: 'explain' };
        if (words <= 3 && ACK_TERMS.includes(normalised.replace(/\|/g, ' ').trim().replace(/\s+/g, ' '))) return { kind: 'ack' };
        if (!feelings.length && words <= 8 && THANKS_TERMS.some((term) => has(normalised, term)) && !WANTING.some((term) => has(normalised, term))) {
            return { kind: 'thanks' };
        }
        if (!feelings.length && words <= 5 && !read.topics.length) {
            const devotional = GREETINGS.devotional.find((item) => item.terms.some((term) => has(normalised, term)));
            if (devotional) return { kind: 'greeting', reply: devotional.reply };
            if (GREETINGS.plain.some((term) => has(normalised, term))) return { kind: 'greeting', reply: null };
        }
        // "I just want to vent" — before anything is said, only an open door.
        if (read.ask === 'vent' && !feelings.length && !read.topics.length && !read.care && words <= 12) return { kind: 'listen' };
        return null;
    }

    // -----------------------------------------------------------------------
    // Safety — someone being hurt by another person needs help before a verse.
    // -----------------------------------------------------------------------

    const SAFETY_TERMS = ['hits me', 'beats me', 'beating me', 'beat me up', 'slaps me', 'abuses me', 'abusing me', 'abused',
        'abusive', 'molest*', 'rape*', 'sexually assault*', 'assaulted', 'harass*', 'domestic violence', 'unsafe at home',
        'not safe at home', 'threatens me', 'threatening me', 'stalking me', 'stalker', 'touches me', 'maarta hai', 'maarti hai',
        'maarte hai', 'marta hai', 'pitai', 'maar peet', 'मारता है', 'मारती है', 'मारते हैं', 'पिटाई', 'छेड़छाड़', 'उत्पीड़न', 'बलात्कार'];

    const SAFETY_RESPONSE = {
        en: 'What you are describing sounds unsafe, and you deserve to be safe. Please reach someone who can help right now — a person you trust, or one of these lines. They are free and confidential.\n\nHelp, right now:\n• Emergency (India): 112\n• Women Helpline (India): 181\n• Childline (India): 1098\n• Tele-MANAS (India): 14416\n• Anywhere in the world: https://findahelpline.com\n\nWhen you are safe, I am here to sit with you and the Gita.',
        hi: 'आप जो बता रहे हैं वह असुरक्षित लगता है, और आप सुरक्षित रहने के हक़दार हैं। कृपया अभी किसी ऐसे व्यक्ति से संपर्क करें जो मदद कर सके — किसी भरोसेमंद इंसान से, या इनमें से किसी हेल्पलाइन से। ये निःशुल्क और गोपनीय हैं।\n\nअभी मदद:\n• आपातकाल (भारत): 112\n• महिला हेल्पलाइन (भारत): 181\n• चाइल्डलाइन (भारत): 1098\n• टेली-मानस (भारत): 14416\n• दुनिया में कहीं भी: https://findahelpline.com\n\nजब आप सुरक्षित हों, मैं आपके और गीता के साथ बैठने के लिए यहीं हूँ।'
    };

    // Violence someone sees at home is as urgent as violence against them.
    const WITNESSED = / (hits|beats|slaps|kicks|punches|chokes|abuses|hurts|hit|beat|slapped|kicked|punched) (my|our) (mother|father|sister|brother|wife|husband|child|children|kids|son|daughter|grandmother|grandfather) /;

    function detectSafety(text) {
        const normalised = normalise(text);
        if (normalised === ' ') return false;
        if (WITNESSED.test(normalised)) return true;
        return SAFETY_TERMS.some((term) => {
            const index = findTerm(normalised, term);
            return index !== -1 && !negated(normalised, index, term.split(' ').length);
        });
    }

    // -----------------------------------------------------------------------
    // The person. Everything here comes from their own device — what they
    // chose to be called, what they wrote about before (as a situation label,
    // never their words), feelings that keep returning, today's intention,
    // and verses that moved them. It shapes the reply; it never leaves.
    // -----------------------------------------------------------------------

    const LIGHT_FEELINGS = ['peace', 'gratitude', 'love', 'devotion'];
    const HEAVY = (emotion) => Boolean(emotion) && !LIGHT_FEELINGS.includes(emotion);

    function cleanName(name) {
        if (typeof name !== 'string') return null;
        const trimmed = name.replace(/[^\p{L}\p{M} .'-]/gu, '').trim().slice(0, 24);
        return trimmed || null;
    }

    const withName = (sentence, name, lang) => {
        if (!name) return sentence;
        if (lang === 'hi') return `${name}, ${sentence}`;
        const keepCapital = /^(I\b|I’|I')/.test(sentence);
        return `${name}, ${keepCapital ? sentence : `${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`}`;
    };

    const PERSONAL = {
        returning: {
            en: (label) => `You wrote about ${label} before, too. Thank you for trusting me with it again.`,
            hi: (label) => `आपने पहले भी ${label} के बारे में लिखा था। फिर से भरोसा करने के लिए धन्यवाद।`
        },
        recurring: {
            en: 'This feeling has visited you before this week. Coming back to sit with it is itself a kind of strength.',
            hi: 'यह भाव इस सप्ताह पहले भी आया है। लौटकर इसके साथ बैठना अपने आप में एक शक्ति है।'
        },
        sankalpa: {
            en: (quality) => ` This morning you chose ${quality}. Moments like this are where it is lived.`,
            hi: (quality) => ` आज सुबह आपने ${quality} का संकल्प लिया था। ऐसे ही पलों में वह जिया जाता है।`
        },
        night: {
            en: 'It is late. Be gentle with yourself tonight — nothing has to be solved before morning.',
            hi: 'रात हो चुकी है। आज रात स्वयं के प्रति कोमल रहिए — सुबह से पहले कुछ भी सुलझाना ज़रूरी नहीं।'
        },
        long: {
            en: 'Thank you for writing all of this. It takes courage to put it into words.',
            hi: 'यह सब लिखने के लिए धन्यवाद। इसे शब्दों में रखने के लिए हिम्मत चाहिए।'
        },
        invite: {
            en: 'If you tell me a little more — what happened, and how it sits with you — I can find a verse closer to your heart.',
            hi: 'अगर आप थोड़ा और बताएँ — क्या हुआ, और मन पर कैसा लग रहा है — तो मैं आपके और क़रीब का श्लोक ढूँढ सकता हूँ।'
        },
        both: {
            en: (a, b) => `I hear your ${a} — and your ${b} too.`,
            hi: (a, b) => `आपके शब्दों में ${a} भी है और ${b} भी।`
        },
        smalltalk: {
            en: (name) => `I’m here${name ? `, ${name}` : ''}. Tell me a little more — how are you, really? You can write about anything: what happened today, what’s worrying you, or what you’re hoping for.`,
            hi: (name) => `मैं यहाँ हूँ${name ? `, ${name}` : ''}। थोड़ा और बताइए — आप सच में कैसे हैं? कुछ भी लिख सकते हैं: आज क्या हुआ, किस बात की चिंता है, या किस बात की आशा।`
        }
    };

    // "Tamish — may the next step be enough…"
    const withBlessingName = (blessing, name, lang) => {
        if (!name || !/^(May|आप|आपका|आपकी|आपको|यह|अगला|प्रेम|इच्छा|ईश्वर|आज|रास्ता|पहला)/.test(blessing)) return name ? `${name}, ${blessing}` : blessing;
        if (lang === 'hi') return `${name}, ${blessing}`;
        return `${name} — ${blessing.charAt(0).toLowerCase()}${blessing.slice(1)}`;
    };

    // Reply in Hindi when someone writes in Devanagari, whatever the setting.
    function replyLanguage(text, settings) {
        if (settings.language === 'hi') return 'hi';
        const letters = String(text || '').match(/\p{L}/gu) || [];
        if (!letters.length) return 'en';
        const devanagari = letters.filter((char) => /[ऀ-ॿ]/.test(char)).length;
        return devanagari / letters.length > 0.4 ? 'hi' : 'en';
    }

    function findVerse(verses, id) {
        return id ? verses.find((verse) => verse.id === id) || null : null;
    }

    function simpleOf(verse, lang) {
        return verse?.notification_short ? (verse.notification_short[lang] || verse.notification_short.en) : null;
    }

    function respondToIntent(intent, { verses, lang, name, person, profile, lastVerse }) {
        const greetingName = name ? (lang === 'hi' ? `, ${name}` : `, ${name}`) : '';
        if (intent.kind === 'greeting') {
            const salutation = intent.reply ? intent.reply[lang] : (lang === 'hi' ? 'नमस्ते' : 'Namaste');
            const last = person?.lastVisit;
            const lastLabel = last?.topic && TOPICS[last.topic] ? TOPICS[last.topic].label[lang] : null;
            const daysAgo = last?.at ? (Date.now() - Date.parse(last.at)) / 86400000 : Infinity;
            const continuity = lastLabel && daysAgo >= 0.5 && daysAgo < 30
                ? (lang === 'hi' ? ` पिछली बार आपने ${lastLabel} के बारे में लिखा था। अब वह कैसा है?` : ` Last time, you wrote about ${lastLabel}. How is that now?`)
                : '';
            const message = lang === 'hi'
                ? `${salutation} 🙏 मैं यहाँ हूँ${greetingName}।${continuity}\n\nआज मन में क्या है? एक शब्द भी काफ़ी है — या सब कुछ लिख दीजिए।`
                : `${salutation} 🙏 I'm here${greetingName}.${continuity}\n\nWhat is on your heart today? A word is enough — or write everything.`;
            return { message, verse: null, context: { intent: 'greeting' } };
        }
        if (intent.kind === 'listen') {
            const message = lang === 'hi'
                ? `${LISTEN.hi}

लिखते जाइए${greetingName} — मैं यहीं हूँ।`
                : `${LISTEN.en}

Go on${greetingName} — I’m here.`;
            return { message, verse: null, context: { intent: 'listen', listening: true } };
        }
        if (intent.kind === 'ack') {
            const message = lang === 'hi'
                ? `आराम से${greetingName}। अगर मन में कुछ और हो — या वही बात किसी और कोण से — तो मैं यहीं हूँ।`
                : `Take your time${greetingName}. If something else is on your mind — or the same thing, from another side — I’m here.`;
            return { message, verse: null, context: { intent: 'ack' } };
        }
        if (intent.kind === 'thanks') {
            const message = lang === 'hi'
                ? `मुझे ख़ुशी है${greetingName}। जब भी ज़रूरत हो, लौट आइए — मैं यहीं हूँ।`
                : `I'm glad${greetingName}. Come back whenever you need — I'll be here.`;
            return { message, verse: null, guidance: { blessing: NEUTRAL_BLESSING[lang] }, context: { intent: 'thanks' } };
        }
        if (intent.kind === 'self') {
            const notGod = intent.godQuestion
                ? (lang === 'hi' ? 'नहीं — मैं कृष्ण नहीं हूँ, केवल उनके शब्दों को साथ लेकर चलने वाला एक मित्र। ' : 'No — I am not Krishna, only a friend who carries his words. ')
                : '';
            const message = lang === 'hi'
                ? `${notGod}मैं सखा हूँ — न कोई व्यक्ति, न कोई गुरु, बल्कि भगवद्गीता के इर्द-गिर्द बना एक शांत मित्र। अपने मन की बात किसी भी शब्दों में कहिए — हिन्दी, अंग्रेज़ी या हिंग्लिश। मैं वह श्लोक ढूँढूँगा जो उससे बात करता है, उसे सरल शब्दों में कहूँगा, और एक छोटा क़दम सुझाऊँगा। आप जो लिखते हैं, वह केवल इसी डिवाइस पर पढ़ा जाता है।`
                : `${notGod}I'm Sakha — not a person and not a guru, but a quiet friend built around the Bhagavad Gita. Tell me what's on your heart in any words — English, Hindi or Hinglish. I'll find the verse that speaks to it, say it simply, and suggest one small step. What you write is read only on this device.`;
            const verse = findVerse(verses, '4_3');
            return { message, verse, guidance: verse ? { simple: simpleOf(verse, lang) } : null, context: { intent: 'self' } };
        }
        if (intent.kind === 'ethics') {
            const entry = ETHICS[intent.feeling ? 'feel' : 'want'];
            const verse = findVerse(verses, entry.verse);
            const message = `${entry[lang].title}\n\n${entry[lang].body}`;
            const guidance = verse ? { simple: simpleOf(verse, lang), step: null } : null;
            return { message, verse, guidance, context: { intent: 'ethics' } };
        }
        if (intent.kind === 'concept') {
            const entry = intent.concept;
            const verse = findVerse(verses, entry.verse);
            const title = entry[lang].title;
            const message = `${/[.?!।]$/.test(title) ? title : `${title}.`}\n\n${entry[lang].body}`;
            const guidance = verse ? { simple: simpleOf(verse, lang), practice: entry.practice || null, step: null } : null;
            return { message, verse, guidance, context: { intent: 'concept', concept: intent.concept.id } };
        }
        if (intent.kind === 'explain' && lastVerse) {
            const entry = (profile.primary && GUIDANCE[profile.primary]) || NEUTRAL_GUIDANCE;
            const simple = simpleOf(lastVerse, lang);
            const moments = (lastVerse.life_situations || []).slice(0, 3);
            const ref = `${lastVerse.chapter}.${lastVerse.verse || lastVerse.verse_number}`;
            const parts = lang === 'hi'
                ? [
                    `इसे और सरल ढंग से कहूँ (${ref}):`,
                    simple ? `सरल शब्दों में: ${simple}` : null,
                    lastVerse.meaning_hi ? `पूरा अर्थ: ${lastVerse.meaning_hi}` : null,
                    `आज इसे ऐसे जिएँ: ${entry.hi.step}`
                ]
                : [
                    `Let me say it more simply (${ref}):`,
                    simple ? `In plain words: ${simple}` : null,
                    moments.length ? `It is for moments like ${moments.length > 1 ? `${moments.slice(0, -1).join(', ')} or ${moments[moments.length - 1]}` : moments[0]}.` : null,
                    `How to live it today: ${entry.en.step}`
                ];
            return { message: parts.filter(Boolean).join('\n\n'), verse: null, context: { intent: 'explain', explained: lastVerse.id } };
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Answering the reading — how strongly it is felt, whether it has eased,
    // what is being asked, and how the conversation has moved.
    // -----------------------------------------------------------------------

    const INTENSE = {
        en: ['This is more than anyone should have to hold alone.', 'I can feel how hard this is pressing on you.',
            'That is a heavy thing to carry. Thank you for not carrying it in silence.'],
        hi: ['यह बहुत भारी लगता है — इतना किसी को अकेले नहीं उठाना चाहिए।', 'मैं महसूस कर सकता हूँ कि यह आप पर कितना दबाव डाल रहा है।',
            'यह उठाने में बहुत भारी है। इसे चुपचाप न ढोने के लिए धन्यवाद।']
    };
    const JOYFUL = {
        en: ['I can feel your joy from here!', 'This is wonderful — let it fill the whole day.'],
        hi: ['आपकी ख़ुशी यहाँ तक महसूस हो रही है!', 'यह अद्भुत है — इसे पूरे दिन में भर जाने दीजिए।']
    };
    const GENTLE = {
        en: 'Even a small unease deserves care before it grows.',
        hi: 'छोटी-सी बेचैनी भी बढ़ने से पहले देखभाल की हक़दार है।'
    };
    const MIXED = {
        en: 'There is something good in this too — both can be true at once.',
        hi: 'इसमें कुछ अच्छा भी है — दोनों बातें एक साथ सच हो सकती हैं।'
    };
    const AHEAD = {
        en: 'What you are dreading has not happened yet. Right now you are here — and this is where the Gita meets you.',
        hi: 'जिस बात का डर है, वह अभी हुई नहीं है। अभी आप यहाँ हैं — और गीता आपसे यहीं मिलती है।'
    };
    const RELIEF = {
        ack: {
            en: ['I am so glad it has eased.', 'It is good to hear you are through the worst of it.'],
            hi: ['मुझे बहुत ख़ुशी है कि अब यह हल्का हुआ है।', 'यह सुनकर अच्छा लगा कि सबसे कठिन समय निकल गया।']
        },
        keep: {
            en: 'Whatever helped you through is worth remembering — you may need it again, or someone you love might.',
            hi: 'जिस बात ने आपको पार कराया, उसे याद रखिए — वह फिर काम आ सकती है, आपके या किसी अपने के।'
        }
    };
    const LISTEN = {
        en: 'I’m listening — no fixing, no lessons. Say all of it, just as it is.',
        hi: 'मैं सुन रहा हूँ — न कोई सुधार, न कोई उपदेश। जो है, सब वैसा ही कह दीजिए।'
    };
    const LISTEN_REFLECTION = {
        en: 'Not advice — only a verse to sit beside you.',
        hi: 'कोई सलाह नहीं — बस आपके पास बैठने के लिए एक श्लोक।'
    };
    const HOW = {
        en: 'You asked what to do. After the verse there is one small step to start with — it is enough for today.',
        hi: 'आपने पूछा कि क्या करें। श्लोक के बाद शुरुआत के लिए एक छोटा क़दम है — आज के लिए इतना काफ़ी है।'
    };
    const VERSE_ON = {
        en: (about) => `Here is what the Gita says about ${about}.`,
        hi: (about) => `${about} के बारे में गीता यह कहती है।`
    };
    const TRAJECTORY = {
        easing: {
            en: 'It sounds a little lighter than when we began. I am glad.',
            hi: 'जब हमने बात शुरू की थी, उससे अब कुछ हल्का लग रहा है। मुझे ख़ुशी है।'
        },
        heavier: {
            en: 'This seems to be weighing more as we talk. Stay as long as you need — I am not going anywhere.',
            hi: 'बात करते-करते यह और भारी होता लग रहा है। जितनी देर चाहें, रुकिए — मैं कहीं नहीं जा रहा।'
        },
        lingering: {
            en: 'It is still here. That does not mean nothing is working — some knots take longer to loosen.',
            hi: 'यह अब भी यहाँ है। इसका अर्थ यह नहीं कि कुछ काम नहीं कर रहा — कुछ गाँठें खुलने में समय लेती हैं।'
        }
    };

    // "Not quite" — and what would help instead.
    const RETRY = {
        comfort: { en: 'Let me offer something gentler.', hi: 'तो कुछ और कोमल सुनिए।' },
        practical: { en: 'Here is something more practical — about what you can do.', hi: 'अब कुछ ज़्यादा व्यावहारिक — इस बारे में कि आप क्या कर सकते हैं।' },
        deeper: { en: 'Let us go a little deeper.', hi: 'आइए, थोड़ा और गहराई में चलें।' },
        situation: {
            en: 'I may have misread what this is about. What is it mostly about?',
            hi: 'हो सकता है मैंने ग़लत समझा। यह मुख्य रूप से किस बारे में है?'
        }
    };
    const RETRY_REASONS = Object.keys(RETRY);

    const TOPIC_CLARIFY = {
        en: [['Work', 'It is about my work'], ['Studies', 'It is about my studies'], ['Family', 'It is about my family'],
            ['Relationship', 'It is about my relationship'], ['Health', 'It is about my health'], ['Money', 'It is about money'],
            ['Myself', 'It is about how I see myself']],
        hi: [['काम', 'यह मेरे काम के बारे में है'], ['पढ़ाई', 'यह मेरी पढ़ाई के बारे में है'], ['परिवार', 'यह मेरे परिवार के बारे में है'],
            ['रिश्ता', 'यह मेरे रिश्ते के बारे में है'], ['सेहत', 'यह मेरी सेहत के बारे में है'], ['पैसा', 'यह पैसों के बारे में है'],
            ['ख़ुद', 'यह मेरे आत्मविश्वास के बारे में है']]
    };

    // How Sakha speaks, as each person chose: gently (the default), plainly,
    // or explaining more.
    const VOICES = ['gentle', 'direct', 'teacher'];
    // For someone who likes things explained: the moments this verse was
    // written for (its headline is already shown with the verse itself).
    const MOMENTS = {
        en: (moments) => `People turn to this verse for ${moments.length > 1 ? `${moments.slice(0, -1).join(', ')} and ${moments[moments.length - 1]}` : moments[0]}.`
    };
    const STANDING_LINE = {
        en: (label) => `With ${label} on your mind these days, this makes sense.`,
        hi: (label) => `${label} इन दिनों आपके मन पर है — ऐसे में यह महसूस होना स्वाभाविक है।`
    };

    // Grief is not a season to wait out; it is love looking for its person.
    ROOTS.grief = {
        en: 'The Gita does not call grief wrong — it begins with Arjuna in tears (2.1). What it offers is a way of seeing the one you love: the self is never born and never dies (2.20), only its clothes change (2.22). Grief is love, still looking for its person.',
        hi: 'गीता शोक को ग़लत नहीं कहती — वह आँसुओं में डूबे अर्जुन से ही शुरू होती है (2.1)। वह अपने प्रिय को देखने का एक ढंग देती है: आत्मा न जन्म लेती है, न मरती है (2.20), केवल उसके वस्त्र बदलते हैं (2.22)। शोक वह प्रेम है जो अब भी अपने प्रिय को खोज रहा है।'
    };

    // The second time someone sends a word or two, a lighter door.
    const SMALLTALK_AGAIN = {
        en: (name) => `No pressure${name ? `, ${name}` : ''}. Even one word is enough — or tap whichever is closest, and we can begin there.`,
        hi: (name) => `कोई जल्दी नहीं${name ? `, ${name}` : ''}। एक शब्द भी काफ़ी है — या जो सबसे क़रीब लगे उसे चुन लीजिए, वहीं से शुरू करते हैं।`
    };

    // When a word this person taught Sakha comes back.
    const REMEMBERED_WORD = {
        en: (word) => `I remember what “${word}” means for you.`,
        hi: (word) => `मुझे याद है कि आपके लिए “${word}” का क्या मतलब है।`
    };

    // "I'm fine, I guess" after something heavy.
    const MASKING = {
        en: 'You said you’re fine — and maybe you are. But if something is sitting under that "I guess", you can set it down here.',
        hi: 'आपने कहा कि सब ठीक है — शायद हो भी। पर अगर उस "ठीक" के नीचे कुछ दबा है, तो उसे यहाँ रख सकते हैं।'
    };

    // When the same carer writes again: their own feeling, met as theirs.
    const CARE_AGAIN = {
        en: ['That fear is the other face of your love.', 'Caring this much is tiring. Be gentle with yourself too.', 'You are holding a great deal for someone else. Who is holding you?'],
        hi: ['यह डर भी आपके प्रेम का ही दूसरा रूप है।', 'इतनी परवाह करना थका देता है। अपने साथ भी कोमल रहिए।', 'आप किसी और के लिए बहुत कुछ थामे हुए हैं। आपको कौन थामे हुए है?']
    };

    // Small, concrete things to do — for "something practical", and so a
    // step is never offered twice in one conversation.
    const PRACTICAL_STEPS = {
        en: [
            'Set a timer for ten minutes and do only the first small piece of what is in front of you. Stop when it rings.',
            'Write the whole problem as one sentence. Under it, write the smallest next action — and do that one today.',
            'Tell one person what you are facing, and ask for one specific kind of help.',
            'Walk for ten minutes without your phone. Decide your next step only when you are back.',
            'Put today’s three tasks on paper. Do only the first. Cross it out by hand.',
            'Before you sleep, write down one thing that went right today, however small.'
        ],
        hi: [
            'दस मिनट का टाइमर लगाइए और सामने के काम का सिर्फ़ पहला छोटा हिस्सा कीजिए। घंटी बजते ही रुक जाइए।',
            'पूरी समस्या को एक वाक्य में लिखिए। उसके नीचे सबसे छोटा अगला क़दम लिखिए — और वही आज कीजिए।',
            'किसी एक व्यक्ति को बताइए कि आप किससे गुज़र रहे हैं, और एक ख़ास तरह की मदद माँगिए।',
            'फ़ोन के बिना दस मिनट टहलिए। अगला क़दम लौटकर ही तय कीजिए।',
            'आज के तीन काम काग़ज़ पर लिखिए। सिर्फ़ पहला कीजिए। उसे हाथ से काट दीजिए।',
            'सोने से पहले एक बात लिखिए जो आज ठीक हुई, चाहे कितनी भी छोटी हो।'
        ]
    };

    const GENTLE_STEPS = {
        en: [
            'Light a lamp or a candle, and sit with it for one minute. Nothing else.',
            'Drink a glass of water slowly. Then rest a hand on your heart for three breaths.',
            'Step outside for five minutes and notice three things you can see.',
            'Write one honest sentence about how today really is. You do not have to share it.',
            'Let one person know today is hard. A single message is enough.',
            'Before bed, put on something soothing and let your shoulders drop.'
        ],
        hi: [
            'एक दीया या मोमबत्ती जलाइए, और एक मिनट उसके साथ बैठिए। बस इतना।',
            'धीरे-धीरे एक गिलास पानी पीजिए। फिर तीन साँसों तक अपना हाथ दिल पर रखिए।',
            'पाँच मिनट बाहर निकलिए और तीन चीज़ें देखिए जो आपको दिखती हैं।',
            'आज सच में कैसा है, इस पर एक सच्चा वाक्य लिखिए। किसी को दिखाना ज़रूरी नहीं।',
            'किसी एक व्यक्ति को बताइए कि आज का दिन कठिन है। एक संदेश काफ़ी है।',
            'सोने से पहले कुछ सुकून देने वाला सुनिए, और कंधों को ढीला छोड़ दीजिए।'
        ]
    };
    const PRACTICAL_FEELINGS = ['stress', 'anxiety', 'failure', 'inertia', 'confusion', 'purpose', 'craving', 'lust', 'anger', 'envy', 'pride'];

    // Words that carry no feeling of their own, never learned as one.
    const NEVER_LEARN = new Set(['fine', 'ok', 'okay', 'good', 'nothing', 'whatever', 'yes', 'no', 'hmm', 'hm', 'idk', 'yeah', 'sure',
        'thanks', 'today', 'nahi', 'haan', 'theek', 'acha', 'accha', 'kuch', 'sab']);

    // An unclear message followed by a clear one teaches Sakha this person's
    // own words for a feeling ("meh" → sad). Only short phrases, only on their device.
    // `before` is the message that came before it: if that one was clear, the
    // unclear message was simply carried by it and teaches nothing.
    function phraseToLearn(read, before) {
        if (!read || read.primary || read.topics.length || read.ask || read.masking || read.words > 6) return null;
        if (before && (before.primary || before.topics.length)) return null;
        const words = read.normalised.trim().split(' ')
            .filter((word) => word && word !== '|' && word.length > 1 && !STOP_WORDS.has(word) && !NEVER_LEARN.has(word) && !/^\d+$/.test(word))
            .slice(0, 4);
        return words.length ? words.join(' ') : null;
    }

    // When a message cannot be read with confidence, ask — with answers one
    // tap away — rather than guess.
    const CLARIFY = {
        question: {
            en: 'If you can, tell me which of these is closest — it helps me find the right verse.',
            hi: 'अगर हो सके, बताइए इनमें से कौन-सा सबसे क़रीब है — इससे सही श्लोक ढूँढने में मदद मिलेगी।'
        },
        options: {
            en: [['Worried', 'I feel worried about this'], ['Sad', 'I feel sad about this'], ['Angry', 'I feel angry about this'],
                ['Lost', 'I feel lost and unsure what to do'], ['Alone', 'I feel alone with this'], ['Exhausted', 'I feel exhausted by all of this']],
            hi: [['चिंता', 'मुझे इस बात की चिंता है'], ['उदासी', 'मैं इससे उदास हूँ'], ['ग़ुस्सा', 'मुझे इस पर ग़ुस्सा है'],
                ['उलझन', 'मैं उलझन में हूँ, समझ नहीं आ रहा क्या करूँ'], ['अकेलापन', 'मुझे इसमें अकेलापन लगता है'], ['थकान', 'इन सब से मुझे बहुत थकान है']]
        },
        good: { en: ['Good, actually', 'I feel good today'], hi: ['अच्छा, सच में', 'आज मन अच्छा है'] }
    };

    function clarifyFor(lang, { includeGood = false } = {}) {
        const options = CLARIFY.options[lang].map(([label, text]) => ({ label, text }));
        if (includeGood) options.push({ label: CLARIFY.good[lang][0], text: CLARIFY.good[lang][1] });
        return { question: CLARIFY.question[lang], options };
    }

    const LINGERING = ['still', 'again', 'abhi bhi', 'ab bhi', 'phir se', 'अब भी', 'अभी भी', 'फिर से'];

    // How the conversation has moved: lighter than it began, heavier, or still here.
    function trajectoryOf(reading, earlier) {
        if (!earlier.length || !reading.primary) return null;
        const wasHeavy = earlier.some((read) => HEAVY(read.primary) && !read.relief);
        if (wasHeavy && (reading.relief || !HEAVY(reading.primary))) return 'easing';
        const peak = Math.max(...earlier.map((read) => (HEAVY(read.primary) ? read.intensityScore : 0)));
        if (wasHeavy && HEAVY(reading.primary) && reading.intensity === 'high' && reading.intensityScore > peak) return 'heavier';
        if (wasHeavy && HEAVY(reading.primary) && LINGERING.some((term) => has(reading.normalised, term))) return 'lingering';
        return null;
    }

    /**
     * @param {{ text?: string, mood?: string, settings?: object, history?: string[], exclude?: string[], another?: boolean,
     *           lastVerseId?: string, person?: object, used?: string[], retry?: { reason: string } }} input
     *   history: the person's earlier messages in this conversation (most recent last)
     *   used:    counsel already given in this conversation ("anxiety:work"), never repeated
     *   retry:   "not quite" — comfort | practical | deeper | situation
     *   said:    what Sakha already said in this conversation, so it never repeats itself
     *   person:  from their device only — name, voice, paths, context, memory (see frontend/src/lib/person.js)
     * @param {{ verses: object[], chapters: object[], timeOfDay?: string, random?: () => number, offline?: boolean }} corpus
     */
    function respond(input, corpus) {
        const { text = null, mood = null, settings = {}, history = [], exclude = [], another: anotherAsked = false, lastVerseId = null, person = null, used = [], said: saidInput = [] } = input || {};
        // What Sakha already said in this conversation (its opening lines and steps).
        const said = Array.isArray(saidInput) ? saidInput.filter((line) => typeof line === 'string').slice(-12) : [];
        // "Not quite": another answer, shaped by what would help instead.
        const retry = RETRY_REASONS.includes(input?.retry?.reason) ? input.retry.reason : null;
        const another = Boolean(anotherAsked || retry);
        const voice = VOICES.includes(person?.voice) ? person.voice : 'gentle';
        const { verses = [], chapters = [], timeOfDay = null, random = Math.random, offline = false } = corpus || {};
        const lang = replyLanguage(text, settings);
        const depth = settings.depth || 'standard';
        const extra = offline ? { offline: true } : {};
        const name = cleanName(person?.name);
        const stamp = (context) => ({ ...context, language: lang, engine: ENGINE_VERSION, ...extra });

        // Human help comes before scripture, always.
        if (detectCrisis(text) || (!text && detectCrisis(mood))) {
            return { message: CRISIS_RESPONSE[lang], verse: null, context: { crisis_detected: true, ...extra } };
        }
        if (text && detectSafety(text)) {
            return { message: SAFETY_RESPONSE[lang], verse: null, context: { crisis_detected: true, safety: true, ...extra } };
        }

        if (text && shouldMirror(text)) {
            return {
                message: `${withName(pick(MIRROR[lang], random), name, lang)}\n\n${pick(GROUNDING[lang], random)}`,
                verse: null,
                context: { mirrored: true, ...extra }
            };
        }

        // Read the message once; everything below answers the reading.
        const lexicon = verses.length ? corpusIndex(verses).lexicon : null;
        const personalWords = person?.lexicon && typeof person.lexicon === 'object' ? person.lexicon : null;
        const reading = understand(text, { lexicon, personal: personalWords });
        const earlier = text && !another
            ? history.slice(-4).filter((line) => typeof line === 'string').map((line) => understand(line, { lexicon, personal: personalWords }))
            : [];
        const profile = buildProfile({ text, mood, history, timeOfDay, person, reading, lexicon, retry });

        // "Not my situation": ask what it is about, with the answers one tap away.
        if (retry === 'situation') {
            return {
                message: RETRY.situation[lang],
                verse: null,
                clarify: { question: RETRY.situation[lang], options: TOPIC_CLARIFY[lang].map(([label, line]) => ({ label, text: line })) },
                context: stamp({ intent: 'clarify', clarify: true })
            };
        }

        // Not every message is a feeling: hello, thank you, "what is karma?",
        // "who are you?", "I don't understand", "I just want to vent".
        if (text && !another) {
            const intent = detectIntent(text, { lastVerseId, reading });
            if (intent) {
                const reply = respondToIntent(intent, { verses, lang, name, person, profile, lastVerse: findVerse(verses, lastVerseId) });
                if (reply) return { ...reply, context: stamp(reply.context) };
            }
        }

        if (text && !another && !mood && !profile.primary && !profile.topics.length && !profile.care && !reading.ask
            && reading.words <= 8 && !isQuestion(text) && !detectConcern(text)) {
            const again = earlier.length > 0 && !earlier[earlier.length - 1].primary;
            return {
                message: again ? SMALLTALK_AGAIN[lang](name) : PERSONAL.smalltalk[lang](name),
                verse: null,
                clarify: clarifyFor(lang, { includeGood: true }),
                context: stamp({ intent: 'smalltalk', clarify: true })
            };
        }

        const verse = pickVerse(rankVerses(verses, chapters, profile), { exclude, random, focused: reading.ask === 'verse' && !another });
        if (!verse) {
            return {
                message: lang === 'hi' ? 'क्षमा करें, अभी श्लोक तक नहीं पहुँच पा रहे। थोड़ी देर में फिर कोशिश करें।' : 'The verses are out of reach just now. Please try again in a moment.',
                verse: null,
                context: { ...extra }
            };
        }

        const verseText = (lang === 'hi' ? verse.meaning_hi : verse.meaning_en) || verse.meaning_en || verse.meaning_hi;
        const topic = profile.topics[0] || null;
        const care = profile.care;
        const verseAsk = !another && reading.ask === 'verse' && reading.about ? reading.about : null;
        // Listening carries on from "I just want to vent" to whatever comes next.
        const listening = !another && !verseAsk && (reading.ask === 'vent'
            || (earlier.some((read) => read.ask === 'vent') && !['how', 'why', 'verse'].includes(reading.ask)));
        const relief = !another && reading.relief && !care;
        const context = {
            emotion: profile.primary,
            emotions: profile.emotions,
            topics: profile.topics,
            // Which of the four paths this verse walks, so the device can learn what helps.
            paths: versePaths(verses, verse.id),
            language: lang,
            engine: ENGINE_VERSION,
            ...extra
        };

        if (settings.silentMode) {
            return { message: `"${verseText}"`, verse, context: { ...context, silent_mode: true } };
        }

        const heard = Boolean(profile.primary || profile.keywords.length || mood || topic || care);
        const heavy = !profile.primary || HEAVY(profile.primary);
        const understood = Boolean(profile.primary || topic || mood || care || verseAsk);
        // Counsel written for this feeling in this life — once per conversation.
        const usedKeys = Array.isArray(used) ? used : [];
        const careKey = care ? `care:${care.mode}` : null;
        const careFresh = Boolean(careKey) && !usedKeys.includes(careKey);
        const counselKey = care || verseAsk || listening ? null : counselKeyFor(counselFeeling(profile), profile.topics);
        const freshKey = counselKey && !usedKeys.includes(counselKey) ? counselKey : null;
        const counsel = freshKey ? COUNSEL[freshKey][lang] : null;
        const firstTurn = !history.length;
        const earlierTopics = new Set(earlier.flatMap((read) => read.topics));
        const earlierHeavy = earlier.some((read) => read.primary && HEAVY(read.primary));

        // How this conversation has moved: lighter, heavier, or still here.
        const trajectory = another ? null : trajectoryOf(reading, earlier);

        // First paragraph: being heard.
        const opening = [];
        const plain = voice === 'direct';
        if (!another && text && text.length > 280 && !plain) opening.push(PERSONAL.long[lang]);
        if (listening && reading.ask === 'vent') opening.push(LISTEN[lang]);
        if (!another && reading.learned.length && reading.words <= 4) opening.push(REMEMBERED_WORD[lang](reading.learned[0]));
        let ack;
        if (retry) ack = RETRY[retry][lang];
        else if (another) ack = pick(ANOTHER[lang], random);
        else if (verseAsk) ack = VERSE_ON[lang](verseAsk);
        else if (care && careFresh) ack = CARE_COUNSEL[care.mode][lang].ack((RELATION_NAMES[care.relation] || RELATION_NAMES.someone)[lang]);
        else if (care) ack = pickFresh(CARE_AGAIN[lang], random, said);
        else if (reading.masking && earlierHeavy) ack = MASKING[lang];
        else if (relief) ack = trajectory === 'easing' ? TRAJECTORY.easing[lang] : pick(RELIEF.ack[lang], random);
        else if (counsel) ack = counsel.ack;
        else ack = heard ? acknowledge(profile, lang, random, said) : UNHEARD[lang];
        const useName = !another && heard && name && (!history.length || random() < 0.35);
        if (useName) ack = withName(ack, name, lang);
        opening.push(ack);
        if (!another && !verseAsk && !relief && !plain) {
            if (reading.mixed && !care) opening.push(MIXED[lang]);
            // "Why do I always get so angry?" asks about a pattern; it is not a cry.
            const asking = reading.ask === 'why' || reading.ask === 'how';
            const alreadyHeavy = /weigh|press|heavy|a lot|too much|भारी|दबाव|बहुत सारी/i.test(ack);
            if (heavy && reading.intensity === 'high' && profile.primary && !asking && !care && !alreadyHeavy) opening.push(pickFresh(INTENSE[lang], random, said));
            else if (heavy && reading.intensity === 'low' && ['anxiety', 'fear'].includes(profile.primary) && !care) opening.push(GENTLE[lang]);
            else if (!heavy && reading.intensity === 'high') opening.push(pickFresh(JOYFUL[lang], random, said));
            // A situation is named once in a conversation, not every time it comes up.
            if (topic && heavy && !counsel && !care && !earlierTopics.has(topic)) opening.push(TOPICS[topic].line[lang]);
            if (reading.time === 'future' && ['anxiety', 'fear', 'stress'].includes(profile.primary) && !counsel && !care) opening.push(AHEAD[lang]);
        }

        // Second paragraph: what this person has carried before (from their
        // device), or how this conversation has moved.
        let personal = null;
        const previous = topic && person?.topics?.[topic];
        const previousAgo = previous?.last ? (Date.now() - Date.parse(previous.last)) / 3600000 : 0;
        if (relief) {
            personal = RELIEF.keep[lang];
        } else if (trajectory) {
            personal = TRAJECTORY[trajectory][lang];
        } else if (!another && profile.standing && firstTurn) {
            personal = STANDING_LINE[lang](standingLabel(profile.standing, lang));
        } else if (!another && !verseAsk && firstTurn && previous && previous.count >= 1 && previousAgo >= 6) {
            personal = PERSONAL.returning[lang](TOPICS[topic].label[lang]);
        } else if (!another && !verseAsk && firstTurn && HEAVY(profile.primary) && (person?.recurring?.[profile.primary] || 0) >= 2) {
            personal = PERSONAL.recurring[lang];
        }

        // "Why do I always…?" — where the feeling comes from, as the Gita sees it.
        // Someone who likes things explained hears it without asking.
        const wantsWhy = reading.ask === 'why' || (voice === 'teacher' && firstTurn && !listening && !verseAsk && profile.primary);
        const roots = !another && wantsWhy && HEAVY(profile.primary) && !care
            ? (ROOTS[profile.primary] || ROOTS.default)[lang] : null;

        const ground = !heavy ? pickFresh(LIGHT_GROUNDING[lang], random, said)
            : timeOfDay === 'night' && !another && !said.some((line) => line.includes(PERSONAL.night[lang])) ? PERSONAL.night[lang]
                : pickFresh(GROUNDING[lang], random, said);
        const guidance = guidanceFor(verse, care && !careFresh ? { ...profile, care: null } : profile, lang, { counselKey: freshKey });
        if (care && !careFresh) guidance.blessing = CARE_BLESSING[lang];
        // A step is never offered twice in a conversation; "something practical" always gets a new one.
        const spokenStep = (step) => step && said.some((line) => plainText(line).includes(plainText(step).slice(0, 48)));
        if (guidance.step && (spokenStep(guidance.step) || retry === 'practical')) {
            const own = profile.primary && GUIDANCE[profile.primary]?.[lang]?.step;
            const pool = retry === 'practical' || PRACTICAL_FEELINGS.includes(profile.primary) ? PRACTICAL_STEPS : GENTLE_STEPS;
            guidance.step = retry !== 'practical' && own && !spokenStep(own) && own !== guidance.step ? own
                : pickFresh(pool[lang], random, [...said, guidance.step]);
        }
        // A clarification ("I mean I'm sad") right after an unclear message teaches Sakha that person's words.
        const learnPhrase = !another && reading.primary && !reading.learned.length && reading.words <= 10
            ? phraseToLearn(earlier[earlier.length - 1], earlier[earlier.length - 2]) : null;
        if (name && guidance.blessing) guidance.blessing = withBlessingName(guidance.blessing, name, lang);
        const quality = person?.sankalpa && (person.sankalpa[lang] || person.sankalpa.en);
        if (quality && HEAVY(profile.primary) && guidance.bridge && !listening) guidance.bridge += PERSONAL.sankalpa[lang](quality);
        if (listening) {
            // Someone who asked to be heard is not handed homework.
            guidance.bridge = null;
            guidance.step = null;
        }
        // The answer to "why" is already said above; the guidance need not repeat its verse.
        const rootRef = roots && (roots.match(/\((\d{1,2}\.\d{1,2})/) || [])[1];
        if (rootRef && guidance.bridge && guidance.bridge.includes(`(${rootRef}`)) guidance.bridge = null;
        const howAsked = !another && !listening && reading.ask === 'how' && Boolean(guidance.step);
        // Asked how, asked for something practical, or likes it plain: the step leads.
        if ((howAsked || retry === 'practical' || plain) && guidance.step && !listening) guidance.focus = 'step';
        const clarify = !another && text && !understood ? clarifyFor(lang) : null;
        const concern = Boolean(text) && detectConcern(text);
        const careLine = care && care.mode === 'mind' && careFresh && !another ? CARE_LINE[lang] : null;

        const reflection = verseAsk || plain ? null
            : listening ? LISTEN_REFLECTION[lang]
                : pickFresh((heavy ? REFLECTIONS : LIGHT_REFLECTIONS)[lang], random, said);
        const moments = (voice === 'teacher' || retry === 'deeper') && lang === 'en'
            ? (verse.life_situations || []).filter((item) => typeof item === 'string' && item.length < 48).slice(0, 3).map((item) => item.toLowerCase())
            : [];

        let message;
        if (depth === 'brief') {
            message = [opening.join(' '), `"${verseText}"`].join('\n\n');
            guidance.bridge = null;
        } else {
            const invitation = depth === 'deep' ? ` ${lang === 'hi' ? 'इस विचार के साथ कुछ पल बैठें।' : 'Sit with this thought for a moment.'}` : '';
            message = [
                opening.join(' '),
                personal,
                roots,
                howAsked ? HOW[lang] : null,
                reflection,
                `"${verseText}"`,
                moments.length ? MOMENTS.en(moments) : null,
                verseAsk || plain ? null : `${ground}${invitation}`,
                clarify ? clarify.question : null,
                careLine,
                concern ? CONCERN_LINE[lang] : null
            ].filter(Boolean).join('\n\n');
        }

        return {
            message,
            verse,
            guidance,
            clarify,
            context: {
                ...context,
                self_limited: !heard || undefined,
                remembered: (Boolean(personal) && !relief && !trajectory) || undefined,
                concern: concern || undefined,
                clarify: Boolean(clarify) || undefined,
                counsel: freshKey || (careFresh ? careKey : undefined),
                care: care ? { relation: care.relation, mode: care.mode } : undefined,
                ask: reading.ask || undefined,
                listening: listening || undefined,
                trajectory: trajectory || undefined,
                retry: retry || undefined,
                // For the device to keep: a word learned, an event to ask about later.
                learn: learnPhrase ? { phrase: learnPhrase, feeling: reading.primary } : undefined,
                event: !another && reading.event ? reading.event : undefined,
                learnedWords: reading.learned.length ? reading.learned : undefined,
                voice: voice !== 'gentle' ? voice : undefined,
                standing: profile.standing ? profile.standing.topics[0] : undefined,
                reading: text ? {
                    intensity: reading.intensity,
                    time: reading.time,
                    relief: reading.relief || undefined,
                    mixed: reading.mixed || undefined,
                    confidence: reading.confidence,
                    corrected: reading.corrections.length ? reading.corrections : undefined
                } : undefined
            }
        };
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
        TOPICS,
        GLOSSARY,
        GUIDANCE,
        COUNSEL,
        COUNSEL_ALIASES,
        PATHS,
        versePaths,
        CARE,
        CARE_COUNSEL,
        ROOTS,
        ANCHORS,
        VOICE,
        detectTopics,
        detectIntent,
        detectSafety,
        detectConcern,
        normalise,
        understand,
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
