import React, { useMemo, useState } from 'react';
import kanjiDeck from '../../out/kanji.json';
import { romaji } from '../core.js';
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

export default function KanjiDeck({ prefs }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const cards = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return kanjiDeck.kanji;
    return kanjiDeck.kanji.filter((entry) => {
      const searchable = [
        entry.character,
        ...entry.meanings,
        ...entry.on,
        ...entry.kun,
        ...entry.words.flatMap((word) => [word.word, word.reading, word.meaning]),
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(search);
    });
  }, [query]);
  const card = cards[index] || cards[0];

  function changeSearch(value) {
    setQuery(value);
    setIndex(0);
    setRevealed(false);
  }

  function moveCard(nextIndex) {
    setIndex(nextIndex);
    setRevealed(false);
  }

  return (
    <section className="panel" id="page-kanji">
      <div className="stack">
        <div className="card kanji-deck">
          <div className="kanji-deck-heading">
            <div>
              <div className="stage-top"><span>Kanji deck · JLPT N5</span><span className="mono">{cards.length} characters</span></div>
              <h2>Read kanji in useful words</h2>
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
          <label className="kanji-search">
            <span>Find a kanji, reading, or example word</span>
            <input
              type="search"
              value={query}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Try 学, がくせい, or student"
            />
          </label>

          {!card ? (
            <p className="empty">No N5 kanji match that search.</p>
          ) : (
            <>
              <div className="kanji-card" aria-live="polite">
                <div className="kanji-card-status">
                  <span>Character {index + 1} of {cards.length}</span>
                  <span className="hint">{card.grade ? `Kyoiku grade ${card.grade}` : 'N5 list'}</span>
                </div>
                <div className="kanji-prompt" lang="ja">{card.character}</div>
                {!revealed ? (
                  <button type="button" className="btn primary" onClick={() => setRevealed(true)}>Show readings and words</button>
                ) : (
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
                <button type="button" className="btn" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Hide answer' : 'Reveal'}</button>
                <button type="button" className="btn primary" disabled={index >= cards.length - 1} onClick={() => moveCard(index + 1)}>Next</button>
              </div>
            </>
          )}
        </div>
        <p className="kanji-attribution">
          Character readings and meanings: <a href="https://www.edrdg.org/kanjidic/kanjidic2.xml" target="_blank" rel="noopener noreferrer">KANJIDIC2</a>
          {' '}© EDRDG, CC BY-SA 4.0. Pitch accents: <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener noreferrer">Kanjium</a>
          {' '}by Uros O., CC BY-SA 4.0.
        </p>
      </div>
    </section>
  );
}
