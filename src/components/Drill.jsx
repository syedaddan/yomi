import React, { useEffect, useMemo, useRef, useState } from 'react';
import { median, particleRomaji, romaji } from '../core.js';
import { DECK_NAMES, ITEMS } from '../data.js';
import { playItem, stopAudio } from '../audio.js';
import { PitchLine, VoiceButtons } from './shared.jsx';

const MODES = {
  read: 'Read the card aloud, then reveal. Your reading time is measured from the moment the card appears.',
  flash: 'The word appears briefly, then hides. Say it from memory, then reveal. Shorten the time as you improve.',
  sprint: 'Read as many cards as you can in 60 seconds. Tap Read it for each one you got, Misread for a slip.',
};
const SPRINT_MS = 60000;

function chooseItem(pool, stats, recent) {
  if (!pool.length) return null;
  const avoid = recent.slice(-Math.min(4, pool.length - 1));
  const candidates = pool.filter((item) => !avoid.includes(item.id));
  const weights = candidates.map((item) => {
    const score = stats[item.id];
    return score
      ? 1 + 4 * (score.miss / score.n) + 2 * (score.slow / score.n) - Math.min(0.7, score.got * 0.12)
      : 1.6;
  });
  let roll = Math.random() * weights.reduce((total, weight) => total + Math.max(0.2, weight), 0);
  const index = weights.findIndex((weight) => (roll -= Math.max(0.2, weight)) <= 0);
  const item = candidates[index < 0 ? candidates.length - 1 : index];
  recent.push(item.id);
  return item;
}

function cardText(item, spaced) {
  const chunks = item.chunks.map((chunk) => chunk.w + chunk.p);
  return item.deck === 'phr' && spaced ? chunks.join(' ') : chunks.join('');
}

