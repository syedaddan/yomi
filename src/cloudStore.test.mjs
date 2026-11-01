import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStores, progressFromRows } from './cloudStore.js';
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

test('merges look-alike attempts and kanji reviews by their structured records', () => {
  const merged = mergeStores(
    {
      ...emptyStore(),
      conf: { あ: { n: 2, miss: 1, rt: [100, 200] } },
      kanjiProgress: { 一: { groupId: 'lesson-01', views: 1, reveals: 1, n: 1, got: 1, slow: 0, miss: 0 } },
    },
    {
      ...emptyStore(),
      conf: { あ: { n: 3, miss: 2, rt: [200, 300] } },
      kanjiProgress: { 一: { groupId: 'lesson-01', views: 2, reveals: 2, n: 2, got: 1, slow: 1, miss: 0 } },
    },
  );

  assert.deepEqual(merged.conf.あ, { n: 5, miss: 3, rt: [100, 200, 300] });
  assert.deepEqual(merged.kanjiProgress['一'], {
    groupId: 'lesson-01', views: 3, reveals: 3, n: 3, got: 2, slow: 1, miss: 0, lastReviewedAt: null,
  });
});

test('reconstructs the app store from normalized progress and custom-word rows', () => {
  const store = progressFromRows([
    { preferences: { romaji: false } },
    [{ item_id: 'h:one', attempts: 2, got: 1, slow: 1, missed: 0, response_times: [100, 200] }],
    [{ glyph: 'あ', attempts: 3, missed: 1, response_times: [150] }],
    [{ pair: 'あ>お', misses: 2 }],
    [{ started_at_ms: 10, deck_key: 'hira', cards_read: 8, misses: 1, mora_per_minute: 12 }],
    [{
      item_id: 'custom:one', deck: 'hira', kana: 'あい', meaning: 'love', theme: 'Life',
      accent: 1, source_url: '', human_audio_url: '', human_audio_id: '', female_audio_id: 'voice-one',
    }],
    [{
      character: '一', group_id: 'lesson-01', views: 2, reveals: 1,
      attempts: 1, got: 0, slow: 1, missed: 0, last_reviewed_at: '2026-11-02T00:00:00Z',
    }],
  ]);

  assert.deepEqual(store.stats['h:one'], { n: 2, got: 1, slow: 1, miss: 0, ms: [100, 200] });
  assert.deepEqual(store.conf['あ'], { n: 3, miss: 1, rt: [150] });
  assert.equal(store.conf['pair:あ>お'], 2);
  assert.deepEqual(store.sprints, [{ t: 10, key: 'hira', read: 8, miss: 1, mpm: 12 }]);
  assert.equal(store.customItems[0].kana, 'あい');
  assert.deepEqual(store.kanjiProgress['一'], {
    groupId: 'lesson-01', views: 2, reveals: 1, n: 1, got: 0, slow: 1, miss: 0,
    lastReviewedAt: '2026-11-02T00:00:00Z',
  });
});
