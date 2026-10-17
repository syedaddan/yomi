import React, { useEffect, useState } from 'react';
import Drill from './components/Drill.jsx';
import Pacer from './components/Pacer.jsx';
import { KanjiTab, LookalikeTab, ProgressTab } from './components/StudyTabs.jsx';
import { ChoiceButtons, InfoButton, SectionNav, Toast } from './components/shared.jsx';
import SettingsBar from './components/SettingsBar.jsx';
import { DEFAULT_PREFS, loadStore, preferencesFrom, saveStore } from './storage.js';

const pages = ['drill', 'pacer', 'alike', 'progress', 'kanji'];

function pageFromHash() {
  const requested = window.location.hash.replace(/^#\/?/, '');
  return pages.includes(requested) ? requested : 'drill';
}

function initialState() {
  const store = loadStore();
  return { store, prefs: preferencesFrom(store) };
}

function QuickToggle({ label, pressed, onClick }) {
  return (
    <button className="choice-button" type="button" aria-pressed={pressed} onClick={onClick}>{label}</button>
  );
}

export default function App() {
  const [initial] = useState(initialState);
  const [store, setStore] = useState(initial.store);
  const [prefs, setPrefs] = useState(initial.prefs);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(pageFromHash);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    function onHashChange() {
      setPage(pageFromHash());
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/drill`);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const label = { drill: 'Drill', pacer: 'Phrase pacer', alike: 'Look-alikes', progress: 'Progress', kanji: 'Kanji' }[page];
    document.title = `${label} · Yomi Drill`;
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
      display: { romaji: defaults.romaji, marks: defaults.marks },
      decks: { decks: { ...defaults.decks } },
      themes: { themes: [] },
      reading: { mode: defaults.mode, flashMs: defaults.flashMs, chunk: defaults.chunk },
      phrases: { paceTheme: defaults.paceTheme, pacePhraseId: defaults.pacePhraseId },
      pace: { paceRate: defaults.paceRate, paceChunk: defaults.paceChunk, paceSpeak: defaults.paceSpeak, voice: defaults.voice },
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

  return (
    <>
      <div className={`wrap${prefs.romaji ? '' : ' no-rom'}${prefs.marks ? '' : ' no-mark'}`} id="app">
        <header className="top">
          <div className="top-in">
            <div className="brand"><b lang="ja">読み</b><span>Yomi Drill</span></div>
            <div className="top-quick-controls">
              <div className="quick-setting">
                <QuickToggle label="Romaji" pressed={prefs.romaji} onClick={() => setPreference('romaji', !prefs.romaji)} />
                <InfoButton label="Romaji information">Show or hide the Latin-letter reading alongside Japanese text.</InfoButton>
              </div>
              <div className="quick-setting">
                <QuickToggle label="Pitch marks" pressed={prefs.marks} onClick={() => setPreference('marks', !prefs.marks)} />
                <InfoButton label="Pitch marks information">Show or hide the high/low pitch marks on readings.</InfoButton>
              </div>
              {page === 'drill' && (
                <ChoiceButtons
                  label="Reading mode"
                  value={prefs.mode}
                  options={['read', 'flash', 'sprint'].map((mode) => [mode, mode[0].toUpperCase() + mode.slice(1)])}
                  onChange={(mode) => { setPreference('mode', mode); setResetVersion((version) => version + 1); }}
                />
              )}
              <button className="reset-icon top-reset" type="button" aria-label="Reset display settings" title="Reset display settings" onClick={() => resetSection('display')}>↺</button>
            </div>
            <SectionNav value={page} />
          </div>
        </header>

        <main>
          {page === 'drill' && <Drill key={resetVersion} active prefs={prefs} setPreference={setPreference} store={store} setStore={setStore} notify={notify} />}
          {page === 'pacer' && <Pacer active prefs={prefs} setPreference={setPreference} notify={notify} />}
          {page === 'alike' && <LookalikeTab active store={store} setStore={setStore} />}
          {page === 'progress' && <ProgressTab store={store} setStore={setStore} notify={notify} />}
          {page === 'kanji' && <KanjiTab />}
        </main>

        <footer className="credits">
          <p><b>Audio and data.</b> Word recordings: Tokyo-accent male voice from <a href="https://github.com/tofugu/japanese-vocabulary-pronunciation-audio" target="_blank" rel="noopener noreferrer">WaniKani / Tofugu</a> (CC BY-SA 4.0). Synthetic voices: <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:白上虎太郎</a> (male) and <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer">VOICEVOX:九州そら</a> (female). Pitch accents: <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>.</p>
        </footer>
      </div>
      <SettingsBar page={page} prefs={prefs} setPreference={setPreference} resetSection={resetSection} resetAll={resetAll} notify={notify} onDrillReset={() => setResetVersion((version) => version + 1)} />
      <Toast message={toast} />
    </>
  );
}
