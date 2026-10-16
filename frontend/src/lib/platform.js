const ua = typeof navigator === 'undefined' ? '' : `${navigator.platform || ''} ${navigator.userAgent || ''}`;

export const IS_APPLE = /mac|iphone|ipad|ipod/i.test(ua);

// Shown in shortcut hints: ⌘ on Apple devices, Ctrl elsewhere.
export const MOD_KEY = IS_APPLE ? '⌘' : 'Ctrl';

export function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    const type = (target.getAttribute('type') || 'text').toLowerCase();
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes(type);
}
