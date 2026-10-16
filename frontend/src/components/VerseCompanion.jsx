import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Footprints, PenLine, Sparkles } from 'lucide-react';
import JourneyCeremony from './JourneyCeremony';
import {
    JOURNEY_DAYS, JOURNEY_EVENT, JOURNEY_LENGTH, checkInJourney, journeyStatus, readJourney, releaseJourney
} from '../lib/journey';
import { addReflection, openWisdomCard, verseMeaning, verseRef } from '../lib/verse';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';

// The 7-Day Walk tracker. Each calendar day opens a new contemplation; the
// walker honours it with a check-in (and an optional note that also goes to
// the journal). Honouring Day 7 opens the completion ceremony.
function VerseCompanion({ language = 'en', onSelectVerse }) {
    const [journey, setJourney] = useState(readJourney);
    const [expanded, setExpanded] = useState(null);
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState('');
    const [confirmRelease, setConfirmRelease] = useState(false);
    const [ceremonyOpen, setCeremonyOpen] = useState(false);
    const [justHonoured, setJustHonoured] = useState(null);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const update = () => setJourney(readJourney());
        window.addEventListener(JOURNEY_EVENT, update);
        window.addEventListener('storage', update);
        // A new calendar day may begin while the app stays open.
        const midnight = setInterval(update, 60 * 1000);
        return () => {
            window.removeEventListener(JOURNEY_EVENT, update);
            window.removeEventListener('storage', update);
            clearInterval(midnight);
        };
    }, []);

    if (!journey) return null;

    const status = journeyStatus(journey);
    const { day, theme, checkedToday, checkedCount, isComplete, isOverdue } = status;
    const isOpen = expanded ?? !(checkedToday || isComplete);
    const nextTheme = JOURNEY_DAYS[day] || null;
    const meaning = verseMeaning(journey.verse, language);

    const honour = () => {
        const trimmed = note.trim();
        checkInJourney(day, trimmed);
        if (trimmed) {
            addReflection({
                verse: journey.verse,
                citation: `7-Day Walk · Day ${day}: ${theme.title} — BG ${verseRef(journey.verse)}`,
                verseText: meaning,
                note: trimmed,
                kind: 'journey'
            });
        } else {
            playChime('soft');
            haptic('success');
        }
        setJustHonoured(day);
        setNote('');
        setNoteOpen(false);
        if (day === JOURNEY_LENGTH) {
            setTimeout(() => setCeremonyOpen(true), 500);
        } else {
            toast(`Day ${day} honoured. ${nextTheme ? `Tomorrow: ${nextTheme.title}.` : ''}`, { icon: 'walk', tone: 'gold' });
        }
    };

    const release = (message = 'Your walk has been released with gratitude.') => {
        releaseJourney();
        setCeremonyOpen(false);
        setConfirmRelease(false);
        toast(message, { icon: 'walk' });
    };

    const keepInJournal = () => {
        const notes = JOURNEY_DAYS
            .filter((entry) => journey.checkIns[entry.day]?.note)
            .map((entry) => `Day ${entry.day} · ${entry.title} — ${journey.checkIns[entry.day].note}`);
        addReflection({
            verse: journey.verse,
            citation: `Completed 7-Day Walk — BG ${verseRef(journey.verse)}`,
            verseText: meaning,
            note: notes.length
                ? notes.join('\n')
                : `Walked ${Object.keys(journey.checkIns).length} of 7 days with this verse, from witnessing to release.`,
            kind: 'journey'
        });
        release('Your walk is kept in the journal, and released. ॐ शान्तिः');
    };

    return (
        <motion.section
            className={`journey card card--featured${isComplete ? ' is-complete' : ''}`}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Your 7-day walk"
        >
            <button
                type="button"
                className="journey__head"
                onClick={() => setExpanded(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="journey__titles">
                    <span className="eyebrow">
                        <Footprints size={13} />
                        {isComplete ? '7-Day Walk · Complete' : `7-Day Walk · Day ${day} of ${JOURNEY_LENGTH}`}
                    </span>
                    <span className="journey__title">{isComplete ? 'The circle is complete' : theme.title}</span>
                    <span className="journey__theme">
                        {isComplete ? `Bhagavad Gita ${verseRef(journey.verse)}` : theme.theme}
                    </span>
                </span>
                <ChevronDown size={18} className="journey__chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
            </button>

            <ol className="journey__days" aria-label="Days of the walk">
                {JOURNEY_DAYS.map((entry) => {
                    const done = Boolean(journey.checkIns[entry.day]);
                    const state = done
                        ? 'done'
                        : entry.day === day && !isComplete
                            ? 'today'
                            : entry.day < day
                                ? 'missed'
                                : 'ahead';
                    return (
                        <li key={entry.day} className={`journey__day is-${state}${justHonoured === entry.day ? ' is-fresh' : ''}`} title={`Day ${entry.day} · ${entry.title}${done ? ' — honoured' : ''}`}>
                            <span className="journey__dot">
                                {done ? <Check size={12} strokeWidth={3} /> : entry.day}
                            </span>
                            <span className="journey__day-label">{entry.short}</span>
                        </li>
                    );
                })}
            </ol>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        className="journey__body"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {isComplete ? (
                            <div className="journey__complete">
                                <p>You have walked with this verse for seven days. Carry what it taught you, and release it when you are ready.</p>
                                <div className="journey__row">
                                    <button type="button" className="btn btn--gold btn--sm" onClick={() => setCeremonyOpen(true)}>
                                        <Sparkles size={14} /> Open the ceremony
                                    </button>
                                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => release()}>Release</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="journey__concept">
                                    <span className="devanagari" lang="sa">{theme.concept}</span>
                                    <span className="iast">{theme.conceptIast}</span>
                                </div>
                                <p className="journey__contemplation">{theme.contemplation}</p>
                                <div className="journey__practice">
                                    <span className="eyebrow eyebrow--muted">Today’s practice</span>
                                    <p>{theme.practice}</p>
                                </div>

                                <figure className="journey__verse">
                                    <blockquote className={language === 'hi' && journey.verse.meaning_hi ? 'translation--hi' : ''}>{meaning}</blockquote>
                                    <figcaption>
                                        Bhagavad Gita {verseRef(journey.verse)}
                                        {onSelectVerse && (
                                            <button type="button" className="btn btn--link btn--sm" onClick={() => onSelectVerse(journey.verse)}>Sit with it</button>
                                        )}
                                        <button type="button" className="btn btn--link btn--sm" onClick={() => openWisdomCard(journey.verse, language)}>Card</button>
                                    </figcaption>
                                </figure>

                                {isOverdue && !checkedToday && (
                                    <p className="journey__notice">Your seven days have passed. Close the circle whenever you are ready.</p>
                                )}

                                {checkedToday ? (
                                    <div className="journey__honoured">
                                        <span className="journey__honoured-icon"><Check size={14} strokeWidth={3} /></span>
                                        <span>
                                            Day {day} honoured.
                                            {nextTheme && <> Return tomorrow for <strong>{nextTheme.title}</strong>.</>}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="journey__checkin">
                                        <AnimatePresence initial={false}>
                                            {noteOpen && (
                                                <motion.textarea
                                                    className="textarea"
                                                    value={note}
                                                    onChange={(event) => setNote(event.target.value)}
                                                    placeholder="What did you notice today? This also goes to your journal."
                                                    rows={3}
                                                    autoFocus
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        <div className="journey__row">
                                            {!noteOpen && (
                                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNoteOpen(true)}>
                                                    <PenLine size={14} /> Add a note
                                                </button>
                                            )}
                                            <button type="button" className="btn btn--gold" onClick={honour}>
                                                <Check size={15} />
                                                {day === JOURNEY_LENGTH ? 'Honour Day 7 & close the circle' : `Honour Day ${day}`}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <footer className="journey__foot">
                            <span>{checkedCount} of {JOURNEY_LENGTH} days honoured</span>
                            {confirmRelease ? (
                                <span className="journey__confirm">
                                    Release this walk?
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => release()}>Release</button>
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmRelease(false)}>Keep walking</button>
                                </span>
                            ) : (
                                !isComplete && (
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmRelease(true)}>Release walk</button>
                                )
                            )}
                        </footer>
                    </motion.div>
                )}
            </AnimatePresence>

            <JourneyCeremony
                journey={journey}
                isOpen={ceremonyOpen}
                language={language}
                onClose={() => setCeremonyOpen(false)}
                onKeepInJournal={keepInJournal}
                onRelease={() => release('Released with gratitude. ॐ शान्तिः')}
                onCreateCard={() => {
                    setCeremonyOpen(false);
                    openWisdomCard(journey.verse, language);
                }}
            />
        </motion.section>
    );
}

export default VerseCompanion;
