import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Volume2, Square, Heart, Image as ImageIcon, ArrowRight } from 'lucide-react';
import Sloka from './Sloka';
import { KolamRule } from './ui/Ornaments';
import { fetchDaily } from '../lib/gitaApi';
import { verseMeaning, verseRef } from '../lib/verse';
import { useVerseActions } from '../hooks/useVerseActions';
import { useI18n } from '../i18n';

// One verse for the day, set like a page of a manuscript.
function DailyVerse({ language = 'en', onSelectVerse }) {
    const { t } = useI18n();
    const [state, setState] = useState({ status: 'loading', verse: null });
    const reduceMotion = useReducedMotion();
    const { save, card, listen, speakingId, canListen } = useVerseActions(language);

    useEffect(() => {
        let alive = true;
        fetchDaily()
            .then((data) => alive && setState({ status: data?.verse ? 'ready' : 'empty', verse: data?.verse || null }))
            .catch(() => alive && setState({ status: 'error', verse: null }));
        return () => {
            alive = false;
        };
    }, []);

    if (state.status === 'error' || state.status === 'empty') return null;

    if (state.status === 'loading') {
        return (
            <section className="section" aria-busy="true">
                <div className="section__head section__head--center">
                    <span className="eyebrow">{t('daily.title')}</span>
                </div>
                <div className="card card--featured daily-verse">
                    <div className="skeleton" style={{ height: 22, width: '78%', margin: '0 auto 12px' }} />
                    <div className="skeleton" style={{ height: 22, width: '64%', margin: '0 auto 28px' }} />
                    <div className="skeleton" style={{ height: 16, width: '88%', margin: '0 auto 10px' }} />
                    <div className="skeleton" style={{ height: 16, width: '60%', margin: '0 auto' }} />
                </div>
            </section>
        );
    }

    const { verse } = state;
    const key = `daily_${verse.id}`;
    const speaking = speakingId === key;
    const meaning = verseMeaning(verse, language);
    const simple = verse.notification_short && (verse.notification_short[language] || verse.notification_short.en);

    return (
        <section className="section" aria-labelledby="daily-verse-title">
            <div className="section__head section__head--center">
                <span className="eyebrow" id="daily-verse-title">{t('daily.title')}</span>
            </div>

            <motion.article
                className="card card--featured daily-verse"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
                <span className="daily-verse__ref">{t('verse.bg')} · {verseRef(verse)}</span>
                {simple && <p className={`verse-heart${language === 'hi' ? ' verse-heart--hi' : ''}`}>{simple}</p>}
                <Sloka verse={verse} className="daily-verse__sanskrit" />
                <KolamRule width={160} />
                {simple ? (
                    <details className="verse-full">
                        <summary>{t('verse.fullMeaning')}</summary>
                        <blockquote className={`translation daily-verse__meaning${language === 'hi' && verse.meaning_hi ? ' translation--hi' : ''}`}>
                            {meaning}
                        </blockquote>
                    </details>
                ) : (
                    <blockquote className={`translation daily-verse__meaning${language === 'hi' && verse.meaning_hi ? ' translation--hi' : ''}`}>
                        {meaning}
                    </blockquote>
                )}

                <footer className="text-actions">
                    {canListen && (
                        <button type="button" className={`text-action${speaking ? ' is-on' : ''}`} onClick={() => listen(verse, key)}>
                            {speaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={15} />}
                            {speaking ? t('verse.stop') : t('verse.listen')}
                        </button>
                    )}
                    <button type="button" className="text-action" onClick={() => save(verse)}>
                        <Heart size={15} /> {t('verse.keep')}
                    </button>
                    <button type="button" className="text-action" onClick={() => card(verse)}>
                        <ImageIcon size={15} /> {t('verse.card')}
                    </button>
                    {onSelectVerse && (
                        <button type="button" className="text-action" onClick={() => onSelectVerse(verse)}>
                            {t('verse.sitWith')} <ArrowRight size={14} />
                        </button>
                    )}
                </footer>
            </motion.article>
        </section>
    );
}

export default DailyVerse;
