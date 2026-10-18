import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Languages, Lock, Sprout } from 'lucide-react';
import SakhaMark from './ui/SakhaMark';
import { PATH_COLOURS } from './ui/PathLotus';
import { usePreferences } from '../contexts/PreferencesContext';
import { PATH_IDS, VOICES, choosePath, updateProfile } from '../lib/person';
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

// The first meeting. Sakha says who it is, makes three promises and asks
// what to call you; then, if you like, how to speak with you and what tends
// to help — so the very first answer is already yours.
function Welcome({ onDone }) {
    const { t } = useI18n();
    const { settings, updateSettings } = usePreferences();
    const reduceMotion = useReducedMotion();
    const [step, setStep] = useState(1);
    const [name, setName] = useState(settings.name || '');
    const [path, setPath] = useState(null);
    const [voice, setVoice] = useState('gentle');

    const next = (event) => {
        event?.preventDefault();
        const chosen = name.trim();
        if (chosen) updateSettings({ name: chosen });
        haptic('soft');
        setStep(2);
    };

    const begin = (personalise) => {
        if (personalise) {
            if (path) choosePath(path);
            updateProfile({ voice });
        }
        try {
            localStorage.setItem(MET_KEY, new Date().toISOString());
            if (name.trim()) localStorage.setItem('lgNameAsked', new Date().toISOString());
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
            <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                    <motion.form key="hello" className="welcome__panel" onSubmit={next} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}>
                        <motion.div className="welcome__mark" {...rise(0)}>
                            <SakhaMark size={104} alive />
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
                            <button type="submit" className="btn btn--gold btn--lg">{t('welcome.continue')}</button>
                        </motion.div>

                        <motion.p className="welcome__verse" {...rise(1.4)}>
                            {t('welcome.verse')} <cite>— 4.3</cite>
                        </motion.p>
                    </motion.form>
                ) : (
                    <motion.div
                        key="yours"
                        className="welcome__panel welcome__panel--yours"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <span className="eyebrow">{t('welcome.yours.eyebrow')}</span>
                        <h1 className="welcome__title welcome__title--sm">
                            {name.trim() ? t('welcome.yours.titleNamed', { name: name.trim() }) : t('welcome.yours.title')}
                        </h1>
                        <p className="welcome__lede">{t('welcome.yours.lede')}</p>

                        <section className="welcome__question">
                            <h2>{t('welcome.yours.helps')}</h2>
                            <div className="path-choices path-choices--grid" role="radiogroup" aria-label={t('welcome.yours.helps')}>
                                {PATH_IDS.map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        role="radio"
                                        aria-checked={path === id}
                                        className="path-choice"
                                        style={{ '--petal-rgb': PATH_COLOURS[id] }}
                                        onClick={() => setPath(path === id ? null : id)}
                                    >
                                        <span className="path-choice__dot" aria-hidden="true" />
                                        <span className="path-choice__name">{t(`path4.${id}.feel`)}</span>
                                        <span className="path-choice__hint">{t(`path4.${id}.name`)} · {t(`path4.${id}.sanskrit`)}</span>
                                        {path === id && <Check size={15} className="path-choice__check" aria-hidden="true" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="welcome__question">
                            <h2>{t('welcome.yours.voice')}</h2>
                            <div className="voice-options voice-options--compact" role="radiogroup" aria-label={t('welcome.yours.voice')}>
                                {VOICES.map((id) => (
                                    <button key={id} type="button" role="radio" aria-checked={voice === id} className="voice-option" onClick={() => setVoice(id)}>
                                        <span className="voice-option__name">{t(`you.voice.${id}`)}</span>
                                        <span className="voice-option__hint">{t(`you.voice.${id}.hint`)}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <div className="welcome__actions">
                            <button type="button" className="btn btn--gold btn--lg" onClick={() => begin(true)}>{t('welcome.begin')}</button>
                            <button type="button" className="btn btn--link btn--sm" onClick={() => begin(false)}>{t('welcome.yours.skip')}</button>
                        </div>
                        <p className="welcome__fine"><Lock size={12} aria-hidden="true" /> {t('welcome.yours.fine')}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

export default Welcome;
