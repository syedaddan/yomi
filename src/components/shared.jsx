import React from 'react';
import { particlePitch, particleRomaji, pitchPattern, moras, romaji } from '../core.js';

export function PitchLine({ item, showRomaji = true, showMarks = true }) {
  return (
    <div className={`pitchline${item.deck === 'phr' ? ' phrase' : ''}${showMarks ? '' : ' no-mark'}`}>
      {item.chunks.map((chunk, chunkIndex) => {
        const wordMoras = moras(chunk.w);
        const particleMoras = chunk.p ? moras(chunk.p) : [];
        const patterns = chunk.a == null
          ? [...wordMoras, ...particleMoras].map(() => '')
          : [...pitchPattern(wordMoras.length, chunk.a), ...particlePitch(particleMoras.length, chunk.a)];
        const reading = romaji(chunk.w) + (chunk.p ? ` ${particleRomaji(chunk.p)}` : '');
        return (
          <span className="ck" key={`${chunk.w}-${chunkIndex}`}>
            {showRomaji && <span className="rom">{reading}</span>}
            <span className="kn">
              {[...wordMoras, ...particleMoras].map((mora, index) => (
                <span className={`m ${patterns[index]}`} key={`${mora}-${index}`}>
                  {mora}
                  {patterns[index] === 'H' && patterns[index + 1] === 'L' && <i className="ar" aria-hidden="true">↘</i>}
                </span>
              ))}
            </span>
          </span>
        );
      })}
      {item.q && <span className="rise" title="Rising question intonation">↗</span>}
    </div>
  );
}

export function VoiceButtons({ value, onChange, attribute = 'data-voice' }) {
  return (
    <div className="seg two" role="group" aria-label="Voice">
      <button {...{ [attribute]: 'male' }} aria-pressed={value !== 'female'} onClick={() => onChange('male')}>Male</button>
      <button {...{ [attribute]: 'female' }} aria-pressed={value === 'female'} onClick={() => onChange('female')}>Female</button>
    </div>
  );
}

export function Toast({ message }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function SectionNav({ value }) {
  const pages = [
    ['drill', 'Drill', 'index.html'],
    ['pacer', 'Phrase pacer', 'pacer.html'],
    ['alike', 'Look-alikes', 'alike.html'],
    ['progress', 'Progress', 'progress.html'],
    ['kanji', 'Kanji', 'kanji.html'],
  ];
  return (
    <nav className="section-nav" aria-label="Sections">
      {pages.map(([key, label, href]) => (
        <a
          className="nav-link"
          aria-current={value === key ? 'page' : undefined}
          data-page={key}
          href={`./${href}`}
          key={key}
        >
          {label}{key === 'kanji' && <small> later</small>}
        </a>
      ))}
    </nav>
  );
}
