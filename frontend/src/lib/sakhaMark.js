// The Sakha mark: the eye of a peacock feather — the mor-pankh Krishna wears —
// drawn so that it is also a flame. Krishna and light, in one shape.
//
// Geometry lives here once and is used three ways: the SVG in the app, the
// canvas wisdom cards, and the Node script that rasterises the app icons.
// Drawn in a 100×100 box, y down. Each teardrop is two circles joined by
// their shared tangent lines, so every rendering is exactly the same shape.

export const MARK_DROPS = [
    { id: 'gold', bottom: [50, 60], r1: 24, top: [50, 13.2], r2: 1.2 },
    { id: 'teal', bottom: [50, 63.5], r1: 15.6, top: [50, 32], r2: 1 }
];

export const MARK_EYE = { cx: 50, cy: 65.6, rx: 8.4, ry: 9.8 };
// The bronze ring a real feather's eye has between its green and its blue.
export const MARK_RING = { cx: 50, cy: 65.6, rx: 10.6, ry: 12.1 };
export const MARK_GLINT = { cx: 47.3, cy: 61.8, r: 2.3 };
export const MARK_QUILL = { from: [50, 84], to: [47.6, 95.5], width: 2 };

export const MARK_COLORS = {
    goldLight: '#f7cd7f',
    gold: '#e39a35',
    goldDeep: '#b9681e',
    teal: '#24968e',
    tealDeep: '#11605b',
    bronze: '#d39a4a',
    bronzeDeep: '#8c5822',
    blue: '#2a4a9c',
    blueDeep: '#152a63',
    glint: '#fbe7b5',
    seam: '#fbe3ad'
};

export function dropGeometry({ bottom: [cx, cy], r1, top: [, ty], r2 }) {
    const h = cy - ty;
    const b = (r1 - r2) / h;
    const a = Math.sqrt(1 - b * b);
    return { cx, cy, r1, r2, h, a, b, ty };
}

const fixed = (n) => Number(n.toFixed(3));

/** SVG/Path2D path data for one teardrop. */
export function dropPath(drop) {
    const { cx, cy, r1, r2, a, b, ty } = dropGeometry(drop);
    const bottomRight = [cx + r1 * a, cy - r1 * b];
    const bottomLeft = [cx - r1 * a, cy - r1 * b];
    const topRight = [cx + r2 * a, ty - r2 * b];
    const topLeft = [cx - r2 * a, ty - r2 * b];
    return `M${fixed(topRight[0])} ${fixed(topRight[1])}`
        + `L${fixed(bottomRight[0])} ${fixed(bottomRight[1])}`
        + `A${r1} ${r1} 0 1 1 ${fixed(bottomLeft[0])} ${fixed(bottomLeft[1])}`
        + `L${fixed(topLeft[0])} ${fixed(topLeft[1])}`
        + `A${r2} ${r2} 0 0 1 ${fixed(topRight[0])} ${fixed(topRight[1])}Z`;
}

/** Signed distance to a teardrop (Inigo Quilez's uneven capsule), in box units. */
export function sdDrop(x, y, drop) {
    const { cx, cy, r1, r2, h, a, b } = dropGeometry(drop);
    const px = Math.abs(x - cx);
    const py = cy - y;
    const k = -b * px + a * py;
    if (k < 0) return Math.hypot(px, py) - r1;
    if (k > a * h) return Math.hypot(px, py - h) - r2;
    return a * px + b * py - r1;
}

export const QUILL_PATH = `M${MARK_QUILL.from[0]} ${MARK_QUILL.from[1]}Q${MARK_QUILL.from[0] - 0.4} ${(MARK_QUILL.from[1] + MARK_QUILL.to[1]) / 2} ${MARK_QUILL.to[0]} ${MARK_QUILL.to[1]}`;
