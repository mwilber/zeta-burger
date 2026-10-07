import { LANDING_BOUNCE } from './engine.js';
import type { Game, GameEvent, Controls } from './engine.js';
type SoundGroup = 'jingle' | 'effects' | 'landing';
type ThrustChannel = 'up' | 'side';
interface ThrustVoice { carrier: OscillatorNode; wobble: OscillatorNode; gain: GainNode }
const START_JINGLE = [
  { frequency: 523.25, delay: 0, duration: .18 },
  { frequency: 659.25, delay: .25, duration: .18 },
  { frequency: 783.99, delay: .5, duration: .18 },
  { frequency: 1046.5, delay: .75, duration: .35 },
  { frequency: 783.99, delay: 1.25, duration: .18 },
  { frequency: 880, delay: 1.5, duration: .18 },
  { frequency: 987.77, delay: 1.75, duration: .18 },
  { frequency: 1046.5, delay: 2, duration: .9 }
];
const WIN_JINGLE = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
const LOSE_JINGLE = [440, 349.23, 329.63, 261.63, 220];
export class Sound {
  context: AudioContext | null = null;
  enabled = true;
  private sources: Record<SoundGroup, Set<AudioScheduledSourceNode>> = { jingle: new Set(), effects: new Set(), landing: new Set() };
  private thrustVoices = new Map<ThrustChannel, ThrustVoice>();
  private landingCueActive = false;
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); this.tone(440, .08, 'sine'); }
    else this.stopAll();
    return this.enabled;
  }
  startJingle(elapsed = 0) {
    this.stopAll();
    if (!this.enabled) return;
    // Called from Start/Resume gestures so the browser can unlock audio.
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
    for (const note of START_JINGLE) {
      const remaining = note.duration - Math.max(0, elapsed - note.delay);
      if (remaining <= 0) continue;
      this.tone(note.frequency, remaining, 'triangle', Math.max(0, note.delay - elapsed), .08, 'jingle');
    }
  }
  stopJingle() {
    this.stopGroup('jingle');
  }
  private stopGroup(group: SoundGroup) {
    for (const source of this.sources[group]) source.stop();
    this.sources[group].clear();
  }
  stopAll() {
    this.stopJingle(); this.stopGroup('effects'); this.stopGroup('landing');
    this.stopThrust('up', true); this.stopThrust('side', true); this.landingCueActive = false;
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], group: SoundGroup) {
    this.sources[group].add(source);
    source.onended = () => { this.sources[group].delete(source); for (const node of nodes) node.disconnect(); };
  }
  tone(frequency: number, duration: number, type: OscillatorType = 'triangle', delay = 0, volume = .08, group: SoundGroup = 'effects') {
    if (!this.enabled || !this.context) return;
    const context = this.context, time = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(volume, time + Math.min(.008, duration / 2)); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + duration + .02);
    this.track(oscillator, [oscillator, gain], group);
    return oscillator;
  }
  private endJingle(won: boolean) {
    this.stopAll();
    const notes = won ? WIN_JINGLE : LOSE_JINGLE;
    const beat = won ? .18 : .36;
    notes.forEach((frequency, i) => {
      const final = i === notes.length - 1;
      this.tone(frequency, final ? .8 : beat * .85, 'triangle', i * beat, .075, 'jingle');
      // A major harmony celebrates a win; a descending minor phrase marks a loss.
      if (final) this.tone(frequency * (won ? .5 : .75), .8, 'sine', i * beat, .04, 'jingle');
    });
  }
  private startThrust(channel: ThrustChannel) {
    if (!this.context || this.thrustVoices.has(channel)) return;
    const context = this.context, now = context.currentTime;
    const carrier = context.createOscillator(), wobble = context.createOscillator();
    const depth = context.createGain(), gain = context.createGain();
    carrier.type = 'sine'; carrier.frequency.setValueAtTime(350, now);
    wobble.type = 'sine'; wobble.frequency.setValueAtTime(8.5, now);
    depth.gain.setValueAtTime(90, now);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.035, now + .035);
    wobble.connect(depth); depth.connect(carrier.frequency);
    carrier.connect(gain); gain.connect(context.destination);
    carrier.onended = () => { carrier.disconnect(); wobble.disconnect(); depth.disconnect(); gain.disconnect(); };
    carrier.start(now); wobble.start(now);
    this.thrustVoices.set(channel, { carrier, wobble, gain });
  }
  private stopThrust(channel: ThrustChannel, immediate = false) {
    const voice = this.thrustVoices.get(channel);
    if (!voice || !this.context) return;
    const now = this.context.currentTime, release = immediate ? .01 : .05;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(.0001, now, release / 3);
    voice.carrier.stop(now + release); voice.wobble.stop(now + release);
    this.thrustVoices.delete(channel);
  }
  private landingStutter(elapsed: number) {
    this.stopGroup('landing');
    const hop = LANDING_BOUNCE.duration / LANDING_BOUNCE.count;
    for (let i = 0; i < LANDING_BOUNCE.count; i++) {
      const start = i * hop, duration = hop * .5;
      const remaining = duration - Math.max(0, elapsed - start);
      if (remaining <= 0) continue;
      this.tone(110 - i * 12, remaining, 'sawtooth', Math.max(0, start - elapsed), .08 * (1 - i / (LANDING_BOUNCE.count + 1)), 'landing');
    }
  }
  update(game: Game, controls: Controls) {
    const running = this.enabled && this.context !== null && game.phase === 'playing';
    const powered = running && game.fuel > 0;
    if (powered && controls.up) this.startThrust('up'); else this.stopThrust('up');
    if (powered && !game.ship.gear && controls.left !== controls.right) this.startThrust('side'); else this.stopThrust('side');
    if (running && game.ship.landed !== null && game.landingBounceTime > 0) {
      if (!this.landingCueActive) this.landingStutter(LANDING_BOUNCE.duration - game.landingBounceTime);
      this.landingCueActive = true;
    } else {
      this.stopGroup('landing'); this.landingCueActive = false;
    }
  }
  private crash() {
    if (!this.enabled || !this.context) return;
    this.stopThrust('up'); this.stopThrust('side'); this.stopGroup('landing'); this.landingCueActive = false;
    const context = this.context, now = context.currentTime;
    // Filtered noise makes the impact burst, with a falling rumble beneath it.
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .8), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    noise.buffer = buffer; filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now); filter.frequency.exponentialRampToValueAtTime(120, now + .8);
    gain.gain.setValueAtTime(.18, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .8);
    noise.connect(filter); filter.connect(gain); gain.connect(context.destination);
    noise.start(now); noise.stop(now + .8); this.track(noise, [noise, filter, gain], 'effects');
    const rumble = this.tone(160, 1.1, 'sawtooth', 0, .09);
    rumble?.frequency.exponentialRampToValueAtTime(30, now + 1.1);
  }
  play(event: GameEvent) {
    if (event.type === 'gameover') { this.endJingle(event.endReason === 'delivered'); return; }
    if (event.type === 'crash') this.crash();
    if (event.type === 'land' && event.hardLanding) { this.stopGroup('landing'); this.landingCueActive = false; }
    if (event.type === 'land' && !event.hardLanding) this.tone(220, .12);
    if (event.type === 'arrival') [659.25, 880, 1318.51].forEach((frequency, i) => this.tone(frequency, .14, 'sine', i * .16, .075));
    if (event.type === 'gear') this.tone(150, .06, 'square');
    if (event.type === 'pickup') { this.tone(440, .13); this.tone(660, .16, 'triangle', .12); }
    if (event.type === 'delivery') [523, 659, 784, 1047].forEach((note, i) => this.tone(note, .19, 'triangle', i * .09));
  }
}
