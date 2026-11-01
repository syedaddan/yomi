// Keep this key stable so existing local progress survives the brand rename.
export const STORAGE_KEY = 'yomi-drill-v1';

export const DEFAULT_PREFS = {
  romaji: true,
  marks: true,
  chunk: true,
  decks: { hira: true, kata: true, phr: false },
  themes: [],
  mode: 'read',
  flashMs: 1500,
  paceRate: 5,
  paceChunk: true,
  paceSpeak: false,
  paceTheme: '',
  pacePhraseId: '',
  alikeScript: 'both',
  voice: 'female',
};

export function loadStore() {
  const empty = { stats: {}, sprints: [], conf: {}, prefs: {}, customItems: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return empty;
    const prefs = saved.prefs && typeof saved.prefs === 'object' ? saved.prefs : {};
    return {
      ...empty,
      ...saved,
      stats: saved.stats && typeof saved.stats === 'object' ? saved.stats : {},
      sprints: Array.isArray(saved.sprints) ? saved.sprints : [],
      conf: saved.conf && typeof saved.conf === 'object' ? saved.conf : {},
      prefs: { ...prefs, ...(prefs.voice === 'male' ? { voice: 'recording' } : {}) },
      customItems: Array.isArray(saved.customItems) ? saved.customItems : [],
    };
  } catch (error) {
    console.warn('Could not load saved Yomi progress; starting with empty progress.', error);
    return empty;
  }
}

export function preferencesFrom(store) {
  return {
    ...DEFAULT_PREFS,
    ...store.prefs,
    voice: store.prefs?.voice || DEFAULT_PREFS.voice,
    decks: { ...DEFAULT_PREFS.decks, ...store.prefs?.decks },
  };
}

export function getUnlockedKanjiGroups(savedGroupIds, groups) {
  const saved = new Set(
    Array.isArray(savedGroupIds)
      ? savedGroupIds.filter((groupId) => typeof groupId === 'string')
      : [],
  );
  const unlocked = [];
  for (const group of groups) {
    if (!saved.has(group.id)) break;
    unlocked.push(group.id);
  }
  if (!unlocked.length && groups.length) unlocked.push(groups[0].id);
  return unlocked;
}

export function unlockNextKanjiGroup(savedGroupIds, groups) {
  const unlocked = getUnlockedKanjiGroups(savedGroupIds, groups);
  if (unlocked.length < groups.length) unlocked.push(groups[unlocked.length].id);
  return unlocked;
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Could not save Yomi progress in this browser.', error);
    return false;
  }
  return true;
}
