import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PracticeSpace from './PracticeSpace';
import { QUALITIES, readDay, setSankalpa } from '../../lib/day';
import { playChime } from '../../lib/chime';
import { haptic } from '../../lib/haptics';
import { celebrate } from '../../lib/celebrate';
import { toast } from '../../lib/toast';
import { useI18n } from '../../i18n';

// Saṅkalpa — a morning intention: one of the qualities Krishna calls the
// "divine wealth" (16.1–3), carried through the day and remembered at dusk.
function Sankalpa({ isOpen, onClose }) {
    const { t, lang } = useI18n();
    const [choice, setChoice] = useState(null);
    const [note, setNote] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const day = readDay();
        setChoice(day.sankalpa?.quality || null);
        setNote(day.sankalpa?.note || '');
    }, [isOpen]);

    const confirm = () => {
        if (!choice) return;
        setSankalpa(choice, note);
        playChime('soft');
        haptic('success');
        celebrate('gentle');
        const quality = QUALITIES.find((item) => item.id === choice);
        toast(t('sankalpa.set', { quality: lang === 'hi' ? quality.hi : quality.en }), { icon: 'heart', tone: 'gold' });
        onClose();
    };

    return (
        <PracticeSpace isOpen={isOpen} onClose={onClose} eyebrow={t('practice.sankalpa.yoga')} title={t('practice.sankalpa.title')} verseRef="16.1–3">
            <div className="day-arc">
                <p className="day-arc__lede">{t('sankalpa.lede')}</p>
                <ul className="qualities">
                    {QUALITIES.map((quality, index) => (
                        <motion.li
                            key={quality.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.03 * index, duration: 0.5 }}
                        >
                            <button
                                type="button"
                                className="quality"
                                aria-pressed={choice === quality.id}
                                onClick={() => setChoice(quality.id)}
                            >
                                <span className="quality__sa" lang="sa">{quality.sa}</span>
                                <span className="quality__name">{lang === 'hi' ? quality.hi : quality.en}</span>
                                <span className="quality__iast">{quality.iast}</span>
                            </button>
                        </motion.li>
                    ))}
                </ul>
                <label className="day-arc__field">
                    <span className="eyebrow eyebrow--muted">{t('sankalpa.noteLabel')}</span>
                    <input
                        className="input"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={t('sankalpa.notePlaceholder')}
                        maxLength={200}
                    />
                </label>
                <button type="button" className="btn btn--gold btn--lg" onClick={confirm} disabled={!choice}>
                    {t('sankalpa.confirm')}
                </button>
            </div>
        </PracticeSpace>
    );
}

export default Sankalpa;
