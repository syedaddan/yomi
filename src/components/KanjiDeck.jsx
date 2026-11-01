import React, { useMemo, useState } from 'react';
import kanjiDeck from '../../out/kanji.json';
import AudioButtons from './AudioButtons.jsx';
import { romaji } from '../core.js';
import { getUnlockedKanjiGroups } from '../storage.js';
import { PitchLine } from './shared.jsx';

const LICENSE_URLS = {
  'CC BY 2.0 FR': 'https://creativecommons.org/licenses/by/2.0/fr/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
};

function LicenseReference({ license }) {
  if (!license) return null;
  const url = LICENSE_URLS[license];
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer">{license}</a>
    : license;
}

function SentenceAttribution({ sentence }) {
  const { source, translationAttribution } = sentence;
  const audioAttribution = sentence.audio?.audioAttribution;
  if (!source && !translationAttribution && !audioAttribution) return null;

  return (
    <span className="kanji-credit-lines">
      {source?.provider === 'Tatoeba' ? (
        <span>
          Sentence: <a href={sentence.sourceUrl} target="_blank" rel="noopener noreferrer">
            {source.author || 'Tatoeba contributor'}
          </a>{source.license && <> (<LicenseReference license={source.license} />)</>}
        </span>
      ) : source?.provider === 'Yomi' ? (
        <span>Original practice sentence by Yomi.</span>
      ) : null}
      {translationAttribution && (
        <span>
          Translation: <a href={translationAttribution.url} target="_blank" rel="noopener noreferrer">
            {translationAttribution.author || 'Tatoeba contributor'}
          </a>{translationAttribution.license && <> (<LicenseReference license={translationAttribution.license} />)</>}
        </span>
      )}
      {audioAttribution && (
        <span>
          Recording: <a href={audioAttribution.url} target="_blank" rel="noopener noreferrer">
            {audioAttribution.author || 'Tatoeba contributor'}
          </a>{audioAttribution.license && <> (<LicenseReference license={audioAttribution.license} />)</>}
        </span>
      )}
    </span>
  );
}

function ReadingList({ label, readings, audio, showRomaji, notify }) {
  return (
    <div className="kanji-reading-group">
      <h4>{label}</h4>
      {readings.length ? (
        <ul>
          {readings.map((reading) => (
            <li key={reading}>
              <span lang="ja">{reading}</span>
              {showRomaji && <small>{romaji(reading.replace(/[.-]/g, ''))}</small>}
              <AudioButtons item={audio?.[reading]} label={reading} onError={notify} />
            </li>
          ))}
        </ul>
      ) : <p className="hint">No reading listed</p>}
    </div>
  );
}

function KanjiExample({ word, showFurigana, showRomaji, showMarks, notify }) {
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
      {word.sentence && (
        <div className="kanji-reibun">
          <p lang="ja">{word.sentence.text}</p>
          {word.sentence.translation && <small>{word.sentence.translation}</small>}
          <AudioButtons
            item={word.sentence.audio}
            label={`example sentence for ${word.word}`}
            onError={notify}
            infoContent={<SentenceAttribution sentence={word.sentence} />}
          />
          {word.sentence.sourceUrl && (
            <a className="kanji-sentence-source" href={word.sentence.sourceUrl} target="_blank" rel="noopener noreferrer">Tatoeba</a>
          )}
        </div>
      )}
      {word.accents.length > 1 && (
        <p className="hint">Kanjium also lists pitch accent {word.accents.slice(1).map((accent) => `[${accent}]`).join(', ')}.</p>
      )}
    </article>
  );
}

export default function KanjiDeck({ prefs, unlockedGroupIds, onUnlockNext, notify }) {
  const unlocked = getUnlockedKanjiGroups(unlockedGroupIds, kanjiDeck.groups);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(unlocked[unlocked.length - 1]);
  const activeGroup = kanjiDeck.groups.find((group) => group.id === selectedGroupId && unlocked.includes(group.id))
    || kanjiDeck.groups.find((group) => group.id === unlocked[unlocked.length - 1]);
  const nextGroup = kanjiDeck.groups[unlocked.length] || null;
  const lessonGroups = kanjiDeck.groups.filter((group) => !group.additional);
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
            <h2>Kanji practice</h2>
          </div>
          <div className="kanji-group-controls">
            <label className="kanji-search">
              <span>Lesson</span>
              <select value={activeGroup.id} onChange={(event) => changeGroup(event.target.value)}>
                {kanjiDeck.groups.map((group, groupPosition) => (
                  <option
                    key={group.id}
                    value={group.id}
                    disabled={!unlocked.includes(group.id)}
                  >
                    {group.additional
                      ? 'Extras'
                      : `Lesson ${groupPosition + 1}`}
                    {!unlocked.includes(group.id) ? ' · Locked' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="kanji-unlock">
              <p className="hint">{Math.min(unlocked.length, lessonGroups.length)} / {lessonGroups.length} unlocked</p>
              {nextGroup ? (
                <button type="button" className="btn primary" onClick={unlockGroup}>
                  {nextGroup.additional ? 'Unlock extras' : 'Unlock next lesson'}
                </button>
              ) : (
                <p className="hint">All lessons unlocked</p>
              )}
            </div>
          </div>
          <details className="kanji-search-disclosure">
            <summary>Search this lesson</summary>
            <label className="kanji-search">
              <span>Kanji, reading, or word</span>
              <input
                type="search"
                value={query}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Search"
              />
            </label>
          </details>

          {!card ? (
            <p className="empty">No kanji in this group match that search.</p>
          ) : (
            <>
              <div className="kanji-card" aria-live="polite">
                <div className="kanji-card-status">
                  <span>{index + 1} / {cards.length}</span>
                </div>
                <div className="kanji-prompt-row">
                  <div className="kanji-prompt" lang="ja">{card.character}</div>
                  <AudioButtons item={card.audio?.character} label={card.character} onError={notify} />
                </div>
                <button type="button" className="btn primary" onClick={() => setRevealed((value) => !value)}>
                  {revealed ? 'Hide answer' : 'Show answer'}
                </button>
                {revealed && (
                  <div className="kanji-answer">
                    <p className="kanji-meaning">{card.meanings.join(' · ')}</p>
                    <div className="kanji-reading-grid">
                      <ReadingList label="On'yomi" readings={card.on} audio={card.audio?.readings} showRomaji={prefs.romaji} notify={notify} />
                      <ReadingList label="Kun'yomi" readings={card.kun} audio={card.audio?.readings} showRomaji={prefs.romaji} notify={notify} />
                    </div>
                    <div className="kanji-examples-heading">
                      <h3>Examples</h3>
                    </div>
                    <div className="kanji-examples">
                      {card.words.map((word) => (
                        <KanjiExample
                          key={`${word.word}-${word.reading}`}
                          word={word}
                          showFurigana={prefs.furigana}
                          showRomaji={prefs.romaji}
                          showMarks={prefs.marks}
                          notify={notify}
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
          <a href="https://www.edrdg.org/kanjidic/kanjidic2.xml" target="_blank" rel="noopener noreferrer">KANJIDIC2</a>
          {' '}© EDRDG · <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>
          {' '}© Uros O. · CC BY-SA 4.0
        </p>
      </div>
    </section>
  );
}
