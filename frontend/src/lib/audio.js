// One AudioContext shared by the ambient soundscape and the singing bowl.
// Browsers only allow audio to start inside a user gesture, so the context is
// created lazily and unlocked on the very first tap or key press.

let context = null;

export function getAudioContext() {
    if (typeof window === 'undefined') return null;

    if (!context) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        try {
            context = new AudioCtor({ latencyHint: 'interactive' });
        } catch {
            return null;
        }
    }

    if (context.state === 'suspended' || context.state === 'interrupted') {
        context.resume().catch(() => {});
    }

    return context;
}

// Resolves with a running context, or null if the browser keeps it suspended
// (no user gesture yet). Never leaves sound queued to burst out later.
export function whenAudioRunning(timeoutMs = 400) {
    const ctx = getAudioContext();
    if (!ctx) return Promise.resolve(null);
    if (ctx.state === 'running') return Promise.resolve(ctx);

    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(ctx.state === 'running' ? ctx : null), timeoutMs);
        ctx.resume()
            .then(() => {
                clearTimeout(timer);
                resolve(ctx.state === 'running' ? ctx : null);
            })
            .catch(() => {
                clearTimeout(timer);
                resolve(null);
            });
    });
}

export function unlockAudioOnFirstGesture() {
    if (typeof window === 'undefined') return;

    const events = ['pointerdown', 'keydown', 'touchend'];
    const unlock = () => {
        getAudioContext();
        events.forEach((name) => window.removeEventListener(name, unlock, true));
    };

    events.forEach((name) => window.addEventListener(name, unlock, { capture: true, passive: true }));
}
