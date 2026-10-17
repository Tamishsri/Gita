import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nProvider } from '../i18n';
import { ensureScriptFont, scriptFontFamily, transliterate } from '../lib/script';

// The person's preferences, available anywhere without prop drilling:
// language of the interface and translations, script for the Sanskrit,
// the light the app is read by, and the rest of their settings.

const PreferencesContext = createContext({
    settings: {},
    updateSettings: () => {},
    sanskrit: (text) => text,
    scriptFont: 'var(--font-sanskrit)',
    theme: 'dawn'
});

const THEME_COLOR = { dawn: '#fbf6ec', night: '#0d0e15' };

// "Follow the sun": dawn light from five in the morning until seven at night.
function resolveTheme(choice, date = new Date()) {
    if (choice === 'night' || choice === 'dawn') return choice;
    const hour = date.getHours();
    return hour >= 5 && hour < 19 ? 'dawn' : 'night';
}

function useResolvedTheme(choice) {
    const [theme, setTheme] = useState(() => resolveTheme(choice));
    useEffect(() => {
        setTheme(resolveTheme(choice));
        if (choice !== 'auto') return undefined;
        const timer = setInterval(() => setTheme(resolveTheme(choice)), 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, [choice]);
    return theme;
}

export function PreferencesProvider({ settings, updateSettings, children }) {
    const script = settings.script || 'deva';
    const theme = useResolvedTheme(settings.theme || 'dawn');

    useEffect(() => {
        ensureScriptFont(script);
        document.documentElement.style.setProperty('--font-script', scriptFontFamily(script));
    }, [script]);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = theme;
        root.style.colorScheme = theme === 'dawn' ? 'light' : 'dark';
        root.style.background = THEME_COLOR[theme];
        document.body.style.background = '';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
        document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme === 'dawn' ? 'light' : 'dark');
    }, [theme]);

    const value = useMemo(() => ({
        settings,
        updateSettings,
        script,
        theme,
        scriptFont: scriptFontFamily(script),
        // Render a śloka in the chosen script. IAST comes from the corpus.
        sanskrit: (devanagari, iast) => transliterate(devanagari, script, iast)
    }), [settings, updateSettings, script, theme]);

    return (
        <PreferencesContext.Provider value={value}>
            <I18nProvider lang={settings.language}>{children}</I18nProvider>
        </PreferencesContext.Provider>
    );
}

export const usePreferences = () => useContext(PreferencesContext);
