import { ITEMS } from './data.js';
import { supabase } from './supabase.js';
import { applyDeckOverrides } from './deckCatalog.js';

function requireData(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

export async function readDeckCatalog() {
  if (!supabase) return ITEMS;
  const result = await supabase
    .from('deck_catalog_overrides')
    .select('item_id,deck,item_data,deleted')
    .order('item_id');
  if (['PGRST205', '42P01'].includes(result.error?.code)) {
    throw new Error('Shared deck editing is not set up yet. Apply Supabase migration 003 to enable it.');
  }
  const rows = requireData(result, 'Could not load the shared decks');
  return applyDeckOverrides(ITEMS, rows);
}

export async function saveDeckCatalogItem(item) {
  const result = await supabase
    .from('deck_catalog_overrides')
    .upsert({
      item_id: item.id,
      deck: item.deck,
      item_data: item,
      deleted: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'item_id' })
    .select('item_id,deck,item_data,deleted')
    .single();
  return requireData(result, 'Could not save this shared deck item');
}

export async function removeDeckCatalogItem(itemId, isOriginal) {
  if (isOriginal) {
    const result = await supabase
      .from('deck_catalog_overrides')
      .upsert({
        item_id: itemId,
        deck: ITEMS.find((item) => item.id === itemId).deck,
        item_data: null,
        deleted: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'item_id' })
      .select('item_id,deck,item_data,deleted')
      .single();
    return requireData(result, 'Could not remove this shared deck item');
  }
  const result = await supabase
    .from('deck_catalog_overrides')
    .delete()
    .eq('item_id', itemId);
  requireData(result, 'Could not remove this shared deck item');
  return { item_id: itemId, deleted: true };
}
