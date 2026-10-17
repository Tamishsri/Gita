import { useCallback } from 'react';
import { useVoiceReader } from './useVoiceReader';
import {
    copyText, openWisdomCard, saveLine, speechTextFor, verseKey, verseMeaning, verseRef, verseShareText
} from '../lib/verse';
import { startJourney } from '../lib/journey';
import { recordPath } from '../lib/path';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';
import { t } from '../i18n';

// Every surface that shows a verse offers the same gestures — copy, keep,
// walk, card, listen — so they live here once.
export function useVerseActions(language = 'en') {
    const { speak, stop, speakingId, isSupported } = useVoiceReader();

    const copy = useCallback(async (verse) => {
        const ok = await copyText(verseShareText(verse, language));
        toast(ok ? t('toast.verseCopied', { ref: verseRef(verse) }) : t('toast.copyBlocked'), { icon: ok ? 'check' : undefined });
        return ok;
    }, [language]);

    const save = useCallback((verse) => {
        const result = saveLine(verseMeaning(verse, language) || verse.sanskrit, verse);
        toast(result.replaced ? t('toast.lineReplaced') : t('toast.lineKept'), { icon: 'heart', tone: 'gold' });
    }, [language]);

    const walk = useCallback((verse) => {
        const result = startJourney(verse);
        if (result.ok) {
            playChime('soft');
            haptic('success');
            recordPath('walk', { verseId: verse.id, day: 0 });
            toast(t('toast.walkBegins', { ref: verseRef(verse) }), { icon: 'walk', tone: 'gold' });
        } else {
            toast(t('toast.walkActive', { ref: verseRef(result.journey.verse) }), { icon: 'walk', duration: 5200 });
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
