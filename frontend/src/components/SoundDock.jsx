import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, CloudRain, Orbit, Pause, Play, Sparkles, Volume1, Volume2, VolumeX, Waves, Bell } from 'lucide-react';
import { SOUND_MODES, useSoundscape } from './SoundscapeEngine';
import { playChime } from '../lib/chime';
import { useLayer } from '../lib/layers';

export const SOUND_ICONS = { auto: Sparkles, ocean: Waves, rain: CloudRain, om: Orbit };

const SCENE_LABELS = { ocean: 'Ocean', rain: 'Rain', om: 'Cosmic Om' };

export function SoundPanel({ onModeChange }) {
    const { isPlaying, soundMode, activeSound, volume, play, stop, setVolume } = useSoundscape();

    const chooseMode = (mode) => {
        onModeChange?.(mode);
        play(mode);
    };

    return (
        <div className="sound-panel">
            <div className="section__head">
                <div>
                    <span className="eyebrow">Soundscape</span>
                    <p className="faint" style={{ fontSize: '0.75rem', marginTop: 2 }}>
                        {isPlaying ? `Now playing · ${SCENE_LABELS[activeSound]}` : 'Synthesised live on your device'}
                    </p>
                </div>
                <button
                    type="button"
                    className={`icon-btn${isPlaying ? ' is-on' : ''}`}
                    onClick={() => (isPlaying ? stop() : play())}
                    aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
            </div>

            <div className="sound-modes" role="group" aria-label="Soundscape">
                {SOUND_MODES.map((mode) => {
                    const Icon = SOUND_ICONS[mode.id];
                    const active = soundMode === mode.id;
                    return (
                        <button
                            key={mode.id}
                            type="button"
                            className="sound-mode"
                            aria-pressed={active}
                            onClick={() => chooseMode(mode.id)}
                        >
                            <span className="sound-mode__head">
                                {mode.label}
                                <Icon size={15} />
                            </span>
                            <span>{mode.id === 'auto' && active ? `Follows your mood · ${SCENE_LABELS[activeSound]}` : mode.description}</span>
                        </button>
                    );
                })}
            </div>

            <label className="volume-row">
                <Volume1 size={15} aria-hidden="true" />
                <input
                    className="range"
                    type="range"
                    min="0.02"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    style={{ '--fill': `${Math.round(volume * 100)}%` }}
                    aria-label="Soundscape volume"
                />
                <span style={{ minWidth: 30, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
            </label>

            <div className="sound-panel__footer">
                <button type="button" className="btn btn--soft btn--sm" onClick={() => playChime('bowl', { force: true })}>
                    <Bell size={14} />
                    Strike the singing bowl
                </button>
                {isPlaying && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={stop}>
                        <VolumeX size={14} />
                        Silence
                    </button>
                )}
            </div>
        </div>
    );
}

// Desktop: a quiet floating control in the corner with a popover of scenes.
function SoundDock({ onModeChange }) {
    const { isPlaying, activeSound, toggleSound } = useSoundscape();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useLayer(open, { onEscape: () => setOpen(false), lockScroll: false });

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const SceneIcon = SOUND_ICONS[activeSound] || Waves;

    return (
        <div ref={rootRef} className={`sound-dock${isPlaying ? ' is-playing' : ''}`}>
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="sound-popover"
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <SoundPanel onModeChange={onModeChange} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="sound-dock__bar">
                <button
                    type="button"
                    className="sound-dock__toggle"
                    onClick={toggleSound}
                    aria-label={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
                    title={isPlaying ? 'Pause soundscape' : 'Play soundscape'}
                >
                    <span className="sound-dock__orb">
                        {isPlaying ? <SceneIcon size={15} /> : <Volume2 size={15} />}
                    </span>
                    {isPlaying ? SCENE_LABELS[activeSound] : 'Soundscape'}
                    {isPlaying && (
                        <span className="sound-bars" aria-hidden="true">
                            <i /><i /><i />
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className="icon-btn icon-btn--sm icon-btn--plain"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    aria-label="Soundscape options"
                    title="Soundscape options"
                >
                    <ChevronUp size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }} />
                </button>
            </div>
        </div>
    );
}

export default SoundDock;
