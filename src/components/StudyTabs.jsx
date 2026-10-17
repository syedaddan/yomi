import React, { useEffect, useState } from 'react';
import { median, romaji } from '../core.js';
import { DECK_NAMES, ITEMS, LOOKALIKE_SETS } from '../data.js';

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function pickQuestion(script, confusions) {
  const sets = LOOKALIKE_SETS.filter((set) => script === 'both' || set.script === script);
  const set = sets[Math.floor(Math.random() * sets.length)];
  const weights = set.glyphs.map((glyph) => {
    const progress = confusions[glyph] || {};
    return 1 + 2 * (progress.miss || 0) / Math.max(1, progress.n || 0);
  });
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let glyph = set.glyphs[0];
  for (let index = 0; index < set.glyphs.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) { glyph = set.glyphs[index]; break; }
  }
  return { glyph, choices: shuffle(set.glyphs), startedAt: performance.now() };
}

function LookalikeTab({ store, setStore, active }) {
  const script = store.prefs.alikeScript || 'both';
  const [round, setRound] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setRound(null);
    setLocked(false);
  }, [script]);

  function startRound() {
    setRound({ index: 0, total: 20, correct: 0, times: [], pairs: {}, question: pickQuestion(script, store.conf), done: false });
  }

  function answer(choice) {
    if (!round || round.done || locked) return;
    setLocked(true);
    const { question } = round;
    const correct = choice === question.glyph;
    const elapsed = performance.now() - question.startedAt;
    const pair = `${question.glyph}>${choice}`;
    setStore((current) => {
      const previous = current.conf[question.glyph] || { n: 0, miss: 0, rt: [] };
      return {
        ...current,
        conf: {
          ...current.conf,
          [question.glyph]: {
            ...previous,
            n: previous.n + 1,
            miss: previous.miss + Number(!correct),
            rt: [...(previous.rt || []), Math.round(elapsed)].slice(-8),
          },
          ...(!correct ? { [`pair:${pair}`]: (current.conf[`pair:${pair}`] || 0) + 1 } : {}),
        },
      };
    });
    setRound((current) => ({
      ...current,
      correct: current.correct + Number(correct),
      times: [...current.times, elapsed],
      pairs: correct ? current.pairs : { ...current.pairs, [pair]: (current.pairs[pair] || 0) + 1 },
      feedback: { correct, choice },
    }));
    window.setTimeout(() => {
      setRound((current) => {
        const nextIndex = current.index + 1;
        if (nextIndex >= current.total) return { ...current, index: nextIndex, done: true };
        return { ...current, index: nextIndex, question: pickQuestion(script, store.conf), feedback: null };
      });
      setLocked(false);
    }, correct ? 450 : 1100);
  }

  useEffect(() => {
    if (!active) return undefined;
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea')) return;
      if (!round || round.done) {
        if (event.key === ' ') { event.preventDefault(); startRound(); }
        return;
      }
      const choiceIndex = Number(event.key) - 1;
      if (choiceIndex >= 0 && choiceIndex < round.question.choices.length) answer(round.question.choices[choiceIndex]);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, round, script, locked]);

  const worst = round?.done ? Object.entries(round.pairs).sort((a, b) => b[1] - a[1])[0] : null;

  return (
    <section className="panel" id="page-alike">
      <div className="stack">
        <div className="card stage" id="alike-stage" aria-live="polite">
          {!round || round.done ? (
            <div className="stage-main">
              <div className="stage-top"><span>Look-alikes · {round?.done ? 'done' : '20 questions'}</span></div>
              <h2>{round?.done ? 'Round finished' : 'Separate the characters you mix up'}</h2>
              {round?.done ? (
                <>
                  <div className="summary">
                    <div className="stat"><b>{Math.round(100 * round.correct / round.total)}%</b><span>accuracy</span></div>
                    <div className="stat"><b>{(median(round.times) / 1000).toFixed(2)}s</b><span>median answer time</span></div>
                    <div className="stat"><b>{round.correct}/{round.total}</b><span>correct</span></div>
                  </div>
                  {worst
                    ? <p className="note">Most mixed up this round: <span className="jp">{worst[0].replace('>', ' → ')}</span> ({worst[1]}x).</p>
                    : <p className="note">No mix-ups this round.</p>}
                </>
              ) : (
                <p className="note">One character appears; pick its reading. Pairs you confuse show up more often in future rounds and Progress.</p>
              )}
              <button className="btn primary" id="alike-go" onClick={startRound}>{round?.done ? 'Another round' : 'Start'} <kbd>Space</kbd></button>
            </div>
          ) : (
            <>
              <div className="stage-top"><span>Question {round.index + 1} of {round.total}</span><span className="mono">{round.correct} right</span></div>
              <div className="stage-main">
                <div className="word" lang="ja">{round.question.glyph}</div>
                <div className="choices">
                  {round.question.choices.map((glyph, index) => (
                    <button
                      className={round.feedback?.choice === glyph ? (round.feedback.correct ? 'right' : 'wrong') : round.feedback && glyph === round.question.glyph ? 'right' : ''}
                      data-c={glyph}
                      key={glyph}
                      disabled={locked}
                      onClick={() => answer(glyph)}
                    >
                      {romaji(glyph)} <kbd className="mono">{index + 1}</kbd>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="card group">
          <h3>Look-alike sets</h3>
          <div className="setcards">
            {LOOKALIKE_SETS.map((set, index) => (
              <div className="setcard" key={`${set.script}-${index}`}>
                <div className="glyphs">{set.glyphs.map((glyph) => <span key={glyph}>{glyph}<small>{romaji(glyph)}</small></span>)}</div>
                {set.tip && <p>{set.tip}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressTab({ store, setStore, notify }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const ids = Object.keys(store.stats);
  const itemById = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
  const total = ids.reduce((sum, id) => sum + store.stats[id].n, 0);
  const got = ids.reduce((sum, id) => sum + store.stats[id].got, 0);
  const times = ids.flatMap((id) => store.stats[id].ms || []);
  const mora = ids.reduce((sum, id) => {
    const item = itemById[id];
    return sum + (item ? item.moraCount * (store.stats[id].ms || []).length : 0);
  }, 0);
  const elapsed = ids.reduce((sum, id) => sum + (store.stats[id].ms || []).reduce((a, b) => a + b, 0), 0);
  const trouble = ids.map((id) => ({ item: itemById[id], score: store.stats[id] }))
    .filter(({ item, score }) => item && score.n > 0 && score.miss + score.slow > 0)
    .sort((a, b) => ((b.score.miss * 2 + b.score.slow) / b.score.n) - ((a.score.miss * 2 + a.score.slow) / a.score.n))
    .slice(0, 10);
  const sprints = store.sprints.slice(-10);
  const highestSprint = Math.max(1, ...sprints.map((entry) => entry.mpm));
  const confusingPairs = Object.entries(store.conf).filter(([key]) => key.startsWith('pair:'))
    .sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <section className="panel" id="page-progress">
      <div className="stack" id="progress-body">
        <div className="card stack">
          <h2>Your reading so far</h2>
          {total ? (
            <div className="summary">
              <div className="stat"><b>{total}</b><span>cards rated</span></div>
              <div className="stat"><b>{Math.round(100 * got / total)}%</b><span>got it</span></div>
              <div className="stat"><b>{times.length ? `${(median(times) / 1000).toFixed(1)}s` : '–'}</b><span>median read time</span></div>
              <div className="stat"><b>{elapsed ? (mora / (elapsed / 1000)).toFixed(1) : '–'}</b><span>mora per second</span></div>
            </div>
          ) : <p className="empty">Nothing recorded yet. Rate a few cards in Drill and your numbers appear here. They are saved in this browser only.</p>}
        </div>
        <div className="card stack">
          <h2>Decks</h2>
          <div className="scroll-x"><table><thead><tr><th>Deck</th><th className="num">Seen</th><th className="num">Got it</th></tr></thead><tbody>
            {['hira', 'kata', 'phr'].map((deck) => {
              const items = ITEMS.filter((item) => item.deck === deck);
              const seen = items.filter((item) => store.stats[item.id]);
              const ratings = seen.reduce((sum, item) => sum + store.stats[item.id].n, 0);
              const successes = seen.reduce((sum, item) => sum + store.stats[item.id].got, 0);
              return <tr key={deck}><td>{DECK_NAMES[deck]}s</td><td className="num">{seen.length} / {items.length}</td><td className="num">{ratings ? `${Math.round(100 * successes / ratings)}%` : '–'}</td></tr>;
            })}
          </tbody></table></div>
        </div>
        <div className="card stack">
          <h2>Needs work</h2>
          {trouble.length ? (
            <div className="scroll-x"><table><thead><tr><th>Card</th><th>Meaning</th><th className="num">Missed</th><th className="num">Slow</th><th className="num">Seen</th></tr></thead><tbody>
              {trouble.map(({ item, score }) => <tr key={item.id}><td className="jp">{item.text}</td><td>{item.en}</td><td className="num">{score.miss}</td><td className="num">{score.slow}</td><td className="num">{score.n}</td></tr>)}
            </tbody></table></div>
          ) : <p className="hint">Nothing flagged yet.</p>}
        </div>
        <div className="card stack">
          <h2>Sprints (mora per minute)</h2>
          {sprints.length ? <><div className="bars" role="img" aria-label={`Last ${sprints.length} sprints`}>
            {sprints.map((run, index) => <div key={`${run.t}-${index}`} style={{ height: `${Math.max(4, Math.round(100 * run.mpm / highestSprint))}%` }}><span>{run.mpm}</span></div>)}
          </div><p className="hint">Oldest on the left. Each bar is one 60-second sprint.</p></> : <p className="hint">No sprints yet. Try Sprint mode in Drill.</p>}
        </div>
        <div className="card stack">
          <h2>Characters you mix up</h2>
          {confusingPairs.length ? <div className="scroll-x"><table><thead><tr><th>You saw → you picked</th><th className="num">Times</th></tr></thead><tbody>
            {confusingPairs.map(([pair, count]) => <tr key={pair}><td className="jp">{pair.slice(5).replace('>', ' → ')}</td><td className="num">{count}</td></tr>)}
          </tbody></table></div> : <p className="hint">Run a Look-alikes round to see which pairs trip you up.</p>}
        </div>
        <div className="card stack">
          <h2>Reset</h2>
          <div className="confirm-row">
            {confirmReset ? <>
              <span>Erase all saved progress on this device?</span>
              <button className="btn miss" onClick={() => { setStore((current) => ({ ...current, stats: {}, sprints: [], conf: {} })); setConfirmReset(false); notify('Progress erased.'); }}>Yes, erase it</button>
              <button className="btn" onClick={() => setConfirmReset(false)}>Keep it</button>
            </> : <button className="btn" onClick={() => setConfirmReset(true)}>Reset progress</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

function KanjiTab() {
  return (
    <section className="panel" id="page-kanji">
      <div className="card stack">
        <h2>Kanji decks are not filled yet</h2>
        <p className="note">This is where kanji will plug in. Future cards can show furigana, on/kun readings, and mix into the kana decks.</p>
        <div className="kanji-slot">
          <div><span className="jp">日</span>Words with kanji</div>
          <div><span className="jp">本</span>Readings (on / kun)</div>
          <div><span className="jp">学</span>Look-alike kanji</div>
        </div>
      </div>
    </section>
  );
}

export { KanjiTab, LookalikeTab, ProgressTab };
