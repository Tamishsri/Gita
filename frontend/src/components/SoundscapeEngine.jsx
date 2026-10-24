import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../lib/audio';
import { roomImpulse, strikeBowl } from '../lib/chime';

// Ambient soundscapes, made live on the device with the Web Audio API and
// modelled on the real thing, not on a loop:
//
//   Ocean  — a far surf that never stops; waves that gather, break into foam,
//            and draw back over the sand, each in its own time.
//   Rain   — a soft shower whose strength drifts, thousands of tiny drops on
//            leaves, and now and then a heavier drip close by.
//   Stream — water running over stones: a low flow and its bubbles.
//   Bowls  — singing bowls struck now and then in a quiet room, ringing out.
//
// Everything passes through one chain — a room (reverb), a gentle
// compressor and a softened top end — so nothing is ever harsh or sudden.
// One provider lives at the app root so sound carries across every screen;
// switching scenes crossfades instead of cutting.

export const SOUND_MODES = [
    { id: 'auto', label: 'Auto', description: 'Follows your mood' },
    { id: 'ocean', label: 'Ocean', description: 'Waves on a far shore, each in its own time' },
    { id: 'rain', label: 'Rain', description: 'Soft rain on leaves' },
    { id: 'stream', label: 'Stream', description: 'A forest stream over stones' },
    { id: 'bowls', label: 'Bowls', description: 'Singing bowls in a quiet room' }
];

// Sounds that were renamed: a saved choice still finds its way.
const RENAMED = { om: 'bowls' };
export const normaliseSoundMode = (mode) => RENAMED[mode] || mode;

const VOLUME_KEY = 'lgSoundVolume';
const DEFAULT_VOLUME = 0.4;

const AUTO_BY_MOOD = {
    peace: 'ocean',
    happy: 'stream',
    grateful: 'stream',
    anxious: 'rain',
    sad: 'rain',
    lonely: 'bowls',
    overwhelmed: 'rain',
    stressed: 'stream',
    angry: 'ocean',
    confused: 'bowls'
};

export function resolveSound(mode, mood) {
    const chosen = normaliseSoundMode(mode);
    if (chosen && chosen !== 'auto' && SCENES[chosen]) return chosen;
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
// Sources — stereo, long, and generated once per audio context
// ---------------------------------------------------------------------------

const between = (low, high) => low + Math.random() * (high - low);
const buffers = new WeakMap();

function cached(ctx, key, make) {
    let store = buffers.get(ctx);
    if (!store) {
        store = new Map();
        buffers.set(ctx, store);
    }
    if (!store.has(key)) store.set(key, make());
    return store.get(key);
}

function fillNoise(data, kind) {
    if (kind === 'brown') {
        let last = 0;
        for (let i = 0; i < data.length; i++) {
            last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            data[i] = last * 3.5;
        }
    } else if (kind === 'pink') {
        // Paul Kellet's refined pink-noise filter
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < data.length; i++) {
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
    } else {
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    }
}

const SEAM = 0.3;

// Two independent channels (width without phasing), the loop seam crossfaded so it never clicks.
function noise(ctx, kind, seconds = 13) {
    return cached(ctx, `${kind}:${seconds}`, () => {
        const length = Math.floor(ctx.sampleRate * seconds);
        const fade = Math.floor(ctx.sampleRate * SEAM);
        const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            fillNoise(data, kind);
            for (let i = 0; i < fade; i++) {
                const t = i / fade;
                data[i] = data[i] * t + data[length - fade + i] * (1 - t);
            }
        }
        return buffer;
    });
}

// Rain on leaves: thousands of tiny drops, most of them faint. Wraps around, so it loops seamlessly.
function patter(ctx, seconds = 11, perSecond = 170) {
    return cached(ctx, 'patter', () => {
        const rate = ctx.sampleRate;
        const length = Math.floor(rate * seconds);
        const buffer = ctx.createBuffer(2, length, rate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let k = 0; k < seconds * perSecond; k++) {
                const start = Math.floor(Math.random() * length);
                const size = Math.floor(rate * between(0.0012, 0.0055));
                const level = 0.03 + 0.55 * Math.pow(Math.random(), 3.2);
                for (let i = 0; i < size; i++) {
                    data[(start + i) % length] += (Math.random() * 2 - 1) * level * Math.exp((-5 * i) / size);
                }
            }
        }
        return buffer;
    });
}

