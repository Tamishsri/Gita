// Sakha listens on this device. The wisdom engine and the whole Gita are
// loaded into the page; what a person writes is understood right here and is
// never sent anywhere. The server only ever supplies the (public) verses.

import { fetchChapter, fetchChapters } from './gitaApi';

let enginePromise = null;
let corpusPromise = null;

export function loadEngine() {
    if (!enginePromise) {
        enginePromise = import('virtual:wisdom-engine')
            .then((module) => module.default)
            .catch((error) => {
                enginePromise = null;
                throw error;
            });
    }
    return enginePromise;
}

// All eighteen chapters, once. The same array is reused so the engine's
// word index is built a single time.
export function loadCorpus() {
    if (!corpusPromise) {
        corpusPromise = fetchChapters()
            .then((chapters) => Promise.all(chapters.map((chapter) => fetchChapter(chapter.chapter)))
                .then((details) => ({
                    chapters,
                    verses: details.flatMap((detail) => detail.verses || [])
                })))
            .catch((error) => {
                corpusPromise = null;
                throw error;
            });
    }
    return corpusPromise;
}

/** Warm the engine and verses in the background, so the first answer is quick. */
export function prepareSakha() {
    loadEngine().catch(() => {});
    loadCorpus().catch(() => {});
}

export function timeOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'night';
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{ text?: string, mood?: string, settings?: object, history?: string[], exclude?: string[],
 *           another?: boolean, lastVerseId?: string, person?: object }} request
 */
export async function askSakha(request) {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const engine = await loadEngine();
    // Without the verses Sakha can still recognise a crisis and point to help.
    const corpus = await loadCorpus().catch(() => ({ verses: [], chapters: [] }));
    const { settings = {}, ...input } = request;
    const result = engine.respond(
        { ...input, settings: { language: settings.language, depth: settings.depth, silentMode: settings.silentMode } },
        { verses: corpus.verses, chapters: corpus.chapters, timeOfDay: timeOfDay(), offline: !corpus.verses.length }
    );
    // A breath before answering: replies that arrive instantly feel mechanical.
    // Help for someone in crisis is never delayed.
    if (!result.context?.crisis_detected) {
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
        await pause(Math.max(0, 750 - elapsed));
    }
    return result;
}
