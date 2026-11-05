# Yomi agent handoff

This is the detailed pickup document for a fresh coding agent. Read it first, then inspect the repository state and cited files before continuing. Git and source code are authoritative if they differ from this note.

## Repository and current state

- Repository: `syedaddan/yomi`
- Workspace: `D:\Learning\yomi` (Windows)
- Branch: `main`
- Latest feature commit: `0598523bc951c07342a5098955c461c4b2fe959c` (`feat: prioritize Kansai and browser speech`)
- That commit was pushed to `origin main`; at the end of the task `HEAD` and `origin/main` matched.
- Follow-up handoff expansion is being made after that feature commit. Check `git status` for whether this documentation-only follow-up has been committed/pushed.
- Commit `0598523` changed 17 tracked paths (233 insertions, 92 deletions). A separate short-lived OS-temp summary was also created during the preceding response; this repository handoff is the detailed, durable source of truth.
- `supabase/.temp/` is untracked local Supabase CLI metadata. It was generated during CLI usage; do not stage it, inspect it, or remove it.
- `npm test` and `npm run build` can create/update ignored files under `dist/` and `public/audio/`. They are generated outputs, not source files, and were not included in the feature commit.

## User request and decisions

The user asked for:

1. Prefer the Kansai dialect recording over Tokyo and synthetic audio whenever a Kansai clip exists.
2. Remove the Add words page's requirement for a locally hosted VOICEVOX Engine; use an in-browser synthesizer.
3. Remove the useless lower settings row from Kanji.
4. Update `README.md` and `TODO.md` as needed.
5. Create a file detailed enough for another LLM agent to continue, and push all changes to GitHub.

The user selected the browser's built-in Japanese speech synthesis after being informed that availability and quality vary with the user's browser/device. This generates no audio file and needs no hosted service, API key, or local engine.

## What was implemented

### Kansai audio priority

- Added a standalone audio-source resolver so playback source choice can be tested independently of browser audio APIs.
- If an item has `alt` audio, the normal Play action now plays that clip first. In the deck data, `alt` represents the Kansai alternate.
- The explicit **Other voice** button requests the non-Kansai choice and follows the selected voice preference: curated recording or synthetic voice.
- Existing playback behavior remains for items without `alt`: use the selected curated recording/voice; built-in items use the bundled female VOICEVOX clip where available; custom items without stored audio use browser speech.
- Updated the UI voice button label and recording information to explain the new priority.

### Add words browser speech

- Removed the Add words dependency on `synthesizeFemaleWord`, the local VOICEVOX endpoint, and saving generated synthetic blobs into IndexedDB/private storage.
- Custom words still require the user to perform the recording search and select whether a natural recording was found. Human recording upload/link support remains.
- New custom words have an empty `femaleAudioId`; when no saved human audio is selected for playback, the existing `speechSynthesis` fallback uses a Japanese device voice.
- Missing browser speech support or Japanese voices results in a user-facing error through the existing audio error callback. Voice sound and availability are device/browser-dependent.
- Account sync needs nullable `user_custom_words.female_audio_id`. Existing migration 002 defined that column `NOT NULL`, so a new additive migration 004 was added. It must be run in Supabase for signed-in users to add/sync custom words without generated audio.

### Kanji settings dock

- The settings dock's second/lower controls row now renders only for pages that use its settings controls. Kanji retains its display row (Romaji, Furigana, Pitch marks, and Reset all display options) without the lower reset/settings row.

### Documentation and handoff

- README and roadmap now describe Kansai-first playback, browser-native speech for custom words, and Kanji dock behavior.
- README migration order includes migration 004 and notes not to rerun previously applied migrations.
- This `AGENT_HANDOFF.md` was expanded on the user's follow-up request to include an exact file inventory and all implementation/test/deployment details.

## Exact files changed in feature commit `0598523`

The following 17 tracked paths were committed. There were no other tracked files in that commit.

### Documentation

1. `AGENT_HANDOFF.md` — added durable continuation notes, task decisions, prior Supabase/deployment state, verification evidence, remaining user action, and initial file/change summary. It has since been expanded with this exhaustive inventory.
2. `README.md` — changed project overview, audio priority and schema descriptions, Add words behavior, Kanji dock layout, Supabase migration sequence, and limitations to reflect browser speech. Local VOICEVOX remains needed for offline audio generation tasks such as building Kanji audio, but not for Add words.
3. `TODO.md` — marked accounts/cloud sync complete; updated Add words completion criteria; recorded Kansai priority and Kanji dock simplification; recorded the existing admin shared deck catalog feature.

### Build/test configuration

4. `package.json` — added `src/audioPriority.test.mjs` to the `npm test` command. No dependencies were added.

### Audio source selection and playback

