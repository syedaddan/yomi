# Yomi Drill (読み)

A small multi-page Japanese **reading trainer** for hiragana and katakana (the Kanji page is a placeholder for later).
Built for a learner who is preparing for class reading tests and wants to stop decoding character by character.

The app is a small React site built with Vite. It runs entirely in the browser: no account, server, or backend is required. The static build is hosted with GitHub Pages.

---

## 1. What it is for

The owner's goals (from the Claude Project "Japanese Reading"):

| Goal | How the tool addresses it |
|---|---|
| **Speed** (read words and whole phrases without stalling on characters) | Drill with timed reads, Flash mode (word hides after N ms), 60-second Sprint (mora/min), Phrase pacer (highlight moves at a set mora/s), weighted shuffle that repeats slow and missed cards |
| **Accuracy** (pronunciation + intonation) | Every word shows pitch-accent marks (red bar above = high, blue bar below = low, ↘ = drop, ↗ = question). Audio per card: real recordings where available, otherwise VOICEVOX voices whose pitch is forced from the dictionary accent. Male/Female voice switch |
| **Correctness** (confusable characters) | "Look-alikes" page: シ/ツ, ソ/ン, ぬ/め, ね/れ/わ, etc., with quizzes and tips. Progress page tracks per-item misses |
| **Kanji** | Tab exists, empty ("later") |

The user explicitly asked for **real recorded clips over TTS**. TTS is only a fallback. See section 5 for what is real and what is not.

## 2. Features (current state)

- **Drill page**: mix decks freely (Hiragana words 182, Katakana words 164, Phrases 40, Kanji disabled), filter by themes (Home, Food, People, Places, Time, Nature, Body, IT & Work, Verbs, Adjectives, Tech, Food & Drink, Travel, Clothes, School & Fun, Look-alikes, Greetings, Class & Daily ...).
  - Modes: Read (time measured to reveal), Flash (hidden after N ms), Sprint (60 s).
  - Reveal shows pitch marks, romaji, meaning, audio controls (Voice Male/Female, Play, Slow, "Other recording" Kansai clip where present).
  - Rate: Missed / Slow / Got it (keys 1/2/3). Stats persist in `localStorage`.
  - **Back / Forward** (buttons and ← → keys). History stack of the last 100 cards; revisited cards show revealed and are never double-counted. Forward on a fresh card = Skip (no rating recorded).
  - Keys: Space/Enter reveal, P play, 1/2/3 rate, ←/→ back/forward, X (sprint miss).
- **Phrase pacer page**: pick a phrase, set speed (mora/s), highlight walks the moras. "Speak along" plays a VOICEVOX clip and the highlight is driven by `audio.currentTime` against exact per-mora onset times (so voice and highlight cannot drift). Voice Male/Female. Previous / Next (B / N, ← →).
- **Look-alikes page**: 20-item quizzes over confusable sets.
- **Progress page**: per-session and saved stats (see the page).
- Light/dark theme (follows OS), phone-friendly layout, keyboard friendly.

## 3. Repository layout

