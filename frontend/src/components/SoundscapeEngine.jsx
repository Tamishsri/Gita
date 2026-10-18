import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audio';

// Ambient soundscapes, synthesised live with the Web Audio API — modelled on
// the real thing rather than on a loop: waves that arrive in their own time,
// rain with drops landing here and there, a tanpura plucked by a human hand.
// One provider lives at the app root so sound carries across every screen;
// switching scenes crossfades instead of cutting.

export const SOUND_MODES = [
    { id: 'auto', label: 'Auto', description: 'Follows your mood' },
    { id: 'ocean', label: 'Ocean', description: 'Waves on a far shore, each in its own time' },
    { id: 'rain', label: 'Rain', description: 'Soft rain, drops landing on leaves' },
    { id: 'om', label: 'Tanpura', description: 'Four strings, Sa and Pa, with Om beneath' }
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
    setMood: noop,
    duck: noop
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

// A JS timer that a scene's teardown can stop like any audio node.
function scheduler(tick, everyMs) {
    let timer = null;
    const loop = () => {
        tick();
        timer = setTimeout(loop, everyMs);
    };
    loop();
    return { stop: () => clearTimeout(timer), disconnect: () => {} };
}

const between = (low, high) => low + Math.random() * (high - low);

// A short, bright burst — the excitation for a plucked string or a drop.
function burstBuffer(ctx, seconds = 0.03, decay = 6) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / length);
    return buffer;
}

// One plucked string (Karplus–Strong): a burst of noise circling a tuned
// delay line, losing a little brightness each time round — the way a real
// string rings and fades. Torn down by itself once it has died away.
function pluck(ctx, destination, frequency, at, level, excitation) {
    const burst = ctx.createBufferSource();
    burst.buffer = excitation;
    const colour = ctx.createBiquadFilter();
    colour.type = 'lowpass';
    colour.frequency.value = 2400;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 1 / frequency;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3600;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.9965;
    const out = ctx.createGain();
    out.gain.value = level;

    burst.connect(colour);
    colour.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(out);
    out.connect(destination);
    burst.start(at);
    // Let it ring, then fade the tail and let go.
    out.gain.setValueAtTime(level, at + 5.5);
    out.gain.linearRampToValueAtTime(0.0001, at + 7);
    const life = (at - ctx.currentTime + 7.2) * 1000;
    setTimeout(() => [burst, colour, delay, damp, feedback, out].forEach((node) => {
        try { node.disconnect(); } catch { /* already gone */ }
    }), Math.max(0, life));
}