5. `src/audioPriority.js` — new pure `resolvePlaybackSource(item, voice, alternate)` helper. It selects Kansai first unless `alternate` is requested, then resolves local human audio, linked human audio, curated deck audio, bundled female audio, or browser speech.
6. `src/audioPriority.test.mjs` — tests Kansai precedence for both voice preference values, explicit alternate behavior, and custom browser-speech fallback.
7. `src/audio.js` — delegates source selection to the helper; plays the selected source; routes custom fallback to the existing Web Speech API; reports source-specific playback errors.
8. `src/components/Drill.jsx` — labels the alternate button **Other voice**; explains Kansai-first playback; adjusts recording help text for custom words and the alternate voice.
9. `src/components/shared.jsx` — renames the synthetic choice to **Synthetic voice** and updates its explanation for Kansai, bundled VOICEVOX, and browser speech.

### Add words and cloud persistence

10. `src/components/AddWords.jsx` — removed local VOICEVOX synthesis and generated female-clip persistence; now creates a custom word without a generated audio ID, still persists optional human audio, and explains browser speech and device-dependent voice quality. Submit button now says **Add word**.
11. `src/customWords.js` — no longer requires `femaleAudioId`; normalizes a missing ID to an empty string while retaining existing kana, meaning, theme, accent, and secure-URL validation.
12. `src/customWords.test.mjs` — changed custom word expectations to cover words without generated audio; retained script, pitch, and HTTPS validation coverage.
13. `src/cloudStore.js` — maps a null database `female_audio_id` to `''` when reconstructing custom word records.
14. `src/cloudStore.test.mjs` — asserts existing audio IDs still restore and null audio IDs restore as empty strings for browser-speech words.
15. `supabase/migrations/202611020004_browser_speech_custom_words.sql` — additive one-statement migration dropping `NOT NULL` from `public.user_custom_words.female_audio_id`.

### Kanji/account regression tests

16. `src/components/SettingsBar.jsx` — only renders `.settings-controls-row` when `showSettingsControls` is true; Kanji still renders its display row but not the unused lower row.
17. `src/accountPage.test.mjs` — extended the signed-in account server-render test to also verify that Kanji retains Furigana but omits the lower `.settings-controls-row` and its “Reset all settings” action.

The expanded handoff itself is a follow-up documentation change, separate from those 17 paths. No other tracked source file was changed for the follow-up.

## Prior relevant commits and confirmed setup

- `4783d58`: private profiles, structured progress, admin Kanji lesson availability, and account deletion support.
- `23b86a1`: admin-only shared Decks tab and per-user custom-word organization.
- `5b390cd`: fixed signed-in Account page render error and added regression coverage.
- User confirmed Supabase migration 002 succeeded, migration 003 succeeded, and `delete-account` Edge Function deployed. Do not instruct the user to rerun these.
- Migration 004 has not been applied (unless the user reports doing so after this handoff). In Supabase SQL Editor, the user should run only `supabase/migrations/202611020004_browser_speech_custom_words.sql`. It is independent/additive and does not change RLS policies.
- The Supabase CLI produced `supabase/.temp/`; keep it untracked and do not stage it.
- Never include credentials, CLI login URLs/codes, database passwords, API keys, or service-role keys. A previous screenshot included an already-used one-time CLI login link/code; do not repeat it.

## Verification completed for commit `0598523`

- `npm test`: 33 tests passed, zero failed.
- `npm run build`: succeeded. Existing warning remains: minified JS chunk is over 500 kB.
- `git diff --check`: passed before commit.
- Browser smoke check on local Vite:
  - `/kanji` showed display controls and **Reset all display options**, without the lower settings row.
  - `/add` showed **Add word**, “Speech is built into your browser”, and did not mention local Engine port `127.0.0.1:50021`.
  - This was a signed-out smoke test: no live Supabase custom-word save/sync was tested, and actual speech audio playback/device voice availability was not tested.
- Push verification: `HEAD` and `origin/main` matched at `0598523bc951c07342a5098955c461c4b2fe959c`.

## Recommended next actions

1. Check `git status`, `git log`, and this file; determine whether the handoff expansion is still uncommitted.
2. If continuing code work, run `npm test`, `npm run build`, and `git diff --check`.
3. If committing the handoff expansion, stage only `AGENT_HANDOFF.md`, do not stage `supabase/.temp/`, then push to `origin main` and verify the remote hash.
4. Remind the user to wait for GitHub Pages deployment, then apply only migration 004 in Supabase SQL Editor if they want cloud sync for custom words with no generated audio. Do not ask them to rerun migrations 002/003.
5. If testing user-facing speech, use a browser/device with a Japanese speech voice and verify both a custom word with no recording (browser speech) and a word with an uploaded natural recording. Never test account deletion on an account whose data should be retained.

## Suggested skills

- `tdd` for test-first follow-up work.
- `diagnose` if a specific runtime issue is reported.
- `code-review` if the user requests review.

## Safety and privacy notes

- Keep all account/profile/progress/deck authorization protections and RLS policies intact.
- Do not add a remote TTS service or expose secrets unless the user explicitly changes the browser-native speech decision.
- Do not include personal email addresses, credentials, login links, or tokens in future handoffs.
