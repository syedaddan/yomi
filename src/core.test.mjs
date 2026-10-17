import test from 'node:test';
import assert from 'node:assert/strict';
import { accentList, moras, particlePitch, particleRomaji, pitchPattern, romaji } from './core.js';

test('counts Japanese morae including small kana and sokuon', () => {
  assert.deepEqual(moras('きょう'), ['きょ', 'う']);
  assert.deepEqual(moras('ファイル'), ['ファ', 'イ', 'ル']);
  assert.equal(moras('がっこう').length, 4);
  assert.equal(moras('コンピューター').length, 6);
});

test('reads pitch accent patterns and multiple dictionary accents', () => {
  assert.equal(pitchPattern(3, 0).join(''), 'LHH');
  assert.equal(pitchPattern(3, 1).join(''), 'HLL');
  assert.equal(pitchPattern(3, 2).join(''), 'LHL');
  assert.equal(pitchPattern(3, 3).join(''), 'LHH');
  assert.equal(pitchPattern(1, 0).join(''), 'L');
  assert.equal(pitchPattern(2, 2).join(''), 'LH');
  assert.equal(pitchPattern(2, 1).join(''), 'HL');
  assert.deepEqual(particlePitch(1, 3), ['L']);
  assert.deepEqual(accentList('(名)2,(感)4,0'), [2, 4, 0]);
  assert.deepEqual(accentList('0,2'), [0, 2]);
  assert.deepEqual(particlePitch(2, 0), ['H', 'H']);
});

test('converts kana, long vowels, and particles to romaji', () => {
  const expected = {
    がっこう: 'gakkou',
    コーヒー: 'koohii',
    ちゃ: 'cha',
    ざっし: 'zasshi',
    インターネット: 'intaanetto',
    ファイル: 'fairu',
    パーティー: 'paatii',
    シャツ: 'shatsu',
    こんいん: "kon'in",
    きょう: 'kyou',
    おはよう: 'ohayou',
    こんにちは: 'konnichiwa',
    ツアー: 'tsuaa',
    ソファー: 'sofaa',
    ティッシュ: 'tisshu',
    しゅくだい: 'shukudai',
    じしょ: 'jisho',
    ハンバーガー: 'hanbaagaa',
    サイヤッド: 'saiyaddo',
    きっぷ: 'kippu',
    マッチ: 'matchi',
    ダウンロード: 'daunroodo',
    ビル: 'biru',
    ぎゅうにゅう: 'gyuunyuu',
    ちょうしょく: 'choushoku',
  };
  for (const [kana, reading] of Object.entries(expected)) assert.equal(romaji(kana), reading, kana);
  assert.equal(particleRomaji('はをへ'), 'waoe');
  assert.equal(particleRomaji('です'), 'desu');
  assert.equal(particleRomaji('ですか'), 'desuka');
});
