// What Sakha keeps on this device, shown plainly — and handed back, whole,
// to the person it belongs to.

import { LOCAL_KEYS } from './settings';
import { LOCK_KEY } from './lock';

// What each stored thing is, in a word the person will recognise.
const KINDS = {
    userReflections: 'journal',
    lgLetters: 'letters',
    lgPath: 'path',
    lgProfile: 'profile',
    livingGitaSettings: 'settings',
    savedLine: 'verses',
    lgLearned: 'verses',
    verseCompanion: 'verses',
    lgFollowups: 'path'
};

function sizeOf(value) {
    try {
        return new Blob([value || '']).size;
    } catch {
        return (value || '').length;
    }
}

/** Counts of what is stored, by kind, for the "Your data" view. */
export function describeStorage() {
    const counts = { journal: 0, letters: 0, conversations: 0, verses: 0, practices: 0 };
    let bytes = 0;
    LOCAL_KEYS.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (raw == null) return;
        bytes += sizeOf(raw);
        let value = null;
        try {
            value = JSON.parse(raw);
        } catch {
            value = raw;
        }
        if (KINDS[key] === 'journal' && Array.isArray(value)) counts.journal = value.length;
        if (KINDS[key] === 'letters' && Array.isArray(value)) counts.letters = value.length;
        if (key === 'lgPath' && Array.isArray(value)) {
            counts.conversations = new Set(value.filter((event) => event.kind === 'ask').map((event) => event.session)).size;
            counts.verses = value.filter((event) => event.kind === 'verse').length;
            counts.practices = value.filter((event) => ['breaths', 'japa', 'dhyana', 'sankalpa', 'sandhya', 'walk'].includes(event.kind)).length;
        }
    });
    return { counts, bytes };
}

/** Everything Sakha keeps, as one file the person can save. The lock's hash stays behind. */
export function exportData() {
    const data = {};
    LOCAL_KEYS.filter((key) => key !== LOCK_KEY).forEach((key) => {
        const raw = localStorage.getItem(key);
        if (raw == null) return;
        try {
            data[key] = JSON.parse(raw);
        } catch {
            data[key] = raw;
        }
    });
    const file = {
        app: 'Sakha',
        note: 'Everything Sakha kept on your device. It was never stored anywhere else.',
        exportedAt: new Date().toISOString(),
        data
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sakha-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Leave at once, to an ordinary page, without a trace in this tab's history. */
export function quickExit() {
    try {
        document.title = 'Weather';
        document.body.innerHTML = '';
    } catch {
        // leaving anyway
    }
    window.location.replace('https://www.google.com/search?q=weather');
}
