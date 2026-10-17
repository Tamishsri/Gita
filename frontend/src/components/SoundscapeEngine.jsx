import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audio';

// Procedural ambient soundscapes, synthesised live with the Web Audio API.
// One provider lives at the app root so sound carries across every screen;
// switching scenes crossfades instead of cutting.

export const SOUND_MODES = [
    { id: 'auto', label: 'Auto', description: 'Follows your mood' },
    { id: 'ocean', label: 'Ocean', description: 'Slow surf, brown noise' },
    { id: 'rain', label: 'Rain', description: 'Soft rainfall, pink noise' },
    { id: 'om', label: 'Cosmic Om', description: '130.81 Hz binaural drone' }
];

const VOLUME_KEY = 'lgSoundVolume';
const DEFAULT_VOLUME = 0.4;

const AUTO_BY_MOOD = {
    peace: 'ocean',
    happy: 'ocean',
    grateful: 'ocean',
    anxious: 'rain',
    sad: 'rain',
    lonely: 'om',
    overwhelmed: 'rain',
    stressed: 'om',
    angry: 'om',
    confused: 'om'
};

export function resolveSound(mode, mood) {
    if (mode && mode !== 'auto') return mode;
    return AUTO_BY_MOOD[mood] || 'ocean';
}

const noop = () => {};
const SoundContext = createContext({
    isPlaying: false,
    soundMode: 'auto',
    activeSound: 'ocean',
    volume: DEFAULT_VOLUME,
    play: noop,
    stop: noop,
    toggleSound: noop,
    setSoundMode: noop,
    setVolume: noop,
    setMood: noop
});

export function useSoundscape() {
    return useContext(SoundContext);
}

// ---------------------------------------------------------------------------
// Noise sources
// ---------------------------------------------------------------------------

function noiseBuffer(ctx, kind, seconds = 6) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (kind === 'brown') {
        let last = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.5;
        }
    } else {
        // Paul Kellet's refined pink-noise filter
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856;
            b4 = 0.55 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.016898;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    }

    // Cross-fade the loop seam so it never clicks.
    const fade = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }

    return buffer;
}

function loopedSource(ctx, buffer, offset = 0) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = buffer.duration - 0.25;
    source.start(ctx.currentTime, offset);
    return source;
}

function panned(ctx, node, value) {
    if (typeof ctx.createStereoPanner !== 'function') return node;
    const pan = ctx.createStereoPanner();
    pan.pan.value = value;
    node.connect(pan);
    return pan;
}

function lfo(ctx, frequency, depth, target) {
    const osc = ctx.createOscillator();
    const amount = ctx.createGain();
    osc.frequency.value = frequency;
    amount.gain.value = depth;
    osc.connect(amount);
    amount.connect(target);
    osc.start();
    return osc;
}

// ---------------------------------------------------------------------------
// Scenes — each returns { output, nodes } so it can be faded and torn down
// ---------------------------------------------------------------------------

const SCENES = {
    ocean(ctx) {
        const output = ctx.createGain();
        const nodes = [];
        const buffer = noiseBuffer(ctx, 'brown');

        // Two decorrelated surf layers, panned apart, washing at different rates.
        [[-0.45, 0.085, 0], [0.45, 0.062, 2.7]].forEach(([pan, rate, offset]) => {
            const source = loopedSource(ctx, buffer, offset);
            const filter = ctx.createBiquadFilter();
            const swell = ctx.createGain();
            filter.type = 'lowpass';
            filter.frequency.value = 700;
            filter.Q.value = 0.4;
            swell.gain.value = 0.42;
            source.connect(filter);
            filter.connect(swell);
            panned(ctx, swell, pan).connect(output);
            nodes.push(source, filter, swell,
                lfo(ctx, rate, 0.3, swell.gain),
                lfo(ctx, rate, 380, filter.frequency));
        });

        output.gain.value = 0.85;
        return { output, nodes };
    },

    rain(ctx) {
        const output = ctx.createGain();
        const nodes = [];
        const pink = noiseBuffer(ctx, 'pink');

        [[-0.35, 0], [0.35, 3.1]].forEach(([pan, offset]) => {
            const source = loopedSource(ctx, pink, offset);
            const high = ctx.createBiquadFilter();
            const low = ctx.createBiquadFilter();
            const level = ctx.createGain();
            high.type = 'highpass';
            high.frequency.value = 380;
            low.type = 'lowpass';
            low.frequency.value = 5200;
            level.gain.value = 0.55;
            source.connect(high);
            high.connect(low);
            low.connect(level);
            panned(ctx, level, pan).connect(output);
            nodes.push(source, high, low, level);
        });

        // Distant low rumble beneath the rainfall.
        const rumble = loopedSource(ctx, noiseBuffer(ctx, 'brown', 5));
        const rumbleFilter = ctx.createBiquadFilter();
        const rumbleLevel = ctx.createGain();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 220;
        rumbleLevel.gain.value = 0.35;
        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleLevel);
        rumbleLevel.connect(output);
        nodes.push(rumble, rumbleFilter, rumbleLevel, lfo(ctx, 0.05, 0.12, rumbleLevel.gain));

        output.gain.value = 0.75;
        return { output, nodes };
    },

    om(ctx) {
        const output = ctx.createGain();
        const nodes = [];
        const soften = ctx.createBiquadFilter();
        const breath = ctx.createGain();
        soften.type = 'lowpass';
        soften.frequency.value = 900;
        breath.gain.value = 0.75;
        soften.connect(breath);
        breath.connect(output);

        // Left ear 130.81 Hz (C3), right ear 131.5 Hz: a ~0.7 Hz binaural beat.
        const voices = [
            { frequency: 130.81, type: 'sine', gain: 0.5, pan: -0.85 },
            { frequency: 131.5, type: 'sine', gain: 0.5, pan: 0.85 },
            { frequency: 261.63, type: 'triangle', gain: 0.1, pan: 0 },
            { frequency: 196.0, type: 'sine', gain: 0.07, pan: 0 },
            { frequency: 65.41, type: 'sine', gain: 0.2, pan: 0 }
        ];

        voices.forEach((voice) => {
            const osc = ctx.createOscillator();
            const level = ctx.createGain();
            osc.type = voice.type;
            osc.frequency.value = voice.frequency;
            level.gain.value = voice.gain;
            osc.connect(level);
            panned(ctx, level, voice.pan).connect(soften);
            osc.start();
            nodes.push(osc, level);
        });

        // A slow swell, roughly one long breath every twelve seconds.
        nodes.push(soften, breath, lfo(ctx, 0.083, 0.22, breath.gain));
        output.gain.value = 0.42;
        return { output, nodes };
    }
};

