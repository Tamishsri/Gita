const { getVerses, getChaptersMeta } = require('../data/loader');

// Calm, non-judgmental templates
const ACKNOWLEDGEMENTS = {
    en: [
        "I hear that you're feeling {emotion}.",
        "It is completely natural to feel {emotion}.",
        "Thank you for sharing that you are feeling {emotion}.",
        "I sense a lot of {emotion} in your words.",
        "It's okay to be with your {emotion} right now."
    ],
    hi: [
        "मैं समझ सकता हूँ कि आप {emotion} महसूस कर रहे हैं।",
        "{emotion} महसूस करना पूरी तरह से स्वाभाविक है।",
        "अपने {emotion} को साझा करने के लिए धन्यवाद।",
        "आपके शब्दों में मुझे {emotion} का आभास हो रहा है।",
        "अभी अपने {emotion} के साथ रहना ठीक है।"
    ]
};

const REFLECTIONS = {
    en: [
        "The Gita offers a gentle perspective on this.",
        "Here is a thought that might offer some space.",
        "This ancient wisdom speaks softly to this moment.",
        "Let this verse wash over you, without pressure."
    ],
    hi: [
        "गीता इस पर एक सौम्य दृष्टिकोण प्रदान करती है।",
        "यहाँ एक विचार है जो कुछ शांति प्रदान कर सकता है।",
        "यह प्राचीन ज्ञान इस पल के लिए है।",
        "बिना किसी दबाव के इस श्लोक को आत्मसात करें।"
    ]
};

const GROUNDING = {
    en: [
        "Take a breath. You are safe.",
        "There is nothing you need to fix right now.",
        "This feeling will pass, like a cloud.",
        "You are enough, just as you are."
    ],
    hi: [
        "एक गहरी सांस लें। आप सुरक्षित हैं।",
        "अभी आपको कुछ भी ठीक करने की आवश्यकता नहीं है।",
        "यह भावना एक बादल की तरह गुजर जाएगी।",
        "आप जैसे हैं, पर्याप्त हैं।"
    ]
};

// Mirror Responses (Reflection without Advice or Verse)
const MIRROR_RESPONSES = {
    en: [
        "It sounds like there's a lot happening right now.",
        "That can feel very heavy.",
        "I hear the weight in your words.",
        "Sometimes just naming it helps.",
        "You're carrying quite a bit."
    ],
    hi: [
        "ऐसा लगता है कि इस समय बहुत कुछ हो रहा है।",
        "यह बहुत भारी महसूस हो सकता है।",
        "मैं आपके शब्दों में वजन सुन सकता हूँ।",
        "कभी-कभी इसे नाम देना ही मदद करता है।",
        "आप बहुत कुछ ढो रहे हैं।"
    ]
};

// AI Self-Limiting Responses (Admitting Limits)
const SELF_LIMITING = {
    en: [
        "I may not have the right words for this.",
        "This is something you may want to sit with yourself.",
        "Sometimes silence holds more than words.",
        "I sense this needs your own stillness, not my voice."
    ],
    hi: [
        "हो सकता है कि मेरे पास इसके लिए सही शब्द न हों।",
        "यह कुछ ऐसा है जिस पर आप खुद बैठना चाहें।",
        "कभी-कभी मौन शब्दों से अधिक रखता है।",
        "मुझे लगता है कि इसे आपकी अपनी शांति की जरूरत है, मेरी आवाज की नहीं।"
    ]
};

// Crisis Keywords (Human-First Boundaries)
const CRISIS_KEYWORDS = [
    'suicid', // matches suicide, suicidal
    'kill myself',
    'end my life',
    'end it all',
    'no point living',
    'cannot go on living',
    'cant go on living',
    'hurt myself',
    'self harm',
    'self-harm',
    'want to die',
    'better off dead',
    'don\'t want to live',
    'dont want to live',
    'take my life',
    'end everything',
    'आत्महत्या',
    'मरना चाहता',
    'जीवन समाप्त'
];

