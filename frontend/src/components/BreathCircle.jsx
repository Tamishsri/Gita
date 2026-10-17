import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Diya } from './ui/Ornaments';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { useI18n } from '../i18n';

// A quiet 4-7-8 companion beside the conversation when "Breath companion" is
// on: the lamp's flame rises and falls with the breath. Each phase change gets
// a light haptic; each completed cycle, a soft bowl.

export const BREATH_PHASES = [
    { id: 'inhale', seconds: 4, flame: 1 },
    { id: 'hold', seconds: 7, flame: 1 },
    { id: 'exhale', seconds: 8, flame: 0.62 }
];

function BreathCircle({ isActive }) {
    const { t } = useI18n();
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
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    aria-label={`${t('breaths.companion')}: ${t(`breaths.${phase.id}`)}`}
                >
                    <div className="breath-companion__orb">
                        <Diya size={44} steady={phase.id === 'hold'} flame={phase.flame} />
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
                                {t(`breaths.${phase.id}`)} · {phase.seconds}
                            </motion.span>
                        </AnimatePresence>
                        {cycles > 0 && <small>{t('breaths.cycles', { count: cycles })}</small>}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export default BreathCircle;
