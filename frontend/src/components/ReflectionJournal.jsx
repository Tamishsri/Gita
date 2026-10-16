import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Copy, Download, Feather, Footprints, Lock, Search, Trash2, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { REFLECTIONS_EVENT, copyText, readReflections, writeReflections } from '../lib/verse';
import { fetchVerse } from '../lib/gitaApi';
import { toast } from '../lib/toast';

function dayLabel(iso) {
    const date = new Date(iso);
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: days > 300 ? 'numeric' : undefined });
}

const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const fullDate = (iso) => new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
});

function exportMarkdown(reflections) {
    const now = new Date();
    let content = '# Living Gita — Personal Reflections\n';
    content += `Exported ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}\n\n`;
    content += '> "One should lift oneself by one\'s own mind, and not degrade oneself; for this mind is truly the friend of oneself, and this mind alone is one\'s enemy." — Bhagavad Gita 6.5\n\n---\n\n';
    reflections.forEach((entry, index) => {
        content += `### ${index + 1}. ${entry.citation || 'Gita Verse'}\n`;
        content += `*${fullDate(entry.date)}*\n\n`;
        if (entry.verseText) content += `> "${entry.verseText}"\n\n`;
        content += `${entry.note}\n\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Living_Gita_Reflections_${now.toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReflectionJournal({ isOpen, onClose, onSelectVerse }) {
    const [reflections, setReflections] = useState(readReflections);
    const [filter, setFilter] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [confirmAll, setConfirmAll] = useState(false);

    useEffect(() => {
        const update = () => setReflections(readReflections());
        window.addEventListener(REFLECTIONS_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(REFLECTIONS_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setReflections(readReflections());
        setFilter('');
        setConfirmId(null);
        setConfirmAll(false);
    }, [isOpen]);

    const groups = useMemo(() => {
        const query = filter.trim().toLowerCase();
        const visible = query
            ? reflections.filter((entry) => [entry.note, entry.citation, entry.verseText].some((field) => field?.toLowerCase().includes(query)))
            : reflections;
        const map = new Map();
        visible.forEach((entry) => {
            const label = dayLabel(entry.date);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(entry);
        });
        return [...map.entries()];
    }, [reflections, filter]);

    const remove = (id) => {
        writeReflections(reflections.filter((entry) => entry.id !== id));
        setConfirmId(null);
        toast('Let go. The reflection has been released.', { icon: 'journal' });
    };

    const releaseAll = () => {
        writeReflections([]);
        setConfirmAll(false);
        toast('All reflections released. Aparigraha.', { icon: 'journal' });
    };

    const copy = async (entry) => {
        const ok = await copyText(`"${entry.note}"\n\n— Reflection on ${entry.citation || 'the Bhagavad Gita'}\n${entry.verseText ? `Verse: "${entry.verseText}"\n` : ''}${fullDate(entry.date)}\n🕊️ Living Gita`);
        toast(ok ? 'Reflection copied' : 'Copying is blocked here.', { icon: ok ? 'check' : undefined });
    };

    const revisit = async (entry) => {
        try {
            const verse = await fetchVerse(entry.verseId);
            onClose();
            onSelectVerse?.(verse);
        } catch {
            toast('That verse could not be opened right now.');
        }
    };

    const count = reflections.length;
    const visibleCount = groups.reduce((total, [, entries]) => total + entries.length, 0);

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label="Reflections journal" width={680} size="tall">
            <SheetHeader
                icon={Feather}
                eyebrow="Reflections"
                title="Your journal"
                subtitle={count ? `${count} ${count === 1 ? 'entry' : 'entries'} · kept only on this device` : 'Kept only on this device'}
                onClose={onClose}
                actions={count > 0 && (
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => exportMarkdown(reflections)} title="Export as Markdown">
                        <Download size={14} />
                        <span className="hide-xs">Export</span>
                    </button>
                )}
            />

            {count > 3 && (
                <div className="search-controls search-controls--compact">
                    <div className="field">
                        <Search size={15} />
                        <input
                            className="input input--pill"
                            type="search"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            placeholder="Search your reflections"
                            aria-label="Search reflections"
                        />
                        {filter && (
                            <button type="button" className="icon-btn icon-btn--xs icon-btn--plain field__clear" onClick={() => setFilter('')} aria-label="Clear">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="sheet__body">
                {count === 0 && (
                    <div className="empty-state">
                        <Feather size={36} className="empty-state__mark" />
                        <h3>Your journal is waiting</h3>
                        <p>Whenever a verse touches something in you, tap <strong>Reflect</strong> to keep a quiet note here. Notes from your 7-day walks gather here too.</p>
                    </div>
                )}

                {count > 0 && visibleCount === 0 && (
                    <div className="empty-state">
                        <h3>Nothing matches “{filter}”</h3>
                    </div>
                )}

                {groups.map(([label, entries]) => (
                    <section key={label} className="journal-group">
                        <h3 className="journal-group__label">{label}</h3>
                        <AnimatePresence initial={false}>
                            {entries.map((entry) => {
                                const confirming = confirmId === entry.id;
                                const isJourney = entry.kind === 'journey' || entry.citation?.includes('7-Day Walk');
                                return (
                                    <motion.article
                                        key={entry.id}
                                        className="journal-entry"
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                    >
                                        <header className="journal-entry__head">
                                            <span className="eyebrow">
                                                {isJourney ? <Footprints size={12} /> : <BookOpen size={12} />}
                                                {entry.citation}
                                            </span>
                                            <time dateTime={entry.date} className="faint">{timeLabel(entry.date)}</time>
                                        </header>
                                        {entry.verseText && <blockquote className="journal-entry__verse">{entry.verseText}</blockquote>}
                                        <p className="journal-entry__note">{entry.note}</p>
                                        <footer className="journal-entry__actions">
                                            {confirming ? (
                                                <span className="journal-entry__confirm">
                                                    Let this go?
                                                    <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(entry.id)}>Let go</button>
                                                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(null)}>Keep</button>
                                                </span>
                                            ) : (
                                                <>
                                                    {entry.verseId && /^\d+_\d+$/.test(entry.verseId) && (
                                                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => revisit(entry)}>Revisit verse</button>
                                                    )}
                                                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain" onClick={() => copy(entry)} aria-label="Copy reflection" title="Copy">
                                                        <Copy size={14} />
                                                    </button>
                                                    <button type="button" className="icon-btn icon-btn--xs icon-btn--plain" onClick={() => setConfirmId(entry.id)} aria-label="Let go of this reflection" title="Let go">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </footer>
                                    </motion.article>
                                );
                            })}
                        </AnimatePresence>
                    </section>
                ))}
            </div>

            {count > 0 && (
                <footer className="sheet__footer">
                    {confirmAll ? (
                        <span className="journal-entry__confirm">
                            Release every reflection?
                            <button type="button" className="btn btn--danger btn--sm" onClick={releaseAll}>Release all</button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmAll(false)}>Keep</button>
                        </span>
                    ) : (
                        <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmAll(true)}>
                            Release all (aparigraha)
                        </button>
                    )}
                    <span className="faint sheet__footer-note"><Lock size={12} /> Private to this device</span>
                </footer>
            )}
        </Sheet>
    );
}

export default ReflectionJournal;
