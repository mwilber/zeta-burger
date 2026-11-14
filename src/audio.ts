import { LANDING_BOUNCE, verticalThrustDirection } from './engine.js';
import type { Game, GameEvent, Controls } from './engine.js';
import { SPEECH_CONFIG } from './level-config.js';
import { DISPATCH_VOICE, THANKS_VOICES, SPEECH_SAMPLE_RATE, synthesizeSpeech } from './speech.js';
import type { SamVoice } from './vendor/sam-js.js';
import { sidEnvelope, sidFrequency, sidNoise, sidPitch, sidWaveform } from './sid.js';
import type { SidPatch, SidWaveform } from './sid.js';
type SoundGroup = 'jingle' | 'effects' | 'landing' | 'speech';
type ThrustChannel = 'vertical' | 'side';
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
  private sources: Record<SoundGroup, Set<AudioScheduledSourceNode>> = { jingle: new Set(), effects: new Set(), landing: new Set(), speech: new Set() };
  private speechBuffers = new Map<string, AudioBuffer>();
  private noiseBuffers = new Map<string, AudioBuffer>();
  private effectsBus: DynamicsCompressorNode | null = null;
  private speechUntil = 0;
  private thrustVoices = new Map<ThrustChannel, ThrustVoice>();
  private landingCueActive = false;
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); this.tone(440, .08); }
    else this.stopAll();
    return this.enabled;
  }
  startJingle(elapsed = 0, keepSpeech = false) {
    this.stopAll(keepSpeech);
    if (!this.enabled) return;
    // Called from Start/Resume gestures so the browser can unlock audio.
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
    for (const note of START_JINGLE) {
      const remaining = note.duration - Math.max(0, elapsed - note.delay);
      if (remaining <= 0) continue;
      this.tone(note.frequency, remaining, 'pulse', Math.max(0, note.delay - elapsed), .065, 'jingle', { pulseWidth: .25, sustain: .55 });
    }
  }
  stopJingle() {
    this.stopGroup('jingle');
  }
  private stopGroup(group: SoundGroup) {
    for (const source of this.sources[group]) source.stop();
    this.sources[group].clear();
  }
  stopAll(keepSpeech = false) {
    this.stopJingle(); this.stopGroup('effects'); this.stopGroup('landing');
    if (!keepSpeech) { this.stopGroup('speech'); this.speechUntil = 0; }
    this.stopThrust('vertical', true); this.stopThrust('side', true); this.landingCueActive = false;
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], group: SoundGroup) {
    this.sources[group].add(source);
    source.onended = () => { this.sources[group].delete(source); for (const node of nodes) node.disconnect(); };
  }
  private output(): DynamicsCompressorNode {
    if (!this.effectsBus) {
      const context = this.context!, bus = context.createDynamicsCompressor();
      bus.threshold.value = -12; bus.knee.value = 6; bus.ratio.value = 4;
      bus.attack.value = .003; bus.release.value = .12;
      // Warm the mix and catch impact transients before they clip alongside
      // speech. The compressor alone can let its initial attack overshoot.
      const saturation = context.createWaveShaper(), curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const input = i * 2 / (curve.length - 1) - 1;
        curve[i] = .6 * Math.tanh(input / .6);
      }
      saturation.curve = curve;
      bus.connect(saturation); saturation.connect(context.destination); this.effectsBus = bus;
    }
    return this.effectsBus;
  }
  tone(frequency: number, duration: number, type: SidWaveform = 'pulse', delay = 0, volume = .065, group: SoundGroup = 'effects', patch: SidPatch = {}) {
    if (!this.enabled || !this.context) return;
    const context = this.context, time = context.currentTime + delay;
    const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    sidWaveform(context, oscillator, type, patch.pulseWidth);
    if (patch.endFrequency !== undefined) sidPitch(oscillator.frequency, frequency, patch.endFrequency, time, duration);
    else oscillator.frequency.setValueAtTime(sidFrequency(frequency), time);
    filter.type = 'lowpass'; filter.Q.value = .85;
    filter.frequency.setValueAtTime(patch.cutoff ?? 4200, time);
    sidEnvelope(gain.gain, volume, time, duration, patch.sustain);
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.output());
    oscillator.start(time); oscillator.stop(time + duration + .002);
    this.track(oscillator, [oscillator, filter, gain], group);
    return oscillator;
  }
  private endJingle(won: boolean) {
    // The final delivery's "Thanks!" must finish even when the shift ends.
    this.stopAll(won);
    const delay = won && this.context ? Math.max(0, this.speechUntil - this.context.currentTime) : 0;
    const notes = won ? WIN_JINGLE : LOSE_JINGLE;
    const beat = won ? .18 : .36;
    notes.forEach((frequency, i) => {
      const final = i === notes.length - 1;
      this.tone(frequency, final ? .8 : beat * .85, won ? 'pulse' : 'sawtooth', delay + i * beat, .065, 'jingle', { pulseWidth: .125, cutoff: won ? 4200 : 1800 });
      // A major harmony celebrates a win; a descending minor phrase marks a loss.
      if (final) this.tone(frequency * (won ? .5 : .75), .8, 'triangle', delay + i * beat, .04, 'jingle');
    });
  }
  private startThrust(channel: ThrustChannel) {
    if (!this.context || this.thrustVoices.has(channel)) return;
    const context = this.context, now = context.currentTime;
    const carrier = context.createOscillator(), wobble = context.createOscillator();
    const depth = context.createGain(), gain = context.createGain(), filter = context.createBiquadFilter();
    // A high, pure whistle with a short takeoff glide and smooth vibrato gives
    // the saucer a 1950s sci-fi warble without the pulse wave's engine buzz.
    carrier.type = 'sine'; carrier.frequency.setValueAtTime(sidFrequency(540), now);
    carrier.frequency.linearRampToValueAtTime(sidFrequency(760), now + .12);
    wobble.type = 'sine'; wobble.frequency.setValueAtTime(6.5, now);
    depth.gain.setValueAtTime(110, now);
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(1800, now); filter.Q.value = .7;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.035, now + .035);
    wobble.connect(depth); depth.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain); gain.connect(this.output());
    carrier.onended = () => { for (const node of [carrier, wobble, depth, filter, gain]) node.disconnect(); };
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
      this.tone(110 - i * 12, remaining, 'pulse', Math.max(0, start - elapsed), .065 * (1 - i / (LANDING_BOUNCE.count + 1)), 'landing', { pulseWidth: .125, cutoff: 1600, endFrequency: 55 - i * 5 });
    }
  }
  update(game: Game, controls: Controls) {
    const running = this.enabled && this.context !== null && game.phase === 'playing';
    const powered = running && game.fuel > 0;
    const vertical = verticalThrustDirection(controls);
    if (powered && vertical !== 0 && (vertical > 0 || game.ship.landed === null || game.needsLandingThrust)) this.startThrust('vertical'); else this.stopThrust('vertical');
    if (powered && !game.ship.gear && Number(controls.left) !== Number(controls.right)) this.startThrust('side'); else this.stopThrust('side');
    if (running && game.ship.landed !== null && game.landingBounceTime > 0) {
      if (!this.landingCueActive) this.landingStutter(LANDING_BOUNCE.duration - game.landingBounceTime);
      this.landingCueActive = true;
    } else {
      this.stopGroup('landing'); this.landingCueActive = false;
    }
  }
  private crash(stopShip = true) {
    if (!this.enabled || !this.context) return;
    if (stopShip) { this.stopThrust('vertical'); this.stopThrust('side'); this.stopGroup('landing'); this.landingCueActive = false; }
    this.noiseBurst(.8, 14000, 450, .18, 3600, 180);
    this.tone(164, 1.1, 'pulse', 0, .07, 'effects', { pulseWidth: .125, cutoff: 1100, sustain: .2, endFrequency: 32 });
  }
  private noiseBurst(duration: number, fromClock: number, toClock: number, volume: number, fromCutoff: number, toCutoff: number) {
    if (!this.enabled || !this.context) return;
    const context = this.context, now = context.currentTime;
    const key = `${context.sampleRate}:${duration}:${fromClock}:${toClock}`;
    let buffer = this.noiseBuffers.get(key);
    if (!buffer) {
      const samples = sidNoise(context.sampleRate, duration, fromClock, toClock);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples); this.noiseBuffers.set(key, buffer);
    }
    const noise = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    noise.buffer = buffer; filter.type = 'lowpass'; filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(fromCutoff, now); filter.frequency.exponentialRampToValueAtTime(toCutoff, now + duration);
    sidEnvelope(gain.gain, volume, now, duration, .2);
    noise.connect(filter); filter.connect(gain); gain.connect(this.output());
    noise.start(now); noise.stop(now + duration); this.track(noise, [noise, filter, gain], 'effects');
  }
  private speak(text: string, voice: SamVoice) {
    if (!this.enabled || !this.context) return;
    const context = this.context, key = `${JSON.stringify(voice)}:${text}`;
    let buffer = this.speechBuffers.get(key);
    if (!buffer) {
      const samples = synthesizeSpeech(text, voice);
      if (!samples || !samples.length) return;
      buffer = context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      this.speechBuffers.set(key, buffer);
    }
    const source = context.createBufferSource(), gain = context.createGain();
    const start = Math.max(context.currentTime, this.speechUntil);
    this.speechUntil = start + buffer.duration;
    source.buffer = buffer; gain.gain.setValueAtTime(.7, start);
    source.connect(gain); gain.connect(context.destination);
    source.start(start); source.stop(this.speechUntil);
    this.track(source, [source, gain], 'speech');
  }
  play(event: GameEvent) {
    if (event.type === 'gameover') { this.endJingle(event.endReason === 'delivered'); return; }
    if (event.type === 'crash') this.crash();
    if (event.type === 'lightning') this.noiseBurst(1.7, 10500, 180, .25, 2200, 100);
    if (event.type === 'lightning-arc') {
      this.tone(1800, .055, 'pulse', 0, .018, 'effects', { pulseWidth: .125, endFrequency: 320 });
    }
    if (event.type === 'falling-obstacle-impact' || event.type === 'boulder-impact') this.crash(false);
    if (event.type === 'land' && event.hardLanding) { this.stopGroup('landing'); this.landingCueActive = false; }
    if (event.type === 'land' && !event.hardLanding) this.tone(220, .12, 'triangle', 0, .08, 'effects', { cutoff: 1200, endFrequency: 110 });
    if (event.type === 'arrival') {
      [659.25, 880, 1318.51].forEach((frequency, i) => this.tone(frequency, .14, 'pulse', i * .16, .06, 'effects', { pulseWidth: .125 }));
      this.speak(SPEECH_CONFIG.arrival, DISPATCH_VOICE);
    }
    if (event.type === 'gear') this.tone(300, .06, 'pulse', 0, .05, 'effects', { pulseWidth: .125, cutoff: 2200, endFrequency: 100 });
    if (event.type === 'pickup') {
      this.tone(440, .13); this.tone(660, .16, 'pulse', .12);
      if (event.targetPad !== undefined) this.speak(SPEECH_CONFIG.pickup.replaceAll('#', String(event.targetPad)), DISPATCH_VOICE);
    }
    if (event.type === 'delivery') {
      [523, 659, 784, 1047].forEach((note, i) => this.tone(note, .19, 'pulse', i * .09, .06, 'effects', { pulseWidth: .25 }));
      this.speak(SPEECH_CONFIG.delivery, THANKS_VOICES[Math.floor(Math.random() * THANKS_VOICES.length)]);
    }
  }
}
