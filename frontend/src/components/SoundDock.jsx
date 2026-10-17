import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, CloudRain, Orbit, Pause, Play, Sparkles, Volume1, Volume2, VolumeX, Waves, Bell } from 'lucide-react';
import { SOUND_MODES, useSoundscape } from './SoundscapeEngine';
import { playChime } from '../lib/chime';
import { useLayer } from '../lib/layers';
import { useI18n } from '../i18n';

export const SOUND_ICONS = { auto: Sparkles, ocean: Waves, rain: CloudRain, om: Orbit };

export function SoundPanel({ onModeChange }) {
    const { t } = useI18n();
    const { isPlaying, soundMode, activeSound, volume, play, stop, setVolume } = useSoundscape();

    const chooseMode = (mode) => {
        onModeChange?.(mode);
        play(mode);
    };

    return (
        <div className="sound-panel">
            <div className="section__head">
                <div>
                    <span className="eyebrow">{t('sound.title')}</span>
                    <p className="faint" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                        {isPlaying ? t('sound.nowPlaying', { name: t(`sound.${activeSound}.label`) }) : t('sound.synthesised')}
                    </p>
                </div>
                <button
                    type="button"
                    className={`icon-btn icon-btn--ring${isPlaying ? ' is-on' : ''}`}
                    onClick={() => (isPlaying ? stop() : play())}
                    aria-label={isPlaying ? t('sound.pause') : t('sound.play')}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
            </div>

            <div className="sound-modes" role="group" aria-label={t('sound.title')}>
                {SOUND_MODES.map((mode) => {
                    const Icon = SOUND_ICONS[mode.id];
                    const active = soundMode === mode.id;
                    return (
                        <button key={mode.id} type="button" className="sound-mode" aria-pressed={active} onClick={() => chooseMode(mode.id)}>
                            <span className="sound-mode__head">
                                {t(`sound.${mode.id}.label`)}
                                <Icon size={15} />
                            </span>
                            <span>{mode.id === 'auto' && active ? t('sound.auto.following', { name: t(`sound.${activeSound}.label`) }) : t(`sound.${mode.id}.desc`)}</span>
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
                    aria-label={t('sound.volume')}
                />
                <span style={{ minWidth: 32, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
            </label>

            <div className="sound-panel__footer">
                <button type="button" className="btn btn--soft btn--sm" onClick={() => playChime('bowl', { force: true })}>
                    <Bell size={14} /> {t('sound.bowl')}
                </button>
                {isPlaying && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={stop}>
                        <VolumeX size={14} /> {t('sound.silence')}
                    </button>
                )}
            </div>
        </div>
    );
}

// Desktop: a quiet control in the corner with a popover of scenes.
function SoundDock({ onModeChange }) {
    const { t } = useI18n();
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
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
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
                    aria-label={isPlaying ? t('sound.pause') : t('sound.play')}
                    title={isPlaying ? t('sound.pause') : t('sound.play')}
                >
                    <span className="sound-dock__orb">
                        {isPlaying ? <SceneIcon size={15} /> : <Volume2 size={15} />}
                    </span>
                    {isPlaying ? t(`sound.${activeSound}.label`) : t('sound.title')}
                    {isPlaying && (
                        <span className="sound-bars" aria-hidden="true"><i /><i /><i /></span>
                    )}
                </button>
                <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    aria-label={t('sound.options')}
                    title={t('sound.options')}
                >
                    <ChevronUp size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }} />
                </button>
            </div>
        </div>
    );
}

export default SoundDock;
