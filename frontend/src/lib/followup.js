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

/** The last conversation, if it is old enough to ask about and not yet asked. */
export function pendingFollowUp(now = Date.now()) {
    const asks = readPath().filter((event) => event.kind === 'ask' && event.session);
    if (!asks.length) return null;
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
        all[item.session] = { answer, at: new Date().toISOString() };
        localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(all));
    } catch {
        // the question will simply be asked again
    }
    if (answer !== 'dismissed') recordPath('followup', { answer, topic: item.topic, emotion: item.emotion });
}
