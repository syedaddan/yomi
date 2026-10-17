const SMALL_Y = 'ゃゅょャュョ';
const SMALL_V = 'ぁぃぅぇぉァィゥェォ';

export function moras(text) {
  const result = [];
  for (const character of text) {
    if ((SMALL_Y.includes(character) || SMALL_V.includes(character)) && result.length) {
      result[result.length - 1] += character;
    } else {
      result.push(character);
    }
  }
  return result;
}

export function accentList(value) {
  const matches = String(value).match(/\d+/g);
  return matches ? [...new Set(matches.map(Number))] : [];
}

export function pitchPattern(count, accent) {
  if (count <= 0) return [];
  const position = Math.min(accent, count);
  if (position === 0) return count === 1 ? ['L'] : ['L', ...Array(count - 1).fill('H')];
  if (position === 1) return ['H', ...Array(count - 1).fill('L')];
  return ['L', ...Array(position - 1).fill('H'), ...Array(count - position).fill('L')];
}

export function particlePitch(count, accent) {
  return Array(count).fill(accent === 0 ? 'H' : 'L');
}

const HIRA_ROMAJI = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',
  が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',
  ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',
  だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',
  は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',
  ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',
  や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',ゐ:'i',
  ゑ:'e',を:'o',ん:'n',ゔ:'vu',
};
const YOON = { ゃ:'a', ゅ:'u', ょ:'o' };
const SPECIAL = {
  ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo',てぃ:'ti',でぃ:'di',とぅ:'tu',どぅ:'du',
  うぃ:'wi',うぇ:'we',うぉ:'wo',しぇ:'she',じぇ:'je',ちぇ:'che',つぁ:'tsa',
  ゔぁ:'va',ゔぃ:'vi',ゔぇ:'ve',ゔぉ:'vo',
};
const WORD_OVERRIDE = { こんにちは:'konnichiwa',こんばんは:'konbanwa' };
const PARTICLE_ROMAJI = { は:'wa',を:'o',へ:'e' };

export function kataToHira(text) {
  return [...text].map((character) => {
    const code = character.codePointAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : character;
  }).join('');
}

function moraRomaji(mora) {
  if (SPECIAL[mora]) return SPECIAL[mora];
  if (mora.length === 1) return HIRA_ROMAJI[mora] || mora;
  const base = mora[0];
  const small = mora.slice(1);
  if (small.length === 1 && YOON[small]) {
    const reading = HIRA_ROMAJI[base];
    if (!reading) return mora;
    if (reading === 'shi') return `sh${YOON[small]}`;
    if (reading === 'chi') return `ch${YOON[small]}`;
    if (reading === 'ji') return `j${YOON[small]}`;
    return `${reading.slice(0, -1)}y${YOON[small]}`;
  }
  if (small.length === 1 && SMALL_V.includes(small)) {
    const reading = HIRA_ROMAJI[base];
    const vowel = HIRA_ROMAJI[kataToHira(small)];
    return reading ? `${reading.slice(0, -1)}${vowel}` : mora;
  }
  return [...mora].map((character) => HIRA_ROMAJI[character] || character).join('');
}

export function romaji(text) {
  const hira = kataToHira(text);
  if (WORD_OVERRIDE[hira]) return WORD_OVERRIDE[hira];
  const units = moras(hira);
  let result = '';
  let geminate = false;

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit === 'っ') {
      geminate = true;
      continue;
    }
    let reading = unit === 'ー' ? (result.slice(-1).match(/[aiueo]/) ? result.slice(-1) : '') : moraRomaji(unit);
    if (geminate && reading) {
      reading = (reading.startsWith('ch') ? 't' : reading[0]) + reading;
      geminate = false;
    }
    if (unit === 'ん') {
      const next = units[index + 1] ? moraRomaji(units[index + 1]) : '';
      if (/^[aiueoy]/.test(next)) reading = "n'";
    }
    result += reading;
  }
  return result;
}

export function particleRomaji(text) {
  return [...text].map((character) => PARTICLE_ROMAJI[character] || romaji(character)).join('');
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