```
yomi-drill/
  README.md
  index.html             Drill page and Vite entry
  pacer.html             Phrase pacer page
  alike.html             Look-alikes page
  progress.html          Progress page
  kanji.html             Kanji placeholder page
  package.json           familiar npm commands and dependencies
  package-lock.json      exact installed package versions
  vite.config.js         static build settings, including GitHub Pages base path
  .github/workflows/     GitHub Pages build-and-publish workflow
  src/
    App.jsx              page shell, page selection, and shared preferences
    components/
      Drill.jsx          card modes, rating, history, and sprint
      Pacer.jsx          phrase selection and synchronized playback
      StudyTabs.jsx      look-alikes, progress, and kanji placeholder
      shared.jsx         pitch display, page navigation, and shared controls
    core.js              pure mora, pitch, and romaji helpers
    data.js              deck data mapping and look-alike sets
    storage.js           local preferences and progress
    audio.js             audio playback and female voice bundle
    styles.css           app styles
  build/
    candidates.py, analyze.py, hira_rows.json   hiragana word selection + Tofugu clip matching
    build2.py         builds data.json skeleton (katakana deck, phrases, Kanjium accents)
    qa.py             F0 sanity check of male clips + keeps male phrase clips
    add_alt.py        adds Kansai alternate clips (f###, pf##)
  tts/
    vv_lib.py         VOICEVOX helpers (build accent phrases, render, mora timings, F0 tracker)
    gen_common.py     shared bits of the generators
    gen.py            male VOICEVOX clips tm_*.mp3 + tts/tl/tend fields in data.json
    gen_female.py     female VOICEVOX bundle out/audio/female_voice.mp3 + ttsF/tlF/tendF
    vv_eval2.py, vv_eval3.py, final_qa.py   voice evaluation / pitch QA scripts
  tests/
    smoke.py, pace_test.py, clip_test.py, nav_test.py    Playwright (Chromium) tests
  out/
    data.json         deck data imported by the app
    audio/            source audio files used by the app and generators
  public/audio/       generated local copy served by Vite (git-ignored)
  dist/               generated static site uploaded to GitHub Pages (git-ignored)
```

## 4. Architecture and data

- **React** renders the app and keeps interface state in components. Each section is a separate HTML page with its own URL; shared navigation uses regular links and browser history. Feature components live in separate files.
- **Vite** is the local development server and production builder; it bundles the React code into regular static HTML, CSS, and JavaScript. It builds every HTML page for GitHub Pages. Vite does not run on the hosted site.
- `out/data.json` is imported into the app at build time. Before starting Vite or building, an npm pre-script copies `out/audio/` to the ignored `public/audio/`; Vite then serves and bundles those static audio files.
- `data.json` schema:
  ```
  hira: [{kana, en, theme, accent, audio, alt, tts, ttsF}]
  kata: [{kana, en, theme, accent, tts, ttsF}]
  phr:  [{theme, chunks:[{w, p, a, src}], en, audio, alt, q, tts, tl, tend, tdur, ttsF, tlF, tendF}]
  ```
  - `accent`: Kanjium string such as `0`, `2`, `(名)2,(感)4,0`. `accentList()` takes the numbers; the first is shown.
  - `audio`: real Tokyo-male recording. `alt`: Kansai recording (extra button only). `tts`: male VOICEVOX clip path.
  - `ttsF = {o, l}`: byte offset and length of this item's clip inside `audio/female_voice.mp3`.
  - `tl[]`: per-mora onset seconds, `tend`: end of last mora, for the pacer. `tlF/tendF` = same for the female voice.
  - Phrase `chunks`: `w` word, `p` particles/ending glued after it, `a` accent (0 = flat, null = none), `src` `dict` or `rule`.
- **Mora**: one beat. Small ゃゅょ and ぁぃぅぇぉ join the previous kana; っ, ん, ー each count as one.
- **Pitch model** (`pitchPattern(n, a)`): a=0 → L H H…; a=1 → H L L…; a=n → L H…H (odaka); otherwise L H…H L…. Particles are high after a flat word, low otherwise.
- **Audio priority** in the drill: (voice=Female and `ttsF`) → female bundle; otherwise real recording `audio` → `tts` → browser Web Speech (last resort).
- **Female bundle**: ONE 2.3 MB mp3 fetched lazily on first use, sliced into per-item Blobs. If the fetch fails the page falls back to the male voice and says so.
- **Pacer clip sync**: each recording's per-mora onset timeline drives the highlight from `audio.currentTime`; playback rate is clamped to 0.5-2.
- Preferences and stats live in `localStorage` (per browser). Wrapped in try/catch.

## 5. What was done, with measurements (be honest about quality)

