import React, { useId } from 'react';
import { PATH_IDS } from '../../lib/person';

// The four paths, each with its own colour (for the choices beside the lotus).
export const PATH_COLOURS = { karma: '200, 85, 58', jnana: '222, 138, 40', bhakti: '204, 102, 146', dhyana: '84, 106, 176' };

// A petal rising from the base (0, 0): a long, pointed teardrop.
const petal = (length, width) => `M0,0 C${width},${-length * 0.28} ${width * 0.78},${-length * 0.78} 0,${-length} C${-width * 0.78},${-length * 0.78} ${-width},${-length * 0.28} 0,0 Z`;

// Back to front. Each pair opens wider as the lotus blooms.
const LAYERS = [
    { angle: 66, length: 60, width: 20, tone: 'back' },
    { angle: 42, length: 80, width: 23, tone: 'back' },
    { angle: 20, length: 92, width: 24, tone: 'mid' },
    { angle: 0, length: 100, width: 25, tone: 'mid', single: true },
    { angle: 34, length: 64, width: 25, tone: 'front' },
    { angle: 74, length: 44, width: 19, tone: 'front' }
];

/**
 * A pink lotus that opens as Sakha learns what helps this person: closed at
 * first, fuller with every answer they mark. It breathes, slowly.
 */
function PathLotus({ paths = {}, size = 168, highlight = null }) {
    const id = useId().replace(/:/g, '');
    const learned = PATH_IDS.reduce((sum, path) => sum + Math.max(0, Number(paths[path]) || 0), 0);
    const bloom = Math.min(1, learned / 12);
    const open = 0.72 + 0.28 * bloom;
    const glow = highlight ? PATH_COLOURS[highlight] : '236, 120, 170';

    return (
        <svg className="path-lotus" viewBox="-100 -112 200 176" width={size} height={size * 0.88} aria-hidden="true" style={{ '--lotus-glow': glow }}>
            <defs>
                <radialGradient id={`${id}-halo`} cx="0" cy="-30" r="96" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={`rgb(${glow})`} stopOpacity="0.32" />
                    <stop offset="1" stopColor={`rgb(${glow})`} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${id}-back`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor="#d9578f" />
                    <stop offset="1" stopColor="#ffd3e4" />
                </linearGradient>
                <linearGradient id={`${id}-mid`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor="#c93f7d" />
                    <stop offset="0.55" stopColor="#ef8db5" />
                    <stop offset="1" stopColor="#ffe6ef" />
                </linearGradient>
                <linearGradient id={`${id}-front`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor="#b8306e" />
                    <stop offset="0.6" stopColor="#f07aa9" />
                    <stop offset="1" stopColor="#ffd0e2" />
                </linearGradient>
                <linearGradient id={`${id}-pad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3f8a66" />
                    <stop offset="1" stopColor="#24563f" />
                </linearGradient>
            </defs>

            <circle className="path-lotus__halo" cx="0" cy="-30" r="96" fill={`url(#${id}-halo)`} />

            {/* Ripples on the water */}
            <g className="path-lotus__water" transform="translate(0 44)">
                <ellipse className="path-lotus__ripple" rx="78" ry="9" />
                <ellipse className="path-lotus__ripple path-lotus__ripple--late" rx="78" ry="9" />
                <path className="path-lotus__pad" d="M-64,4 C-60,-8 -20,-12 0,-10 C20,-12 60,-8 64,4 C40,13 -40,13 -64,4 Z" fill={`url(#${id}-pad)`} />
            </g>

            <g className="path-lotus__flower" transform="translate(0 40)">
                {LAYERS.map((layer, index) => {
                    const sides = layer.single ? [0] : [-1, 1];
                    return sides.map((side) => (
                        <g key={`${index}${side}`} transform={`rotate(${side * layer.angle * open})`}>
                            <path
                                className={`path-lotus__petal path-lotus__petal--${layer.tone}`}
                                d={petal(layer.length * (0.9 + 0.1 * bloom), layer.width)}
                                fill={`url(#${id}-${layer.tone})`}
                                style={{ '--sway': `${side === 0 ? 0 : side * (1.2 + index * 0.35)}deg`, '--delay': `${-index * 0.8}s` }}
                            />
                            {layer.tone !== 'back' && (
                                <path className="path-lotus__vein" d={`M0,-6 L0,${-layer.length * (0.9 + 0.1 * bloom) * 0.82}`} />
                            )}
                        </g>
                    ));
                })}
                {/* The seed-heart, golden */}
                <ellipse className="path-lotus__heart" cx="0" cy="-8" rx="10" ry="4.5" />
            </g>

            {/* Pollen, rising */}
            <g className="path-lotus__pollen">
                <circle cx="-14" cy="-40" r="1.6" />
                <circle cx="10" cy="-52" r="1.2" style={{ animationDelay: '-2.2s' }} />
                <circle cx="2" cy="-30" r="1.4" style={{ animationDelay: '-4.1s' }} />
            </g>
        </svg>
    );
}

export default PathLotus;
