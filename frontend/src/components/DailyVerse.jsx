import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Volume2, Square, Copy, Heart, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { fetchDaily } from '../lib/gitaApi';
import { sanskritLines, verseMeaning, verseRef } from '../lib/verse';
import { useVerseActions } from '../hooks/useVerseActions';

function DailyVerse({ language = 'en', onSelectVerse }) {
    const [state, setState] = useState({ status: 'loading', verse: null });
    const reduceMotion = useReducedMotion();
    const { copy, save, card, listen, speakingId, canListen } = useVerseActions(language);

    useEffect(() => {
        let alive = true;
        fetchDaily()
            .then((data) => alive && setState({ status: data?.verse ? 'ready' : 'empty', verse: data?.verse || null }))
            .catch(() => alive && setState({ status: 'error', verse: null }));
        return () => {
            alive = false;
        };
    }, []);

    const today = new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    if (state.status === 'error' || state.status === 'empty') return null;

    if (state.status === 'loading') {
        return (
            <section className="section" aria-busy="true">
                <div className="section__head">
                    <span className="eyebrow"><Sparkles size={13} /> Verse for today</span>
                </div>
                <div className="card card--featured daily-verse">
                    <div className="skeleton" style={{ height: 22, width: '82%', margin: '0 auto 10px' }} />
                    <div className="skeleton" style={{ height: 22, width: '70%', margin: '0 auto 24px' }} />
                    <div className="skeleton" style={{ height: 16, width: '92%', margin: '0 auto 8px' }} />
                    <div className="skeleton" style={{ height: 16, width: '64%', margin: '0 auto' }} />
                </div>
            </section>
        );
    }

    const { verse } = state;
    const key = `daily_${verse.id}`;
    const isSpeaking = speakingId === key;
    const meaning = verseMeaning(verse, language);

    return (
        <section className="section" aria-labelledby="daily-verse-title">
            <div className="section__head">
                <span className="eyebrow" id="daily-verse-title"><Sparkles size={13} /> Verse for today</span>
                <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>{today}</span>
            </div>

            <motion.article
                className="card card--featured daily-verse"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
                <span className="daily-verse__glow" aria-hidden="true" />
                {verse.sanskrit && (
                    <p className="sanskrit daily-verse__sanskrit" lang="sa">
                        {sanskritLines(verse.sanskrit).map((line, index) => <span key={index}>{line}</span>)}
                    </p>
                )}
                <div className="ornament" aria-hidden="true"><span className="ornament__gem" /></div>
                <blockquote className={`translation daily-verse__meaning${language === 'hi' && verse.meaning_hi ? ' translation--hi' : ''}`}>
                    {meaning}
                </blockquote>

                <footer className="daily-verse__foot">
                    <span className="eyebrow eyebrow--muted">Bhagavad Gita · {verseRef(verse)}</span>
                    <div className="daily-verse__tools">
                        {canListen && (
                            <button type="button" className={`icon-btn icon-btn--sm${isSpeaking ? ' is-on' : ''}`} onClick={() => listen(verse, key)} aria-label={isSpeaking ? 'Stop listening' : 'Listen'} title={isSpeaking ? 'Stop' : 'Listen'}>
                                {isSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={15} />}
                            </button>
                        )}
                        <button type="button" className="icon-btn icon-btn--sm" onClick={() => copy(verse)} aria-label="Copy verse" title="Copy">
                            <Copy size={15} />
                        </button>
                        <button type="button" className="icon-btn icon-btn--sm" onClick={() => save(verse)} aria-label="Save this line" title="Save line">
                            <Heart size={15} />
                        </button>
                        <button type="button" className="icon-btn icon-btn--sm" onClick={() => card(verse)} aria-label="Create a wisdom card" title="Wisdom card">
                            <ImageIcon size={15} />
                        </button>
                        {onSelectVerse && (
                            <button type="button" className="btn btn--outline btn--sm" onClick={() => onSelectVerse(verse)}>
                                Sit with it
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                </footer>
            </motion.article>
        </section>
    );
}

export default DailyVerse;
