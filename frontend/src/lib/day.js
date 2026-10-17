import { localDateKey, recordPath } from './path';

// The arc of a day: a morning saṅkalpa (an intention), an evening sandhyā
// (a looking-back). The evening returns to the morning's intention, so the
// day closes the circle it opened.

export const DAY_KEY = 'lgDay';
export const DAY_EVENT = 'lgDayUpdated';

// The qualities Krishna names as "divine wealth" (daivī sampat, 16.1–3).
export const QUALITIES = [
    { id: 'abhaya', sa: 'अभय', iast: 'abhaya', en: 'Fearlessness', hi: 'निर्भयता' },
    { id: 'satya', sa: 'सत्य', iast: 'satya', en: 'Truthfulness', hi: 'सत्य' },
    { id: 'ahimsa', sa: 'अहिंसा', iast: 'ahiṃsā', en: 'Non-harm', hi: 'अहिंसा' },
    { id: 'akrodha', sa: 'अक्रोध', iast: 'akrodha', en: 'Freedom from anger', hi: 'क्रोध-मुक्ति' },
    { id: 'shanti', sa: 'शान्ति', iast: 'śānti', en: 'Peace', hi: 'शांति' },
    { id: 'daya', sa: 'दया', iast: 'dayā', en: 'Compassion', hi: 'दया' },
    { id: 'kshama', sa: 'क्षमा', iast: 'kṣamā', en: 'Forgiveness', hi: 'क्षमा' },
    { id: 'dhriti', sa: 'धृति', iast: 'dhṛti', en: 'Steadiness', hi: 'धैर्य' },
    { id: 'mardava', sa: 'मार्दव', iast: 'mārdava', en: 'Gentleness', hi: 'कोमलता' },
    { id: 'dana', sa: 'दान', iast: 'dāna', en: 'Generosity', hi: 'उदारता' },
    { id: 'tyaga', sa: 'त्याग', iast: 'tyāga', en: 'Letting go', hi: 'त्याग' },
    { id: 'tejas', sa: 'तेज', iast: 'tejas', en: 'Vigour', hi: 'तेज' }
];

export const qualityById = (id) => QUALITIES.find((quality) => quality.id === id) || null;

// The three qualities of nature (14.5–8) — for noticing, never judging.
export const GUNAS = [
    { id: 'sattva', sa: 'सत्त्व', rgb: '236, 210, 150' },
    { id: 'rajas', sa: 'रजस्', rgb: '210, 110, 70' },
    { id: 'tamas', sa: 'तमस्', rgb: '96, 104, 150' }
];

export function readDay() {
    const today = localDateKey();
    try {
        const stored = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
        if (stored && stored.date === today) return stored;
    } catch {
        // fall through to a fresh day
    }
    return { date: today };
}

function writeDay(day) {
    localStorage.setItem(DAY_KEY, JSON.stringify(day));
    window.dispatchEvent(new Event(DAY_EVENT));
}

export function setSankalpa(qualityId, note = '') {
    const day = readDay();
    day.sankalpa = { quality: qualityId, note: note.trim(), at: new Date().toISOString() };
    writeDay(day);
    recordPath('sankalpa', { quality: qualityId });
    return day;
}

export function completeSandhya({ offered = '', held = '', release = '', guna = null, carried = null }) {
    const day = readDay();
    day.sandhya = { offered: offered.trim(), held: held.trim(), release: release.trim(), guna, carried, at: new Date().toISOString() };
    writeDay(day);
    recordPath('sandhya', { guna, carried });
    return day;
}

export function partOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'day';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
}
