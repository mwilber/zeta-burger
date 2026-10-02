import type { GameEvent } from './engine.js';
export class Sound {
  context: AudioContext | null = null;
  enabled = false;
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) { this.context ??= new AudioContext(); void this.context.resume(); this.tone(440, .08, 'sine'); }
    return this.enabled;
  }
  tone(frequency: number, duration: number, type: OscillatorType = 'triangle', delay = 0) {
    if (!this.enabled || !this.context) return;
    const context = this.context, time = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.08, time + .008); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  play(event: GameEvent) {
    if (event.type === 'crash') { this.tone(80, .4, 'sawtooth'); this.tone(47, .6, 'triangle', .08); }
    if (event.type === 'land') this.tone(220, .12);
    if (event.type === 'gear') this.tone(150, .06, 'square');
    if (event.type === 'pickup') { this.tone(440, .13); this.tone(660, .16, 'triangle', .12); }
    if (event.type === 'delivery') [523, 659, 784, 1047].forEach((note, i) => this.tone(note, .19, 'triangle', i * .09));
  }
}
