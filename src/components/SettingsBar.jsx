import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITEMS, PHRASES } from '../data.js';
import { ChoiceButtons, InfoButton, VoiceButtons } from './shared.jsx';

const DECKS = [
  ['hira', 'Hiragana'],
  ['kata', 'Katakana'],
  ['phr', 'Phrases'],
];
const DECK_LABELS = { hira: 'Hiragana', kata: 'Katakana', phr: 'Phrases' };

function ResetButton({ section, onReset }) {
  return (
    <button className="reset-icon" type="button" aria-label={`Reset ${section} settings`} title={`Reset ${section} settings`} onClick={onReset}>
      ↺
    </button>
  );
}

function SettingPanel({ id, label, summary, open, onToggle, onReset, children }) {
  const trigger = useRef(null);
  const [panelLeft, setPanelLeft] = useState(12);
  useEffect(() => {
    if (!open || !trigger.current) return;
    const { left } = trigger.current.getBoundingClientRect();
    setPanelLeft(Math.max(12, Math.min(left, window.innerWidth - Math.min(380, window.innerWidth - 24) - 12)));
  }, [open]);
  return (
    <div className="setting-section">
      <div className="setting-trigger-wrap">
        <button
          className="setting-trigger"
          type="button"
          data-setting={id}
          ref={trigger}
          aria-expanded={open}
          aria-controls={open ? `settings-${id}` : undefined}
          onClick={onToggle}
        >
          <span>{label}</span>
          {summary && <small>{summary}</small>}
          <span aria-hidden="true" className="chevron">{open ? '⌄' : '⌃'}</span>
        </button>
      </div>
      {open && (
        <div className="setting-popover" id={`settings-${id}`} style={{ left: panelLeft }}>
          <div className="setting-popover-head">
            <b>{label}</b>
            <ResetButton section={label.toLowerCase()} onReset={onReset} />
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleSetting({ label, pressed, onClick, info, id }) {
  return (
    <div className="toggle-setting">
      <button className="choice-button" id={id} type="button" aria-pressed={pressed} onClick={onClick}>
        {label}<small>{pressed ? 'On' : 'Off'}</small>
      </button>
    </div>
  );
}

export default function SettingsBar({ page, prefs, setPreference, resetSection, resetAll, onDrillReset, notify }) {
  const [openSection, setOpenSection] = useState('');
  const bar = useRef(null);
  const deckThemes = useMemo(() => [...new Set(ITEMS.map((item) => `${item.deck}|${item.theme}`))], []);
  const themeNames = useMemo(() => {
    const counts = {};
    for (const key of deckThemes) {
      const name = key.split('|')[1];
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [deckThemes]);
  const selectedThemes = prefs.themes.filter((key) => deckThemes.includes(key));
  const availableThemes = deckThemes.filter((key) => !selectedThemes.includes(key));
  const phraseThemes = [...new Set(PHRASES.map((phrase) => phrase.theme))];
  const phrases = PHRASES.filter((phrase) => !prefs.paceTheme || phrase.theme === prefs.paceTheme);
  const selectedPhrase = PHRASES.find((phrase) => phrase.id === prefs.pacePhraseId) || phrases[0];

  useEffect(() => {
    setOpenSection('');
  }, [page]);

  useEffect(() => {
    function closeOnOutside(event) {
      if (bar.current && !bar.current.contains(event.target)) setOpenSection('');
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpenSection('');
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function toggleSection(name) {
    setOpenSection((current) => current === name ? '' : name);
  }

  function updateDrillSettings(update) {
    update();
    onDrillReset();
  }

  function toggleDeck(deck) {
    if (prefs.decks[deck] && Object.values(prefs.decks).filter(Boolean).length === 1) {
      notify('Keep at least one deck selected.');
      return;
    }
    updateDrillSettings(() => setPreference('decks', { ...prefs.decks, [deck]: !prefs.decks[deck] }));
  }

  function toggleTheme(key) {
    const selected = selectedThemes.includes(key)
      ? selectedThemes.filter((theme) => theme !== key)
      : [...selectedThemes, key];
    updateDrillSettings(() => setPreference('themes', selected));
  }

  function changePaceTheme(theme) {
    setPreference('paceTheme', theme);
    const nextPhrase = PHRASES.find((phrase) => !theme || phrase.theme === theme);
    if (nextPhrase) setPreference('pacePhraseId', nextPhrase.id);
  }

  function reset(name) {
    resetSection(name);
    if (name === 'decks' || name === 'themes' || name === 'reading') onDrillReset();
  }

  return (
    <aside className="settings-dock" aria-label="Settings">
      {openSection && (
        <button
          className="settings-scrim"
          type="button"
          aria-label="Close settings panel"
          tabIndex={-1}
          onClick={() => setOpenSection('')}
        />
      )}
      <div className="settings-dock-inner" ref={bar}>
        <div className="settings-scroll">
          {page === 'drill' && (
            <>
              <SettingPanel
                id="decks"
                label="Decks"
                summary={`${Object.values(prefs.decks).filter(Boolean).length}/${DECKS.length}`}
                open={openSection === 'decks'}
                onToggle={() => toggleSection('decks')}
                onReset={() => reset('decks')}
              >
                <ChoiceButtons
                  label="Decks"
                  value={DECKS.filter(([key]) => prefs.decks[key]).map(([key]) => key)}
                  multiple
                  options={DECKS.map(([key, name]) => [key, name, ITEMS.filter((item) => item.deck === key).length])}
                  onChange={toggleDeck}
                />
              </SettingPanel>
              <SettingPanel
                id="themes"
                label="Themes"
                summary={`${selectedThemes.length}/${deckThemes.length} selected`}
                open={openSection === 'themes'}
                onToggle={() => toggleSection('themes')}
                onReset={() => reset('themes')}
              >
                  <div className="choice-group compact theme-options" role="group" aria-label="Unselected themes">
                  {availableThemes.map((key) => {
                    const [deck, name] = key.split('|');
                    const label = themeNames[name] > 1 ? `${name} · ${DECK_LABELS[deck]}` : name;
                    return <button className="choice-button" type="button" data-theme={key} key={key} onClick={() => toggleTheme(key)}>{label}</button>;
                  })}
                  {!availableThemes.length && <span className="hint">All themes are selected.</span>}
                </div>
                {!selectedThemes.length && <p className="hint">No themes selected means all themes are included.</p>}
              </SettingPanel>
              <SettingPanel
                id="options"
                label="Options"
                summary={prefs.chunk ? 'Spaced phrases' : 'Joined phrases'}
                open={openSection === 'options'}
                onToggle={() => toggleSection('options')}
                onReset={() => reset('reading')}
              >
                {prefs.mode === 'flash' && (
                  <label className="range-setting" htmlFor="flash-ms">
                    Flash time <b>{(prefs.flashMs / 1000).toFixed(1)}s</b>
                    <input id="flash-ms" type="range" min="400" max="3000" step="100" value={prefs.flashMs} onChange={(event) => setPreference('flashMs', Number(event.target.value))} />
                  </label>
                )}
                <ToggleSetting label="Space phrase chunks" pressed={prefs.chunk} onClick={() => setPreference('chunk', !prefs.chunk)} />
              </SettingPanel>
            </>
          )}

          {page === 'pacer' && (
            <>
              <SettingPanel
                id="phrases"
                label="Phrases"
                summary={selectedPhrase ? `${selectedPhrase.text} · ${phrases.length}` : `${phrases.length}`}
                open={openSection === 'phrases'}
                onToggle={() => toggleSection('phrases')}
                onReset={() => resetSection('phrases')}
              >
                <div className="phrase-theme-list">
                  {['', ...phraseThemes].map((theme) => (
                    <button className="choice-button" type="button" aria-pressed={prefs.paceTheme === theme} key={theme || 'all'} onClick={() => changePaceTheme(theme)}>{theme || 'All themes'}</button>
                  ))}
                </div>
                <div className="phrase-options" role="listbox" aria-label="Phrases">
                  {phrases.map((phrase) => (
                    <button
                      className="phrase-option"
                      type="button"
                      role="option"
                      aria-selected={phrase.id === selectedPhrase?.id}
                      key={phrase.id}
                      onClick={() => { setPreference('pacePhraseId', phrase.id); setOpenSection(''); }}
                    >
                      <span className="jp">{phrase.text}</span>
                      <small>{phrase.en}</small>
                    </button>
                  ))}
                </div>
              </SettingPanel>
              <SettingPanel
                id="pace"
                label="Pace"
                summary={`${prefs.paceRate} mora/s · ${prefs.voice}`}
                open={openSection === 'pace'}
                onToggle={() => toggleSection('pace')}
                onReset={() => resetSection('pace')}
              >
                <label className="range-setting" htmlFor="pace-rate">
                  Speed <b>{prefs.paceRate} mora per second</b>
                  <input id="pace-rate" type="range" min="2" max="10" step="0.5" value={prefs.paceRate} onChange={(event) => setPreference('paceRate', Number(event.target.value))} />
                </label>
                <ToggleSetting label="Speak along" id="pace-speak" pressed={prefs.paceSpeak} onClick={() => setPreference('paceSpeak', !prefs.paceSpeak)} info="Play the recorded synthetic voice while highlights follow its audio timeline. When off, highlights advance at the selected speed without audio." />
                <ToggleSetting label="Space phrase chunks" pressed={prefs.paceChunk} onClick={() => setPreference('paceChunk', !prefs.paceChunk)} />
                <VoiceButtons attribute="data-pace-voice" value={prefs.voice} onChange={(value) => setPreference('voice', value)} />
              </SettingPanel>
            </>
          )}

          {page === 'alike' && (
            <SettingPanel
              id="script"
              label="Script"
              summary={{ both: 'Both', hira: 'Hiragana', kata: 'Katakana' }[prefs.alikeScript]}
              open={openSection === 'script'}
              onToggle={() => toggleSection('script')}
              onReset={() => resetSection('script')}
            >
              <ChoiceButtons
                label="Quiz script"
                value={prefs.alikeScript}
                options={[['both', 'Both scripts'], ['hira', 'Hiragana'], ['kata', 'Katakana']]}
                onChange={(value) => setPreference('alikeScript', value)}
              />
            </SettingPanel>
          )}
        </div>
        {page === 'drill' && selectedThemes.length > 0 && (
          <div className="selected-theme-strip" aria-label="Selected themes">
            {selectedThemes.map((key) => {
              const [deck, name] = key.split('|');
              const label = themeNames[name] > 1 ? `${name} · ${DECK_LABELS[deck]}` : name;
              return <button className="selected-theme" type="button" key={key} onClick={() => toggleTheme(key)}>{label}<span aria-hidden="true">×</span></button>;
            })}
          </div>
        )}
        <button className="reset-all" type="button" onClick={resetAll}><span aria-hidden="true">↺</span> Reset all</button>
      </div>
    </aside>
  );
}
