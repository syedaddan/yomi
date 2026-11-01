# Yomi (読み)

A small React Japanese **reading trainer** for hiragana, katakana, and beginner kanji.
Built for a learner who is preparing for class reading tests and wants to stop decoding character by character.

The app is a small React site built with Vite and can be hosted on GitHub Pages. Local study remains available without an account; optional Supabase accounts sync progress and custom-word audio between devices. The Add words page uses a local VOICEVOX Engine on your own computer when you create a word. The illustrated Yomi mark is also used as the site favicon; audio and data credits are available from the information button beside the logo. Pages use extensionless paths, with Drill at the site root.

---

## 1. What it is for

The owner's goals (from the Claude Project "Japanese Reading"):

| Goal | How the tool addresses it |
|---|---|
| **Speed** (read words and whole phrases without stalling on characters) | Drill with timed reads, Flash mode (word hides after N ms), 60-second Sprint (mora/min), Phrase pacer (highlight moves at a set mora/s), weighted shuffle that repeats slow and missed cards |
| **Accuracy** (pronunciation + intonation) | Every word shows pitch-accent marks (red bar above = high, blue bar below = low, ↘ = drop, ↗ = question). Human recordings are preferred where available; female VOICEVOX is the synthetic voice. |
| **Correctness** (confusable characters) | "Look-alikes" page: シ/ツ, ソ/ン, ぬ/め, ね/れ/わ, etc., with quizzes and tips. Progress page tracks per-item misses |
| **Kanji** | Study ordered lesson groups with KANJIDIC2 on/kun readings and Kanjium-pitched example words; unlock groups one at a time |

Human clips are preferred for playback when available. Every custom word also gets a female VOICEVOX clip, even when a human recording is found.

## 2. Features (current state)

- **Drill section**: mix decks freely (Hiragana 193, Katakana 169, Phrases 40, plus words added in this browser), filter by themes (Home, Food, People, Places, Time, Nature, Body, IT & Work, Verbs, Adjectives, Tech, Food & Drink, Travel, Clothes, School & Fun, Look-alikes, Greetings, Class & Daily ...).
  - Modes: Read (time measured to reveal), Flash (hidden after N ms), Sprint (60 s).
  - Reveal shows pitch marks, romaji, meaning, audio controls (human recording / female VOICEVOX, Play, Slow, "Other recording" clip where present).
  - Rate: Missed / Slow / Got it (keys 1/2/3). Progress persists locally and syncs to your account when signed in.
  - **Back / Forward** (buttons and ← → keys). History stack of the last 100 cards; revisited cards show revealed and are never double-counted. Forward on a fresh card = Skip (no rating recorded).
  - Keys: Space/Enter reveal, P play, 1/2/3 rate, ←/→ back/forward, X (sprint miss).
- **Phrase pacer section**: pick a phrase, set speed (mora/s), highlight walks the moras. "Speak along" plays a female VOICEVOX clip and the highlight is driven by `audio.currentTime` against exact per-mora onset times (so voice and highlight cannot drift). Previous / Next (B / N, ← →).
- **Add words section**: add Hiragana or Katakana words to a personal deck with meaning, theme, optional dictionary pitch, source link, and optional human audio. Signed-in users sync words and recordings; words join their existing Kana drill deck. Search for human audio first; generating a female VOICEVOX clip is always required. Difficult starter words include コロナウイルス, きょうりゅう, and きゅうきゅうしゃ.
- **Decks admin tab**: the admin can add, edit, or remove original Hiragana, Katakana, and phrase items for everyone. Changes are stored as shared overrides; regular users cannot access the tab or write to the catalog.
- **Kanji section**: study ordered lesson groups with KANJIDIC2 readings and Kanjium-pitched example compounds. Learners can reveal and rate each character; the Progress page tracks views and ratings. Only the admin can unlock lessons globally. Each kanji, listed reading, and example sentence has VOICEVOX audio; reusable Tatoeba sentence recordings play first where available. Sentence text, English translation, and per-item attribution are shown with each example.
- **Account page**: manage a private profile and picture, set a password, or delete the account and its cloud data.
- **Look-alikes section**: 20-item quizzes over confusable sets.
- **Progress section**: per-session and saved stats (see the section).
- Light/dark theme (follows OS), phone-friendly layout, keyboard friendly. Romaji and pitch-mark information buttons remain fully visible beside their controls in the bottom dock; the Yomi mark uses the app's blue accent.

