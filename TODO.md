# Yomi roadmap

Priorities are ordered. The first item remains the active priority; completed work is checked off.

## Current priorities

- [x] **Kanji deck**: add furigana and Romaji controls, on/kun readings, pitched examples, sequential unlocks for the ordered lesson groups, and natural-first audio for every kanji, reading, and example sentence; use KANJIDIC2 / Kanjium and include source/license credits. Resize practice panels consistently across tabs.
- [x] **Accounts and cloud-backed user data**: Google and passwordless email sign-in; local-first use with registration prompt; Supabase sync for progress/preferences/custom words/audio; explicit local-data transfer or merge.
- [x] **Expand the Hiragana and Katakana decks** with more useful and difficult-to-pronounce words, including コロナウイルス. Look for an appropriately licensed human recording first, and generate a female VOICEVOX recording for every added item regardless of whether a human recording is found.
- [x] **Add a word-entry page** for Hiragana and Katakana. Learners can enter kana, meaning, theme, optional pitch, and human-recording source/audio; custom words without recordings use browser-native Japanese speech synthesis with no local engine.
- [x] **Prioritize Kansai recordings**: use the Kansai clip as the primary playback whenever one is available, ahead of Tokyo recordings and synthetic voices; expose the other voice as an explicit alternate.
- [x] **Simplify Kanji settings dock**: remove the unused lower settings row from the Kanji page.
- [x] **Admin shared deck catalog**: add, edit, and remove shared Hiragana, Katakana, and phrase deck items through the admin-only Decks tab.
- [x] **Remove male VOICEVOX audio** from the app and generated data. Keep human recordings, including male recordings, when available; use the female VOICEVOX voice as the synthetic option.
- [x] **Polish the settings dock and logo**: keep Romaji and Pitch marks information buttons fully visible, and use the app's blue accent instead of orange in the Yomi mark.

## Existing roadmap

- [ ] **Record-and-compare**: capture microphone audio, show the learner's pitch contour against the reference, and provide a mora-level score.
- [ ] **More real audio**: find permissively licensed Tokyo-accent clips for Katakana words and phrases, and use them ahead of synthetic audio.
- [ ] **Spaced repetition**: replace weighted random selection with a real system such as Leitner or FSRS.
- [ ] **Sentence deck**: add short graded sentences with chunk highlighting, beyond the existing 40 phrases.
- [ ] **Export / import progress** (JSON), optional cloud sync, and per-day streaks.
- [ ] **Verify and correct accents** against the teacher's material; add a per-item "report wrong pitch" note stored locally.
- [ ] **Offline / PWA** packaging.
- [ ] **Accessibility pass**, including screen-reader labels on pitch bars and Japanese font fallbacks across platforms.
