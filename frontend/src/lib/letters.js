// Letters for later — written to the person you will be, sealed on this
// device, and delivered on the day you chose.

import { localDateKey, recordPath } from './path';

export const LETTERS_KEY = 'lgLetters';
export const LETTERS_EVENT = 'lgLettersUpdated';

export const DELIVERIES = [
    { id: 'week', days: 7 },
    { id: 'month', days: 30 },
    { id: 'season', days: 90 },
    { id: 'year', days: 365 }
];

export function readLetters() {
    try {
        const list = JSON.parse(localStorage.getItem(LETTERS_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function writeLetters(list) {
    try {
        localStorage.setItem(LETTERS_KEY, JSON.stringify(list));
    } catch {
        // storage full or disabled
    }
    window.dispatchEvent(new Event(LETTERS_EVENT));
}

export function sealLetter(body, days) {
    const now = new Date();
    const opens = new Date(now);
    opens.setDate(opens.getDate() + days);
    const letter = {
        id: `l${now.getTime().toString(36)}`,
        body: body.trim(),
        writtenAt: now.toISOString(),
        openOn: localDateKey(opens),
        openedAt: null
    };
    writeLetters([...readLetters(), letter]);
    recordPath('letter', { days });
    return letter;
}

export const isArrived = (letter, today = localDateKey()) => !letter.openedAt && letter.openOn <= today;

export function arrivedLetters() {
    return readLetters().filter((letter) => isArrived(letter)).sort((a, b) => a.openOn.localeCompare(b.openOn));
}

export function openLetter(id) {
    writeLetters(readLetters().map((letter) => (letter.id === id ? { ...letter, openedAt: new Date().toISOString() } : letter)));
}

export function releaseLetter(id) {
    writeLetters(readLetters().filter((letter) => letter.id !== id));
}

export const daysBetween = (fromIso, to = new Date()) => Math.max(0, Math.round((to - new Date(fromIso)) / 86400000));
