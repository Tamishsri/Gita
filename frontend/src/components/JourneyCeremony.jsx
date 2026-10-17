import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Feather, Image as ImageIcon, X } from 'lucide-react';
import { Diya } from './ui/Ornaments';
import { JOURNEY_DAYS, JOURNEY_LENGTH } from '../lib/journey';
import { verseMeaning, verseRef } from '../lib/verse';
import { useLayer } from '../lib/layers';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { useI18n } from '../i18n';

// The closing of a 7-day walk: three bowl strikes, rings of lamplight, and a
// gentle accounting of the week — with no judgement for missed days.
function JourneyCeremony({ journey, isOpen, onClose, onKeepInJournal, onRelease, onCreateCard, language = 'en' }) {
    const { t } = useI18n();
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
                    transition={{ duration: reduceMotion ? 0 : 0.9 }}
                >
                    <div className="ceremony__rings" aria-hidden="true">
                        {[0, 1, 2, 3].map((ring) => <span key={ring} style={{ animationDelay: `${ring * 1.75}s` }} />)}
                    </div>

                    <button type="button" className="icon-btn icon-btn--ring ceremony__close" onClick={onClose} aria-label={t('common.close')}>
                        <X size={18} />
                    </button>

                    <motion.div
                        className="ceremony__content"
                        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Diya size={110} steady />
                        <span className="eyebrow">{t('ceremony.eyebrow')}</span>
                        <h2 id="ceremony-title" className="ceremony__title">{t('ceremony.title1')}<br /><em>{t('ceremony.title2')}</em></h2>
                        <p className="ceremony__lede">
                            {t('ceremony.walked', { count: honoured, total: JOURNEY_LENGTH, ref: verseRef(journey.verse) })}
                            {' '}
                            {honoured < JOURNEY_LENGTH ? t('ceremony.between') : t('ceremony.every')}
                        </p>

                        <ol className="ceremony__days">
                            {JOURNEY_DAYS.map((day) => {
                                const done = Boolean(journey.checkIns[day.day]);
                                return (
                                    <li key={day.day} className={done ? 'is-done' : ''}>
                                        <span className="ceremony__day-dot">{done ? <Check size={12} strokeWidth={3} /> : day.day}</span>
                                        <span>{t(`journey.d${day.day}.title`)}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        <blockquote className={`ceremony__verse${language === 'hi' && journey.verse.meaning_hi ? ' translation--hi' : ''}`}>
                            {verseMeaning(journey.verse, language)}
                        </blockquote>

                        <p className="ceremony__blessing">
                            {t('ceremony.blessing')}
                            <span lang="sa">ॐ शान्तिः शान्तिः शान्तिः</span>
                        </p>

                        <div className="ceremony__actions">
                            <button type="button" className="btn btn--gold btn--lg" onClick={onKeepInJournal}>
                                <Feather size={16} /> {t('ceremony.keep')}
                            </button>
                            <button type="button" className="btn btn--outline" onClick={onCreateCard}>
                                <ImageIcon size={15} /> {t('ceremony.card')}
                            </button>
                            <button type="button" className="btn btn--link" onClick={onRelease}>{t('ceremony.release')}</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default JourneyCeremony;
