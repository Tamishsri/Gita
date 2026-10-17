// What Sakha remembers about the person — kept only on this device.
//
// Never their words. Only: the name they chose to be called, which life
// situations they have brought before (as labels like "study" or "family"),
// which feelings keep returning, today's intention, and the verses that moved
// them. The wisdom engine uses this to answer *them*, not an average person.

import { PATH_EVENT, readPath, recordPath } from './path';
import { qualityById, readDay } from './day';
import { readReflections, readSavedLine } from './verse';

const LEARNED_KEY = 'lgLearned';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function readLearnedIds() {
    try {
        const list = JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]');
        return Array.isArray(list) ? list.map((item) => item.id).filter(Boolean) : [];
    } catch {
        return [];
    }
}

/**
 * @param {{ name?: string }} settings
 * @param {{ session?: string|number }} [options] the current conversation, left out of "before"
 */
export function buildPerson(settings = {}, { session = null } = {}) {
    const events = readPath();
    const now = Date.now();
    const asks = events.filter((event) => event.kind === 'ask' && String(event.session) !== String(session));

    // Situations brought before, counted once per conversation.
    const topics = {};
    const seen = new Set();
    asks.forEach((event) => (event.topics || []).forEach((topic) => {
        const key = `${event.session}:${topic}`;
        if (seen.has(key)) return;
        seen.add(key);
        const item = topics[topic] || { count: 0, last: null };
        item.count += 1;
        if (!item.last || event.at > item.last) item.last = event.at;
        topics[topic] = item;
    }));

    // Feelings that returned this week, again once per conversation.
    const recurring = {};
    const felt = new Set();
    asks.filter((event) => event.emotion && now - Date.parse(event.at) < WEEK).forEach((event) => {
        const key = `${event.session}:${event.emotion}`;
        if (felt.has(key)) return;
        felt.add(key);
        recurring[event.emotion] = (recurring[event.emotion] || 0) + 1;
    });

    const last = [...asks].reverse().find((event) => event.topics?.length);
    const day = readDay();
    const quality = day.sankalpa && qualityById(day.sankalpa.quality);
    const saved = readSavedLine();
    const resonant = [
        saved?.verseId,
        ...readReflections().map((entry) => entry.verseId),
        ...readLearnedIds()
    ].filter((id) => typeof id === 'string' && /^\d+_\d+$/.test(id));

    return {
        name: (settings.name || '').trim() || null,
        topics,
        recurring,
        lastVisit: last ? { topic: last.topics[0], at: last.at } : null,
        sankalpa: quality ? { en: quality.en, hi: quality.hi } : null,
        resonant: [...new Set(resonant)].slice(-40)
    };
}

/** Keep the shape of a conversation — never its words. */
export function rememberConversation(session, context = {}) {
    if (!context || context.crisis_detected) return;
    const topics = Array.isArray(context.topics) ? context.topics.slice(0, 2) : [];
    if (!context.emotion && !topics.length) return;
    recordPath('ask', { session, emotion: context.emotion || null, topics });
}

/** What the person can see, and release, on their Path. */
export function summariseMemory(settings = {}) {
    const person = buildPerson(settings);
    const topics = Object.entries(person.topics).sort((a, b) => b[1].count - a[1].count);
    const feelings = Object.entries(person.recurring).sort((a, b) => b[1] - a[1]);
    return { name: person.name, topics, feelings, conversations: new Set(readPath().filter((e) => e.kind === 'ask').map((e) => e.session)).size };
}

/** Forget every conversation's shape. Moods, practices and verses stay on the Path. */
export function forgetConversations() {
    try {
        const kept = readPath().filter((event) => event.kind !== 'ask');
        localStorage.setItem('lgPath', JSON.stringify(kept));
        window.dispatchEvent(new Event(PATH_EVENT));
    } catch {
        // nothing to forget
    }
}
