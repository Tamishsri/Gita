import React, { memo } from 'react';
import { Copy, Heart, Image as ImageIcon, Square, Volume2, ArrowRight } from 'lucide-react';
import Sloka from './Sloka';
import { verseMeaning, verseNumber, verseRef } from '../lib/verse';
import { useI18n } from '../i18n';
import Glossed from './ui/Glossed';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, query }) {
    const terms = (query || '').trim().split(/\s+/).filter((term) => term.length > 1);
    if (!text || !terms.length) return text || null;
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
    return text.split(pattern).map((part, index) => (
        index % 2 === 1 ? <mark key={index}>{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>
    ));
}

// A verse in a list: number, śloka, meaning, its plain-words essence, and the
// same quiet gestures as the full folio.
function VerseRow({ verse, language, actions, idPrefix = 'row', query, showChapter = false, onSit }) {
    const { t } = useI18n();
    const meaning = verseMeaning(verse, language);
    const simple = verse.notification_short && (verse.notification_short[language] || verse.notification_short.en);
    const speakId = `${idPrefix}_${verse.id}`;
    const speaking = actions.speakingId === speakId;
    const isHindi = language === 'hi' && verse.meaning_hi;

    return (
        <article className="verse-row" aria-label={`${t('verse.bg')} ${verseRef(verse)}`}>
            <header className="verse-row__head">
                <span className="verse-row__number">{showChapter ? verseRef(verse) : verseNumber(verse)}</span>
                <div className="verse-row__tools">
                    {actions.canListen && (
                        <button type="button" className={`icon-btn icon-btn--xs${speaking ? ' is-on' : ''}${actions.preparingId === speakId ? ' is-preparing' : ''}`} onClick={() => actions.listen(verse, speakId)} aria-label={speaking ? t('verse.stop') : t('verse.listen')} title={speaking ? t('verse.stop') : t('verse.listen')}>
                            {speaking ? <Square size={11} fill="currentColor" /> : <Volume2 size={15} />}
                        </button>
                    )}
                    <button type="button" className="icon-btn icon-btn--xs" onClick={() => actions.copy(verse)} aria-label={t('verse.copy')} title={t('verse.copy')}>
                        <Copy size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--xs" onClick={() => actions.save(verse)} aria-label={t('verse.keep')} title={t('verse.keep')}>
                        <Heart size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--xs" onClick={() => actions.card(verse)} aria-label={t('verse.card')} title={t('verse.card')}>
                        <ImageIcon size={15} />
                    </button>
                </div>
            </header>

            <Sloka verse={verse} className="verse-row__sanskrit" />

            <p className={`verse-row__meaning${isHindi ? ' translation--hi' : ''}`}>
                <Highlight text={meaning} query={query} />
            </p>

            {simple && <p className="verse-row__simple"><Glossed text={simple} language={language} /></p>}

            {onSit && (
                <footer className="verse-row__foot">
                    <button type="button" className="text-action" onClick={() => onSit(verse)}>
                        {t('verse.sitWith')} <ArrowRight size={14} />
                    </button>
                </footer>
            )}
        </article>
    );
}

export default memo(VerseRow);
