import decks from '../out/data.json';
import { accentList, moras } from './core.js';

export const DECK_NAMES = {
  hira: 'Hiragana word',
  kata: 'Katakana word',
  phr: 'Phrase',
};

export const ITEMS = [
  ...decks.hira.map((row) => ({
    deck: 'hira',
    id: `h:${row.kana}:${row.en}`,
    theme: row.theme,
    en: row.en,
    audio: row.audio,
    alt: row.alt,
    tts: row.tts,
    ttsF: row.ttsF,
    tl: row.tl,
    tend: row.tend,
    chunks: [{ w: row.kana, p: '', a: accentList(row.accent)[0], src: 'dict' }],
    accents: accentList(row.accent),
  })),
  ...decks.kata.map((row) => ({
    deck: 'kata',
    id: `k:${row.kana}`,
    theme: row.theme,
    en: row.en,
    audio: null,
    alt: null,
    tts: row.tts,
    ttsF: row.ttsF,
    chunks: [{ w: row.kana, p: '', a: accentList(row.accent)[0], src: 'dict' }],
    accents: accentList(row.accent),
  })),
  ...decks.phr.map((row) => ({
    deck: 'phr',
    id: `p:${row.chunks.map((chunk) => chunk.w + chunk.p).join('/')}`,
    theme: row.theme,
    en: row.en,
    audio: row.audio,
    alt: row.alt,
    tts: row.tts,
    ttsF: row.ttsF,
    tl: row.tl,
    tend: row.tend,
    tlF: row.tlF,
    tendF: row.tendF,
    chunks: row.chunks,
    q: row.q,
    accents: [],
  })),
].map((item) => {
  const text = item.chunks.map((chunk) => chunk.w + chunk.p).join('');
  return { ...item, text, moraCount: moras(text).length };
});

export const PHRASES = ITEMS.filter((item) => item.deck === 'phr');

export const LOOKALIKE_SETS = [
  { script: 'kata', glyphs: ['シ', 'ツ'], tip: 'シ: the two short strokes sit side by side and the long stroke sweeps up like し. ツ: the short strokes stand more upright and the long stroke slashes down-left like つ.' },
  { script: 'kata', glyphs: ['ソ', 'ン'], tip: 'ソ: the long stroke is written top to bottom, and the short stroke is steeper. ン: the long stroke rises from bottom to top, like ん.' },
  { script: 'kata', glyphs: ['ノ', 'シ', 'レ'], tip: 'ノ is a single slash. シ has three strokes. レ has a hook at the bottom.' },
  { script: 'kata', glyphs: ['ク', 'ケ', 'タ'], tip: '' },
  { script: 'kata', glyphs: ['ウ', 'ワ', 'フ'], tip: 'ウ has a small stroke on top. ワ has no top stroke and a left hook. フ is a single bend.' },
  { script: 'kata', glyphs: ['ヌ', 'ス'], tip: '' },
  { script: 'kata', glyphs: ['ナ', 'メ'], tip: '' },
  { script: 'kata', glyphs: ['コ', 'ユ'], tip: '' },
  { script: 'kata', glyphs: ['チ', 'テ'], tip: '' },
  { script: 'kata', glyphs: ['ア', 'マ'], tip: '' },
  { script: 'hira', glyphs: ['さ', 'ち', 'き'], tip: 'さ and き are written in two parts (a bar and a stroke); ち is one flowing shape. き may look connected or separate depending on the font.' },
  { script: 'hira', glyphs: ['ね', 'れ', 'わ'], tip: 'ね ends in a small loop. れ ends in an open flick. わ curls its tail inward.' },
  { script: 'hira', glyphs: ['ぬ', 'め'], tip: 'ぬ ends in a loop; め does not.' },
  { script: 'hira', glyphs: ['る', 'ろ'], tip: 'る has a loop at the bottom; ろ is open.' },
  { script: 'hira', glyphs: ['は', 'ほ', 'ま'], tip: 'ほ has one extra horizontal bar compared with は. ま has a loop at the bottom.' },
  { script: 'hira', glyphs: ['い', 'り'], tip: '' },
  { script: 'hira', glyphs: ['あ', 'お'], tip: '' },
  { script: 'hira', glyphs: ['こ', 'に'], tip: 'こ is two short horizontal strokes. に has a vertical stroke on its left.' },
  { script: 'hira', glyphs: ['す', 'む'], tip: '' },
  { script: 'hira', glyphs: ['た', 'な'], tip: '' },
];
