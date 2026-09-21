/* The lesson engine — the part that decides whether a learner played correctly.
 * Run: node tests/engine.test.js
 *
 * Why this file exists: a regression in here does not crash the app. It grades
 * wrong. A beginner who is told they played a wrong note assumes the fault is
 * theirs, so nothing about a broken grader looks broken from the outside. */
"use strict";
const { t, eq, ok, near, done, loadApp, makeEl, makeKeyboard } = require("./_stub.js");

const { window } = loadApp(["version", "profiles", "keyboard", "library", "songs", "engine"]);
const { LessonEngine, Songs } = window;

function mkEngine(src, opts = {}) {
  const laneEl = makeEl("div");
  const keyboard = makeKeyboard();
  const progress = [], completes = [], statuses = [];
  const e = new LessonEngine({
    laneEl, keyboard,
    onProgress: (i, n) => progress.push([i, n]),
    onComplete: (r) => completes.push(r),
    onStatus: (s) => statuses.push(s),
  });
  e.load({ id: "t", title: "t", tempo: 60, notes: Songs.parseSong(src).notes }, opts);
  return { e, keyboard, progress, completes, statuses };
}

// ---- step mode: the basic loop ---------------------------------------------
t("playing the right notes in order finishes the song", () => {
  const { e, completes } = mkEngine("C D E");
  e.start();
  [60, 62, 64].forEach((m) => e.input(m));
  eq(e.score.good, 3);
  eq(e.score.ok, 0);
  eq(completes.length, 1, "onComplete fired once");
});

t("the cursor does not advance until the note is right", () => {
  const { e } = mkEngine("C D");
  e.start();
  e.input(62);            // the NEXT note, played too early
  eq(e.cursor, 0, "still waiting on C");
  e.input(60);
  eq(e.cursor, 1);
});

t("input before start is ignored", () => {
  const { e } = mkEngine("C");
  e.input(60);
  eq(e.score.good, 0);
});

t("rests are not notes to play", () => {
  const { e } = mkEngine("C Rh D");
  e.start();
  eq(e.score.total, 2, "two playable notes, the rest is not one");
  e.input(60); e.input(62);
  eq(e.score.good, 2);
});

t("progress is reported after every completed note", () => {
  const { e, progress } = mkEngine("C D E");
  e.start();
  [60, 62, 64].forEach((m) => e.input(m));
  eq(JSON.stringify(progress), JSON.stringify([[0, 3], [1, 3], [2, 3], [3, 3]]));
});

// ---- chords -----------------------------------------------------------------
t("a chord completes only when every note of it is down", () => {
  const { e } = mkEngine("C4+E4+G4h");
  e.start();
  e.input(64); eq(e.score.good, 0, "one of three");
  e.input(60); eq(e.score.good, 0, "two of three");
  e.input(67); eq(e.score.good, 1, "all three");
});

t("chord notes may arrive in any order", () => {
  const { e } = mkEngine("C4+E4+G4h");
  e.start();
  [67, 60, 64].forEach((m) => e.input(m));
  eq(e.score.good, 1);
});

t("repeating a note already down does not complete the chord", () => {
  const { e } = mkEngine("C4+E4+G4h");
  e.start();
  e.input(60); e.input(60); e.input(60);
  eq(e.score.good, 0, "still missing E and G");
});

// ---- the good / ok rule -----------------------------------------------------
t("a clean note scores good", () => {
  const { e } = mkEngine("C");
  e.start();
  e.input(60);
  eq(e.score.good, 1); eq(e.score.ok, 0);
});

t("a wrong note first downgrades that note to ok, not good", () => {
  const { e } = mkEngine("C");
  e.start();
  e.input(61);            // wrong
  e.input(60);            // then right
  eq(e.score.good, 0);
  eq(e.score.ok, 1, "the note counts, but not as clean");
});

t("the mistake flag resets for the next note", () => {
  const { e } = mkEngine("C D");
  e.start();
  e.input(61); e.input(60);   // C, fumbled -> ok
  e.input(62);                // D, clean   -> good
  eq(e.score.ok, 1);
  eq(e.score.good, 1);
});

t("a wrong tap is flashed back as bad", () => {
  const { e, keyboard } = mkEngine("C");
  e.start();
  e.input(61);
  eq(keyboard.flashesOf("bad").length, 1);
  eq(keyboard.flashesOf("bad")[0].midi, 61);
});

