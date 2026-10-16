import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Search, BookOpen, Feather, Home, Image as ImageIcon, Wind, Languages, EyeOff, Settings as SettingsIcon,
    Info, Download, Hash, Bell, VolumeX, CornerDownLeft, BookMarked, Loader2
} from 'lucide-react';
import { useLayer } from '../lib/layers';
import { fetchChapters, fetchDaily, fetchVerse, searchVerses } from '../lib/gitaApi';
import { openWisdomCard, parseVerseRef, verseMeaning, verseRef } from '../lib/verse';
import { playChime } from '../lib/chime';
import { MOODS } from './MoodSelector';
import { SOUND_ICONS } from './SoundDock';
import { SOUND_MODES } from './SoundscapeEngine';
import LotusMark from './ui/LotusMark';

const GROUP_LABELS = {
    jump: 'Go to verse',
    actions: 'Actions',
    moods: 'How is your heart?',
    sound: 'Soundscape',
    chapters: 'Chapters',
    verses: 'Verses'
};

const GROUP_ORDER = ['jump', 'actions', 'moods', 'sound', 'chapters', 'verses'];

function score(item, query) {
    if (!query) return 1;
    const title = item.title.toLowerCase();
    const haystack = `${title} ${item.subtitle || ''} ${item.keywords || ''}`.toLowerCase();
    let total = 0;
    for (const token of query.split(/\s+/).filter(Boolean)) {
        if (!haystack.includes(token)) return 0;
        if (title.startsWith(token)) total += 8;
        else if (title.includes(` ${token}`)) total += 5;
        else if (title.includes(token)) total += 3;
        else total += 1;
    }
    return total;
}

