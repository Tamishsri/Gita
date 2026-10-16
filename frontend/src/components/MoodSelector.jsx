import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CloudRain, Mountain, Flame, Compass, Sunrise, HandHeart } from 'lucide-react';

// Each mood carries a soothing counter-colour (rgb) that also tints the sky
// once chosen — see useUserAura.
export const MOODS = [
    { id: 'anxious', label: 'Anxious', hindi: 'चिंतित', hint: 'A restless, racing mind', icon: CloudRain, rgb: '110, 184, 172' },
    { id: 'stressed', label: 'Stressed', hindi: 'तनावग्रस्त', hint: 'Carrying too much at once', icon: Mountain, rgb: '140, 186, 146' },
    { id: 'angry', label: 'Angry', hindi: 'क्रोधित', hint: 'A fire that needs cooling', icon: Flame, rgb: '104, 146, 214' },
    { id: 'confused', label: 'Confused', hindi: 'उलझन में', hint: 'Searching for direction', icon: Compass, rgb: '164, 146, 214' },
    { id: 'peace', label: 'Seeking Peace', hindi: 'शांति की खोज', hint: 'Longing for stillness', icon: Sunrise, rgb: '212, 175, 55' },
    { id: 'happy', label: 'Grateful', hindi: 'कृतज्ञ', hint: 'A heart that is full', icon: HandHeart, rgb: '222, 152, 118' }
];

export const moodById = (id) => MOODS.find((mood) => mood.id === id);

function MoodSelector({ onSelect }) {
    const reduceMotion = useReducedMotion();

    return (
        <div className="mood-grid" role="list">
            {MOODS.map((mood, index) => {
                const Icon = mood.icon;
                return (
                    <motion.button
                        key={mood.id}
                        type="button"
                        role="listitem"
                        className="mood-tile"
                        style={{ '--tile-rgb': mood.rgb }}
                        onClick={() => onSelect(mood.id)}
                        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        whileTap={{ scale: 0.97 }}
                        aria-label={`${mood.label} — ${mood.hint}`}
                    >
                        <span className="mood-tile__medallion" aria-hidden="true">
                            <Icon size={20} strokeWidth={1.6} />
                        </span>
                        <span className="mood-tile__label">{mood.label}</span>
                        <span className="mood-tile__hindi" lang="hi">{mood.hindi}</span>
                        <span className="mood-tile__hint">{mood.hint}</span>
                    </motion.button>
                );
            })}
        </div>
    );
}

export default MoodSelector;
