import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import VerseRow from './VerseRow';
import { searchVerses } from '../lib/gitaApi';
import { useVerseActions } from '../hooks/useVerseActions';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

const TOPICS = ['peace', 'fear', 'action', 'doubt', 'grief', 'anger', 'devotion', 'meditation', 'soul', 'detachment'];

const PAGE = 20;
const DEFAULT_QUERY = 'peace';

function WisdomSearch({ isOpen, onClose, onSelectVerse, language = 'en' }) {
    const { t } = useI18n();
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [state, setState] = useState({ status: 'idle', results: [], count: 0, query: '', match: 'text' });
    const inputRef = useRef(null);
    const isMobile = useIsMobile();
    const actions = useVerseActions(language);
    const { stop } = actions;

    const effectiveQuery = query.trim() || DEFAULT_QUERY;

    useEffect(() => {
        if (!isOpen) {
            stop();
            return;
        }
        setQuery('');
        setLimit(PAGE);
        if (!isMobile) setTimeout(() => inputRef.current?.focus(), 140);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const controller = new AbortController();
        setState((current) => ({ ...current, status: 'loading' }));
        const timer = setTimeout(() => {
            searchVerses(effectiveQuery, { limit, signal: controller.signal })
                .then((data) => setState({
                    status: 'ready',
                    results: data.results || [],
                    count: data.count ?? (data.results || []).length,
                    query: effectiveQuery,
                    match: data.match || 'text'
                }))
                .catch((error) => {
                    if (error.name !== 'AbortError') setState({ status: 'error', results: [], count: 0, query: effectiveQuery, match: 'text' });
                });
        }, query ? 260 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [effectiveQuery, limit, isOpen, query]);

    const sitWith = (verse) => {
        onClose();
        onSelectVerse?.(verse);
    };

    const showingDefault = !query.trim();
    const { status, results, count } = state;

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('search.title')} width={740} size="tall">
            <SheetHeader icon={Search} eyebrow={t('search.eyebrow')} title={t('search.title')} subtitle={t('search.subtitle')} onClose={onClose} />

            <div className="search-controls">
                <div className="field">
                    <Search size={17} />
                    <input
                        ref={inputRef}
                        className="input input--pill input--lg"
                        type="search"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setLimit(PAGE);
                        }}
                        placeholder={t('search.placeholder')}
                        aria-label={t('search.label')}
                        enterKeyHint="search"
                    />
                    {query && (
                        <button type="button" className="icon-btn icon-btn--sm field__clear" onClick={() => setQuery('')} aria-label={t('common.clear')}>
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="chip-row chip-row--scroll" role="group" aria-label={t('search.topics')}>
                    {TOPICS.map((topic) => (
                        <button
                            key={topic}
                            type="button"
                            className="chip"
                            aria-pressed={query.trim().toLowerCase() === topic}
                            onClick={() => {
                                setQuery(topic);
                                setLimit(PAGE);
                            }}
                        >
                            {t(`search.topic.${topic}`)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="sheet__body">
                <p className="search-status" aria-live="polite">
                    {status === 'loading' && t('search.seeking')}
                    {status === 'ready' && (showingDefault
                        ? t('search.default')
                        : state.match === 'reference'
                            ? t('search.reference')
                            : t('search.count', { count, query: state.query }))}
                    {status === 'error' && t('search.error')}
                </p>

                <div className="verse-list">
                    {status === 'loading' && !results.length && Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton verse-row--skeleton" />)}

                    {status === 'ready' && results.length === 0 && (
                        <div className="empty-state">
                            <h3>{t('search.noneTitle', { query: state.query })}</h3>
                            <p>{t('search.noneBody')}</p>
                        </div>
                    )}

                    {results.map((verse) => (
                        <VerseRow
                            key={verse.id}
                            verse={verse}
                            language={language}
                            actions={actions}
                            idPrefix="search"
                            query={showingDefault || state.match === 'reference' ? '' : state.query}
                            showChapter
                            onSit={sitWith}
                        />
                    ))}
                </div>

                {status !== 'error' && results.length > 0 && count > results.length && (
                    <div className="load-more">
                        <button type="button" className="btn btn--soft" onClick={() => setLimit((value) => value + PAGE)} disabled={status === 'loading'}>
                            {status === 'loading' ? t('search.gathering') : t('search.more', { count: count - results.length })}
                        </button>
                    </div>
                )}
            </div>
        </Sheet>
    );
}

export default WisdomSearch;
