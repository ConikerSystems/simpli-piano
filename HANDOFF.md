# Simpli Piano — Session Handoff

_Updated: 2026-07-06_

## Where things stand
**v1.8.6 (sw cache v39)** — added the **🖐 Fingers hands overlay** (typing-tutor style, Joe's
request from a typing.com screenshot): `static/js/hands.js` draws two semi-transparent
cartoon hands over the on-screen keyboard — a single natural SVG hand silhouette per hand
(curved fingers of different lengths, opposed thumb, palm + wrist; authored for the right
hand with fingertips at x=10/30/50/70/90 of the five-key span so stretching aligns fingers
to keys; left hand is the same path mirrored). Numbered fingertip badges (thumb 1 … pinky 5)
sit on the finger pads over the white-key touch area. The target key's fingertip lights
up with the key (hands.js patches the keyboard instance's highlight/flash/clear/render).
Joe reviewed the first blocky-capsule version and asked for a natural hand like the
typing.com picture — the silhouette version is what shipped, then polished further on his
"improve this further": tapered fingers, knuckle/palm crease lines, vertical skin gradient
(unique per-svg gradient id), drop-shadow depth, and a sleeve cuff at the wrist. The wrist
sits in the kb-wrap's bottom padding (~7% below the keys; anything taller gets clipped).
v1.8.4: silhouette is now **generated in px at render time** (`buildHand(cx,H)` in hands.js,
not a stretched viewBox) so finger proportions stay natural at any keyboard size — on wide
keyboards the fingers splay apart and lengthen (`stretchFor(sp,H)`, badges raised by the
same factor) instead of distorting into pancakes; a ResizeObserver re-draws on size change.
Verified at 1194-wide landscape, 834 portrait, and narrow widths.
v1.8.5 (Joe: "toggle not visible / finger highlight too subtle"): toggle chip lives in the
top controls in Lesson, Read Notes drills, Free Play — v1.8.6: Joe settled the label as
**🖐 Fingers** (was briefly "Hands"); the WHOLE target
finger now fills bright blue w/ white outline + pulse (per-finger `hl` capsule paths from
buildHand, `.hand-fhl` — keyPulse animates box-shadow which is a no-op on SVG, so it gets
its own `fingerPulse` opacity animation). Gotcha fixed: the ResizeObserver's initial fire
re-rendered the overlay AFTER the lesson lit the first key, wiping the finger state —
render() now re-syncs from the keyboard's `.hl-hint`/`.hl-good` key classes.
Toggle chip "🖐 Fingers" in Lessons, Read Notes, and Free Play; preference persists
(`piano.showHands`, device-wide, default ON). Mapping: songs anchor on the C of the octave
with the most notes (`fingerMapForSong` in app.js; "both" splits at middle C → two hands),
bass-clef drills anchor LH pinky on C3, Free Play follows the hand selector + octave shift
(left hand got 2 more keys of room below its thumb so the pinky is on-screen). Verified in
preview: lesson highlight-follow, two-hand d4 songs, bass tests, free-play left hand, toggle
persistence. NOT yet checked on the iPad (footer should show v1.8.1).

Previous release **v1.8.0 (sw cache v33)** — big "emulate Simply Piano" release, built and
verified in the desktop preview, pushed to GitHub Pages. Five new capabilities on top of the
existing engine/course/trainer/mic/profiles:

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
