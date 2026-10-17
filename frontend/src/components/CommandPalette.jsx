import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Search, BookOpen, Feather, Home, Image as ImageIcon, Languages, EyeOff, Settings as SettingsIcon,
    Info, Download, Hash, Bell, VolumeX, CornerDownLeft, BookMarked, Loader2, MessageCircle, Lock, ShieldCheck, LogOut
} from 'lucide-react';
import { isLockEnabled } from '../lib/lock';
import { quickExit } from '../lib/privacy';
import { useLayer } from '../lib/layers';
import { fetchChapters, fetchDaily, fetchVerse, searchVerses } from '../lib/gitaApi';
import { openWisdomCard, parseVerseRef, verseMeaning, verseRef } from '../lib/verse';
import { playChime } from '../lib/chime';
import { PRACTICES } from '../lib/practices';
import { MOODS } from './MoodSelector';
import { SOUND_ICONS } from './SoundDock';
import { SOUND_MODES } from './SoundscapeEngine';
import { LetterGlyph, PathGlyph } from './ui/Ornaments';
import SakhaMark from './ui/SakhaMark';
import { useI18n } from '../i18n';

const GROUP_ORDER = ['jump', 'ask', 'actions', 'practices', 'moods', 'sound', 'chapters', 'verses'];

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

const truncate = (text, length = 110) => (!text ? '' : text.length > length ? `${text.slice(0, length).trimEnd()}…` : text);

