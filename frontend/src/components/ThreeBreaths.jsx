import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Leaf, Sun, Mountain, Compass, Ear, Pause, Play, SkipForward } from 'lucide-react';
import LotusMark from './ui/LotusMark';
import { getAudioContext } from '../lib/audio';
import { playChime } from '../lib/chime';
import { haptic } from '../lib/haptics';
import { useHasKeyboard } from '../hooks/useMediaQuery';

// The threshold ritual: three rounds of 4-7-8 pranayama before entering.
// Timing runs on requestAnimationFrame against elapsed time, so pausing is
// exact and a hidden tab simply waits (frame deltas are capped).

const PHASES = [
    { id: 'inhale', label: 'Inhale', seconds: 4, hint: 'Softly, through the nose' },
    { id: 'hold', label: 'Hold', seconds: 7, hint: 'Rest at the top, without strain' },
    { id: 'exhale', label: 'Exhale', seconds: 8, hint: 'Slowly, let everything go' }
];
const CYCLES = 3;
const MIN_SCALE = 0.56;
const RING_RADIUS = 124;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const SESSION_HOURS = 4;

const INTENTS = [
    { id: 'calm', label: 'Calm', description: 'I need peace', icon: Leaf },
    { id: 'clarity', label: 'Clarity', description: 'I need understanding', icon: Sun },
    { id: 'courage', label: 'Courage', description: 'I need strength', icon: Mountain },
    { id: 'guidance', label: 'Guidance', description: 'I need direction', icon: Compass },
    { id: 'listening', label: 'Just Listening', description: 'I am here to receive', icon: Ear }
];

const easeInOut = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function scaleFor(phaseId, progress) {
    if (phaseId === 'inhale') return MIN_SCALE + (1 - MIN_SCALE) * easeInOut(progress);
    if (phaseId === 'exhale') return 1 - (1 - MIN_SCALE) * easeInOut(progress);
    return 1;
}

