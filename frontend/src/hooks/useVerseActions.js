import { useCallback } from 'react';
import { useVoiceReader } from './useVoiceReader';
import {
    copyText, openWisdomCard, saveLine, speechTextFor, verseKey, verseMeaning, verseRef, verseShareText
} from '../lib/verse';
import { startJourney } from '../lib/journey';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';

// Every surface that shows a verse offers the same gestures — copy, save,
// walk, card, listen — so they live here once.
export function useVerseActions(language = 'en') {
    const { speak, stop, speakingId, isSupported } = useVoiceReader();

    const copy = useCallback(async (verse) => {
        const ok = await copyText(verseShareText(verse, language));
        toast(ok ? `Bhagavad Gita ${verseRef(verse)} copied` : 'Copying is blocked here — try selecting the text instead.', {
            icon: ok ? 'check' : undefined
        });
        return ok;
    }, [language]);

    const save = useCallback((verse) => {
        const result = saveLine(verseMeaning(verse, language) || verse.sanskrit, verse);
        toast(result.replaced ? 'Line saved — the previous one has gently faded.' : 'Line saved. It will greet you on the home screen.', {
            icon: 'heart',
            tone: 'gold'
        });
    }, [language]);

    const walk = useCallback((verse) => {
        const result = startJourney(verse);
        if (result.ok) {
            playChime('soft');
            haptic('success');
            toast(`Your 7-day walk with ${verseRef(verse)} begins today.`, { icon: 'walk', tone: 'gold' });
        } else {
            toast(`You are already walking with ${verseRef(result.journey.verse)}. Release it from the home screen to begin anew.`, {
                icon: 'walk',
                duration: 5200
            });
        }
        return result.ok;
    }, []);

    const card = useCallback((verse) => openWisdomCard(verse, language), [language]);

    const listen = useCallback((verse, id = verseKey(verse)) => {
        if (speakingId === id) {
            stop();
        } else {
            speak(id, speechTextFor(verse, language), language);
        }
    }, [language, speak, speakingId, stop]);

    return { copy, save, walk, card, listen, stop, speakingId, canListen: isSupported };
}
