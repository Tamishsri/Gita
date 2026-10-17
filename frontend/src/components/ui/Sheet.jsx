import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLayer } from '../../lib/layers';
import { haptic } from '../../lib/haptics';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useI18n } from '../../i18n';

// One surface, two shapes: a centred page on desktop and a draggable bottom
// sheet with a pull handle on phones (< 640px). Rendered into <body> so
// transformed ancestors can never trap it; registered as a layer so Escape
// closes the top-most one and the page behind becomes inert. Focus moves in
// on open and returns where it was on close.

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 650;

function Sheet({
    isOpen,
    onClose,
    onEscape,
    label,
    width = 560,
    size = 'auto',
    blocksHotkeys = false,
    className = '',
    children
}) {
    const isMobile = useIsMobile();
    const dragControls = useDragControls();
    const reduceMotion = useReducedMotion();
    const panelRef = useRef(null);

    useLayer(isOpen, { onEscape: onEscape || onClose, blocksHotkeys });

    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.activeElement;
        const frame = requestAnimationFrame(() => {
            const panel = panelRef.current;
            if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
        });
        return () => {
            cancelAnimationFrame(frame);
            if (previous instanceof HTMLElement && document.contains(previous)) {
                requestAnimationFrame(() => previous.focus({ preventScroll: true }));
            }
        };
    }, [isOpen]);

    const panelMotion = isMobile
        ? {
            initial: { y: '100%' },
            animate: { y: 0 },
            exit: { y: '100%' },
            transition: reduceMotion ? { duration: 0 } : { type: 'spring', damping: 40, stiffness: 320, mass: 0.95 }
        }
        : {
            initial: { opacity: 0, y: 16 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 10 },
            transition: { duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }
        };

    const handleDragEnd = (_, info) => {
        if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) {
            haptic('soft');
            onClose();
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="sheet"
                    className={`sheet-overlay${isMobile ? ' sheet-overlay--mobile' : ''}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.28 }}
                    onClick={onClose}
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                        tabIndex={-1}
                        className={`sheet sheet--${size}${isMobile ? ' sheet--mobile' : ''} ${className}`}
                        style={isMobile ? undefined : { maxWidth: width }}
                        onClick={(event) => event.stopPropagation()}
                        drag={isMobile ? 'y' : false}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0.04, bottom: 0.85 }}
                        onDragEnd={handleDragEnd}
                        {...panelMotion}
                    >
                        {isMobile && (
                            <div className="sheet__grip" onPointerDown={(event) => dragControls.start(event)} aria-hidden="true">
                                <span />
                            </div>
                        )}
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export function SheetHeader({ icon: Icon, eyebrow, title, subtitle, onClose, actions, leading, titleId }) {
    const { t } = useI18n();
    const fallbackId = useId();
    return (
        <header className="sheet__header">
            {leading}
            {!leading && Icon && (
                <span className="sheet__icon" aria-hidden="true">
                    <Icon size={20} />
                </span>
            )}
            <div className="sheet__titles">
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h2 id={titleId || fallbackId} className="sheet__title">{title}</h2>
                {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
            </div>
            <div className="sheet__actions">
                {actions}
                {onClose && (
                    <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label={t('common.close')}>
                        <X size={18} />
                    </button>
                )}
            </div>
        </header>
    );
}

export default Sheet;
