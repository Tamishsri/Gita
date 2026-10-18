import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Volume2, Square, Heart, Image as ImageIcon, ArrowRight } from 'lucide-react';
import Sloka from './Sloka';
import { KolamRule } from './ui/Ornaments';
import { fetchDaily } from '../lib/gitaApi';
import { verseMeaning, verseRef } from '../lib/verse';
import { loadCorpus, loadEngine } from '../lib/localSakha';
import { buildPerson } from '../lib/person';
import { localDateKey, recentVerseIds } from '../lib/path';
import { usePreferences } from '../contexts/PreferencesContext';
import { useVerseActions } from '../hooks/useVerseActions';
import { useI18n } from '../i18n';

// One verse for the day, set like a page of a manuscript. Once Sakha knows
// a person a little, it is *their* verse — chosen on their device from what
// has been on their heart, with a line saying why.
function DailyVerse({ language = 'en', onSelectVerse }) {
    const { t } = useI18n();
    const { settings } = usePreferences();
    const [state, setState] = useState({ status: 'loading', verse: null });
    const [personal, setPersonal] = useState(null); // { verse, reason }
    const [showShared, setShowShared] = useState(false);
    const reduceMotion = useReducedMotion();
    const { save, card, listen, speakingId, canListen } = useVerseActions(language);

    useEffect(() => {
        let alive = true;
        Promise.all([loadEngine(), loadCorpus()])
            .then(([engine, corpus]) => {
                if (!alive || typeof engine.verseForToday !== 'function' || !corpus.verses.length) return;
                const pick = engine.verseForToday(
                    { person: buildPerson(settings), date: localDateKey(), exclude: recentVerseIds(14) },
                    corpus
                );
                if (alive && pick?.verse) setPersonal(pick);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
        // Chosen once per visit; the choice is stable for the day.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let alive = true;
        fetchDaily()
            .then((data) => alive && setState({ status: data?.verse ? 'ready' : 'empty', verse: data?.verse || null }))
            .catch(() => alive && setState({ status: 'error', verse: null }));
        return () => {
            alive = false;
        };
    }, []);

    if (!personal && (state.status === 'error' || state.status === 'empty')) return null;

    if (!personal && state.status === 'loading') {
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

    const mine = Boolean(personal) && (!showShared || !state.verse);
    const verse = mine ? personal.verse : state.verse;
    const reason = mine && personal.reason ? t(personal.reason.key, {
        feeling: personal.reason.vars?.feeling ? t(`feeling.${personal.reason.vars.feeling}`).toLowerCase() : undefined,
        topic: personal.reason.vars?.topic ? t(`topic.${personal.reason.vars.topic}`).toLowerCase() : undefined,
        path: personal.reason.vars?.path ? t(`path4.${personal.reason.vars.path}.name`) : undefined
    }) : null;
    const key = `daily_${verse.id}`;
    const speaking = speakingId === key;
    const meaning = verseMeaning(verse, language);
    const simple = verse.notification_short && (verse.notification_short[language] || verse.notification_short.en);

    return (
        <section className="section" aria-labelledby="daily-verse-title">
            <div className="section__head section__head--center">
                <span className="eyebrow" id="daily-verse-title">{mine ? t('daily.forYou') : t('daily.title')}</span>
            </div>

            <motion.article
                key={verse.id}
                className={`card card--featured daily-verse${mine ? ' daily-verse--mine' : ''}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
                <span className="daily-verse__ref">{t('verse.bg')} · {verseRef(verse)}</span>
                {reason && <p className="daily-verse__why">{reason}</p>}
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
                {personal && state.verse && personal.verse.id !== state.verse.id && (
                    <button type="button" className="btn btn--link btn--sm daily-verse__switch" onClick={() => setShowShared((value) => !value)}>
                        {showShared ? t('daily.backToYours') : t('daily.shared')}
                    </button>
                )}
            </motion.article>
        </section>
    );
}

export default DailyVerse;
