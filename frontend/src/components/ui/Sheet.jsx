import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLayer } from '../../lib/layers';
import { haptic } from '../../lib/haptics';
import { useIsMobile } from '../../hooks/useMediaQuery';

// One surface, two shapes: a centred glass modal on desktop and a draggable
// bottom sheet with a pull handle on phones (< 640px). Rendered into <body>
// so transformed ancestors can never trap it, and registered as a layer so
// Escape always closes the top-most one.

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

    useLayer(isOpen, { onEscape: onEscape || onClose, blocksHotkeys });

    const panelMotion = isMobile
        ? {
            initial: { y: '100%' },
            animate: { y: 0 },
            exit: { y: '100%' },
            transition: reduceMotion ? { duration: 0 } : { type: 'spring', damping: 38, stiffness: 340, mass: 0.9 }
        }
        : {
            initial: { opacity: 0, y: 18, scale: 0.985 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 12, scale: 0.99 },
            transition: { duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }
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
                    transition={{ duration: reduceMotion ? 0 : 0.24 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
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
                            <div
                                className="sheet__grip"
                                onPointerDown={(event) => dragControls.start(event)}
                                aria-hidden="true"
                            >
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
    const fallbackId = useId();
    return (
        <header className="sheet__header">
            {leading}
            {!leading && Icon && (
                <span className="sheet__icon" aria-hidden="true">
                    <Icon size={18} />
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
                    <button type="button" className="icon-btn icon-btn--sm icon-btn--plain" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                )}
            </div>
        </header>
    );
}

export default Sheet;
