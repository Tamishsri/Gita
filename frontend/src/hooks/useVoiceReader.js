import { useCallback, useEffect, useRef, useState } from 'react';
import { useSoundscape } from '../components/SoundscapeEngine';
import { areChimesEnabled, playChime } from '../lib/chime';
import { getAudioContext } from '../lib/audio';
import { forSpeech, phrasesOf, pickVoice, speechSupported } from '../lib/speech';
import { loadRecitation, playRecitation, recitationVoice } from '../lib/recitation';
import { speechSectionsFor } from '../lib/verse';

// Reading a verse aloud the way a person recites it — not the way a machine
// reads a paragraph.
//
// With a human voice on the server (ElevenLabs, see lib/recitation): a soft
// bell, the śloka, a breath, then its meaning — real recordings, generated
// once per verse and kept on the device.
//
// Otherwise the device's own voice, shaped to sound as human as it can:
//   · the most natural voice the device has, an Indian voice for Hindi and
//     Sanskrit (and the śloka is skipped, not mangled, when there is none)
//   · the śloka unhurried, resting at each half-line
//   · the meaning phrase by phrase, with the breaths a reader takes
//
// Either way the ambient sound dips while the voice speaks, and returns after.

const synth = speechSupported() ? window.speechSynthesis : null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useVoiceReader() {
    const [speakingId, setSpeakingId] = useState(null);
    const [preparingId, setPreparingId] = useState(null);
    const activeId = useRef(null);
    const timers = useRef([]);
    const playing = useRef(null);
    const loading = useRef(null);
    const { duck } = useSoundscape();

    // Ask early whether a human voice is available, so the first tap is quick.
    useEffect(() => { recitationVoice(); }, []);

    // Everything that could be sounding, or about to: stopped. (Refs only, so it never changes.)
    const silence = useCallback(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        synth?.cancel();
        playing.current?.stop();
        playing.current = null;
        loading.current?.abort();
        loading.current = null;
    }, []);

    useEffect(() => () => {
        if (activeId.current) silence();
    }, [silence]);

    const stop = useCallback(() => {
        silence();
        if (activeId.current) duck?.(false);
        activeId.current = null;
        setSpeakingId(null);
        setPreparingId(null);
    }, [duck, silence]);

    const finish = useCallback((id) => {
        if (activeId.current !== id) return;
        activeId.current = null;
        setSpeakingId(null);
        setPreparingId(null);
        duck?.(false);
    }, [duck]);

    // The device's voice, phrase by phrase. Assumes `id` is already the active one.
    const speakSections = useCallback((id, sections, { bell = false } = {}) => {
        if (!synth) {
            finish(id);
            return;
        }
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
        if (!queue.length) {
            finish(id);
            return;
        }

        const say = (index) => {
            if (activeId.current !== id) return;
            if (index >= queue.length) {
                finish(id);
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

        if (bell && areChimesEnabled()) {
            playChime('soft');
            timers.current.push(setTimeout(() => say(0), 700));
        } else {
            say(0);
        }
    }, [finish]);

    const begin = (id) => {
        silence();
        activeId.current = id;
        setSpeakingId(id);
        duck?.(true);
    };

    /**
     * speak(id, text, lang, { sanskrit }) — or speak(id, sections) where each
     * section is { text, lang, sanskrit }. Always the device's voice.
     */
    const speak = useCallback((id, input, lang = 'en', { sanskrit = false } = {}) => {
        if (!synth || !input) return;
        if (activeId.current === id) {
            stop();
            return;
        }
        begin(id);
        const sections = Array.isArray(input) ? input : [{ text: input, lang, sanskrit }];
        speakSections(id, sections, { bell: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speakSections, stop]);

    /**
     * Recite a verse: the śloka, then its meaning (or only the parts asked for),
     * in the human voice when there is one, otherwise the device's.
     */
    const recite = useCallback((id, verse, language = 'en', { parts = ['sloka', 'meaning'] } = {}) => {
        if (!verse) return;
        if (activeId.current === id) {
            stop();
            return;
        }
        begin(id);
        // Inside the tap: wakes the audio engine (iOS only allows that here).
        const context = getAudioContext();
        const ringing = areChimesEnabled();
        if (ringing) playChime('soft');
        const startedAt = Date.now();
        setPreparingId(id);

        const deviceVoice = (from = 0) => {
            if (activeId.current !== id) return;
            setPreparingId(null);
            const [sloka, meaning, source] = speechSectionsFor(verse, language);
            const byPart = { sloka: verse.sanskrit ? [sloka] : [], meaning: verse.sanskrit ? [meaning, source] : [sloka, meaning].filter(Boolean) };
            const sections = parts.slice(from).flatMap((part) => byPart[part] || []).filter(Boolean);
            if (!synth || !sections.length) {
                finish(id);
                return;
            }
            speakSections(id, sections, { bell: false });
        };

        (async () => {
            const voice = context ? await recitationVoice() : null;
            if (activeId.current !== id) return;
            const wanted = parts.filter((part) => part !== 'sloka' || verse.sanskrit);
            if (!voice || !wanted.length) {
                if (ringing) await wait(Math.max(0, 700 - (Date.now() - startedAt)));
                deviceVoice();
                return;
            }
            const controller = new AbortController();
            loading.current = controller;
            // Every part starts loading now; each plays as soon as the one before it ends.
            const loads = wanted.map((part) => loadRecitation(verse.id, part, language, voice.revision, controller.signal));
            loads.forEach((load) => load.catch(() => {}));
            for (let i = 0; i < loads.length; i++) {
                let buffer;
                try {
                    buffer = await loads[i];
                } catch {
                    if (activeId.current === id) deviceVoice(parts.indexOf(wanted[i]));
                    return;
                }
                if (activeId.current !== id) return;
                if (i === 0) {
                    setPreparingId(null);
                    // Let the bell ring out before the first word.
                    if (ringing) await wait(Math.max(0, 900 - (Date.now() - startedAt)));
                    if (activeId.current !== id) return;
                }
                const playback = playRecitation(buffer);
                playing.current = playback;
                await playback.done;
                if (activeId.current !== id) return;
                playing.current = null;
                // A breath between the śloka and its meaning.
                if (i < loads.length - 1) await wait(850);
            }
            loading.current = null;
            finish(id);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finish, speakSections, stop]);

    return {
        speak,
        recite,
        stop,
        speakingId,
        preparingId,
        // A verse can always be recited: by the human voice, or the device's.
        isSupported: Boolean(synth) || Boolean(typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    };
}
