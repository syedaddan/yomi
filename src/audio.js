import { loadCustomAudio } from './customAudio.js';
import { resolvePlaybackSource } from './audioPriority.js';

const baseUrl = import.meta.env.BASE_URL;
let activeAudio = null;
let activeObjectUrl = null;
const femaleBundlePromises = new Map();
const femaleObjectUrls = new Map();

export function audioUrl(path) {
  return path ? `${baseUrl}${path}` : '';
}

export function stopAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  window.speechSynthesis?.cancel();
}

function playClip(source, rate = 1) {
  stopAudio();
  const player = new Audio(source);
  player.playbackRate = rate;
  activeAudio = player;
  return player.play();
}

function playBlob(blob, rate = 1) {
  stopAudio();
  activeObjectUrl = URL.createObjectURL(blob);
  const player = new Audio(activeObjectUrl);
  player.playbackRate = rate;
  activeAudio = player;
  player.addEventListener('ended', stopAudio, { once: true });
  return player.play().catch((error) => {
    stopAudio();
    throw error;
  });
}

export function femaleSource(item) {
  if (!item.ttsF) return Promise.reject(new Error('No female clip for this item.'));
  const bundle = item.ttsF.file || 'audio/female_voice.mp3';
  const key = `${bundle}:${item.ttsF.o}`;
  if (femaleObjectUrls.has(key)) return Promise.resolve(femaleObjectUrls.get(key));
  if (!femaleBundlePromises.has(bundle)) {
    const request = fetch(audioUrl(bundle))
      .then((response) => {
        if (!response.ok) throw new Error(`Female voice bundle request failed (${response.status}).`);
        return response.arrayBuffer();
      })
      .catch((error) => {
        femaleBundlePromises.delete(bundle);
        throw error;
      });
    femaleBundlePromises.set(bundle, request);
  }
  return femaleBundlePromises.get(bundle).then((buffer) => {
    const blob = new Blob([buffer.slice(item.ttsF.o, item.ttsF.o + item.ttsF.l)], { type: 'audio/mpeg' });
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
  const choice = resolvePlaybackSource(item, voice, alternate);
  if (choice.type === 'kansai') {
    try {
      await playClip(audioUrl(choice.source), rate);
    } catch {
      onError('The Kansai recording could not play here.');
    }
    return;
  }

  if (choice.type === 'human-local' || choice.type === 'female-local') {
    try {
      const recording = await loadCustomAudio(choice.id);
      if (!recording) throw new Error('The saved recording is missing from this browser.');
      await playBlob(recording, rate);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The saved recording could not play.');
    }
    return;
  }

  if (choice.type === 'human-url' || choice.type === 'recording') {
    try {
      await playClip(choice.type === 'recording' ? audioUrl(choice.source) : choice.source, rate);
    } catch {
      onError('This recording could not play here.');
    }
    return;
  }

  if (choice.type === 'female-bundle') {
    try {
      await playClip(await femaleSource(item), rate);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The female VOICEVOX recording could not play.');
    }
    return;
  }

  speak(choice.text, rate, onError);
}
