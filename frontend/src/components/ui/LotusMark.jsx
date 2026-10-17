import React from 'react';

// The Sakha lotus — five vesica petals rising from still water, with a
// bindu above. Drawn from the same geometry as the app icon and wisdom cards.

function petal(halfHeight, halfWidth) {
    const radius = (halfHeight * halfHeight + halfWidth * halfWidth) / (2 * halfWidth);
    return `M0 ${-halfHeight} A${radius} ${radius} 0 0 1 0 ${halfHeight} A${radius} ${radius} 0 0 1 0 ${-halfHeight}Z`;
}

const PETALS = [
    { angle: -66, h: 17, w: 8, opacity: 0.5 },
    { angle: 66, h: 17, w: 8, opacity: 0.5 },
    { angle: -34, h: 22, w: 9, opacity: 0.75 },
    { angle: 34, h: 22, w: 9, opacity: 0.75 },
    { angle: 0, h: 26, w: 10, opacity: 1 }
];

function LotusMark({ size = 28, ring = false, className = '', title }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="-50 -50 100 100"
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            fill="none"
        >
            {ring && <circle r="46" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />}
            <g transform="translate(0 12)">
                {PETALS.map(({ angle, h, w, opacity }) => (
                    <path
                        key={angle}
                        d={petal(h, w)}
                        transform={`rotate(${angle}) translate(0 ${-h})`}
                        fill="currentColor"
                        fillOpacity={opacity}
                        stroke="var(--ink-900, #0a0e14)"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />
                ))}
                <path d="M-27 3 H27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </g>
            <circle cy="-38" r="3.6" fill="currentColor" />
        </svg>
    );
}

export default LotusMark;
