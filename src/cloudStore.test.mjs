import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStores } from './cloudStore.js';
import { emptyStore } from './storage.js';

test('merges progress from both stores without replacing cloud records', () => {
  const cloud = {
    ...emptyStore(),
    stats: { 'h:one': { n: 2, got: 1, slow: 1, miss: 0, ms: [100, 200] } },
    customItems: [{ id: 'custom:cloud', kana: 'あ' }],
    kanjiUnlockedGroups: ['lesson-1'],
  };
  const local = {
    ...emptyStore(),
    stats: { 'h:one': { n: 3, got: 2, slow: 0, miss: 1, ms: [200, 300] } },
    customItems: [{ id: 'custom:local', kana: 'い' }],
    kanjiUnlockedGroups: ['lesson-1', 'lesson-2'],
  };

  const merged = mergeStores(local, cloud);

  assert.deepEqual(merged.stats['h:one'], {
    n: 5, got: 3, slow: 1, miss: 1, ms: [100, 200, 300],
  });
  assert.deepEqual(merged.customItems.map((item) => item.id), ['custom:cloud', 'custom:local']);
  assert.deepEqual(merged.kanjiUnlockedGroups, ['lesson-1', 'lesson-2']);
});

test('deduplicates repeated sessions and applies local preference choices', () => {
  const session = { t: 1, key: 'hira', read: 3 };
  const merged = mergeStores(
    { ...emptyStore(), sprints: [session], conf: { 'pair:a>b': 1 }, prefs: { romaji: false } },
    { ...emptyStore(), sprints: [session], conf: { 'pair:a>b': 2 }, prefs: { marks: false } },
  );

  assert.deepEqual(merged.sprints, [session]);
  assert.equal(merged.conf['pair:a>b'], 3);
  assert.deepEqual(merged.prefs, { marks: false, romaji: false });
});
