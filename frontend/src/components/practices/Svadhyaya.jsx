import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, Square, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import PracticeSpace from './PracticeSpace';
import { fetchDaily, fetchVerse } from '../../lib/gitaApi';
import { sanskritLines, verseMeaning, verseRef } from '../../lib/verse';
import { recordPath } from '../../lib/path';
import { playChime } from '../../lib/chime';
import { haptic } from '../../lib/haptics';
import { celebrate } from '../../lib/celebrate';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useVoiceReader } from '../../hooks/useVoiceReader';
import { useI18n } from '../../i18n';

// Svādhyāya — learning a verse by heart. "Whoever studies this sacred
// dialogue worships Me through knowledge" (18.70).

const LEARNED_KEY = 'lgLearned';
const LEVELS = ['read', 'gaps', 'half', 'letters', 'memory'];
const STARTERS = ['2_47', '2_14', '2_20', '6_5', '9_22', '12_13', '18_66', '2_70'];

export function readLearned() {
    try {
        const list = JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function hidden(level, lineIndex, wordIndex) {
    if (level === 'gaps') return (wordIndex + lineIndex) % 3 === 1;
    if (level === 'half') return (wordIndex + lineIndex) % 2 === 1;
    return level === 'letters' || level === 'memory';
}

function Svadhyaya({ isOpen, onClose, verse: initialVerse }) {
    const { t, lang } = useI18n();
    const { sanskrit, script } = usePreferences();
    const [verse, setVerse] = useState(initialVerse || null);
    const [starters, setStarters] = useState([]);
    const [level, setLevel] = useState(0);
    const [revealed, setRevealed] = useState(new Set());
    const [learned, setLearned] = useState(readLearned);
    const { speak, stop, speakingId, isSupported } = useVoiceReader();

    useEffect(() => {
        if (!isOpen) {
            stop();
            return;
        }
        setVerse(initialVerse || null);
        setLevel(0);
        setRevealed(new Set());
        setLearned(readLearned());
        if (!initialVerse) {
            Promise.all([fetchDaily().then((data) => data.verse).catch(() => null), ...STARTERS.map((id) => fetchVerse(id).catch(() => null))])
                .then((list) => setStarters(list.filter(Boolean).filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialVerse]);

    const lines = useMemo(() => {
        if (!verse?.sanskrit) return [];
        return sanskritLines(sanskrit(verse.sanskrit, verse.iast)).map((line) => line.split(/\s+/).filter(Boolean));
    }, [verse, sanskrit]);

    const levelId = LEVELS[level];
    const isLearned = verse && learned.some((item) => item.id === verse.id);

    const reveal = (key) => setRevealed((current) => new Set(current).add(key));

    const changeLevel = (next) => {
        setLevel(next);
        setRevealed(new Set());
        haptic('soft');
    };

    const markLearned = () => {
        if (!verse || isLearned) return;
        const list = [...readLearned(), { id: verse.id, at: new Date().toISOString() }];
        localStorage.setItem(LEARNED_KEY, JSON.stringify(list));
        setLearned(list);
        recordPath('learned', { verseId: verse.id });
        playChime('bowl');
        haptic('success');
        celebrate('full');
    };

    const speakingThis = verse && speakingId === `learn_${verse.id}`;

    return (
        <PracticeSpace isOpen={isOpen} onClose={onClose} eyebrow={t('practice.svadhyaya.yoga')} title={t('practice.svadhyaya.title')} verseRef="18.70">
            {!verse ? (
                <div className="svadhyaya">
                    <p className="day-arc__lede">{t('svadhyaya.choose')}</p>
                    <ul className="svadhyaya__starters">
                        {starters.map((item) => (
                            <li key={item.id}>
                                <button type="button" className="starter" onClick={() => setVerse(item)}>
                                    <span className="starter__ref">{verseRef(item)}</span>
                                    <span className="starter__text">{item.notification_short?.[lang] || item.notification_short?.en || verseMeaning(item, lang)}</span>
                                    {learned.some((entry) => entry.id === item.id) && <Check size={15} className="starter__learned" />}
                                </button>
                            </li>
                        ))}
                        {!starters.length && <li className="faint">{t('common.loading')}</li>}
                    </ul>
                    <p className="faint svadhyaya__count">{t('svadhyaya.learnedCount', { count: learned.length })}</p>
                </div>
            ) : (
                <div className="svadhyaya">
                    <div className="svadhyaya__levels" role="tablist" aria-label={t('svadhyaya.levels')}>
                        {LEVELS.map((id, index) => (
                            <button key={id} type="button" role="tab" aria-selected={level === index} className={`svadhyaya__level${level === index ? ' is-on' : ''}`} onClick={() => changeLevel(index)}>
                                <span>{index + 1}</span> {t(`svadhyaya.level.${id}`)}
                            </button>
                        ))}
                    </div>
                    <p className="svadhyaya__instruction">{t(`svadhyaya.hint.${levelId}`)}</p>

                    <div className={`svadhyaya__verse sanskrit${script === 'iast' ? ' sloka--iast' : ''}`}>
                        {lines.map((words, lineIndex) => (
                            <p key={lineIndex} className="svadhyaya__line">
                                {words.map((word, wordIndex) => {
                                    const key = `${lineIndex}:${wordIndex}`;
                                    const hide = hidden(levelId, lineIndex, wordIndex) && !revealed.has(key);
                                    const isDanda = /^[।॥]+$/.test(word);
                                    if (!hide || isDanda) return <span key={key} className="svadhyaya__word">{word} </span>;
                                    const shown = levelId === 'letters' ? `${[...word][0]}…` : ' '.repeat(Math.min(4, Math.max(2, Math.ceil([...word].length / 3))));
                                    return (
                                        <button key={key} type="button" className="svadhyaya__blank" onClick={() => reveal(key)} aria-label={t('svadhyaya.reveal')}>
                                            {shown}
                                        </button>
                                    );
                                })}
                            </p>
                        ))}
                    </div>

                    <AnimatePresence>
                        {levelId === 'read' && (
                            <motion.p className="svadhyaya__meaning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {verseMeaning(verse, lang)}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    <div className="text-actions">
                        {isSupported && (
                            <button
                                type="button"
                                className={`text-action${speakingThis ? ' is-on' : ''}`}
                                onClick={() => (speakingThis ? stop() : speak(`learn_${verse.id}`, verse.sanskrit, 'hi'))}
                            >
                                {speakingThis ? <Square size={12} fill="currentColor" /> : <Volume2 size={15} />} {t('svadhyaya.listen')}
                            </button>
                        )}
                        {level > 0 && (
                            <button type="button" className="text-action" onClick={() => changeLevel(level - 1)}>
                                <ArrowLeft size={14} /> {t('svadhyaya.easier')}
                            </button>
                        )}
                        {level < LEVELS.length - 1 ? (
                            <button type="button" className="text-action" onClick={() => changeLevel(level + 1)}>
                                {t('svadhyaya.harder')} <ArrowRight size={14} />
                            </button>
                        ) : (
                            <button type="button" className={`text-action${isLearned ? ' is-on' : ''}`} onClick={markLearned} disabled={isLearned}>
                                <Check size={15} /> {isLearned ? t('svadhyaya.learned') : t('svadhyaya.markLearned')}
                            </button>
                        )}
                    </div>
                    <p className="faint svadhyaya__count">
                        {t('verse.bg')} {verseRef(verse)} · {t('svadhyaya.learnedCount', { count: learned.length })}
                    </p>
                    {!initialVerse && (
                        <button type="button" className="btn btn--link btn--sm" onClick={() => setVerse(null)}>{t('svadhyaya.another')}</button>
                    )}
                </div>
            )}
        </PracticeSpace>
    );
}

export default Svadhyaya;