// Keyword to Emotion/Tag Mapping (Deterministic Semantic Matching)
const TAG_MAP = {
    "anxious": ["fear", "uncertainty", "peace", "anxiety", "calm", "doubt"],
    "anxiety": ["fear", "uncertainty", "peace", "anxiety", "calm", "doubt"],
    "worried": ["fear", "uncertainty", "results", "anticipation"],
    "stress": ["stress", "action", "peace", "pressure", "duty"],
    "stressed": ["stress", "action", "peace", "pressure", "duty"],
    "sad": ["grief", "compassion", "soul", "sadness", "depression"],
    "sadness": ["grief", "compassion", "soul", "sadness", "sorrow"],
    "angry": ["anger", "self-control", "peace", "reaction", "calm"],
    "anger": ["anger", "self-control", "peace", "reaction", "calm"],
    "lost": ["confusion", "guidance", "faith", "direction", "purpose"],
    "confused": ["confusion", "knowledge", "guidance", "clarity", "duty"],
    "peace": ["peace", "meditation", "devotion", "calm", "stillness"],
    "happy": ["joy", "bhakti", "gratitude", "contentment"],
    "grateful": ["gratitude", "joy", "bhakti", "devotion", "contentment"],
    "overwhelmed": ["stress", "peace", "surrender", "emotional overwhelm", "balance"],
    "hopeless": ["faith", "compassion", "hope", "inner strength"]
};

// Emotion Translations for Hindi Output
const EMOTION_HI = {
    "fear": "डर",
    "uncertainty": "अनिश्चितता",
    "peace": "शांति",
    "stress": "तनाव",
    "action": "कर्म",
    "grief": "दुःख",
    "compassion": "करुणा",
    "soul": "आत्मा",
    "anger": "क्रोध",
    "self-control": "आत्म-संयम",
    "confusion": "भ्रम",
    "guidance": "मार्गदर्शन",
    "faith": "विश्वास",
    "knowledge": "ज्ञान",
    "joy": "आनंद",
    "bhakti": "भक्ति",
    "gratitude": "कृतज्ञता",
    "results": "परिणाम",
    "surrender": "समर्पण",
    "hope": "आशा",
    "anxious": "व्याकुलता",
    "anxiety": "व्याकुलता",
    "sadness": "उदासी",
    "stressed": "तनाव"
};

// Time-Based Tag Preferences
const TIME_TAGS = {
    morning: ["action", "clarity", "duty", "knowledge", "karma"],
    afternoon: ["steadiness", "karma", "action", "work"],
    night: ["peace", "surrender", "meditation", "devotion", "calm"]
};

const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
    'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just',
    'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'so', 'some',
    'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
    'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your'
]);

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
};

const analyzeInput = (text, mood) => {
    let tags = [];

    // 1. Mood Injection
    if (mood) {
        const m = mood.toLowerCase();
        tags.push(m);
        if (TAG_MAP[m]) {
            tags = [...tags, ...TAG_MAP[m]];
        }
    }

    // 2. Text Keyword Matching
    if (text) {
        const words = text.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
        words.forEach(word => {
            tags.push(word);
            if (TAG_MAP[word]) {
                tags = [...tags, ...TAG_MAP[word]];
            }
        });
    }

    return [...new Set(tags)]; // Unique tags
};

