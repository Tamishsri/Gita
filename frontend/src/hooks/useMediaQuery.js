import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia(query).matches
            : false
    );

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined;
        const list = window.matchMedia(query);
        const update = () => setMatches(list.matches);
        update();
        list.addEventListener('change', update);
        return () => list.removeEventListener('change', update);
    }, [query]);

    return matches;
}

export const MOBILE_QUERY = '(max-width: 639px)';

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

// True on devices with a real keyboard + fine pointer, where shortcut hints help.
export const useHasKeyboard = () => useMediaQuery('(hover: hover) and (pointer: fine)');
