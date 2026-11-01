import React, { useMemo, useState } from 'react';
import kanjiDeck from '../../out/kanji.json';
import { romaji } from '../core.js';
import { getUnlockedKanjiGroups } from '../storage.js';
import { PitchLine } from './shared.jsx';

function ReadingList({ label, readings }) {
  return (
    <div className="kanji-reading-group">
      <h4>{label}</h4>
      {readings.length ? (
        <ul>
          {readings.map((reading) => (
            <li key={reading}>
              <span lang="ja">{reading}</span>
              <small>{romaji(reading.replace(/[.-]/g, ''))}</small>
            </li>
          ))}
        </ul>
      ) : <p className="hint">No reading listed</p>}
    </div>
  );
}

function KanjiExample({ word, showFurigana, showRomaji, showMarks }) {
  return (
    <article className="kanji-example">
      <div className="kanji-example-head">
        <span className="kanji-example-word" lang="ja">
          {showFurigana
            ? <ruby>{word.word}<rt>{word.reading}</rt></ruby>
            : word.word}
        </span>
        <span className="kanji-example-meaning">{word.meaning}</span>
      </div>
      <PitchLine
        item={{ deck: 'kanji', chunks: [{ w: word.reading, p: '', a: word.accents[0] }] }}
        showRomaji={showRomaji}
        showMarks={showMarks}
      />
      {word.accents.length > 1 && (
        <p className="hint">Kanjium also lists pitch accent {word.accents.slice(1).map((accent) => `[${accent}]`).join(', ')}.</p>
      )}
    </article>
  );
}

