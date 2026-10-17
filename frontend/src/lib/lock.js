// A passcode that keeps Sakha closed to anyone else who picks up the device.
//
// Only a salted PBKDF2 hash is kept — never the passcode itself — and it
// never leaves this device. There is no recovery: with no account and no
// server, forgetting the passcode means starting fresh, and the lock says so.

export const LOCK_KEY = 'lgLock';
export const LOCK_EVENT = 'lgLockUpdated';

const ITERATIONS = 150000;
// Away longer than this and Sakha asks for the passcode again.
export const RELOCK_AFTER_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30 * 1000;

const toHex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((pair) => parseInt(pair, 16)));

export function lockSupported() {
    return typeof window !== 'undefined' && Boolean(window.crypto?.subtle) && window.isSecureContext !== false;
}

function readLock() {
    try {
        const lock = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
        return lock && typeof lock.hash === 'string' && typeof lock.salt === 'string' ? lock : null;
    } catch {
        return null;
    }
}

export function isLockEnabled() {
    return Boolean(readLock());
}

/** How many digits to wait for before checking (so the lock opens without an extra tap). */
export function passcodeLength() {
    const length = Number(readLock()?.length);
    return length >= 4 && length <= 6 ? length : 6;
}

async function derive(passcode, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
    return toHex(bits);
}

export const isValidPasscode = (passcode) => /^\d{4,6}$/.test(String(passcode));

export async function setPasscode(passcode) {
    if (!isValidPasscode(passcode)) throw new Error('A passcode is 4 to 6 digits.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(passcode, salt, ITERATIONS);
    localStorage.setItem(LOCK_KEY, JSON.stringify({
        hash, salt: toHex(salt), iterations: ITERATIONS, length: String(passcode).length, at: new Date().toISOString(), failures: 0
    }));
    window.dispatchEvent(new Event(LOCK_EVENT));
}

export function clearPasscode() {
    localStorage.removeItem(LOCK_KEY);
    window.dispatchEvent(new Event(LOCK_EVENT));
}

/** Milliseconds until another attempt is allowed (after too many wrong ones). */
export function cooldownRemaining() {
    const lock = readLock();
    if (!lock?.blockedUntil) return 0;
    return Math.max(0, Date.parse(lock.blockedUntil) - Date.now());
}

/** @returns {Promise<{ ok: boolean, waitMs?: number }>} */
export async function verifyPasscode(passcode) {
    const lock = readLock();
    if (!lock) return { ok: true };
    const waitMs = cooldownRemaining();
    if (waitMs) return { ok: false, waitMs };
    const hash = await derive(String(passcode), fromHex(lock.salt), lock.iterations || ITERATIONS);
    // Compare in constant time.
    let difference = hash.length ^ lock.hash.length;
    for (let i = 0; i < Math.min(hash.length, lock.hash.length); i++) difference |= hash.charCodeAt(i) ^ lock.hash.charCodeAt(i);
    const ok = difference === 0;
    const failures = ok ? 0 : (lock.failures || 0) + 1;
    const blockedUntil = failures >= MAX_ATTEMPTS ? new Date(Date.now() + COOLDOWN_MS).toISOString() : null;
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ...lock, failures: blockedUntil ? 0 : failures, blockedUntil }));
    return ok ? { ok } : { ok, waitMs: blockedUntil ? COOLDOWN_MS : 0 };
}