## 3. Repository layout

```
yomi/
  README.md
  index.html             Vite entry for the React app
  public/yomi-mark.svg   illustrated Yomi logo and favicon
  package.json           familiar npm commands and dependencies
  package-lock.json      exact installed package versions
  vite.config.js         static build settings, including GitHub Pages base path
  .github/workflows/     GitHub Pages build-and-publish workflow
  src/
    App.jsx              app shell, extensionless client-side routing, and shared preferences
    components/
      Drill.jsx          card modes, rating, history, and sprint
      Pacer.jsx          phrase selection and synchronized playback
      AddWords.jsx       browser-local word form and starter vocabulary
      StudyTabs.jsx      look-alikes and progress
      KanjiDeck.jsx      N5 kanji cards, readings, furigana, and audio examples
      SettingsBar.jsx    fixed bottom settings dock and expandable controls
      shared.jsx         pitch display, navigation, and shared controls
    core.js              pure mora, pitch, and romaji helpers
    data.js              deck data mapping and look-alike sets
    storage.js           local preferences and progress
    customWords.js       custom word validation and normalization
    customAudio.js       IndexedDB storage for custom audio
    voicevox.js          female VOICEVOX Engine synthesis for custom words
    audio.js             human/female audio playback and female voice bundle
    styles.css           app styles
  build/
    candidates.py, analyze.py, hira_rows.json   hiragana word selection + Tofugu clip matching
    kanji_deck.py      builds the kanji data from KANJIDIC2 and Kanjium
    build2.py         builds data.json skeleton (katakana deck, phrases, Kanjium accents)
    qa.py             F0 sanity check of human recordings + selects phrase recordings
    add_alt.py        adds Kansai alternate clips (f###, pf##)
  tts/
    vv_lib.py         VOICEVOX helpers (build accent phrases, render, mora timings, F0 tracker)
    gen_common.py     shared bits of the generators
    gen_female.py     female VOICEVOX bundle out/audio/female_voice.mp3 + ttsF/tlF/tendF
    import_tatoeba.py imports cited sentences and explicitly reusable natural recordings
    gen_kanji.py     generates missing Kanji, reading, and sentence audio
    vv_eval2.py, vv_eval3.py, final_qa.py   female voice evaluation / pitch QA scripts
  tests/
    smoke.py, pace_test.py, clip_test.py, nav_test.py    Playwright (Chromium) tests
  out/
    data.json         kana and phrase data imported by the app
    kanji.json        KANJIDIC2 character readings and Kanjium vocabulary accents
    audio/            source audio files used by the app and generators
  public/audio/       generated local copy served by Vite (git-ignored)
  dist/               generated static site uploaded to GitHub Pages (git-ignored)
```

## 4. Architecture and data

