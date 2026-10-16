// Fire-and-forget notifications. Any module can call toast(); <ToastHost />
// renders them. Keeping this as a window event avoids threading a context
// through every component that might want to say "saved".

export const TOAST_EVENT = 'lg:toast';

/**
 * @param {string} message
 * @param {{ tone?: 'default' | 'gold' | 'quiet', duration?: number, action?: { label: string, onClick: () => void }, icon?: string }} [options]
 */
export function toast(message, options = {}) {
    if (typeof window === 'undefined' || !message) return;
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, {
        detail: {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            message,
            tone: options.tone || 'default',
            duration: options.duration ?? (options.action ? 7000 : 3200),
            action: options.action || null,
            icon: options.icon || null
        }
    }));
}
