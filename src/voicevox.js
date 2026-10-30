import { moras } from './core.js';

const ENGINE = 'http://127.0.0.1:50021';
const FEMALE_SPEAKER = 16;

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${ENGINE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new Error(`Could not reach the local VOICEVOX Engine. Start it with CORS enabled, then try again. ${error.message}`);
  }
  if (!response.ok) throw new Error(`VOICEVOX Engine returned ${response.status} for ${path}.`);
  return response;
}

export async function synthesizeFemaleWord(kana, accent) {
  const parameters = new URLSearchParams({
    text: kana,
    speaker: String(FEMALE_SPEAKER),
    is_kana: 'true',
  });
  const queryResponse = await post(`/audio_query?${parameters}`);
  const query = await queryResponse.json();
  const engineMoras = query.accent_phrases.flatMap((phrase) => phrase.moras);
  const wordMoras = moras(kana);

  if (accent !== null) {
    if (engineMoras.length !== wordMoras.length) {
      throw new Error(`VOICEVOX parsed ${engineMoras.length} morae, but the word has ${wordMoras.length}. Check the spelling before saving.`);
    }
    const accentPhrase = {
      moras: engineMoras,
      accent: accent === 0 ? engineMoras.length : accent,
      pause_mora: null,
      is_interrogative: false,
    };
    const phraseResponse = await post(`/mora_data?speaker=${FEMALE_SPEAKER}`, [accentPhrase]);
    query.accent_phrases = await phraseResponse.json();
  }

  const audioResponse = await post(`/synthesis?speaker=${FEMALE_SPEAKER}`, query);
  const audio = await audioResponse.blob();
  if (!audio.size || !audio.type.startsWith('audio/')) {
    throw new Error('VOICEVOX returned an empty or invalid audio recording.');
  }
  return audio;
}
