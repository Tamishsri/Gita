import { useCallback, useEffect, useRef, useState } from 'react';
import { useSoundscape } from '../components/SoundscapeEngine';
import { areChimesEnabled, playChime } from '../lib/chime';
import { forSpeech, phrasesOf, pickVoice, speechSupported } from '../lib/speech';

// Reading a verse aloud the way a person recites it — not the way a machine
// reads a paragraph:
//
//   · the most natural voice the device has, an Indian voice for Hindi and
//     Sanskrit (and the śloka is skipped, not mangled, when there is none)
//   · a soft bell, then the śloka, unhurried, resting at each half-line
//   · the meaning phrase by phrase, with the breaths a reader takes
//   · the ambient sound dips while the voice speaks, and returns after
//
// Speaking in short phrases also avoids Chromium cutting long speech off.

const synth = speechSupported() ? window.speechSynthesis : null;

export function useVoiceReader() {
    const [speakingId, setSpeakingId] = useState(null);
    const activeId = useRef(null);
    const timers = useRef([]);
    const { duck } = useSoundscape();

    const clearTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    useEffect(() => () => {
        clearTimers();
        if (activeId.current) synth?.cancel();
    }, []);

    const stop = useCallback(() => {
        clearTimers();
        synth?.cancel();
        if (activeId.current) duck?.(false);
        activeId.current = null;
        setSpeakingId(null);
    }, [duck]);

    /**
     * speak(id, text, lang, { sanskrit }) — or speak(id, sections) where each
     * section is { text, lang, sanskrit } (a śloka, then its meaning).
     */
    const speak = useCallback((id, input, lang = 'en', { sanskrit = false } = {}) => {
        if (!synth || !input) return;
        if (activeId.current === id) {
            stop();
            return;
        }
        clearTimers();
        synth.cancel();

        const sections = Array.isArray(input) ? input : [{ text: input, lang, sanskrit }];
        const playable = sections.filter((section) => section?.text && (section.lang !== 'hi' || pickVoice('hi')));
        const queue = [];
        playable.forEach((section, s) => {
            const phrases = phrasesOf(forSpeech(section.text, section.lang), { sanskrit: section.sanskrit });
            phrases.forEach((phrase, p) => {
                const last = p === phrases.length - 1;
                queue.push({
                    text: phrase.text,
                    lang: section.lang,
                    sanskrit: Boolean(section.sanskrit),
                    // The end of a sentence slows a little, as a reader's does.
                    slower: last || phrase.pause >= 420,
                    pause: last && s < playable.length - 1 ? 1100 : phrase.pause
                });
            });
        });
        if (!queue.length) return;

        activeId.current = id;
        setSpeakingId(id);
        duck?.(true);

        const finish = () => {
            if (activeId.current !== id) return;
            activeId.current = null;
            setSpeakingId(null);
            duck?.(false);
        };

        const say = (index) => {
            if (activeId.current !== id) return;
            if (index >= queue.length) {
                finish();
                return;
            }
            const item = queue[index];
            const utterance = new SpeechSynthesisUtterance(item.text);
            const voice = pickVoice(item.lang);
            if (voice) utterance.voice = voice;
            utterance.lang = voice?.lang || (item.lang === 'hi' ? 'hi-IN' : 'en-IN');
            const base = item.sanskrit ? 0.74 : item.lang === 'hi' ? 0.86 : 0.9;
            utterance.rate = item.slower ? base * 0.95 : base;
            // A little natural variation, so phrases do not sound stamped out.
            utterance.pitch = (item.sanskrit ? 0.94 : 1) + [0.03, -0.01, 0][index % 3];
            utterance.onend = () => {
                timers.current.push(setTimeout(() => say(index + 1), item.pause));
            };
            utterance.onerror = (event) => {
                if (event.error === 'interrupted' || event.error === 'canceled') return;
                timers.current.push(setTimeout(() => say(index + 1), 120));
            };
            synth.speak(utterance);
        };

        // A soft bell first, as at the start of a recitation.
        const bell = areChimesEnabled();
        if (bell) playChime('soft');
        timers.current.push(setTimeout(() => say(0), bell ? 700 : 0));
    }, [duck, stop]);

    return {
        speak,
        stop,
        speakingId,
        isSupported: Boolean(synth)
    };
}
