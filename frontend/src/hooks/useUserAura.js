import { useCallback, useEffect, useState } from 'react';

// The sanctuary keeps one nocturnal palette; what adapts is the *light*.
// Time of day tints the sky (see tokens.css [data-time]), and the chosen mood
// adds a soft aura in a soothing counter-colour — cool blue for anger, sage for
// stress — rather than mirroring the feeling back.

// Matches the mood words on the home page (MoodSelector) — lamplight hues.
const MOOD_AURAS = {
    anxious: '120, 186, 176',
    stressed: '150, 188, 150',
    overwhelmed: '150, 188, 150',
    angry: '120, 156, 218',
    confused: '170, 152, 216',
    lost: '170, 152, 216',
    sad: '140, 160, 214',
    lonely: '196, 160, 210',
    peace: '232, 178, 92',
    happy: '226, 156, 120',
    grateful: '226, 156, 120'
};

export function getTimeOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
}

export function getSkyPhase(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 9) return 'dawn';
    if (hour >= 9 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
}

export function useUserAura() {
    const [mood, setMood] = useState(null);

    const trackMood = useCallback((nextMood) => {
        setMood(nextMood || null);
    }, []);

    const clearMood = useCallback(() => setMood(null), []);

    useEffect(() => {
        const root = document.documentElement;
        const rgb = mood ? MOOD_AURAS[mood] || MOOD_AURAS.peace : null;
        root.style.setProperty('--mood-rgb', rgb || '220, 150, 64');
        root.style.setProperty('--mood-strength', rgb ? '0.11' : '0');
    }, [mood]);

    // Kept for API compatibility; breath mode no longer changes the palette.
    const trackBreathMode = useCallback(() => {}, []);

    return {
        aura: { mood },
        trackMood,
        clearMood,
        trackBreathMode
    };
}
