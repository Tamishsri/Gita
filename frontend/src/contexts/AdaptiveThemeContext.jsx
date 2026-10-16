import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSkyPhase, getTimeOfDay } from '../hooks/useUserAura';

const AdaptiveThemeContext = createContext({ timeOfDay: 'afternoon', phase: 'day' });

export function useAdaptiveTheme() {
    return useContext(AdaptiveThemeContext);
}

// Tracks the hour and paints the matching sky onto <html data-time="…">.
export function AdaptiveThemeProvider({ children }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const phase = getSkyPhase(now);
    const timeOfDay = getTimeOfDay(now);

    useEffect(() => {
        document.documentElement.dataset.time = phase;
    }, [phase]);

    const value = useMemo(() => ({ timeOfDay, phase, now }), [timeOfDay, phase, now]);

    return <AdaptiveThemeContext.Provider value={value}>{children}</AdaptiveThemeContext.Provider>;
}
