// The 7-Day Walk: one verse, carried for a week, with a contemplation for
// each day. State lives in localStorage under the original `verseCompanion`
// key so walks started before this upgrade keep working.

export const JOURNEY_KEY = 'verseCompanion';
export const JOURNEY_EVENT = 'verseCompanionUpdated';
export const JOURNEY_LENGTH = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// Each day's words (title, theme, contemplation, practice) live in the i18n
// dictionaries under journey.d<day>.*; the Sanskrit concept is data.
export const JOURNEY_DAYS = [
    { day: 1, concept: 'साक्षी', conceptIast: 'sākṣī' },
    { day: 2, concept: 'निष्काम कर्म', conceptIast: 'niṣkāma karma' },
    { day: 3, concept: 'स्थितप्रज्ञ', conceptIast: 'sthitaprajña' },
    { day: 4, concept: 'समत्व', conceptIast: 'samatva' },
    { day: 5, concept: 'शरणागति', conceptIast: 'śaraṇāgati' },
    { day: 6, concept: 'ध्यान', conceptIast: 'dhyāna' },
    { day: 7, concept: 'अपरिग्रह', conceptIast: 'aparigraha' }
];

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function normalise(journey) {
    if (!journey || !journey.verse || !journey.startDate) return null;
    return { ...journey, checkIns: journey.checkIns || {} };
}

export function readJourney() {
    try {
        return normalise(JSON.parse(localStorage.getItem(JOURNEY_KEY) || 'null'));
    } catch {
        return null;
    }
}

function writeJourney(journey) {
    if (journey) {
        localStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
    } else {
        localStorage.removeItem(JOURNEY_KEY);
    }
    window.dispatchEvent(new Event(JOURNEY_EVENT));
}

// Calendar day of the walk, starting at 1. Day 2 begins at the next local
// midnight, not 24 hours later. Math.round absorbs daylight-saving shifts.
export function journeyDay(journey, now = new Date()) {
    return Math.round((startOfDay(now) - startOfDay(journey.startDate)) / DAY_MS) + 1;
}

export function journeyStatus(journey, now = new Date()) {
    const rawDay = journeyDay(journey, now);
    const day = Math.min(JOURNEY_LENGTH, Math.max(1, rawDay));
    const checkedDays = Object.keys(journey.checkIns).map(Number).filter((d) => d >= 1 && d <= JOURNEY_LENGTH);
    return {
        day,
        rawDay,
        theme: JOURNEY_DAYS[day - 1],
        checkedDays,
        checkedCount: checkedDays.length,
        checkedToday: Boolean(journey.checkIns[day]),
        isComplete: Boolean(journey.completedAt),
        isOverdue: rawDay > JOURNEY_LENGTH && !journey.completedAt
    };
}

export function startJourney(verse) {
    const existing = readJourney();
    if (existing && !existing.completedAt && journeyDay(existing) <= JOURNEY_LENGTH + 3) {
        return { ok: false, journey: existing };
    }

    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + JOURNEY_LENGTH);

    const journey = {
        verse,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        checkIns: {}
    };
    writeJourney(journey);
    return { ok: true, journey };
}

export function checkInJourney(day, note = '') {
    const journey = readJourney();
    if (!journey) return null;
    journey.checkIns[day] = { at: new Date().toISOString(), ...(note.trim() ? { note: note.trim() } : {}) };
    if (day === JOURNEY_LENGTH) journey.completedAt = new Date().toISOString();
    writeJourney(journey);
    return journey;
}

export function releaseJourney() {
    writeJourney(null);
}
