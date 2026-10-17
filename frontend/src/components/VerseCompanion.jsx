import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, PenLine, Sparkles } from 'lucide-react';
import JourneyCeremony from './JourneyCeremony';
import { PathGlyph } from './ui/Ornaments';
import {
    JOURNEY_DAYS, JOURNEY_EVENT, JOURNEY_LENGTH, checkInJourney, journeyStatus, readJourney, releaseJourney
} from '../lib/journey';
import { addReflection, openWisdomCard, verseMeaning, verseRef } from '../lib/verse';
import { recordPath } from '../lib/path';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { celebrate } from '../lib/celebrate';
import { toast } from '../lib/toast';
import { useI18n } from '../i18n';

// The 7-Day Walk tracker. Each calendar day opens a new contemplation; the
// walker honours it with a check-in (and an optional note that also goes to
// the journal). Honouring Day 7 opens the completion ceremony.
function VerseCompanion({ language = 'en', onSelectVerse }) {
    const { t } = useI18n();
    const [journey, setJourney] = useState(readJourney);
    const [expanded, setExpanded] = useState(null);
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState('');
    const [confirmRelease, setConfirmRelease] = useState(false);
    const [ceremonyOpen, setCeremonyOpen] = useState(false);
    const [justHonoured, setJustHonoured] = useState(null);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        let last = localStorage.getItem('verseCompanion');
        const update = () => {
            last = localStorage.getItem('verseCompanion');
            setJourney(readJourney());
        };
        // A new calendar day may begin while the app stays open.
        const checkMidnight = setInterval(() => {
            const raw = localStorage.getItem('verseCompanion');
            if (raw !== last) update();
            else setJourney((current) => (current ? { ...current } : current));
        }, 5 * 60 * 1000);
        window.addEventListener(JOURNEY_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(JOURNEY_EVENT, update);
            window.removeEventListener('storage', update);
            clearInterval(checkMidnight);
        };
    }, []);

    if (!journey) return null;

    const status = journeyStatus(journey);
    const { day, checkedToday, checkedCount, isComplete, isOverdue } = status;
    const theme = JOURNEY_DAYS[day - 1];
    const isOpen = expanded ?? !(checkedToday || isComplete);
    const hasNext = day < JOURNEY_LENGTH;
    const meaning = verseMeaning(journey.verse, language);
    const d = (n, field) => t(`journey.d${n}.${field}`);

    const honour = () => {
        const trimmed = note.trim();
        checkInJourney(day, trimmed);
        recordPath('walk', { verseId: journey.verse.id, day });
        if (trimmed) {
            addReflection({
                verse: journey.verse,
                citation: t('journey.noteCitation', { day, title: d(day, 'title'), ref: verseRef(journey.verse) }),
                verseText: meaning,
                note: trimmed,
                kind: 'journey'
            });
        } else {
            playChime('soft');
            haptic('success');
        }
        setJustHonoured(day);
        celebrate(day === JOURNEY_LENGTH ? 'full' : 'gentle');
        setNote('');
        setNoteOpen(false);
        if (day === JOURNEY_LENGTH) {
            setTimeout(() => setCeremonyOpen(true), 500);
        } else {
            toast(t('journey.honouredToast', { day, next: d(day + 1, 'title') }), { icon: 'walk', tone: 'gold' });
        }
    };

    const release = (message = t('journey.released')) => {
        releaseJourney();
        setCeremonyOpen(false);
        setConfirmRelease(false);
        toast(message, { icon: 'walk' });
    };

    const keepInJournal = () => {
        const notes = JOURNEY_DAYS
            .filter((entry) => journey.checkIns[entry.day]?.note)
            .map((entry) => `${t('journey.dayN', { day: entry.day })} · ${d(entry.day, 'title')} — ${journey.checkIns[entry.day].note}`);
        addReflection({
            verse: journey.verse,
            citation: t('journey.completeCitation', { ref: verseRef(journey.verse) }),
            verseText: meaning,
            note: notes.length ? notes.join('\n') : t('journey.completeNote', { count: Object.keys(journey.checkIns).length }),
            kind: 'journey'
        });
        release(t('journey.keptReleased'));
    };

    return (
        <motion.section
            className={`journey card card--featured${isComplete ? ' is-complete' : ''}`}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            aria-label={t('journey.label')}
        >
            <button type="button" className="journey__head" onClick={() => setExpanded(!isOpen)} aria-expanded={isOpen}>
                <span className="journey__titles">
                    <span className="eyebrow">
                        <PathGlyph size={16} />
                        {isComplete ? t('journey.eyebrowComplete') : t('journey.eyebrow', { day, total: JOURNEY_LENGTH })}
                    </span>
                    <span className="journey__title">{isComplete ? t('journey.completeTitle') : d(day, 'title')}</span>
                    <span className="journey__theme">
                        {isComplete ? `${t('verse.bg')} ${verseRef(journey.verse)}` : d(day, 'theme')}
                    </span>
                </span>
                <ChevronDown size={18} className="journey__chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
            </button>

            <ol className="journey__days" aria-label={t('journey.days')}>
                {JOURNEY_DAYS.map((entry) => {
                    const done = Boolean(journey.checkIns[entry.day]);
                    const state = done ? 'done' : entry.day === day && !isComplete ? 'today' : entry.day < day ? 'missed' : 'ahead';
                    return (
                        <li key={entry.day} className={`journey__day is-${state}${justHonoured === entry.day ? ' is-fresh' : ''}`} title={`${t('journey.dayN', { day: entry.day })} · ${d(entry.day, 'title')}`}>
                            <span className="journey__dot">{done ? <Check size={12} strokeWidth={3} /> : entry.day}</span>
                            <span className="journey__day-label">{d(entry.day, 'short')}</span>
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
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {isComplete ? (
                            <div className="journey__complete">
                                <p>{t('journey.completeBody')}</p>
                                <div className="journey__row">
                                    <button type="button" className="btn btn--gold btn--sm" onClick={() => setCeremonyOpen(true)}>
                                        <Sparkles size={14} /> {t('journey.openCeremony')}
                                    </button>
                                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => release()}>{t('journey.release')}</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="journey__concept">
                                    <span className="devanagari" lang="sa">{theme.concept}</span>
                                    <span className="iast">{theme.conceptIast} — {d(day, 'conceptGloss')}</span>
                                </div>
                                <p className="journey__contemplation">{d(day, 'contemplation')}</p>
                                <div className="journey__practice">
                                    <span className="eyebrow eyebrow--muted">{t('journey.todaysPractice')}</span>
                                    <p>{d(day, 'practice')}</p>
                                </div>

                                <figure className="journey__verse">
                                    <blockquote className={language === 'hi' && journey.verse.meaning_hi ? 'translation--hi' : ''}>{meaning}</blockquote>
                                    <figcaption>
                                        {t('verse.bg')} {verseRef(journey.verse)}
                                        {onSelectVerse && (
                                            <button type="button" className="btn btn--link btn--sm" onClick={() => onSelectVerse(journey.verse)}>{t('verse.sitWith')}</button>
                                        )}
                                        <button type="button" className="btn btn--link btn--sm" onClick={() => openWisdomCard(journey.verse, language)}>{t('verse.card')}</button>
                                    </figcaption>
                                </figure>

                                {isOverdue && !checkedToday && <p className="journey__notice">{t('journey.overdue')}</p>}

                                {checkedToday ? (
                                    <div className="journey__honoured">
                                        <span className="journey__honoured-icon"><Check size={14} strokeWidth={3} /></span>
                                        <span>
                                            {t('journey.honoured', { day })}
                                            {hasNext && <> {t('journey.returnFor')} <strong>{d(day + 1, 'title')}</strong>.</>}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="journey__checkin">
                                        <AnimatePresence initial={false}>
                                            {noteOpen && (
                                                <motion.textarea
                                                    className="textarea textarea--paper"
                                                    value={note}
                                                    onChange={(event) => setNote(event.target.value)}
                                                    placeholder={t('journey.notePlaceholder')}
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
                                                    <PenLine size={14} /> {t('journey.addNote')}
                                                </button>
                                            )}
                                            <button type="button" className="btn btn--gold" onClick={honour}>
                                                <Check size={15} />
                                                {day === JOURNEY_LENGTH ? t('journey.honourLast') : t('journey.honour', { day })}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <footer className="journey__foot">
                            <span>{t('journey.count', { count: checkedCount, total: JOURNEY_LENGTH })}</span>
                            {confirmRelease ? (
                                <span className="journey__confirm">
                                    {t('journey.releaseConfirm')}
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => release()}>{t('journey.release')}</button>
                                    <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmRelease(false)}>{t('journey.keepWalking')}</button>
                                </span>
                            ) : (
                                !isComplete && <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmRelease(true)}>{t('journey.releaseWalk')}</button>
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
                onRelease={() => release(t('journey.releasedGratitude'))}
                onCreateCard={() => {
                    setCeremonyOpen(false);
                    openWisdomCard(journey.verse, language);
                }}
            />
        </motion.section>
    );
}

export default VerseCompanion;
