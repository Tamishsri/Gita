import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, Undo2 } from 'lucide-react';
import PracticeSpace from './PracticeSpace';
import { playChime } from '../../lib/chime';
import { haptic } from '../../lib/haptics';
import { celebrate } from '../../lib/celebrate';
import { recordPath, localDateKey } from '../../lib/path';
import { transliterate } from '../../lib/script';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useI18n } from '../../i18n';

// Japa — "of offerings, I am the offering of japa" (10.25).
// A mala of 108 beads and the meru; one tap (or Space) moves one bead.

const BEADS = 108;
const STATE_KEY = 'lgJapa';

export const MANTRAS = [
    { id: 'om', sa: 'ॐ', iast: 'oṃ', ref: '8.13' },
    { id: 'vasudeva', sa: 'ॐ नमो भगवते वासुदेवाय', iast: 'oṃ namo bhagavate vāsudevāya', ref: '7.19' },
    { id: 'sharanam', sa: 'श्रीकृष्णः शरणं मम', iast: 'śrī-kṛṣṇaḥ śaraṇaṃ mama', ref: '18.66' },
    { id: 'harekrishna', sa: 'हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे । हरे राम हरे राम राम राम हरे हरे ॥', iast: 'hare kṛṣṇa hare kṛṣṇa kṛṣṇa kṛṣṇa hare hare, hare rāma hare rāma rāma rāma hare hare', ref: null },
    { id: 'breath', sa: null, iast: null, ref: '4.29' }
];

function readState() {
    try {
        const state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
        if (state && state.date === localDateKey()) return state;
        if (state) return { date: localDateKey(), mantra: state.mantra || 'om', count: 0, rounds: 0 };
    } catch {
        // start fresh
    }
    return { date: localDateKey(), mantra: 'om', count: 0, rounds: 0 };
}

function Japa({ isOpen, onClose }) {
    const { t } = useI18n();
    const { script } = usePreferences();
    const [state, setState] = useState(readState);
    const [justCompleted, setJustCompleted] = useState(false);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (isOpen) setState(readState());
    }, [isOpen]);

    useEffect(() => {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }, [state]);

    const mantra = MANTRAS.find((item) => item.id === state.mantra) || MANTRAS[0];

    // A ref keeps rapid taps exact and keeps sounds out of state updaters.
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const commit = (next) => {
        stateRef.current = next;
        setState(next);
    };

    const bead = useCallback(() => {
        const current = stateRef.current;
        const count = current.count + 1;
        if (count >= BEADS) {
            playChime('bowl');
            haptic('ceremony');
            recordPath('japa', { beads: BEADS, mantra: current.mantra });
            setJustCompleted(true);
            celebrate('full');
            setTimeout(() => setJustCompleted(false), 4200);
            commit({ ...current, count: 0, rounds: current.rounds + 1 });
            return;
        }
        playChime('tick');
        haptic('soft');
        commit({ ...current, count });
    }, []);

    const undo = () => commit({ ...stateRef.current, count: Math.max(0, stateRef.current.count - 1) });
    const restart = () => commit({ ...stateRef.current, count: 0 });

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (event) => {
            if (event.target instanceof HTMLElement && event.target.closest('button, select')) return;
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
                event.preventDefault();
                bead();
            } else if (event.key === 'Backspace' || event.key === 'ArrowLeft') {
                event.preventDefault();
                undo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, bead]);

    // Beads around a circle, the meru at the top.
    const beads = useMemo(() => Array.from({ length: BEADS }, (_, i) => {
        const angle = ((i + 0.5) / BEADS) * Math.PI * 2 - Math.PI / 2;
        return { x: 150 + Math.cos(angle) * 128, y: 150 + Math.sin(angle) * 128 };
    }), []);

    const mantraText = mantra.sa ? transliterate(mantra.sa, script, mantra.iast) : null;

    return (
        <PracticeSpace isOpen={isOpen} onClose={onClose} eyebrow={t('practice.japa.yoga')} title={t('practice.japa.title')} verseRef="10.25">
            <div className="japa">
                <div className="japa__mantras" role="group" aria-label={t('japa.mantra')}>
                    {MANTRAS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="chip"
                            aria-pressed={state.mantra === item.id}
                            onClick={() => commit({ ...stateRef.current, mantra: item.id })}
                        >
                            {t(`japa.mantra.${item.id}`)}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    className="japa__mala"
                    onClick={bead}
                    aria-label={t('japa.tap', { count: state.count, total: BEADS })}
                    data-haptic="off"
                >
                    <svg viewBox="0 0 300 300" aria-hidden="true">
                        {beads.map((position, index) => (
                            <circle
                                key={index}
                                cx={position.x}
                                cy={position.y}
                                r={index === state.count ? 5.2 : 3.4}
                                className={`japa__bead${index < state.count ? ' is-told' : ''}${index === state.count ? ' is-current' : ''}`}
                            />
                        ))}
                        <circle cx="150" cy="15" r="7" className="japa__meru" />
                        <path d="M150 22 L150 38" className="japa__tassel" />
                    </svg>
                    <span className="japa__center">
                        {mantraText ? (
                            <span className={`japa__mantra sanskrit${mantraText.length > 30 ? ' is-long' : ''}`}>{mantraText}</span>
                        ) : (
                            <span className="japa__mantra japa__mantra--breath">{t('japa.breathOnly')}</span>
                        )}
                        <motion.span
                            key={state.count}
                            className="japa__count"
                            initial={reduceMotion ? false : { opacity: 0.4, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            {state.count}<small> / {BEADS}</small>
                        </motion.span>
                    </span>
                </button>

                <p className="japa__hint" aria-live="polite">
                    {justCompleted
                        ? t('japa.roundComplete', { count: state.rounds })
                        : t('japa.hint')}
                </p>

                <div className="japa__footer">
                    <span className="faint">{t('japa.rounds', { count: state.rounds })}</span>
                    <div className="text-actions">
                        <button type="button" className="text-action" onClick={undo} disabled={!state.count}>
                            <Undo2 size={14} /> {t('japa.undo')}
                        </button>
                        <button type="button" className="text-action" onClick={restart} disabled={!state.count}>
                            <RotateCcw size={14} /> {t('japa.restart')}
                        </button>
                    </div>
                </div>
            </div>
        </PracticeSpace>
    );
}

export default Japa;
