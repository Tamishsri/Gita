import { getAudioContext, whenAudioRunning } from './audio';

// Tibetan singing bowl, synthesised additively.
//
// A struck bowl is a fundamental plus overtones that each ring and fade at
// their own rate. Each partial here is a *pair* of sine oscillators detuned by
// under a hertz, so they drift in and out of phase — the slow "wah-wah"
// beating that makes a real bowl sound alive. A short band-passed noise burst
// stands in for the mallet, and a generated impulse response gives the room.

const FUNDAMENTAL = 432;

const PRESETS = {
    // Full strike: opening and closing the 3-breaths ritual.
    bowl: {
        level: 1,
        mallet: 1,
        partials: [
            { ratio: 1, gain: 1, decay: 9.5, beat: 0.62 },
            { ratio: 2, gain: 0.44, decay: 6.5, beat: 0.95 },
            { ratio: 3, gain: 0.24, decay: 4.4, beat: 1.4 }
        ]
    },
    // Lighter touch: a finished breath cycle, a saved line, a written reflection.
    soft: {
        level: 0.5,
        mallet: 0.35,
        partials: [
            { ratio: 2, gain: 0.7, decay: 3.8, beat: 0.9 },
            { ratio: 3, gain: 0.34, decay: 2.8, beat: 1.3 }
        ]
    }
};

let enabled = true;
let bus = null;

export function setChimesEnabled(value) {
    enabled = value !== false;
}

export function areChimesEnabled() {
    return enabled;
}

function buildImpulse(ctx, seconds = 3.4, decay = 2.8) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}

function getBus(ctx) {
    if (bus && bus.ctx === ctx) return bus;

    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const reverb = ctx.createConvolver();
    const limiter = ctx.createDynamicsCompressor();
    const output = ctx.createGain();

    dry.gain.value = 0.85;
    wet.gain.value = 0.32;
    reverb.buffer = buildImpulse(ctx);
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    output.gain.value = 0.26;

    input.connect(dry);
    input.connect(reverb);
    reverb.connect(wet);
    dry.connect(limiter);
    wet.connect(limiter);
    limiter.connect(output);
    output.connect(ctx.destination);

    bus = { ctx, input };
    return bus;
}

function strike(ctx, destination, preset, when, intensity = 1) {
    const level = preset.level * intensity;
    const count = preset.partials.length;

    preset.partials.forEach((partial, index) => {
        const frequency = FUNDAMENTAL * partial.ratio;
        const peak = partial.gain * level * 0.5; // two oscillators share each partial
        const attackEnd = when + 0.008 + index * 0.003;
        const stopAt = when + partial.decay + 0.3;

        [-1, 1].forEach((side) => {
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency + (side * partial.beat) / 2, when);

            amp.gain.setValueAtTime(0.0001, when);
            amp.gain.exponentialRampToValueAtTime(peak, attackEnd);
            // Time constant = T60 / 6.9, so each partial falls ~60 dB over its decay.
            amp.gain.setTargetAtTime(0.0001, attackEnd + 0.01, partial.decay / 6.9);

            osc.connect(amp);

            let tail = amp;
            if (typeof ctx.createStereoPanner === 'function') {
                const pan = ctx.createStereoPanner();
                pan.pan.value = side * 0.22 * ((index + 1) / count);
                amp.connect(pan);
                tail = pan;
            }
            tail.connect(destination);

            osc.start(when);
            osc.stop(stopAt);
            osc.onended = () => {
                osc.disconnect();
                amp.disconnect();
                if (tail !== amp) tail.disconnect();
            };
        });
    });

    if (preset.mallet > 0) {
        const length = Math.floor(ctx.sampleRate * 0.045);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
        }

        const source = ctx.createBufferSource();
        const band = ctx.createBiquadFilter();
        const amp = ctx.createGain();

        source.buffer = buffer;
        band.type = 'bandpass';
        band.frequency.value = 2600;
        band.Q.value = 1.1;
        amp.gain.value = 0.14 * preset.mallet * intensity;

        source.connect(band);
        band.connect(amp);
        amp.connect(destination);
        source.start(when);
        source.onended = () => {
            source.disconnect();
            band.disconnect();
            amp.disconnect();
        };
    }
}

/**
 * Strike the singing bowl.
 * @param {'bowl' | 'soft' | 'ceremony'} kind
 * @param {{ force?: boolean }} options  force ignores the user's chime preference (used for previews)
 */
export async function playChime(kind = 'bowl', { force = false } = {}) {
    if (!enabled && !force) return false;

    // Prefer the synchronous path so gesture-driven strikes land instantly.
    let ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
        ctx = await whenAudioRunning();
        if (!ctx) return false;
    }

    const { input } = getBus(ctx);
    const now = ctx.currentTime + 0.02;

    if (kind === 'ceremony') {
        strike(ctx, input, PRESETS.bowl, now, 1);
        strike(ctx, input, PRESETS.bowl, now + 2.6, 0.62);
        strike(ctx, input, PRESETS.soft, now + 5.0, 0.8);
    } else {
        strike(ctx, input, PRESETS[kind] || PRESETS.bowl, now, 1);
    }

    return true;
}
