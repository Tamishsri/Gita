import { REFLECTIONS_EVENT, SAVED_LINE_EVENT } from './verse';
import { JOURNEY_EVENT } from './journey';

export const SETTINGS_KEY = 'livingGitaSettings';

export const DEFAULT_SETTINGS = Object.freeze({
    language: 'en',
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

// Everything Living Gita ever writes to this device.
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
    'lgOfflineReadyNotified'
];

export function purgeLocalData() {
    LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    [REFLECTIONS_EVENT, SAVED_LINE_EVENT, JOURNEY_EVENT].forEach((name) => window.dispatchEvent(new Event(name)));
}
