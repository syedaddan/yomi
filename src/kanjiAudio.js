export function getKanjiAudioControls(item) {
  const hasNatural = Boolean(item?.audio);
  const hasSynthetic = Boolean(item?.ttsF);

  return {
    primaryVoice: hasNatural ? 'recording' : hasSynthetic ? 'female' : null,
    hasSyntheticAlternate: hasNatural && hasSynthetic,
    showSyntheticInfo: hasSynthetic,
  };
}
