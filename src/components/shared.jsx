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
    <div className="choice-field">
      <div className="choice-group compact" role="group" aria-label="Voice">
        <button className="choice-button" {...{ [attribute]: 'male' }} aria-pressed={value !== 'female'} onClick={() => onChange('male')}>Male</button>
        <button className="choice-button" {...{ [attribute]: 'female' }} aria-pressed={value === 'female'} onClick={() => onChange('female')}>Female</button>
      </div>
      <InfoButton label="Voice information">
        Real recordings are used when available. Synthetic male and female clips use VOICEVOX:白上虎太郎 and VOICEVOX:九州そら; their pitch may differ from the dictionary marks. Some alternate recordings use a Kansai accent.
      </InfoButton>
    </div>
  );
}

export function ChoiceButtons({ value, options, onChange, label, multiple = false }) {
  return (
    <div className="choice-group compact" role="group" aria-label={label}>
      {options.map(([key, text, detail]) => {
        const selected = multiple ? value.includes(key) : value === key;
        return (
          <button
            className="choice-button"
            aria-pressed={selected}
            data-choice={key}
            data-deck={label === 'Decks' ? key : undefined}
            data-mode={label === 'Reading mode' ? key : undefined}
            key={key}
            onClick={() => onChange(key)}
            type="button"
          >
            {text}{detail && <small>{detail}</small>}
          </button>
        );
      })}
    </div>
  );
}

export function InfoButton({ children, label = 'More information' }) {
  const tooltipId = React.useId();
  return (
    <span className="info-wrap">
      <button className="info-button" type="button" aria-label={label} aria-describedby={tooltipId}>i</button>
      <span className="info-tooltip" id={tooltipId} role="tooltip">{children}</span>
    </span>
  );
}

export function Toast({ message }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function SectionNav({ value }) {
  const pages = [
    ['drill', 'Drill'],
    ['pacer', 'Phrase pacer'],
    ['alike', 'Look-alikes'],
    ['progress', 'Progress'],
    ['kanji', 'Kanji'],
  ];
  return (
    <nav className="section-nav" aria-label="Sections">
      {pages.map(([key, label]) => (
        <a
          className="nav-link"
          aria-current={value === key ? 'page' : undefined}
          data-page={key}
          href={`#/${key}`}
          key={key}
        >
          {label}{key === 'kanji' && <small> later</small>}
        </a>
      ))}
    </nav>
  );
}
