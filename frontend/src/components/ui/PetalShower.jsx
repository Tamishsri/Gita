import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { CELEBRATE_EVENT } from '../../lib/celebrate';

// Marigold, deep marigold, lotus pink, jasmine — the flowers of an offering.
const PETALS = [
    { fill: '#f2a23a', stroke: '#d9861f' },
    { fill: '#e8811c', stroke: '#c96a10' },
    { fill: '#f6c25a', stroke: '#dba53a' },
    { fill: '#e46b8c', stroke: '#c9506f' },
    { fill: '#fff6e6', stroke: '#e3c79a' }
];

const COUNT = { full: 34, gentle: 14 };

function makePetals(intensity, seed) {
    let state = seed % 2147483647 || 1;
    const random = () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
    return Array.from({ length: COUNT[intensity] || COUNT.full }, (_, index) => {
        const petal = PETALS[Math.floor(random() * PETALS.length)];
        return {
            key: `${seed}-${index}`,
            ...petal,
            left: random() * 100,
            size: 12 + random() * 12,
            drift: (random() - 0.5) * 160,
            spin: (random() > 0.5 ? 1 : -1) * (180 + random() * 360),
            duration: 2.8 + random() * 1.8,
            delay: random() * (intensity === 'gentle' ? 0.5 : 0.9)
        };
    });
}

// One shower at a time; a new celebration replaces the last.
function PetalShower() {
    const reduceMotion = useReducedMotion();
    const [shower, setShower] = useState(null);

    useEffect(() => {
        const onCelebrate = (event) => {
            if (reduceMotion) return;
            const { intensity = 'full', id } = event.detail || {};
            setShower({ id, petals: makePetals(intensity, id) });
        };
        window.addEventListener(CELEBRATE_EVENT, onCelebrate);
        return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
    }, [reduceMotion]);

    useEffect(() => {
        if (!shower) return undefined;
        const longest = Math.max(...shower.petals.map((petal) => petal.duration + petal.delay));
        const timer = setTimeout(() => setShower(null), longest * 1000 + 200);
        return () => clearTimeout(timer);
    }, [shower]);

    if (!shower || typeof document === 'undefined') return null;

    return createPortal(
        <div className="petal-shower" aria-hidden="true">
            {shower.petals.map((petal) => (
                <svg
                    key={petal.key}
                    className="petal"
                    viewBox="0 0 20 28"
                    width={petal.size}
                    height={petal.size * 1.4}
                    style={{
                        left: `${petal.left}%`,
                        '--drift': `${petal.drift}px`,
                        '--spin': `${petal.spin}deg`,
                        animationDuration: `${petal.duration}s`,
                        animationDelay: `${petal.delay}s`
                    }}
                >
                    <path d="M10 1 C 17 7, 19 16, 10 27 C 1 16, 3 7, 10 1 Z" fill={petal.fill} stroke={petal.stroke} strokeWidth="0.8" />
                    <path d="M10 5 C 11 11, 11 17, 10 23" fill="none" stroke={petal.stroke} strokeWidth="0.6" opacity="0.55" />
                </svg>
            ))}
        </div>,
        document.body
    );
}

export default PetalShower;
