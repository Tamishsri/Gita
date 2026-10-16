import React, { memo } from 'react';
import { Copy, Heart, Image as ImageIcon, Square, Volume2, ArrowRight } from 'lucide-react';
import { sanskritLines, verseMeaning, verseNumber, verseRef } from '../lib/verse';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, query }) {
    const terms = (query || '').trim().split(/\s+/).filter((term) => term.length > 1);
    if (!text || !terms.length) return text || null;
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
    return text.split(pattern).map((part, index) => (
        index % 2 === 1 ? <mark key={index}>{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>
    ));
}

// A verse in a list: number, śloka, meaning, and the same quiet gestures as
// the full verse card.
function VerseRow({ verse, language, actions, idPrefix = 'row', query, showChapter = false, onSit }) {
    const meaning = verseMeaning(verse, language);
    const speakId = `${idPrefix}_${verse.id}`;
    const speaking = actions.speakingId === speakId;
    const isHindi = language === 'hi' && verse.meaning_hi;

    return (
        <article className="verse-row" aria-label={`Bhagavad Gita ${verseRef(verse)}`}>
            <header className="verse-row__head">
                <span className="verse-row__number" aria-hidden="true">{showChapter ? verseRef(verse) : verseNumber(verse)}</span>
                <span className="eyebrow eyebrow--muted">
                    {showChapter ? `Chapter ${verse.chapter} · Verse ${verseNumber(verse)}` : `Verse ${verseNumber(verse)}`}
                </span>
                <div className="verse-row__tools">
                    {actions.canListen && (
                        <button type="button" className={`icon-btn icon-btn--xs icon-btn--plain${speaking ? ' is-on' : ''}`} onClick={() => actions.listen(verse, speakId)} aria-label={speaking ? 'Stop' : 'Listen'} title={speaking ? 'Stop' : 'Listen'}>
                            {speaking ? <Square size={11} fill="currentColor" /> : <Volume2 size={14} />}
                        </button>
                    )}
                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain" onClick={() => actions.copy(verse)} aria-label="Copy" title="Copy">
                        <Copy size={14} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain" onClick={() => actions.save(verse)} aria-label="Save line" title="Save line">
                        <Heart size={14} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain" onClick={() => actions.card(verse)} aria-label="Wisdom card" title="Wisdom card">
                        <ImageIcon size={14} />
                    </button>
                </div>
            </header>

            {verse.sanskrit && (
                <p className="sanskrit verse-row__sanskrit" lang="sa">
                    {sanskritLines(verse.sanskrit).map((line, index) => <span key={index}>{line}</span>)}
                </p>
            )}

            <p className={`verse-row__meaning${isHindi ? ' translation--hi' : ''}`}>
                <Highlight text={meaning} query={query} />
            </p>

            <footer className="verse-row__foot">
                <div className="chip-row">
                    {(verse.core_theme || []).slice(0, 2).map((theme) => (
                        <span key={theme} className="chip chip--muted">{theme}</span>
                    ))}
                </div>
                {onSit && (
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => onSit(verse)}>
                        Sit with verse
                        <ArrowRight size={13} />
                    </button>
                )}
            </footer>
        </article>
    );
}

export default memo(VerseRow);
