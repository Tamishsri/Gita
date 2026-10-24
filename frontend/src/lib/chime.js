import { getAudioContext, whenAudioRunning } from './audio';

// Tibetan singing bowls, synthesised additively.
//
// A real bowl is not a harmonic instrument: its overtones sit at about 2.76,
// 5.4 and 8.9 times the fundamental — that inharmonic spread is what makes it
// sound like metal and not like an organ. Each partial here is a *pair* of
// sines detuned by about a hertz, so they drift in and out of phase: the slow
// "wah-wah" of a bowl that is still alive. Higher partials die sooner, the
// way they do in bronze; a soft felt mallet starts it; a room carries it.

export const BOWL_PARTIALS = [
    { ratio: 1, gain: 1, decay: 1, beat: 0.55 },
    { ratio: 2.76, gain: 0.5, decay: 0.6, beat: 1.05 },
    { ratio: 5.4, gain: 0.2, decay: 0.36, beat: 1.6 },
    { ratio: 8.93, gain: 0.07, decay: 0.2, beat: 2.3 }
];

/**
 * Strike one bowl into `destination`.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {{ fundamental?: number, when?: number, intensity?: number, ring?: number, mallet?: number,
 *           partials?: typeof BOWL_PARTIALS, spread?: number }} options
 *   ring: seconds the fundamental takes to fade (~60 dB); the overtones fade sooner.
 * @returns {AudioScheduledSourceNode[]} the sounding sources (stop them to silence it)
 */
export function strikeBowl(ctx, destination, {
    fundamental = 220, when = ctx.currentTime, intensity = 1, ring = 12, mallet = 0.6, partials = BOWL_PARTIALS, spread = 0.25
} = {}) {
    const sources = [];
    partials.forEach((partial, index) => {
        const frequency = fundamental * partial.ratio;
        if (frequency > 9000) return;
        const decay = Math.max(0.4, ring * partial.decay);
        const peak = partial.gain * intensity * 0.5; // two oscillators share each partial
        // Higher partials speak a hair later and softer under a felt mallet.
        const attackEnd = when + 0.012 + index * 0.006;
        const stopAt = attackEnd + decay + 0.4;

        [-1, 1].forEach((side) => {
            const osc = ctx.createOscillator();
            const amp = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency + (side * partial.beat) / 2, when);
            amp.gain.setValueAtTime(0.0001, when);
            amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), attackEnd);
            // Time constant = T60 / 6.9, so each partial falls ~60 dB over its decay.
            amp.gain.setTargetAtTime(0.0001, attackEnd + 0.02, decay / 6.9);
            osc.connect(amp);

            let tail = amp;
            if (typeof ctx.createStereoPanner === 'function') {
                const pan = ctx.createStereoPanner();
                pan.pan.value = side * spread * ((index + 1) / partials.length);
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
            sources.push(osc);
        });
    });

    if (mallet > 0) {
        // A felt mallet: a short, dull knock, mostly low-mid.
        const length = Math.floor(ctx.sampleRate * 0.035);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
        const source = ctx.createBufferSource();
        const band = ctx.createBiquadFilter();
        const amp = ctx.createGain();
        source.buffer = buffer;
        band.type = 'bandpass';
        band.frequency.value = Math.min(2400, fundamental * 5);
        band.Q.value = 0.9;
        amp.gain.value = 0.09 * mallet * intensity;
        source.connect(band);
        band.connect(amp);
        amp.connect(destination);
        source.start(when);
        source.onended = () => {
            source.disconnect();
            band.disconnect();
            amp.disconnect();
        };
        sources.push(source);
    }
    return sources;
}

const PRESETS = {
    // A large bowl: opening and closing the 3-breaths ritual, the "Ring the bowl" button.
    bowl: { fundamental: 216, ring: 11, intensity: 1, mallet: 0.8 },
    // A small bowl, touched lightly: a finished breath, a saved line, the start of a recitation.
    soft: { fundamental: 432, ring: 4.2, intensity: 0.42, mallet: 0.3, partials: BOWL_PARTIALS.slice(0, 3) }
};

let enabled = true;
let bus = null;

export function setChimesEnabled(value) {
    enabled = value !== false;
}

export function areChimesEnabled() {
    return enabled;
}

// A room: stereo noise that dies away, darker as it goes (air takes the highs first).
export function roomImpulse(ctx, seconds = 3.2, decay = 3) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        let smooth = 0;
        for (let i = 0; i < length; i++) {
            const t = i / length;
            // The later the reflection, the more it is low-passed.
            const darkness = 0.15 + 0.8 * t;
            smooth = smooth * darkness + (Math.random() * 2 - 1) * (1 - darkness);
            const early = i < ctx.sampleRate * 0.012 ? 0 : 1; // a short gap before the room answers
            data[i] = smooth * Math.pow(1 - t, decay) * early * 2.2;
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
    wet.gain.value = 0.38;
    reverb.buffer = roomImpulse(ctx);
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    output.gain.value = 0.3;

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

// A bead passing between the fingers: a tiny, warm wooden click.
function tick(ctx, destination) {
    const now = ctx.currentTime + 0.005;
    const length = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 6);
    }
    const source = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const body = ctx.createOscillator();
    const amp = ctx.createGain();
    const bodyAmp = ctx.createGain();

    source.buffer = buffer;
    band.type = 'bandpass';
    band.frequency.value = 1900;
    band.Q.value = 2.2;
    amp.gain.value = 0.35;

    body.type = 'sine';
    body.frequency.setValueAtTime(420, now);
    body.frequency.exponentialRampToValueAtTime(260, now + 0.06);
    bodyAmp.gain.setValueAtTime(0.0001, now);
    bodyAmp.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
    bodyAmp.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    source.connect(band);
    band.connect(amp);
    amp.connect(destination);
    body.connect(bodyAmp);
    bodyAmp.connect(destination);
    source.start(now);
    body.start(now);
    body.stop(now + 0.1);
    body.onended = () => {
        [source, band, amp, body, bodyAmp].forEach((node) => node.disconnect());
    };
}

/**
 * Strike the singing bowl.
 * @param {'bowl' | 'soft' | 'ceremony' | 'tick'} kind
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

    if (kind === 'tick') {
        tick(ctx, input);
    } else if (kind === 'ceremony') {
        strikeBowl(ctx, input, { ...PRESETS.bowl, when: now });
        strikeBowl(ctx, input, { ...PRESETS.bowl, when: now + 2.6, intensity: 0.62 });
        strikeBowl(ctx, input, { ...PRESETS.soft, when: now + 5.0, intensity: 0.34 });
    } else {
        strikeBowl(ctx, input, { ...(PRESETS[kind] || PRESETS.bowl), when: now });
    }

    return true;
}
