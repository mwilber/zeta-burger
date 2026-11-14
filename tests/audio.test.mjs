import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../dist/src/audio.js';
import { Game, LANDING_BOUNCE, PHYSICS, ZERO_G } from '../dist/src/engine.js';
import { LEVELS } from '../dist/src/levels.js';
import SamJs from '../dist/src/vendor/sam-js.js';
import { DISPATCH_VOICE, THANKS_VOICES } from '../dist/src/speech.js';
import { SPEECH_CONFIG } from '../dist/src/level-config.js';
import { sidFrequency } from '../dist/src/sid.js';
import { START_JINGLE, WIN_JINGLE, LOSE_JINGLE } from '../dist/src/music.js';
const luna = LEVELS.find(level => level.id === 'luna');
const idle = { up: false, down: false, left: false, right: false };

function audio() {
  const nodes = [];
  const parameter = () => ({
    changes: [],
    setValueAtTime(value, time) { this.changes.push({ kind: 'set', value, time }); },
    linearRampToValueAtTime(value, time) { this.changes.push({ kind: 'linear', value, time }); },
    exponentialRampToValueAtTime(value, time) { this.changes.push({ kind: 'ramp', value, time }); },
    cancelScheduledValues() {}, setTargetAtTime() {}
  });
  const source = () => ({
    starts: [], offsets: [], stops: [], disconnected: false, connections: [],
    connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; },
    start(time, offset = 0) { this.starts.push(time); this.offsets.push(offset); }, stop(time) { this.stops.push(time); }
  });
  const context = {
    currentTime: 10, destination: {}, resumeCalls: 0, sampleRate: 44100,
    async resume() { this.resumeCalls++; },
    createOscillator() {
      const node = { ...source(), frequency: parameter(), setPeriodicWave(wave) { this.type = 'custom'; this.wave = wave; } };
      node.frequency.setValueAtTime = (value, time) => { node.pitch ??= value; node.frequency.changes.push({ kind: 'set', value, time }); };
      nodes.push(node); return node;
    },
    createBuffer(channels, length, sampleRate) {
      const samples = new Float32Array(length);
      return { duration: length / sampleRate, sampleRate, getChannelData() { return samples; } };
    },
    createBufferSource() { const node = { ...source(), kind: 'noise' }; nodes.push(node); return node; },
    createPeriodicWave(real, imaginary) { return { real, imaginary }; },
    createBiquadFilter() { return { ...source(), frequency: parameter(), Q: parameter() }; },
    createGain() { return { ...source(), gain: parameter() }; },
    createWaveShaper() { return source(); },
    createDynamicsCompressor() {
      return { ...source(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() };
    }
  };
  const sound = new Sound(); sound.context = context;
  return { sound, context, nodes };
}

function playing(level = luna) {
  const game = new Game(() => .5, level); game.start();
  game.step(3, idle);
  return game;
}

test('start jingle is audible by default and completes during the three-second start delay', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  assert.equal(sound.enabled, true); assert.equal(context.resumeCalls, 1);
  assert.ok(nodes.length > 20, 'compact arrangement retains the layered accompaniment');
  assert.equal(nodes.filter(node => node.starts[0] === context.currentTime).length, 4, 'all four musical parts enter together');
  const melody = nodes.slice(0, START_JINGLE.channels[0].notes.length);
  assert.ok(melody.at(-1).pitch > melody[0].pitch, 'melody resolves above the opening note');
  assert.ok(nodes.some(node => node.kind === 'noise'), 'percussion includes clocked noise');
  assert.equal(nodes[0].starts[0], context.currentTime);
  assert.ok(nodes.every(node => node.starts[0] >= context.currentTime && node.stops[0] < context.currentTime + 3));
  const end = Math.max(...nodes.map(node => node.stops[0])) - context.currentTime;
  assert.ok(end > 1.3 && end < 1.55, 'shortened phrase includes its final cadence');
});

