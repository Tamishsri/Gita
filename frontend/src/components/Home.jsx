import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Search, Feather } from 'lucide-react';
import MoodSelector from './MoodSelector';
import DailyVerse from './DailyVerse';
import SavedLine from './SavedLine';
import VerseCompanion from './VerseCompanion';
import InstallCard from './InstallCard';
import LotusMark from './ui/LotusMark';
import { useHasKeyboard, useIsMobile } from '../hooks/useMediaQuery';
import { MOD_KEY } from '../lib/platform';

function greeting(date, language) {
    const hour = date.getHours();
    if (language === 'hi') {
        if (hour >= 5 && hour < 12) return 'सुप्रभात';
        if (hour >= 12 && hour < 17) return 'नमस्कार';
        if (hour >= 17 && hour < 21) return 'शुभ संध्या';
        return 'शुभ रात्रि';
    }
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'The night is quiet';
}

function Home({ settings, onSelectMood, onSelectVerse, openPanel, journalCount }) {
    const [quiet, setQuiet] = useState(false);
    const quietTimer = useRef(null);
    const reduceMotion = useReducedMotion();
    const hasKeyboard = useHasKeyboard();
    const isMobile = useIsMobile();
    const hindi = settings.language === 'hi';
    const now = new Date();

    useEffect(() => () => clearTimeout(quietTimer.current), []);

    const notToday = () => {
        setQuiet(true);
        clearTimeout(quietTimer.current);
        quietTimer.current = setTimeout(() => setQuiet(false), 3600);
    };

    const rise = (delay = 0) => ({
        initial: reduceMotion ? false : { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    });

    return (
        <div className="home">
            <motion.header className="hero" {...rise(0)}>
                <span className="eyebrow">
                    {now.toLocaleDateString(hindi ? 'hi-IN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {settings.silentMode ? (
                    <>
                        <h1 className="hero__title">{greeting(now, settings.language)}.<br /><em>{hindi ? 'मौन में बैठें।' : 'Sit quietly.'}</em></h1>
                        <p className="hero__lede">{hindi ? 'मौन उपस्थिति चालू है — केवल श्लोक, कोई वार्तालाप नहीं।' : 'Silent Presence is on — only verses, without conversation.'}</p>
                    </>
                ) : (
                    <>
                        <h1 className="hero__title">
                            {greeting(now, settings.language)}.<br />
                            {hindi ? <>आज आपका <em>मन</em> कैसा है?</> : <>How is your heart <em>today</em>?</>}
                        </h1>
                        <p className="hero__lede">
                            {hindi
                                ? 'जो आप अनुभव कर रहे हैं उसे चुनें। गीता आपसे वहीं मिलेगी।'
                                : 'Choose what you are carrying. The Gita will meet you there.'}
                        </p>
                    </>
                )}
            </motion.header>

            <VerseCompanion language={settings.language} onSelectVerse={onSelectVerse} />

            <motion.section className="section" aria-label="Choose a feeling" {...rise(0.1)}>
                <AnimatePresence mode="wait" initial={false}>
                    {quiet ? (
                        <motion.div
                            key="quiet"
                            className="quiet-moment"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            role="status"
                        >
                            <div>
                                <p>That’s okay.</p>
                                <p>Silence can also be wisdom.</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="moods" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <MoodSelector onSelect={onSelectMood} />
                        </motion.div>
                    )}
                </AnimatePresence>
                {!quiet && (
                    <button type="button" className="btn btn--link not-today" onClick={notToday}>
                        {hindi ? 'आज नहीं' : 'Not today'}
                    </button>
                )}
            </motion.section>

            <DailyVerse language={settings.language} onSelectVerse={onSelectVerse} />

            <SavedLine />

            <motion.section className="section" aria-label="Explore" {...rise(0.2)}>
                <div className="explore-grid">
                    <button type="button" className="explore-card" onClick={() => openPanel('chapters')}>
                        <span className="explore-card__icon"><BookOpen size={18} /></span>
                        <span className="explore-card__text">
                            <strong>18 Chapters</strong>
                            <span>Read the Gita, chapter by chapter</span>
                        </span>
                        {hasKeyboard && <span className="kbd">C</span>}
                    </button>
                    <button type="button" className="explore-card" onClick={() => openPanel('search')}>
                        <span className="explore-card__icon"><Search size={18} /></span>
                        <span className="explore-card__text">
                            <strong>Wisdom Finder</strong>
                            <span>Search 701 verses by feeling</span>
                        </span>
                        {hasKeyboard && <span className="kbd">/</span>}
                    </button>
                    <button type="button" className="explore-card" onClick={() => openPanel('journal')}>
                        <span className="explore-card__icon"><Feather size={18} /></span>
                        <span className="explore-card__text">
                            <strong>Reflections</strong>
                            <span>{journalCount ? `${journalCount} kept privately` : 'Your private journal'}</span>
                        </span>
                        {hasKeyboard && <span className="kbd">J</span>}
                    </button>
                </div>
            </motion.section>

            {isMobile && <InstallCard />}

            <footer className="home-footer">
                <LotusMark size={28} className="home-footer__mark" />
                <p className="home-footer__motto">Peace is our only metric.</p>
                <p>No accounts · no tracking · everything stays on this device</p>
                {hasKeyboard && (
                    <p className="home-footer__keys">
                        <span><span className="kbd-group"><span className="kbd">{MOD_KEY}</span><span className="kbd">K</span></span> search anything</span>
                        <span><span className="kbd">J</span> journal</span>
                        <span><span className="kbd">C</span> chapters</span>
                        <span><span className="kbd">/</span> wisdom finder</span>
                    </p>
                )}
            </footer>
        </div>
    );
}

export default Home;
