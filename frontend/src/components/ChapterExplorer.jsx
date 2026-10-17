import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronLeft, ChevronRight, Search, Sparkles, X, Bookmark } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import VerseRow from './VerseRow';
import { fetchChapter, fetchChapters } from '../lib/gitaApi';
import { verseMeaning, verseNumber } from '../lib/verse';
import { useVerseActions } from '../hooks/useVerseActions';
import { useI18n } from '../i18n';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII'];
const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const READING_KEY = 'lgReading';

const devanagariNumber = (n) => String(n).replace(/\d/g, (digit) => DEVANAGARI_DIGITS[digit]);

function splitName(name = '') {
    const match = name.match(/^(.*?)\s*\((.*)\)\s*$/);
    return match ? { title: match[1], subtitle: match[2] } : { title: name, subtitle: '' };
}

function readReading() {
    try {
        return JSON.parse(localStorage.getItem(READING_KEY) || 'null');
    } catch {
        return null;
    }
}

function ChapterExplorer({ isOpen, onClose, onSelectChapter, onSelectVerse, language = 'en', initialChapter = null }) {
    const { t } = useI18n();
    const [chapters, setChapters] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [reader, setReader] = useState(null); // { meta, verses, loading }
    const [filter, setFilter] = useState('');
    const [reading, setReading] = useState(readReading);
    const bodyRef = useRef(null);
    const reduceMotion = useReducedMotion();
    const actions = useVerseActions(language);
    const { stop } = actions;
    const numeral = (n) => (language === 'hi' ? devanagariNumber(n) : ROMAN[n - 1] || n);

    const openReader = useCallback(async (chapterNumber, metaHint) => {
        setFilter('');
        setReader({ meta: metaHint || { chapter: chapterNumber }, verses: [], loading: true });
        bodyRef.current?.scrollTo({ top: 0 });
        const bookmark = { chapter: chapterNumber, at: new Date().toISOString() };
        localStorage.setItem(READING_KEY, JSON.stringify(bookmark));
        setReading(bookmark);
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
        setReading(readReading());
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
    const resume = !reader && reading && chapters.find((chapter) => chapter.chapter === reading.chapter);

    return (
        <Sheet isOpen={isOpen} onClose={onClose} onEscape={reader ? backToList : onClose} label={t('chapters.title')} width={reader ? 740 : 780} size="tall">
            {reader ? (
                <SheetHeader
                    leading={
                        <button type="button" className="icon-btn icon-btn--sm icon-btn--ring" onClick={backToList} aria-label={t('chapters.all')} title={t('chapters.all')}>
                            <ChevronLeft size={18} />
                        </button>
                    }
                    eyebrow={`${t('chapters.chapter')} ${numeral(chapterNumber)}${reader.verses.length ? ` · ${t('chapters.verses', { count: reader.verses.length })}` : ''}`}
                    title={name.title || `${t('chapters.chapter')} ${chapterNumber}`}
                    subtitle={[reader.meta.name_sanskrit, name.subtitle].filter(Boolean).join(' · ')}
                    onClose={onClose}
                />
            ) : (
                <SheetHeader icon={BookOpen} eyebrow={t('chapters.eyebrow')} title={t('chapters.title')} subtitle={t('chapters.subtitle')} onClose={onClose} />
            )}

            <div className="sheet__body" ref={bodyRef}>
                {!reader && (
                    <>
                        {resume && (
                            <button type="button" className="resume" onClick={() => openReader(resume.chapter, resume)}>
                                <Bookmark size={16} />
                                <span>
                                    <span className="eyebrow eyebrow--muted">{t('chapters.resume')}</span>
                                    <strong>{t('chapters.chapter')} {numeral(resume.chapter)} · {splitName(resume.name_english).title}</strong>
                                </span>
                                <ChevronRight size={16} />
                            </button>
                        )}
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
                                            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.5 }}
                                        >
                                            <span className={`chapter-tile__numeral${language === 'hi' ? ' is-devanagari' : ''}`} aria-hidden="true">{numeral(chapter.chapter)}</span>
                                            <span className="chapter-tile__text">
                                                <span className="chapter-tile__title">{chapterName.title}</span>
                                                <span className="chapter-tile__sanskrit" lang="sa">{chapter.name_sanskrit}</span>
                                                {chapter.helps_with?.length > 0 && (
                                                    <span className="chapter-tile__helps">{t('chapters.helps', { list: chapter.helps_with.slice(0, 2).join(', ') })}</span>
                                                )}
                                            </span>
                                            <span className="chapter-tile__meta">{chapter.verses_count}<span>{t('chapters.versesShort')}</span></span>
                                        </motion.button>
                                    );
                                })}
                        </div>
                    </>
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
                                    <summary>{t('chapters.teaches')}</summary>
                                    <ul>{reader.meta.what_you_learn.map((item) => <li key={item}>{item}</li>)}</ul>
                                </details>
                            )}
                            {onSelectChapter && reader.meta.helps_with && (
                                <button type="button" className="text-action" onClick={() => { onClose(); onSelectChapter(reader.meta); }}>
                                    <Sparkles size={14} /> {t('chapters.reflect')}
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
                                    placeholder={t('chapters.filter', { n: chapterNumber })}
                                    aria-label={t('chapters.filterLabel')}
                                />
                                {filter && (
                                    <button type="button" className="icon-btn icon-btn--xs field__clear" onClick={() => setFilter('')} aria-label={t('common.clear')}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="verse-list">
                            {reader.loading && Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton verse-row--skeleton" />)}
                            {reader.failed && (
                                <div className="empty-state">
                                    <h3>{t('chapters.failed')}</h3>
                                    <p>{t('chapters.failedBody')}</p>
                                    <button type="button" className="btn btn--outline btn--sm" onClick={() => openReader(chapterNumber, reader.meta)}>{t('common.tryAgain')}</button>
                                </div>
                            )}
                            {!reader.loading && !reader.failed && visibleVerses.length === 0 && (
                                <div className="empty-state">
                                    <h3>{t('chapters.noMatch', { query: filter })}</h3>
                                    <p>{t('chapters.noMatchBody')}</p>
                                </div>
                            )}
                            {visibleVerses.map((verse) => (
                                <VerseRow key={verse.id} verse={verse} language={language} actions={actions} idPrefix="ch" query={filter} onSit={sitWith} />
                            ))}
                        </div>

                        {!reader.loading && (
                            <nav className="chapter-pager" aria-label={t('chapters.pager')}>
                                {chapterNumber > 1 ? (
                                    <button type="button" className="btn btn--soft" onClick={() => openReader(chapterNumber - 1, chapters.find((item) => item.chapter === chapterNumber - 1))}>
                                        <ChevronLeft size={16} /> {t('chapters.chapter')} {numeral(chapterNumber - 1)}
                                    </button>
                                ) : <span />}
                                {chapterNumber < 18 && (
                                    <button type="button" className="btn btn--soft" onClick={() => openReader(chapterNumber + 1, chapters.find((item) => item.chapter === chapterNumber + 1))}>
                                        {t('chapters.chapter')} {numeral(chapterNumber + 1)} <ChevronRight size={16} />
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
