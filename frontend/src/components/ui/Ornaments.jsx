import React, { useId } from 'react';

// The visual vocabulary of Sakha, drawn for this app rather than taken
// from an icon set. Each motif comes from the Gita itself:
//   Dīpa   — "as a lamp in a windless place does not flicker" (6.19)
//   Kolam  — the threshold drawing at dawn; used as a divider between thoughts
//   Bindu  — the point from which everything unfolds; a kumkum dot

// ---------------------------------------------------------------------------
// Dīpa — a clay lamp with a living flame
// ---------------------------------------------------------------------------

export function Diya({ size = 64, lit = true, steady = false, flame = 1, className = '', title }) {
    const id = useId().replace(/:/g, '');
    return (
        <svg
            className={`diya${steady ? ' diya--steady' : ''}${lit ? ' is-lit' : ''} ${className}`}
            width={size}
            height={size}
            viewBox="0 0 120 120"
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            style={{ '--flame-scale': flame }}
        >
            <defs>
                <radialGradient id={`halo-${id}`} cx="60" cy="52" r="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#f6c879" stopOpacity="0.42" />
                    <stop offset="0.45" stopColor="#e39a45" stopOpacity="0.12" />
                    <stop offset="1" stopColor="#e39a45" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`flame-${id}`} x1="60" y1="20" x2="60" y2="74" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#fff3d6" />
                    <stop offset="0.35" stopColor="#f7c56e" />
                    <stop offset="0.8" stopColor="#e2832f" />
                    <stop offset="1" stopColor="#b4502a" />
                </linearGradient>
                <linearGradient id={`clay-${id}`} x1="0" y1="74" x2="0" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#c0703f" />
                    <stop offset="1" stopColor="#6e3418" />
                </linearGradient>
            </defs>

            {lit && <circle className="diya__halo" cx="60" cy="54" r="52" fill={`url(#halo-${id})`} />}

            {lit && (
                <g className="diya__flame">
                    <path
                        d="M60 22 C 70 38, 75 50, 70 62 C 67 70, 53 70, 50 62 C 45 50, 51 38, 60 22 Z"
                        fill={`url(#flame-${id})`}
                    />
                    <path d="M60 46 C 64 53, 64 60, 60 65 C 56 60, 56 53, 60 46 Z" fill="#fff8e8" opacity="0.85" />
                </g>
            )}

            {/* wick */}
            <path d="M60 64 L60 74" stroke="#2b1a0f" strokeWidth="2" strokeLinecap="round" />

            {/* clay bowl with a pinched spout */}
            <path
                d="M22 76 C 30 98, 90 98, 98 76 C 92 79, 74 81, 60 81 C 46 81, 28 79, 22 76 Z"
                fill={`url(#clay-${id})`}
            />
            <path d="M22 76 C 28 79, 46 81, 60 81 C 74 81, 92 79, 98 76" fill="none" stroke="#e7a36a" strokeOpacity="0.6" strokeWidth="1.4" />
            <path d="M34 90 C 48 95, 72 95, 86 90" fill="none" stroke="#3a1c0c" strokeOpacity="0.5" strokeWidth="1.2" />
            {/* kumkum dot on the bowl */}
            <circle cx="60" cy="88" r="2.2" fill="#c8553a" />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Kolam rule — a divider drawn like a threshold pattern: a loop around dots
// ---------------------------------------------------------------------------

export function KolamRule({ width = 220, className = '' }) {
    return (
        <svg className={`kolam-rule ${className}`} width={width} height="22" viewBox="0 0 220 22" aria-hidden="true">
            <path d="M0 11 H78" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
            <path d="M142 11 H220" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
            {/* three dots, one loop weaving around them */}
            <circle cx="94" cy="11" r="1.6" fill="currentColor" fillOpacity="0.7" />
            <circle cx="110" cy="11" r="2.4" fill="#c8553a" />
            <circle cx="126" cy="11" r="1.6" fill="currentColor" fillOpacity="0.7" />
            <path
                d="M84 11 C 84 3, 102 3, 102 11 C 102 19, 118 19, 118 11 C 118 3, 136 3, 136 11 C 136 19, 118 19, 118 11 C 118 3, 102 3, 102 11 C 102 19, 84 19, 84 11 Z"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.55"
                strokeWidth="1"
            />
        </svg>
    );
}

export function Bindu({ size = 7, className = '' }) {
    return <span className={`bindu ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Practice glyphs — line drawings in one hand, one pen weight
// ---------------------------------------------------------------------------

const glyph = (children) => function Glyph({ size = 28, className = '' }) {
    return (
        <svg
            className={`glyph ${className}`}
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
};

// Prāṇa — breath offered (4.29): three rising currents
export const BreathGlyph = glyph(
    <>
        <path d="M10 30 C 16 24, 22 34, 28 28 S 38 22, 40 26" />
        <path d="M8 22 C 14 16, 20 26, 26 20 S 36 14, 40 18" opacity="0.7" />
        <path d="M12 38 C 18 32, 24 42, 30 36" opacity="0.5" />
    </>
);

// Japa — a mala of beads with the meru bead
export const MalaGlyph = glyph(
    <>
        {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2 - Math.PI / 2 + Math.PI / 14;
            return <circle key={i} cx={24 + Math.cos(angle) * 14} cy={22 + Math.sin(angle) * 14} r="1.9" />;
        })}
        <circle cx="24" cy="6" r="2.8" fill="currentColor" />
        <path d="M24 9 L24 44 M21 40 L24 44 L27 40" />
    </>
);

// Dhyāna — the steady flame (6.19)
export const FlameGlyph = glyph(
    <>
        <path d="M24 8 C 31 17, 33 24, 30 30 C 28 34, 20 34, 18 30 C 15 24, 18 17, 24 8 Z" />
        <path d="M24 21 C 26.5 25, 26.5 28, 24 30.5 C 21.5 28, 21.5 25, 24 21 Z" />
        <path d="M10 38 C 16 44, 32 44, 38 38" />
        <path d="M24 34 L24 38" />
    </>
);

// Saṅkalpa & Sandhyā — the sun at the threshold of the day
export const SandhyaGlyph = glyph(
    <>
        <path d="M8 32 H40" />
        <path d="M14 32 A10 10 0 0 1 34 32" />
        <path d="M24 12 V16 M11 19 L14 22 M37 19 L34 22 M6 26 H9 M39 26 H42" opacity="0.75" />
        <path d="M14 38 H34" opacity="0.5" />
    </>
);

// Svādhyāya — a palm-leaf manuscript bound with cord
export const LeafGlyph = glyph(
    <>
        <rect x="6" y="18" width="36" height="12" rx="3" />
        <path d="M6 22 H42" opacity="0.5" />
        <circle cx="15" cy="24" r="1.4" fill="currentColor" />
        <circle cx="33" cy="24" r="1.4" fill="currentColor" />
        <path d="M15 24 C 15 34, 24 38, 24 42" opacity="0.7" />
    </>
);

// Mārga — a winding road narrowing toward a point of light
export const PathGlyph = glyph(
    <>
        <path d="M7 44 C 11 34, 27 33, 22 23 C 19.5 17.5, 21.5 13, 23 10" />
        <path d="M27 44 C 29 36, 39 32, 31 22 C 27.5 17.5, 25.5 13, 25 10" />
        <path d="M17 39 L19 37 M24.5 30 L25.5 28 M24 19 L24 17.5" opacity="0.55" />
        <circle cx="24" cy="6" r="2" fill="currentColor" stroke="none" />
    </>
);

// Sūrya — the morning sun, for blessings and for completion
export const SunGlyph = glyph(
    <>
        <circle cx="24" cy="24" r="8" />
        <circle cx="24" cy="24" r="2.4" fill="currentColor" stroke="none" />
        <path d="M24 6 V11 M24 37 V42 M6 24 H11 M37 24 H42 M11.3 11.3 L14.8 14.8 M33.2 33.2 L36.7 36.7 M11.3 36.7 L14.8 33.2 M33.2 14.8 L36.7 11.3" />
    </>
);

// Patra — a letter, folded and sealed with kumkum
export const LetterGlyph = glyph(
    <>
        <rect x="7" y="13" width="34" height="23" rx="2.5" />
        <path d="M7.8 14.5 L24 27 L40.2 14.5" />
        <path d="M7.8 35 L19 25.5 M40.2 35 L29 25.5" opacity="0.5" />
        <circle cx="24" cy="27.5" r="3.6" fill="var(--kumkum, #c8553a)" stroke="none" />
    </>
);
