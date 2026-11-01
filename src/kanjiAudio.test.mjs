import test from 'node:test';
import assert from 'node:assert/strict';
import { getKanjiAudioControls } from './kanjiAudio.js';

test('prefers natural recordings and keeps synthesized audio as an alternate', () => {
  assert.deepEqual(
    getKanjiAudioControls({ audio: 'audio/natural.mp3', ttsF: { file: 'audio/kanji_voice.mp3', o: 0, l: 12 } }),
    {
      primaryVoice: 'recording',
      hasSyntheticAlternate: true,
      showSyntheticInfo: true,
    },
  );
});

test('uses synthesized audio when no natural recording is available', () => {
  assert.deepEqual(
    getKanjiAudioControls({ ttsF: { file: 'audio/kanji_voice.mp3', o: 0, l: 12 } }),
    {
      primaryVoice: 'female',
      hasSyntheticAlternate: false,
      showSyntheticInfo: true,
    },
  );
});

test('hides audio controls when no recording is available', () => {
  assert.deepEqual(getKanjiAudioControls(undefined), {
    primaryVoice: null,
    hasSyntheticAlternate: false,
    showSyntheticInfo: false,
  });
});
