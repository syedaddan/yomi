import React, { useMemo, useState } from 'react';
import { moras } from '../core.js';
import { ITEMS } from '../data.js';
import { createCustomWord } from '../customWords.js';
import { deleteCustomAudio, saveCustomAudio } from '../customAudio.js';
import { synthesizeFemaleWord } from '../voicevox.js';

const MAX_HUMAN_AUDIO_BYTES = 10 * 1024 * 1024;
const SUGGESTED_WORDS = [
  { deck: 'kata', kana: 'コロナウイルス', meaning: 'coronavirus', theme: 'Health', accent: '' },
  { deck: 'kata', kana: 'インフルエンザ', meaning: 'influenza', theme: 'Health', accent: '' },
  { deck: 'kata', kana: 'コミュニケーション', meaning: 'communication', theme: 'School & Fun', accent: '' },
  { deck: 'kata', kana: 'シミュレーション', meaning: 'simulation', theme: 'IT & Work', accent: '' },
  { deck: 'kata', kana: 'プレゼンテーション', meaning: 'presentation', theme: 'School & Fun', accent: '' },
  { deck: 'kata', kana: 'アレルギー', meaning: 'allergy', theme: 'Health', accent: '' },
  { deck: 'hira', kana: 'きょうりゅう', meaning: 'dinosaur', theme: 'Nature', accent: '0' },
  { deck: 'hira', kana: 'きゅうきゅうしゃ', meaning: 'ambulance', theme: 'Travel & Places', accent: '3' },
  { deck: 'hira', kana: 'じゅぎょう', meaning: 'class / lesson', theme: 'School & Fun', accent: '1' },
  { deck: 'hira', kana: 'しゅっせき', meaning: 'attendance', theme: 'School & Fun', accent: '0' },
  { deck: 'hira', kana: 'いっしょうけんめい', meaning: 'with all one’s effort', theme: 'School & Fun', accent: '5' },
  { deck: 'hira', kana: 'りょこう', meaning: 'travel', theme: 'Travel & Places', accent: '0' },
];

