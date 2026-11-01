import React, { useLayoutEffect, useRef, useState } from 'react';
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
        <button className="choice-button" {...{ [attribute]: 'recording' }} aria-pressed={value === 'recording'} onClick={() => onChange('recording')}>Recording</button>
        <button className="choice-button" {...{ [attribute]: 'female' }} aria-pressed={value !== 'recording'} onClick={() => onChange('female')}>Female VOICEVOX</button>
      </div>
      <InfoButton label="Voice information">
        Recording plays this word's curated human clip. Female VOICEVOX clips use 九州そら; their pitch may differ from dictionary marks. Some alternate recordings use a Kansai accent.
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
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimer = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState(null);
  const open = hovered || focused;

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    function placeTooltip() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;

      const gap = 8;
      const margin = 12;
      const roomAbove = trigger.top - gap;
      const roomBelow = window.innerHeight - trigger.bottom - gap;
      const placement = roomAbove > roomBelow ? 'top' : 'bottom';
      const top = placement === 'top'
        ? Math.max(margin, trigger.top - tooltip.height - gap)
        : Math.min(window.innerHeight - tooltip.height - margin, trigger.bottom + gap);
      const left = Math.max(
        margin,
        Math.min(trigger.left + trigger.width / 2 - tooltip.width / 2, window.innerWidth - tooltip.width - margin),
      );
      setPosition({ top, left, placement });
    }

    placeTooltip();
    window.addEventListener('resize', placeTooltip);
    window.addEventListener('scroll', placeTooltip, true);
    return () => {
      window.removeEventListener('resize', placeTooltip);
      window.removeEventListener('scroll', placeTooltip, true);
    };
  }, [open]);

  function deferClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(false), 120);
  }

  function keepOpen() {
    window.clearTimeout(closeTimer.current);
    setHovered(true);
  }

  return (
    <span className="info-wrap" onMouseEnter={keepOpen} onMouseLeave={deferClose}>
      <button
        ref={triggerRef}
        className="info-button"
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >i</button>
      <span
        ref={tooltipRef}
        className={`info-tooltip${position ? ' is-open' : ''}`}
        id={tooltipId}
        role="tooltip"
        data-placement={position?.placement}
        style={position ? { top: position.top, left: position.left } : undefined}
        onMouseEnter={keepOpen}
        onMouseLeave={deferClose}
      >{children}</span>
    </span>
  );
}

export function Toast({ message }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function SectionNav({ value, onNavigate, isAdmin = false }) {
  const pages = [
    ['drill', 'Drill'],
    ['kanji', 'Kanji'],
    ['pacer', 'Phrase pacer'],
    ['alike', 'Look-alikes'],
    ['add', 'Add words'],
    ...(isAdmin ? [['decks', 'Decks']] : []),
    ['progress', 'Progress'],
  ];
  return (
    <nav className="section-nav" aria-label="Sections">
      {pages.map(([key, label]) => (
        <a
          className="nav-link"
          aria-current={value === key ? 'page' : undefined}
          data-page={key}
          href={`${import.meta.env.BASE_URL}${key === 'drill' ? '' : key}`}
          key={key}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate(key);
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
