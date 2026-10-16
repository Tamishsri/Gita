import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import VerseRow from './VerseRow';
import { fetchChapter, fetchChapters } from '../lib/gitaApi';
import { verseMeaning, verseNumber } from '../lib/verse';
import { useVerseActions } from '../hooks/useVerseActions';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII'];

function splitName(name = '') {
    const match = name.match(/^(.*?)\s*\((.*)\)\s*$/);
    return match ? { title: match[1], subtitle: match[2] } : { title: name, subtitle: '' };
}

function ChapterExplorer({ isOpen, onClose, onSelectChapter, onSelectVerse, language = 'en', initialChapter = null }) {
    const [chapters, setChapters] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [reader, setReader] = useState(null); // { meta, verses, loading }
    const [filter, setFilter] = useState('');
    const bodyRef = useRef(null);
    const reduceMotion = useReducedMotion();
    const actions = useVerseActions(language);
    const { stop } = actions;

    const openReader = useCallback(async (chapterNumber, metaHint) => {
        setFilter('');
        setReader({ meta: metaHint || { chapter: chapterNumber }, verses: [], loading: true });
        bodyRef.current?.scrollTo({ top: 0 });
        try {
            const data = await fetchChapter(chapterNumber);
            const { verses = [], ...meta } = data;
            setReader({ meta, verses, loading: false });
        } catch {
            setReader((current) => ({ ...current, loading: false, failed: true }));
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            stop();
            return;
        }
        setLoadingList(true);
        fetchChapters()
            .then((list) => {
                setChapters(list);
                if (initialChapter) {
                    openReader(initialChapter.chapter, list.find((item) => item.chapter === initialChapter.chapter));
                }
            })
            .catch(() => {})
            .finally(() => setLoadingList(false));
        if (!initialChapter) setReader(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialChapter?.nonce]);

    const visibleVerses = useMemo(() => {
        if (!reader) return [];
        const query = filter.trim().toLowerCase();
        if (!query) return reader.verses;
        return reader.verses.filter((verse) => {
            if (String(verseNumber(verse)) === query) return true;
            return verseMeaning(verse, language).toLowerCase().includes(query)
                || (verse.meaning_en || '').toLowerCase().includes(query)
                || (verse.sanskrit || '').includes(query)
                || (verse.iast || '').toLowerCase().includes(query);
        });
    }, [reader, filter, language]);

    const backToList = () => {
        stop();
        setReader(null);
        bodyRef.current?.scrollTo({ top: 0 });
    };

    const sitWith = (verse) => {
        onClose();
        onSelectVerse?.(verse);
    };

    const chapterNumber = reader?.meta.chapter;
    const name = splitName(reader?.meta.name_english);

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            onEscape={reader ? backToList : onClose}
            label="18 Chapters of the Gita"
            width={reader ? 720 : 760}
            size="tall"
        >
            {reader ? (
                <SheetHeader
                    leading={
                        <button type="button" className="icon-btn icon-btn--sm" onClick={backToList} aria-label="All chapters" title="All chapters (Esc)">
                            <ChevronLeft size={18} />
                        </button>
                    }
                    eyebrow={`Chapter ${ROMAN[chapterNumber - 1] || chapterNumber}${reader.verses.length ? ` · ${reader.verses.length} verses` : ''}`}
                    title={name.title || `Chapter ${chapterNumber}`}
                    subtitle={[reader.meta.name_sanskrit, name.subtitle].filter(Boolean).join(' · ')}
                    onClose={onClose}
                />
            ) : (
                <SheetHeader
                    icon={BookOpen}
                    eyebrow="The Bhagavad Gita"
                    title="18 Chapters"
                    subtitle="Each chapter meets a distinct human struggle — and opens a path to peace."
                    onClose={onClose}
                />
            )}

            <div className="sheet__body" ref={bodyRef}>
                {!reader && (
                    <div className="chapter-grid">
                        {loadingList && !chapters.length
                            ? Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton chapter-tile--skeleton" />)
                            : chapters.map((chapter, index) => {
                                const chapterName = splitName(chapter.name_english);
                                return (
                                    <motion.button
                                        key={chapter.chapter}
                                        type="button"
                                        className="chapter-tile"
                                        onClick={() => openReader(chapter.chapter, chapter)}
                                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.4 }}
                                    >
                                        <span className="chapter-tile__numeral" aria-hidden="true">{ROMAN[chapter.chapter - 1]}</span>
                                        <span className="chapter-tile__text">
                                            <span className="chapter-tile__title">{chapterName.title}</span>
                                            <span className="chapter-tile__sanskrit" lang="sa">{chapter.name_sanskrit}</span>
                                            {chapter.helps_with?.length > 0 && (
                                                <span className="chapter-tile__helps">Helps with {chapter.helps_with.slice(0, 2).join(', ')}</span>
                                            )}
                                        </span>
                                        <span className="chapter-tile__meta">
                                            {chapter.verses_count} <span>verses</span>
                                        </span>
                                    </motion.button>
                                );
                            })}
                    </div>
                )}

                {reader && (
                    <>
                        <section className="chapter-intro">
                            {reader.meta.summary_medium || reader.meta.summary_short ? (
                                <p className="chapter-intro__summary">{reader.meta.summary_medium || reader.meta.summary_short}</p>
                            ) : (
                                <div className="skeleton" style={{ height: 64 }} />
                            )}
                            {reader.meta.helps_with?.length > 0 && (
                                <div className="chip-row">
                                    {reader.meta.helps_with.slice(0, 6).map((tag) => <span key={tag} className="chip">{tag}</span>)}
                                </div>
                            )}
                            {reader.meta.what_you_learn?.length > 0 && (
                                <details className="chapter-intro__learn">
                                    <summary>What this chapter teaches</summary>
                                    <ul>
                                        {reader.meta.what_you_learn.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </details>
                            )}
                            {onSelectChapter && reader.meta.helps_with && (
                                <button
                                    type="button"
                                    className="btn btn--outline btn--sm"
                                    onClick={() => {
                                        onClose();
                                        onSelectChapter(reader.meta);
                                    }}
                                >
                                    <Sparkles size={14} />
                                    Reflect on this chapter’s theme
                                </button>
                            )}
                        </section>

                        <div className="reader-filter">
                            <div className="field">
                                <Search size={15} />
                                <input
                                    className="input input--pill"
                                    value={filter}
                                    onChange={(event) => setFilter(event.target.value)}
                                    placeholder={`Find in chapter ${chapterNumber} — a verse number or a word`}
                                    aria-label="Filter verses in this chapter"
                                />
                                {filter && (
                                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain field__clear" onClick={() => setFilter('')} aria-label="Clear filter">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="verse-list">
                            {reader.loading && Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton verse-row--skeleton" />)}
                            {reader.failed && (
                                <div className="empty-state">
                                    <h3>The verses could not be reached</h3>
                                    <p>Check your connection and try again.</p>
                                    <button type="button" className="btn btn--outline btn--sm" onClick={() => openReader(chapterNumber, reader.meta)}>Try again</button>
                                </div>
                            )}
                            {!reader.loading && !reader.failed && visibleVerses.length === 0 && (
                                <div className="empty-state">
                                    <h3>No verse matches “{filter}”</h3>
                                    <p>Try a verse number, or a simpler word.</p>
                                </div>
                            )}
                            {visibleVerses.map((verse) => (
                                <VerseRow
                                    key={verse.id}
                                    verse={verse}
                                    language={language}
                                    actions={actions}
                                    idPrefix="ch"
                                    query={filter}
                                    onSit={sitWith}
                                />
                            ))}
                        </div>

                        {!reader.loading && (
                            <nav className="chapter-pager" aria-label="Chapter navigation">
                                {chapterNumber > 1 ? (
                                    <button type="button" className="btn btn--soft" onClick={() => openReader(chapterNumber - 1, chapters.find((item) => item.chapter === chapterNumber - 1))}>
                                        <ChevronLeft size={16} /> Chapter {chapterNumber - 1}
                                    </button>
                                ) : <span />}
                                {chapterNumber < 18 && (
                                    <button type="button" className="btn btn--soft" onClick={() => openReader(chapterNumber + 1, chapters.find((item) => item.chapter === chapterNumber + 1))}>
                                        Chapter {chapterNumber + 1} <ChevronRight size={16} />
                                    </button>
                                )}
                            </nav>
                        )}
                    </>
                )}
            </div>
        </Sheet>
    );
}

export default ChapterExplorer;
