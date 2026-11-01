import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moras } from './core.js';

const deck = JSON.parse(readFileSync(new URL('../out/kanji.json', import.meta.url), 'utf8'));

test('includes the curated N5 character set with dictionary readings and examples', () => {
  assert.equal(deck.kanji.length, 100);
  assert.equal(new Set(deck.kanji.map((entry) => entry.character)).size, deck.kanji.length);
  for (const entry of deck.kanji) {
    assert.ok(entry.meanings.length, `${entry.character} has a meaning`);
    assert.ok(entry.on.length || entry.kun.length, `${entry.character} has a Japanese reading`);
    assert.ok(entry.words.length, `${entry.character} has example vocabulary`);
    assert.ok(entry.words.every((word) => word.word.includes(entry.character)));
  }
});

test('uses Kanjium readings and valid pitch accents for every example', () => {
  assert.ok(deck.words.length >= 100);
  const seen = new Set();
  for (const word of deck.words) {
    const key = `${word.word}:${word.reading}`;
    assert.equal(seen.has(key), false, `${key} is unique`);
    seen.add(key);
    assert.ok(word.meaning, `${key} has a meaning`);
    assert.ok(word.accents.length, `${key} has pitch accent data`);
    for (const accent of word.accents) {
      assert.ok(Number.isInteger(accent) && accent >= 0, `${key} has a valid accent`);
      assert.ok(accent <= moras(word.reading).length, `${key} accent fits its reading`);
    }
  }
});

test('retains dictionary readings and pitch for familiar beginner examples', () => {
  const day = deck.kanji.find((entry) => entry.character === '日');
  assert.ok(day.on.includes('ニチ'));
  assert.ok(day.kun.includes('ひ'));
  assert.deepEqual(day.words.find((word) => word.word === '今日')?.accents, [1]);
  assert.deepEqual(deck.kanji.find((entry) => entry.character === '学')
    .words.find((word) => word.word === '学生')?.accents, [0]);
});
