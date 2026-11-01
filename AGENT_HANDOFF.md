# Yomi agent handoff

This file is the durable pickup point for another coding agent. Read it before continuing, then inspect `git status`, `git log`, and the referenced source files; the repository state is authoritative if this document and code differ.

## User's latest request

Implement and push these three changes:

1. If a word has a Kansai recording, play it before the Tokyo recording or synthetic voice.
2. Make Add words synthesis work from the browser without requiring a locally hosted VOICEVOX Engine.
3. Remove the unused lower row of the Kanji bottom settings dock.

Also update `README.md` and `TODO.md`, and keep this handoff file detailed enough for another LLM agent to continue independently. The user selected browser-native speech synthesis after being told that Japanese voice availability and quality vary by device/browser.

## Project

- Repository: `syedaddan/yomi`
- App: React + Vite Japanese reading trainer; Supabase for optional accounts, profiles, per-user progress/custom words, and shared admin deck overrides.
- Windows workspace: `D:\Learning\yomi`
- Usual verification: `npm test`; `npm run build`.
- Branch before this task: `main`.

## Relevant prior work and deployment state

- Commit `5b390cd` fixed a signed-in Account page render failure by moving the sign-out handler into component scope; added a regression test. The fix is already pushed.
- Account/profile/progress feature is implemented in commit `4783d58`.
- Shared admin deck editor is implemented in commit `23b86a1`.
- The user confirmed they successfully applied Supabase migration 002, then migration 003, and deployed the `delete-account` Edge Function. Do not ask them to rerun those.
- The new migration 004 in this task is **not yet applied**. It makes `user_custom_words.female_audio_id` nullable so browser-speech words can sync without a generated audio file. Tell the user to run only migration 004 after it has been pushed/deployed.
- The Supabase CLI created untracked `supabase/.temp/` files locally. Do not inspect or stage them; they are not project deliverables and may contain local CLI metadata.
- A prior terminal screenshot contained a CLI login URL/code, which the user already used. Never reproduce or include those values.

## Current task implementation

At handoff creation, changes may still be uncommitted. Check `git status` and finish tests, review, commit, and push to `origin main` per the user's explicit request.

- `src/audioPriority.js`: centralizes source selection. A present `item.alt` is treated as the Kansai clip and returned first unless the user explicitly requests the alternate voice.
- `src/audio.js`: plays Kansai as the default primary clip; alternate playback skips it and honors the selected curated/synthetic source. Custom words without saved audio fall through to `speechSynthesis`.
- `src/audioPriority.test.mjs`: tests Kansai priority, alternate behavior, and browser speech fallback.
- `src/components/Drill.jsx` and `src/components/shared.jsx`: expose the alternate playback, explain the priority, and describe built-in VOICEVOX vs browser speech accurately.
- `src/components/AddWords.jsx`: no longer calls `synthesizeFemaleWord` or saves generated synthetic audio. It saves the word and any optional human audio, then uses browser speech at playback time. The user still searches for a natural recording before adding a word. New custom words have an empty `femaleAudioId`.
- `src/customWords.js` and tests: no longer require a generated audio ID.
- `src/cloudStore.js` and tests: reconstruct nullable `female_audio_id` as an empty audio ID.
- `supabase/migrations/202611020004_browser_speech_custom_words.sql`: drops `NOT NULL` from `user_custom_words.female_audio_id`; must be applied on the user's Supabase project for signed-in custom words to sync.
- `src/components/SettingsBar.jsx`: only renders the settings controls row on pages that use it, removing the lower row from Kanji.
- `src/accountPage.test.mjs`: combined SSR regressions for signed-in account rendering and the Kanji dock's compact row.
- `README.md`, `TODO.md`: reflect these changes and migration order.

## Validation already run

- `npm test`: 33 tests passed.
- `npm run build`: succeeded. Vite still reports the existing large JavaScript chunk warning (>500 kB).
- `git diff --check`: passed before the final doc/UI-label adjustment; rerun before commit.
- Browser smoke check: Kanji dock shows display controls and “Reset all display options”, with no lower controls row. Add words page shows “Add word” and no local-engine requirement. Browser smoke was signed out, so it did not exercise a live Supabase write or actual spoken audio.

## Things to verify before finishing

1. Run `npm test`, `npm run build`, and `git diff --check` after all edits.
2. Review the final diff, particularly audio source selection and `README.md` migration instructions. Do not modify already-applied migrations 001–003; migration 004 is additive.
3. Do not stage `supabase/.temp/`; stage only intentional source/docs/migration files.
4. Commit with a message matching the repository's `feat:` convention and include the configured Copilot co-author trailer unless repository/user instructions change.
5. Push to `origin main`; verify `HEAD` equals `origin/main`.
6. Tell the user to wait for GitHub Pages deployment, then run migration 004 in Supabase SQL Editor. Never ask them to expose credentials.

## Suggested skills

- `tdd` if continuing test-first changes.
- `diagnose` if the browser reports a regression.
- `code-review` if the user later requests a review.

## Security and privacy

No Supabase credentials, tokens, database passwords, service-role keys, or login links belong in this document or source. The admin identity is intentionally not repeated here. RLS and admin policies are in the existing migrations; do not weaken them.