function ThreeBreaths({ onComplete }) {
    const [stage, setStage] = useState('invite'); // invite | breathing | intent
    const [display, setDisplay] = useState({ phase: 0, cycle: 0, remaining: PHASES[0].seconds });
    const [paused, setPaused] = useState(false);
    const [selectedIntent, setSelectedIntent] = useState(null);

    const reduceMotion = useReducedMotion();
    const hasKeyboard = useHasKeyboard();
    const timing = useRef({ phase: 0, cycle: 0, elapsed: 0, last: null, paused: false });
    const progress = useMotionValue(0);
    const scale = useMotionValue(MIN_SCALE);
    const dashOffset = useTransform(progress, (value) => RING_LENGTH * (1 - value));
    const glow = useTransform(scale, [MIN_SCALE, 1], [0.25, 0.75]);

    const finishBreathing = useCallback(() => {
        playChime('bowl');
        haptic('success');
        setStage('intent');
    }, []);

    const advancePhase = useCallback(() => {
        const t = timing.current;
        t.elapsed = 0;
        if (t.phase < PHASES.length - 1) {
            t.phase += 1;
            haptic('breath');
        } else if (t.cycle < CYCLES - 1) {
            t.cycle += 1;
            t.phase = 0;
            playChime('soft');
            haptic('success');
        } else {
            finishBreathing();
            return;
        }
        setDisplay({ phase: t.phase, cycle: t.cycle, remaining: PHASES[t.phase].seconds });
    }, [finishBreathing]);

    useEffect(() => {
        if (stage !== 'breathing') return undefined;
        let frame;
        const tick = (now) => {
            const t = timing.current;
            const delta = t.last == null ? 0 : Math.min(now - t.last, 100);
            t.last = now;
            if (!t.paused) t.elapsed += delta;

            const phase = PHASES[t.phase];
            const duration = phase.seconds * 1000;
            const p = Math.min(1, t.elapsed / duration);
            progress.set(p);
            scale.set(scaleFor(phase.id, p));

            const remaining = Math.max(1, Math.ceil((duration - t.elapsed) / 1000));
            setDisplay((current) => (current.remaining === remaining && current.phase === t.phase && current.cycle === t.cycle
                ? current
                : { phase: t.phase, cycle: t.cycle, remaining }));

            if (t.elapsed >= duration) advancePhase();
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [stage, advancePhase, progress, scale]);

    const begin = useCallback(() => {
        getAudioContext(); // inside the gesture, so the bowl is allowed to ring
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
        setTimeout(() => onComplete(intent.id), 420);
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
        initial: reduceMotion ? false : { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    };

    return (
        <div className="threshold">
            <AnimatePresence mode="wait">
                {stage === 'invite' && (
                    <motion.section key="invite" className="threshold__panel" {...fade}>
                        <span className="threshold__mark"><LotusMark size={64} ring /></span>
                        <span className="eyebrow">Before we begin</span>
                        <h1 className="threshold__title">Three slow breaths.</h1>
                        <p className="threshold__lede">
                            Let the body arrive before the mind does. Breathe in for four, hold for seven, release for eight.
                        </p>
                        <ol className="rhythm" aria-label="Breathing rhythm">
                            {PHASES.map((item) => (
                                <li key={item.id}><strong>{item.seconds}</strong><span>{item.label}</span></li>
                            ))}
                        </ol>
                        <button type="button" className="btn btn--gold btn--lg threshold__begin" onClick={begin} autoFocus>
                            Begin
                            {hasKeyboard && <span className="kbd threshold__kbd">Space</span>}
                        </button>
                        <button type="button" className="btn btn--link" onClick={skipToIntent}>Skip to sanctuary</button>
                        <p className="threshold__note faint">Sound on for the singing bowl</p>
                    </motion.section>
                )}

                {stage === 'breathing' && (
                    <motion.section key="breathing" className="threshold__panel" {...fade}>
                        <span className="eyebrow">Breath {display.cycle + 1} of {CYCLES}</span>

                        <div className={`breath-stage${paused ? ' is-paused' : ''}`} role="timer" aria-live="polite" aria-label={`${phase.label}, ${display.remaining} seconds`}>
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
                            <motion.div className="breath-stage__orb" style={{ scale, '--glow': glow }} aria-hidden="true" />
                            <div className="breath-stage__center">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={`${display.cycle}-${phase.id}`}
                                        className="breath-stage__phase"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.35 }}
                                    >
                                        {paused ? 'Paused' : phase.label}
                                    </motion.span>
                                </AnimatePresence>
                                <span className="breath-stage__count">{display.remaining}</span>
                            </div>
                        </div>

                        <p className="threshold__hint">{paused ? 'Take your time. Resume when you are ready.' : phase.hint}</p>

                        <div className="cycle-dots" aria-hidden="true">
                            {Array.from({ length: CYCLES }, (_, index) => (
                                <span key={index} className={index < display.cycle ? 'is-done' : index === display.cycle ? 'is-current' : ''} />
                            ))}
                        </div>

                        <div className="threshold__controls">
                            <button type="button" className="btn btn--outline" onClick={togglePause}>
                                {paused ? <Play size={15} /> : <Pause size={15} />}
                                {paused ? 'Resume' : 'Pause'}
                            </button>
                            <button type="button" className="btn btn--ghost" onClick={skipToIntent}>
                                Skip
                                <SkipForward size={15} />
                            </button>
                        </div>

                        {hasKeyboard && (
                            <p className="threshold__keys">
                                <span><span className="kbd">Space</span> pause</span>
                                <span><span className="kbd">→</span> next phase</span>
                                <span><span className="kbd">Esc</span> skip</span>
                            </p>
                        )}
                    </motion.section>
                )}

                {stage === 'intent' && (
                    <motion.section key="intent" className="threshold__panel threshold__panel--wide" {...fade}>
                        <span className="eyebrow">Your intention</span>
                        <h1 className="threshold__title">What do you truly need right now?</h1>
                        <div className="intent-grid" role="list">
                            {INTENTS.map((intent, index) => {
                                const Icon = intent.icon;
                                return (
                                    <motion.button
                                        key={intent.id}
                                        type="button"
                                        role="listitem"
                                        className={`intent-card${selectedIntent === intent.id ? ' is-selected' : ''}`}
                                        onClick={() => chooseIntent(intent)}
                                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.08 * index, duration: 0.45 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <span className="intent-card__icon"><Icon size={18} strokeWidth={1.7} /></span>
                                        <span className="intent-card__text">
                                            <strong>{intent.label}</strong>
                                            <span>{intent.description}</span>
                                        </span>
                                        {hasKeyboard && <span className="kbd">{index + 1}</span>}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ThreeBreaths;
