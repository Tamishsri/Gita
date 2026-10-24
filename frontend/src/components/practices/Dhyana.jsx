import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Square } from 'lucide-react';
import PracticeSpace from './PracticeSpace';
import { Diya } from '../ui/Ornaments';
import { getAudioContext } from '../../lib/audio';
import { playChime } from '../../lib/chime';
import { haptic } from '../../lib/haptics';
import { celebrate } from '../../lib/celebrate';
import { recordPath } from '../../lib/path';
import { addReflection } from '../../lib/verse';
import { toast } from '../../lib/toast';
import { useSoundscape } from '../SoundscapeEngine';
import { useI18n } from '../../i18n';

// Dhyāna — sitting, as chapter 6 teaches it. The lamp does not flicker
// (6.19); the guidance changes slowly; bells mark the time if wanted.

const DURATIONS = [3, 5, 10, 15, 20, 30];
const GUIDANCE_KEYS = ['dhyana.g1', 'dhyana.g2', 'dhyana.g3', 'dhyana.g4', 'dhyana.g5', 'dhyana.g6'];

const format = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

function Dhyana({ isOpen, onClose, minutes: suggestedMinutes }) {
    const { t } = useI18n();
    const soundscape = useSoundscape();
    const [stage, setStage] = useState('setup'); // setup | sitting | done
    const [minutes, setMinutes] = useState(suggestedMinutes || 5);
    const [bells, setBells] = useState(true);
    const [drone, setDrone] = useState(false);
    const [remaining, setRemaining] = useState(minutes * 60);
    const [paused, setPaused] = useState(false);
    const [guide, setGuide] = useState(0);
    const [sat, setSat] = useState(0);
    const [note, setNote] = useState('');

    const timing = useRef({ elapsed: 0, last: null, paused: false, total: 0, nextBell: 0 });
    const wakeLock = useRef(null);
    const droneStarted = useRef(false);

    useEffect(() => {
        if (!isOpen) return;
        setStage('setup');
        setPaused(false);
        setNote('');
        if (suggestedMinutes) setMinutes(suggestedMinutes);
    }, [isOpen, suggestedMinutes]);

    const releaseWake = () => {
        wakeLock.current?.release?.().catch(() => {});
        wakeLock.current = null;
    };

    const finish = useCallback((elapsedSeconds) => {
        const minutesSat = Math.max(1, Math.round(elapsedSeconds / 60));
        playChime('ceremony');
        haptic('ceremony');
        recordPath('dhyana', { minutes: minutesSat });
        celebrate('gentle');
        setSat(minutesSat);
        setStage('done');
        releaseWake();
        if (droneStarted.current) {
            soundscape.stop();
            droneStarted.current = false;
        }
    }, [soundscape]);

    useEffect(() => {
        if (stage !== 'sitting') return undefined;
        let frame;
        const tick = (now) => {
            const timeline = timing.current;
            const delta = timeline.last == null ? 0 : Math.min(now - timeline.last, 250);
            timeline.last = now;
            if (!timeline.paused) timeline.elapsed += delta / 1000;

            const left = Math.max(0, timeline.total - timeline.elapsed);
            setRemaining((current) => (Math.ceil(current) === Math.ceil(left) ? current : left));
            setGuide(Math.min(GUIDANCE_KEYS.length - 1, Math.floor(timeline.elapsed / Math.max(60, timeline.total / GUIDANCE_KEYS.length))));

            if (bells && timeline.nextBell && timeline.elapsed >= timeline.nextBell && left > 20) {
                playChime('soft');
                timeline.nextBell += 300;
            }
            if (left <= 0) {
                finish(timeline.total);
                return;
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [stage, bells, finish]);

    useEffect(() => () => {
        releaseWake();
    }, []);

    const begin = async () => {
        getAudioContext();
        timing.current = { elapsed: 0, last: null, paused: false, total: minutes * 60, nextBell: minutes >= 10 ? 300 : 0 };
        setRemaining(minutes * 60);
        setGuide(0);
        setPaused(false);
        playChime('bowl');
        haptic('breath');
        if (drone && !soundscape.isPlaying) {
            soundscape.play('bowls');
            droneStarted.current = true;
        }
        try {
            wakeLock.current = await navigator.wakeLock?.request('screen');
        } catch {
            // the screen may dim; the timer keeps time regardless
        }
        setStage('sitting');
    };

    const togglePause = () => {
        timing.current.paused = !timing.current.paused;
        setPaused(timing.current.paused);
    };

    const endEarly = () => finish(timing.current.elapsed);

    const close = () => {
        releaseWake();
        if (droneStarted.current) {
            soundscape.stop();
            droneStarted.current = false;
        }
        onClose();
    };

    const keepNote = () => {
        if (!note.trim()) return;
        addReflection({ citation: t('dhyana.citation', { minutes: sat }), verseText: t('dhyana.g4'), note, kind: 'dhyana' });
        toast(t('toast.reflectionKept'), { icon: 'journal', tone: 'gold' });
        close();
    };

    return (
        <PracticeSpace isOpen={isOpen} onClose={close} eyebrow={t('practice.dhyana.yoga')} title={t('practice.dhyana.title')} verseRef="6.19">
            <AnimatePresence mode="wait">
                {stage === 'setup' && (
                    <motion.div key="setup" className="dhyana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Diya size={110} steady />
                        <p className="dhyana__lede">{t('dhyana.lede')}</p>
                        <div className="dhyana__durations" role="group" aria-label={t('dhyana.duration')}>
                            {DURATIONS.map((value) => (
                                <button key={value} type="button" className="chip" aria-pressed={minutes === value} onClick={() => setMinutes(value)}>
                                    {t('dhyana.minutes', { count: value })}
                                </button>
                            ))}
                        </div>
                        <div className="dhyana__options">
                            <label className="dhyana__option">
                                <button type="button" role="switch" className="switch" aria-checked={bells} onClick={() => setBells((value) => !value)} aria-label={t('dhyana.bells')} />
                                {t('dhyana.bells')}
                            </label>
                            <label className="dhyana__option">
                                <button type="button" role="switch" className="switch" aria-checked={drone} onClick={() => setDrone((value) => !value)} aria-label={t('dhyana.drone')} />
                                {t('dhyana.drone')}
                            </label>
                        </div>
                        <button type="button" className="btn btn--gold btn--lg" onClick={begin}>{t('dhyana.begin')}</button>
                    </motion.div>
                )}

                {stage === 'sitting' && (
                    <motion.div key="sitting" className="dhyana dhyana--sitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
                        <Diya size={150} steady lit={!paused} />
                        <span className="dhyana__time" role="timer" aria-live="off">{format(Math.ceil(remaining))}</span>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={guide}
                                className="dhyana__guide"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 2 }}
                            >
                                {t(GUIDANCE_KEYS[guide])}
                            </motion.p>
                        </AnimatePresence>
                        <div className="text-actions">
                            <button type="button" className="text-action" onClick={togglePause}>
                                {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? t('breaths.resume') : t('breaths.pause')}
                            </button>
                            <button type="button" className="text-action" onClick={endEarly}>
                                <Square size={12} /> {t('dhyana.end')}
                            </button>
                        </div>
                    </motion.div>
                )}

                {stage === 'done' && (
                    <motion.div key="done" className="dhyana" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Diya size={90} steady />
                        <h3 className="dhyana__done">{t('dhyana.done', { count: sat })}</h3>
                        <p className="dhyana__lede">{t('dhyana.doneLede')}</p>
                        <textarea
                            className="textarea textarea--paper dhyana__note"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={t('dhyana.notePlaceholder')}
                            rows={4}
                        />
                        <div className="text-actions">
                            <button type="button" className="btn btn--gold" onClick={keepNote} disabled={!note.trim()}>{t('guidance.keep')}</button>
                            <button type="button" className="btn btn--ghost" onClick={close}>{t('common.done')}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </PracticeSpace>
    );
}

export default Dhyana;