1. **Resources searched**: Tofugu/WaniKani vocabulary audio (CC BY-SA 4.0), Kanjium pitch accent dictionary, VOICEVOX, Kokoro, Forvo/NHK (not usable offline/licensing).
2. **Hiragana deck**: 182 common words matched to Tofugu clips. 126 are Tokyo-accent male (median F0 < 170 Hz) and used as the primary clip; 56 only had a female Kansai recording, so those are kept as the "Other recording" button and the main audio is VOICEVOX.
3. **Katakana deck** (164 words) and **phrase deck** (40 phrases): Kanjium accents; ます/ました/ません endings use the standard rule (`src: 'rule'`); the user's own name has no pitch (`NO_PITCH`). Only 4 phrases have a real clip (Kansai female, so not used as primary). **All other phrases and all katakana words are synthetic (VOICEVOX).**
4. **Pitch QA by F0 tracking** (autocorrelation per mora segment), agreement with the dictionary accent:
   - Tofugu male recordings ≈ 73% (the dictionary itself is not always the speaker's accent).
   - Kokoro voices 36-64% → rejected (not controllable).
   - **VOICEVOX 白上虎太郎 (male, style 12): 81%** (142/175 on the deck). Used for male.
   - **VOICEVOX 九州そら (female, style 16): 81%** (94/116 sampled). Used for female. Other female candidates on the same test: もち子さん 79%, 冥鳴ひまり 70%, 四国めたん 69%, 春日部つむぎ 62%.
   So about 1 word in 5 will sound off against the marks. **The marks are the reference, the voice is a guide.** The caption in the UI says this.
5. **Speak-along bug fixed**: the old version used browser TTS and a timer, so the voice drifted from the highlight. Now clip-based and `currentTime`-driven.
6. **VOICEVOX trick that matters**: do NOT pass a kana string with an accent mark (it splits phrases). Build `accent_phrases` yourself (`accent = n` for flat words, else `a`), call `POST /mora_data`, set `is_interrogative` on the last phrase for questions, then `/synthesis`. See `tts/vv_lib.py: build_query`. Intonation scale 1.3.
7. **Back/Forward + voice selector + female voice + README** (latest round).

Core reading logic is covered by `npm test`. The Playwright scripts exercise the running Vite app.

## 6. Work on the app and publish it

```bash
# One-time setup after cloning
npm install

# Start the local development site; open the URL Vite prints (usually http://localhost:5173)
npm run dev
# Stop it with Ctrl+C

# Run pure JavaScript logic tests
npm test

# Create and preview the static production site
npm run build
npm run preview
```

**What is Vite?** React is the UI library you use to write the app. Vite is a small helper around it: `npm run dev` starts a fast local server with automatic refresh when you edit files; `npm run build` turns the app into static files. You mostly work in `src/` and use normal React, JSX, and CSS. You do not need to learn a second UI framework, and Vite is not needed after the site has been built.

To publish with GitHub Pages, push to the `main` or `master` branch. The workflow in `.github/workflows/pages.yml` builds the site and publishes `dist/`. The first time, open the repository's **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source. The build automatically uses the repository name as the Pages path, so the app and its audio work when hosted under `username.github.io/repository/`.

Optional browser tests use Playwright. Start `npm run dev` in one terminal, install Playwright and Chromium once (`pip install playwright` and `playwright install chromium`), then run `python tests/smoke.py`, `python tests/pace_test.py`, `python tests/clip_test.py`, or `python tests/nav_test.py` in another terminal.

## 7. Regenerating data and audio (only if you change decks)

Requirements: Python 3.10+, `numpy`, `soundfile`, `ffmpeg` on PATH, `py7zr` (to unpack the engine), plus:
- Tofugu repo: `GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/tofugu/japanese-vocabulary-pronunciation-audio` (mp3s are in `lib/mp3/`, named `漢字【かな】.mp3`).
- Kanjium `accents.txt` from https://github.com/mifunetoshiro/kanjium (`data/source_files/accents.txt`).
- VOICEVOX engine 0.24.1 (CPU is fine), GitHub release asset `voicevox_engine-linux-cpu-*` / the Windows or macOS build. Run it so `http://127.0.0.1:50021/version` answers. Speakers used: style 12 (白上虎太郎 ふつう), style 16 (九州そら ノーマル).

Order:
```
python3 build/candidates.py ...  &&  python3 build/analyze.py ...   # pick hiragana words / match clips (see script headers)
python3 build/build2.py <tofugu-repo> <kanjium accents.txt> build/hira_rows.json out
python3 build/qa.py <tofugu-repo> out build/hira_rows.json
python3 build/add_alt.py <tofugu-repo> out
python3 tts/gen.py            # male clips + tts/tl/tend
python3 tts/gen_female.py     # female bundle + ttsF/tlF/tendF
```
Check each script's header for exact arguments; they use `ROOT`-relative paths, so run them from anywhere.

## 8. Known limitations

- Pitch is not verified by a human. ~80% agreement with the dictionary for the synthetic voices, ~73% for the real recordings (speaker accent differs from the dictionary at times). Dictionary accents themselves vary by dialect and by compound/phrase context.
- Within phrases each chunk uses its own dictionary pitch; real speech shifts pitch across chunks. A visible note says so.
- 56 hiragana words and 36 of 40 phrases have no real Tokyo-accent recording. Katakana has none. These use VOICEVOX.
- No microphone / pronunciation scoring yet (the "accuracy" goal is only listening + marks so far).
- No kanji. No furigana. Stats are per browser (`localStorage`), no sync or export.
- Progress and preferences stay in this browser's `localStorage`; they do not sync to other devices.
- The GitHub Pages site needs an internet connection for its Google Fonts and for the first lazy load of the bundled female voice.

## 9. TODO (suggested order)

1. **Record-and-compare**: mic capture, show learner pitch contour (F0) over the reference contour, show a mora-level score. This is the biggest missing piece for the pronunciation and intonation goal.
2. **Kanji deck** (JLPT N5 first): reading drill with furigana toggle, on/kun readings, compound words with pitch. Fill the existing Kanji page. Data: KANJIDIC2 / Kanjium.
3. **More real audio**: find permissively licensed Tokyo-accent clips for katakana words and phrases, and use them ahead of TTS.
4. **Real spaced repetition** (Leitner or FSRS) instead of the weighted random picker.
5. **Sentence deck**: short graded sentences with chunk highlighting, longer than the 40 phrases.
6. **Export / import progress** (JSON), optional cloud sync, and per-day streaks.
7. **Adjustable user deck**: paste a word list from class, look up pitch accents, and generate VOICEVOX audio.
8. **Verify and correct accents** with the teacher's material; add a per-item "report wrong pitch" note stored locally.
9. **Offline/PWA** packaging.
10. **Accessibility pass** (including screen-reader labels on pitch bars) and Japanese font fallbacks for all platforms.

## 10. Licences and credits (keep these in the page footer)

- Word recordings: WaniKani / Tofugu, CC BY-SA 4.0 (derived mp3s in this repo remain CC BY-SA).
- Pitch accents: Kanjium.
- Voices: VOICEVOX:白上虎太郎 and VOICEVOX:九州そら. VOICEVOX's terms require crediting the character, e.g. "VOICEVOX:九州そら". Check each character's terms before commercial use.
- Page code: yours to license.

## 11. Notes for contributors

- Edit the React components and styles under `src/`; do not edit generated `public/audio/` or `dist/`.
- Keep `src/core.js` pure and covered by `npm test`; add a test with every change to mora, pitch, or romaji logic.
- Keep the honesty about pitch quality in the UI captions. Do not claim the synthetic voices are always right.
- Never double-count stats when a card is revisited; the drill history and rating state handle this.
- The owner is an ML/CV engineer learning Japanese from zero; reading tests are coming up in class. Keep the UI student friendly, plain English, no jargon beyond "mora" (which is explained in the pacer).
