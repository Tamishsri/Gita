import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Sheet, { SheetHeader } from './ui/Sheet';
import { PathGlyph } from './ui/Ornaments';
import { MOODS } from './MoodSelector';
import { PATH_EVENT, localDateKey, readPath, releasePath } from '../lib/path';
import { GUNAS } from '../lib/day';
import { fetchVerse } from '../lib/gitaApi';
import { readLearned } from './practices/Svadhyaya';
import { toast } from '../lib/toast';
import { useI18n, localeFor } from '../i18n';

const DAY_MS = 86400000;

// Moods named, and the feelings heard in words, gathered into one weather.
const EMOTION_TO_MOOD = {
    anxiety: 'anxious', fear: 'anxious', stress: 'stressed', anger: 'angry', confusion: 'confused', purpose: 'confused',
    sadness: 'sad', grief: 'sad', loneliness: 'lonely', heartbreak: 'sad', peace: 'peace', gratitude: 'happy',
    guilt: 'sad', unworthiness: 'sad', failure: 'stressed', envy: 'angry', craving: 'stressed', lust: 'stressed',
    emptiness: 'sad', pride: 'confused', love: 'happy', devotion: 'peace', inertia: 'stressed'
};

function summarise(events) {
    const now = Date.now();
    const within = (event, days) => now - new Date(event.at).getTime() < days * DAY_MS;
    const month = events.filter((event) => within(event, 30));

    const days = new Set(month.map((event) => localDateKey(new Date(event.at))));

    const weather = {};
    month.forEach((event) => {
        const mood = event.kind === 'mood' ? event.mood : event.kind === 'verse' ? (EMOTION_TO_MOOD[event.emotion] || null) : null;
        if (mood) weather[mood] = (weather[mood] || 0) + 1;
    });

    const gunas = {};
    month.filter((event) => event.kind === 'sandhya' && event.guna).forEach((event) => {
        gunas[event.guna] = (gunas[event.guna] || 0) + 1;
    });

    const total = (kind, field) => events.filter((event) => event.kind === kind).reduce((sum, event) => sum + (field ? Number(event[field]) || 0 : 1), 0);

    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now - (6 - index) * DAY_MS);
        const key = localDateKey(date);
        const kinds = new Set(events.filter((event) => localDateKey(new Date(event.at)) === key).map((event) => event.kind));
        return { date, key, kinds };
    });

    const recent = [];
    for (let i = events.length - 1; i >= 0 && recent.length < 8; i--) {
        if (events[i].kind === 'verse' && events[i].verseId && !recent.includes(events[i].verseId)) recent.push(events[i].verseId);
    }

    return {
        returned: days.size,
        weather: Object.entries(weather).sort((a, b) => b[1] - a[1]),
        gunas,
        totals: {
            japa: total('japa'),
            minutes: total('dhyana', 'minutes'),
            breaths: total('breaths'),
            reflections: total('reflection'),
            verses: total('verse'),
            sandhya: total('sandhya')
        },
        week,
        recent
    };
}

