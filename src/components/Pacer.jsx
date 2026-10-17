import React, { useEffect, useRef, useState } from 'react';
import { moras, particleRomaji, romaji } from '../core.js';
import { PHRASES } from '../data.js';
import { audioUrl, femaleSource, stopAudio } from '../audio.js';

export default function Pacer({ prefs, setPreference, notify, active }) {
  const [running, setRunning] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [note, setNote] = useState('');
  const frame = useRef(0);
  const timer = useRef(0);
  const player = useRef(null);
  const phraseList = PHRASES.filter((item) => !prefs.paceTheme || item.theme === prefs.paceTheme);
  const requestedIndex = phraseList.findIndex((phrase) => phrase.id === prefs.pacePhraseId);
  const index = requestedIndex < 0 ? 0 : requestedIndex;
  const item = phraseList[index];
  const units = item ? item.chunks.flatMap((chunk) => moras(chunk.w + chunk.p)) : [];

  function stop() {
    window.clearInterval(timer.current);
    window.cancelAnimationFrame(frame.current);
    player.current?.pause();
    stopAudio();
    player.current = null;
    setRunning(false);
    setHighlight(-1);
    setNote('');
  }

  function goTo(nextIndex) {
    if (!phraseList.length) return;
    stop();
    setPreference('pacePhraseId', phraseList[(nextIndex + phraseList.length) % phraseList.length].id);
  }

  function animateAtRate(rate) {
    let current = 0;
    setHighlight(0);
    timer.current = window.setInterval(() => {
      current += 1;
      if (current >= units.length) {
        stop();
        return;
      }
      setHighlight(current);
    }, 1000 / rate);
  }

  async function startClip(source, timings, endTime) {
    if (!item || !timings?.length || !endTime) return false;
    const nativeRate = units.length / Math.max(0.3, endTime - timings[0]);
    const playbackRate = Math.max(0.5, Math.min(2, prefs.paceRate / nativeRate));
    const audio = new Audio(source);
    audio.playbackRate = playbackRate;
    player.current = audio;
    setNote(Math.abs(prefs.paceRate - nativeRate * playbackRate) > 0.15
      ? `The recording can only go ${(nativeRate * playbackRate).toFixed(1)} mora per second here. The highlight follows the voice.`
      : '');
    audio.addEventListener('ended', stop, { once: true });
    try {
      await audio.play();
    } catch {
      if (player.current === audio) {
        notify('This recording could not play here.');
        stop();
      }
      return true;
    }
    const update = () => {
      if (player.current !== audio) return;
      const currentTime = audio.currentTime;
      let current = -1;
      for (let cursor = 0; cursor < units.length; cursor += 1) {
        if (timings[cursor] <= currentTime + 0.02) current = cursor;
        else break;
      }
      setHighlight(current);
      if (audio.ended || currentTime >= endTime + 0.25) {
        stop();
        return;
      }
      frame.current = window.requestAnimationFrame(update);
    };
    frame.current = window.requestAnimationFrame(update);
    return true;
  }

  async function start() {
    if (running) {
      stop();
      return;
    }
    if (!item || !units.length) return;
    setRunning(true);
    setHighlight(-1);
    if (!prefs.paceSpeak) {
      animateAtRate(prefs.paceRate);
      return;
    }

    if (prefs.voice === 'female' && item.ttsF && item.tlF) {
      setNote('Loading the female voice…');
      try {
        const source = await femaleSource(item);
        if (!player.current && await startClip(source, item.tlF, item.tendF)) return;
      } catch {
        notify('The female voice could not load. Using the male voice.');
      }
    }
    if (item.tts && item.tl) {
      await startClip(audioUrl(item.tts), item.tl, item.tend);
      return;
    }
    setNote('This phrase has no synchronized clip. Using a device voice and timed highlight.');
    const rate = Math.min(2, Math.max(0.5, prefs.paceRate / 7));
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = 'ja-JP';
    utterance.rate = rate;
    utterance.onend = stop;
    window.speechSynthesis?.speak(utterance);
    animateAtRate(7 * rate);
  }

  useEffect(() => () => {
    window.clearInterval(timer.current);
    window.cancelAnimationFrame(frame.current);
    stopAudio();
  }, []);

  useEffect(() => {
    if (running) stop();
  }, [prefs.paceRate, prefs.paceSpeak, prefs.voice, prefs.paceTheme, prefs.pacePhraseId, prefs.paceChunk]);

  useEffect(() => {
    if (active) return undefined;
    stop();
    return undefined;
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    function onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea, button')) return;
      if (event.key === ' ' || event.key.toLowerCase() === 'n') {
        event.preventDefault();
        if (event.key === ' ') start();
        else goTo(index + 1);
      } else if (event.key.toLowerCase() === 'b') {
        goTo(index - 1);
      } else if (event.key === 'ArrowLeft') {
        goTo(index - 1);
      } else if (event.key === 'ArrowRight') {
        goTo(index + 1);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, running, index, item, phraseList.length]);

  if (!item) return null;
  const reading = item.chunks.map((chunk) => `${romaji(chunk.w)}${chunk.p ? ` ${particleRomaji(chunk.p)}` : ''}`).join('  ');

  return (
    <section className="panel" id="page-pacer">
      <div className="grid no-settings">
        <div className="card stage" id="pace-stage">
          <div className="stage-top"><span className="badge">Phrase</span> {item.theme} · <span className="mono">{units.length} mora</span><span className="hint">Read each highlighted mora aloud and keep up.</span></div>
          <div className="stage-main">
            <div className={`pace-text${prefs.paceChunk ? '' : ' joined'}`} id="pace-text">
              {item.chunks.map((chunk, chunkIndex) => (
                <span key={`${chunk.w}-${chunkIndex}`}>
                  {moras(chunk.w + chunk.p).map((mora, moraIndex) => {
                    const currentIndex = item.chunks.slice(0, chunkIndex).reduce((sum, previous) => sum + moras(previous.w + previous.p).length, 0) + moraIndex;
                    return <span className={`pm${highlight > currentIndex ? ' done' : highlight === currentIndex ? ' now' : ''}`} key={`${mora}-${moraIndex}`}>{mora}</span>;
                  })}
                </span>
              ))}
            </div>
            <div className="meaning">{item.en}</div>
            <div className="rom-line mono hint">{reading}</div>
          </div>
          <div className="rate-row">
            <button className="btn" id="pace-prev" onClick={() => goTo(index - 1)}>← Previous <kbd>B</kbd></button>
            <button className="btn primary" id="pace-go" onClick={start}>{running ? 'Stop' : 'Start'} <kbd>Space</kbd></button>
            <button className="btn" id="pace-next" onClick={() => goTo(index + 1)}>Next phrase <kbd>N</kbd></button>
          </div>
          <p className="hint" id="pace-note" aria-live="polite">{note}</p>
          <p className="note" style={{ alignSelf: 'center', textAlign: 'center' }}>A mora is one beat: か, ん, っ and ー each count as one. Raise the speed once you can finish a phrase without losing your place.</p>
        </div>
      </div>
    </section>
  );
}
