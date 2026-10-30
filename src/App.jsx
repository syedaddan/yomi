import React, { useEffect, useState } from 'react';
import Drill from './components/Drill.jsx';
import Pacer from './components/Pacer.jsx';
import AddWords from './components/AddWords.jsx';
import { KanjiTab, LookalikeTab, ProgressTab } from './components/StudyTabs.jsx';
import { InfoButton, SectionNav, Toast } from './components/shared.jsx';
import SettingsBar from './components/SettingsBar.jsx';
import { DEFAULT_PREFS, loadStore, preferencesFrom, saveStore } from './storage.js';

const pages = ['drill', 'pacer', 'alike', 'progress', 'kanji', 'add'];

const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');

function pagePath(page) {
  const root = basePath ? `${basePath}/` : '/';
  return page === 'drill' ? root : `${root}${page}`;
}

function pageFromLocation() {
  const legacyHash = window.location.hash.replace(/^#\/?/, '');
  if (pages.includes(legacyHash)) return legacyHash;

  let route = window.location.pathname;
  if (basePath && (route === basePath || route.startsWith(`${basePath}/`))) {
    route = route.slice(basePath.length);
  }
  route = route.replace(/^\/+|\/+$/g, '');
  return pages.includes(route) ? route : 'drill';
}

function initialState() {
  const store = loadStore();
  return { store, prefs: preferencesFrom(store) };
}

export default function App() {
  const [initial] = useState(initialState);
  const [store, setStore] = useState(initial.store);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(pageFromLocation);
  const [resetVersion, setResetVersion] = useState(0);

  function navigate(nextPage, replace = false) {
    const url = `${pagePath(nextPage)}${window.location.search}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setPage(nextPage);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    function onLocationChange() {
      const nextPage = pageFromLocation();
      const nextPath = pagePath(nextPage);
      if (window.location.hash || window.location.pathname !== nextPath) {
        window.history.replaceState(null, '', `${nextPath}${window.location.search}`);
      }
      setPage(nextPage);
      window.scrollTo(0, 0);
    }
    onLocationChange();
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  useEffect(() => {
    const label = { drill: 'Drill', pacer: 'Phrase pacer', alike: 'Look-alikes', progress: 'Progress', kanji: 'Kanji', add: 'Add words' }[page];
    document.title = `${label} · Yomi`;
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveStore(store), 250);
    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message) {
    setToast(message);
  }

  function setPreference(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setStore((current) => ({ ...current, prefs: { ...current.prefs, [key]: value } }));
  }

  function resetSection(section) {
    const defaults = DEFAULT_PREFS;
    const resetValues = {
      display: { romaji: defaults.romaji, marks: defaults.marks, mode: defaults.mode },
      decks: { decks: { ...defaults.decks } },
      themes: { themes: [] },
      reading: { mode: defaults.mode, flashMs: defaults.flashMs, chunk: defaults.chunk },
      phrases: { paceTheme: defaults.paceTheme, pacePhraseId: defaults.pacePhraseId },
      pace: { paceRate: defaults.paceRate, paceChunk: defaults.paceChunk, paceSpeak: defaults.paceSpeak },
      script: { alikeScript: defaults.alikeScript },
    }[section];
    if (!resetValues) return;
    setPrefs((current) => ({ ...current, ...resetValues }));
    setStore((current) => ({ ...current, prefs: { ...current.prefs, ...resetValues } }));
    notify(`${section[0].toUpperCase()}${section.slice(1)} settings reset.`);
  }

  function resetAll() {
    const defaults = { ...DEFAULT_PREFS, decks: { ...DEFAULT_PREFS.decks }, themes: [] };
    setPrefs(defaults);
    setStore((current) => ({ ...current, prefs: defaults }));
    setResetVersion((version) => version + 1);
    notify('All settings reset.');
  }

  function addCustomItem(item) {
    const nextPrefs = {
      ...prefs,
      decks: { ...prefs.decks, [item.deck]: true },
      themes: prefs.themes.length
        ? [...new Set([...prefs.themes, `${item.deck}|${item.theme}`])]
        : prefs.themes,
    };
    const nextStore = {
      ...store,
      prefs: { ...store.prefs, ...nextPrefs },
      customItems: [...(store.customItems || []), item],
    };
    if (!saveStore(nextStore)) throw new Error('Could not save this word in browser storage.');
    setStore(nextStore);
    setPrefs(nextPrefs);
    setResetVersion((version) => version + 1);
    navigate('drill');
  }

  function deleteCustomItem(id) {
    const nextStore = { ...store, customItems: store.customItems.filter((item) => item.id !== id) };
    if (!saveStore(nextStore)) throw new Error('Could not update your saved word list.');
    setStore(nextStore);
  }

  return (
    <>
      <div className={`wrap${prefs.romaji ? '' : ' no-rom'}${prefs.marks ? '' : ' no-mark'}`} id="app">
        <header className="top">
          <div className="top-in">
            <div className="brand">
              <img className="brand-mark" src={`${import.meta.env.BASE_URL}yomi-mark.svg`} alt="" />
              <span className="brand-name">Yomi</span>
              <InfoButton label="Audio and data information">
                <span className="credits-tooltip-content">
                  <span><b>Word recordings:</b> <a href="https://github.com/tofugu/japanese-vocabulary-pronunciation-audio" target="_blank" rel="noopener noreferrer">WaniKani / Tofugu</a>, CC BY-SA 4.0.</span>
                  <span><b>Synthetic voice:</b> <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:九州そら</a>.</span>
                  <span><b>Pitch accents:</b> <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>.</span>
                </span>
              </InfoButton>
            </div>
            <SectionNav value={page} onNavigate={navigate} />
          </div>
        </header>

        <main>
          {page === 'drill' && <Drill key={resetVersion} active prefs={prefs} setPreference={setPreference} store={store} setStore={setStore} notify={notify} />}
          {page === 'pacer' && <Pacer active prefs={prefs} setPreference={setPreference} notify={notify} />}
          {page === 'alike' && <LookalikeTab active store={store} setStore={setStore} />}
          {page === 'progress' && <ProgressTab store={store} setStore={setStore} notify={notify} />}
          {page === 'kanji' && <KanjiTab />}
          {page === 'add' && <AddWords customItems={store.customItems || []} onAdd={addCustomItem} onDelete={deleteCustomItem} />}
        </main>

      </div>
      <SettingsBar page={page} prefs={prefs} setPreference={setPreference} resetSection={resetSection} resetAll={resetAll} notify={notify} onDrillReset={() => setResetVersion((version) => version + 1)} customItems={store.customItems || []} />
      <Toast message={toast} />
    </>
  );
}
