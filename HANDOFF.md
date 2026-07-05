# Simpli Piano — Session Handoff

_Updated: 2026-07-05_

## Where things stand
**v1.8.0 (sw cache v33)** — big "emulate Simply Piano" release, built and verified in the
desktop preview, pushed to GitHub Pages. Five new capabilities on top of the existing
engine/course/trainer/mic/profiles:

1. **Song library 12 → 42 real songs** — data moved to `static/js/library.js`
   (`window.SongData`, data-only; songs.js just parses it). New `genre` field
   (kids/folk/classical/holiday/hymn/pop) with filter chips in the Songs view, song
   durations in the list, and a new **Hands together** difficulty-4 group (melody with
   fused bass/chord tokens, same convention as the `hands-together` exercise).
2. **Practice stats + streaks** (`static/js/stats.js`) — practice seconds logged per local
   day per player (`piano.stats.<id>`), 🔥 day-streak, daily goal, weekly minutes strip on
   Home, motivational callout line on every finish overlay. Clock pauses on
   `visibilitychange` (iOS background).
3. **Reading tests** — trainer test mode (`promptCount`/`timeLimit`; wrong answers advance,
   first-try accuracy, notes/min). Read Notes tile → menu: endless practice or
   30/60/100-note and 2/5-minute tests × treble/bass, personal bests saved
   (`piano.trainerBest.<id>`).
4. **⏱ Daily Workout** (`static/js/workout.js` builds; `workoutView()` in app.js chains) —
   5/10/15-min session: reading warm-up → next-up Course song (else fresh library pick) →
   chord drill → (10min +song) (15min +30-note test) → summary with per-segment stars.
   "Done today ✓" on the Home tile (`piano.workout.<id>`).
5. **Onboarding quiz** — per-profile first-run: why piano / experience / daily minutes →
   sets `Stats.goalMin`, recommends a starting unit (new→u1, some→u4, played→i1 with
   unlock), deep-links into the first lesson. Stored in `piano.onboard.<id>`; Skip works.

Also: about.html refreshed (removed stale "Add a Song" card → Daily Workout), profiles
`remove()` now cleans ALL per-player namespaces (was missing `piano.chords`).

## ⚠️ Needs Joe's ear (top priority next session)
~30 new melodies were authored **by ear from memory** (two web-verification subagents died
on session limits, so tunes were NOT verified against sources). High-confidence ones are in;
several classics were deliberately **skipped** rather than risk wrong tunes (This Old Man,
Deck the Halls, O Christmas Tree, Away in a Manger, Good King Wenceslas, Scarborough Fair,
Danny Boy, My Bonnie, Alouette, Michael Row, Aura Lee, Home on the Range, Star-Spangled
Banner, Swan Lake). **Joe should tap 🔊 Listen on new songs and report any that sound off**
— especially Oh! Susanna's chorus, Kumbaya, We Wish You a Merry Christmas, and the two pop
excerpts. Fixes are one-line data edits in `static/js/library.js`.

**Pop excerpts** (Joe asked for these): `clocks-riff` (Coldplay Clocks opening, transposed
to C/Gm/Dm arpeggios) and `country-roads` (chorus, best-effort). They're short by-ear
excerpts under the Pop chip since they're not public domain — keep them brief.

## Unfinished / next ideas
- Add the skipped songs above once melodies can be verified (web agents or Joe humming).
- Advanced course tier is still "coming soon".
- On-device iPad checks: update flow (footer should show **v1.8.0**), mic grading on new
  songs, streak surviving day rollover, workout quit-mid-session (back button exits to
  workout intro).
- CSS confetti on 3-star (planned polish, not done).

## How to run/test
Preview: `preview_start` name `simpli-piano` (python http.server 5050) — or any static
server at repo root. Console must show zero `Song <id> has bad tokens` warnings (songs.js
has a built-in linter). NOTE: the preview browser caches aggressively — if changes don't
appear, `fetch(f, {cache:'reload'})` each static file then reload.
Deploy = push to `main` (GitHub Pages serves repo root). Always bump `static/js/version.js`
AND `sw.js` VERSION together; new JS files must be added to index.html scripts + sw SHELL.
