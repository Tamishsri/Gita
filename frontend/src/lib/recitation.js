// Recitation in a human voice, when the server has one (Backend voiceController).
//
// Only a verse id and a part are asked for — never anything the person wrote.
// The audio is decoded into the app's one AudioContext, so it plays on iOS
// after the tap that asked for it, dips the soundscape like any other voice,
// and the service worker keeps each recitation for offline listening.

import { getAudioContext } from './audio';

let status = null;

/** { voice, revision } when a human voice is available, else null. Asked once per visit. */
export function recitationVoice() {
    if (!status) {
        status = fetch('/api/voice', { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => (data?.available ? { voice: data.voice, revision: data.revision || 1 } : null))
            .catch(() => null);
        // An unreachable server is asked again next time, not remembered as "no voice".
        status.then((value) => { if (!value) setTimeout(() => { status = null; }, 60000); });
    }
    return status;
}

export const recitationUrl = (verseId, part, language, revision = 1) =>
    `/api/voice/${encodeURIComponent(verseId)}?part=${part}${part === 'meaning' ? `&lang=${language === 'hi' ? 'hi' : 'en'}` : ''}&v=${revision}`;

/** Fetch and decode one part of a verse's recitation. */
export async function loadRecitation(verseId, part, language, revision, signal) {
    const context = getAudioContext();
    if (!context) throw new Error('No audio');
    const response = await fetch(recitationUrl(verseId, part, language, revision), { signal });
    if (!response.ok) throw new Error(`Recitation ${response.status}`);
    const data = await response.arrayBuffer();
    // Safari before 14.1 only has the callback form.
    return new Promise((resolve, reject) => {
        const decoded = context.decodeAudioData(data, resolve, reject);
        if (decoded && typeof decoded.then === 'function') decoded.then(resolve, reject);
    });
}

/**
 * Play a decoded recitation; resolves when it ends (or is stopped).
 * @returns {{ done: Promise<void>, stop: () => void }}
 */
export function playRecitation(buffer) {
    const context = getAudioContext();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    // A breath of fade at each end, so it never clicks in or out.
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.04);
    source.connect(gain).connect(context.destination);
    let finish;
    const done = new Promise((resolve) => { finish = resolve; });
    source.onended = () => finish();
    source.start(now);
    return {
        done,
        stop: () => {
            try {
                const at = context.currentTime;
                gain.gain.cancelScheduledValues(at);
                gain.gain.setValueAtTime(gain.gain.value, at);
                gain.gain.linearRampToValueAtTime(0, at + 0.08);
                source.stop(at + 0.1);
            } catch {
                // already stopped
            }
            finish();
        }
    };
}