test('pausing cancels scheduled notes and resuming plays only the remaining melody', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  const original = [...nodes]; sound.stopJingle();
  assert.ok(original.every(node => node.stops.length === 2 && node.stops[1] === undefined));
  sound.startJingle(1.4);
  const resumed = nodes.slice(original.length);
  const pending = original.filter(node => node.stops[0] - (node.kind === 'noise' ? 0 : .002) > context.currentTime + 1.4);
  assert.equal(resumed.length, pending.length, 'completed notes and drum hits are skipped across every part');
  assert.equal(resumed[0].starts[0], context.currentTime, 'interrupted note resumes immediately');
  resumed.forEach((node, i) => assert.ok(Math.abs(node.starts[0] - context.currentTime - Math.max(0, pending[i].starts[0] - context.currentTime - 1.4)) < 1e-9, 'parts retain their relative timing'));
  assert.ok(resumed.every(node => node.stops[0] < context.currentTime + 1.6));
});

test('resuming after the shorter intro finishes leaves the rest of the countdown silent', () => {
  const { sound, nodes } = audio();
  sound.startJingle(1.6);
  assert.equal(nodes.length, 0, 'finished music is not restarted during the countdown');
});

test('resuming during percussion continues from inside its original noise buffer', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  const hit = nodes.find(node => node.kind === 'noise');
  const offset = (hit.stops[0] - hit.starts[0]) / 2;
  const elapsed = hit.starts[0] - context.currentTime + offset;
  const count = nodes.length;
  sound.stopJingle(); sound.startJingle(elapsed);
  const resumed = nodes.slice(count).find(node => node.kind === 'noise');
  assert.equal(resumed.buffer, hit.buffer);
  assert.equal(resumed.starts[0], context.currentTime);
  assert.ok(Math.abs(resumed.offsets[0] - offset) < 1e-9, 'resume skips the completed portion of the drum hit');
});

