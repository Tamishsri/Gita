import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { Diya } from './ui/Ornaments';
import { useI18n } from '../i18n';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'lgInstallDismissed';

export function IosInstallSteps() {
    const { t } = useI18n();
    return (
        <div className="ios-steps">
            <ol>
                <li><Share size={15} aria-hidden="true" /> {t('install.ios.one')}</li>
                <li><PlusSquare size={15} aria-hidden="true" /> {t('install.ios.two')}</li>
            </ol>
        </div>
    );
}

// A quiet invitation on the home screen; also available in Preferences.
function InstallCard() {
    const { t } = useI18n();
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
                    aria-label={t('install.title')}
                >
                    <span className="install-card__mark"><Diya size={40} steady /></span>
                    <div className="install-card__body">
                        <strong>{t('install.cardTitle')}</strong>
                        <p>{t('install.cardBody')}</p>
                    </div>
                    {install.needsIosInstructions && showSteps && <IosInstallSteps />}
                    <div className="install-card__actions">
                        {install.canPrompt ? (
                            <button type="button" className="btn btn--gold btn--sm" onClick={install.install}>
                                <Download size={14} /> {t('install.short')}
                            </button>
                        ) : (
                            <button type="button" className="btn btn--gold btn--sm" onClick={() => setShowSteps((value) => !value)}>
                                <PlusSquare size={14} /> {showSteps ? t('install.hideSteps') : t('install.addHome')}
                            </button>
                        )}
                        <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss}>
                            <X size={14} /> {t('common.notNow')}
                        </button>
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
}

export default InstallCard;
