import React, { useMemo, useState } from 'react';
import { DECK_NAMES } from '../data.js';
import { validateDeckItem } from '../deckCatalog.js';

const DECKS = Object.keys(DECK_NAMES);

function blankItem(deck) {
  return {
    deck,
    theme: 'New',
    en: '',
    audio: null,
    alt: null,
    ttsF: null,
    chunks: [{ w: '', p: '', a: null, src: 'dict' }],
    q: false,
    accents: [],
  };
}

function japaneseText(item) {
  return (item.chunks || []).map((chunk) => `${chunk.w || ''}${chunk.p || ''}`).join('');
}

export default function DeckAdmin({
  items,
  loadError,
  onSaveItem,
  onDeleteItem,
  kanjiGroups = [],
  kanjiUnlockedCount = 1,
  onUnlockNextLesson,
  onLockLastLesson,
}) {
  const [deck, setDeck] = useState('hira');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [kanjiBusy, setKanjiBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedItems = useMemo(() => items
    .filter((item) => item.deck === deck)
    .filter((item) => `${japaneseText(item)} ${item.en} ${item.theme}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => japaneseText(left).localeCompare(japaneseText(right), 'ja')), [items, deck, query]);

  function startNew() {
    setEditingId(`admin:${crypto.randomUUID()}`);
    setDraft(JSON.stringify(blankItem(deck), null, 2));
    setError('');
    setMessage('');
  }

  function startEdit(item) {
    setEditingId(item.id);
    setDraft(JSON.stringify(item, null, 2));
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId('');
    setDraft('');
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let parsed;
      try {
        parsed = JSON.parse(draft);
      } catch {
        throw new Error('Check the JSON syntax and try again.');
      }
      const item = validateDeckItem(parsed, editingId, deck);
      await onSaveItem(item);
      setEditingId('');
      setDraft('');
      setMessage(`${japaneseText(item)} saved. It is now available to everyone.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this deck item.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Remove ${japaneseText(item)} from the shared ${DECK_NAMES[deck]} deck for everyone?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await onDeleteItem(item.id);
      if (editingId === item.id) cancelEdit();
      setMessage(`${japaneseText(item)} removed from the shared deck.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this deck item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (kanjiBusy) return;
    setKanjiBusy(true);
    try {
      await onUnlockNextLesson?.();
    } finally {
      setKanjiBusy(false);
    }
  }

  async function handleLock() {
    if (kanjiBusy) return;
    setKanjiBusy(true);
    try {
      await onLockLastLesson?.();
    } finally {
      setKanjiBusy(false);
    }
  }

  const nextGroup = kanjiGroups[kanjiUnlockedCount];
  const nextLabel = nextGroup ? (nextGroup.additional ? 'Extras' : `Lesson ${kanjiUnlockedCount + 1}`) : '';
  const lastGroup = kanjiGroups[kanjiUnlockedCount - 1];
  const lastLabel = lastGroup ? (lastGroup.additional ? 'Extras' : `Lesson ${kanjiUnlockedCount}`) : '';

  return (
    <div className="deck-admin stack">
      <header className="card deck-admin-heading">
        <div>
          <h1>Curriculum & Decks</h1>
          <p className="hint">Administer shared Kanji lesson access and manage shared vocabulary decks for all learners.</p>
        </div>
      </header>

      {/* Section 1: Kanji Curriculum Controls */}
      <details className="card deck-admin-section" open>
        <summary className="deck-admin-section-summary">
          <div className="deck-admin-section-title">
            <h2>Kanji Lessons</h2>
            <span className="badge good">{kanjiUnlockedCount} / {kanjiGroups.length} unlocked</span>
          </div>
          <span className="hint">Click to collapse / expand</span>
        </summary>
        <div className="deck-admin-kanji-body">
          <p className="hint">
            Kanji lessons are ordered sequentially. Unlocking publishes a lesson globally; locking hides it from learners. At least Lesson 1 remains unlocked.
          </p>
          <div className="confirm-row">
            <button
              className="btn primary"
              type="button"
              disabled={kanjiBusy || kanjiUnlockedCount >= kanjiGroups.length}
              onClick={handleUnlock}
            >
              {kanjiBusy ? 'Updating…' : kanjiUnlockedCount >= kanjiGroups.length ? 'All lessons unlocked' : `Unlock next (${nextLabel})`}
            </button>
            <button
              className="btn miss"
              type="button"
              disabled={kanjiBusy || kanjiUnlockedCount <= 1}
              onClick={handleLock}
            >
              {kanjiBusy ? 'Updating…' : `Lock last (${lastLabel})`}
            </button>
          </div>

          <div className="deck-admin-kanji-grid" role="region" aria-label="Kanji lessons overview">
            {kanjiGroups.map((group, index) => {
              const isUnlocked = index < kanjiUnlockedCount;
              const label = group.additional ? 'Extras' : `Lesson ${index + 1}`;
              return (
                <div key={group.id} className={`deck-admin-kanji-card${isUnlocked ? ' is-unlocked' : ' is-locked'}`}>
                  <div className="deck-admin-kanji-card-head">
                    <b>{label}</b>
                    <span className={`badge ${isUnlocked ? 'good' : 'warn'}`}>
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className="deck-admin-kanji-chars jp" title={(group.characters || []).join(' ')}>
                    {(group.characters || []).join(' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {/* Section 2: Shared Kana and Phrases */}
      <details className="card deck-admin-section" open>
        <summary className="deck-admin-section-summary">
          <div className="deck-admin-section-title">
            <h2>Kana & Phrase Decks</h2>
            <span className="badge">{items.length} items</span>
          </div>
          <span className="hint">Click to collapse / expand</span>
        </summary>
        <div className="deck-admin-catalog-body">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <p className="hint">Changes here update the shared Hiragana, Katakana, and phrase decks for everyone.</p>
            <button className="btn primary" type="button" onClick={startNew} disabled={Boolean(loadError) || busy}>Add item</button>
          </div>

          {loadError && <p className="form-message error" role="alert">{loadError}</p>}
          <div className="deck-admin-controls">
            <label>
              Deck
              <select value={deck} onChange={(event) => { setDeck(event.target.value); cancelEdit(); }}>
                {DECKS.map((key) => <option value={key} key={key}>{DECK_NAMES[key]}</option>)}
              </select>
            </label>
            <label>
              Search items
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Japanese, meaning, or theme" />
            </label>
          </div>

          {editingId && (
            <form className="deck-item-editor" onSubmit={save}>
              <h2>{items.some((item) => item.id === editingId) ? 'Edit deck item' : 'Add deck item'}</h2>
              <label>
                Item data
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={16}
                  spellCheck="false"
                  aria-describedby="deck-json-help"
                />
              </label>
              <p id="deck-json-help" className="hint">Edit the complete item as JSON. Keep <code>chunks</code>, <code>en</code>, and <code>theme</code>; recording paths, pitch, and timing data can also be edited here.</p>
              {error && <p className="form-message error" role="alert">{error}</p>}
              <div className="deck-admin-actions">
                <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button>
                <button className="btn quiet" type="button" onClick={cancelEdit} disabled={busy}>Cancel</button>
              </div>
            </form>
          )}

          {error && !editingId && <p className="form-message error" role="alert">{error}</p>}
          {message && <p className="form-message" role="status">{message}</p>}
          <ul className="deck-admin-list">
            {selectedItems.map((item) => (
              <li key={item.id}>
                <div className="deck-admin-item-copy">
                  <span className="jp">{japaneseText(item)}</span>
                  <span>{item.en}</span>
                  <small>{item.theme}</small>
                </div>
                <div className="deck-admin-item-actions">
                  <button className="btn quiet" type="button" onClick={() => startEdit(item)} disabled={busy}>Edit</button>
                  <button className="btn quiet" type="button" onClick={() => remove(item)} disabled={busy}>Remove</button>
                </div>
              </li>
            ))}
            {!selectedItems.length && <li className="hint">No items in this deck match your search.</li>}
          </ul>
        </div>
      </details>
    </div>
  );
}
