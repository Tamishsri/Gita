// Gentle touch feedback. Uses the Vibration API where it exists (Android
// Chrome, most Chromium mobile browsers) and quietly does nothing elsewhere,
// including iOS Safari and desktop.

const PATTERNS = {
    tap: [15],
    soft: [8],
    breath: [22],
    success: [14, 70, 22],
    ceremony: [30, 110, 30, 110, 70]
};

let enabled = true;

export function setHapticsEnabled(value) {
    enabled = value !== false;
}

export function supportsHaptics() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function haptic(kind = 'tap') {
    if (!enabled || !supportsHaptics()) return false;
    try {
        return navigator.vibrate(PATTERNS[kind] || PATTERNS.tap);
    } catch {
        return false;
    }
}

// One delegated listener gives every button a light tap on touch screens,
// so individual components never need to remember to call haptic('tap').
export function installTapHaptics() {
    if (typeof document === 'undefined') return () => {};

    let lastPointerType = null;

    const onPointerDown = (event) => {
        lastPointerType = event.pointerType;
    };

    const onClick = (event) => {
        if (lastPointerType !== 'touch') return;
        const target = event.target instanceof Element
            ? event.target.closest('button, [role="button"], [role="option"], [role="switch"], a[href]')
            : null;
        if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
        if (target.dataset.haptic === 'off') return;
        haptic('tap');
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    document.addEventListener('click', onClick, { capture: true, passive: true });

    return () => {
        document.removeEventListener('pointerdown', onPointerDown, { capture: true });
        document.removeEventListener('click', onClick, { capture: true });
    };
}
