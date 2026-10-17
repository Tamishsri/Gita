import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUp } from 'lucide-react';
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

function greetingKey(date) {
    const hour = date.getHours();
    if (hour >= 4 && hour < 12) return 'home.greeting.morning';
    if (hour >= 12 && hour < 17) return 'home.greeting.afternoon';
    if (hour >= 17 && hour < 21) return 'home.greeting.evening';
    return 'home.greeting.night';
}

// Ask the Gita directly — the front door for anyone who arrives with a question.
function AskField({ onAsk }) {
    const { t } = useI18n();
    const [text, setText] = useState('');
    const submit = (event) => {
        event.preventDefault();
        if (text.trim()) onAsk(text.trim());
    };
    return (
        <form className="ask" onSubmit={submit}>
            <label className="sr-only" htmlFor="ask-input">{t('home.ask.label')}</label>
            <input
                id="ask-input"
                className="ask__input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('home.ask.placeholder')}
                autoComplete="off"
                enterKeyHint="send"
                maxLength={2000}
            />
            <button type="submit" className="ask__send" disabled={!text.trim()} aria-label={t('home.ask.send')}>
                <ArrowUp size={18} />
            </button>
        </form>
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
                <h1 className="hero__greeting">{t(greetingKey(now))}</h1>
                <p className="hero__question">
                    {settings.silentMode ? t('home.question.silent') : t('home.question')}
                </p>
                {quality && (
                    <span className="sankalpa-note">
                        {t('home.sankalpa.today')}
                        <strong>{lang === 'hi' ? quality.hi : quality.en}</strong>
                        <span className="devanagari faint" lang="sa">{quality.sa}</span>
                    </span>
                )}
            </motion.header>

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
