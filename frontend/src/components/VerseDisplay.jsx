import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Check, Compass, Copy, Feather, Heart, Image as ImageIcon, Square, Volume2 } from 'lucide-react';
import { useVerseActions } from '../hooks/useVerseActions';
import { addReflection, sanskritLines, verseKey, verseMeaning, verseRef } from '../lib/verse';
import { toast } from '../lib/toast';

function VerseDisplay({ verse, language = 'en', onSaveLine, onWalkWithVerse, onNoteSaved }) {
    const [justSaved, setJustSaved] = useState(false);
    const [walking, setWalking] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [note, setNote] = useState('');
    const noteId = useId();
    const reduceMotion = useReducedMotion();

    const { copy, save, walk, card, listen, speakingId, canListen } = useVerseActions(language);

    if (!verse) return null;

    const meaning = verseMeaning(verse, language);
    const key = verseKey(verse);
    const isSpeaking = speakingId === key;
    const lines = sanskritLines(verse.sanskrit);

    const handleSave = () => {
        if (onSaveLine) onSaveLine(meaning || verse.sanskrit, verse);
        else save(verse);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2400);
    };

    const handleWalk = () => {
        const started = onWalkWithVerse ? onWalkWithVerse(verse) : walk(verse);
        if (started !== false) {
            setWalking(true);
            setTimeout(() => setWalking(false), 2400);
        }
    };

    const handleSaveReflection = () => {
        if (!note.trim()) return;
        const entry = addReflection({ verse, note, verseText: meaning || verse.sanskrit });
        toast('Kept in your reflections journal.', { icon: 'journal', tone: 'gold' });
        setNote('');
        setShowJournal(false);
        onNoteSaved?.(entry);
    };

    return (
        <motion.article
            className="verse-card card card--featured"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`Bhagavad Gita ${verseRef(verse)}`}
        >
            <header className="verse-card__head">
                <span className="eyebrow">
                    <BookOpen size={13} aria-hidden="true" />
                    Bhagavad Gita · {verseRef(verse)}
                </span>
                <div className="verse-card__tools">
                    {canListen && (
                        <button
                            type="button"
                            className={`icon-btn icon-btn--sm${isSpeaking ? ' is-on' : ''}`}
                            onClick={() => listen(verse, key)}
                            aria-label={isSpeaking ? 'Stop listening' : 'Listen to this verse'}
                            title={isSpeaking ? 'Stop' : 'Listen'}
                        >
                            {isSpeaking ? <Square size={13} fill="currentColor" /> : <Volume2 size={15} />}
                        </button>
                    )}
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => copy(verse)} aria-label="Copy verse" title="Copy">
                        <Copy size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => card(verse)} aria-label="Create a wisdom card image" title="Wisdom card">
                        <ImageIcon size={15} />
                    </button>
                </div>
            </header>

            {lines.length > 0 && (
                <p className="sanskrit verse-card__sanskrit" lang="sa">
                    {lines.map((line, index) => (
                        <span key={index}>{line}</span>
                    ))}
                </p>
            )}

            {verse.iast && <p className="iast verse-card__iast">{verse.iast}</p>}

            {meaning && (
                <>
                    <div className="ornament verse-card__ornament" aria-hidden="true"><span className="ornament__gem" /></div>
                    <blockquote className={`translation verse-card__meaning${language === 'hi' && verse.meaning_hi ? ' translation--hi' : ''}`}>
                        {meaning}
                    </blockquote>
                </>
            )}

            {verse.core_theme?.length > 0 && (
                <div className="chip-row verse-card__themes">
                    {verse.core_theme.slice(0, 4).map((theme) => (
                        <span key={theme} className="chip">{theme}</span>
                    ))}
                </div>
            )}

            <footer className="verse-card__actions">
                <button type="button" className={`btn btn--outline btn--sm${showJournal ? ' is-on' : ''}`} onClick={() => setShowJournal((value) => !value)} aria-expanded={showJournal} aria-controls={noteId}>
                    <Feather size={14} />
                    Reflect
                </button>
                <button type="button" className={`btn btn--outline btn--sm${justSaved ? ' is-on' : ''}`} onClick={handleSave}>
                    {justSaved ? <Check size={14} /> : <Heart size={14} />}
                    {justSaved ? 'Saved' : 'Save line'}
                </button>
                <button type="button" className={`btn btn--outline btn--sm${walking ? ' is-on' : ''}`} onClick={handleWalk}>
                    {walking ? <Check size={14} /> : <Compass size={14} />}
                    {walking ? 'Walking' : 'Walk 7 days'}
                </button>
                <button type="button" className="btn btn--gold btn--sm" onClick={() => card(verse)}>
                    <ImageIcon size={14} />
                    Share card
                </button>
            </footer>

            <AnimatePresence initial={false}>
                {showJournal && (
                    <motion.div
                        id={noteId}
                        className="verse-card__journal"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <label className="sr-only" htmlFor={`${noteId}-input`}>Your reflection</label>
                        <textarea
                            id={`${noteId}-input`}
                            className="textarea"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSaveReflection();
                            }}
                            placeholder="What does this verse stir in you right now?"
                            rows={3}
                            autoFocus
                        />
                        <div className="verse-card__journal-actions">
                            <span className="faint">Kept only on this device</span>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowJournal(false)}>Cancel</button>
                            <button type="button" className="btn btn--gold btn--sm" onClick={handleSaveReflection} disabled={!note.trim()}>
                                Save reflection
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}

export default VerseDisplay;
