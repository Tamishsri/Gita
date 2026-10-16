// The 7-Day Walk: one verse, carried for a week, with a contemplation for
// each day. State lives in localStorage under the original `verseCompanion`
// key so walks started before this upgrade keep working.

export const JOURNEY_KEY = 'verseCompanion';
export const JOURNEY_EVENT = 'verseCompanionUpdated';
export const JOURNEY_LENGTH = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const JOURNEY_DAYS = [
    {
        day: 1,
        short: 'Witness',
        title: 'Witnessing',
        theme: 'Observe the mind without judgment',
        concept: 'साक्षी',
        conceptIast: 'sākṣī — the witness',
        contemplation:
            'Today, simply watch. Thoughts arise and pass like clouds crossing an open sky. The Gita points to a silent witness within you — you are not the storm, you are the one who sees it.',
        practice: 'Three times today, pause and quietly name what is present — "thinking", "feeling", "hearing" — then return to your verse.'
    },
    {
        day: 2,
        short: 'Action',
        title: 'Action vs Attachment',
        theme: 'Work without anxiety for results',
        concept: 'निष्काम कर्म',
        conceptIast: 'niṣkāma karma — desireless action',
        contemplation:
            'Your right is to the work alone, never to its fruits (2.47). Choose one task today and give it your whole heart — then let the outcome belong to something larger than you.',
        practice: 'Before you begin something that matters, offer it silently: "The effort is mine. The result is not."'
    },
    {
        day: 3,
        short: 'Center',
        title: 'Stillness in Chaos',
        theme: 'Finding the center',
        concept: 'स्थितप्रज्ञ',
        conceptIast: 'sthitaprajña — steady wisdom',
        contemplation:
            'As rivers pour into the ocean and it remains undisturbed (2.70), there is a depth in you that noise cannot reach. When the day grows loud, the breath is your way back to the center.',
        practice: 'When agitation rises, take one slow 4-7-8 breath before you speak or act.'
    },
    {
        day: 4,
        short: 'Equanimity',
        title: 'Compassion & Equanimity',
        theme: 'One gentle regard for all',
        concept: 'समत्व',
        conceptIast: 'samatva — evenness of mind',
        contemplation:
            'The wise are the same toward friend and foe, honour and dishonour (12.18). Today, meet each person — and yourself — with the same quiet kindness, whatever they bring.',
        practice: 'Silently wish one difficult person well: "May you be at peace."'
    },
    {
        day: 5,
        short: 'Surrender',
        title: 'Surrendering the Burden',
        theme: 'Not everything is yours to carry',
        concept: 'शरणागति',
        conceptIast: 'śaraṇāgati — refuge, surrender',
        contemplation:
            '"Do not grieve" (18.66). Surrender is not defeat; it is setting down a weight you were never meant to hold alone. Name one burden today and imagine placing it at the feet of something greater.',
        practice: 'Write the burden down — in your journal or on paper — and let the page hold it for you.'
    },
    {
        day: 6,
        short: 'Stillness',
        title: 'Deep Stillness',
        theme: 'Resting beneath effort',
        concept: 'ध्यान',
        conceptIast: 'dhyāna — meditation',
        contemplation:
            'Like a lamp in a windless place that does not flicker (6.19), let attention rest without reaching for anything. Beneath effort, beneath even surrender, there is simple being.',
        practice: 'Sit in silence for seven minutes. The Cosmic Om soundscape can hold the space for you.'
    },
    {
        day: 7,
        short: 'Release',
        title: 'The Journey Ahead',
        theme: 'Integration & release',
        concept: 'अपरिग्रह',
        conceptIast: 'aparigraha — non-grasping',
        contemplation:
            'Seven days ago you invited this verse to walk beside you. Gather what it has taught you — then practise aparigraha, and release even this, with gratitude.',
        practice: 'Write one sentence you will carry forward, then close the circle.'
    }
];

function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

function normalise(journey) {
    if (!journey || !journey.verse || !journey.startDate) return null;
    return { checkIns: {}, ...journey, checkIns: journey.checkIns || {} };
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