export default function AddWords({ customItems, onAdd, onDelete }) {
  const [deck, setDeck] = useState('hira');
  const [kana, setKana] = useState('');
  const [meaning, setMeaning] = useState('');
  const [theme, setTheme] = useState('New words');
  const [customTheme, setCustomTheme] = useState('');
  const [accent, setAccent] = useState('');
  const [searched, setSearched] = useState(false);
  const [searchResult, setSearchResult] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [humanFile, setHumanFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const wordMoras = useMemo(() => moras(kana.trim()), [kana]);
  const themes = useMemo(
    () => [...new Set(['New words', ...ITEMS.concat(customItems).map((item) => item.theme)])].sort(),
    [customItems],
  );
  const availableSuggestions = SUGGESTED_WORDS.filter(
    (suggestion) => !ITEMS.concat(customItems).some((item) => item.deck === suggestion.deck && item.kana === suggestion.kana),
  );

  function searchHumanRecording() {
    const query = [kana.trim(), meaning.trim(), 'Japanese pronunciation human recording'].filter(Boolean).join(' ');
    if (!kana.trim()) {
      setError('Enter the word first so the search can be specific.');
      return;
    }
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    setSearched(true);
    setError('');
  }

  function chooseSuggestion(suggestion) {
    setDeck(suggestion.deck);
    setKana(suggestion.kana);
    setMeaning(suggestion.meaning);
    setTheme(themes.includes(suggestion.theme) ? suggestion.theme : '__custom__');
    setCustomTheme(themes.includes(suggestion.theme) ? '' : suggestion.theme);
    setAccent(suggestion.accent);
    setSearched(false);
    setSearchResult('');
    setSourceUrl('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    setMessage('Generating the required female VOICEVOX recording…');
    let femaleAudioId = '';
    let humanAudioId = '';
    try {
      if (!searched) throw new Error('Use the human-recording search before adding this word.');
      if (searchResult !== 'found' && searchResult !== 'not-found') {
        throw new Error('Search for a human recording first, then select whether you found one.');
      }
      if (searchResult === 'found' && !sourceUrl.trim()) {
        throw new Error('Add the source link for the human recording you found.');
      }
      if (searchResult === 'not-found' && (audioUrl.trim() || humanFile)) {
        throw new Error('You supplied a human recording. Mark the search result as found and add its source link.');
      }
      if (humanFile && (!humanFile.type.startsWith('audio/') || humanFile.size > MAX_HUMAN_AUDIO_BYTES)) {
        throw new Error('Choose an audio file smaller than 10 MB.');
      }
      const selectedTheme = theme === '__custom__' ? customTheme : theme;
      if ([...ITEMS, ...customItems].some((item) => item.deck === deck && item.kana === kana.trim())) {
        throw new Error('That word is already in this deck.');
      }
      const id = `custom:${crypto.randomUUID()}`;
      const record = createCustomWord({
        id,
        deck,
        kana,
        meaning,
        theme: selectedTheme,
        accent,
        sourceUrl: searchResult === 'found' ? sourceUrl.trim() : '',
        audioUrl: audioUrl.trim(),
        femaleAudioId: `${id}:female`,
        humanAudioId: humanFile ? `${id}:human` : '',
      });

      const femaleAudio = await synthesizeFemaleWord(record.kana, record.accent);
      femaleAudioId = record.femaleAudioId;
      await saveCustomAudio(femaleAudioId, femaleAudio);
      if (humanFile) {
        humanAudioId = record.humanAudioId;
        await saveCustomAudio(humanAudioId, humanFile);
      }
      onAdd(record);
      setCustomTheme('');
      setKana('');
      setMeaning('');
      setAccent('');
      setSearched(false);
      setSearchResult('');
      setSourceUrl('');
      setAudioUrl('');
      setHumanFile(null);
      form.reset();
      setMessage(`${record.kana} added with female VOICEVOX audio.`);
    } catch (caught) {
      const problem = caught instanceof Error ? caught.message : 'The word could not be saved.';
      const savedAudioIds = [femaleAudioId, humanAudioId].filter(Boolean);
      if (!savedAudioIds.length) {
        setError(problem);
      } else {
        try {
          await deleteCustomAudio(savedAudioIds);
          setError(problem);
        } catch (cleanupError) {
          const cleanupProblem = cleanupError instanceof Error ? cleanupError.message : 'Audio cleanup failed.';
          setError(`${problem} ${cleanupProblem}`);
        }
      }
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Remove ${item.kana} from this browser's custom deck?`)) return;
    try {
      await deleteCustomAudio([item.femaleAudioId, item.humanAudioId]);
      onDelete(item.id);
      setError('');
      setMessage(`${item.kana} removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The word could not be removed.');
    }
  }

  return (
    <section className="panel" id="page-add">
      <div className="card add-words-card">
        <div className="add-words-intro">
          <div>
            <h2>Add a word</h2>
            <p className="hint">Saved in this browser · Search for a human recording first.</p>
          </div>
        </div>

        <form className="add-word-form" onSubmit={submit}>
          <div className="add-word-fields">
            <label>
              Word
              <input className="word-input jp" value={kana} onChange={(event) => { setKana(event.target.value); setSearched(false); setSearchResult(''); setSourceUrl(''); }} placeholder={deck === 'hira' ? 'むずかしい' : 'コロナウイルス'} required />
            </label>
            <label>
              Meaning
              <input value={meaning} onChange={(event) => { setMeaning(event.target.value); setSearched(false); setSearchResult(''); setSourceUrl(''); }} placeholder="English meaning" required />
            </label>
            <label>
              Deck
              <select value={deck} onChange={(event) => { setDeck(event.target.value); setSearched(false); setSearchResult(''); setSourceUrl(''); }}>
                <option value="hira">Hiragana</option>
                <option value="kata">Katakana</option>
              </select>
            </label>
            <label>
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                {themes.map((value) => <option key={value} value={value}>{value}</option>)}
                <option value="__custom__">Add a theme…</option>
              </select>
            </label>
            {theme === '__custom__' && (
              <label>
                New theme
                <input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} required />
              </label>
            )}
          </div>

          <fieldset className="human-search">
            <legend>Human recording</legend>
            <button className="btn search-recording" type="button" onClick={searchHumanRecording}>Search first ↗</button>
            <div className="choice-group search-results" aria-label="Search result">
              <label className={`choice-button search-result${searchResult === 'found' ? ' selected' : ''}`}>
                <input type="radio" name="human-search-result" value="found" checked={searchResult === 'found'} onChange={() => setSearchResult('found')} disabled={!searched} required />
                <span>Found one</span>
              </label>
              <label className={`choice-button search-result${searchResult === 'not-found' ? ' selected' : ''}`}>
                <input type="radio" name="human-search-result" value="not-found" checked={searchResult === 'not-found'} onChange={() => setSearchResult('not-found')} disabled={!searched} />
                <span>None found</span>
              </label>
            </div>
          </fieldset>

          {searchResult === 'found' && (
            <label className="source-link">
              Recording source
              <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" required />
            </label>
          )}

          <details className="add-word-options">
            <summary>Optional: pitch and human audio</summary>
            <div className="add-word-fields">
              <label>
                Pitch accent
                <input type="number" min="0" max={wordMoras.length || undefined} step="1" value={accent} onChange={(event) => setAccent(event.target.value)} placeholder="Unknown" />
                <small>0 = flat; otherwise enter the drop mora.</small>
              </label>
              <label>
                Direct audio link
                <input type="url" value={audioUrl} onChange={(event) => setAudioUrl(event.target.value)} placeholder="https://…" />
              </label>
              <label>
                Audio file (max 10 MB)
                <input type="file" accept="audio/*" onChange={(event) => setHumanFile(event.target.files?.[0] || null)} />
              </label>
            </div>
          </details>

          <details className="voicevox-info">
            <summary>Female audio is generated automatically</summary>
            <p>Requires VOICEVOX Engine running locally at 127.0.0.1:50021 with browser CORS enabled.</p>
          </details>
          <button className="btn primary add-word-submit" type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate audio & add word'}</button>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message" role="status">{message}</p>}
        </form>

        {availableSuggestions.length > 0 && (
          <details className="suggested-words">
            <summary>Challenging suggestions <span>{availableSuggestions.length}</span></summary>
            <div className="suggested-word-list">
              {availableSuggestions.map((suggestion) => (
                <button className="choice-button" type="button" key={`${suggestion.deck}:${suggestion.kana}`} onClick={() => chooseSuggestion(suggestion)}>
                  <span className="jp">{suggestion.kana}</span><small>{suggestion.deck === 'hira' ? 'Hiragana' : 'Katakana'}</small>
                </button>
              ))}
            </div>
          </details>
        )}

        {customItems.length > 0 && (
          <details className="custom-word-list">
            <summary>Your words <span>{customItems.length}</span></summary>
            <ul>
              {customItems.map((item) => (
                <li key={item.id}>
                  <span className="jp">{item.kana}</span>
                  <span>{item.en}</span>
                  <small>{item.deck === 'hira' ? 'Hiragana' : 'Katakana'} · {item.theme}</small>
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Human recording source</a>}
                  <button className="btn quiet" type="button" onClick={() => remove(item)}>Remove</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