- **React** renders the app and keeps interface state in components. Sections use client-side extensionless paths (`/`, `/pacer`, `/alike`, `/add`, `/progress`, `/kanji`), so navigation switches the active React view without reloading the document or exposing `.html` routes. Browser back/forward works normally, and the GitHub Pages fallback supports direct visits and refreshes on section paths.
- **Vite** is the local development server and production builder; it bundles the React code into regular static HTML, CSS, and JavaScript. GitHub Pages serves the single app entry; Vite does not run on the hosted site.
- The compact top bar holds the centered Yomi brand and section navigation. A fixed two-row bottom settings dock is available throughout the app: display toggles and Drill reading mode are on the first row, and deck/theme/study controls are on the second. Large option lists open into small panels; selected Drill themes stay visible as removable chips with a selected/available count. Each row has its own reset action; resets restore preferences without deleting study progress.
- Without an account, progress and custom words remain local to the browser. After sign-in, progress syncs to a user-owned Supabase row and custom audio to private user storage; local copies are retained.
- To create a custom word, search for a human recording first, provide its source if found, then generate a female VOICEVOX clip. The page requires the VOICEVOX Engine at `127.0.0.1:50021` with browser CORS enabled. If no human recording is found, the female clip is still generated and used.
- Deck, mode, script, and audio choices use compact pressed-state buttons rather than radio controls. Voice and audio details are available from keyboard-accessible `i` information buttons.
- `out/data.json` is imported into the app at build time. Before starting Vite or building, an npm pre-script copies `out/audio/` to the ignored `public/audio/`; Vite then serves and bundles those static audio files.
- The Kanji section is a separate study deck and does not change kana drill selection. Its curated character set is paired with KANJIDIC2 readings/meanings, Kanjium example-word pitch accents, and sentence/audio attribution.
- Kanji sentences and translations come from Tatoeba when available; the two uncovered examples use original practice sentences. Natural audio is included only when the recording is explicitly CC BY 4.0 or CC BY-NC 4.0. All other kanji, reading, and sentence audio is synthesized locally with VOICEVOX.
- `data.json` schema (male VOICEVOX clips and fields are removed):
  ```
  hira: [{kana, en, theme, accent, audio, alt, ttsF}]
  kata: [{kana, en, theme, accent, ttsF}]
  phr:  [{theme, chunks:[{w, p, a, src}], en, audio, alt, q, ttsF, tlF, tendF}]
  ```
  - `accent`: Kanjium string such as `0`, `2`, `(名)2,(感)4,0`; custom words may have unknown pitch. `accentList()` takes the numbers; the first is shown.
  - `audio`: human recording when available. `alt`: alternate human recording (extra button only).
  - `ttsF = {o, l}`: byte offset and length of this item's clip inside `audio/female_voice.mp3`.
  - `tlF/tendF`: per-mora onset seconds and end of last mora for the female VOICEVOX pacer clip.
  - Phrase `chunks`: `w` word, `p` particles/ending glued after it, `a` accent (0 = flat, null = none), `src` `dict` or `rule`.
- **Mora**: one beat. Small ゃゅょ and ぁぃぅぇぉ join the previous kana; っ, ん, ー each count as one.
- **Pitch model** (`pitchPattern(n, a)`): a=0 → L H H…; a=1 → H L L…; a=n → L H…H (odaka); otherwise L H…H L…. Particles are high after a flat word, low otherwise.
- **Audio priority** in the drill: Female VOICEVOX uses the female bundle; Recording uses a human clip when available and otherwise the female bundle. A device voice is only a last resort if a clip cannot be loaded.
- **Female bundle**: one MP3 fetched lazily on first use and sliced into per-item Blobs. No male VOICEVOX clips are shipped or used.
- **Pacer clip sync**: the female VOICEVOX clip's per-mora onset timeline drives the highlight from `audio.currentTime`; playback rate is clamped to 0.5-2.
- Preferences and progress are retained locally for local-first use and synced to separate per-user Supabase tables when signed in.

## 5. What was done, with measurements (be honest about quality)

1. **Resources searched**: Tofugu/WaniKani vocabulary audio (CC BY-SA 4.0), Kanjium pitch accent dictionary, VOICEVOX, Kokoro, Forvo/NHK (not usable offline/licensing).
2. **Hiragana deck**: 193 common words matched to Tofugu clips. Human recordings are used where available; alternate clips are kept when present.
3. **Katakana deck** (169 words) and **phrase deck** (40 phrases): Kanjium accents where available; ます/ました/ません endings use the standard rule (`src: 'rule'`); the user's own name has no pitch (`NO_PITCH`). Four phrases have a human clip; Katakana items use female VOICEVOX.
4. **Pitch QA by F0 tracking** (autocorrelation per mora segment), agreement with the dictionary accent:
   - Kokoro voices 36-64% → rejected (not controllable).
   - **VOICEVOX 九州そら (female, style 16): 81%** (94/116 sampled). Used for female. Other female candidates on the same test: もち子さん 79%, 冥鳴ひまり 70%, 四国めたん 69%, 春日部つむぎ 62%.
   So about 1 word in 5 will sound off against the marks. **The marks are the reference, the voice is a guide.** The voice information button in the UI explains this.
5. **Speak-along bug fixed**: the old version used browser TTS and a timer, so the voice drifted from the highlight. Now clip-based and `currentTime`-driven.
6. **VOICEVOX trick that matters**: do NOT pass a kana string with an accent mark (it splits phrases). Build `accent_phrases` yourself (`accent = n` for flat words, else `a`), call `POST /mora_data`, set `is_interrogative` on the last phrase for questions, then `/synthesis`. See `tts/vv_lib.py: build_query`. Intonation scale 1.3.
7. **Fast routes, shared settings dock, and local custom vocabulary**.

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

