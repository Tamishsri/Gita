import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUp, Lock } from 'lucide-react';
import MoodSelector from './MoodSelector';
import DailyVerse from './DailyVerse';
import SavedLine from './SavedLine';
import VerseCompanion from './VerseCompanion';
import InstallCard from './InstallCard';
import { Diya, KolamRule } from './ui/Ornaments';
import { useHasKeyboard, useIsMobile } from '../hooks/useMediaQuery';
import { useI18n, localeFor } from '../i18n';
import { MOD_KEY } from '../lib/platform';
import { DAY_EVENT, qualityById, readDay } from '../lib/day';
import { practiceById, practiceForNow } from '../lib/practices';
import { usePreferences } from '../contexts/PreferencesContext';
import FollowUp from './FollowUp';
import { LetterArrived } from './Letters';
import { heavyHourNow } from '../lib/person';

function greetingKey(date) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 12) return 'home.greeting.morning';
    if (hour >= 12 && hour < 17) return 'home.greeting.afternoon';
    if (hour >= 17 && hour < 21) return 'home.greeting.evening';
    return 'home.greeting.night';
}

const NAME_ASKED_KEY = 'lgNameAsked';

// "What should I call you?" — asked once, gently, and kept on this device.
function NameAsk() {
    const { t } = useI18n();
    const { updateSettings } = usePreferences();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [hidden, setHidden] = useState(() => {
        try {
            return Boolean(localStorage.getItem(NAME_ASKED_KEY));
        } catch {
            return false;
        }
    });
    if (hidden) return null;

    const close = () => {
        try {
            localStorage.setItem(NAME_ASKED_KEY, new Date().toISOString());
        } catch {
            // the question will simply be asked again
        }
        setHidden(true);
    };

    if (!open) {
        return (
            <button type="button" className="name-ask__open" onClick={() => setOpen(true)}>
                {t('home.name.ask')}
            </button>
        );
    }

    return (
        <form
            className="name-ask"
            onSubmit={(event) => {
                event.preventDefault();
                const name = value.trim();
                if (!name) return;
                updateSettings({ name });
                close();
            }}
        >
            <label className="sr-only" htmlFor="name-input">{t('home.name.label')}</label>
            <div className="name-ask__row">
                <input
                    id="name-input"
                    className="name-ask__input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={t('home.name.placeholder')}
                    maxLength={24}
                    autoComplete="given-name"
                    autoFocus
                    enterKeyHint="done"
                />
                <button type="submit" className="btn btn--gold btn--sm" disabled={!value.trim()}>{t('home.name.save')}</button>
            </div>
            <p className="name-ask__note">
                {t('home.name.note')}{' '}
                <button type="button" className="btn btn--link btn--sm" onClick={close}>{t('common.notNow')}</button>
            </p>
        </form>
    );
}

