import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moras } from './core.js';
import { getUnlockedKanjiGroups, unlockNextKanjiGroup } from './storage.js';

const deck = JSON.parse(readFileSync(new URL('../out/kanji.json', import.meta.url), 'utf8'));

test('preserves the ordered lesson groups from the presentation filenames', () => {
  assert.equal(deck.groups.length, 50);
  assert.equal(deck.kanji.length, 274);
  const groupedCharacters = deck.groups.flatMap((group) => group.characters);
  assert.equal(new Set(groupedCharacters).size, groupedCharacters.length);
  assert.deepEqual(deck.kanji.map((entry) => entry.character), groupedCharacters);
  assert.deepEqual(deck.groups[0].characters, ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']);
  assert.ok(deck.groups.slice(0, 49).every((group) => !group.sourceTitle.includes('導入')));
  for (const [index, group] of deck.groups.slice(0, 49).entries()) {
    assert.equal(group.id, `lesson-${String(index + 1).padStart(2, '0')}`);
    for (const character of group.characters) {
      assert.equal(deck.kanji.find((entry) => entry.character === character)?.groupId, group.id);
    }
  }
  assert.equal(deck.groups[49].id, 'previous-deck-extras');
  assert.deepEqual(deck.groups[49].characters, ['立', '耳']);
  for (const character of deck.groups[49].characters) {
    assert.equal(deck.kanji.find((entry) => entry.character === character)?.groupId, deck.groups[49].id);
  }
});

test('includes dictionary readings and examples for every lesson character', () => {
  assert.equal(new Set(deck.kanji.map((entry) => entry.character)).size, deck.kanji.length);
  for (const entry of deck.kanji) {
    assert.ok(entry.meanings.length, `${entry.character} has a meaning`);
    assert.ok(entry.on.length || entry.kun.length, `${entry.character} has a Japanese reading`);
    assert.ok(entry.words.length, `${entry.character} has example vocabulary`);
    assert.ok(entry.words.every((word) => word.word.includes(entry.character)));
  }
});

test('starts with the first lesson unlocked and only unlocks sequentially', () => {
  const first = deck.groups[0].id;
  const second = deck.groups[1].id;
  const third = deck.groups[2].id;
  assert.deepEqual(getUnlockedKanjiGroups(undefined, deck.groups), [first]);
  assert.deepEqual(getUnlockedKanjiGroups([first, third], deck.groups), [first]);
  assert.deepEqual(unlockNextKanjiGroup([first], deck.groups), [first, second]);
  assert.deepEqual(
    unlockNextKanjiGroup(deck.groups.map((group) => group.id), deck.groups),
    deck.groups.map((group) => group.id),
  );
});

test('uses Kanjium readings and valid pitch accents for every example', () => {
  assert.ok(deck.words.length >= 274);
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
