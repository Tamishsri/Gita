// The sanctuary's voice. All listening and choosing lives in the shared
// Wisdom Engine (shared/wisdom-engine.js), which the offline service worker
// also runs — this module only binds it to the loaded corpus.

const engine = require('../engine');
const { getVerses, getChaptersMeta } = require('../data/loader');

const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
};

const MAX_LIST = 30;
const cleanList = (list, maxLength) => (Array.isArray(list)
    ? list.filter((item) => typeof item === 'string' && item.length <= maxLength).slice(-MAX_LIST)
    : []);

/**
 * generateResponse({ text, mood, settings, history, exclude, used })
 * generateResponse(text, mood, settings)   — legacy positional form
 */
const generateResponse = (arg1, arg2, arg3) => {
    const input = typeof arg1 === 'object' && arg1 !== null && arg2 === undefined
        ? arg1
        : { text: arg1, mood: arg2, settings: arg3 };

    return engine.respond(
        {
            text: typeof input.text === 'string' ? input.text : null,
            mood: typeof input.mood === 'string' ? input.mood : null,
            settings: input.settings && typeof input.settings === 'object' ? input.settings : {},
            history: cleanList(input.history, 2000).slice(-3),
            exclude: cleanList(input.exclude, 12),
            used: cleanList(input.used, 40),
            another: input.another === true
        },
        { verses: getVerses(), chapters: getChaptersMeta(), timeOfDay: getTimeOfDay() }
    );
};

const detectCrisis = engine.detectCrisis;

module.exports = { generateResponse, getVerses, detectCrisis };
