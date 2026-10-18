// What Sakha remembers about the person — kept only on this device.
//
// Not their conversations. Only: the name they chose to be called, which life
// situations they have brought before (as labels like "study" or "family"),
// which feelings keep returning, when they tend to come, today's intention,
// the verses that moved them, and — when they teach it — a few words of their
// own for a feeling ("meh" → low). The wisdom engine uses this to answer
// *them*, not an average person. All of it is shown, and erasable, in the
// "What Sakha knows about you" panel.

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
//   lexicon: their own words for feelings, learned when they clarify
//            ({ "meh": { "sadness": 2 } })
// ---------------------------------------------------------------------------

export const PROFILE_KEY = 'lgProfile';
export const PROFILE_EVENT = 'lgProfileUpdated';
export const PATH_IDS = ['karma', 'jnana', 'bhakti', 'dhyana'];
export const VOICES = ['gentle', 'direct', 'teacher'];
export const CONTEXT_LIMIT = 600;

const EMPTY_PROFILE = Object.freeze({ voice: 'gentle', paths: {}, chosenPath: null, context: '', helped: [], feedback: 0, lexicon: {} });
const LEXICON_LIMIT = 40;

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

/** A clarification taught Sakha one of this person's words for a feeling. */
export function learnWord({ phrase, feeling } = {}) {
    if (typeof phrase !== 'string' || !phrase.trim() || phrase.length > 40 || typeof feeling !== 'string') return readProfile();
    const profile = readProfile();
    const lexicon = { ...(profile.lexicon || {}) };
    const entry = { ...(lexicon[phrase] || {}) };
    entry[feeling] = (entry[feeling] || 0) + 1;
    lexicon[phrase] = entry;
    const kept = Object.entries(lexicon).slice(-LEXICON_LIMIT);
    return updateProfile({ lexicon: Object.fromEntries(kept) });
}

export function forgetWord(phrase) {
    const profile = readProfile();
    const lexicon = { ...(profile.lexicon || {}) };
    delete lexicon[phrase];
    return updateProfile({ lexicon });
}

/** Each learned word with the feeling it most often means. */
export function learnedWords(profile = readProfile()) {
    return Object.entries(profile.lexicon || {})
        .map(([phrase, feelings]) => [phrase, Object.entries(feelings || {}).sort((a, b) => b[1] - a[1])[0]?.[0]])
        .filter(([, feeling]) => feeling);
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
        lexicon: profile.lexicon && typeof profile.lexicon === 'object' ? profile.lexicon : {},
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

// When something mentioned is due: the evening of that day.
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function dueDate(when, now = new Date()) {
    const due = new Date(now);
    due.setHours(18, 0, 0, 0);
    if (when === 'today') return due;
    if (when === 'tomorrow') due.setDate(due.getDate() + 1);
    else if (when === 'dayafter') due.setDate(due.getDate() + 2);
    else if (when === 'nextweek') due.setDate(due.getDate() + 7);
    else if (WEEKDAYS.includes(when)) {
        const ahead = (WEEKDAYS.indexOf(when) - now.getDay() + 7) % 7 || 7;
        due.setDate(due.getDate() + ahead);
    } else {
        return null;
    }
    return due;
}

/** Keep the shape of a conversation — never its words. */
export function rememberConversation(session, context = {}) {
    if (!context || context.crisis_detected) return;
    const topics = Array.isArray(context.topics) ? context.topics.slice(0, 2) : [];
    const due = context.event ? dueDate(context.event.when) : null;
    const event = due ? { kind: context.event.kind, dueAt: due.toISOString() } : null;
    if (!context.emotion && !topics.length && !event) return;
    recordPath('ask', { session, emotion: context.emotion || null, topics, ...(event ? { event } : {}) });
}

// ---------------------------------------------------------------------------
// Rhythm: when this person tends to come, and how those times feel.
// ---------------------------------------------------------------------------

export function partOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

const LIGHT_FEELINGS = ['peace', 'gratitude', 'love', 'devotion'];

/** The part of the day that has often been heavy lately, if now is that time. */
export function heavyHourNow(now = new Date(), events = readPath()) {
    const month = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const bucket = partOfDay(now);
    const visits = new Map();
    events.filter((event) => event.kind === 'ask' && Date.parse(event.at) > month).forEach((event) => {
        const at = new Date(event.at);
        if (partOfDay(at) !== bucket) return;
        const key = `${event.session}`;
        const heavy = Boolean(event.emotion) && !LIGHT_FEELINGS.includes(event.emotion);
        visits.set(key, (visits.get(key) || false) || heavy);
    });
    const total = visits.size;
    const heavy = [...visits.values()].filter(Boolean).length;
    return total >= 3 && heavy >= 3 && heavy / total >= 0.6 ? bucket : null;
}

/** How Sakha understands this person, as short lines the panel can show. */
export function portraitOf(settings = {}, events = readPath()) {
    const person = buildPerson(settings);
    const profile = readProfile();
    const asks = events.filter((event) => event.kind === 'ask');
    const sessions = new Set(asks.map((event) => event.session));
    const lines = [];
    if (sessions.size < 2) return { lines: [{ key: 'you.portrait.beginning' }], sessions: sessions.size };

    const buckets = {};
    const seen = new Set();
    asks.forEach((event) => {
        const key = `${event.session}`;
        if (seen.has(key)) return;
        seen.add(key);
        const bucket = partOfDay(new Date(event.at));
        buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    const [usual, usualCount] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0] || [];
    if (usual && usualCount >= 2 && usualCount / sessions.size >= 0.5) lines.push({ key: `you.portrait.when.${usual}` });

    const topics = Object.entries(person.topics).sort((a, b) => b[1].count - a[1].count).slice(0, 2).map(([id]) => id);
    if (topics.length === 2) lines.push({ key: 'you.portrait.topics2', vars: { a: topics[0], b: topics[1] } });
    else if (topics.length === 1) lines.push({ key: 'you.portrait.topics1', vars: { a: topics[0] } });

    const feelings = {};
    asks.forEach((event) => { if (event.emotion && !LIGHT_FEELINGS.includes(event.emotion)) feelings[event.emotion] = (feelings[event.emotion] || 0) + 1; });
    const [feeling, feelingCount] = Object.entries(feelings).sort((a, b) => b[1] - a[1])[0] || [];
    if (feeling && feelingCount >= 2) lines.push({ key: 'you.portrait.feeling', vars: { feeling } });

    const lean = leaningPath(profile);
    if (lean) lines.push({ key: 'you.portrait.path', vars: { path: lean } });
    if (profile.voice && profile.voice !== 'gentle') lines.push({ key: `you.portrait.voice.${profile.voice}` });
    const words = learnedWords(profile).length;
    if (words) lines.push({ key: 'you.portrait.words', vars: { count: words } });
    return { lines, sessions: sessions.size };
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
