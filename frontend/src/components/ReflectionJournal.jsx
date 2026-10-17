import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Copy, Download, Feather, Lock, Search, Trash2, X } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { FlameGlyph, PathGlyph, SandhyaGlyph } from './ui/Ornaments';
import { REFLECTIONS_EVENT, copyText, readReflections, writeReflections } from '../lib/verse';
import { fetchVerse } from '../lib/gitaApi';
import { toast } from '../lib/toast';
import { useI18n, localeFor } from '../i18n';
import { BRAND } from '../lib/brand';

const KIND_ICONS = { journey: PathGlyph, sandhya: SandhyaGlyph, dhyana: FlameGlyph };

function exportMarkdown(reflections, t, locale) {
    const now = new Date();
    const full = (iso) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    let content = `# ${t('journal.exportTitle')}\n`;
    content += `${t('journal.exportedOn', { date: now.toLocaleDateString(locale), time: now.toLocaleTimeString(locale) })}\n\n`;
    content += `> ${t('journal.exportEpigraph')}\n\n---\n\n`;
    reflections.forEach((entry, index) => {
        content += `### ${index + 1}. ${entry.citation || t('verse.bg')}\n`;
        content += `*${full(entry.date)}*\n\n`;
        if (entry.verseText) content += `> "${entry.verseText}"\n\n`;
        content += `${entry.note}\n\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${BRAND.slug}_Reflections_${now.toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReflectionJournal({ isOpen, onClose, onSelectVerse }) {
    const { t, lang } = useI18n();
    const locale = localeFor(lang);
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

    const dayLabel = (iso) => {
        const date = new Date(iso);
        const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
        if (days === 0) return t('time.today');
        if (days === 1) return t('time.yesterday');
        if (days < 7) return date.toLocaleDateString(locale, { weekday: 'long' });
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: days > 300 ? 'numeric' : undefined });
    };

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reflections, filter, lang]);

    const remove = (id) => {
        writeReflections(reflections.filter((entry) => entry.id !== id));
        setConfirmId(null);
        toast(t('journal.released'), { icon: 'journal' });
    };

    const releaseAll = () => {
        writeReflections([]);
        setConfirmAll(false);
        toast(t('journal.releasedAll'), { icon: 'journal' });
    };

    const copy = async (entry) => {
        const when = new Date(entry.date).toLocaleString(locale);
        const ok = await copyText(`"${entry.note}"\n\n— ${entry.citation || t('verse.bg')}\n${entry.verseText ? `"${entry.verseText}"\n` : ''}${when}\n🪔 ${t('brand.name')}`);
        toast(ok ? t('journal.copied') : t('toast.copyBlocked'), { icon: ok ? 'check' : undefined });
    };

    const revisit = async (entry) => {
        try {
            const verse = await fetchVerse(entry.verseId);
            onClose();
            onSelectVerse?.(verse);
        } catch {
            toast(t('journal.revisitFailed'));
        }
    };

    const count = reflections.length;
    const visibleCount = groups.reduce((total, [, entries]) => total + entries.length, 0);

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('journal.title')} width={700} size="tall">
            <SheetHeader
                icon={Feather}
                eyebrow={t('journal.eyebrow')}
                title={t('journal.title')}
                subtitle={count ? t('journal.entries', { count }) : t('common.privateDevice')}
                onClose={onClose}
                actions={count > 0 && (
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => exportMarkdown(reflections, t, locale)} title={t('journal.export')}>
                        <Download size={14} />
                        <span className="hide-xs">{t('journal.exportShort')}</span>
                    </button>
                )}
            />

            {count > 3 && (
                <div className="search-controls search-controls--compact">
                    <div className="field">
                        <Search size={15} />
                        <input className="input input--pill" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('journal.search')} aria-label={t('journal.search')} />
                        {filter && (
                            <button type="button" className="icon-btn icon-btn--xs field__clear" onClick={() => setFilter('')} aria-label={t('common.clear')}>
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
                        <h3>{t('journal.emptyTitle')}</h3>
                        <p>{t('journal.emptyBody')}</p>
                    </div>
                )}

                {count > 0 && visibleCount === 0 && (
                    <div className="empty-state"><h3>{t('journal.noMatch', { query: filter })}</h3></div>
                )}

                {groups.map(([label, entries]) => (
                    <section key={label} className="journal-group">
                        <h3 className="journal-group__label">{label}</h3>
                        <AnimatePresence initial={false}>
                            {entries.map((entry) => {
                                const confirming = confirmId === entry.id;
                                const KindIcon = KIND_ICONS[entry.kind];
                                return (
                                    <motion.article key={entry.id} className="journal-entry" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
                                        <header className="journal-entry__head">
                                            <span className="eyebrow">
                                                {KindIcon ? <KindIcon size={15} /> : <BookOpen size={12} />}
                                                {entry.citation}
                                            </span>
                                            <time dateTime={entry.date} className="faint">
                                                {new Date(entry.date).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
                                            </time>
                                        </header>
                                        {entry.verseText && <blockquote className="journal-entry__verse">{entry.verseText}</blockquote>}
                                        <p className="journal-entry__note">{entry.note}</p>
                                        <footer className="journal-entry__actions">
                                            {confirming ? (
                                                <span className="journal-entry__confirm">
                                                    {t('journal.letGoConfirm')}
                                                    <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(entry.id)}>{t('journal.letGo')}</button>
                                                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmId(null)}>{t('common.keep')}</button>
                                                </span>
                                            ) : (
                                                <>
                                                    {entry.verseId && /^\d+_\d+$/.test(entry.verseId) && (
                                                        <button type="button" className="text-action" onClick={() => revisit(entry)}>{t('journal.revisit')}</button>
                                                    )}
                                                    <button type="button" className="icon-btn icon-btn--xs" onClick={() => copy(entry)} aria-label={t('journal.copy')} title={t('journal.copy')}>
                                                        <Copy size={14} />
                                                    </button>
                                                    <button type="button" className="icon-btn icon-btn--xs" onClick={() => setConfirmId(entry.id)} aria-label={t('journal.letGo')} title={t('journal.letGo')}>
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
                            {t('journal.releaseAllConfirm')}
                            <button type="button" className="btn btn--danger btn--sm" onClick={releaseAll}>{t('journal.releaseAllYes')}</button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmAll(false)}>{t('common.keep')}</button>
                        </span>
                    ) : (
                        <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirmAll(true)}>{t('journal.releaseAll')}</button>
                    )}
                    <span className="faint sheet__footer-note"><Lock size={12} /> {t('common.privateDevice')}</span>
                </footer>
            )}
        </Sheet>
    );
}

export default ReflectionJournal;
