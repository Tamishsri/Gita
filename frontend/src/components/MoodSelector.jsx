import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CloudRain, Mountain, Flame, Compass, Sunrise, HandHeart, Droplets, Moon } from 'lucide-react';
import { useI18n } from '../i18n';

// Each mood carries a soothing counter-colour (rgb) that also tints the
// lamplight once chosen — see useUserAura.
export const MOODS = [
    { id: 'anxious', icon: CloudRain, rgb: '120, 186, 176' },
    { id: 'stressed', icon: Mountain, rgb: '150, 188, 150' },
    { id: 'angry', icon: Flame, rgb: '120, 156, 218' },
    { id: 'confused', icon: Compass, rgb: '170, 152, 216' },
    { id: 'sad', icon: Droplets, rgb: '140, 160, 214' },
    { id: 'lonely', icon: Moon, rgb: '196, 160, 210' },
    { id: 'peace', icon: Sunrise, rgb: '232, 178, 92' },
    { id: 'happy', icon: HandHeart, rgb: '226, 156, 120' }
];

export const moodById = (id) => MOODS.find((mood) => mood.id === id);

// "Today, my heart is — anxious · weighed down · angry · …"
function MoodSelector({ onSelect }) {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();

    return (
        <ul className="mood-words">
            {MOODS.map((mood, index) => (
                <motion.li
                    key={mood.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                    <button
                        type="button"
                        className="mood-word"
                        style={{ '--tile-rgb': mood.rgb }}
                        onClick={() => onSelect(mood.id)}
                        title={t(`mood.${mood.id}.hint`)}
                    >
                        {t(`mood.${mood.id}.word`)}
                    </button>
                </motion.li>
            ))}
        </ul>
    );
}

export default MoodSelector;
