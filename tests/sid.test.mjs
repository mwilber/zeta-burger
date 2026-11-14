import test from 'node:test';
import assert from 'node:assert/strict';
import { sidEnvelope, sidFrequency, sidNoise, sidPitch, sidWaveform } from '../dist/src/sid.js';

test('pulse harmonics form an asymmetric waveform without DC', () => {
  let wave;
  const context = { createPeriodicWave(real, imaginary) { return { real, imaginary }; } };
  sidWaveform(context, { setPeriodicWave(value) { wave = value; } }, 'pulse', .25);
  const valueAt = phase => wave.real.reduce((sum, real, n) => sum + real * Math.cos(n * phase)
    + wave.imaginary[n] * Math.sin(n * phase), 0);
  assert.equal(wave.real[0], 0); assert.equal(wave.imaginary[0], 0);
  assert.ok(Math.abs(valueAt(Math.PI / 4) - 1.5) < .03, 'high portion occupies one quarter of the cycle');
  assert.ok(Math.abs(valueAt(Math.PI * 1.25) + .5) < .03, 'low portion balances its DC offset');
});

test('noise has held 8-bit DAC values and slows from a crack to a rumble at both browser sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    const noise = sidNoise(sampleRate, .8, 14000, 450);
    assert.equal(noise.length, Math.ceil(sampleRate * .8));
    assert.ok(noise.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
    const levels = new Set(noise);
    assert.ok(levels.size > 200 && levels.size <= 257, '8-bit register output plus the initial zero');
    const changes = samples => samples.reduce((count, value, i) => count + Number(i > 0 && value !== samples[i - 1]), 0);
    const window = Math.floor(sampleRate * .05);
    assert.ok(changes(noise.subarray(0, window)) > changes(noise.subarray(-window)) * 10, 'falling clock creates progressively longer holds');
    const mean = noise.reduce((sum, value) => sum + value, 0) / noise.length;
    assert.ok(Math.abs(mean) < .08, 'noise stays centered');
  }
});

test('pitch bends use PAL register values and audible 50 Hz steps, including their endpoint', () => {
  const changes = [];
  sidPitch({ setValueAtTime(value, time) { changes.push({ value, time }); } }, 1800, 320, 10, .055);
  assert.deepEqual(changes.map(change => change.time), [10, 10.02, 10.04, 10.055]);
  assert.ok(changes.every((change, i) => i === 0 || change.value < changes[i - 1].value));
  assert.equal(changes.at(-1).value, sidFrequency(320));
  for (const { value } of changes) {
    const register = value * 2 ** 24 / 985248;
    assert.ok(Math.abs(register - Math.round(register)) < 1e-8);
  }
});

test('ADSR automation stays ordered even for a tiny remainder after resuming', () => {
  for (const duration of [.0001, .055, .12, .9]) {
    const changes = [];
    const parameter = {
      setValueAtTime(value, time) { changes.push({ value, time }); },
      linearRampToValueAtTime(value, time) { changes.push({ value, time }); },
      exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); changes.push({ value, time }); }
    };
    sidEnvelope(parameter, .065, 10, duration);
    assert.deepEqual(changes[0], { value: 0, time: 10 });
    assert.deepEqual(changes.at(-1), { value: 0, time: 10 + duration });
    assert.ok(changes.every((change, i) => i === 0 || change.time >= changes[i - 1].time));
    assert.ok(changes.every(change => change.value >= 0 && change.value <= .065));
  }
});
