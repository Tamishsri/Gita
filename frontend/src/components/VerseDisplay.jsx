import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Compass, Copy, Feather, Heart, Image as ImageIcon, Link2, MoreHorizontal, Square, Volume2, ScrollText } from 'lucide-react';
import Sloka from './Sloka';
import { KolamRule } from './ui/Ornaments';
import { useVerseActions } from '../hooks/useVerseActions';
import { addReflection, copyText, verseKey, verseMeaning, verseRef } from '../lib/verse';
import { openPractice, verseLink } from '../lib/bus';
import { recordPath } from '../lib/path';
import { toast } from '../lib/toast';
import { usePreferences } from '../contexts/PreferencesContext';
import { useI18n } from '../i18n';
import Glossed from './ui/Glossed';

// A verse as a folio: the śloka, its translation, and the same thing in
// plain words. Gestures are quiet text actions; the rarer ones wait in "more".
function VerseDisplay({ verse, language = 'en', compact = false }) {
    const { t } = useI18n();
    const { script } = usePreferences();
    const [showNote, setShowNote] = useState(false);
    const [note, setNote] = useState('');
    const [moreOpen, setMoreOpen] = useState(false);
    const [showIast, setShowIast] = useState(false);
    const [kept, setKept] = useState(false);
    const noteId = useId();
    const moreRef = useRef(null);
    const reduceMotion = useReducedMotion();
    const { copy, save, walk, card, listen, speakingId, preparingId, canListen } = useVerseActions(language);

    useEffect(() => {
        if (!moreOpen) return undefined;
        const close = (event) => {
            if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setMoreOpen(false);
            }
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [moreOpen]);

    if (!verse) return null;

    const meaning = verseMeaning(verse, language);
    const simple = verse.notification_short && (verse.notification_short[language] || verse.notification_short.en);
    const key = verseKey(verse);
    const speaking = speakingId === key;

    const keep = () => {
        save(verse);
        setKept(true);
        setTimeout(() => setKept(false), 2400);
    };

    const saveNote = () => {
        if (!note.trim()) return;
        addReflection({ verse, note, verseText: meaning || verse.sanskrit });
        recordPath('reflection', { verseId: verse.id });
        toast(t('toast.reflectionKept'), { icon: 'journal', tone: 'gold' });
        setNote('');
        setShowNote(false);
    };

    const copyLink = async () => {
        const ok = await copyText(verseLink(verse));
        toast(ok ? t('toast.linkCopied') : t('toast.copyBlocked'), { icon: ok ? 'check' : undefined });
        setMoreOpen(false);
    };

    return (
        <motion.article
            className={`verse-card card card--featured${compact ? ' verse-card--compact' : ''}`}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`${t('verse.bg')} ${verseRef(verse)}`}
        >
            <header className="verse-card__head">
                <span className="eyebrow">{t('verse.bg')} · {verseRef(verse)}</span>
            </header>

            {simple && <p className={`verse-heart${language === 'hi' ? ' verse-heart--hi' : ''}`}><Glossed text={simple} language={language} /></p>}

            <Sloka verse={verse} className="verse-card__sanskrit" />

            {script === 'deva' && verse.iast && (
                <>
                    <button type="button" className="verse-card__iast-toggle" onClick={() => setShowIast((value) => !value)} aria-expanded={showIast}>
                        {showIast ? t('verse.hideIast') : t('verse.showIast')}
                    </button>
                    <AnimatePresence initial={false}>
                        {showIast && (
                            <motion.p
                                className="iast verse-card__iast"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                {verse.iast}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </>
            )}

            {meaning && (
                <>
                    <KolamRule width={160} />
                    <blockquote className={`translation verse-card__meaning${language === 'hi' && verse.meaning_hi ? ' translation--hi' : ''}`}>
                        <Glossed text={meaning} language={language} />
                    </blockquote>
                </>
            )}

            <footer className="text-actions verse-card__actions">
                {canListen && (
                    <button type="button" className={`text-action${speaking ? ' is-on' : ''}${preparingId === key ? ' is-preparing' : ''}`} onClick={() => listen(verse, key)}>
                        {speaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={15} />}
                        {speaking ? t('verse.stop') : t('verse.listen')}
                    </button>
                )}
                <button type="button" className={`text-action${showNote ? ' is-on' : ''}`} onClick={() => setShowNote((value) => !value)} aria-expanded={showNote} aria-controls={noteId}>
                    <Feather size={15} /> {t('verse.reflect')}
                </button>
                <button type="button" className={`text-action${kept ? ' is-on' : ''}`} onClick={keep}>
                    {kept ? <Check size={15} /> : <Heart size={15} />} {kept ? t('verse.kept') : t('verse.keep')}
                </button>
                <button type="button" className="text-action" onClick={() => card(verse)}>
                    <ImageIcon size={15} /> {t('verse.card')}
                </button>
                <div className="more" ref={moreRef}>
                    <button type="button" className="text-action" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} aria-haspopup="menu" aria-label={t('verse.more')}>
                        <MoreHorizontal size={16} />
                    </button>
                    <AnimatePresence>
                        {moreOpen && (
                            <motion.div
                                className="more__menu"
                                role="menu"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.18 }}
                            >
                                <button type="button" role="menuitem" onClick={() => { walk(verse); setMoreOpen(false); }}>
                                    <Compass size={15} /> {t('verse.walk')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { openPractice('svadhyaya', { verse }); setMoreOpen(false); }}>
                                    <ScrollText size={15} /> {t('verse.learn')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { copy(verse); setMoreOpen(false); }}>
                                    <Copy size={15} /> {t('verse.copy')}
                                </button>
                                <button type="button" role="menuitem" onClick={copyLink}>
                                    <Link2 size={15} /> {t('verse.copyLink')}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </footer>

            <AnimatePresence initial={false}>
                {showNote && (
                    <motion.div
                        id={noteId}
                        className="verse-card__journal"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <label className="sr-only" htmlFor={`${noteId}-input`}>{t('verse.notePlaceholder')}</label>
                        <textarea
                            id={`${noteId}-input`}
                            className="textarea textarea--paper"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) saveNote();
                            }}
                            placeholder={t('verse.notePlaceholder')}
                            rows={4}
                            autoFocus
                        />
                        <div className="verse-card__journal-actions">
                            <span className="faint">{t('common.onDevice')}</span>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowNote(false)}>{t('common.cancel')}</button>
                            <button type="button" className="btn btn--gold btn--sm" onClick={saveNote} disabled={!note.trim()}>{t('verse.saveReflection')}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}

export default VerseDisplay;
