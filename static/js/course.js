/* Simpli Piano — structured course.
 *
 * An ordered journey (like Simply Piano's path) that wraps the song engine and
 * the reading trainer. Each unit unlocks when the previous one is completed.
 * Completion is stored in localStorage ("piano.course": { unitId: stars }).
 * Exposed as window.Course. */
(() => {
  "use strict";

  const CURRICULUM = [
    // ---- Basics: find the keys, then read the notes ----
    { id: "u1", title: "Meet the Keys", blurb: "Find C, D and E", type: "keyfind", notes: [60, 62, 64], goal: 6 },
    { id: "u2", title: "Find F and G", blurb: "Two more keys", type: "keyfind", notes: [65, 67], goal: 6 },
    { id: "u3", title: "C-D-E-F-G", blurb: "All five, mixed up", type: "keyfind", notes: [60, 62, 64, 65, 67], goal: 10 },
    { id: "u4", title: "Reading C–E", blurb: "Your first notes on the staff", type: "trainer", level: 0, fixedNotes: [60, 62, 64], goal: 8 },
    { id: "u5", title: "Reading C–G", blurb: "Name notes on the staff", type: "trainer", level: 0, goal: 10 },
    // ---- First songs ----
    { id: "u6", title: "Hot Cross Buns", blurb: "Your first song", type: "song", song: "hot-cross-buns", mode: "step" },
    { id: "u7", title: "Au Clair de la Lune", blurb: "A gentle 3-note tune", type: "song", song: "au-clair", mode: "step" },
    { id: "u8", title: "Hot Cross Buns — in time", blurb: "Play it to the beat", type: "song", song: "hot-cross-buns", mode: "moving" },
    { id: "u9", title: "Mary Had a Little Lamb", blurb: "A longer melody", type: "song", song: "mary-lamb", mode: "step" },
    { id: "u10", title: "Old MacDonald", blurb: "Reach up to a B", type: "song", song: "old-macdonald", mode: "step" },
    // ---- Read a little more, then more songs ----
    { id: "u11", title: "Reading A–C", blurb: "More notes to read", type: "trainer", level: 1, goal: 10 },
    { id: "u12", title: "London Bridge", blurb: "A familiar tune", type: "song", song: "london-bridge", mode: "step" },
    { id: "u13", title: "Frère Jacques", blurb: "A round to play", type: "song", song: "frere-jacques", mode: "step" },
    { id: "u14", title: "Twinkle Twinkle", blurb: "A class favorite", type: "song", song: "twinkle", mode: "step" },
    { id: "u15", title: "Ode to Joy", blurb: "Beethoven's theme", type: "song", song: "ode-to-joy", mode: "step" },
    { id: "u16", title: "When the Saints", blurb: "Go marching in", type: "song", song: "when-the-saints", mode: "step" },
    { id: "u17", title: "Lightly Row — in time", blurb: "Keep the rhythm", type: "song", song: "lightly-row", mode: "moving" },
    { id: "u18", title: "Jingle Bells", blurb: "Bring it together", type: "song", song: "jingle-bells", mode: "step" },
  ];

  const KEY = () => (window.Profiles ? window.Profiles.key("piano.course") : "piano.course");
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch { return {}; } };
  function complete(unitId, stars) {
    const c = load();
    if (!c[unitId] || stars > c[unitId]) { c[unitId] = stars; localStorage.setItem(KEY(), JSON.stringify(c)); }
  }
  const starsFor = (unitId) => load()[unitId] || 0;

  // A unit is unlocked if it's the first, or the previous unit is completed.
  function unlocked(index) {
    if (index <= 0) return true;
    return starsFor(CURRICULUM[index - 1].id) > 0;
  }

  window.Course = { CURRICULUM, complete, starsFor, unlocked };
})();
