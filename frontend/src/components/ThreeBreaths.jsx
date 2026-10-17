import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion';
import { Leaf, Sun, Mountain, Compass, Ear, Pause, Play, SkipForward } from 'lucide-react';
import { Diya } from './ui/Ornaments';
import { getAudioContext } from '../lib/audio';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { celebrate } from '../lib/celebrate';
import { recordPath } from '../lib/path';
import { useHasKeyboard } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

// The threshold: three rounds of 4-7-8 breath with the lamp — "others offer
// the in-breath into the out-breath" (4.29). The flame rises with the inhale
// and stays steady through the hold. Timing runs on requestAnimationFrame
// against elapsed time, so pausing is exact and a hidden tab simply waits.

const PHASES = [
    { id: 'inhale', seconds: 4 },
    { id: 'hold', seconds: 7 },
    { id: 'exhale', seconds: 8 }
];
const CYCLES = 3;
const MIN_SCALE = 0.62;
const RING_RADIUS = 128;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const SESSION_HOURS = 4;

const INTENTS = [
    { id: 'calm', icon: Leaf },
    { id: 'clarity', icon: Sun },
    { id: 'courage', icon: Mountain },
    { id: 'guidance', icon: Compass },
    { id: 'listening', icon: Ear }
];

const easeInOut = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function scaleFor(phaseId, progress) {
    if (phaseId === 'inhale') return MIN_SCALE + (1 - MIN_SCALE) * easeInOut(progress);
    if (phaseId === 'exhale') return 1 - (1 - MIN_SCALE) * easeInOut(progress);
    return 1;
}

