import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../dist/src/audio.js';
import { Game, LANDING_BOUNCE, PHYSICS } from '../dist/src/engine.js';
const idle = { up: false, down: false, left: false, right: false };

function audio() {
  const nodes = [];
  const parameter = () => ({
    changes: [],
    setValueAtTime(value, time) { this.changes.push({ kind: 'set', value, time }); },
    exponentialRampToValueAtTime(value, time) { this.changes.push({ kind: 'ramp', value, time }); },
    cancelScheduledValues() {}, setTargetAtTime() {}
  });
  const source = () => ({
    starts: [], stops: [], disconnected: false, connections: [],
    connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; },
    start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); }
  });
  const context = {
    currentTime: 10, destination: {}, resumeCalls: 0, sampleRate: 44100,
    async resume() { this.resumeCalls++; },
    createOscillator() {
      const node = { ...source(), frequency: parameter() };
      node.frequency.setValueAtTime = (value, time) => { node.pitch = value; node.frequency.changes.push({ kind: 'set', value, time }); };
      nodes.push(node); return node;
    },
    createBuffer(channels, length) { const samples = new Float32Array(length); return { getChannelData() { return samples; } }; },
    createBufferSource() { const node = { ...source(), kind: 'noise' }; nodes.push(node); return node; },
    createBiquadFilter() { return { frequency: parameter(), connect() {}, disconnect() {} }; },
    createGain() { return { gain: parameter(), connections: [], connect(target) { this.connections.push(target); }, disconnect() {} }; }
  };
  const sound = new Sound(); sound.context = context;
  return { sound, context, nodes };
}

function playing() {
  const game = new Game(() => .5); game.start();
  game.step(3, idle);
  return game;
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

test('up and sideways thrust use independent sustained saucer voices that can overlap', () => {
  const { sound, nodes } = audio(), game = playing();
  sound.update(game, { ...idle, up: true });
  assert.equal(nodes.length, 2, 'one carrier and one pitch wobble');
  const upward = [...nodes];
  assert.equal(upward[0].type, 'sine'); assert.equal(upward[1].pitch, 8.5);
  assert.equal(upward[1].connections[0].connections[0], upward[0].frequency, 'wobble modulates the carrier pitch');
  assert.equal(upward[0].stops.length, 0, 'thrust remains sustained');
  sound.update(game, { ...idle, up: true, right: true });
  assert.equal(nodes.length, 4); assert.equal(nodes[2].pitch, upward[0].pitch, 'both use the same saucer sound');
  sound.update(game, { ...idle, up: true, right: true });
  assert.equal(nodes.length, 4, 'held controls do not create repeated voices');
  sound.update(game, { ...idle, right: true });
  assert.ok(upward.every(node => node.stops.length === 1));
  assert.ok(nodes.slice(2).every(node => node.stops.length === 0), 'sideways continues when up is released');
  sound.update(game, { ...idle, left: true });
  assert.equal(nodes.length, 4, 'changing sideways direction keeps the same voice');
  sound.update(game, idle);
  assert.ok(nodes.every(node => node.stops.length === 1));
});

test('gear lock, opposite side inputs, no fuel, countdown, and pause silence unused thrusters', () => {
  const { sound, nodes } = audio(), game = playing();
  game.ship.gear = true;
  sound.update(game, { ...idle, up: true, left: true });
  assert.equal(nodes.length, 2, 'gear disables sideways audio only');
  game.ship.gear = false;
  sound.update(game, { ...idle, left: true, right: true });
  assert.equal(nodes.length, 2, 'balanced side inputs produce no thrust audio');
  for (const phase of ['paused', 'countdown', 'crashed', 'gameover']) {
    game.phase = phase;
    sound.update(game, { ...idle, up: true, right: true });
    assert.equal(nodes.length, 2, phase);
  }
  game.phase = 'playing'; game.fuel = 0;
  sound.update(game, { ...idle, up: true, right: true });
  assert.equal(nodes.length, 2, 'empty tank has no thrust audio');
});
test('downward thrust layers with sideways audio and balanced vertical inputs silence only that layer', () => {
  const { sound, nodes } = audio(), game = playing();
  sound.update(game, { ...idle, down: true, right: true });
  assert.equal(nodes.length, 4);
  assert.equal(nodes[0].pitch, nodes[2].pitch, 'same saucer tone for vertical and sideways thrust');
  sound.update(game, { ...idle, up: true, right: true });
  assert.equal(nodes.length, 4, 'switching vertical direction reuses the sustained voice');
  sound.update(game, { ...idle, up: true, down: true, right: true });
  assert.ok(nodes.slice(0, 2).every(node => node.stops.length === 1));
  assert.ok(nodes.slice(2).every(node => node.stops.length === 0));
  game.ship.gear = true; sound.update(game, { ...idle, down: true, right: true });
  assert.equal(nodes.length, 6, 'down thrust is audible with gear extended');
  assert.ok(nodes.slice(2, 4).every(node => node.stops.length === 1));
  game.ship = game.spawnAtStation(); sound.update(game, { ...idle, down: true });
  assert.ok(nodes.slice(4).every(node => node.stops.length === 1), 'down thrust is silent while docked');
});

test('happy win and sad losses are selected from structured end reasons, with descending loss notes', () => {
  const win = audio(), winner = playing(); winner.finish('delivered'); win.sound.play(winner.events.at(-1));
  assert.ok(win.nodes.at(-2).pitch > win.nodes[0].pitch, 'victory melody ascends');
  for (const reason of ['tips', 'lives']) {
    const loss = audio(), loser = playing(); loser.finish(reason);
    loss.sound.play({ ...loser.events.at(-1), message: 'All orders delivered!' });
    const melody = loss.nodes.slice(0, -1);
    assert.ok(melody.every((note, i) => i === 0 || note.pitch < melody[i - 1].pitch));
    assert.notEqual(loss.nodes[0].pitch, win.nodes[0].pitch);
    loss.sound.update(loser, idle);
    assert.ok(loss.nodes.every(node => node.stops.length === 1), 'game over does not cancel its jingle');
  }
});

test('hard landing stutters once per visual hop and stops or resumes with the shake', () => {
  const { sound, context, nodes } = audio(), game = playing();
  const pad = game.level.pads.find(p => p.id === game.level.restaurant);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .1, vx: 0, vy: PHYSICS.safeVertical * .9, gear: true, landed: null };
  game.step(1 / 120, idle);
  const landing = game.events.find(event => event.type === 'land');
  assert.equal(landing.hardLanding, true); sound.play(landing); sound.update(game, idle);
  assert.equal(nodes.length, LANDING_BOUNCE.count);
  nodes.forEach((node, i) => {
    assert.ok(Math.abs(node.starts[0] - context.currentTime - i * LANDING_BOUNCE.duration / LANDING_BOUNCE.count) < 1e-9);
    assert.ok(node.stops[0] <= context.currentTime + LANDING_BOUNCE.duration);
  });
  sound.update(game, idle); assert.equal(nodes.length, LANDING_BOUNCE.count, 'does not repeat on every frame');
  sound.stopAll(); game.pause(); sound.update(game, idle);
  assert.ok(nodes.every(node => node.stops.length === 2));
  game.pause(); game.landingBounceTime = LANDING_BOUNCE.duration / LANDING_BOUNCE.count;
  sound.update(game, idle); assert.equal(nodes.length, LANDING_BOUNCE.count + 1, 'resume plays only the remaining hop');
  game.toggleGear(); sound.update(game, idle);
  assert.equal(nodes.at(-1).stops.length, 2, 'gear retraction cancels the stutter');
});

