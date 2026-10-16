import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';

// A quiet 4-7-8 companion that breathes beside the conversation when
// "Breath companion" is on. Every phase change gets a light haptic; every
// completed cycle a soft bowl.

export const BREATH_PHASES = [
    { id: 'inhale', label: 'Inhale', seconds: 4 },
    { id: 'hold', label: 'Hold', seconds: 7 },
    { id: 'exhale', label: 'Exhale', seconds: 8 }
];

const SCALE = { inhale: 1, hold: 1, exhale: 0.62 };

function BreathCircle({ isActive }) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [cycles, setCycles] = useState(0);

    useEffect(() => {
        if (!isActive) return undefined;
        setPhaseIndex(0);
        let index = 0;
        let timer;

        const advance = () => {
            const next = (index + 1) % BREATH_PHASES.length;
            if (next === 0) {
                setCycles((count) => count + 1);
                playChime('soft');
                haptic('success');
            } else {
                haptic('breath');
            }
            index = next;
            setPhaseIndex(next);
            timer = setTimeout(advance, BREATH_PHASES[next].seconds * 1000);
        };

        timer = setTimeout(advance, BREATH_PHASES[0].seconds * 1000);
        return () => clearTimeout(timer);
    }, [isActive]);

    const phase = BREATH_PHASES[phaseIndex];

    return (
        <AnimatePresence>
            {isActive && (
                <motion.aside
                    className="breath-companion"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    aria-label={`Breath companion: ${phase.label}`}
                >
                    <div className="breath-companion__orb">
                        <motion.span
                            className="breath-companion__core"
                            initial={{ scale: SCALE.exhale }}
                            animate={{ scale: SCALE[phase.id] }}
                            transition={{ duration: phase.id === 'hold' ? 0.4 : phase.seconds, ease: [0.45, 0, 0.55, 1] }}
                        />
                    </div>
                    <div className="breath-companion__label">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={phase.id}
                                initial={{ opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                transition={{ duration: 0.3 }}
                            >
                                {phase.label} · {phase.seconds}
                            </motion.span>
                        </AnimatePresence>
                        {cycles > 0 && <small>{cycles} {cycles === 1 ? 'cycle' : 'cycles'}</small>}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export default BreathCircle;