export default function Drill({ prefs, setPreference, store, setStore, notify, active }) {
  const [history, setHistory] = useState([]);
  const [position, setPosition] = useState(-1);
  const [phase, setPhase] = useState('front');
  const [slow, setSlow] = useState(false);
  const [session, setSession] = useState({ n: 0, got: 0, slow: 0, miss: 0, mora: 0, ms: [] });
  const [sprint, setSprint] = useState(null);
  const recent = useRef([]);
  const initialized = useRef(false);
  const shownAt = useRef(performance.now());
  const pool = useMemo(
    () => ITEMS.filter((item) => prefs.decks[item.deck] &&
      (!prefs.themes.length || prefs.themes.includes(`${item.deck}|${item.theme}`))),
    [prefs.decks, prefs.themes],
  );
  const entry = history[position];
  const item = entry?.item || null;

  useEffect(() => {
    if (history.length || prefs.mode === 'sprint' || initialized.current) return;
    const first = chooseItem(pool, store.stats, recent.current);
    if (first) {
      initialized.current = true;
      setHistory([{ item: first, seen: false, rated: null, ms: 0 }]);
      setPosition(0);
      shownAt.current = performance.now();
    }
  }, [history.length, pool, prefs.mode, store.stats]);

  useEffect(() => {
    if (prefs.mode !== 'flash' || phase !== 'front' || !item) return undefined;
    const timer = window.setTimeout(() => setPhase('masked'), prefs.flashMs);
    return () => window.clearTimeout(timer);
  }, [item?.id, phase, prefs.flashMs, prefs.mode]);

  useEffect(() => {
    if (!sprint || sprint.finished) return undefined;
    const timer = window.setInterval(() => {
      const left = Math.max(0, SPRINT_MS - (performance.now() - sprint.startedAt));
      if (left === 0) {
        const total = sprint.read + sprint.miss;
        const key = Object.keys(prefs.decks).filter((deck) => prefs.decks[deck]).join('+') || 'none';
        const best = Math.max(0, ...store.sprints.filter((run) => run.key === key).map((run) => run.mpm));
        const summary = {
          read: sprint.read,
          mpm: sprint.mora,
          accuracy: total ? Math.round(100 * sprint.read / total) : 0,
          prevBest: best,
          missed: sprint.missed,
        };
        setSprint((current) => current ? { ...current, finished: true, summary } : current);
        setStore((current) => ({
          ...current,
          sprints: [...current.sprints, { t: Date.now(), key, read: sprint.read, miss: sprint.miss, mpm: sprint.mora }].slice(-40),
        }));
      } else {
        setSprint((current) => current ? { ...current, left } : current);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [sprint?.startedAt, sprint?.read, sprint?.miss, sprint?.mora, sprint?.missed, sprint?.finished, prefs.decks, store.sprints, setStore]);

  function resetDrill() {
    stopAudio();
    setSprint(null);
    setHistory([]);
    setPosition(-1);
    initialized.current = false;
    setPhase('front');
    setSession({ n: 0, got: 0, slow: 0, miss: 0, mora: 0, ms: [] });
    recent.current = [];
  }

  function goNext() {
    stopAudio();
    if (position < history.length - 1) {
      const nextPosition = position + 1;
      setPosition(nextPosition);
      setPhase(history[nextPosition].seen || history[nextPosition].rated ? 'revealed' : 'front');
      shownAt.current = performance.now();
      return;
    }
    const nextItem = chooseItem(pool, store.stats, recent.current);
    if (!nextItem) return;
    const nextEntry = { item: nextItem, seen: false, rated: null, ms: 0 };
    if (history.length >= 100) {
      setHistory((current) => [...current.slice(-99), nextEntry]);
      setPosition(99);
    } else {
      setHistory((current) => [...current, nextEntry]);
      setPosition(history.length);
    }
    setPhase('front');
    shownAt.current = performance.now();
  }

  function goBack() {
    if (prefs.mode === 'sprint' || sprint || position <= 0) return;
    stopAudio();
    const previous = position - 1;
    setPosition(previous);
    setPhase(history[previous].seen || history[previous].rated ? 'revealed' : 'front');
    shownAt.current = performance.now();
  }

  function reveal() {
    if (!item || phase === 'revealed') return;
    const elapsed = performance.now() - shownAt.current;
    setHistory((current) => current.map((card, index) =>
      index === position ? { ...card, seen: true, ms: elapsed } : card));
    setPhase('revealed');
    entry.ms = elapsed;
  }

  function record(itemToRecord, rating, milliseconds = 0) {
    setStore((current) => {
      const previous = current.stats[itemToRecord.id] || { n: 0, got: 0, slow: 0, miss: 0, ms: [] };
      const times = milliseconds ? [...(previous.ms || []), Math.round(milliseconds)].slice(-6) : previous.ms || [];
      return {
        ...current,
        stats: {
          ...current.stats,
          [itemToRecord.id]: {
            ...previous,
            n: previous.n + 1,
            [rating]: previous[rating] + 1,
            ms: times,
          },
        },
      };
    });
  }

  function rate(rating) {
    if (!item || phase !== 'revealed' || entry.rated) return;
    const milliseconds = prefs.mode === 'read' ? entry.ms : 0;
    record(item, rating, milliseconds);
    setSession((current) => ({
      ...current,
      n: current.n + 1,
      [rating]: current[rating] + 1,
      mora: current.mora + (milliseconds && rating !== 'miss' ? item.moraCount : 0),
      ms: milliseconds && rating !== 'miss' ? [...current.ms, milliseconds] : current.ms,
    }));
    setHistory((current) => current.map((card, index) =>
      index === position ? { ...card, rated: rating } : card));
    goNext();
  }

  function startSprint() {
    const first = chooseItem(pool, store.stats, recent.current);
    if (!first) return;
    setSprint({ startedAt: performance.now(), left: SPRINT_MS, read: 0, miss: 0, mora: 0, missed: [], current: first, finished: false });
  }

  function answerSprint(correct) {
    if (!sprint || sprint.finished) return;
    const nextItem = chooseItem(pool, store.stats, recent.current);
    if (correct) record(sprint.current, 'got');
    else record(sprint.current, 'miss');
    setSprint((current) => ({
      ...current,
      read: current.read + Number(correct),
      miss: current.miss + Number(!correct),
      mora: current.mora + (correct ? current.current.moraCount : 0),
      missed: correct ? current.missed : [...current.missed, current.current],
      current: nextItem,
    }));
  }

  useEffect(() => {
    if (!active) return undefined;
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea')) return;
      if (sprint && !sprint.finished) {
        if (event.key === ' ') { event.preventDefault(); answerSprint(true); }
        else if (event.key.toLowerCase() === 'x') answerSprint(false);
        return;
      }
      if (prefs.mode === 'sprint' && event.key === ' ' && !sprint) {
        event.preventDefault();
        startSprint();
        return;
      }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goBack(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); goNext(); }
      else if ((event.key === ' ' || event.key === 'Enter') && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        if (phase !== 'revealed') reveal();
      } else if (phase === 'revealed' && ['1', '2', '3'].includes(event.key)) {
        rate(({ 1: 'miss', 2: 'slow', 3: 'got' })[event.key]);
      } else if (phase === 'revealed' && event.key.toLowerCase() === 'p' && item) {
        playItem(item, { voice: prefs.voice, onError: notify });
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, sprint, prefs.mode, phase, item, prefs.voice, position, history, pool, store.stats]);

  const themes = [...new Set(ITEMS.filter((candidate) => prefs.decks[candidate.deck])
    .map((candidate) => `${candidate.deck}|${candidate.theme}`))];
  const themeNameCounts = themes.reduce((counts, key) => {
    const theme = key.split('|')[1];
    counts[theme] = (counts[theme] || 0) + 1;
    return counts;
  }, {});
  const sprintScore = session.ms.length
    ? (session.mora / (session.ms.reduce((sum, value) => sum + value, 0) / 1000)).toFixed(1)
    : '–';

  return (
    <section className="panel" id="page-drill">
      <div className="grid">
        <aside className="rail">
          <div className="card group" aria-label="Deck mix">
            <h3>Decks to mix</h3>
            <div className="chips">
              {Object.entries({ hira: 'Hiragana words', kata: 'Katakana words', phr: 'Phrases' }).map(([deck, label]) => (
                <button
                  className={`chip${prefs.decks[deck] ? ' on' : ''}`}
                  aria-pressed={prefs.decks[deck]}
                  data-deck={deck}
                  key={deck}
                  onClick={() => {
                    if (prefs.decks[deck] && Object.values(prefs.decks).filter(Boolean).length === 1) {
                      notify('Keep at least one deck selected.');
                      return;
                    }
                    setPreference('decks', { ...prefs.decks, [deck]: !prefs.decks[deck] });
                    resetDrill();
                  }}
                >
                  {label} <small>{ITEMS.filter((candidate) => candidate.deck === deck).length}</small>
                </button>
              ))}
              <button className="chip" disabled title="Kanji decks arrive later">Kanji <small>soon</small></button>
            </div>
            <p className="hint">Pick any mix. Cards from every selected deck are shuffled together, and items you miss come back more often.</p>
          </div>
          <div className="card group">
            <h3>Themes</h3>
            <div className="chips">
              {themes.map((key) => {
                const [deck, theme] = key.split('|');
                return (
                  <button
                    className={`chip${prefs.themes.includes(key) ? ' on' : ''}`}
                    aria-pressed={prefs.themes.includes(key)}
                    title={`${DECK_NAMES[deck]} deck`}
                    key={key}
                    onClick={() => {
                      const selected = prefs.themes.includes(key)
                        ? prefs.themes.filter((value) => value !== key)
                        : [...prefs.themes, key];
                      setPreference('themes', selected);
                      resetDrill();
                    }}
                  >
                    {theme}{themeNameCounts[theme] > 1 ? ` (${deck === 'hira' ? 'hiragana' : deck === 'kata' ? 'katakana' : 'phrases'})` : ''}
                  </button>
                );
              })}
            </div>
            <p className="hint">{prefs.themes.length ? `${prefs.themes.length} theme${prefs.themes.length > 1 ? 's' : ''} selected. Clear them all to use everything.` : 'No theme selected means all themes.'}</p>
          </div>
          <div className="card group">
            <h3>Mode</h3>
            <div className="seg">
              {['read', 'flash', 'sprint'].map((mode) => (
                <button key={mode} data-mode={mode} aria-pressed={prefs.mode === mode} onClick={() => { setPreference('mode', mode); resetDrill(); }}>
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <p className="hint">{MODES[prefs.mode]}</p>
            {prefs.mode === 'flash' && (
              <div className="group">
                <label htmlFor="flash-ms" className="hint">Flash time: <b className="mono">{(prefs.flashMs / 1000).toFixed(1)}s</b></label>
                <input id="flash-ms" type="range" min="400" max="3000" step="100" value={prefs.flashMs} onChange={(event) => setPreference('flashMs', Number(event.target.value))} />
              </div>
            )}
            <label className="sw">
              <input type="checkbox" checked={prefs.chunk} onChange={(event) => setPreference('chunk', event.target.checked)} />
              <i />Space between phrase chunks
            </label>
            <button className="btn quiet" onClick={() => { setPreference('reset', true); setSlow(false); resetDrill(); }}>Reset settings</button>
          </div>
        </aside>
        <div className="card stage" id="stage" aria-live="polite">
          {prefs.mode === 'sprint' ? (
            sprint ? (
              sprint.finished ? (
                <div className="stage-main">
                  <h2>Time. Here is how it went.</h2>
                  <div className="summary">
                    <div className="stat"><b>{sprint.summary.read}</b><span>cards read</span></div>
                    <div className="stat"><b>{sprint.summary.mpm}</b><span>mora per minute</span></div>
                    <div className="stat"><b>{sprint.summary.accuracy}%</b><span>accuracy</span></div>
                    <div className="stat"><b>{sprint.summary.mpm > sprint.summary.prevBest ? 'New best' : sprint.summary.prevBest}</b><span>best mora/min</span></div>
                  </div>
                  {!!sprint.missed.length && <><h3>Review the misses</h3><div className="misslist">{sprint.missed.map((missed, index) => <span className="jp" key={`${missed.id}-${index}`}>{missed.text}</span>)}</div></>}
                  <button className="btn primary" id="sprint-go" onClick={startSprint}>Sprint again <kbd>Space</kbd></button>
                </div>
              ) : (
                <>
                  <div className="sprint-head"><span className="big-num">{Math.ceil(sprint.left / 1000)}</span><span className="mono hint">Read <b>{sprint.read}</b> · Misread <b>{sprint.miss}</b></span></div>
                  <div className="timer-bar"><i style={{ transform: `scaleX(${sprint.left / SPRINT_MS})` }} /></div>
                  <div className="stage-main">
                    <div className={`word${sprint.current.deck === 'phr' ? ' phrase' : ''}`} lang="ja">{cardText(sprint.current, prefs.chunk)}</div>
                    <div className="rate-row">
                      <button className="btn miss" onClick={() => answerSprint(false)}>Misread <kbd>X</kbd></button>
                      <button className="btn good" onClick={() => answerSprint(true)}>Read it <kbd>Space</kbd></button>
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="stage-main">
                <div className="stage-top"><span>Sprint · 60 seconds</span></div>
                <h2>Ready to sprint?</h2>
                <p className="note">Read as many cards as you can, then tap Read it or press Space. Mark slips with X.</p>
                <button className="btn primary" id="sprint-go" onClick={startSprint}>Start sprint <kbd>Space</kbd></button>
              </div>
            )
          ) : !item ? (
            <div className="empty">Choose at least one deck on the left to start.</div>
          ) : (
            <>
              <div className="stage-top">
                <span><span className="badge">{DECK_NAMES[item.deck]}</span> {item.theme}</span>
                <span className="mono">{item.moraCount} mora</span>
              </div>
              <div className="stage-main">
                {phase === 'revealed' ? (
                  <div className="reveal">
                    <PitchLine item={item} showRomaji={prefs.romaji} showMarks={prefs.marks} />
                    <div className="meaning">{item.en}</div>
                    <div className="legend"><span className="lh">high (bar above)</span><span className="ll">low (bar below)</span><span>↘ pitch drops here</span></div>
                    <div className="voice-row"><span className="hint">Voice</span><VoiceButtons value={prefs.voice} onChange={(value) => setPreference('voice', value)} /></div>
                    <div className="audio-row">
                      <button className="btn primary" data-play="main" onClick={() => playItem(item, { voice: prefs.voice, slow, onError: notify })}>▶ Play <kbd>P</kbd></button>
                      <button className="btn" aria-pressed={slow} onClick={() => setSlow((value) => !value)}>{slow ? 'Slow: on' : 'Slow: off'}</button>
                      {item.alt && <button className="btn" onClick={() => playItem(item, { voice: prefs.voice, alternate: true, slow, onError: notify })}>▶ Other recording</button>}
                    </div>
                    <div className="audio-cap">
                      {prefs.voice === 'female' && item.ttsF
                        ? 'Synthetic female voice (VOICEVOX:九州そら). Its pitch is set from the dictionary accent; trust the marks over the voice when they disagree.'
                        : item.audio
                          ? 'Recording: Tokyo-accent male voice'
                          : item.tts
                            ? 'Synthetic male voice (VOICEVOX:白上虎太郎). Its pitch is set from the dictionary accent.'
                            : 'Synthetic browser voice. It may not follow the pitch marks.'}
                      {item.alt && '. "Other recording" is a Kansai-accent speaker, so pitch can differ from the marks.'}
                    </div>
                    <p className="note">
                      {item.accents.length > 1 ? `Dictionary lists multiple accents [${item.accents.join('], [')}]. Shown: [${item.accents[0]}]. ` : ''}
                      {item.chunks.some((chunk) => chunk.a == null) ? `No dictionary pitch for ${item.chunks.filter((chunk) => chunk.a == null).map((chunk) => chunk.w).join(', ')}. ` : ''}
                      {item.deck === 'phr' ? 'Each chunk shows its own dictionary pitch; in fast speech it shifts a little across chunks.' : ''}
                    </p>
                    {entry.rated ? (
                      <p className="note rated-note">You marked this card <b>{{ miss: 'Missed', slow: 'Slow', got: 'Got it' }[entry.rated]}</b>. Use Forward to continue.</p>
                    ) : (
                      <div className="rate-row">
                        <button className="btn miss" data-rate="miss" onClick={() => rate('miss')}>Missed <kbd>1</kbd></button>
                        <button className="btn warn" data-rate="slow" onClick={() => rate('slow')}>Slow <kbd>2</kbd></button>
                        <button className="btn good" data-rate="got" onClick={() => rate('got')}>Got it <kbd>3</kbd></button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={`word${item.deck === 'phr' ? ' phrase' : ''}${phase === 'masked' ? ' masked' : ''}`} lang="ja" aria-label={phase === 'masked' ? 'hidden' : undefined}>
                      {phase === 'masked' ? '・'.repeat(Math.min(item.moraCount, 8)) : cardText(item, prefs.chunk)}
                    </div>
                    {phase === 'masked' && <p className="note">Say it aloud, then reveal.</p>}
                    {prefs.mode === 'flash' && phase === 'front' && <div className="timer-bar"><i /></div>}
                    <button className="btn primary" id="reveal" onClick={reveal}>Reveal <kbd>Space</kbd></button>
                  </>
                )}
              </div>
              <div className="nav-row">
                <button className="btn" id="nav-back" disabled={position <= 0} onClick={goBack}>← Back <kbd>←</kbd></button>
                <button className="btn" id="nav-fwd" onClick={goNext}>{position < history.length - 1 ? 'Forward' : 'Skip'} → <kbd>→</kbd></button>
              </div>
              <div className="session">
                <span>Cards <b>{session.n}</b></span><span>Got it <b>{session.got}</b></span><span>Slow <b>{session.slow}</b></span>
                <span>Missed <b>{session.miss}</b></span><span>Median read <b>{session.ms.length ? `${(median(session.ms) / 1000).toFixed(1)}s` : '–'}</b></span>
                <span>Speed <b>{sprintScore}</b> mora/s</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
