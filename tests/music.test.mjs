import test from 'node:test';
import assert from 'node:assert/strict';
import { START_JINGLE, WIN_JINGLE, LOSE_JINGLE, midiFrequency } from '../dist/src/music.js';
import { START_DELAY } from '../dist/src/engine.js';

test('each jingle has three monophonic synth parts and a fourth percussion part', () => {
  for (const score of [START_JINGLE, WIN_JINGLE, LOSE_JINGLE]) {
    assert.deepEqual(score.channels.map(channel => channel.instrument), ['lead', 'arpeggio', 'bass', 'drums']);
    for (const channel of score.channels) {
      const events = channel.instrument === 'drums' ? channel.hits : channel.notes;
      assert.ok(events.length >= 6, 'each musical part has a developed phrase');
      events.forEach((event, i) => {
        assert.ok(event.beat >= 0 && event.length > 0);
        if (i) assert.ok(events[i - 1].beat + events[i - 1].length <= event.beat, 'each part stays monophonic');
        assert.ok((event.beat + event.length) * score.beatSeconds + .002 < START_DELAY, 'arrangements finish within three seconds');
      });
    }
    const [lead, arpeggio, bass] = score.channels;
    assert.ok(Math.max(...bass.notes.map(note => note.midi)) < Math.min(...lead.notes.map(note => note.midi)), 'bass and lead occupy separate registers');
    assert.ok(arpeggio.notes.length >= 24, 'fast broken chords supply the harmony');
  }
});

test('intro and victory resolve to C major while loss resolves to A minor', () => {
  for (const score of [START_JINGLE, WIN_JINGLE]) {
    assert.equal(score.channels[0].notes.at(-1).midi % 12, 0);
    assert.equal(score.channels[2].notes.at(-1).midi % 12, 0);
  }
  assert.equal(LOSE_JINGLE.channels[0].notes.at(-1).midi % 12, 9);
  assert.equal(LOSE_JINGLE.channels[2].notes.at(-1).midi % 12, 9);
  assert.ok(LOSE_JINGLE.beatSeconds > WIN_JINGLE.beatSeconds, 'loss has a more reflective tempo');
  assert.equal(midiFrequency(69), 440);
});
