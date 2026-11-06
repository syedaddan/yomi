import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPitch,
  extractPitchContour,
  getItemMorae,
  getItemPitchPattern,
  scoreMoraPitch,
  segmentMorae,
} from './pitchDetection.js';

function createSineWave(frequency, sampleRate, durationSeconds, amplitude = 0.5) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i += 1) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

test('detectPitch accurately detects sine wave fundamentals in the vocal range', () => {
  const sampleRate = 44100;

  // 150 Hz sine wave
  const buffer150 = createSineWave(150, sampleRate, 0.1);
  const result150 = detectPitch(buffer150, sampleRate);
  assert.equal(result150.voiced, true);
  assert.ok(Math.abs(result150.pitch - 150) < 2, `Expected ~150 Hz, got ${result150.pitch}`);
  assert.ok(result150.clarity > 0.8, `Expected high clarity, got ${result150.clarity}`);

  // 220 Hz sine wave (A3)
  const buffer220 = createSineWave(220, sampleRate, 0.1);
  const result220 = detectPitch(buffer220, sampleRate);
  assert.equal(result220.voiced, true);
  assert.ok(Math.abs(result220.pitch - 220) < 2, `Expected ~220 Hz, got ${result220.pitch}`);
  assert.ok(result220.clarity > 0.8, `Expected high clarity, got ${result220.clarity}`);

  // 350 Hz sine wave (female/higher voice)
  const buffer350 = createSineWave(350, sampleRate, 0.1);
  const result350 = detectPitch(buffer350, sampleRate);
  assert.equal(result350.voiced, true);
  assert.ok(Math.abs(result350.pitch - 350) < 2, `Expected ~350 Hz, got ${result350.pitch}`);
});

test('detectPitch gates silence and frequencies outside vocal bounds', () => {
  const sampleRate = 44100;

  // Silence
  const silence = new Float32Array(2048);
  const silenceResult = detectPitch(silence, sampleRate);
  assert.equal(silenceResult.voiced, false);
  assert.equal(silenceResult.pitch, 0);

  // Frequency above 500 Hz (e.g. 1500 Hz)
  const highSine = createSineWave(1500, sampleRate, 0.1);
  const highResult = detectPitch(highSine, sampleRate);
  assert.equal(highResult.voiced, false);
});

test('extractPitchContour creates timed frames across audio buffer', () => {
  const sampleRate = 44100;
  // 0.2s of 200 Hz tone
  const tone = createSineWave(200, sampleRate, 0.2);
  const frames = extractPitchContour(tone, sampleRate, { frameSize: 1024, hopSize: 512 });

  assert.ok(frames.length > 5, 'Should generate multiple frames');
  const voicedFrames = frames.filter((f) => f.voiced);
  assert.ok(voicedFrames.length >= 3, 'Voiced frames should be present');
  for (const f of voicedFrames) {
    assert.ok(Math.abs(f.pitch - 200) < 3, `Expected ~200 Hz, got ${f.pitch}`);
    assert.ok(f.time >= 0, 'Frame has valid timestamp');
  }
});

test('segmentMorae partitions voiced frames evenly into mora slots', () => {
  // Create mock frames spanning 0.0s to 0.9s with 3 mora sections:
  // Mora 1 (0.0 - 0.3s): 150 Hz
  // Mora 2 (0.3 - 0.6s): 220 Hz
  // Mora 3 (0.6 - 0.9s): 220 Hz
  const frames = [];
  for (let t = 0; t <= 0.9; t += 0.05) {
    let pitch = 150;
    if (t >= 0.3) pitch = 220;
    frames.push({
      time: t,
      pitch,
      clarity: 0.9,
      voiced: true,
    });
  }

  const segments = segmentMorae(frames, 3);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].moraIndex, 0);
  assert.equal(segments[0].voiced, true);
  assert.equal(segments[0].pitch, 150);

  assert.equal(segments[1].moraIndex, 1);
  assert.equal(segments[1].voiced, true);
  assert.equal(segments[1].pitch, 220);

  assert.equal(segments[2].moraIndex, 2);
  assert.equal(segments[2].voiced, true);
  assert.equal(segments[2].pitch, 220);
});