export default function KanjiDeck({ prefs, unlockedGroupIds, onUnlockNext }) {
  const unlocked = getUnlockedKanjiGroups(unlockedGroupIds, kanjiDeck.groups);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(unlocked[unlocked.length - 1]);
  const activeGroup = kanjiDeck.groups.find((group) => group.id === selectedGroupId && unlocked.includes(group.id))
    || kanjiDeck.groups.find((group) => group.id === unlocked[unlocked.length - 1]);
  const nextGroup = kanjiDeck.groups[unlocked.length] || null;
  const lessonGroups = kanjiDeck.groups.filter((group) => !group.additional);
  const lessonGroupIndex = lessonGroups.findIndex((group) => group.id === activeGroup.id);
  const lessonCharacterCount = lessonGroups.reduce((count, group) => count + group.characters.length, 0);
  const extraCharacterCount = kanjiDeck.kanji.length - lessonCharacterCount;
  const cards = useMemo(() => {
    const groupCards = kanjiDeck.kanji.filter((entry) => entry.groupId === activeGroup.id);
    const search = query.trim().toLocaleLowerCase();
    if (!search) return groupCards;
    return groupCards.filter((entry) => {
      const searchable = [
        entry.character,
        ...entry.meanings,
        ...entry.on,
        ...entry.kun,
        ...entry.words.flatMap((word) => [word.word, word.reading, word.meaning]),
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(search);
    });
  }, [activeGroup.id, query]);
  const card = cards[index] || cards[0];

  function resetCards() {
    setIndex(0);
    setRevealed(false);
  }

  function changeSearch(value) {
    setQuery(value);
    resetCards();
  }

  function moveCard(nextIndex) {
    setIndex(nextIndex);
    setRevealed(false);
  }

  function changeGroup(groupId) {
    setSelectedGroupId(groupId);
    setQuery('');
    resetCards();
  }

  function unlockGroup() {
    if (nextGroup && onUnlockNext()) changeGroup(nextGroup.id);
  }

  return (
    <section className="panel" id="page-kanji">
      <div className="stack">
        <div className="card kanji-deck">
          <div className="kanji-deck-heading">
            <div>
              <div className="stage-top">
                <span>{activeGroup.additional
                  ? 'Previously included extras'
                  : `Kanji lessons · Group ${lessonGroupIndex + 1} of ${lessonGroups.length}`}</span>
                <span className="mono">{activeGroup.characters.length} characters</span>
              </div>
              <h2>Practice one lesson group at a time</h2>
            </div>
            <label className="kanji-furigana-toggle">
              <span>Furigana</span>
              <button
                type="button"
                className="choice-button"
                aria-pressed={showFurigana}
                onClick={() => setShowFurigana((value) => !value)}
              >{showFurigana ? 'On' : 'Off'}</button>
            </label>
          </div>
          <div className="kanji-group-controls">
            <label className="kanji-search">
              <span>Lesson group</span>
              <select value={activeGroup.id} onChange={(event) => changeGroup(event.target.value)}>
                {kanjiDeck.groups.map((group, groupPosition) => (
                  <option
                    key={group.id}
                    value={group.id}
                    disabled={!unlocked.includes(group.id)}
                  >
                    {group.additional
                      ? `Extra · ${group.characters.join('')}`
                      : `Group ${groupPosition + 1} · ${group.characters.join('')}`}
                    {!unlocked.includes(group.id) ? ' · Locked' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="kanji-unlock">
              <p className="hint">
                {unlocked.length} of {kanjiDeck.groups.length} groups unlocked · {lessonCharacterCount} lesson kanji
                {extraCharacterCount ? ` + ${extraCharacterCount} from the previous deck` : ''}
              </p>
              {nextGroup ? (
                <button type="button" className="btn primary" onClick={unlockGroup}>
                  Unlock next group ({nextGroup.characters.length} kanji)
                </button>
              ) : (
                <p className="hint">All lesson groups unlocked.</p>
              )}
            </div>
            <p className="hint kanji-source">Source: {activeGroup.sourceTitle}</p>
          </div>
          <label className="kanji-search">
            <span>Search this group by kanji, reading, or example word</span>
            <input
              type="search"
              value={query}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Try 学, がくせい, or student"
            />
          </label>

          {!card ? (
            <p className="empty">No kanji in this group match that search.</p>
          ) : (
            <>
              <div className="kanji-card" aria-live="polite">
                <div className="kanji-card-status">
                  <span>Character {index + 1} of {cards.length}</span>
                  <span className="hint">{card.grade ? `Kyoiku grade ${card.grade}` : 'Lesson list'}</span>
                </div>
                <div className="kanji-prompt" lang="ja">{card.character}</div>
                <button type="button" className="btn primary" onClick={() => setRevealed((value) => !value)}>
                  {revealed ? 'Hide answer' : 'Show readings and words'}
                </button>
                {revealed && (
                  <div className="kanji-answer">
                    <p className="kanji-meaning">{card.meanings.join(' · ')}</p>
                    <div className="kanji-reading-grid">
                      <ReadingList label="On'yomi" readings={card.on} />
                      <ReadingList label="Kun'yomi" readings={card.kun} />
                    </div>
                    <div className="kanji-examples-heading">
                      <h3>Words with {card.character}</h3>
                      <span className="hint">{card.words.length} examples · pitch accents from Kanjium</span>
                    </div>
                    <div className="kanji-examples">
                      {card.words.map((word) => (
                        <KanjiExample
                          key={`${word.word}-${word.reading}`}
                          word={word}
                          showFurigana={showFurigana}
                          showRomaji={prefs.romaji}
                          showMarks={prefs.marks}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="kanji-navigation">
                <button type="button" className="btn" disabled={index === 0} onClick={() => moveCard(index - 1)}>Previous</button>
                <button type="button" className="btn primary" disabled={index >= cards.length - 1} onClick={() => moveCard(index + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
        <p className="kanji-attribution">
          Character readings and meanings: <a href="https://www.edrdg.org/kanjidic/kanjidic2.xml" target="_blank" rel="noopener noreferrer">KANJIDIC2</a>
          {' '}© EDRDG, CC BY-SA 4.0. Example vocabulary and pitch accents: <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>
          {' '}by Uros O., CC BY-SA 4.0.
        </p>
      </div>
    </section>
  );
}
