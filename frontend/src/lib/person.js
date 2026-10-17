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

// ---------------------------------------------------------------------------
// The profile: what the person told Sakha about themselves, and what Sakha
// has learned helps them. Also only on this device.
//   voice:   how Sakha speaks — 'gentle' | 'direct' | 'teacher'
//   paths:   how much each of the Gita's four paths has helped them
//   context: what they asked Sakha to keep in mind about their life
//   helped:  verses they said helped (ids only)
// ---------------------------------------------------------------------------

export const PROFILE_KEY = 'lgProfile';
export const PROFILE_EVENT = 'lgProfileUpdated';
export const PATH_IDS = ['karma', 'jnana', 'bhakti', 'dhyana'];
export const VOICES = ['gentle', 'direct', 'teacher'];
export const CONTEXT_LIMIT = 600;

const EMPTY_PROFILE = Object.freeze({ voice: 'gentle', paths: {}, chosenPath: null, context: '', helped: [], feedback: 0 });

export function readProfile() {
    try {
        const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
        return { ...EMPTY_PROFILE, ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
        return { ...EMPTY_PROFILE };
    }
}

export function updateProfile(patch) {
    const next = { ...readProfile(), ...patch };
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(PROFILE_EVENT));
    } catch {
        // storage full or disabled — the profile simply isn't kept
    }
    return next;
}

/** "This is me": a path chosen outright counts for more than any single answer. */
export function choosePath(id) {
    const profile = readProfile();
    const paths = { ...profile.paths };
    if (profile.chosenPath && profile.chosenPath !== id) paths[profile.chosenPath] = Math.max(0, (paths[profile.chosenPath] || 0) - 3);
    if (id) paths[id] = (paths[id] || 0) + 3;
    return updateProfile({ paths, chosenPath: id || null });
}

// What "not quite — something practical" says about a person.
const REASON_LEANS = { practical: 'karma', deeper: 'jnana', comfort: 'bhakti' };

/**
 * Learn from "this helped" / "not quite".
 * @param {{ verseId?: string, paths?: string[], helped: boolean, reason?: string }} feedback
 */
export function learnFromFeedback({ verseId, paths = [], helped, reason = null }) {
    const profile = readProfile();
    const next = { ...profile.paths };
    const valid = paths.filter((id) => PATH_IDS.includes(id));
    if (helped) {
        valid.forEach((id) => { next[id] = (next[id] || 0) + 1; });
    } else {
        valid.forEach((id) => { next[id] = Math.max(0, (next[id] || 0) - 0.25); });
        if (REASON_LEANS[reason]) next[REASON_LEANS[reason]] = (next[REASON_LEANS[reason]] || 0) + 0.5;
    }
    const helpedIds = helped && verseId ? [...profile.helped.filter((id) => id !== verseId), verseId].slice(-60) : profile.helped;
    return updateProfile({ paths: next, helped: helpedIds, feedback: (profile.feedback || 0) + 1 });
}

/** The path that has helped most so far, once there is enough to say. */
export function leaningPath(profile = readProfile()) {
    const entries = PATH_IDS.map((id) => [id, Number(profile.paths?.[id]) || 0]).sort((a, b) => b[1] - a[1]);
    const [top, second] = entries;
    if (!top || top[1] < 2) return null;
    return top[1] >= second[1] * 1.25 ? top[0] : null;
}

export function forgetProfile() {
    try {
        localStorage.removeItem(PROFILE_KEY);
        window.dispatchEvent(new Event(PROFILE_EVENT));
    } catch {
        // nothing to forget
    }
}

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
    const profile = readProfile();
    const resonant = [
        saved?.verseId,
        ...readReflections().map((entry) => entry.verseId),
        ...readLearnedIds(),
        ...profile.helped
    ].filter((id) => typeof id === 'string' && /^\d+_\d+$/.test(id));

    return {
        name: (settings.name || '').trim() || null,
        voice: VOICES.includes(profile.voice) ? profile.voice : 'gentle',
        paths: profile.paths,
        context: typeof profile.context === 'string' ? profile.context.slice(0, CONTEXT_LIMIT) : '',
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

/** What the person can see, and release, about themselves. */
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
