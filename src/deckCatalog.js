import { moras } from './core.js';

export function applyDeckOverrides(baseItems, overrides) {
  const items = new Map(baseItems.map((item) => [item.id, item]));
  for (const override of overrides) {
    if (override.deleted) {
      items.delete(override.item_id);
      continue;
    }
    const data = override.item_data;
    if (!data || !Array.isArray(data.chunks)) continue;
    const text = data.chunks.map((chunk) => `${chunk.w || ''}${chunk.p || ''}`).join('');
    items.set(override.item_id, {
      ...items.get(override.item_id),
      ...data,
      id: override.item_id,
      deck: override.deck,
      text,
      moraCount: moras(text).length,
    });
  }
  return [...items.values()];
}

export function validateDeckItem(item, id, deck) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Deck item must be a JSON object.');
  }
  if (!['hira', 'kata', 'phr'].includes(deck)) {
    throw new Error('Choose a valid deck.');
  }
  if (!Array.isArray(item.chunks) || !item.chunks.length ||
    item.chunks.some((chunk) => !chunk || typeof chunk.w !== 'string' || typeof chunk.p !== 'string')) {
    throw new Error('Add at least one valid Japanese text chunk.');
  }
  if (typeof item.en !== 'string' || !item.en.trim()) {
    throw new Error('Add an English meaning or translation.');
  }
  if (typeof item.theme !== 'string' || !item.theme.trim()) {
    throw new Error('Add a theme.');
  }
  const text = item.chunks.map((chunk) => `${chunk.w}${chunk.p}`).join('');
  if (!text.trim()) throw new Error('Japanese text cannot be empty.');
  return {
    ...item,
    id,
    deck,
    en: item.en.trim(),
    theme: item.theme.trim(),
    text,
    moraCount: moras(text).length,
  };
}