// Water over stones: small bubbles, each a tiny rising "plink" (a resonating air pocket).
function bubbles(ctx, seconds = 12, perSecond = 26) {
    return cached(ctx, 'bubbles', () => {
        const rate = ctx.sampleRate;
        const length = Math.floor(rate * seconds);
        const buffer = ctx.createBuffer(2, length, rate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let k = 0; k < seconds * perSecond; k++) {
                const start = Math.floor(Math.random() * length);
                // Smaller bubbles are higher, more common and quieter.
                const smallness = Math.random();
                const f0 = 320 * Math.pow(2, smallness * 2.4);
                const size = Math.floor(rate * between(0.018, 0.06) * (1.2 - smallness * 0.6));
                const level = (0.05 + 0.16 * Math.pow(Math.random(), 2)) * (1.1 - smallness * 0.5);
                let phase = Math.random() * Math.PI * 2;
                for (let i = 0; i < size; i++) {
                    const t = i / size;
                    phase += (2 * Math.PI * f0 * (1 + 0.55 * t)) / rate;
                    const envelope = Math.exp(-4.2 * t) * (1 - Math.exp((-i / rate) / 0.0015));
                    data[(start + i) % length] += Math.sin(phase) * level * envelope;
                }
            }
        }
        return buffer;
    });
}

function looped(ctx, buffer, { offset = 0, rate = 1, seam = true } = {}) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (seam) source.loopEnd = buffer.duration - SEAM;
    source.playbackRate.value = rate;
    source.start(ctx.currentTime, offset % (buffer.duration - SEAM));
    return source;
}

function filter(ctx, type, frequency, q = 0.7) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
}

function level(ctx, value) {
    const node = ctx.createGain();
    node.gain.value = value;
    return node;
}

function panned(ctx, node, value) {
    if (typeof ctx.createStereoPanner !== 'function') return node;
    const pan = ctx.createStereoPanner();
    pan.pan.value = value;
    node.connect(pan);
    return pan;
}

// Wire a chain of nodes in order; returns the last.
function chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
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

// ---------------------------------------------------------------------------
// Scenes — each returns { output, nodes, live, reverb } so it can be faded and
// torn down. `live` holds short-lived sounds (a drip, a bowl) still ringing.
// ---------------------------------------------------------------------------

function track(live, sources) {
    sources.forEach((source) => {
        live.add(source);
        const ended = source.onended;
        source.onended = (event) => {
            live.delete(source);
            if (typeof ended === 'function') ended(event);
        };
    });
}

