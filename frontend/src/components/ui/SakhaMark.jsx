import React, { useId } from 'react';
import { MARK_COLORS as C, MARK_DROPS, MARK_EYE, MARK_GLINT, MARK_QUILL, MARK_RING, QUILL_PATH, dropPath } from '../../lib/sakhaMark';

const [GOLD, TEAL] = MARK_DROPS;
const GOLD_PATH = dropPath(GOLD);
const TEAL_PATH = dropPath(TEAL);

/**
 * The Sakha mark — a peacock feather's eye that is also a flame.
 * `tile` sets it on a small dawn-coloured square, as on the app icon.
 */
function SakhaMark({ size = 32, tile = false, className = '', title }) {
    const id = useId().replace(/:/g, '');
    return (
        <svg
            className={`sakha-mark${tile ? ' sakha-mark--tile' : ''} ${className}`}
            width={size}
            height={size}
            viewBox={tile ? '0 0 100 100' : '14 8 72 90'}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : 'true'}
            aria-label={title}
        >
            <defs>
                <linearGradient id={`${id}-gold`} x1="0" y1="12" x2="0" y2="84" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C.goldLight} />
                    <stop offset="0.55" stopColor={C.gold} />
                    <stop offset="1" stopColor={C.goldDeep} />
                </linearGradient>
                <linearGradient id={`${id}-teal`} x1="0" y1="32" x2="0" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C.teal} />
                    <stop offset="1" stopColor={C.tealDeep} />
                </linearGradient>
                <radialGradient id={`${id}-bronze`} cx="48" cy="62" r="14" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C.bronze} />
                    <stop offset="1" stopColor={C.bronzeDeep} />
                </radialGradient>
                <radialGradient id={`${id}-blue`} cx="47" cy="61" r="13" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C.blue} />
                    <stop offset="1" stopColor={C.blueDeep} />
                </radialGradient>
                {tile && (
                    <radialGradient id={`${id}-dawn`} cx="50" cy="38" r="70" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#fff8ea" />
                        <stop offset="1" stopColor="#f3dcb8" />
                    </radialGradient>
                )}
            </defs>
            {tile && <rect width="100" height="100" rx="24" fill={`url(#${id}-dawn)`} />}
            <g transform={tile ? 'translate(50 50) scale(0.8) translate(-50 -53.5)' : undefined}>
                <path d={QUILL_PATH} fill="none" stroke={C.goldDeep} strokeWidth={MARK_QUILL.width} strokeLinecap="round" />
                <path d={GOLD_PATH} fill={`url(#${id}-gold)`} />
                <path d={TEAL_PATH} fill={`url(#${id}-teal)`} stroke={C.seam} strokeWidth="1.3" />
                <ellipse cx={MARK_RING.cx} cy={MARK_RING.cy} rx={MARK_RING.rx} ry={MARK_RING.ry} fill={`url(#${id}-bronze)`} />
                <ellipse cx={MARK_EYE.cx} cy={MARK_EYE.cy} rx={MARK_EYE.rx} ry={MARK_EYE.ry} fill={`url(#${id}-blue)`} />
                <circle cx={MARK_GLINT.cx} cy={MARK_GLINT.cy} r={MARK_GLINT.r} fill={C.glint} />
            </g>
        </svg>
    );
}

export default SakhaMark;
