import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SAVED_LINE_EVENT, readSavedLine, releaseSavedLine } from '../lib/verse';
import { useI18n, localeFor } from '../i18n';

function relativeDay(iso, t, lang) {
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return t('time.today');
    if (days === 1) return t('time.yesterday');
    if (days < 7) return t('time.daysAgo', { count: days });
    return new Date(iso).toLocaleDateString(localeFor(lang), { month: 'short', day: 'numeric' });
}

// One line, held lightly — a bookmark. Keeping another lets this one fade
// (aparigraha).
function SavedLine() {
    const { t, lang } = useI18n();
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    aria-label={t('saved.title')}
                >
                    <div className="saved-line__head">
                        <span className="eyebrow">{t('saved.title')}</span>
                        <button type="button" className="btn btn--link btn--sm" onClick={releaseSavedLine} title={t('saved.letGoHint')}>
                            {t('saved.letGo')}
                        </button>
                    </div>
                    <p className="saved-line__text">{line.text}</p>
                    <span className="saved-line__meta">
                        {line.citation ? `${line.citation} · ` : ''}{t('saved.when', { when: relativeDay(line.savedAt, t, lang) })}
                    </span>
                </motion.section>
            )}
        </AnimatePresence>
    );
}

export default SavedLine;
