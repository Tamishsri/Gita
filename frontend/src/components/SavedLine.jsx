import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { SAVED_LINE_EVENT, readSavedLine, releaseSavedLine } from '../lib/verse';

function relativeDay(iso) {
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// One line, held lightly. Saving another lets this one fade (aparigraha).
function SavedLine() {
    const [line, setLine] = useState(readSavedLine);

    useEffect(() => {
        const update = () => setLine(readSavedLine());
        window.addEventListener(SAVED_LINE_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(SAVED_LINE_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, []);

    return (
        <AnimatePresence>
            {line && (
                <motion.section
                    key={line.savedAt}
                    className="saved-line"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    aria-label="Your saved line"
                >
                    <div className="saved-line__head">
                        <span className="eyebrow"><Heart size={12} /> Your saved line</span>
                        <button type="button" className="btn btn--link btn--sm" onClick={releaseSavedLine} title="Let this line fade away">
                            Let go
                        </button>
                    </div>
                    <p className="saved-line__text">{line.text}</p>
                    <span className="saved-line__meta">
                        {line.citation ? `${line.citation} · ` : ''}saved {relativeDay(line.savedAt)}
                    </span>
                </motion.section>
            )}
        </AnimatePresence>
    );
}

export default SavedLine;
