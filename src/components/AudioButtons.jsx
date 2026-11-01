import React from 'react';
import { playItem } from '../audio.js';
import { getKanjiAudioControls } from '../kanjiAudio.js';
import { InfoButton } from './shared.jsx';

export default function AudioButtons({ item, label, onError, infoContent }) {
  const controls = getKanjiAudioControls(item);
  if (!controls.primaryVoice) return null;

  const hasNatural = controls.primaryVoice === 'recording';
  const playableItem = { ...item, text: label };

  return (
    <span className="kanji-audio-control-group">
      <button
        className="kanji-audio-button"
        type="button"
        aria-label={hasNatural ? `Play natural recording of ${label}` : `Play ${label}`}
        title={hasNatural ? 'Play natural recording' : 'Play synthesized audio'}
        onClick={() => playItem(playableItem, { voice: controls.primaryVoice, onError })}
      >▶</button>
      {controls.hasSyntheticAlternate && (
        <button
          className="kanji-audio-button"
          type="button"
          aria-label={`Play synthesized recording of ${label}`}
          title="Play synthesized recording"
          onClick={() => playItem(playableItem, { voice: 'female', onError })}
        >▶</button>
      )}
      {controls.showSyntheticInfo && (
        <InfoButton label={`About synthesized audio for ${label}`}>
          <span className="kanji-credit-lines">
            <span>Female synthetic voice (VOICEVOX:九州そら).</span>
            {infoContent}
          </span>
        </InfoButton>
      )}
    </span>
  );
}