// ---- the mic is graded differently from the screen --------------------------
t("a wrong note from the mic is ignored, not counted as a mistake", () => {
  // Mic detection is fuzzy (harmonics, room noise). The lesson keeps waiting
  // rather than blaming the learner for a note they did not play.
  const { e, keyboard } = mkEngine("C");
  e.start();
  e.input(61, true);
  eq(e.mistakeThisNote, false);
  eq(keyboard.flashesOf("bad").length, 0, "no bad flash from the mic");
  e.input(60, true);
  eq(e.score.good, 1, "still a clean note");
});

t("the same wrong note from a screen tap IS counted", () => {
  const { e } = mkEngine("C");
  e.start();
  e.input(61, false);
  eq(e.mistakeThisNote, true);
});

t("octave tolerance accepts the right note in the wrong octave", () => {
  const { e } = mkEngine("C4");
  e.setOctaveTolerant(true);
  e.start();
  e.input(72);                 // C5 for a written C4
  eq(e.score.good, 1);
});

t("without octave tolerance the wrong octave is a mistake", () => {
  const { e } = mkEngine("C4");
  e.start();
  e.input(72);
  eq(e.score.good, 0);
  eq(e.mistakeThisNote, true);
});

// ---- stars ------------------------------------------------------------------
/* accuracy = (good + ok/2) / total; 3 stars at >=0.9, 2 at >=0.7, 1 at >=0.4.
 * These cut-offs decide what unlocks next, so they are pinned at the boundary. */
function starsFor(good, okCount, total) {
  const { e, completes } = mkEngine("C");
  e.score = { good, ok: okCount, missed: total - good - okCount, total };
  e._finish();
  return completes[0];
}

t("3 stars begins exactly at 90%", () => {
  eq(starsFor(9, 0, 10).stars, 3);
  eq(starsFor(8, 1, 10).stars, 2, "85% is not 3 stars");
});

t("2 stars begins exactly at 70%", () => {
  eq(starsFor(7, 0, 10).stars, 2);
  eq(starsFor(6, 1, 10).stars, 1, "65% is not 2 stars");
});

t("1 star begins exactly at 40%", () => {
  eq(starsFor(4, 0, 10).stars, 1);
  eq(starsFor(3, 1, 10).stars, 0, "35% is no stars");
});

t("a fumbled note is worth half a clean one", () => {
  near(starsFor(5, 4, 10).accuracy, 0.7);
  eq(starsFor(5, 4, 10).stars, 2);
});

t("a song with nothing playable scores zero rather than dividing by zero", () => {
  const { e, completes } = mkEngine("R Rh");
  e._finish();
  eq(completes[0].accuracy, 0);
  eq(completes[0].stars, 0);
});

// ---- moving mode ------------------------------------------------------------
t("a note played well outside its window is rejected", () => {
  const { e, keyboard } = mkEngine("C D", { mode: "moving" });
  e.running = true;
  e.playhead = 0.6;                 // window is +/-0.4, with 0.15 slack
  e.input(60);
  eq(e.score.good, 0, "too late to count");
  eq(keyboard.flashesOf("bad").length, 1);
});

t("a note played inside the window counts", () => {
  const { e } = mkEngine("C D", { mode: "moving" });
  e.running = true;
  e.playhead = 0.5;
  e.input(60);
  eq(e.score.good, 1);
});

t("an unplayed note is marked missed once its window closes", () => {
  const { e } = mkEngine("C D", { mode: "moving" });
  e.running = true;
  e.playhead = 0.5;
  e._advanceMoving();
  eq(e.score.missed, 1);
  eq(e.cursor, 1, "moved on to the next note");
});

t("a note already played is not also counted missed", () => {
  const { e } = mkEngine("C D", { mode: "moving" });
  e.running = true;
  e.playhead = 0;
  e.input(60);                      // played on the beat
  e.playhead = 0.5;
  e._advanceMoving();
  eq(e.score.missed, 0);
  eq(e.score.good, 1);
});

// ---- listen playback --------------------------------------------------------
t("stopping practice also stops Listen playback", () => {
  // Listen used to keep ringing over practice, and its notes then suppressed
  // real mic input as echo.
  const { e } = mkEngine("C D E");
  let ended = 0;
  e.listen(() => ended++);
  eq(e.listening, true);
  e.stop();
  eq(e.listening, false);
  eq(ended, 1, "the end callback still runs");
});

t("starting Listen twice does not leave the first one playing", () => {
  const { e } = mkEngine("C D E");
  e.listen();
  const firstTimers = e._listenTimers;
  e.listen();
  ok(e._listenTimers !== firstTimers, "a fresh timer list");
  e.stopListen();
  eq(e.listening, false);
});

t("stop clears the keyboard so no key stays lit", () => {
  const { e, keyboard } = mkEngine("C");
  e.start();
  const before = keyboard.cleared;
  e.stop();
  ok(keyboard.cleared > before);
});

done("lesson engine");