const SCENES = {
    ocean(ctx) {
        const output = level(ctx, 0.9);
        const nodes = [];
        const live = new Set();
        const brown = noise(ctx, 'brown');
        const pink = noise(ctx, 'pink');
        const white = noise(ctx, 'white', 9);

        // The far surf: always there, breathing slowly.
        const far = looped(ctx, brown, { offset: 2.1 });
        const farTone = filter(ctx, 'lowpass', 300, 0.4);
        const farLevel = level(ctx, 0.2);
        chain(far, farTone, farLevel, output);
        nodes.push(far, farTone, farLevel, lfo(ctx, 0.031, 70, farTone.frequency), lfo(ctx, 0.047, 0.05, farLevel.gain));

        // Two voices, so one wave can still be drawing back while the next gathers.
        const voices = [-0.35, 0.4].map((pan, index) => {
            const body = looped(ctx, pink, { offset: 1 + index * 4.3 });
            const bodyTone = filter(ctx, 'lowpass', 320, 0.3);
            const bodyLevel = level(ctx, 0.0001);
            panned(ctx, chain(body, bodyTone, bodyLevel), pan).connect(output);

            const foam = looped(ctx, white, { offset: 2.5 + index * 3.1 });
            const foamLow = filter(ctx, 'highpass', 1400, 0.5);
            const foamHigh = filter(ctx, 'lowpass', 7600, 0.5);
            const foamLevel = level(ctx, 0.0001);
            panned(ctx, chain(foam, foamLow, foamHigh, foamLevel), pan * 1.4).connect(output);

            nodes.push(body, bodyTone, bodyLevel, foam, foamLow, foamHigh, foamLevel);
            return { bodyTone, bodyLevel, foamLow, foamLevel };
        });

        let next = ctx.currentTime + 0.6;
        let turn = 0;
        nodes.push(scheduler(() => {
            while (next < ctx.currentTime + 12) {
                const voice = voices[turn % 2];
                turn += 1;
                const size = between(0.55, 1);
                const rise = between(2.4, 4.2);
                const wash = between(4.5, 7.5);
                const at = next;
                const breaks = at + rise;
                // Gathering: the swell grows and brightens.
                voice.bodyLevel.gain.setTargetAtTime(0.42 * size, at, rise / 2.6);
                voice.bodyTone.frequency.setTargetAtTime(500 + 1100 * size, at, rise / 2.6);
                // It breaks: foam rushes in, bright…
                voice.foamLevel.gain.setTargetAtTime(0.26 * size, breaks - 0.25, 0.14);
                voice.foamLow.frequency.setTargetAtTime(1100, breaks - 0.25, 0.2);
                // …and draws back over the sand, darker and fainter.
                voice.bodyLevel.gain.setTargetAtTime(0.02, breaks + 0.2, wash / 3.4);
                voice.bodyTone.frequency.setTargetAtTime(300, breaks + 0.2, wash / 3);
                voice.foamLevel.gain.setTargetAtTime(0.0001, breaks + 0.6, wash / 3.6);
                voice.foamLow.frequency.setTargetAtTime(2600, breaks + 0.6, wash / 2.5);
                next += between(4.2, 8.5);
            }
        }, 4000));

        return { output, nodes, live, reverb: 0.18 };
    },

    rain(ctx) {
        const output = level(ctx, 0.85);
        const nodes = [];
        const live = new Set();

        // The shower itself — its strength drifts, as real rain does.
        const bed = looped(ctx, noise(ctx, 'pink'), { offset: 0.7 });
        const bedLow = filter(ctx, 'highpass', 420, 0.5);
        const bedHigh = filter(ctx, 'lowpass', 6200, 0.5);
        const bedLevel = level(ctx, 0.34);
        chain(bed, bedLow, bedHigh, bedLevel, output);
        nodes.push(bed, bedLow, bedHigh, bedLevel);
        nodes.push(scheduler(() => {
            bedLevel.gain.setTargetAtTime(between(0.26, 0.42), ctx.currentTime, 3);
        }, 4500));

        // Drops on leaves, close by and further off.
        const drops = patter(ctx);
        const near = looped(ctx, drops, { offset: 0, seam: false });
        const nearLow = filter(ctx, 'highpass', 1500, 0.5);
        const nearHigh = filter(ctx, 'lowpass', 7400, 0.5);
        const nearLevel = level(ctx, 0.38);
        chain(near, nearLow, nearHigh, nearLevel, output);
        const away = looped(ctx, drops, { offset: 5.3, rate: 0.78, seam: false });
        const awayTone = filter(ctx, 'lowpass', 3200, 0.5);
        const awayLevel = level(ctx, 0.32);
        chain(away, awayTone, awayLevel, output);
        nodes.push(near, nearLow, nearHigh, nearLevel, away, awayTone, awayLevel);

        // The low body of rain on a roof, far off.
        const roof = looped(ctx, noise(ctx, 'brown'), { offset: 3.3 });
        const roofTone = filter(ctx, 'lowpass', 170, 0.4);
        const roofLevel = level(ctx, 0.14);
        chain(roof, roofTone, roofLevel, output);
        nodes.push(roof, roofTone, roofLevel);

        // Now and then, a heavier drip close by: a small rising "plip".
        let nextDrip = ctx.currentTime + 1;
        nodes.push(scheduler(() => {
            while (nextDrip < ctx.currentTime + 0.8) {
                const at = nextDrip;
                const pitch = between(900, 2200);
                const osc = ctx.createOscillator();
                const amp = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(pitch, at);
                osc.frequency.exponentialRampToValueAtTime(pitch * between(1.4, 1.9), at + 0.035);
                amp.gain.setValueAtTime(0.0001, at);
                amp.gain.exponentialRampToValueAtTime(between(0.012, 0.035), at + 0.003);
                amp.gain.exponentialRampToValueAtTime(0.0001, at + between(0.06, 0.11));
                const tail = panned(ctx, chain(osc, amp), between(-0.8, 0.8));
                tail.connect(output);
                osc.start(at);
                osc.stop(at + 0.14);
                osc.onended = () => [osc, amp, tail].forEach((node) => {
                    try { node.disconnect(); } catch { /* already gone */ }
                });
                track(live, [osc]);
                nextDrip += between(0.5, 2.8);
            }
        }, 300));

        return { output, nodes, live, reverb: 0.14 };
    },

    stream(ctx) {
        const output = level(ctx, 0.9);
        const nodes = [];
        const live = new Set();

        // The flow: a soft rush, and its low body.
        const flow = looped(ctx, noise(ctx, 'pink'), { offset: 4.4 });
        const flowTone = filter(ctx, 'bandpass', 760, 0.55);
        const flowLevel = level(ctx, 0.3);
        chain(flow, flowTone, flowLevel, output);
        const body = looped(ctx, noise(ctx, 'brown'), { offset: 6.2 });
        const bodyTone = filter(ctx, 'lowpass', 360, 0.4);
        const bodyLevel = level(ctx, 0.18);
        chain(body, bodyTone, bodyLevel, output);
        nodes.push(flow, flowTone, flowLevel, body, bodyTone, bodyLevel, lfo(ctx, 0.053, 0.06, flowLevel.gain), lfo(ctx, 0.021, 160, flowTone.frequency));

        // Bubbles over stones, two streams of them at slightly different speeds so they never repeat.
        const water = bubbles(ctx);
        [[0, 1, 0.75, -0.2], [5.7, 0.91, 0.55, 0.3]].forEach(([offset, rate, gain, pan]) => {
            const source = looped(ctx, water, { offset, rate, seam: false });
            const tone = filter(ctx, 'highpass', 240, 0.5);
            const amount = level(ctx, gain);
            panned(ctx, chain(source, tone, amount), pan).connect(output);
            nodes.push(source, tone, amount);
        });

        // A little air above the water.
        const air = looped(ctx, noise(ctx, 'white', 9), { offset: 1.9 });
        const airTone = filter(ctx, 'highpass', 5200, 0.5);
        const airLevel = level(ctx, 0.022);
        chain(air, airTone, airLevel, output);
        nodes.push(air, airTone, airLevel);

        return { output, nodes, live, reverb: 0.16 };
    },

    bowls(ctx) {
        const output = level(ctx, 0.42);
        const nodes = [];
        const live = new Set();

        // The quiet of the room itself.
        const room = looped(ctx, noise(ctx, 'brown'), { offset: 8.1 });
        const roomTone = filter(ctx, 'lowpass', 240, 0.4);
        const roomLevel = level(ctx, 0.09);
        chain(room, roomTone, roomLevel, output);
        nodes.push(room, roomTone, roomLevel);

        // Bowls of a few sizes, tuned to sit together (D, F, G, A, C).
        const sizes = [146.83, 174.61, 196, 220, 261.63];
        let last = -1;
        let nextStrike = ctx.currentTime + 0.8;
        nodes.push(scheduler(() => {
            while (nextStrike < ctx.currentTime + 1.5) {
                let pick = Math.floor(Math.random() * sizes.length);
                if (pick === last) pick = (pick + 2) % sizes.length;
                last = pick;
                const fundamental = sizes[pick];
                // Larger bowls ring longer.
                const ring = 9 + (261.63 / fundamental) * 6;
                track(live, strikeBowl(ctx, output, {
                    fundamental, when: nextStrike, intensity: between(0.5, 0.85), ring, mallet: 0.5, spread: 0.35
                }));
                // Sometimes a second, smaller touch, as a hand would.
                if (Math.random() < 0.25) {
                    const other = sizes[(pick + 2) % sizes.length];
                    track(live, strikeBowl(ctx, output, {
                        fundamental: other, when: nextStrike + between(2.2, 3.8), intensity: between(0.25, 0.4), ring: ring * 0.8, mallet: 0.3, spread: 0.35
                    }));
                }
                nextStrike += between(6.5, 12);
            }
        }, 1000));

        return { output, nodes, live, reverb: 0.5 };
    }
};

