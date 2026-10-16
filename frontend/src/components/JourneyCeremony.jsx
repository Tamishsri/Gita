import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Feather, Image as ImageIcon, X } from 'lucide-react';
import LotusMark from './ui/LotusMark';
import { JOURNEY_DAYS, JOURNEY_LENGTH } from '../lib/journey';
import { verseMeaning, verseRef } from '../lib/verse';
import { useLayer } from '../lib/layers';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';

// The closing of a 7-day walk: three bowl strikes, expanding rings of light,
// and a gentle accounting of the week — with no judgement for missed days.
function JourneyCeremony({ journey, isOpen, onClose, onKeepInJournal, onRelease, onCreateCard, language = 'en' }) {
    const reduceMotion = useReducedMotion();
    useLayer(isOpen, { onEscape: onClose, blocksHotkeys: true });

    useEffect(() => {
        if (!isOpen) return;
        playChime('ceremony');
        haptic('ceremony');
    }, [isOpen]);

    const honoured = journey ? Object.keys(journey.checkIns).length : 0;

    return createPortal(
        <AnimatePresence>
            {isOpen && journey && (
                <motion.div
                    className="ceremony"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ceremony-title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.8 }}
                >
                    <div className="ceremony__rings" aria-hidden="true">
                        {[0, 1, 2, 3].map((ring) => (
                            <span key={ring} style={{ animationDelay: `${ring * 1.6}s` }} />
                        ))}
                    </div>

                    <button type="button" className="icon-btn ceremony__close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>

                    <motion.div
                        className="ceremony__content"
                        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.span
                            className="ceremony__mark"
                            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <LotusMark size={76} ring />
                        </motion.span>

                        <span className="eyebrow">The circle is complete</span>
                        <h2 id="ceremony-title" className="ceremony__title">Seven days. One verse.<br /><em>A quieter mind.</em></h2>
                        <p className="ceremony__lede">
                            You walked {honoured} of {JOURNEY_LENGTH} days with Bhagavad Gita {verseRef(journey.verse)}.
                            {honoured < JOURNEY_LENGTH ? ' The days in between were part of the path too.' : ' Every single day, honoured.'}
                        </p>

                        <ol className="ceremony__days">
                            {JOURNEY_DAYS.map((day) => {
                                const done = Boolean(journey.checkIns[day.day]);
                                return (
                                    <li key={day.day} className={done ? 'is-done' : ''}>
                                        <span className="ceremony__day-dot">{done ? <Check size={12} strokeWidth={3} /> : day.day}</span>
                                        <span>{day.title}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        <blockquote className={`ceremony__verse${language === 'hi' && journey.verse.meaning_hi ? ' translation--hi' : ''}`}>
                            {verseMeaning(journey.verse, language)}
                        </blockquote>

                        <p className="ceremony__blessing">
                            May this wisdom keep walking with you.
                            <span lang="sa">ॐ शान्तिः शान्तिः शान्तिः</span>
                        </p>

                        <div className="ceremony__actions">
                            <button type="button" className="btn btn--gold btn--lg" onClick={onKeepInJournal}>
                                <Feather size={16} />
                                Keep in journal &amp; release
                            </button>
                            <button type="button" className="btn btn--outline" onClick={onCreateCard}>
                                <ImageIcon size={15} />
                                Create a wisdom card
                            </button>
                            <button type="button" className="btn btn--link" onClick={onRelease}>
                                Release with gratitude
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default JourneyCeremony;
