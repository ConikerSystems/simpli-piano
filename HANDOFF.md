# Simpli Piano — Session Handoff

_Updated: 2026-07-07_

## Latest — v1.8.15 (sw cache v48): thumb bend + remove pinky lump
Joe: "the thumb needs a bend; there's a bump after the pinky that looks like a growth."
In [hands.js](static/js/hands.js) `buildHand()`: (1) Thumb rebuilt as a TWO-SEGMENT bent
digit — a long shaft from deep in the palm to the MCP knuckle (bowed OUTWARD off the
straight base→tip line, `K = [X(13), ys(89)]`), then a shorter distal segment hooking to
the fat pad on c1. Edges follow each segment's own axis with a bisector perpendicular at
the knuckle → a real bend, not just a width bulge. (2) Pinky-side palm edge retuned to
taper smoothly inward to the wrist (was `c5+5.2u` bulge → now monotonic c5+4.7→3.7→wrist),
removing the lump below finger 5. Verified preview (tablet): bend visible, no lump, glow
follows thumb→C / pinky→G, zero console errors. Default-OFF, labeled 🖐 Hands.

## Prev — v1.8.14 (sw cache v47): real bent thumb + taller keys
Joe: "thumb doesn't look like a thumb, pinky is weird, and make the course keys taller with
the hand over the key." Fixes in [hands.js](static/js/hands.js) `buildHand()`:
(1) Thumb is now a DEDICATED long diagonal digit (its own `dThumb` path drawn over the palm)
rooted deep in the palm near the index/wrist and reaching a fat rounded pad on the c1 key,
with an outer knuckle bulge + bend + angled nail — the earlier separate-piece thumb floated
because it stopped near C instead of spanning back to the palm. (2) Pinky longer (tip y 59)
+ wider (4.2u) and the lateral finger bend softened (×0.8, clamp ±1.15) so nothing hooks
unnaturally. (3) NEW `.kb-wrap.tall` (CSS) — toggling 🖐 Hands ON now grows the lesson/
trainer keys (clamp 200–330px) so the hand has room; turning it off restores the falling-
notes lane. Verified in preview (tablet): thumb reads correctly + connected, pinky natural,
glow-follows thumb→C / pinky→G, zero console errors. Still default-OFF, labeled 🖐 Hands.

## Prev — v1.8.13 (sw cache v46): hand rebuilt as a REAL anatomical hand
Joe (repeatedly): the old art was "a wood log with 4 pegs" / thumb & pinky swapped-looking.
`buildHand()` in [hands.js](static/js/hands.js) fully rewritten around a `digit()` helper:
each of the four fingers is a rounded tapered digit whose KNUCKLE is pulled ~22% toward
the palm centre (so fingers FAN OUT to the tips) and whose shaft has a lateral BEND (bows
toward hand centre, near-zero on the middle finger). The thumb is one long broad diagonal
digit rooted low at the wrist reaching to c1, split from the index by a deep notch. Nails
rotate with each digit; two joint creases per finger come from the digit builder. Verified
in preview (right hand on Twinkle, left hand mirrored in Free Play, tablet + mobile): reads
as a human hand, thumb (broad, left/C for RH) and pinky (short, slim, right) now clearly
distinct, glow-follow + badges correct, zero console errors. Still default-OFF, labeled
🖐 Hands. Next idea Joe floated but NOT done: taller course-page keys for more hand room,
and a translucent hand directly over the target key.

## Prev — v1.8.12 (sw cache v45): hands ALWAYS start off + per-finger anatomy
Joe: (a) hands must start OFF every time — the old localStorage persistence made it feel
default-on once toggled. `fingersChip` is now per-view state only, no localStorage
(`piano.showHands` abandoned); every page opens with hands hidden. (b) "thumb and pinky
look the same": thumb is now much broader (±7.9u) and set diagonally with a bigger
rotated nail (-50°) and matching wider glow blob; pinky thinner (3.8u) and shorter
(tip y 63); ring now slightly longer than index (46.5 vs 48). Badge pads retuned.
Verified: default-off on open + after re-enter, toggle works, glow follows, tablet look.

## Previous — v1.8.11 (sw cache v44): whole-hand look + taller keys
Per Joe (with the typing.com reference pic): toggle renamed **🖐 Hands** (his final call —
was Fingers). Artwork moved closer to the reference: knuckle bulges low on each finger,
blunter curled-looking tips (rounder tip curves), forearm now runs off the bottom edge with
an arched sleeve cuff over it (viewBox extended to 135% height). NEW: while hands are ON,
`.kb-wrap.hands-on:not(.grow)` grows the keyboard to clamp(200px, 38vh, 340px) — longer
keys so the hand has room, as he asked ("make the piano keys longer"). Free Play `.grow`
is exempt. Verified mobile+tablet, glow-follow, 0 console errors.

## Previous — v1.8.10 (sw cache v43): Fingers overlay defaults OFF
Joe: fingers should be toggled off by default on all pages; the user turns them on.
`handsOn()` in app.js now defaults false (`piano.showHands === "1"`); the 🖐 Fingers chip
turns it on and the choice persists device-wide. Verified fresh-user default off in
Lesson/Free Play, chip toggles + persists.

## Previous — v1.8.9 (sw cache v42): the hand is ONE continuous silhouette
Joe rejected v1.8.8 ("wood log with 4 pegs, thumb like a straight stick"). `buildHand()`
now emits a single unified hand outline: fingers grow out of the hand through smooth
gap-proportional web valleys on an arched knuckle line (no flat deck between fingers),
staggered finger lengths, bent angled thumb with rotated nail, pinky edge flowing straight
into the palm/wrist, nails + knuckle/palm creases + metacarpal hints, one soft vertical
skin gradient (per-part gradients were the "turned wood" look). Hand may run ~12% taller
than the keyboard strip (palm hangs below, like the typing.com reference; SVG gets -15%
top headroom so stretched tips don't clip). Verified: mobile + tablet, lesson highlight
follow, L/R Free Play, two-hand d4 song, toggle, 0 console errors.

## Previous — v1.8.8 (sw cache v41): realistic hands (rejected)
Joe: the old hand overlay looked like a "scary" lumpy blob. **Rewrote `static/js/hands.js`
rendering** from one flat outline path into separately-shaded parts: a palm plus five
rounded, tapered finger **capsules**, each with a per-finger cylindrical skin gradient
(edge→mid→highlight→mid→edge across its width, `userSpaceOnUse`) and an **ellipse
fingernail**; the thumb is an angled capsule with the correct thenar-side palm bulge. Still
bottom-anchored with height capped at ~3.2 key-widths (natural at any key size) and mirrored
via `scaleX(-1)` for the left hand. Whole-finger glow softened to 0.6 alpha so the finger
reads through the highlight. Verified in preview (Twinkle lesson highlight-follow, Free Play
L/R at mobile + tablet widths, 0 console errors). Toggle chip label is **🖐 Fingers**.


## Where things stand
**v1.8.7 (sw cache v40)** — added the **🖐 Fingers hands overlay** (typing-tutor style, Joe's
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
v1.8.7 (Joe: "Free Play hands look scary"): on tall keyboards (Free Play's grow layout)
finger lengths scaled with keyboard height → spindly witch fingers. Fix: `handHeight(sp,H)`
caps the hand at ~3.2 key-widths tall and everything is bottom-anchored via `Y(f)=H-He*(1-f)`
(badges use the same math). Free Play's key window now always keeps the full five-finger
span on screen (`lead` whites below the thumb in `layout()`), so the hand renders in
portrait too.
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