function teardown(scene) {
    scene.nodes.forEach((node) => {
        try {
            if (typeof node.stop === 'function') node.stop();
        } catch {
            // already stopped
        }
        try {
            node.disconnect();
        } catch {
            // already disconnected
        }
    });
    try {
        scene.output.disconnect();
    } catch {
        // already disconnected
    }
}

function readVolume() {
    const stored = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) && stored > 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SoundscapeProvider({ children, mood: moodProp = null, initialSoundMode = 'auto' }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [soundMode, setSoundModeState] = useState(initialSoundMode);
    const [mood, setMood] = useState(moodProp);
    const [volume, setVolumeState] = useState(readVolume);

    const masterRef = useRef(null);
    const sceneRef = useRef(null); // { id, output, nodes }
    const stopTimerRef = useRef(null);

    const activeSound = resolveSound(soundMode, mood);

    useEffect(() => setMood(moodProp), [moodProp]);
    useEffect(() => setSoundModeState(initialSoundMode), [initialSoundMode]);

    const ensureMaster = useCallback(() => {
        const ctx = getAudioContext();
        if (!ctx) return null;
        if (!masterRef.current || masterRef.current.context !== ctx) {
            const master = ctx.createGain();
            master.gain.value = 0;
            master.connect(ctx.destination);
            masterRef.current = master;
        }
        return ctx;
    }, []);

    const crossfadeTo = useCallback((sceneId) => {
        const ctx = ensureMaster();
        if (!ctx) return;
        const current = sceneRef.current;
        if (current && current.id === sceneId) return;

        const now = ctx.currentTime;

        if (current) {
            current.output.gain.cancelScheduledValues(now);
            current.output.gain.setValueAtTime(current.output.gain.value, now);
            current.output.gain.linearRampToValueAtTime(0.0001, now + 1.4);
            setTimeout(() => teardown(current), 1600);
        }

        const scene = SCENES[sceneId](ctx);
        const level = scene.output.gain.value;
        scene.output.gain.setValueAtTime(0.0001, now);
        scene.output.gain.linearRampToValueAtTime(level, now + 1.8);
        scene.output.connect(masterRef.current);
        sceneRef.current = { id: sceneId, ...scene };
    }, [ensureMaster]);

    const play = useCallback((mode) => {
        const ctx = ensureMaster();
        if (!ctx) return;
        clearTimeout(stopTimerRef.current);

        const nextMode = mode || soundMode;
        if (mode && mode !== soundMode) setSoundModeState(mode);

        const master = masterRef.current.gain;
        const now = ctx.currentTime;
        master.cancelScheduledValues(now);
        master.setValueAtTime(master.value, now);
        master.linearRampToValueAtTime(volume, now + 1.2);

        crossfadeTo(resolveSound(nextMode, mood));
        setIsPlaying(true);
    }, [crossfadeTo, ensureMaster, mood, soundMode, volume]);

    const stop = useCallback(() => {
        const ctx = getAudioContext();
        const master = masterRef.current;
        setIsPlaying(false);
        if (!ctx || !master) return;

        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.8);

        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
            if (sceneRef.current) teardown(sceneRef.current);
            sceneRef.current = null;
        }, 900);
    }, []);

    const toggleSound = useCallback(() => (isPlaying ? stop() : play()), [isPlaying, play, stop]);

    const setSoundMode = useCallback((mode) => setSoundModeState(mode), []);

    const setVolume = useCallback((value) => {
        const next = Math.min(1, Math.max(0.02, value));
        setVolumeState(next);
        localStorage.setItem(VOLUME_KEY, String(next));
    }, []);

    // Follow mood / mode changes while playing — crossfade, never cut.
    useEffect(() => {
        if (isPlaying) crossfadeTo(activeSound);
    }, [activeSound, isPlaying, crossfadeTo]);

    useEffect(() => {
        const master = masterRef.current;
        if (master && isPlaying) master.gain.setTargetAtTime(volume, master.context.currentTime, 0.15);
    }, [volume, isPlaying]);

    useEffect(() => () => {
        clearTimeout(stopTimerRef.current);
        if (sceneRef.current) teardown(sceneRef.current);
        masterRef.current?.disconnect();
    }, []);

    const value = useMemo(() => ({
        isPlaying,
        soundMode,
        activeSound,
        volume,
        play,
        stop,
        toggleSound,
        setSoundMode,
        setVolume,
        setMood
    }), [isPlaying, soundMode, activeSound, volume, play, stop, toggleSound, setSoundMode, setVolume]);

    return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export default SoundscapeProvider;
