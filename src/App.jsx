import React, { useEffect, useState } from 'react';
import Drill from './components/Drill.jsx';
import Pacer from './components/Pacer.jsx';
import { KanjiTab, LookalikeTab, ProgressTab } from './components/StudyTabs.jsx';
import { SectionNav, Toast } from './components/shared.jsx';
import { DEFAULT_PREFS, loadStore, preferencesFrom, saveStore } from './storage.js';

const pageByFile = {
  'index.html': 'drill',
  'pacer.html': 'pacer',
  'alike.html': 'alike',
  'progress.html': 'progress',
  'kanji.html': 'kanji',
};

function initialState() {
  const store = loadStore();
  return { store, prefs: preferencesFrom(store) };
}

export default function App() {
  const [initial] = useState(initialState);
  const [store, setStore] = useState(initial.store);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [toast, setToast] = useState('');
  const currentFile = window.location.pathname.split('/').pop();
  const page = pageByFile[currentFile] || 'drill';

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
    if (key === 'reset') {
      const defaults = { ...DEFAULT_PREFS, decks: { ...DEFAULT_PREFS.decks }, themes: [] };
      setPrefs(defaults);
      setStore((current) => ({ ...current, prefs: defaults }));
      notify('Settings back to defaults.');
      return;
    }
    setPrefs((current) => ({ ...current, [key]: value }));
    setStore((current) => ({ ...current, prefs: { ...current.prefs, [key]: value } }));
  }

  return (
    <>
      <div className={`wrap${prefs.romaji ? '' : ' no-rom'}${prefs.marks ? '' : ' no-mark'}`} id="app">
        <header className="top">
          <div className="top-in">
            <div className="brand"><b lang="ja">読み</b><span>Yomi Drill</span></div>
            <div className="switches">
              <label className="sw"><input type="checkbox" checked={prefs.romaji} onChange={(event) => setPreference('romaji', event.target.checked)} /><i />Romaji</label>
              <label className="sw"><input type="checkbox" checked={prefs.marks} onChange={(event) => setPreference('marks', event.target.checked)} /><i />Pitch marks</label>
            </div>
            <SectionNav value={page} />
          </div>
        </header>

        <main>
          {page === 'drill' && <Drill active prefs={prefs} setPreference={setPreference} store={store} setStore={setStore} notify={notify} />}
          {page === 'pacer' && <Pacer active prefs={prefs} setPreference={setPreference} notify={notify} />}
          {page === 'alike' && <LookalikeTab active store={store} setStore={setStore} setPreference={setPreference} notify={notify} />}
          {page === 'progress' && <ProgressTab store={store} setStore={setStore} notify={notify} />}
          {page === 'kanji' && <KanjiTab />}
        </main>

        <footer className="credits">
          <p><b>Audio and data.</b> Word recordings: Tokyo-accent male voice from <a href="https://github.com/tofugu/japanese-vocabulary-pronunciation-audio" target="_blank" rel="noopener noreferrer">WaniKani / Tofugu</a> (CC BY-SA 4.0). Synthetic voices: <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:白上虎太郎</a> (male) and <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:九州そら</a> (female). Pitch accents: <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>.</p>
        </footer>
      </div>
      <Toast message={toast} />
    </>
  );
}
