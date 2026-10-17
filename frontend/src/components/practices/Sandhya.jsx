import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import PracticeSpace from './PracticeSpace';
import { Diya } from '../ui/Ornaments';
import { GUNAS, completeSandhya, qualityById, readDay } from '../../lib/day';
import { addReflection } from '../../lib/verse';
import { playChime } from '../../lib/chime';
import { haptic } from '../../lib/haptics';
import { celebrate } from '../../lib/celebrate';
import { useI18n } from '../../i18n';

// Sandhyā — the day's closing. A few gentle questions, each from the Gita,
// and nothing is required: any answer can be left blank.
function Sandhya({ isOpen, onClose }) {
    const { t, lang } = useI18n();
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState({ offered: '', held: '', release: '', guna: null, carried: null });
    const [day, setDay] = useState(readDay);

    useEffect(() => {
        if (!isOpen) return;
        setStep(0);
        setDay(readDay());
        setAnswers({ offered: '', held: '', release: '', guna: null, carried: null });
    }, [isOpen]);

    const quality = day.sankalpa && qualityById(day.sankalpa.quality);

    const steps = useMemo(() => [
        'intro',
        'offered',
        'held',
        'guna',
        ...(quality ? ['carried'] : []),
        'release',
        'close'
    ], [quality]);

    const current = steps[step];
    const set = (patch) => setAnswers((value) => ({ ...value, ...patch }));
    const next = () => setStep((value) => Math.min(steps.length - 1, value + 1));
    const back = () => setStep((value) => Math.max(0, value - 1));

    const finish = () => {
        completeSandhya(answers);
        const lines = [
            answers.offered && `${t('sandhya.offered.q')} ${answers.offered}`,
            answers.held && `${t('sandhya.held.q')} ${answers.held}`,
            answers.guna && `${t('sandhya.guna.q')} ${t(`guna.${answers.guna}.name`)}`,
            quality && answers.carried && `${t('sandhya.carried.q', { quality: lang === 'hi' ? quality.hi : quality.en })} ${t(`sandhya.carried.${answers.carried}`)}`,
            answers.release && `${t('sandhya.release.q')} ${answers.release}`
        ].filter(Boolean);
        if (lines.length) {
            addReflection({ citation: t('sandhya.citation'), verseText: t('sandhya.closingVerse'), note: lines.join('\n'), kind: 'sandhya' });
        } else {
            playChime('soft');
        }
        haptic('success');
        celebrate('full');
        next();
    };

    const textStep = (key) => (
        <>
            <p className="day-arc__question">{t(`sandhya.${key}.q`)}</p>
            <p className="day-arc__ref">{t(`sandhya.${key}.ref`)}</p>
            <textarea
                className="textarea textarea--paper"
                value={answers[key]}
                onChange={(event) => set({ [key]: event.target.value })}
                placeholder={t('sandhya.optional')}
                rows={4}
                autoFocus
            />
        </>
    );

    return (
        <PracticeSpace isOpen={isOpen} onClose={onClose} eyebrow={t('practice.sandhya.yoga')} title={t('practice.sandhya.title')} verseRef="9.27">
            <div className="day-arc day-arc--steps">
                <div className="day-arc__progress" aria-hidden="true">
                    {steps.map((name, index) => <span key={name} className={index <= step ? 'is-on' : ''} />)}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={current}
                        className="day-arc__step"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {current === 'intro' && (
                            <>
                                <Diya size={88} steady />
                                <p className="day-arc__question">{t('sandhya.intro')}</p>
                                <p className="day-arc__ref">{t('sandhya.introRef')}</p>
                            </>
                        )}

                        {current === 'offered' && textStep('offered')}
                        {current === 'held' && textStep('held')}
                        {current === 'release' && textStep('release')}

                        {current === 'guna' && (
                            <>
                                <p className="day-arc__question">{t('sandhya.guna.q')}</p>
                                <p className="day-arc__ref">{t('sandhya.guna.ref')}</p>
                                <div className="gunas">
                                    {GUNAS.map((guna) => (
                                        <button
                                            key={guna.id}
                                            type="button"
                                            className="guna"
                                            style={{ '--guna-rgb': guna.rgb }}
                                            aria-pressed={answers.guna === guna.id}
                                            onClick={() => set({ guna: answers.guna === guna.id ? null : guna.id })}
                                        >
                                            <span className="guna__sa" lang="sa">{guna.sa}</span>
                                            <strong>{t(`guna.${guna.id}.name`)}</strong>
                                            <span>{t(`guna.${guna.id}.desc`)}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="day-arc__note">{t('sandhya.guna.note')}</p>
                            </>
                        )}

                        {current === 'carried' && quality && (
                            <>
                                <p className="day-arc__question">{t('sandhya.carried.q', { quality: lang === 'hi' ? quality.hi : quality.en })}</p>
                                <p className="day-arc__ref devanagari" lang="sa">{quality.sa}</p>
                                <div className="chip-row chip-row--center">
                                    {['yes', 'partly', 'no'].map((value) => (
                                        <button key={value} type="button" className="chip" aria-pressed={answers.carried === value} onClick={() => set({ carried: value })}>
                                            {t(`sandhya.carried.${value}`)}
                                        </button>
                                    ))}
                                </div>
                                <p className="day-arc__note">{t('sandhya.carried.note')}</p>
                            </>
                        )}

                        {current === 'close' && (
                            <>
                                <Diya size={88} steady />
                                <p className="day-arc__closing">{t('sandhya.closingVerse')}</p>
                                <p className="day-arc__ref">{t('sandhya.closingRef')}</p>
                                <p className="day-arc__blessing">{t('sandhya.blessing')}</p>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="day-arc__nav">
                    {step > 0 && current !== 'close' ? (
                        <button type="button" className="btn btn--ghost" onClick={back}><ArrowLeft size={15} /> {t('common.back')}</button>
                    ) : <span />}
                    {current === 'close' ? (
                        <button type="button" className="btn btn--gold" onClick={onClose}>{t('sandhya.goodnight')}</button>
                    ) : current === 'release' ? (
                        <button type="button" className="btn btn--gold" onClick={finish}>{t('sandhya.finish')}</button>
                    ) : (
                        <button type="button" className="btn btn--gold" onClick={next}>
                            {current === 'intro' ? t('sandhya.begin') : t('common.next')} <ArrowRight size={15} />
                        </button>
                    )}
                </div>
            </div>
        </PracticeSpace>
    );
}

export default Sandhya;
