import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import LotusMark from './ui/LotusMark';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'lgInstallDismissed';

export function IosInstallSteps() {
    return (
        <div className="ios-steps">
            <ol>
                <li><Share size={15} aria-hidden="true" /> Tap <strong>Share</strong> in Safari’s toolbar</li>
                <li><PlusSquare size={15} aria-hidden="true" /> Choose <strong>Add to Home Screen</strong></li>
            </ol>
        </div>
    );
}

// A quiet invitation on the home screen; also available in Preferences.
function InstallCard() {
    const install = useInstallPrompt();
    const [dismissed, setDismissed] = useState(() => Boolean(localStorage.getItem(DISMISS_KEY)));
    const [showSteps, setShowSteps] = useState(false);

    const visible = install.available && !dismissed;

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, new Date().toISOString());
        setDismissed(true);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.section
                    className="card install-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, padding: 0 }}
                    aria-label="Install Living Gita"
                >
                    <span className="install-card__mark"><LotusMark size={30} /></span>
                    <div className="install-card__body">
                        <strong>Keep the sanctuary close</strong>
                        <p>Install Living Gita — it opens like an app and works offline.</p>
                    </div>
                    {install.needsIosInstructions && showSteps && <IosInstallSteps />}
                    <div className="install-card__actions">
                        {install.canPrompt ? (
                            <button type="button" className="btn btn--gold btn--sm" onClick={install.install}>
                                <Download size={14} /> Install
                            </button>
                        ) : (
                            <button type="button" className="btn btn--gold btn--sm" onClick={() => setShowSteps((value) => !value)}>
                                <PlusSquare size={14} /> {showSteps ? 'Hide steps' : 'Add to Home Screen'}
                            </button>
                        )}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss}>
                            <X size={14} /> Not now
                        </button>
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
}

export default InstallCard;
