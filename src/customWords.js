import { moras } from './core.js';

const HIRAGANA_WORD = /^[\u3041-\u3096\u309d\u309e\u30fc]+$/u;
const KATAKANA_WORD = /^[\u30a1-\u30fa\u30fd\u30fe\u30fc]+$/u;

export function createCustomWord({ id, deck, kana, meaning, theme, accent, sourceUrl, audioUrl, femaleAudioId, humanAudioId }) {
  const word = kana.trim();
  const english = meaning.trim();
  const wordTheme = theme.trim();

  if (!id) throw new Error('A word ID is required.');
  if (deck !== 'hira' && deck !== 'kata') throw new Error('Choose Hiragana or Katakana.');
  if (!(deck === 'hira' ? HIRAGANA_WORD : KATAKANA_WORD).test(word)) {
    throw new Error(`Enter the word using ${deck === 'hira' ? 'Hiragana' : 'Katakana'} characters.`);
  }
  if (!english) throw new Error('Enter an English meaning.');
  if (!wordTheme) throw new Error('Choose or enter a theme.');
  if (!femaleAudioId) throw new Error('A generated female VOICEVOX recording is required.');

  const wordMoras = moras(word);
  const pitch = accent === '' || accent == null ? null : Number(accent);
  if (pitch !== null && (!Number.isInteger(pitch) || pitch < 0 || pitch > wordMoras.length)) {
    throw new Error(`Pitch accent must be between 0 and ${wordMoras.length}, or left unknown.`);
  }

  for (const [label, value] of [['Source URL', sourceUrl], ['Human audio URL', audioUrl]]) {
    if (!value) continue;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${label} must be a valid URL.`);
    }
    if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  }

  return {
    id,
    deck,
    kana: word,
    en: english,
    theme: wordTheme,
    accent: pitch,
    sourceUrl: sourceUrl || '',
    humanAudioUrl: audioUrl || '',
    humanAudioId: humanAudioId || '',
    femaleAudioId,
    audio: null,
    alt: null,
    ttsF: null,
  };
}