const findBestVerse = (tags, timeOfDay = null) => {
    const verses = getVerses();
    if (!verses.length) return null;

    const lowerTags = tags.map(t => t.toLowerCase());

    // Score verses based on relevance
    const scored = verses.map(v => {
        let score = 0;

        // Base score for having readable translation
        if (v.meaning_en && v.meaning_en.length > 0) score += 10;

        // Emotional Tone Match (High priority)
        if (v.emotional_tone && Array.isArray(v.emotional_tone)) {
            v.emotional_tone.forEach(tone => {
                const tLower = tone.toLowerCase();
                lowerTags.forEach(tag => {
                    if (tLower === tag || tLower.includes(tag) || tag.includes(tLower)) {
                        score += 12;
                    }
                });
            });
        }

        // Life Situations Match (High priority for real-world feelings)
        if (v.life_situations && Array.isArray(v.life_situations)) {
            v.life_situations.forEach(sit => {
                const sLower = sit.toLowerCase();
                lowerTags.forEach(tag => {
                    if (sLower.includes(tag)) {
                        score += 10;
                    }
                });
            });
        }

        // Core Theme Match
        if (v.core_theme && Array.isArray(v.core_theme)) {
            v.core_theme.forEach(theme => {
                const tLower = theme.toLowerCase();
                lowerTags.forEach(tag => {
                    if (tLower === tag || tLower.includes(tag) || tag.includes(tLower)) {
                        score += 8;
                    }
                });
            });
        }

        // Chapter Thematic Relevance Boost (from meta.json helps_with)
        const chapters = getChaptersMeta();
        const chapterMeta = chapters.find(c => c.chapter === v.chapter);
        if (chapterMeta && chapterMeta.helps_with && Array.isArray(chapterMeta.helps_with)) {
            lowerTags.forEach(tag => {
                if (chapterMeta.helps_with.some(h => h.toLowerCase().includes(tag) || tag.includes(h.toLowerCase()))) {
                    score += 7;
                }
            });
        }

        // Textual Meaning Match
        if (v.meaning_en) {
            const mLower = v.meaning_en.toLowerCase();
            lowerTags.forEach(tag => {
                if (tag.length > 3 && mLower.includes(tag)) {
                    score += 3;
                }
            });
        }

        // Time-of-day subtle boost (secondary context)
        if (timeOfDay && TIME_TAGS[timeOfDay] && v.core_theme && Array.isArray(v.core_theme)) {
            TIME_TAGS[timeOfDay].forEach(timeTag => {
                if (v.core_theme.some(t => t.toLowerCase().includes(timeTag))) {
                    score += 2;
                }
            });
        }

        // Subtle random drift so repeated queries offer variety among top matches
        score += Math.random() * 3;

        return { verse: v, score };
    });

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.verse || getRandom(verses);
};