test('scoreMoraPitch evaluates matching and mismatching pitch patterns', () => {
  // 1. Heiban word (L H H) - matching
  const heibanSegments = [
    { moraIndex: 0, pitch: 160, voiced: true },
    { moraIndex: 1, pitch: 220, voiced: true },
    { moraIndex: 2, pitch: 220, voiced: true },
  ];
  const heibanResult = scoreMoraPitch(heibanSegments, ['L', 'H', 'H']);
  assert.equal(heibanResult.score, 100);
  assert.equal(heibanResult.passed, true);
  assert.equal(heibanResult.moraResults.every((m) => m.match), true);

  // 2. Atamadaka word (H L) - matching
  const atamadakaSegments = [
    { moraIndex: 0, pitch: 230, voiced: true },
    { moraIndex: 1, pitch: 150, voiced: true },
  ];
  const atamadakaResult = scoreMoraPitch(atamadakaSegments, ['H', 'L']);
  assert.equal(atamadakaResult.score, 100);
  assert.equal(atamadakaResult.passed, true);

  // 3. Mismatch: spoke L-H when expected H-L
  const mismatchSegments = [
    { moraIndex: 0, pitch: 150, voiced: true },
    { moraIndex: 1, pitch: 230, voiced: true },
  ];
  const mismatchResult = scoreMoraPitch(mismatchSegments, ['H', 'L']);
  assert.ok(mismatchResult.score < 70, `Expected failing score, got ${mismatchResult.score}`);
  assert.equal(mismatchResult.passed, false);
  assert.ok(mismatchResult.feedback.includes('Mora'));

  // 4. Nakadaka (L H L) - matching
  const nakadakaSegments = [
    { moraIndex: 0, pitch: 160, voiced: true },
    { moraIndex: 1, pitch: 225, voiced: true },
    { moraIndex: 2, pitch: 155, voiced: true },
  ];
  const nakadakaResult = scoreMoraPitch(nakadakaSegments, ['L', 'H', 'L']);
  assert.equal(nakadakaResult.score, 100);
  assert.equal(nakadakaResult.passed, true);

  // 5. Completely silent audio
  const silentSegments = [
    { moraIndex: 0, pitch: 0, voiced: false },
    { moraIndex: 1, pitch: 0, voiced: false },
  ];
  const silentResult = scoreMoraPitch(silentSegments, ['H', 'L']);
  assert.equal(silentResult.score, 0);
  assert.equal(silentResult.passed, false);
  assert.ok(silentResult.feedback.includes('louder'));

  // 6. Single mora word
  const singleMora = [{ moraIndex: 0, pitch: 200, voiced: true }];
  const singleResult = scoreMoraPitch(singleMora, ['H']);
  assert.equal(singleResult.score, 100);
  assert.equal(singleResult.passed, true);
});

test('getItemMorae and getItemPitchPattern extract clean morae and pitch patterns from items', () => {
  const item = {
    chunks: [
      { w: 'つくえ', p: '', a: 0 },
    ],
  };
  assert.deepEqual(getItemMorae(item), ['つ', 'く', 'え']);
  assert.deepEqual(getItemPitchPattern(item), ['L', 'H', 'H']);

  const phraseItem = {
    chunks: [
      { w: 'おはよう', p: '', a: 0 },
      { w: 'ございます', p: '', a: 4 },
    ],
  };
  assert.deepEqual(getItemMorae(phraseItem), ['お', 'は', 'よ', 'う', 'ご', 'ざ', 'い', 'ま', 'す']);
  assert.deepEqual(getItemPitchPattern(phraseItem), ['L', 'H', 'H', 'H', 'L', 'H', 'H', 'H', 'L']);
});