### Optional Supabase accounts and sync

1. Create a Supabase project and run the migrations in order in its SQL editor: [`202611020001_user_data.sql`](./supabase/migrations/202611020001_user_data.sql), [`202611020002_profiles_and_structured_progress.sql`](./supabase/migrations/202611020002_profiles_and_structured_progress.sql), then [`202611020003_admin_deck_catalog.sql`](./supabase/migrations/202611020003_admin_deck_catalog.sql). Migration 002 converts existing JSON progress into readable per-user tables and assigns admin access only to `syedaddan@gmail.com`; migration 003 enables shared admin editing of the original decks. If you have already run migrations 001 and 002, run only 003; do not rerun earlier migrations.
2. In Supabase Authentication, enable Google and email OTP (magic links). Add the local and deployed Yomi URLs to the allowed redirect URLs. Configure the Google OAuth client in Supabase; no Google client secret belongs in this repository.
3. Copy `.env.example` to `.env.local` for local development and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and public anon/publishable key.
4. Add those same values as GitHub Actions repository variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the Pages build enables accounts. These browser values are public; database and storage access is protected by row-level security.
5. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), sign in with `supabase login`, link this repository to your project with `supabase link --project-ref <your-project-ref>`, then deploy account deletion with `supabase functions deploy delete-account`. The function verifies the signed-in user and uses Supabase's server-side service-role environment value; never copy that secret into GitHub variables or the browser app.

On first visit, learners can register/sign in with Google or an emailed sign-in link, or continue locally. On sign-in, Yomi offers an explicit transfer/merge or cloud-data choice when the device and account differ. Custom recordings are uploaded to the user's private storage area. Signed-in users can edit a private profile, upload an avatar, set a password, or delete their account and associated data. Progress, look-alike results, Kanji views/ratings, preferences, sprints, and custom kana words are stored in separate per-user tables. Admin edits to original deck items are shared with all users; user-added words remain private to their owner. Only the admin account can unlock Kanji lessons globally; other users are prompted to contact the admin.

Optional browser tests use Playwright. Start `npm run dev` in one terminal, install Playwright and Chromium once (`pip install playwright` and `playwright install chromium`), then run `python tests/smoke.py`, `python tests/pace_test.py`, `python tests/clip_test.py`, or `python tests/nav_test.py` in another terminal.

## 7. Regenerating data and audio (only if you change decks)

Requirements: Python 3.10+, `numpy`, `soundfile`, and either FFmpeg on PATH or `imageio-ffmpeg`; `py7zr` is only needed to unpack the VOICEVOX Engine. Tatoeba import uses the Python standard library.
- Tofugu repo: `GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/tofugu/japanese-vocabulary-pronunciation-audio` (mp3s are in `lib/mp3/`, named `漢字【かな】.mp3`).
- Kanjium `accents.txt` from https://github.com/mifunetoshiro/kanjium (`data/source_files/raw/accents.txt`).
- VOICEVOX engine 0.24.1 (CPU is fine), GitHub release asset `voicevox_engine-linux-cpu-*` / the Windows or macOS build. Run it so `http://127.0.0.1:50021/version` answers. The female synthetic voice is 九州そら (style 16).

Order:
```
python3 build/candidates.py ...  &&  python3 build/analyze.py ...   # pick hiragana words / match clips (see script headers)
python3 build/build2.py <tofugu-repo> <kanjium accents.txt> build/hira_rows.json out
python3 build/qa.py <tofugu-repo> out build/hira_rows.json
python3 build/add_alt.py <tofugu-repo> out
python3 tts/gen_female.py     # female bundle + ttsF/tlF/tendF
```
Check each script's header for exact arguments; they use `ROOT`-relative paths, so run them from anywhere.