const detectCrisis = (text) => {
    if (!text || typeof text !== 'string') return false;
    const lowerText = text.toLowerCase();
    return CRISIS_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

const shouldMirror = (text) => {
    if (!text || typeof text !== 'string') return false;
    const heavyWords = ['overwhelmed', 'drowning', 'can\'t take', 'too much', 'breaking', 'collapsing'];
    const lowerText = text.toLowerCase();
    return heavyWords.some(word => lowerText.includes(word));
};

const generateResponse = (arg1, arg2, arg3) => {
    let userText, userMood, settings;
    if (typeof arg1 === 'object' && arg1 !== null && arg2 === undefined) {
        userText = arg1.text;
        userMood = arg1.mood;
        settings = arg1.settings || {};
    } else {
        userText = arg1;
        userMood = arg2;
        settings = arg3 || {};
    }

    const { language = 'en', depth = 'standard', silentMode = false } = settings;
    const langKey = language === 'hi' ? 'hi' : 'en';
    const timeOfDay = getTimeOfDay();

    // CRISIS DETECTION (Human-First Boundary with Immediate Support Resources)
    if (detectCrisis(userText)) {
        const crisisResponse = langKey === 'hi'
            ? "मुझे लगता है कि आप बहुत गहरे दर्द से गुजर रहे हैं। यह एक ऐसा पल है जहाँ किसी इंसान की मदद जरूरी है। कृपया किसी भरोसेमंद व्यक्ति, काउंसलर या सहायता हेल्पलाइन से तुरंत संपर्क करें। आप अकेले नहीं हैं।\n\nमुफ्त एवं गोपनीय सहायता:\n• Tele-MANAS (भारत): 14416 या 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• अंतर्राष्ट्रीय हेल्पलाइन: https://findahelpline.com"
            : "I sense you're going through deep pain. This is a moment where human support is essential. Please reach out to someone you trust, a counselor, or a crisis helpline right now. You do not have to carry this alone.\n\nFree & Confidential Support:\n• Tele-MANAS (India): 14416 or 1800-891-4416 (24/7)\n• Vandrevala Foundation: +91 9999 666 555\n• 988 Suicide & Crisis Lifeline (US/Canada): Call or Text 988\n• Worldwide Helplines: https://findahelpline.com";

        return {
            message: crisisResponse,
            verse: null,
            context: { crisis_detected: true }
        };
    }

    // AI SELF-LIMITING: Only for conversational text (never on initial mood selection), and low chance
    if (userText && userText.trim().length > 10 && Math.random() < 0.05) {
        return {
            message: getRandom(SELF_LIMITING[langKey]),
            verse: null,
            context: { self_limited: true }
        };
    }

    // SILENT MODE: Just return a verse, no talking
    if (silentMode) {
        const detectedTags = analyzeInput(userText, userMood);
        const verse = findBestVerse(detectedTags, timeOfDay);

        if (!verse) return { message: "", verse: null };

        const verseText = langKey === 'hi' ? verse.meaning_hi : verse.meaning_en;
        return {
            message: `"${verseText}"`,
            verse: verse,
            context: { silent_mode: true }
        };
    }

    // MIRROR RESPONSE (Heavy Distress - No Verse Yet)
    if (shouldMirror(userText)) {
        const mirror = getRandom(MIRROR_RESPONSES[langKey]);
        const ground = getRandom(GROUNDING[langKey]);

        return {
            message: `${mirror}\n\n${ground}`,
            verse: null,
            context: { mirrored: true }
        };
    }

    // STANDARD FLOW
    // 1. Analyze
    const detectedTags = analyzeInput(userText, userMood);
    const primaryEmotion = userMood || (detectedTags.length > 0 ? detectedTags[0] : "uncertainty");

    // Translate emotion for acknowledgement if Hindi
    let displayEmotion = primaryEmotion.toLowerCase();
    if (langKey === 'hi' && EMOTION_HI[displayEmotion]) {
        displayEmotion = EMOTION_HI[displayEmotion];
    }

    // 2. Retrieve (Time-Sensitive)
    const verse = findBestVerse(detectedTags, timeOfDay);

    if (!verse) {
        return {
            message: langKey === 'hi' ? "क्षमा करें, अभी मैं संपर्क नहीं कर पा रहा हूँ।" : "I am having trouble connecting to the wisdom right now.",
            verse: null
        };
    }

    // 3. Format Response (Adaptive Persona)
    const ack = getRandom(ACKNOWLEDGEMENTS[langKey]).replace("{emotion}", displayEmotion);
    const reflect = getRandom(REFLECTIONS[langKey]);
    const ground = getRandom(GROUNDING[langKey]);

    // Select Verse Text based on Language
    const verseText = langKey === 'hi' ? verse.meaning_hi : verse.meaning_en;

    // Construct Message based on Depth
    let fullResponse = "";

    if (depth === 'brief') {
        // Just the essence
        fullResponse = `${ack}\n\n"${verseText}"`;
    } else if (depth === 'deep') {
        // Full gentle structure + Invitation to sit
        const invitation = langKey === 'hi' ? "इस विचार के साथ कुछ पल बैठें।" : "Sit with this thought for a moment.";
        fullResponse = `${ack} ${reflect}\n\n"${verseText}"\n\n${ground} ${invitation}`;
    } else {
        // Standard
        fullResponse = `${ack} ${reflect}\n\n"${verseText}"\n\n${ground}`;
    }

    return {
        message: fullResponse,
        verse: verse,
        context: {
            detected_tags: detectedTags,
            primary_emotion: primaryEmotion,
            time_of_day: timeOfDay,
            settings: { language, depth }
        }
    };
};

module.exports = { generateResponse, getVerses };
