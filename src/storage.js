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
  voice: 'male',
};

export function loadStore() {
  const empty = { stats: {}, sprints: [], conf: {}, prefs: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return empty;
    return {
      ...empty,
      ...saved,
      stats: saved.stats && typeof saved.stats === 'object' ? saved.stats : {},
      sprints: Array.isArray(saved.sprints) ? saved.sprints : [],
      conf: saved.conf && typeof saved.conf === 'object' ? saved.conf : {},
      prefs: saved.prefs && typeof saved.prefs === 'object' ? saved.prefs : {},
    };
  } catch (error) {
    console.warn('Could not load saved Yomi Drill progress; starting with empty progress.', error);
    return empty;
  }
}

export function preferencesFrom(store) {
  return {
    ...DEFAULT_PREFS,
    ...store.prefs,
    decks: { ...DEFAULT_PREFS.decks, ...store.prefs?.decks },
  };
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Could not save Yomi Drill progress in this browser.', error);
    return false;
  }
  return true;
}
