import React, { createContext, useContext, useMemo } from 'react';
import en from './en';
import hi from './hi';
import { appName } from '../lib/brand';

// Interface language. Verse translations exist in English and Hindi in the
// corpus, so the interface speaks those two; the Sanskrit itself can be read
// in ten scripts (see lib/script.js).

export const DICTIONARIES = { en, hi };

export const LANGUAGES = [
    { id: 'en', label: 'English', native: 'English' },
    { id: 'hi', label: 'Hindi', native: 'हिन्दी' }
];

let current = 'en';

export function setLanguage(lang) {
    current = DICTIONARIES[lang] ? lang : 'en';
    if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export function getLanguage() {
    return current;
}

/**
 * t('journal.entries', { count: 3 }) — looks for `journal.entries_one` when
 * count is 1, then falls back to English, then to the key itself.
 */
export function translate(key, vars, lang = current) {
    const dict = DICTIONARIES[lang] || en;
    const pluralKey = vars && vars.count === 1 ? `${key}_one` : null;
    // Stay in the chosen language first; Hindi rarely needs a separate singular.
    const pick = (source) => (pluralKey && source[pluralKey]) || source[key];
    let text = pick(dict) ?? pick(en);
    if (text === undefined) {
        if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
        return key;
    }
    // {app} is filled everywhere from lib/brand.js, so the name lives in one place.
    const globals = { app: appName(DICTIONARIES[lang] ? lang : 'en') };
    if (text.includes('{')) text = text.replace(/\{(\w+)\}/g, (_, name) => (vars?.[name] ?? globals[name] ?? `{${name}}`));
    return text;
}

export const t = (key, vars) => translate(key, vars);

export function hasTranslation(key, lang = current) {
    return (DICTIONARIES[lang] || en)[key] !== undefined || en[key] !== undefined;
}

const I18nContext = createContext({ lang: 'en', t: (key, vars) => translate(key, vars, 'en') });

export function I18nProvider({ lang, children }) {
    setLanguage(lang);
    const value = useMemo(() => ({ lang: current, t: (key, vars) => translate(key, vars, current) }), [lang]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

// Locale for dates and numbers.
export const localeFor = (lang) => (lang === 'hi' ? 'hi-IN' : 'en-GB');
