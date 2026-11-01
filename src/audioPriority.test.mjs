import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaybackSource } from './audioPriority.js';

test('Kansai recording takes priority over Tokyo and synthetic audio by default', () => {
  assert.deepEqual(resolvePlaybackSource({
    alt: 'audio/kansai.mp3',
    audio: 'audio/tokyo.mp3',
    ttsF: { o: 0, l: 100 },
  }, 'female'), { type: 'kansai', source: 'audio/kansai.mp3' });
  assert.deepEqual(resolvePlaybackSource({
    alt: 'audio/kansai.mp3',
    audio: 'audio/tokyo.mp3',
    ttsF: { o: 0, l: 100 },
  }, 'recording'), { type: 'kansai', source: 'audio/kansai.mp3' });
});

test('the explicit alternate playback bypasses Kansai and respects voice selection', () => {
  assert.deepEqual(resolvePlaybackSource({
    alt: 'audio/kansai.mp3',
    audio: 'audio/tokyo.mp3',
    ttsF: { o: 0, l: 100 },
  }, 'recording', true), { type: 'recording', source: 'audio/tokyo.mp3' });
  assert.deepEqual(resolvePlaybackSource({
    alt: 'audio/kansai.mp3',
    ttsF: { o: 0, l: 100 },
  }, 'female', true), { type: 'female-bundle' });
});

test('custom words without stored audio use browser speech synthesis', () => {
  assert.deepEqual(resolvePlaybackSource({ text: 'きょうりゅう' }, 'female'), {
    type: 'speech',
    text: 'きょうりゅう',
  });
  assert.deepEqual(resolvePlaybackSource({
    text: 'あい',
    humanAudioId: 'human-clip',
  }, 'recording'), { type: 'human-local', id: 'human-clip' });
});
