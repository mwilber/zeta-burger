// SID-inspired synthesis, rather than a cycle-accurate 6581 emulator.
// PAL frequency registers, 50 Hz sound-driver updates, pulse waves and ADSR
// follow the MOS 6581 vocabulary; Web Audio supplies band-limiting and filters.
export type SidWaveform = 'pulse' | 'triangle' | 'sawtooth';
export interface SidPatch {
  pulseWidth?: number;
  cutoff?: number;
  sustain?: number;
  endFrequency?: number;
}
const PAL_CLOCK = 985248;
const DRIVER_RATE = 50;
const pulseWaves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();

export function sidFrequency(frequency: number): number {
  const register = Math.max(1, Math.min(65535, Math.round(frequency * 2 ** 24 / PAL_CLOCK)));
  return register * PAL_CLOCK / 2 ** 24;
}

export function sidWaveform(context: BaseAudioContext, oscillator: OscillatorNode, type: SidWaveform, width = .25) {
  if (type !== 'pulse') { oscillator.type = type; return; }
  const duty = Math.round(Math.max(.0625, Math.min(.9375, width)) * 4096) / 4096;
  let waves = pulseWaves.get(context);
  if (!waves) { waves = new Map(); pulseWaves.set(context, waves); }
  let wave = waves.get(duty);
  if (!wave) {
    const real = new Float32Array(65), imaginary = new Float32Array(65);
    // Zero DC; the browser omits harmonics above Nyquist at each note's pitch.
    for (let harmonic = 1; harmonic < real.length; harmonic++) {
      const phase = 2 * Math.PI * harmonic * duty, scale = 2 / (Math.PI * harmonic);
      real[harmonic] = scale * Math.sin(phase);
      imaginary[harmonic] = scale * (1 - Math.cos(phase));
    }
    wave = context.createPeriodicWave(real, imaginary);
    waves.set(duty, wave);
  }
  oscillator.setPeriodicWave(wave);
}

export function sidEnvelope(parameter: AudioParam, volume: number, time: number, duration: number, sustain = .45) {
  const attack = Math.min(.002, duration / 8), decay = Math.min(.024, duration / 4);
  const release = Math.min(.042, duration / 3);
  const held = volume * Math.max(1, Math.round(sustain * 15)) / 15;
  parameter.setValueAtTime(0, time);
  parameter.linearRampToValueAtTime(volume, time + attack);
  parameter.exponentialRampToValueAtTime(held, time + attack + decay);
  parameter.setValueAtTime(held, time + duration - release);
  parameter.linearRampToValueAtTime(0, time + duration);
}

export function sidPitch(parameter: AudioParam, from: number, to: number, time: number, duration: number) {
  parameter.setValueAtTime(sidFrequency(from), time);
  // Register writes produce little pitch steps instead of a smooth portamento.
  for (let tick = 1; tick < duration * DRIVER_RATE; tick++) {
    const elapsed = tick / DRIVER_RATE;
    parameter.setValueAtTime(sidFrequency(from * (to / from) ** (elapsed / duration)), time + elapsed);
  }
  parameter.setValueAtTime(sidFrequency(to), time + duration);
}

export function sidNoise(sampleRate: number, duration: number, fromClock: number, toClock: number): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let register = 0x7ffff8, phase = 0, value = 0, rate = fromClock;
  let previousTick = -1;
  for (let i = 0; i < samples.length; i++) {
    const tick = Math.floor(i / sampleRate * DRIVER_RATE);
    if (tick !== previousTick) {
      rate = sidFrequency(fromClock / 16 * (toClock / fromClock) ** (tick / DRIVER_RATE / duration)) * 16;
      previousTick = tick;
    }
    // The SID clocks a 23-bit shift register from oscillator bit 19. Eight
    // scattered taps form its crunchy, pitched noise DAC output.
    phase += rate / sampleRate;
    while (phase >= 1) {
      const feedback = ((register >> 22) ^ (register >> 17)) & 1;
      register = ((register << 1) | feedback) & 0x7fffff;
      const output = (((register >> 22) & 1) << 7) | (((register >> 20) & 1) << 6)
        | (((register >> 16) & 1) << 5) | (((register >> 13) & 1) << 4)
        | (((register >> 11) & 1) << 3) | (((register >> 7) & 1) << 2)
        | (((register >> 4) & 1) << 1) | ((register >> 2) & 1);
      value = output / 127.5 - 1;
      phase--;
    }
    samples[i] = value;
  }
  return samples;
}
