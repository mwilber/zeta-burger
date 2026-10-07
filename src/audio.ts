import type { GameEvent } from './engine.js';
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
export class Sound {
  context: AudioContext | null = null;
  enabled = true;
  private jingleNotes = new Set<OscillatorNode>();
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) { this.context ??= new AudioContext(); void this.context.resume(); this.tone(440, .08, 'sine'); }
    else this.stopJingle();
    return this.enabled;
  }
  startJingle(elapsed = 0) {
    this.stopJingle();
    if (!this.enabled) return;
    // Called from Start/Resume gestures so the browser can unlock audio.
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
    for (const note of START_JINGLE) {
      const remaining = note.duration - Math.max(0, elapsed - note.delay);
      if (remaining <= 0) continue;
      const oscillator = this.tone(note.frequency, remaining, 'triangle', Math.max(0, note.delay - elapsed));
      if (oscillator) this.jingleNotes.add(oscillator);
    }
  }
  stopJingle() {
    for (const oscillator of this.jingleNotes) oscillator.stop();
    this.jingleNotes.clear();
  }
  tone(frequency: number, duration: number, type: OscillatorType = 'triangle', delay = 0) {
    if (!this.enabled || !this.context) return;
    const context = this.context, time = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.08, time + Math.min(.008, duration / 2)); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + duration + .02);
    oscillator.onended = () => { this.jingleNotes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    return oscillator;
  }
  play(event: GameEvent) {
    if (event.type === 'crash') { this.tone(80, .4, 'sawtooth'); this.tone(47, .6, 'triangle', .08); }
    if (event.type === 'land') this.tone(220, .12);
    if (event.type === 'gear') this.tone(150, .06, 'square');
    if (event.type === 'pickup') { this.tone(440, .13); this.tone(660, .16, 'triangle', .12); }
    if (event.type === 'delivery') [523, 659, 784, 1047].forEach((note, i) => this.tone(note, .19, 'triangle', i * .09));
  }
}
