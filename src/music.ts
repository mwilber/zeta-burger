import type { SidPatch, SidWaveform } from './sid.js';

interface Note { beat: number; length: number; midi: number }
interface TonalChannel {
  instrument: 'lead' | 'arpeggio' | 'bass';
  waveform: SidWaveform;
  volume: number;
  patch: SidPatch;
  notes: readonly Note[];
}
interface DrumHit { beat: number; length: number; kind: 'kick' | 'snare' | 'hat' }
interface DrumChannel { instrument: 'drums'; volume: number; hits: readonly DrumHit[] }
export interface JingleScore {
  beatSeconds: number;
  // Three monophonic synth parts plus an extra percussion channel. A real
  // SID has three voices; the fourth part is our C64-inspired extension.
  channels: readonly [TonalChannel, TonalChannel, TonalChannel, DrumChannel];
}

const phrase = (notes: readonly (readonly [number, number, number])[]): Note[] =>
  notes.map(([beat, length, midi]) => ({ beat, length, midi }));

function arpeggios(chords: readonly (readonly [number, number, readonly number[]])[]): Note[] {
  return chords.flatMap(([start, end, pitches]) => {
    const notes: Note[] = [];
    for (let beat = start, step = 0; beat < end; beat += .25, step++) {
      notes.push({ beat, length: .19, midi: pitches[step % pitches.length] });
    }
    return notes;
  });
}

function backbeat(beats: number): DrumHit[] {
  return Array.from({ length: beats * 2 }, (_, step) => ({
    beat: step / 2,
    length: step % 2 ? .12 : .24,
    kind: step % 2 ? 'hat' : step % 4 ? 'snare' : 'kick'
  }));
}

function score(tempo: number, lead: Note[], arpeggio: Note[], bass: Note[], hits: DrumHit[], minor = false): JingleScore {
  return {
    beatSeconds: 60 / tempo,
    channels: [
      { instrument: 'lead', waveform: minor ? 'sawtooth' : 'pulse', volume: .052,
        patch: { pulseWidth: .25, cutoff: minor ? 2200 : 3800, sustain: .55 }, notes: lead },
      { instrument: 'arpeggio', waveform: 'pulse', volume: .025,
        patch: { pulseWidth: .125, cutoff: minor ? 2400 : 3200, sustain: .35 }, notes: arpeggio },
      { instrument: 'bass', waveform: 'triangle', volume: .075,
        patch: { cutoff: 1000, sustain: .65 }, notes: bass },
      { instrument: 'drums', volume: minor ? .65 : 1, hits }
    ]
  };
}

export const START_JINGLE = score(168,
  phrase([
    [0, .44, 72], [.5, .2, 76], [.75, .2, 79], [1, .44, 83], [1.5, .2, 81], [1.75, .2, 79],
    [2, .44, 76], [2.5, .2, 79], [2.75, .2, 81], [3, .44, 84], [3.5, .2, 83], [3.75, .2, 81],
    [4, .44, 86], [4.5, .2, 84], [4.75, .2, 81], [5, .44, 83], [5.5, .44, 79],
    [6, .44, 88], [6.5, .2, 86], [6.75, .2, 79], [7, 1.15, 84]
  ]),
  // Cmaj7 – Am7 – Dm7 – G7 – Cadd9: a short turnaround into flight.
  arpeggios([[0, 2, [60, 67, 71, 64]], [2, 4, [57, 64, 67, 60]],
    [4, 5, [62, 69, 72, 65]], [5, 6, [59, 65, 67, 62]], [6, 8, [60, 67, 74, 64]]]),
  phrase([[0, .7, 48], [1, .4, 43], [1.5, .4, 47], [2, .7, 45], [3, .4, 52], [3.5, .4, 48],
    [4, .7, 50], [5, .7, 43], [6, .7, 48], [7, 1.15, 36]]),
  backbeat(8)
);

export const WIN_JINGLE = score(184,
  phrase([
    [0, .44, 79], [.5, .44, 84], [1, .44, 88], [1.5, .2, 86], [1.75, .2, 84],
    [2, .44, 81], [2.5, .2, 84], [2.75, .2, 88], [3, .44, 89], [3.5, .44, 88],
    [4, .44, 86], [4.5, .44, 83], [5, .2, 79], [5.25, .2, 81], [5.5, .2, 83], [5.75, .2, 86],
    [6, .2, 84], [6.25, .2, 88], [6.5, .44, 91], [7, 1.25, 84]
  ]),
  // C6 – Fmaj7 – Dm7 – G7 – C6, with a rising dominant pickup.
  arpeggios([[0, 2, [60, 67, 69, 64]], [2, 4, [60, 65, 69, 76]],
    [4, 5, [62, 69, 72, 65]], [5, 6, [59, 62, 65, 67]], [6, 8, [60, 64, 67, 69]]]),
  phrase([[0, .7, 48], [1, .7, 55], [2, .7, 41], [3, .7, 48], [4, .7, 50], [5, .7, 43],
    [6, .7, 48], [7, 1.25, 36]]),
  backbeat(8)
);

export const LOSE_JINGLE = score(128,
  phrase([
    [0, .68, 69], [.75, .2, 67], [1, .44, 65], [1.5, .44, 64], [2, .44, 72], [2.5, .44, 71],
    [3, .68, 69], [3.75, .2, 67], [4, .44, 65], [4.5, .44, 64], [5, 1.1, 57]
  ]),
  // Am – Dm – E7 – Am: a slower minor answer to the opening theme.
  arpeggios([[0, 2, [57, 64, 69, 72]], [2, 3, [53, 57, 62, 65]],
    [3, 5, [56, 59, 62, 64]], [5, 6, [57, 60, 64, 69]]]),
  phrase([[0, .9, 45], [1, .75, 52], [2, .9, 50], [3, .9, 40], [4, .75, 47], [5, 1.1, 45]]),
  [{ beat: 0, length: .3, kind: 'kick' }, { beat: 1, length: .12, kind: 'hat' },
    { beat: 2, length: .24, kind: 'snare' }, { beat: 3, length: .12, kind: 'hat' },
    { beat: 4, length: .3, kind: 'kick' }, { beat: 4.5, length: .24, kind: 'snare' },
    { beat: 5, length: .3, kind: 'kick' }],
  true
);

export const midiFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
