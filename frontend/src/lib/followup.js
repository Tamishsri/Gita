// "How is it now?" — when someone returns after sharing something heavy,
// Sakha asks about it. Built only from the on-device shape of the last
// conversation (situation and feeling labels), never its words.

import { readPath, recordPath } from './path';

export const FOLLOWUPS_KEY = 'lgFollowups';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Joy, peace, love and devotion need no follow-up; desire and ego are not
// brought up unasked.
const QUIET = ['lust', 'pride', 'gratitude', 'peace', 'love', 'devotion'];

export function readFollowups() {
    try {
        const value = JSON.parse(localStorage.getItem(FOLLOWUPS_KEY) || '{}');
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

// Something they said was coming — an exam, an interview, a surgery — once
// its day has passed: "How did your exam go?" (asked from the evening of
// that day for up to six days; the label and the day are all that was kept).
const EVENT_KINDS = ['exam', 'interview', 'surgery', 'results', 'presentation', 'appointment', 'wedding', 'hearing', 'match'];

function pendingEvent(asks, now) {
    const answered = readFollowups();
    for (let i = asks.length - 1; i >= 0; i--) {
        const event = asks[i].event;
        if (!event || !EVENT_KINDS.includes(event.kind)) continue;
        const due = Date.parse(event.dueAt);
        if (!Number.isFinite(due)) continue;
        const key = `event:${asks[i].session}:${event.kind}`;
        if (answered[key]) continue;
        if (now >= due + 2 * HOUR && now <= due + 6 * DAY) {
            return { session: asks[i].session, key, event: event.kind, topic: (asks[i].topics || [])[0] || null, emotion: asks[i].emotion || null, at: asks[i].at };
        }
    }
    return null;
}

/** The last conversation, if it is old enough to ask about and not yet asked. */
export function pendingFollowUp(now = Date.now()) {
    const asks = readPath().filter((event) => event.kind === 'ask' && event.session);
    if (!asks.length) return null;
    const upcoming = pendingEvent(asks, now);
    if (upcoming) return upcoming;
    const latest = asks[asks.length - 1];
    const age = now - Date.parse(latest.at);
    if (age < 6 * HOUR || age > 10 * DAY) return null;
    if (readFollowups()[latest.session]) return null;

    const visit = asks.filter((event) => event.session === latest.session);
    const topic = visit.flatMap((event) => event.topics || [])[0] || null;
    const emotion = visit.map((event) => event.emotion).find((value) => value && !QUIET.includes(value)) || null;
    if (!topic && !emotion) return null;
    if (!emotion && visit.every((event) => QUIET.includes(event.emotion))) return null;
    return { session: latest.session, topic, emotion, at: latest.at };
}

/** @param {'lighter'|'same'|'harder'|'dismissed'} answer */
export function answerFollowUp(item, answer) {
    try {
        const all = readFollowups();
        all[item.key || item.session] = { answer, at: new Date().toISOString() };
        localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
    } catch {
        // the question will simply be asked again
    }
    if (answer !== 'dismissed') recordPath('followup', { answer, topic: item.topic, emotion: item.emotion, ...(item.event ? { event: item.event } : {}) });
}
