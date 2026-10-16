import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import VerseRow from './VerseRow';
import { searchVerses } from '../lib/gitaApi';
import { useVerseActions } from '../hooks/useVerseActions';
import { useIsMobile } from '../hooks/useMediaQuery';

const TOPICS = [
    { label: 'Peace & stillness', query: 'peace' },
    { label: 'Anxiety & fear', query: 'fear' },
    { label: 'Duty & karma', query: 'action' },
    { label: 'Overcoming doubt', query: 'doubt' },
    { label: 'Grief & healing', query: 'grief' },
    { label: 'Anger & calm', query: 'anger' },
    { label: 'Devotion & love', query: 'devotion' },
    { label: 'Meditation', query: 'meditation' },
    { label: 'The eternal self', query: 'soul' },
    { label: 'Letting go', query: 'detachment' }
];

const PAGE = 20;
const DEFAULT_QUERY = 'peace';

function WisdomSearch({ isOpen, onClose, onSelectVerse, language = 'en' }) {
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [state, setState] = useState({ status: 'idle', results: [], count: 0, query: '' });
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
        if (!isMobile) setTimeout(() => inputRef.current?.focus(), 120);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const controller = new AbortController();
        setState((current) => ({ ...current, status: 'loading' }));
        const timer = setTimeout(() => {
            searchVerses(effectiveQuery, { limit, signal: controller.signal })
                .then((data) => setState({ status: 'ready', results: data.results || [], count: data.count ?? (data.results || []).length, query: effectiveQuery }))
                .catch((error) => {
                    if (error.name !== 'AbortError') setState({ status: 'error', results: [], count: 0, query: effectiveQuery });
                });
        }, query ? 260 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [effectiveQuery, limit, isOpen, query]);

    const chooseTopic = (topic) => {
        setQuery(topic);
        setLimit(PAGE);
    };

    const sitWith = (verse) => {
        onClose();
        onSelectVerse?.(verse);
    };

    const showingDefault = !query.trim();
    const { status, results, count } = state;

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label="Wisdom Finder" width={720} size="tall">
            <SheetHeader
                icon={Search}
                eyebrow="Wisdom Finder"
                title="Search all 701 verses"
                subtitle="By feeling, theme, word — or a reference like 2.47"
                onClose={onClose}
            />

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
                        placeholder="peace, fear, karma, grief, 2.47…"
                        aria-label="Search the Gita"
                        enterKeyHint="search"
                    />
                    {query && (
                        <button type="button" className="icon-btn icon-btn--sm icon-btn--plain field__clear" onClick={() => setQuery('')} aria-label="Clear search">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="chip-row chip-row--scroll" role="group" aria-label="Topics">
                    {TOPICS.map((topic) => (
                        <button
                            key={topic.query}
                            type="button"
                            className="chip"
                            aria-pressed={query.trim().toLowerCase() === topic.query}
                            onClick={() => chooseTopic(topic.query)}
                        >
                            {topic.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="sheet__body">
                <p className="search-status" aria-live="polite">
                    {status === 'loading' && 'Seeking wisdom…'}
                    {status === 'ready' && (showingDefault
                        ? 'Verses on peace, to begin'
                        : `${count} ${count === 1 ? 'verse' : 'verses'} for “${state.query}”`)}
                    {status === 'error' && 'The verses could not be reached.'}
                </p>

                <div className="verse-list">
                    {status === 'loading' && !results.length && Array.from({ length: 3 }, (_, index) => (
                        <div key={index} className="skeleton verse-row--skeleton" />
                    ))}

                    {status === 'ready' && results.length === 0 && (
                        <div className="empty-state">
                            <h3>No verses for “{state.query}”</h3>
                            <p>Try a simpler feeling — peace, fear, duty — or a verse reference like 18.66.</p>
                        </div>
                    )}

                    {results.map((verse) => (
                        <VerseRow
                            key={verse.id}
                            verse={verse}
                            language={language}
                            actions={actions}
                            idPrefix="search"
                            query={showingDefault ? '' : state.query}
                            showChapter
                            onSit={sitWith}
                        />
                    ))}
                </div>

                {status !== 'error' && results.length > 0 && count > results.length && (
                    <div className="load-more">
                        <button type="button" className="btn btn--soft" onClick={() => setLimit((value) => value + PAGE)} disabled={status === 'loading'}>
                            {status === 'loading' ? 'Gathering…' : `Show more (${count - results.length} remaining)`}
                        </button>
                    </div>
                )}
            </div>
        </Sheet>
    );
}

export default WisdomSearch;