function ThreeBreaths({ onComplete }) {
    const { t } = useI18n();
    const [stage, setStage] = useState('invite'); // invite | breathing | intent
    const [display, setDisplay] = useState({ phase: 0, cycle: 0, remaining: PHASES[0].seconds });
    const [paused, setPaused] = useState(false);
    const [selectedIntent, setSelectedIntent] = useState(null);
    const [flame, setFlame] = useState(MIN_SCALE);

    const reduceMotion = useReducedMotion();
    const hasKeyboard = useHasKeyboard();
    const timing = useRef({ phase: 0, cycle: 0, elapsed: 0, last: null, paused: false });
    const progress = useMotionValue(0);
    const scale = useMotionValue(MIN_SCALE);
    const dashOffset = useTransform(progress, (value) => RING_LENGTH * (1 - value));
    const glow = useTransform(scale, [MIN_SCALE, 1], [0.25, 0.9]);

    // Each stage begins at the top, wherever the last one was scrolled to.
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [stage]);

    // The lamp's flame follows the breath (coarsely, to keep renders calm).
    useMotionValueEvent(scale, 'change', (value) => {
        const rounded = Math.round(value * 50) / 50;
        setFlame((current) => (current === rounded ? current : rounded));
    });

    const finishBreathing = useCallback(() => {
        playChime('bowl');
        haptic('success');
        recordPath('breaths', { cycles: CYCLES });
        celebrate('gentle');
        setStage('intent');
    }, []);

    const advancePhase = useCallback(() => {
        const timeline = timing.current;
        timeline.elapsed = 0;
        if (timeline.phase < PHASES.length - 1) {
            timeline.phase += 1;
            haptic('breath');
        } else if (timeline.cycle < CYCLES - 1) {
            timeline.cycle += 1;
            timeline.phase = 0;
            playChime('soft');
            haptic('success');
        } else {
            finishBreathing();
            return;
        }
        setDisplay({ phase: timeline.phase, cycle: timeline.cycle, remaining: PHASES[timeline.phase].seconds });
    }, [finishBreathing]);

    useEffect(() => {
        if (stage !== 'breathing') return undefined;
        let frame;
        const tick = (now) => {
            const timeline = timing.current;
            const delta = timeline.last == null ? 0 : Math.min(now - timeline.last, 100);
            timeline.last = now;
            if (!timeline.paused) timeline.elapsed += delta;

            const phase = PHASES[timeline.phase];
            const duration = phase.seconds * 1000;
            const p = Math.min(1, timeline.elapsed / duration);
            progress.set(p);
            scale.set(scaleFor(phase.id, p));

            const remaining = Math.max(1, Math.ceil((duration - timeline.elapsed) / 1000));
            setDisplay((current) => (current.remaining === remaining && current.phase === timeline.phase && current.cycle === timeline.cycle
                ? current
                : { phase: timeline.phase, cycle: timeline.cycle, remaining }));

            if (timeline.elapsed >= duration) advancePhase();
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [stage, advancePhase, progress, scale]);

    const begin = useCallback(() => {
        getAudioContext(); // inside the gesture, so the bowl may ring
        timing.current = { phase: 0, cycle: 0, elapsed: 0, last: null, paused: false };
        progress.set(0);
        scale.set(MIN_SCALE);
        setPaused(false);
        setDisplay({ phase: 0, cycle: 0, remaining: PHASES[0].seconds });
        playChime('bowl');
        haptic('breath');
        setStage('breathing');
    }, [progress, scale]);

    const togglePause = useCallback(() => {
        timing.current.paused = !timing.current.paused;
        setPaused(timing.current.paused);
        haptic('soft');
    }, []);

    const skipToIntent = useCallback(() => setStage('intent'), []);

    const chooseIntent = useCallback((intent) => {
        setSelectedIntent(intent.id);
        haptic('success');
        localStorage.setItem('breathSession', JSON.stringify({
            intent: intent.id,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()
        }));
        setTimeout(() => onComplete(intent.id), 450);
    }, [onComplete]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target;
            const onButton = target instanceof HTMLElement && target.closest('button');

            if (stage === 'invite') {
                if ((event.key === ' ' || event.key === 'Enter') && !onButton) {
                    event.preventDefault();
                    begin();
                } else if (event.key === 'Escape') {
                    skipToIntent();
                }
            } else if (stage === 'breathing') {
                if (event.key === ' ') {
                    event.preventDefault();
                    togglePause();
                } else if (event.key === 'ArrowRight' || (event.key === 'Enter' && !onButton)) {
                    event.preventDefault();
                    advancePhase();
                } else if (event.key === 'Escape') {
                    skipToIntent();
                }
            } else if (stage === 'intent' && /^[1-5]$/.test(event.key)) {
                chooseIntent(INTENTS[Number(event.key) - 1]);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [stage, begin, togglePause, advancePhase, skipToIntent, chooseIntent]);

    const phase = PHASES[display.phase];
    const fade = {
        initial: reduceMotion ? false : { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    };

    return (
        <div className="threshold">
            <AnimatePresence mode="wait">
                {stage === 'invite' && (
                    <motion.section key="invite" className="threshold__panel" {...fade}>
                        <Diya size={96} steady />
                        <span className="eyebrow">{t('breaths.eyebrow')}</span>
                        <h1 className="threshold__title">{t('breaths.title')}</h1>
                        <p className="threshold__lede">{t('breaths.lede')}</p>
                        <ol className="rhythm" aria-label={t('breaths.rhythm')}>
                            {PHASES.map((item) => (
                                <li key={item.id}><strong>{item.seconds}</strong><span>{t(`breaths.${item.id}`)}</span></li>
                            ))}
                        </ol>
                        <button type="button" className="btn btn--gold btn--lg threshold__begin" onClick={begin} autoFocus>
                            {t('breaths.begin')}
                            {hasKeyboard && <span className="kbd threshold__kbd">Space</span>}
                        </button>
                        <button type="button" className="btn btn--link" onClick={skipToIntent}>{t('breaths.skip')}</button>
                        <p className="threshold__verse">{t('breaths.verse')}</p>
                    </motion.section>
                )}

                {stage === 'breathing' && (
                    <motion.section key="breathing" className="threshold__panel" {...fade}>
                        <span className="eyebrow">{t('breaths.cycle', { n: display.cycle + 1, total: CYCLES })}</span>

                        <div className={`breath-stage${paused ? ' is-paused' : ''}`} role="timer" aria-live="polite" aria-label={`${t(`breaths.${phase.id}`)}, ${display.remaining}`}>
                            <svg className="breath-stage__ring" viewBox="0 0 280 280" aria-hidden="true">
                                <circle cx="140" cy="140" r={RING_RADIUS} className="breath-stage__track" />
                                <motion.circle
                                    cx="140"
                                    cy="140"
                                    r={RING_RADIUS}
                                    className="breath-stage__progress"
                                    strokeDasharray={RING_LENGTH}
                                    style={{ strokeDashoffset: dashOffset }}
                                />
                            </svg>
                            <motion.div className="breath-stage__glow" style={{ '--glow': glow }} aria-hidden="true" />
                            <div className="breath-stage__lamp" aria-hidden="true">
                                <Diya size={120} steady={phase.id === 'hold'} flame={flame} />
                            </div>
                            <div className="breath-stage__center">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={`${display.cycle}-${phase.id}-${paused}`}
                                        className="breath-stage__phase"
                                        initial={{ opacity: 0, y: 3 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -3 }}
                                        transition={{ duration: 0.35 }}
                                    >
                                        {paused ? t('breaths.paused') : t(`breaths.${phase.id}`)}
                                    </motion.span>
                                </AnimatePresence>
                                <span className="breath-stage__count">{display.remaining}</span>
                            </div>
                        </div>

                        <p className="threshold__hint">{paused ? t('breaths.pausedHint') : t(`breaths.${phase.id}.hint`)}</p>

                        <div className="cycle-dots" aria-hidden="true">
                            {Array.from({ length: CYCLES }, (_, index) => (
                                <span key={index} className={index < display.cycle ? 'is-done' : index === display.cycle ? 'is-current' : ''} />
                            ))}
                        </div>

                        <div className="threshold__controls">
                            <button type="button" className="btn btn--outline" onClick={togglePause}>
                                {paused ? <Play size={15} /> : <Pause size={15} />}
                                {paused ? t('breaths.resume') : t('breaths.pause')}
                            </button>
                            <button type="button" className="btn btn--ghost" onClick={skipToIntent}>
                                {t('breaths.skipShort')}
                                <SkipForward size={15} />
                            </button>
                        </div>

                        {hasKeyboard && (
                            <p className="threshold__keys">
                                <span><span className="kbd">Space</span> {t('breaths.keyPause')}</span>
                                <span><span className="kbd">→</span> {t('breaths.keyNext')}</span>
                                <span><span className="kbd">Esc</span> {t('breaths.keySkip')}</span>
                            </p>
                        )}
                    </motion.section>
                )}

                {stage === 'intent' && (
                    <motion.section key="intent" className="threshold__panel threshold__panel--wide" {...fade}>
                        <span className="eyebrow">{t('breaths.intent.eyebrow')}</span>
                        <h1 className="threshold__title">{t('breaths.intent.title')}</h1>
                        <ul className="intent-grid">
                            {INTENTS.map((intent, index) => {
                                const Icon = intent.icon;
                                return (
                                    <motion.li
                                        key={intent.id}
                                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.08 * index, duration: 0.5 }}
                                    >
                                        <button
                                            type="button"
                                            className={`intent-card${selectedIntent === intent.id ? ' is-selected' : ''}`}
                                            onClick={() => chooseIntent(intent)}
                                        >
                                            <span className="intent-card__icon"><Icon size={18} /></span>
                                            <span className="intent-card__text">
                                                <strong>{t(`intent.${intent.id}.title`)}</strong>
                                                <span>{t(`intent.${intent.id}.desc`)}</span>
                                            </span>
                                            {hasKeyboard && <span className="kbd">{index + 1}</span>}
                                        </button>
                                    </motion.li>
                                );
                            })}
                        </ul>
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ThreeBreaths;
