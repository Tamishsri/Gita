import { REFLECTIONS_EVENT, SAVED_LINE_EVENT } from './verse';
import { JOURNEY_EVENT } from './journey';
import { PATH_EVENT } from './path';

export const SETTINGS_KEY = 'livingGitaSettings';

export const DEFAULT_SETTINGS = Object.freeze({
    language: 'en',
    script: 'deva',
    theme: 'dawn',
    depth: 'standard',
    silentMode: false,
    breathMode: false,
    soundMode: 'auto',
    chimes: true,
    haptics: true
});

export function loadSettings() {
    try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...stored };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // storage full or disabled — preferences simply won't persist
    }
}

// Everything Sakha ever writes to this device (keys keep their original
// names so nothing a person saved is lost).
const LOCAL_KEYS = [
    'userReflections',
    'savedLine',
    'verseCompanion',
    'companionVerse',
    'breathSession',
    'userAuraState',
    SETTINGS_KEY,
    'lgSoundVolume',
    'lgInstallDismissed',
    'lgOfflineReadyNotified',
    'lgPath',
    'lgDay',
    'lgJapa',
    'lgLearned',
    'lgReading'
];

export function purgeLocalData() {
    LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    [REFLECTIONS_EVENT, SAVED_LINE_EVENT, JOURNEY_EVENT, PATH_EVENT, 'lgDayUpdated'].forEach((name) => window.dispatchEvent(new Event(name)));
}