function PathView({ isOpen, onClose, onSelectVerse, onOpenYou }) {
    const { t, lang } = useI18n();
    const [events, setEvents] = useState(readPath);
    const [confirm, setConfirm] = useState(false);

    useEffect(() => {
        const update = () => setEvents(readPath());
        window.addEventListener(PATH_EVENT, update);
        return () => window.removeEventListener(PATH_EVENT, update);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setEvents(readPath());
            setConfirm(false);
        }
    }, [isOpen]);

    const summary = useMemo(() => summarise(events), [events]);
    const learned = isOpen ? readLearned().length : 0;
    const maxWeather = summary.weather[0]?.[1] || 1;
    const gunaTotal = Object.values(summary.gunas).reduce((sum, value) => sum + value, 0);

    const openRecent = async (id) => {
        try {
            const verse = await fetchVerse(id);
            onClose();
            onSelectVerse?.(verse);
        } catch {
            toast(t('journal.revisitFailed'));
        }
    };

    const release = () => {
        releasePath();
        setConfirm(false);
        toast(t('path.released'), { icon: 'walk' });
    };

    return (
        <Sheet isOpen={isOpen} onClose={onClose} label={t('path.title')} width={640} size="tall">
            <SheetHeader icon={PathGlyph} eyebrow={t('path.eyebrow')} title={t('path.title')} subtitle={t('path.subtitle')} onClose={onClose} />
            <div className="sheet__body sheet__body--padded path">
                <blockquote className="path__verse">
                    <p>{t('path.verse')}</p>
                    <cite>{t('verse.bg')} 2.14</cite>
                </blockquote>

                {events.length === 0 ? (
                    <div className="empty-state">
                        <PathGlyph size={40} className="empty-state__mark" />
                        <h3>{t('path.emptyTitle')}</h3>
                        <p>{t('path.emptyBody')}</p>
                    </div>
                ) : (
                    <>
                        <section className="path__section">
                            <h3 className="eyebrow">{t('path.week')}</h3>
                            <ol className="path-week">
                                {summary.week.map((day) => (
                                    <li key={day.key} className={day.kinds.size ? 'is-present' : ''}>
                                        <span className="path-week__day">{day.date.toLocaleDateString(localeFor(lang), { weekday: 'narrow' })}</span>
                                        <span className="path-week__lamp" aria-hidden="true" />
                                        <span className="sr-only">{day.kinds.size ? t('path.present') : t('path.absent')}</span>
                                    </li>
                                ))}
                            </ol>
                            <p className="path__line">{t('path.returned', { count: summary.returned })}</p>
                        </section>

                        {summary.weather.length > 0 && (
                            <section className="path__section">
                                <h3 className="eyebrow">{t('path.weather')}</h3>
                                <ul className="weather">
                                    {summary.weather.map(([mood, count]) => {
                                        const info = MOODS.find((item) => item.id === mood);
                                        return (
                                            <li key={mood} style={{ '--tile-rgb': info?.rgb || '220, 150, 64' }}>
                                                <span className="weather__word">{t(`mood.${mood}.word`)}</span>
                                                <span className="weather__bar"><span style={{ width: `${(count / maxWeather) * 100}%` }} /></span>
                                                <span className="weather__count">{count}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="path__note">{t('path.weatherNote')}</p>
                            </section>
                        )}

                        {gunaTotal > 0 && (
                            <section className="path__section">
                                <h3 className="eyebrow">{t('path.gunas')}</h3>
                                <div className="guna-bar" role="img" aria-label={GUNAS.map((guna) => `${t(`guna.${guna.id}.name`)} ${summary.gunas[guna.id] || 0}`).join(', ')}>
                                    {GUNAS.map((guna) => (
                                        <span key={guna.id} style={{ flex: summary.gunas[guna.id] || 0, '--guna-rgb': guna.rgb }} title={t(`guna.${guna.id}.name`)} />
                                    ))}
                                </div>
                                <div className="guna-legend">
                                    {GUNAS.map((guna) => (
                                        <span key={guna.id} style={{ '--guna-rgb': guna.rgb }}>{t(`guna.${guna.id}.name`)} · {summary.gunas[guna.id] || 0}</span>
                                    ))}
                                </div>
                                <p className="path__note">{t('path.gunaNote')}</p>
                            </section>
                        )}

                        <section className="path__section">
                            <h3 className="eyebrow">{t('path.practice')}</h3>
                            <dl className="path-totals">
                                <div><dt>{t('path.total.verses')}</dt><dd>{summary.totals.verses}</dd></div>
                                <div><dt>{t('path.total.japa')}</dt><dd>{summary.totals.japa}</dd></div>
                                <div><dt>{t('path.total.minutes')}</dt><dd>{summary.totals.minutes}</dd></div>
                                <div><dt>{t('path.total.breaths')}</dt><dd>{summary.totals.breaths}</dd></div>
                                <div><dt>{t('path.total.reflections')}</dt><dd>{summary.totals.reflections}</dd></div>
                                <div><dt>{t('path.total.learned')}</dt><dd>{learned}</dd></div>
                            </dl>
                        </section>

                        {summary.recent.length > 0 && (
                            <section className="path__section">
                                <h3 className="eyebrow">{t('path.recent')}</h3>
                                <ul className="path-recent">
                                    {summary.recent.map((id) => (
                                        <li key={id}>
                                            <button type="button" className="text-action" onClick={() => openRecent(id)}>
                                                {t('verse.bg')} {id.replace('_', '.')} <ArrowRight size={13} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section className="path__section">
                            <h3 className="eyebrow">{t('path.memory')}</h3>
                            <p className="path__note">{t('path.memoryMoved')}</p>
                            <button type="button" className="text-action" onClick={() => { onClose(); onOpenYou?.(); }}>
                                {t('you.title')} <ArrowRight size={13} />
                            </button>
                        </section>

                        <p className="path__principle">{t('path.principle')}</p>
                    </>
                )}
            </div>
            {events.length > 0 && (
                <footer className="sheet__footer">
                    {confirm ? (
                        <span className="journal-entry__confirm">
                            {t('path.releaseConfirm')}
                            <button type="button" className="btn btn--danger btn--sm" onClick={release}>{t('path.release')}</button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>{t('common.keep')}</button>
                        </span>
                    ) : (
                        <button type="button" className="btn btn--link btn--sm" onClick={() => setConfirm(true)}>{t('path.release')}</button>
                    )}
                    <span className="faint sheet__footer-note">{t('common.privateDevice')}</span>
                </footer>
            )}
        </Sheet>
    );
}

export default PathView;
