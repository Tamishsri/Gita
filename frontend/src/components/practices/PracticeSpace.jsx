import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLayer } from '../../lib/layers';
import { useI18n } from '../../i18n';

// A full-screen room for a practice: nothing else on the page, one thing at a
// time, the lamplight behind. Escape (or ×) leaves; focus is held inside.
function PracticeSpace({ isOpen, onClose, eyebrow, title, verseRef, children, className = '' }) {
    const { t } = useI18n();
    const reduceMotion = useReducedMotion();
    const panelRef = useRef(null);
    useLayer(isOpen, { onEscape: onClose, blocksHotkeys: true });

    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.activeElement;
        requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
        return () => {
            if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
        };
    }, [isOpen]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className={`practice-space ${className}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.6 }}
                >
                    <div className="practice-space__atmosphere" aria-hidden="true" />
                    <header className="practice-space__head">
                        <div className="practice-space__titles">
                            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                            <h2>{title}</h2>
                            {verseRef && <span className="practice-space__ref">{t('verse.bg')} {verseRef}</span>}
                        </div>
                        <button type="button" className="icon-btn icon-btn--ring" onClick={onClose} aria-label={t('common.close')}>
                            <X size={18} />
                        </button>
                    </header>
                    <motion.div
                        ref={panelRef}
                        tabIndex={-1}
                        className="practice-space__body"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default PracticeSpace;
