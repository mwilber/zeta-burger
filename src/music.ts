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

export const START_JINGLE = score(140,
  phrase([
    [0, .44, 72], [.5, .44, 76], [1, .44, 79], [1.5, .44, 83], [2, .44, 86], [2.5, .85, 84]
  ]),
  // Cmaj7 – G7 – Cadd9: a compact turnaround with room for the cadence.
  arpeggios([[0, 1, [60, 67, 71, 64]], [1, 2, [59, 65, 67, 62]], [2, 3, [60, 67, 74, 64]]]),
  phrase([[0, .8, 48], [1, .8, 43], [2, .4, 48], [2.5, .85, 36]]),
  backbeat(3)
);

export const WIN_JINGLE = score(154,
  phrase([
    [0, .44, 79], [.5, .44, 84], [1, .44, 88], [1.5, .44, 86], [2, .44, 91], [2.5, .95, 84]
  ]),
  // C6 – G7 – C6: a brief major fanfare with a high pickup into the tonic.
  arpeggios([[0, 1, [60, 67, 69, 64]], [1, 2, [59, 62, 65, 67]], [2, 3, [60, 64, 67, 69]]]),
  phrase([[0, .8, 48], [1, .8, 43], [2, .4, 48], [2.5, .95, 36]]),
  backbeat(3)
);

export const LOSE_JINGLE = score(108,
  phrase([
    [0, .44, 69], [.5, .44, 67], [1, .44, 65], [1.5, .44, 64], [2, .6, 57]
  ]),
  // Am – E7 – Am: a slower minor answer, shortened to one descending phrase.
  arpeggios([[0, 1, [57, 64, 69, 72]], [1, 2, [56, 59, 62, 64]], [2, 2.5, [57, 60, 64, 69]]]),
  phrase([[0, .8, 45], [1, .8, 40], [2, .6, 45]]),
  [{ beat: 0, length: .3, kind: 'kick' }, { beat: .5, length: .12, kind: 'hat' },
    { beat: 1, length: .24, kind: 'snare' }, { beat: 1.5, length: .12, kind: 'hat' },
    { beat: 2, length: .3, kind: 'kick' }],
  true
);

export const midiFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
