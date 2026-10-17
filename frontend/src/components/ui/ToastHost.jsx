import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Download, RefreshCw, Sparkles, Waves, WifiOff, Feather, Heart, Footprints } from 'lucide-react';
import { TOAST_EVENT } from '../../lib/toast';

const ICONS = {
    check: Check,
    install: Download,
    refresh: RefreshCw,
    offline: WifiOff,
    sound: Waves,
    journal: Feather,
    heart: Heart,
    walk: Footprints
};

const MAX_VISIBLE = 3;

function ToastHost() {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    useEffect(() => {
        const dismiss = (id) => {
            clearTimeout(timers.current.get(id));
            timers.current.delete(id);
            setToasts((list) => list.filter((item) => item.id !== id));
        };

        const onToast = (event) => {
            const item = event.detail;
            setToasts((list) => {
                // Repeating a message replaces the old one instead of stacking it.
                list
                    .filter((existing) => existing.message === item.message)
                    .forEach((existing) => clearTimeout(timers.current.get(existing.id)));
                const others = list.filter((existing) => existing.message !== item.message);
                return [...others, item].slice(-MAX_VISIBLE);
            });
            timers.current.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
        };

        window.addEventListener(TOAST_EVENT, onToast);
        const pending = timers.current;
        return () => {
            window.removeEventListener(TOAST_EVENT, onToast);
            pending.forEach(clearTimeout);
        };
    }, []);

    const runAction = (item) => {
        item.action.onClick();
        clearTimeout(timers.current.get(item.id));
        setToasts((list) => list.filter((existing) => existing.id !== item.id));
    };

    // In a portal, so toasts stay usable while a modal makes the page inert.
    return createPortal(
        <div className="toast-host" role="status" aria-live="polite">
            <AnimatePresence initial={false}>
                {toasts.map((item) => {
                    const Icon = ICONS[item.icon] || Sparkles;
                    return (
                        <motion.div
                            key={item.id}
                            layout
                            className={`toast toast--${item.tone}`}
                            initial={{ opacity: 0, y: -14, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <Icon className="toast__icon" size={16} aria-hidden="true" />
                            <span className="toast__message">{item.message}</span>
                            {item.action && (
                                <button type="button" className="btn btn--gold btn--sm toast__action" onClick={() => runAction(item)}>
                                    {item.action.label}
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>,
        document.body
    );
}

export default ToastHost;
