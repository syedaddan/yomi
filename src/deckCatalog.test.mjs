import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDeckOverrides, validateDeckItem } from './deckCatalog.js';

test('applies shared deck edits, additions, and removals by stable item id', () => {
  const base = [
    { id: 'h:one', deck: 'hira', chunks: [{ w: 'あ', p: '' }], en: 'one', theme: 'Basic' },
    { id: 'k:two', deck: 'kata', chunks: [{ w: 'ア', p: '' }], en: 'two', theme: 'Basic' },
  ];
  const result = applyDeckOverrides(base, [
    {
      item_id: 'h:one',
      deck: 'hira',
      item_data: { chunks: [{ w: 'い', p: '' }], en: 'updated', theme: 'New' },
      deleted: false,
    },
    {
      item_id: 'admin:new',
      deck: 'phr',
      item_data: { chunks: [{ w: 'おはよう', p: '' }], en: 'good morning', theme: 'Greetings' },
      deleted: false,
    },
    { item_id: 'k:two', deleted: true },
  ]);

  assert.deepEqual(result.map((item) => item.id), ['h:one', 'admin:new']);
  assert.equal(result[0].text, 'い');
  assert.equal(result[0].moraCount, 1);
  assert.equal(result[0].en, 'updated');
  assert.equal(result[1].deck, 'phr');
});

test('validates deck item content and derives display text and mora count', () => {
  const result = validateDeckItem({
    chunks: [{ w: 'きょう', p: '' }, { w: 'は', p: '' }],
    en: 'today',
    theme: 'Time',
  }, 'admin:item', 'phr');

  assert.equal(result.id, 'admin:item');
  assert.equal(result.deck, 'phr');
  assert.equal(result.text, 'きょうは');
  assert.equal(result.moraCount, 3);
});

test('rejects invalid deck item shape, text, meaning, or theme', () => {
  assert.throws(() => validateDeckItem({}, 'id', 'hira'), /Japanese text chunk/);
  assert.throws(() => validateDeckItem({ chunks: [{ w: '', p: '' }], en: 'x', theme: 't' }, 'id', 'hira'), /Japanese text cannot be empty/);
  assert.throws(() => validateDeckItem({ chunks: [{ w: 'あ', p: '' }], en: '', theme: 't' }, 'id', 'hira'), /English meaning/);
  assert.throws(() => validateDeckItem({ chunks: [{ w: 'あ', p: '' }], en: 'a', theme: '' }, 'id', 'hira'), /Add a theme/);
});