To regenerate the Kanji data, download [KANJIDIC2](https://www.edrdg.org/kanjidic/kanjidic2.xml.gz), [Kanjium accents.txt](https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt), and [Kanjium jukugo.txt](https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/jukugo.txt), then run:
```
python3 build/kanji_deck.py <kanjidic2.xml.gz> <accents.txt> <jukugo.txt> out/kanji.json
```
The ordered groups and original presentation filenames are recorded in `build/kanji_groups.json`. The first filename names the range 1–10, represented as 一 through 十. The filenames identify 272 unique characters; slide contents were not inspected, so characters shown only inside slides are not included. The final extra group preserves 立 and 耳 from the earlier deck.

Run `python3 tts/import_tatoeba.py` to add sourced sentences and translations with their Tatoeba credits, plus natural recordings explicitly licensed CC BY 4.0 or CC BY-NC 4.0. The deck stores per-sentence, translation, and audio credits; CC BY-NC recordings are for non-commercial use only. Then run `python3 tts/gen_kanji.py` with the local VOICEVOX Engine available at `127.0.0.1:50021` to synthesize every kanji, reading, and sentence. Install `imageio-ffmpeg` if FFmpeg is not on PATH. The generated `out/audio/kanji_voice.mp3` and Tatoeba recordings ship with the static site. To add personal words from the site, run the local VOICEVOX Engine with browser CORS enabled (for example, `run.exe --cors_policy_mode all` on Windows), then open the **Add words** section. Without an account, personal words and recordings stay in that browser; signed-in users can sync them to their account.

## 8. Known limitations

- Pitch is not verified by a human. ~80% agreement with the dictionary for the synthetic voices, ~73% for the real recordings (speaker accent differs from the dictionary at times). Dictionary accents themselves vary by dialect and by compound/phrase context.
- Within phrases each chunk uses its own dictionary pitch; real speech shifts pitch across chunks. A visible note says so.
- 64 hiragana words and 36 of 40 phrases have no real Tokyo-accent recording. Katakana has none. These use VOICEVOX.
- No microphone / pronunciation scoring yet (the "accuracy" goal is only listening + marks so far).
- Kanji practice is separate from the kana drill. Lesson availability is global and admin-controlled; per-character views and ratings sync for signed-in users. The filename-derived list has 272 unique characters (plus two preserved from the previous deck), fewer than the approximately 450 estimated from the full slide contents; characters not present in filenames are not included.
- Without signing in, progress and preferences stay in this browser's `localStorage`; account sync requires configuring Supabase as described above.
- The GitHub Pages study site needs an internet connection for Google Fonts and the first lazy load of the bundled female voice. Adding words also requires a locally running VOICEVOX Engine.

## 9. Roadmap

The prioritized project roadmap, including deck expansion and user-added vocabulary, is maintained in [TODO.md](./TODO.md).

## 10. Licences and credits (keep these in the page footer)

- Word recordings: WaniKani / Tofugu, CC BY-SA 4.0 (derived mp3s in this repo remain CC BY-SA).
- Kanji readings and meanings: KANJIDIC2, © Electronic Dictionary Research and Development Group (EDRDG), CC BY-SA 4.0. [Source](https://www.edrdg.org/kanjidic/kanjidic2.xml.gz) · [licence](https://www.edrdg.org/edrdg/licence.html).
- Example vocabulary and pitch accents: Kanjium, including additions and modifications provided by Uros O., CC BY-SA 4.0. [Source](https://github.com/mifunetoshiro/kanjium) · [licence](https://creativecommons.org/licenses/by-sa/4.0/).
- Voice: VOICEVOX:九州そら. VOICEVOX's terms require crediting the character. Check the character's terms before commercial use.
- Kanji sentences and translations: Tatoeba contributors, [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/); each source and contributor is linked from the example's information button.
- Natural Kanji sentence recordings: Tatoeba contributors, per-record [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) or [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Audio contributor, license, and attribution link are stored with each recording. CC BY-NC recordings may only be used non-commercially.
- Page code: yours to license.

## 11. Notes for contributors

- Edit the React components and styles under `src/`; do not edit generated `public/audio/` or `dist/`.
- Keep `src/core.js` pure and covered by `npm test`; add a test with every change to mora, pitch, or romaji logic.
- Keep the honesty about pitch quality in the UI voice information. Do not claim the synthetic voices are always right.
- Never double-count stats when a card is revisited; the drill history and rating state handle this.
- The owner is an ML/CV engineer learning Japanese from zero; reading tests are coming up in class. Keep the UI student friendly, plain English, no jargon beyond "mora" (which is explained in the pacer).