function CommandPalette({ isOpen, onClose, actions, settings, view, journalCount, install }) {
    const { t } = useI18n();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [chapters, setChapters] = useState([]);
    const [verseResults, setVerseResults] = useState({ query: '', items: [], loading: false });
    const [jumpPreview, setJumpPreview] = useState(null);

    const inputRef = useRef(null);
    const listRef = useRef(null);

    useLayer(isOpen, { onEscape: onClose, blocksHotkeys: true });

    const trimmed = query.trim().toLowerCase();
    const parsedRef = useMemo(() => parseVerseRef(query), [query]);

    useEffect(() => {
        if (!isOpen) return;
        setQuery('');
        setActiveIndex(0);
        setJumpPreview(null);
        requestAnimationFrame(() => inputRef.current?.focus());
        fetchChapters().then(setChapters).catch(() => {});
    }, [isOpen]);

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

        add('actions', { id: 'search', icon: Search, title: t('palette.finder'), subtitle: t('palette.finderSub'), keys: ['/'], keywords: 'search find verses topics', run: () => actions.openPanel('search') });
        add('actions', { id: 'journal', icon: Feather, title: t('palette.journal'), subtitle: journalCount ? t('journal.entries', { count: journalCount }) : t('palette.journalSub'), keys: ['J'], keywords: 'notes diary reflections', run: () => actions.openPanel('journal') });
        add('actions', { id: 'chapters', icon: BookOpen, title: t('palette.chapters'), subtitle: t('palette.chaptersSub'), keys: ['C'], keywords: 'read reader adhyaya', run: () => actions.openPanel('chapters') });
        add('actions', { id: 'path', icon: PathGlyph, title: t('palette.path'), subtitle: t('palette.pathSub'), keywords: 'path history weather progress', run: () => actions.openPanel('path') });
        add('actions', { id: 'letters', icon: LetterGlyph, title: t('palette.letters'), subtitle: t('palette.lettersSub'), keywords: 'letter future self capsule write later patra', run: () => actions.openPanel('letters') });
        if (view === 'sanctuary') add('actions', { id: 'home', icon: Home, title: t('palette.home'), keys: ['Esc'], keywords: 'back', run: actions.goHome });
        add('actions', { id: 'daily-card', icon: ImageIcon, title: t('palette.dailyCard'), subtitle: t('palette.dailyCardSub'), keywords: 'share image png instagram whatsapp daily', run: () => fetchDaily().then((data) => data?.verse && openWisdomCard(data.verse, settings.language)).catch(() => {}) });
        add('actions', { id: 'language', icon: Languages, title: settings.language === 'hi' ? t('palette.toEnglish') : t('palette.toHindi'), keywords: 'language hindi english हिंदी', run: actions.toggleLanguage });
        add('actions', { id: 'silent', icon: EyeOff, title: settings.silentMode ? t('palette.silentOff') : t('palette.silentOn'), subtitle: t('settings.silentDesc'), keywords: 'quiet silent mode', run: actions.toggleSilent });
        add('actions', { id: 'you', icon: ShieldCheck, title: t('palette.you'), subtitle: t('palette.youSub'), keywords: 'me profile privacy voice path data passcode lock export', run: () => actions.openPanel('you') });
        if (isLockEnabled()) add('actions', { id: 'lock', icon: Lock, title: t('palette.lock'), subtitle: t('palette.lockSub'), keywords: 'lock passcode hide close', run: actions.lockNow });
        add('actions', { id: 'exit', icon: LogOut, title: t('palette.exit'), subtitle: t('palette.exitSub'), keywords: 'quick exit leave hide safety', run: quickExit });
        add('actions', { id: 'settings', icon: SettingsIcon, title: t('nav.settings'), keywords: 'settings options preferences script', run: () => actions.openPanel('settings') });
        add('actions', { id: 'about', icon: Info, title: t('about.short'), subtitle: t('palette.aboutSub'), keywords: 'help crisis helpline disclaimer principles', run: () => actions.openPanel('about') });
        if (install?.available) add('actions', { id: 'install', icon: Download, title: t('install.title'), subtitle: t('install.cardBody'), keywords: 'pwa app install offline', run: actions.install });

        PRACTICES.forEach((practice) => add('practices', {
            id: `practice-${practice.id}`,
            icon: practice.glyph,
            title: t(`practice.${practice.id}.title`),
            subtitle: `${t(`practice.${practice.id}.yoga`)} · ${practice.ref}`,
            keywords: `practice ${practice.id} ${t(`practice.${practice.id}.desc`)}`,
            run: () => actions.openPractice(practice.id)
        }));

        MOODS.forEach((mood) => add('moods', {
            id: `mood-${mood.id}`,
            icon: mood.icon,
            title: t(`mood.${mood.id}.word`),
            subtitle: t(`mood.${mood.id}.hint`),
            keywords: `${mood.id} feeling mood`,
            tint: mood.rgb,
            run: () => actions.selectMood(mood.id)
        }));

        SOUND_MODES.forEach((mode) => add('sound', {
            id: `sound-${mode.id}`,
            icon: SOUND_ICONS[mode.id],
            title: t('palette.playSound', { name: t(`sound.${mode.id}.label`) }),
            subtitle: t(`sound.${mode.id}.desc`),
            keywords: 'sound ambient music soundscape audio',
            run: () => actions.playSound(mode.id)
        }));
        add('sound', { id: 'sound-mute', icon: VolumeX, title: t('palette.silence'), keywords: 'mute stop sound quiet', run: actions.muteSound });
        add('sound', { id: 'bowl', icon: Bell, title: t('sound.bowl'), subtitle: t('palette.bowlSub'), keywords: 'chime bell bowl tibetan', keepOpen: true, run: () => playChime('bowl', { force: true }) });

        const chapterList = chapters.length ? chapters : Array.from({ length: 18 }, (_, index) => ({ chapter: index + 1 }));
        chapterList.forEach((chapter) => add('chapters', {
            id: `chapter-${chapter.chapter}`,
            icon: BookMarked,
            badge: chapter.chapter,
            title: chapter.name_english ? `${chapter.chapter}. ${chapter.name_english.replace(/\s*\(.*\)$/, '')}` : `${t('chapters.chapter')} ${chapter.chapter}`,
            subtitle: [chapter.name_sanskrit, chapter.name_english?.match(/\((.*)\)/)?.[1]].filter(Boolean).join(' · '),
            keywords: `chapter adhyaya ${chapter.chapter} ${(chapter.helps_with || []).join(' ')}`,
            run: () => actions.openChapter(chapter.chapter)
        }));

        return list;
    }, [actions, chapters, install?.available, journalCount, settings.language, settings.silentMode, view, t]);

    const items = useMemo(() => {
        const groups = {};

        if (parsedRef) {
            const ready = jumpPreview?.status === 'ready' && jumpPreview.id === parsedRef.id;
            const missing = jumpPreview?.status === 'missing' && jumpPreview.id === parsedRef.id;
            groups.jump = [{
                group: 'jump',
                id: `jump-${parsedRef.id}`,
                icon: Hash,
                title: `${t('verse.bg')} ${parsedRef.chapter}.${parsedRef.verse}`,
                subtitle: ready ? truncate(verseMeaning(jumpPreview.verse, settings.language)) : missing ? t('palette.missing') : t('palette.finding'),
                disabled: missing,
                run: () => (ready ? actions.selectVerse(jumpPreview.verse) : fetchVerse(parsedRef.id).then(actions.selectVerse).catch(() => {}))
            }];
        }

        // Anything longer than a word can simply be asked.
        if (!parsedRef && trimmed.length > 3 && trimmed.includes(' ')) {
            groups.ask = [{
                group: 'ask',
                id: 'ask',
                icon: MessageCircle,
                title: t('palette.ask', { query: query.trim() }),
                subtitle: t('palette.askSub'),
                run: () => actions.ask(query.trim())
            }];
        }

        staticItems.forEach((item) => {
            const value = score(item, trimmed);
            if (!value) return;
            (groups[item.group] ||= []).push({ ...item, score: value });
        });

        if (trimmed) {
            Object.keys(groups).forEach((key) => {
                if (!['jump', 'ask'].includes(key)) groups[key].sort((a, b) => b.score - a.score);
            });
            if (groups.chapters) groups.chapters = groups.chapters.slice(0, 6);
        }

        if (verseResults.items.length) {
            groups.verses = verseResults.items.map((verse) => ({
                group: 'verses',
                id: `verse-${verse.id}`,
                icon: BookOpen,
                title: `${t('verse.bg')} ${verseRef(verse)}`,
                subtitle: truncate(verseMeaning(verse, settings.language)),
                run: () => actions.selectVerse(verse)
            }));
        }

        return GROUP_ORDER.flatMap((key) => groups[key] || []);
    }, [actions, jumpPreview, parsedRef, settings.language, staticItems, trimmed, query, verseResults.items, t]);

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
                        aria-label={t('palette.label')}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="palette__search">
                            <Search size={18} aria-hidden="true" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={t('palette.placeholder')}
                                role="combobox"
                                aria-expanded="true"
                                aria-controls="palette-list"
                                aria-activedescendant={activeItem ? `palette-${activeItem.id}` : undefined}
                                aria-autocomplete="list"
                                autoComplete="off"
                                spellCheck="false"
                            />
                            {verseResults.loading && <Loader2 size={16} className="palette__spinner" aria-label={t('search.seeking')} />}
                            <button type="button" className="kbd palette__esc" onClick={onClose}>esc</button>
                        </div>

                        <div ref={listRef} id="palette-list" className="palette__list" role="listbox">
                            {items.length === 0 && !verseResults.loading && (
                                <div className="palette__empty">
                                    <p>{t('palette.none', { query })}</p>
                                    <span>{t('palette.noneHint')}</span>
                                </div>
                            )}

                            {items.map((item, index) => {
                                const showLabel = item.group !== lastGroup;
                                lastGroup = item.group;
                                const Icon = item.icon;
                                const active = index === activeIndex;
                                return (
                                    <React.Fragment key={item.id}>
                                        {showLabel && <div className="palette__group" role="presentation">{t(`palette.group.${item.group}`)}</div>}
                                        <div
                                            id={`palette-${item.id}`}
                                            data-index={index}
                                            role="option"
                                            aria-selected={active}
                                            aria-disabled={item.disabled || undefined}
                                            className={`palette__item${active ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}`}
                                            onMouseMove={() => !active && setActiveIndex(index)}
                                            onClick={() => runItem(item)}
                                        >
                                            <span className="palette__icon" style={item.tint ? { '--tile-rgb': item.tint } : undefined} data-tinted={item.tint ? 'true' : undefined}>
                                                {item.badge ? <span className="palette__badge">{item.badge}</span> : <Icon size={17} />}
                                            </span>
                                            <span className="palette__text">
                                                <span className="palette__title">{item.title}</span>
                                                {item.subtitle && <span className="palette__subtitle">{item.subtitle}</span>}
                                            </span>
                                            {item.keys ? (
                                                <span className="kbd-group palette__keys">{item.keys.map((key) => <span key={key} className="kbd">{key}</span>)}</span>
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
                                    {t('palette.searching')}
                                </div>
                            )}
                        </div>

                        <footer className="palette__footer">
                            <span className="palette__brand"><SakhaMark size={18} /> {t('brand.name')}</span>
                            <span className="palette__hints">
                                <span><span className="kbd">↑</span><span className="kbd">↓</span> {t('palette.move')}</span>
                                <span><span className="kbd">↵</span> {t('palette.open')}</span>
                                <span><span className="kbd">esc</span> {t('common.close')}</span>
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
