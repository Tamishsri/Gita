import { useCallback, useEffect, useRef, useState } from 'react';

// Text-to-speech for verses with a calm, contemplative pace. Voices load
// asynchronously in Chromium, so the list is cached on `voiceschanged`.

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let cachedVoices = synth ? synth.getVoices() : [];

if (synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => {
        cachedVoices = synth.getVoices();
    });
}

const PREFERRED_EN = ['Natural', 'Serena', 'Samantha', 'Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny', 'Daniel'];

function pickVoice(lang) {
    const voices = cachedVoices.length ? cachedVoices : synth?.getVoices() || [];
    if (lang === 'hi') {
        return voices.find((voice) => voice.lang?.toLowerCase().startsWith('hi')) || null;
    }
    for (const name of PREFERRED_EN) {
        const match = voices.find((voice) => voice.name.includes(name) && voice.lang?.startsWith('en'));
        if (match) return match;
    }
    return voices.find((voice) => voice.lang === 'en-GB') || voices.find((voice) => voice.lang?.startsWith('en')) || null;
}

export function useVoiceReader() {
    const [speakingId, setSpeakingId] = useState(null);
    const activeId = useRef(null);

    useEffect(() => () => {
        if (activeId.current) synth?.cancel();
    }, []);

    const stop = useCallback(() => {
        synth?.cancel();
        activeId.current = null;
        setSpeakingId(null);
    }, []);

    const speak = useCallback((id, text, lang = 'en') => {
        if (!synth || !text) return;

        if (activeId.current === id) {
            stop();
            return;
        }

        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(lang);
        if (voice) utterance.voice = voice;
        utterance.lang = lang === 'hi' ? 'hi-IN' : voice?.lang || 'en-US';
        utterance.rate = 0.86;
        utterance.pitch = 0.96;

        const finish = () => {
            if (activeId.current !== id) return;
            activeId.current = null;
            setSpeakingId(null);
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        activeId.current = id;
        setSpeakingId(id);
        synth.speak(utterance);
    }, [stop]);

    return {
        speak,
        stop,
        speakingId,
        isSupported: Boolean(synth)
    };
}