function teardown(scene) {
    [...scene.nodes, ...(scene.live || [])].forEach((node) => {
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
    scene.live?.clear();
    try {
        scene.output.disconnect();
    } catch {
        // already disconnected
    }
}

function readVolume() {
    try {
        const stored = Number(localStorage.getItem(VOLUME_KEY));
        return Number.isFinite(stored) && stored > 0 && stored <= 1 ? stored : DEFAULT_VOLUME;
    } catch {
        return DEFAULT_VOLUME;
    }
}

// The slider is perceptual: halfway sounds about half as loud.
const loudness = (volume) => Math.pow(volume, 1.6) * 0.9;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SoundscapeProvider({ children, mood: moodProp = null, initialSoundMode = 'auto' }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [soundMode, setSoundModeState] = useState(normaliseSoundMode(initialSoundMode));
    const [mood, setMood] = useState(moodProp);
    const [volume, setVolumeState] = useState(readVolume);

    const masterRef = useRef(null);
    const busRef = useRef(null); // { input, reverb }
    const sceneRef = useRef(null); // { id, output, nodes, live, send }
    const stopTimerRef = useRef(null);

    const activeSound = resolveSound(soundMode, mood);

    useEffect(() => setMood(moodProp), [moodProp]);
    useEffect(() => setSoundModeState(normaliseSoundMode(initialSoundMode)), [initialSoundMode]);

    // scene → [dry + room] → softened top → gentle compressor → volume → speakers
    const ensureMaster = useCallback(() => {
        const ctx = getAudioContext();
        if (!ctx) return null;
        if (!masterRef.current || masterRef.current.context !== ctx) {
            const input = ctx.createGain();
            const reverb = ctx.createConvolver();
            reverb.buffer = roomImpulse(ctx, 3.4, 2.6);
            const wet = level(ctx, 0.9);
            const softTop = ctx.createBiquadFilter();
            softTop.type = 'highshelf';
            softTop.frequency.value = 6500;
            softTop.gain.value = -4;
            const glue = ctx.createDynamicsCompressor();
            glue.threshold.value = -20;
            glue.knee.value = 12;
            glue.ratio.value = 2.5;
            glue.attack.value = 0.03;
            glue.release.value = 0.5;
            const master = level(ctx, 0);
            input.connect(softTop);
            reverb.connect(wet);
            wet.connect(softTop);
            chain(softTop, glue, master, ctx.destination);
            masterRef.current = master;
            busRef.current = { input, reverb };
        }
        return ctx;
    }, []);

    const crossfadeTo = useCallback((sceneId) => {
        const ctx = ensureMaster();
        if (!ctx || !SCENES[sceneId]) return;
        const current = sceneRef.current;
        if (current && current.id === sceneId) return;

        const now = ctx.currentTime;

        if (current) {
            current.output.gain.cancelScheduledValues(now);
            current.output.gain.setValueAtTime(current.output.gain.value, now);
            current.output.gain.linearRampToValueAtTime(0.0001, now + 2);
            setTimeout(() => teardown(current), 2300);
        }

        const scene = SCENES[sceneId](ctx);
        const target = scene.output.gain.value;
        scene.output.gain.setValueAtTime(0.0001, now);
        scene.output.gain.linearRampToValueAtTime(target, now + 2.4);
        const send = level(ctx, scene.reverb ?? 0.2);
        scene.output.connect(busRef.current.input);
        scene.output.connect(send);
        send.connect(busRef.current.reverb);
        scene.nodes.push(send);
        sceneRef.current = { id: sceneId, ...scene };
    }, [ensureMaster]);

    const play = useCallback((mode) => {
        const ctx = ensureMaster();
        if (!ctx) return;
        clearTimeout(stopTimerRef.current);

        const nextMode = normaliseSoundMode(mode || soundMode);
        if (mode && nextMode !== soundMode) setSoundModeState(nextMode);

        const master = masterRef.current.gain;
        const now = ctx.currentTime;
        master.cancelScheduledValues(now);
        master.setValueAtTime(master.value, now);
        master.linearRampToValueAtTime(loudness(volume), now + 1.6);

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
        master.gain.linearRampToValueAtTime(0, now + 1.2);

        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
            if (sceneRef.current) teardown(sceneRef.current);
            sceneRef.current = null;
        }, 1400);
    }, []);

    const toggleSound = useCallback(() => (isPlaying ? stop() : play()), [isPlaying, play, stop]);

    // While a verse is read aloud, the sound steps back, then returns.
    const ducked = useRef(false);
    const duck = useCallback((on) => {
        const master = masterRef.current;
        ducked.current = Boolean(on);
        if (!master || !isPlaying) return;
        master.gain.setTargetAtTime(loudness(volume) * (on ? 0.22 : 1), master.context.currentTime, on ? 0.3 : 0.9);
    }, [isPlaying, volume]);

    const setSoundMode = useCallback((mode) => setSoundModeState(normaliseSoundMode(mode)), []);

    const setVolume = useCallback((value) => {
        const next = Math.min(1, Math.max(0.02, value));
        setVolumeState(next);
        try {
            localStorage.setItem(VOLUME_KEY, String(next));
        } catch {
            // the level simply isn't remembered
        }
    }, []);

    // Follow mood / mode changes while playing — crossfade, never cut.
    useEffect(() => {
        if (isPlaying) crossfadeTo(activeSound);
    }, [activeSound, isPlaying, crossfadeTo]);

    useEffect(() => {
        const master = masterRef.current;
        if (master && isPlaying) master.gain.setTargetAtTime(loudness(volume) * (ducked.current ? 0.22 : 1), master.context.currentTime, 0.15);
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

// The scenes themselves, for previews and for checking them offline.
export const scenes = SCENES;