const SCENES = {
    // The sea is never regular: each wave arrives in its own time, gathers,
    // breaks brighter, and draws back over a quiet, constant hush.
    ocean(ctx) {
        const output = ctx.createGain();
        const nodes = [];
        const buffer = noiseBuffer(ctx, 'brown', 8);

        const hush = loopedSource(ctx, buffer, 1.3);
        const hushFilter = ctx.createBiquadFilter();
        const hushLevel = ctx.createGain();
        hushFilter.type = 'lowpass';
        hushFilter.frequency.value = 420;
        hushLevel.gain.value = 0.16;
        hush.connect(hushFilter);
        hushFilter.connect(hushLevel);
        hushLevel.connect(output);
        nodes.push(hush, hushFilter, hushLevel);

        [[-0.5, 0], [0.5, 3.4]].forEach(([pan, offset], layer) => {
            const source = loopedSource(ctx, buffer, offset);
            const filter = ctx.createBiquadFilter();
            const swell = ctx.createGain();
            filter.type = 'lowpass';
            filter.frequency.value = 450;
            filter.Q.value = 0.5;
            swell.gain.value = 0.08;
            source.connect(filter);
            filter.connect(swell);
            panned(ctx, swell, pan).connect(output);

            let next = ctx.currentTime + 0.5 + layer * between(2, 4);
            const wave = () => {
                while (next < ctx.currentTime + 12) {
                    const rise = between(2, 3.6);
                    const fall = between(3, 5.5);
                    const peak = between(0.32, 0.62);
                    swell.gain.setTargetAtTime(peak, next, rise / 3);
                    filter.frequency.setTargetAtTime(between(900, 1500), next, rise / 3);
                    swell.gain.setTargetAtTime(between(0.06, 0.12), next + rise, fall / 3);
                    filter.frequency.setTargetAtTime(between(380, 520), next + rise, fall / 3);
                    next += rise + fall + between(0.5, 4);
                }
            };
            nodes.push(source, filter, swell, scheduler(wave, 4000));
        });

        output.gain.value = 0.9;
        return { output, nodes };
    },

    // Rain that is alive: a soft bed whose strength drifts, and drops landing
    // on leaves here and there — never in a pattern.
    rain(ctx) {
        const output = ctx.createGain();
        const nodes = [];
        const pink = noiseBuffer(ctx, 'pink');

        const bed = ctx.createGain();
        bed.gain.value = 0.5;
        bed.connect(output);
        [[-0.35, 0], [0.35, 3.1]].forEach(([pan, offset]) => {
            const source = loopedSource(ctx, pink, offset);
            const high = ctx.createBiquadFilter();
            const low = ctx.createBiquadFilter();
            high.type = 'highpass';
            high.frequency.value = 420;
            low.type = 'lowpass';
            low.frequency.value = 4800;
            source.connect(high);
            high.connect(low);
            panned(ctx, low, pan).connect(bed);
            nodes.push(source, high, low);
        });

        const rumble = loopedSource(ctx, noiseBuffer(ctx, 'brown', 5));
        const rumbleFilter = ctx.createBiquadFilter();
        const rumbleLevel = ctx.createGain();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 200;
        rumbleLevel.gain.value = 0.28;
        rumble.connect(rumbleFilter);
        rumbleFilter.connect(rumbleLevel);
        rumbleLevel.connect(output);
        nodes.push(rumble, rumbleFilter, rumbleLevel, bed);

        // The shower's strength wanders slowly, as real rain does.
        nodes.push(scheduler(() => {
            bed.gain.setTargetAtTime(between(0.36, 0.62), ctx.currentTime, 2.5);
        }, 3500));

        const drop = burstBuffer(ctx, 0.05, 9);
        let nextDrop = ctx.currentTime + 0.2;
        nodes.push(scheduler(() => {
            while (nextDrop < ctx.currentTime + 0.6) {
                const source = ctx.createBufferSource();
                source.buffer = drop;
                const tone = ctx.createBiquadFilter();
                tone.type = 'bandpass';
                tone.frequency.value = between(1800, 6500);
                tone.Q.value = between(4, 10);
                const level = ctx.createGain();
                level.gain.value = between(0.05, 0.22);
                source.connect(tone);
                tone.connect(level);
                panned(ctx, level, between(-0.9, 0.9)).connect(output);
                source.start(nextDrop);
                source.onended = () => [source, tone, level].forEach((node) => {
                    try { node.disconnect(); } catch { /* already gone */ }
                });
                nextDrop += between(0.04, 0.32);
            }
        }, 250));

        output.gain.value = 0.75;
        return { output, nodes };
    },

    // A tanpura: four strings plucked in turn — Pa, Sa, Sa, low Sa — each
    // left to ring into the next, with a soft Om beneath them.
    om(ctx) {
        const output = ctx.createGain();
        const nodes = [];

        // The strings pass through a gentle saturation, the tanpura's buzzing bridge (jawari).
        const jawari = ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) {
            const x = (i / (curve.length - 1)) * 2 - 1;
            curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2);
        }
        jawari.curve = curve;
        const strings = ctx.createGain();
        strings.gain.value = 0.55;
        strings.connect(jawari);
        const warmth = ctx.createBiquadFilter();
        warmth.type = 'lowpass';
        warmth.frequency.value = 2800;
        jawari.connect(warmth);
        warmth.connect(output);
        nodes.push(jawari, strings, warmth);

        const SA = 130.81;
        const cycle = [
            { frequency: SA * 0.749, level: 0.5 },  // Pa, below Sa
            { frequency: SA, level: 0.42 },
            { frequency: SA, level: 0.4 },
            { frequency: SA / 2, level: 0.62 }    // kharaj — low Sa
        ];
        const excitation = burstBuffer(ctx, 0.028, 5);
        let nextPluck = ctx.currentTime + 0.4;
        let step = 0;
        nodes.push(scheduler(() => {
            while (nextPluck < ctx.currentTime + 2.5) {
                const string = cycle[step % cycle.length];
                // A human hand: never exactly on time, never exactly as loud.
                pluck(ctx, strings, string.frequency, nextPluck + between(-0.03, 0.03), string.level * between(0.88, 1.08), excitation);
                nextPluck += step % cycle.length === cycle.length - 1 ? between(1.5, 1.8) : between(1.05, 1.2);
                step += 1;
            }
        }, 900));

        // Om, very softly, beneath the strings — a slow breath in and out.
        const hum = ctx.createGain();
        const humFilter = ctx.createBiquadFilter();
        humFilter.type = 'lowpass';
        humFilter.frequency.value = 700;
        hum.gain.value = 0.16;
        humFilter.connect(hum);
        hum.connect(output);
        [[SA, -0.6, 0.35], [SA + 0.7, 0.6, 0.35], [SA / 2, 0, 0.3]].forEach(([frequency, pan, level]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = frequency;
            gain.gain.value = level;
            osc.connect(gain);
            panned(ctx, gain, pan).connect(humFilter);
            osc.start();
            nodes.push(osc, gain);
        });
        nodes.push(hum, humFilter, lfo(ctx, 0.07, 0.07, hum.gain));

        output.gain.value = 0.62;
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

    // While a verse is read aloud, the sound steps back, then returns.
    const ducked = useRef(false);
    const duck = useCallback((on) => {
        const master = masterRef.current;
        ducked.current = Boolean(on);
        if (!master || !isPlaying) return;
        master.gain.setTargetAtTime(on ? volume * 0.3 : volume, master.context.currentTime, on ? 0.25 : 0.8);
    }, [isPlaying, volume]);

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
        if (master && isPlaying) master.gain.setTargetAtTime(ducked.current ? volume * 0.3 : volume, master.context.currentTime, 0.15);
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
        setMood,
        duck
    }), [isPlaying, soundMode, activeSound, volume, play, stop, toggleSound, setSoundMode, setVolume, duck]);

    return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export default SoundscapeProvider;
