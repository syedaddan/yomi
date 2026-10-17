const baseUrl = import.meta.env.BASE_URL;
let activeAudio = null;
let femaleBundlePromise = null;
const femaleObjectUrls = new Map();

export function audioUrl(path) {
  return path ? `${baseUrl}${path}` : '';
}

export function stopAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  window.speechSynthesis?.cancel();
}

function playClip(path, rate = 1) {
  stopAudio();
  const player = new Audio(audioUrl(path));
  player.playbackRate = rate;
  activeAudio = player;
  return player.play();
}

export function femaleSource(item) {
  if (!item.ttsF) return Promise.reject(new Error('No female clip for this item.'));
  const key = item.ttsF.o;
  if (femaleObjectUrls.has(key)) return Promise.resolve(femaleObjectUrls.get(key));
  if (!femaleBundlePromise) {
    femaleBundlePromise = fetch(audioUrl('audio/female_voice.mp3'))
      .then((response) => {
        if (!response.ok) throw new Error(`Female voice bundle request failed (${response.status}).`);
        return response.arrayBuffer();
      })
      .catch((error) => {
        femaleBundlePromise = null;
        throw error;
      });
  }
  return femaleBundlePromise.then((buffer) => {
    const blob = new Blob([buffer.slice(key, key + item.ttsF.l)], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    femaleObjectUrls.set(key, url);
    return url;
  });
}

function speak(text, rate, onError) {
  stopAudio();
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    onError('This browser does not provide speech audio.');
    return;
  }
  const voices = window.speechSynthesis.getVoices().filter((voice) => /^ja/i.test(voice.lang));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  const voice = voices.find((candidate) => /ja[-_]JP/i.test(candidate.lang)) || voices[0];
  if (voice) utterance.voice = voice;
  else onError('No Japanese voice was found on this device.');
  window.speechSynthesis.speak(utterance);
}

export async function playItem(item, { voice, alternate = false, slow = false, onError }) {
  const rate = slow ? 0.7 : 1;
  if (alternate && item.alt) {
    try {
      await playClip(item.alt, rate);
    } catch {
      onError('This recording could not play here.');
    }
    return;
  }
  if (voice === 'female' && item.ttsF) {
    try {
      const source = await femaleSource(item);
      const player = new Audio(source);
      player.playbackRate = rate;
      stopAudio();
      activeAudio = player;
      await player.play();
      return;
    } catch {
      onError('The female voice could not load. Playing the male voice instead.');
    }
  }
  const source = item.audio || item.tts;
  if (source) {
    try {
      await playClip(source, rate);
    } catch {
      onError('This recording could not play here.');
    }
  } else {
    speak(item.text, rate, onError);
  }
}
