import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Languages, Lock, Sprout } from 'lucide-react';
import SakhaMark from './ui/SakhaMark';
import { usePreferences } from '../contexts/PreferencesContext';
import { useI18n } from '../i18n';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';

export const MET_KEY = 'lgMet';

export function hasMet() {
    try {
        return Boolean(localStorage.getItem(MET_KEY));
    } catch {
        return true;
    }
}

// The first meeting. Sakha says who it is, makes three promises, and asks
// what to call you — once, before anything else.
function Welcome({ onDone }) {
    const { t } = useI18n();
    const { settings, updateSettings } = usePreferences();
    const reduceMotion = useReducedMotion();
    const [name, setName] = useState(settings.name || '');

    const begin = (event) => {
        event?.preventDefault();
        const chosen = name.trim();
        if (chosen) updateSettings({ name: chosen });
        try {
            localStorage.setItem(MET_KEY, new Date().toISOString());
            if (chosen) localStorage.setItem('lgNameAsked', new Date().toISOString());
        } catch {
            // the welcome will simply be offered again
        }
        playChime('soft');
        haptic('success');
        onDone();
    };

    const rise = (delay) => ({
        initial: reduceMotion ? false : { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 1.1, ease: [0.22, 1, 0.36, 1] }
    });

    const promises = [
        { icon: Lock, key: 'private' },
        { icon: Sprout, key: 'noScore' },
        { icon: Languages, key: 'anyWords' }
    ];

    return (
        <main className="threshold welcome" id="main">
            <form className="welcome__panel" onSubmit={begin}>
                <motion.div className="welcome__mark" {...rise(0)}>
                    <SakhaMark size={104} />
                </motion.div>
                <motion.span className="eyebrow" {...rise(0.25)}>{t('welcome.eyebrow')}</motion.span>
                <motion.h1 className="welcome__title" {...rise(0.4)}>{t('welcome.title')}</motion.h1>
                <motion.p className="welcome__lede" {...rise(0.6)}>{t('welcome.lede')}</motion.p>

                <motion.ul className="welcome__promises" {...rise(0.85)}>
                    {promises.map(({ icon: Icon, key }) => (
                        <li key={key}>
                            <Icon size={17} aria-hidden="true" />
                            <span>{t(`welcome.promise.${key}`)}</span>
                        </li>
                    ))}
                </motion.ul>

                <motion.div className="welcome__name" {...rise(1.05)}>
                    <label htmlFor="welcome-name">{t('home.name.ask')}</label>
                    <input
                        id="welcome-name"
                        className="name-ask__input"
                        value={name}
                        onChange={(event) => setName(event.target.value.slice(0, 24))}
                        placeholder={t('welcome.namePlaceholder')}
                        autoComplete="given-name"
                        enterKeyHint="go"
                        maxLength={24}
                    />
                </motion.div>

                <motion.div className="welcome__actions" {...rise(1.2)}>
                    <button type="submit" className="btn btn--gold btn--lg">{t('welcome.begin')}</button>
                </motion.div>

                <motion.p className="welcome__verse" {...rise(1.4)}>
                    {t('welcome.verse')} <cite>— 4.3</cite>
                </motion.p>
            </form>
        </main>
    );
}

export default Welcome;
