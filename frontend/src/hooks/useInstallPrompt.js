import { useCallback, useEffect, useState } from 'react';
import { INSTALL_EVENT, getInstallState, promptInstall } from '../pwa/registerServiceWorker';

export function useInstallPrompt() {
    const [state, setState] = useState(getInstallState);

    useEffect(() => {
        const update = () => setState(getInstallState());
        window.addEventListener(INSTALL_EVENT, update);
        const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
        standaloneQuery?.addEventListener('change', update);
        return () => {
            window.removeEventListener(INSTALL_EVENT, update);
            standaloneQuery?.removeEventListener('change', update);
        };
    }, []);

    const install = useCallback(async () => {
        const outcome = await promptInstall();
        setState(getInstallState());
        return outcome;
    }, []);

    return {
        ...state,
        available: !state.standalone && (state.canPrompt || state.needsIosInstructions),
        install
    };
}
