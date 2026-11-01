export function resolvePlaybackSource(item, voice, alternate = false) {
  if (item.alt && !alternate) return { type: 'kansai', source: item.alt };

  if (voice === 'recording') {
    if (item.humanAudioId) return { type: 'human-local', id: item.humanAudioId };
    if (item.humanAudioUrl) return { type: 'human-url', source: item.humanAudioUrl };
    if (item.audio) return { type: 'recording', source: item.audio };
  }

  if (item.femaleAudioId) return { type: 'female-local', id: item.femaleAudioId };
  if (item.ttsF) return { type: 'female-bundle' };
  if (item.audio) return { type: 'recording', source: item.audio };
  return { type: 'speech', text: item.text };
}
