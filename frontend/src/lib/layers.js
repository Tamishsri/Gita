import { useEffect, useRef } from 'react';

// A tiny stack of open overlays (sheets, palette, card studio, ceremony).
// The global key handler asks it two questions:
//   - who should receive Escape?        -> the top-most layer
//   - may single-letter hotkeys fire?  -> not while a focused overlay is open
// Layers are pushed in the order they open, so the newest one is on top.

const stack = [];
let lockCount = 0;

export function useLayer(active, { onEscape, blocksHotkeys = false, lockScroll = true } = {}) {
    const entry = useRef({ onEscape, blocksHotkeys });
    entry.current.onEscape = onEscape;
    entry.current.blocksHotkeys = blocksHotkeys;

    useEffect(() => {
        if (!active) return undefined;

        const layer = entry.current;
        stack.push(layer);
        if (lockScroll) lockBodyScroll();

        return () => {
            const index = stack.lastIndexOf(layer);
            if (index !== -1) stack.splice(index, 1);
            if (lockScroll) unlockBodyScroll();
        };
    }, [active, lockScroll]);
}

export function topLayer() {
    return stack[stack.length - 1] || null;
}

export function hasOpenLayer() {
    return stack.length > 0;
}

export function hotkeysBlocked() {
    return stack.some((layer) => layer.blocksHotkeys);
}

// While a modal is open the page behind it is inert: it cannot scroll, be
// tabbed into, or be read by a screen reader. Overlays render in portals
// outside #root, so they stay interactive.
function setBackgroundInert(inert) {
    const root = document.getElementById('root');
    if (!root) return;
    if (inert) root.setAttribute('inert', '');
    else root.removeAttribute('inert');
}

function lockBodyScroll() {
    lockCount += 1;
    if (lockCount === 1) {
        document.documentElement.classList.add('is-scroll-locked');
        document.body.classList.add('is-scroll-locked');
        setBackgroundInert(true);
    }
}

function unlockBodyScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
        document.documentElement.classList.remove('is-scroll-locked');
        document.body.classList.remove('is-scroll-locked');
        setBackgroundInert(false);
    }
}