function truncate(text, length = 96) {
    if (!text) return '';
    return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

function CommandPalette({ isOpen, onClose, actions, settings, view, journalCount, install }) {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [chapters, setChapters] = useState([]);
    const [verseResults, setVerseResults] = useState({ query: '', items: [], loading: false });
    const [jumpPreview, setJumpPreview] = useState(null);

    const inputRef = useRef(null);
    const listRef = useRef(null);
    const pointerMoved = useRef(false);

    useLayer(isOpen, { onEscape: onClose, blocksHotkeys: true });

    const trimmed = query.trim().toLowerCase();
    const parsedRef = useMemo(() => parseVerseRef(query), [query]);

    // Reset every time the palette opens.
    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setActiveIndex(0);
        setJumpPreview(null);
        requestAnimationFrame(() => inputRef.current?.focus());
        fetchChapters().then(setChapters).catch(() => {});
    }, [isOpen]);

    // Live preview for "2.47"-style references.
    useEffect(() => {
        if (!parsedRef) {
            setJumpPreview(null);
            return undefined;
        }
        let cancelled = false;
        setJumpPreview({ id: parsedRef.id, status: 'loading' });
        fetchVerse(parsedRef.id)
            .then((verse) => !cancelled && setJumpPreview({ id: parsedRef.id, status: 'ready', verse }))
            .catch(() => !cancelled && setJumpPreview({ id: parsedRef.id, status: 'missing' }));
        return () => {
            cancelled = true;
        };
    }, [parsedRef]);

    // Debounced full-text search across all 701 verses.
    useEffect(() => {
        if (!isOpen || parsedRef || trimmed.length < 3) {
            setVerseResults({ query: '', items: [], loading: false });
            return undefined;
        }
        const controller = new AbortController();
        setVerseResults((current) => ({ ...current, loading: true }));
        const timer = setTimeout(() => {
            searchVerses(trimmed, { limit: 8, signal: controller.signal })
                .then((data) => setVerseResults({ query: trimmed, items: data.results || [], loading: false }))
                .catch((error) => {
                    if (error.name !== 'AbortError') setVerseResults({ query: trimmed, items: [], loading: false });
                });
        }, 180);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [trimmed, parsedRef, isOpen]);

    const staticItems = useMemo(() => {
        const list = [];
        const add = (group, item) => list.push({ group, ...item });

        add('actions', { id: 'search', icon: Search, title: 'Open Wisdom Finder', subtitle: 'Browse all 701 verses by feeling or topic', keys: ['/'], keywords: 'search find verses topics', run: () => actions.openPanel('search') });
        add('actions', { id: 'journal', icon: Feather, title: 'Open Reflections Journal', subtitle: journalCount ? `${journalCount} ${journalCount === 1 ? 'entry' : 'entries'} kept on this device` : 'Your private notes', keys: ['J'], keywords: 'notes diary', run: () => actions.openPanel('journal') });
        add('actions', { id: 'chapters', icon: BookOpen, title: 'Browse 18 Chapters', subtitle: 'Read the Gita chapter by chapter', keys: ['C'], keywords: 'read reader adhyaya', run: () => actions.openPanel('chapters') });
        if (view === 'sanctuary') {
            add('actions', { id: 'home', icon: Home, title: 'Return to Sanctuary home', keys: ['Esc'], keywords: 'back', run: actions.goHome });
        }
        add('actions', { id: 'daily-card', icon: ImageIcon, title: "Create a Wisdom Card of today's verse", subtitle: 'A shareable image for status, stories or wallpaper', keywords: 'share image png instagram whatsapp daily', run: () => fetchDaily().then((data) => data?.verse && openWisdomCard(data.verse, settings.language)).catch(() => {}) });
        add('actions', { id: 'breaths', icon: Wind, title: 'Begin the 3-Breaths ritual', subtitle: '4-7-8 pranayama to re-center', keywords: 'breathe pranayama calm reset', run: actions.beginBreaths });
        add('actions', { id: 'language', icon: Languages, title: settings.language === 'hi' ? 'Switch wisdom to English' : 'हिंदी में पढ़ें — Switch wisdom to Hindi', keywords: 'language hindi english', run: actions.toggleLanguage });
        add('actions', { id: 'silent', icon: EyeOff, title: settings.silentMode ? 'Turn off Silent Presence' : 'Turn on Silent Presence', subtitle: 'Verses only, without conversation', keywords: 'quiet silent mode', run: actions.toggleSilent });
        add('actions', { id: 'settings', icon: SettingsIcon, title: 'Sanctuary preferences', keywords: 'settings options', run: () => actions.openPanel('settings') });
        add('actions', { id: 'about', icon: Info, title: 'About Living Gita & safety', subtitle: 'Crisis helplines and our approach', keywords: 'help crisis helpline disclaimer', run: () => actions.openPanel('about') });
        if (install?.available) {
            add('actions', { id: 'install', icon: Download, title: 'Install Living Gita', subtitle: 'Works offline, opens like an app', keywords: 'pwa app install offline', run: actions.install });
        }

        MOODS.forEach((mood) => add('moods', {
            id: `mood-${mood.id}`,
            icon: mood.icon,
            title: mood.label,
            subtitle: mood.hint,
            keywords: `${mood.id} feeling mood ${mood.hindi}`,
            tint: mood.rgb,
            run: () => actions.selectMood(mood.id)
        }));

        SOUND_MODES.forEach((mode) => add('sound', {
            id: `sound-${mode.id}`,
            icon: SOUND_ICONS[mode.id],
            title: `Play ${mode.label}`,
            subtitle: mode.description,
            keywords: 'sound ambient music soundscape audio',
            run: () => actions.playSound(mode.id)
        }));
        add('sound', { id: 'sound-mute', icon: VolumeX, title: 'Silence the soundscape', keywords: 'mute stop sound quiet', run: actions.muteSound });
        add('sound', { id: 'bowl', icon: Bell, title: 'Strike the singing bowl', subtitle: '432 Hz with harmonics', keywords: 'chime bell bowl tibetan', keepOpen: true, run: () => playChime('bowl', { force: true }) });

        const chapterList = chapters.length ? chapters : Array.from({ length: 18 }, (_, index) => ({ chapter: index + 1 }));
        chapterList.forEach((chapter) => add('chapters', {
            id: `chapter-${chapter.chapter}`,
            icon: BookMarked,
            badge: chapter.chapter,
            title: chapter.name_english ? `${chapter.chapter}. ${chapter.name_english.replace(/\s*\(.*\)$/, '')}` : `Chapter ${chapter.chapter}`,
            subtitle: [chapter.name_sanskrit, chapter.name_english?.match(/\((.*)\)/)?.[1]].filter(Boolean).join(' · '),
            keywords: `chapter adhyaya ${chapter.chapter} ${(chapter.helps_with || []).join(' ')}`,
            run: () => actions.openChapter(chapter.chapter)
        }));

        return list;
    }, [actions, chapters, install?.available, journalCount, settings.language, settings.silentMode, view]);

    const items = useMemo(() => {
        const groups = {};

        if (parsedRef) {
            const ready = jumpPreview?.status === 'ready' && jumpPreview.id === parsedRef.id;
            const missing = jumpPreview?.status === 'missing' && jumpPreview.id === parsedRef.id;
            groups.jump = [{
                group: 'jump',
                id: `jump-${parsedRef.id}`,
                icon: Hash,
                title: `Bhagavad Gita ${parsedRef.chapter}.${parsedRef.verse}`,
                subtitle: ready
                    ? truncate(verseMeaning(jumpPreview.verse, settings.language), 120)
                    : missing ? 'This verse is not in the collection' : 'Finding the verse…',
                disabled: missing,
                run: () => (ready ? actions.selectVerse(jumpPreview.verse) : fetchVerse(parsedRef.id).then(actions.selectVerse).catch(() => {}))
            }];
        }

        staticItems.forEach((item) => {
            const value = score(item, trimmed);
            if (!value) return;
            (groups[item.group] ||= []).push({ ...item, score: value });
        });

        if (trimmed) {
            Object.keys(groups).forEach((key) => {
                if (key !== 'jump') groups[key].sort((a, b) => b.score - a.score);
            });
            if (groups.chapters) groups.chapters = groups.chapters.slice(0, 6);
        }

        if (verseResults.items.length) {
            groups.verses = verseResults.items.map((verse) => ({
                group: 'verses',
                id: `verse-${verse.id}`,
                icon: BookOpen,
                title: `Bhagavad Gita ${verseRef(verse)}`,
                subtitle: truncate(verseMeaning(verse, settings.language), 120),
                run: () => actions.selectVerse(verse)
            }));
        }

        return GROUP_ORDER.flatMap((key) => groups[key] || []);
    }, [actions, jumpPreview, parsedRef, settings.language, staticItems, trimmed, verseResults.items]);

    useEffect(() => setActiveIndex(0), [trimmed]);

    useEffect(() => {
        if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1));
    }, [items.length, activeIndex]);

    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const runItem = (item) => {
        if (!item || item.disabled) return;
        item.run?.();
        if (!item.keepOpen) onClose();
    };

    const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (items.length ? (index + 1) % items.length : 0));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (items.length ? (index - 1 + items.length) % items.length : 0));
        } else if (event.key === 'Home') {
            event.preventDefault();
            setActiveIndex(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            setActiveIndex(Math.max(0, items.length - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            runItem(items[activeIndex]);
        } else if (event.key === 'Tab') {
            event.preventDefault();
        }
    };

    const activeItem = items[activeIndex];
    let lastGroup = null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="palette-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onMouseDown={(event) => event.target === event.currentTarget && onClose()}
                >
                    <motion.div
                        className="palette"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        initial={{ opacity: 0, y: -10, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="palette__search">
                            <Search size={18} aria-hidden="true" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="Search verses, chapters, moods — or type 2.47"
                                role="combobox"
                                aria-expanded="true"
                                aria-controls="palette-list"
                                aria-activedescendant={activeItem ? `palette-${activeItem.id}` : undefined}
                                aria-autocomplete="list"
                                autoComplete="off"
                                spellCheck="false"
                            />
                            {verseResults.loading && <Loader2 size={16} className="palette__spinner" aria-label="Searching" />}
                            <button type="button" className="kbd palette__esc" onClick={onClose}>esc</button>
                        </div>

                        <div
                            ref={listRef}
                            id="palette-list"
                            className="palette__list"
                            role="listbox"
                            onMouseMove={() => {
                                pointerMoved.current = true;
                            }}
                        >
                            {items.length === 0 && !verseResults.loading && (
                                <div className="palette__empty">
                                    <p>Nothing matches “{query}”.</p>
                                    <span>Try a feeling like <em>fear</em>, a chapter number, or a verse such as <em>2.47</em>.</span>
                                </div>
                            )}

                            {items.map((item, index) => {
                                const showLabel = item.group !== lastGroup;
                                lastGroup = item.group;
                                const Icon = item.icon;
                                const active = index === activeIndex;
                                return (
                                    <React.Fragment key={item.id}>
                                        {showLabel && <div className="palette__group" role="presentation">{GROUP_LABELS[item.group]}</div>}
                                        <div
                                            id={`palette-${item.id}`}
                                            data-index={index}
                                            role="option"
                                            aria-selected={active}
                                            aria-disabled={item.disabled || undefined}
                                            className={`palette__item${active ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}`}
                                            onMouseMove={() => {
                                                if (pointerMoved.current && !active) setActiveIndex(index);
                                            }}
                                            onClick={() => runItem(item)}
                                        >
                                            <span
                                                className="palette__icon"
                                                style={item.tint ? { '--tile-rgb': item.tint } : undefined}
                                                data-tinted={item.tint ? 'true' : undefined}
                                            >
                                                {item.badge ? <span className="palette__badge">{item.badge}</span> : <Icon size={16} />}
                                            </span>
                                            <span className="palette__text">
                                                <span className="palette__title">{item.title}</span>
                                                {item.subtitle && <span className="palette__subtitle">{item.subtitle}</span>}
                                            </span>
                                            {item.keys ? (
                                                <span className="kbd-group palette__keys">
                                                    {item.keys.map((key) => <span key={key} className="kbd">{key}</span>)}
                                                </span>
                                            ) : active ? (
                                                <CornerDownLeft size={14} className="palette__enter" aria-hidden="true" />
                                            ) : null}
                                        </div>
                                    </React.Fragment>
                                );
                            })}

                            {verseResults.loading && !verseResults.items.length && trimmed.length >= 3 && (
                                <div className="palette__loading">
                                    <span className="breathing-dots"><span /><span /><span /></span>
                                    Searching the verses…
                                </div>
                            )}
                        </div>

                        <footer className="palette__footer">
                            <span className="palette__brand">
                                <LotusMark size={16} />
                                Living Gita
                            </span>
                            <span className="palette__hints">
                                <span><span className="kbd">↑</span><span className="kbd">↓</span> move</span>
                                <span><span className="kbd">↵</span> open</span>
                                <span><span className="kbd">esc</span> close</span>
                            </span>
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default CommandPalette;
