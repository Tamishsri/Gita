import { useCallback, useEffect, useState } from 'react';

// The sanctuary keeps one nocturnal palette; what adapts is the *light*.
// Time of day tints the sky (see tokens.css [data-time]), and the chosen mood
// adds a soft aura in a soothing counter-colour — cool blue for anger, sage for
// stress — rather than mirroring the feeling back.

const MOOD_AURAS = {
    anxious: '110, 184, 172',
    stressed: '140, 186, 146',
    overwhelmed: '140, 186, 146',
    angry: '104, 146, 214',
    confused: '164, 146, 214',
    lost: '164, 146, 214',
    sad: '128, 150, 210',
    peace: '212, 175, 55',
    happy: '222, 152, 118',
    grateful: '222, 152, 118'
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
        root.style.setProperty('--mood-rgb', rgb || '212, 175, 55');
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