test('muting cancels the jingle and suppresses start and replay audio', () => {
  const { sound, context, nodes } = audio(); sound.startJingle();
  const count = nodes.length;
  assert.equal(sound.toggle(), false);
  assert.ok(nodes.every(node => node.stops.length === 2));
  sound.startJingle(); sound.startJingle(1);
  assert.equal(nodes.length, count); assert.equal(context.resumeCalls, 1);
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

test('up and sideways thrust use independent high sci-fi warbles that can overlap', () => {
  const { sound, nodes } = audio(), game = playing();
  sound.update(game, { ...idle, up: true });
  assert.equal(nodes.length, 2, 'one smooth carrier and one pitch modulator');
  const upward = [...nodes];
  assert.equal(upward[0].type, 'sine'); assert.equal(upward[1].type, 'sine'); assert.equal(upward[1].pitch, 6.5);
  const depth = upward[1].connections[0];
  assert.equal(depth.connections[0], upward[0].frequency, 'wobble modulates pitch instead of generating a buzzy pulse');
  assert.equal(depth.gain.changes[0].value, 110, 'wide vibrato gives the classic saucer warble');
  assert.equal(upward[0].pitch, sidFrequency(540));
  assert.ok(upward[0].frequency.changes.some(change => change.kind === 'linear' && change.value === sidFrequency(760)), 'takeoff glides up to a high whistle');
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

test('major victory and minor loss arrangements follow structured end reasons', () => {
  const win = audio(), winner = playing(); winner.finish('delivered'); win.sound.play(winner.events.at(-1));
  const victoryMelody = win.nodes.slice(0, WIN_JINGLE.channels[0].notes.length);
  assert.ok(victoryMelody.at(-1).pitch > victoryMelody[0].pitch, 'victory melody resolves upward');
  for (const reason of ['tips', 'lives']) {
    const loss = audio(), loser = playing(); loser.finish(reason);
    loss.sound.play({ ...loser.events.at(-1), message: 'All orders delivered!' });
    const melody = loss.nodes.slice(0, LOSE_JINGLE.channels[0].notes.length);
    assert.ok(melody.at(-1).pitch < melody[0].pitch, 'loss melody settles an octave lower');
    assert.ok(melody.every(node => node.type === 'sawtooth'), 'loss uses the darker lead voice');
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
  assert.ok(rumble.frequency.changes.some(change => change.kind === 'set' && change.value < rumble.pitch));
  game.step(1.49, idle); assert.equal(game.phase, 'crashed'); assert.equal(game.events.some(event => event.type === 'gameover'), false);
  game.step(.01, idle); const end = game.events.at(-1);
  assert.equal(end.endReason, 'lives'); sound.play(end);
  assert.ok(nodes.length > 6, 'loss jingle starts after explosion');
});

test('arrival chimes separately from pickup and muting cancels all layers and queued effects', () => {
  const { sound, nodes } = audio(), game = playing();
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  assert.equal(nodes.length, 4); assert.ok(nodes[2].pitch > nodes[0].pitch);
  sound.play({ type: 'pickup', message: '', x: 0, y: 0 }); assert.equal(nodes.length, 6);
  sound.update(game, { ...idle, up: true, left: true });
  assert.equal(sound.toggle(), false);
  assert.ok(nodes.slice(0, 6).every(node => node.stops.length === 2));
  assert.ok(nodes.slice(6).every(node => node.stops.length === 1));
  const count = nodes.length;
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  sound.play({ type: 'gameover', endReason: 'delivered', message: '', x: 0, y: 0 });
  sound.update(game, { ...idle, up: true, left: true });
  assert.equal(nodes.length, count);
});

test('arrival and pickup synthesize the requested phrases with the configured dispatch voice', () => {
  const { sound, nodes, context } = audio();
  const voice = { speed: 64, pitch: 94, throat: 158, mouth: 185 };
  const sam = new SamJs(voice);
  assert.deepEqual(DISPATCH_VOICE, voice);
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  const arrival = nodes.at(-1);
  assert.equal(arrival.buffer.sampleRate, 22050);
  assert.deepEqual(arrival.buffer.getChannelData(0), sam.buf32('Order Up!'));
  assert.equal(arrival.starts[0], context.currentTime);
  for (let pad = 1; pad <= 5; pad++) {
    sound.play({ type: 'pickup', targetPad: pad, message: 'Unrelated display text', x: 0, y: 0 });
    const pickup = nodes.at(-1);
    assert.deepEqual(pickup.buffer.getChannelData(0), sam.buf32(`Pad ${pad} please`));
    assert.ok(pickup.buffer.getChannelData(0).some(sample => sample !== 0));
    assert.ok(Math.abs(pickup.stops[0] - pickup.starts[0] - pickup.buffer.duration) < 1e-9);
  }
  const speech = nodes.filter(node => node.buffer);
  speech.slice(1).forEach((node, i) => assert.equal(node.starts[0], speech[i].stops[0], 'announcements queue without overlapping'));
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  assert.equal(nodes.at(-1).buffer, arrival.buffer, 'repeated phrases reuse synthesized audio');
});

test('speech uses configured phrases and substitutes every pickup # with the destination pad', t => {
  const original = { ...SPEECH_CONFIG };
  t.after(() => Object.assign(SPEECH_CONFIG, original));
  Object.assign(SPEECH_CONFIG, { arrival: 'Food ready!', pickup: 'Go to #. Pad # please!', delivery: 'Thank you!' });
  const { sound } = audio(), spoken = [];
  t.mock.method(sound, 'speak', (text) => spoken.push(text));
  for (const type of ['arrival', 'pickup', 'delivery']) sound.play({ type, targetPad: 12, message: '', x: 0, y: 0 });
  assert.deepEqual(spoken, ['Food ready!', 'Go to 12. Pad 12 please!', 'Thank you!']);
  SPEECH_CONFIG.pickup = 'Enjoy the ride!';
  sound.play({ type: 'pickup', targetPad: 3, message: '', x: 0, y: 0 });
  assert.equal(spoken.at(-1), 'Enjoy the ride!', 'the placeholder is optional');
});

test('delivery randomly selects each of the other demo voices for Thanks!', t => {
  const voices = [
    { speed: 72, pitch: 64, throat: 128, mouth: 128 },
    { speed: 72, pitch: 64, throat: 110, mouth: 160 },
    { speed: 92, pitch: 60, throat: 190, mouth: 190 },
    { speed: 82, pitch: 32, throat: 145, mouth: 145 },
    { speed: 100, pitch: 64, throat: 150, mouth: 200 }
  ];
  assert.deepEqual(THANKS_VOICES, voices);
  let random = 0;
  t.mock.method(Math, 'random', () => random);
  const { sound, nodes } = audio();
  voices.forEach((voice, i) => {
    random = (i + .5) / voices.length;
    sound.play({ type: 'delivery', message: '', x: 0, y: 0 });
    assert.deepEqual(nodes.at(-1).buffer.getChannelData(0), new SamJs(voice).buf32('Thanks!'));
  });
});

test('mute, pause, and restart cancel playing and queued speech and reset its schedule', () => {
  for (const stop of [sound => sound.toggle(), sound => sound.stopAll(), sound => sound.startJingle()]) {
    const { sound, nodes, context } = audio();
    sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
    sound.play({ type: 'pickup', targetPad: 3, message: '', x: 0, y: 0 });
    const speech = nodes.filter(node => node.buffer);
    stop(sound);
    assert.ok(speech.every(node => node.stops.at(-1) === undefined));
    if (!sound.enabled) {
      const count = nodes.length;
      sound.play({ type: 'delivery', message: '', x: 0, y: 0 });
      assert.equal(nodes.length, count, 'muted speech does not create any nodes');
      sound.enabled = true;
    }
    sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
    assert.equal(nodes.at(-1).starts[0], context.currentTime, 'canceled queue leaves no silent wait');
    const latest = nodes.at(-1); latest.onended(); sound.stopAll();
    assert.ok(latest.disconnected);
    assert.equal(latest.stops.length, 1, 'finished speech releases its source');
  }
});

test('final Thanks finishes before victory music and survives automatic level advancement', () => {
  const win = audio();
  win.sound.play({ type: 'delivery', message: '', x: 0, y: 0 });
  const thanks = win.nodes.at(-1), end = thanks.stops[0];
  const count = win.nodes.length;
  win.sound.play({ type: 'gameover', endReason: 'delivered', message: '', x: 0, y: 0 });
  assert.equal(thanks.stops.length, 1);
  const music = win.nodes.slice(count);
  assert.equal(Math.min(...music.map(node => node.starts[0])), end, 'victory music follows speech');
  assert.ok(music.every(node => node.starts[0] >= end), 'bass, arpeggios, and drums also wait for speech');
  win.sound.stopAll(true); win.sound.startJingle(0, true);
  assert.equal(thanks.stops.length, 1, 'next-level startup preserves the final delivery speech');
  win.sound.stopAll();
  assert.equal(thanks.stops.length, 2, 'pause still cancels speech during the new countdown');

  const loss = audio();
  loss.sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  const announcement = loss.nodes.at(-1);
  loss.sound.play({ type: 'gameover', endReason: 'tips', message: '', x: 0, y: 0 });
  assert.equal(announcement.stops.length, 2, 'losing cancels outdated order announcements');
});

test('falling obstacle and boulder impacts reuse explosion audio without interrupting the flying ship', () => {
  const { sound, nodes } = audio(), game = playing();
  const controls = { ...idle, up: true, right: true };
  sound.update(game, controls);
  const thrust = [...nodes];
  for (const type of ['falling-obstacle-impact', 'boulder-impact']) sound.play({ type, message: '', x: 0, y: 0 });
  assert.ok(nodes.some(node => node.kind === 'noise' && node.buffer.getChannelData(0).some(sample => sample !== 0)));
  assert.ok(nodes.at(-1).frequency.changes.some(change => change.kind === 'set' && change.value < nodes.at(-1).pitch));
  assert.ok(thrust.every(node => node.stops.length === 0));
  const count = nodes.length; sound.update(game, controls);
  assert.equal(nodes.length, count, 'ship thrust voices continue without restarting');
});

test('overlapping effects share a bounded output stage with headroom for speech', () => {
  const { sound, nodes, context } = audio();
  for (let i = 0; i < 6; i++) sound.play({ type: 'boulder-impact', message: '', x: 0, y: 0 });
  sound.play({ type: 'arrival', message: '', x: 0, y: 0 });
  const speech = nodes.at(-1), effects = nodes.slice(0, -1);
  const outputs = effects.map(node => node.connections[0].connections[0].connections[0]);
  assert.ok(outputs.every(output => output === outputs[0]), 'all effects pass through the shared mixer');
  const saturation = outputs[0].connections[0];
  assert.equal(saturation.connections[0], context.destination);
  assert.equal(speech.connections[0].connections[0], context.destination, 'speech retains its original clarity');
  const limit = saturation.curve.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
  assert.ok(limit > .5 && limit < .6);
  assert.equal(saturation.curve[(saturation.curve.length - 1) / 2], 0, 'no DC offset');
  const speechPeak = speech.buffer.getChannelData(0).reduce((peak, value) => Math.max(peak, Math.abs(value)), 0) * .7;
  assert.ok(limit + speechPeak < 1, 'even a saturated effects mix leaves room for the announcement');
});

test('released saucer thrusters disconnect their modulation and filter nodes', () => {
  const { sound, nodes } = audio(), state = playing();
  sound.update(state, { ...idle, up: true });
  const [carrier, wobble] = nodes, [filter] = carrier.connections;
  const depth = wobble.connections[0], gain = filter.connections[0];
  sound.stopAll(); carrier.onended();
  assert.ok([carrier, wobble, filter, depth, gain].every(node => node.disconnected));
});


test('Zero G holding thrust is audible until the landing clamp engages', () => {
  const { sound, nodes } = audio(), game = playing(LEVELS.find(level => level.id === 'zero-g'));
  game.ship = game.spawnAtStation();
  const down = { ...idle, down: true };
  sound.update(game, down);
  assert.equal(nodes.length, 2);
  for (let i = 0; i < ZERO_G.clingDelay * 120; i++) game.step(1 / 120, down);
  sound.update(game, down);
  assert.ok(nodes.every(node => node.stops.length === 1));
});

test('lightning plays a distinct noise thunder cue that mute and pause can cancel', () => {
  const { sound, nodes } = audio();
  const game = playing(); sound.update(game, { ...idle, up: true });
  const thrust = [...nodes];
  sound.play({ type: 'lightning', message: '', x: 600, y: 748 });
  const thunder = nodes.at(-1);
  assert.equal(thunder.kind, 'noise');
  assert.ok(thunder.stops[0] - thunder.starts[0] > 1.5);
  assert.ok(thrust.every(n => n.stops.length === 0), 'thunder does not stop the thrusters');
  sound.stopAll(); assert.equal(thunder.stops.at(-1), undefined);
  sound.enabled = false; const count = nodes.length;
  sound.play({ type: 'lightning', message: '', x: 600, y: 748 }); assert.equal(nodes.length, count);
});

test('each electrical arc plays a short quiet zap and mute or pause cancels it', () => {
  const { sound, nodes } = audio();
  sound.play({ type: 'lightning-arc', message: '', x: 428, y: 560 });
  assert.equal(nodes.length, 1);
  const zap = nodes[0], gain = zap.connections[0].connections[0];
  assert.equal(zap.type, 'custom');
  assert.ok(zap.stops[0] - zap.starts[0] < .1);
  assert.ok(gain.gain.changes.some(change => change.value === .018));
  assert.ok(zap.frequency.changes.some(change => change.kind === 'set' && change.value === sidFrequency(320)));
  sound.stopAll(); assert.equal(zap.stops.at(-1), undefined);
  sound.enabled = false;
  sound.play({ type: 'lightning-arc', message: '', x: 428, y: 560 });
  assert.equal(nodes.length, 1);
});
