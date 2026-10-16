import { toast } from '../lib/toast';

// Service worker lifecycle for the installed sanctuary.
//
// - Production only: in dev the SW would fight Vite's hot reload, so any
//   stale registration is removed instead.
// - Updates are polite: a new version waits until the user taps "Refresh".
// - The SW gathers all 701 verses in the background and tells us when the
//   offline library is complete.

export const WISDOM_CACHE = 'lg-wisdom-v1';
const OFFLINE_NOTICE_KEY = 'lgOfflineReadyNotified';

let waitingWorker = null;
let reloadRequested = false;

export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (!import.meta.env.PROD) {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => registrations.forEach((registration) => registration.unregister()))
            .catch(() => {});
        return;
    }

    const start = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

            if (registration.waiting && navigator.serviceWorker.controller) {
                announceUpdate(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const incoming = registration.installing;
                if (!incoming) return;
                incoming.addEventListener('statechange', () => {
                    if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
                        announceUpdate(incoming);
                    }
                });
            });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') registration.update().catch(() => {});
            });
        } catch (error) {
            console.warn('[Living Gita] Service worker registration failed:', error);
        }
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloadRequested) return;
        reloadRequested = false;
        window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type !== 'WISDOM_READY') return;
        if (localStorage.getItem(OFFLINE_NOTICE_KEY)) return;
        localStorage.setItem(OFFLINE_NOTICE_KEY, new Date().toISOString());
        toast(`All ${event.data.verses} verses are now kept on this device — the sanctuary works offline.`, {
            tone: 'gold',
            icon: 'offline',
            duration: 5200
        });
    });

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start, { once: true });
    }
}

function announceUpdate(worker) {
    waitingWorker = worker;
    toast('A refreshed sanctuary is ready.', {
        tone: 'gold',
        icon: 'refresh',
        action: { label: 'Refresh', onClick: applyUpdate }
    });
}

export function applyUpdate() {
    if (!waitingWorker) return;
    reloadRequested = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

// How much of the corpus is available offline right now.
export async function getOfflineLibraryStatus() {
    if (typeof caches === 'undefined') return { supported: false, chapters: 0, ready: false };
    try {
        if (!(await caches.has(WISDOM_CACHE))) return { supported: true, chapters: 0, ready: false };
        const cache = await caches.open(WISDOM_CACHE);
        const keys = await cache.keys();
        const chapters = keys.filter((request) => /\/api\/verses\/chapters\/\d+$/.test(new URL(request.url).pathname)).length;
        return { supported: true, chapters, ready: chapters >= 18 };
    } catch {
        return { supported: true, chapters: 0, ready: false };
    }
}

// ---------------------------------------------------------------------------
// Install prompt (Chromium fires beforeinstallprompt; iOS needs instructions)
// ---------------------------------------------------------------------------

export const INSTALL_EVENT = 'lg:install-state';
let deferredPrompt = null;
let installed = false;

export function captureInstallPrompt() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault(); // keep Chrome's mini-infobar away; we offer our own quiet pill
        deferredPrompt = event;
        window.dispatchEvent(new Event(INSTALL_EVENT));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installed = true;
        window.dispatchEvent(new Event(INSTALL_EVENT));
        toast('Living Gita is installed. Find it on your home screen.', { tone: 'gold', icon: 'install' });
    });
}

export function getInstallState() {
    const standalone =
        installed ||
        (typeof window !== 'undefined' &&
            (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true));

    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const isAppleMobile =
        /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIosSafari = isAppleMobile && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);

    return {
        standalone,
        canPrompt: Boolean(deferredPrompt),
        needsIosInstructions: isIosSafari && !standalone
    };
}

export async function promptInstall() {
    if (!deferredPrompt) return 'unavailable';
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    window.dispatchEvent(new Event(INSTALL_EVENT));
    return outcome;
}