// Ask the Gita directly — the front door for anyone who arrives with a question.
// It grows as they write: a sentence, or everything they have been carrying.
function AskField({ onAsk }) {
    const { t } = useI18n();
    const hasKeyboard = useHasKeyboard();
    const [text, setText] = useState('');
    const areaRef = useRef(null);

    useLayoutEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight, 240)}px`;
    }, [text]);

    const submit = (event) => {
        event?.preventDefault();
        if (text.trim()) onAsk(text.trim());
    };

    return (
        <div className="ask-wrap">
            <form className={`ask${text.includes('\n') || text.length > 60 ? ' is-long' : ''}`} onSubmit={submit}>
                <label className="sr-only" htmlFor="ask-input">{t('home.ask.label')}</label>
                <textarea
                    id="ask-input"
                    ref={areaRef}
                    className="ask__input"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                        // On a keyboard, Enter sends and Shift+Enter starts a new line;
                        // on a phone, the keyboard's own key adds a line and the arrow sends.
                        if (hasKeyboard && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
                    }}
                    placeholder={t('home.ask.placeholder')}
                    rows={1}
                    autoComplete="off"
                    maxLength={2000}
                />
                <button type="submit" className="ask__send" disabled={!text.trim()} aria-label={t('home.ask.send')}>
                    <ArrowUp size={18} />
                </button>
            </form>
            <p className="ask__privacy"><Lock size={11} aria-hidden="true" /> {t('home.ask.privacy')}</p>
        </div>
    );
}

function Home({ settings, onSelectMood, onAsk, onSelectVerse, openPractice, openPanel }) {
    const { t, lang } = useI18n();
    const [quiet, setQuiet] = useState(false);
    const [day, setDay] = useState(readDay);
    const quietTimer = useRef(null);
    const reduceMotion = useReducedMotion();
    const hasKeyboard = useHasKeyboard();
    const isMobile = useIsMobile();
    const now = new Date();
    // When this part of the day has often been heavy lately, say so gently.
    const [heavyHour] = useState(() => heavyHourNow(now));

    useEffect(() => {
        const update = () => setDay(readDay());
        window.addEventListener(DAY_EVENT, update);
        return () => {
            window.removeEventListener(DAY_EVENT, update);
            clearTimeout(quietTimer.current);
        };
    }, []);

    const notToday = () => {
        setQuiet(true);
        clearTimeout(quietTimer.current);
        quietTimer.current = setTimeout(() => setQuiet(false), 4200);
    };

    const rise = (delay = 0) => ({
        initial: reduceMotion ? false : { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 1, ease: [0.22, 1, 0.36, 1] }
    });

    const quality = day.sankalpa && qualityById(day.sankalpa.quality);
    const suggested = practiceById(practiceForNow(now));
    const SuggestedGlyph = suggested.glyph;

    return (
        <div className="home">
            <motion.header className="hero" {...rise(0)}>
                <Diya size={76} steady />
                <span className="hero__date">
                    {now.toLocaleDateString(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <h1 className="hero__greeting">
                    {t(greetingKey(now))}{settings.name ? <>, <span className="hero__name">{settings.name}</span></> : null}
                </h1>
                <p className="hero__question">
                    {settings.silentMode ? t('home.question.silent') : t('home.question')}
                </p>
                {heavyHour && !settings.silentMode && <p className="hero__rhythm">{t(`home.rhythm.${heavyHour}`)}</p>}
                {!settings.name && <NameAsk />}
                {quality && (
                    <span className="sankalpa-note">
                        {t('home.sankalpa.today')}
                        <strong>{lang === 'hi' ? quality.hi : quality.en}</strong>
                        <span className="devanagari faint" lang="sa">{quality.sa}</span>
                    </span>
                )}
            </motion.header>

            <div className="home-notes">
                <LetterArrived />
                <FollowUp name={settings.name} onAsk={onAsk} />
            </div>

            <motion.section className="moods" aria-label={t('home.moods.label')} {...rise(0.15)}>
                <span className="moods__prompt">{t('home.moods.prompt')}</span>
                <AnimatePresence mode="wait" initial={false}>
                    {quiet ? (
                        <motion.div
                            key="quiet"
                            className="quiet-moment"
                            role="status"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.9 }}
                        >
                            <div>
                                <p>{t('home.quiet.one')}</p>
                                <p>{t('home.quiet.two')}</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="moods" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <MoodSelector onSelect={onSelectMood} />
                        </motion.div>
                    )}
                </AnimatePresence>
                {!settings.silentMode && <AskField onAsk={onAsk} />}
                {!quiet && (
                    <button type="button" className="btn btn--link" onClick={notToday}>{t('home.notToday')}</button>
                )}
            </motion.section>

            <KolamRule />

            <VerseCompanion language={settings.language} onSelectVerse={onSelectVerse} />

            <DailyVerse language={settings.language} onSelectVerse={onSelectVerse} />

            <motion.section className="section" aria-label={t('home.practice.label')} {...rise(0.1)}>
                <button type="button" className="invitation" onClick={() => openPractice(suggested.id)}>
                    <span className="invitation__glyph"><SuggestedGlyph size={30} /></span>
                    <span className="invitation__text">
                        <span className="eyebrow">{t('home.practice.now')}</span>
                        <strong>{t(`practice.${suggested.id}.title`)}</strong>
                        <span>{t(`practice.${suggested.id}.invite`)}</span>
                    </span>
                    <ArrowRight size={18} className="faint" />
                </button>
                <div className="home-links">
                    <button type="button" className="btn btn--link" onClick={() => openPanel('practice')}>
                        {t('home.practice.all')}
                    </button>
                    <span className="home-links__dot" aria-hidden="true">·</span>
                    <button type="button" className="btn btn--link" onClick={() => openPanel('letters')}>
                        {t('home.letter')}
                    </button>
                </div>
            </motion.section>

            <SavedLine />

            {isMobile && <InstallCard />}

            <footer className="home-footer">
                <Diya size={34} steady />
                <p className="home-footer__sanskrit" lang="sa">समत्वं योग उच्यते</p>
                <p className="home-footer__motto">{t('home.footer.motto')}</p>
                <p>{t('home.footer.privacy')}</p>
                <button type="button" className="btn btn--link btn--sm" onClick={() => openPanel('about')}>
                    {t('home.footer.about')}
                </button>
                {hasKeyboard && (
                    <p className="home-footer__keys">
                        <span><span className="kbd-group"><span className="kbd">{MOD_KEY}</span><span className="kbd">K</span></span> {t('keys.search')}</span>
                        <span><span className="kbd">P</span> {t('keys.practice')}</span>
                        <span><span className="kbd">J</span> {t('keys.journal')}</span>
                        <span><span className="kbd">C</span> {t('keys.chapters')}</span>
                    </p>
                )}
            </footer>
        </div>
    );
}

export default Home;