test('crash plays a noisy impact and falling rumble, then loss music after the final explosion', () => {
  const { sound, context, nodes } = audio(), game = playing(); game.lives = 1;
  sound.update(game, { ...idle, up: true, right: true });
  game.crash('test'); sound.play(game.events.at(-1)); sound.update(game, idle);
  assert.ok(nodes.slice(0, 4).every(node => node.stops.length === 1), 'crash stops both thrusters');
  const noise = nodes.find(node => node.kind === 'noise'); assert.ok(noise.buffer.getChannelData(0).some(sample => sample !== 0));
  assert.equal(noise.starts[0], context.currentTime);
  const rumble = nodes.at(-1);
  assert.ok(rumble.frequency.changes.some(change => change.kind === 'ramp' && change.value < rumble.pitch));
  game.step(1.49, idle); assert.equal(game.phase, 'crashed'); assert.equal(game.events.some(event => event.type === 'gameover'), false);
  game.step(.01, idle); const end = game.events.at(-1);
  assert.equal(end.endReason, 'lives'); sound.play(end);
  assert.ok(nodes.length > 6, 'loss jingle starts after explosion');
});

test('arrival chimes separately from pickup and muting cancels all layers and queued effects', () => {
  const { sound, nodes } = audio(), game = playing();
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  assert.equal(nodes.length, 3); assert.ok(nodes[2].pitch > nodes[0].pitch);
  sound.play({ type: 'pickup', message: '', x: 0, y: 0 }); assert.equal(nodes.length, 5);
  sound.update(game, { ...idle, up: true, left: true });
  assert.equal(sound.toggle(), false);
  assert.ok(nodes.slice(0, 5).every(node => node.stops.length === 2));
  assert.ok(nodes.slice(5).every(node => node.stops.length === 1));
  const count = nodes.length;
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  sound.play({ type: 'gameover', endReason: 'delivered', message: '', x: 0, y: 0 });
  sound.update(game, { ...idle, up: true, left: true });
  assert.equal(nodes.length, count);
});
