# Yomi roadmap

Priorities are ordered. The first item remains the active priority; completed work is checked off.

## Current priorities

- [x] **Kanji deck**: add furigana and Romaji controls, on/kun readings, pitched examples, sequential unlocks for the ordered lesson groups, and natural-first audio for every kanji, reading, and example sentence; use KANJIDIC2 / Kanjium and include source/license credits. Resize practice panels consistently across tabs.
- [ ] **Accounts and cloud-backed user data**: add sign-in, replace browser/session-dependent storage with a database for user details and progress, and cloud file storage for custom-word audio so it persists across sessions and devices.
- [x] **Expand the Hiragana and Katakana decks** with more useful and difficult-to-pronounce words, including コロナウイルス. Look for an appropriately licensed human recording first, and generate a female VOICEVOX recording for every added item regardless of whether a human recording is found.
- [x] **Add a word-entry page** for Hiragana and Katakana. Let learners enter a kana word, English meaning, theme, pitch accent (with an unknown option), and human-recording source/audio. Require a human-recording search before saving, and always generate female VOICEVOX audio.
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
