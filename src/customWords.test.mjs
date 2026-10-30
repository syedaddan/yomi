import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createCustomWord } from './customWords.js';

const data = JSON.parse(readFileSync(new URL('../out/data.json', import.meta.url), 'utf8'));

const required = {
  id: 'custom:test',
  deck: 'hira',
  kana: 'きょうりゅう',
  meaning: 'dinosaur',
  theme: 'Nature',
  accent: '0',
  femaleAudioId: 'custom:test:female',
};

test('creates a normalized custom Hiragana word with a verified accent', () => {
  const word = createCustomWord({ ...required, sourceUrl: 'https://example.com/recording' });
  assert.equal(word.id, 'custom:test');
  assert.equal(word.deck, 'hira');
  assert.equal(word.kana, 'きょうりゅう');
  assert.equal(word.accent, 0);
  assert.equal(word.sourceUrl, 'https://example.com/recording');
  assert.equal(word.femaleAudioId, 'custom:test:female');
});

test('accepts Katakana and unknown pitch while requiring generated audio', () => {
  const word = createCustomWord({
    ...required,
    deck: 'kata',
    kana: 'コロナウイルス',
    accent: '',
    audioUrl: 'https://example.com/recording.mp3',
  });
  assert.equal(word.accent, null);
  assert.equal(word.humanAudioUrl, 'https://example.com/recording.mp3');
  assert.throws(() => createCustomWord({ ...required, femaleAudioId: '' }), /female VOICEVOX/);
});

test('rejects the wrong script, invalid accent, and insecure audio links', () => {
  assert.throws(() => createCustomWord({ ...required, deck: 'hira', kana: 'コロナウイルス' }), /Hiragana/);
  assert.throws(() => createCustomWord({ ...required, accent: '8' }), /Pitch accent/);
  assert.throws(() => createCustomWord({ ...required, sourceUrl: 'http://example.com' }), /HTTPS/);
});

test('ships female VOICEVOX references but no male VOICEVOX clips', () => {
  for (const rows of Object.values(data)) {
    for (const row of rows) {
      assert.equal(Object.hasOwn(row, 'tts'), false);
      assert.ok(row.ttsF, `${row.kana || row.theme} has female audio`);
    }
  }
  assert.equal(readdirSync(new URL('../out/audio/', import.meta.url)).some((name) => name.startsWith('tm_')), false);
});
