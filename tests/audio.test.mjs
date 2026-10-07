import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../dist/src/audio.js';

function audio() {
  const nodes = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const context = {
    currentTime: 10, destination: {}, resumeCalls: 0,
    async resume() { this.resumeCalls++; },
    createOscillator() {
      const node = {
        frequency: { setValueAtTime(value) { node.pitch = value; } },
        starts: [], stops: [], disconnected: false,
        connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); }
      };
      nodes.push(node); return node;
    },
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
  };
  const sound = new Sound(); sound.context = context;
  return { sound, context, nodes };
}

test('start jingle is audible by default and completes during the three-second start delay', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  assert.equal(sound.enabled, true); assert.equal(context.resumeCalls, 1);
  assert.equal(nodes.length, 8);
  assert.ok(nodes.at(-1).pitch > nodes[0].pitch, 'melody resolves above the opening note');
  assert.equal(nodes[0].starts[0], context.currentTime);
  assert.ok(nodes.every(node => node.starts[0] >= context.currentTime && node.stops[0] < context.currentTime + 3));
  assert.ok(nodes.at(-1).stops[0] > context.currentTime + 2.8, 'final note leads into gameplay');
});

test('pausing cancels scheduled notes and resuming plays only the remaining melody', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  const original = [...nodes]; sound.stopJingle();
  assert.ok(original.every(node => node.stops.length === 2 && node.stops[1] === undefined));
  sound.startJingle(1.4);
  const resumed = nodes.slice(original.length);
  assert.equal(resumed.length, 4, 'completed notes are skipped');
  assert.equal(resumed[0].starts[0], context.currentTime, 'interrupted note resumes immediately');
  assert.ok(resumed.every(node => node.stops[0] < context.currentTime + 1.6));
});

test('muting cancels the jingle and suppresses start and replay audio', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  assert.equal(sound.toggle(), false);
  assert.ok(nodes.every(node => node.stops.length === 2));
  sound.startJingle(); sound.startJingle(1);
  assert.equal(nodes.length, 8); assert.equal(context.resumeCalls, 1);
});

test('restarting replaces scheduled music and finished notes release their audio nodes', () => {
  const { sound, nodes } = audio(); sound.startJingle();
  const original = [...nodes]; sound.startJingle();
  assert.ok(original.every(node => node.stops.length === 2));
  const replay = nodes.slice(original.length);
  for (const node of replay) node.onended();
  assert.ok(replay.every(node => node.disconnected));
  sound.stopJingle();
  assert.ok(replay.every(node => node.stops.length === 1, 'finished notes are no longer scheduled'));
});
