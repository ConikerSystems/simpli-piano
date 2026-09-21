# Simpli Piano tests

```sh
sh tests/run.sh          # everything (this is the push gate)
node tests/engine.test.js   # one file
V=1 node tests/engine.test.js   # with stack traces on failure
```

No dependencies, no `package.json`, no build step — `node` is the whole toolchain,
matching the app itself, which is a no-build PWA loaded by `<script>` tags.

## What runs

| file | covers | why it matters |
|---|---|---|
| `theory.test.js` | note ↔ MIDI, the text notation, the shipped library | every song is stored as text; a parser drift transposes the whole library at once |
| `engine.test.js` | the lesson loop, grading, stars, timing windows | a regression here grades wrong rather than crashing, and the learner blames themselves |
| `course.test.js` | unlocking, the 80% pass mark, curriculum integrity | lessons reference songs by id — a renamed song leaves a lesson that silently won't start |
| `stats.test.js` | practice log, streak, goal callouts | practice is keyed by **local** day; a UTC slip would reset streaks overnight |
| `icloud-conflicts.test.mjs` | the `.git` fence and conflict copies | shared across the family of repos; see the file's own header |

`tests/_stub.js` builds the `window` the modules expect and fakes the four things
they cannot run without: `localStorage`, enough `document` for the falling-note
lane, a keyboard that records what it was told to light, and a silent audio layer.

## What is NOT covered, on purpose

`app.js`, `mic.js`, `trainer.js`, `hands.js`, `feedback.js` and the keyboard's
rendering are DOM, audio and microphone surfaces that need a real browser.
Faking one deeply enough to test them would mean testing the fake.

**So: a green suite means the engine is sound, not that the page works.** Opening
the app is still the check for anything visual — see `WEB_APP_STANDARDS.md`.
