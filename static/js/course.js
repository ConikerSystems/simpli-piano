/* Simpli Piano — structured course.
 *
 * An ordered journey (like Simply Piano's path) that wraps the song engine and
 * the reading trainer. Each unit unlocks when the previous one is completed.
 * Completion is stored in localStorage ("piano.course": { unitId: stars }).
 * Exposed as window.Course. */
(() => {
  "use strict";

  const CURRICULUM = [
    { id: "u1", title: "Meet the Keys", blurb: "Find C, D and E", type: "keyfind", notes: [60, 62, 64], goal: 6 },
    { id: "u2", title: "Reading C–G", blurb: "Name notes on the staff", type: "trainer", level: 0, goal: 8 },
    { id: "u3", title: "Hot Cross Buns", blurb: "Your first song", type: "song", song: "hot-cross-buns", mode: "step" },
    { id: "u4", title: "Hot Cross Buns — in time", blurb: "Play it to the beat", type: "song", song: "hot-cross-buns", mode: "moving" },
    { id: "u5", title: "Mary Had a Little Lamb", blurb: "A longer melody", type: "song", song: "mary-lamb", mode: "step" },
    { id: "u6", title: "Reading A–C", blurb: "More notes to read", type: "trainer", level: 1, goal: 10 },
    { id: "u7", title: "Twinkle Twinkle", blurb: "A class favorite", type: "song", song: "twinkle", mode: "step" },
    { id: "u8", title: "Ode to Joy", blurb: "Beethoven's theme", type: "song", song: "ode-to-joy", mode: "step" },
    { id: "u9", title: "Lightly Row — in time", blurb: "Keep the rhythm", type: "song", song: "lightly-row", mode: "moving" },
    { id: "u10", title: "Jingle Bells", blurb: "Bring it together", type: "song", song: "jingle-bells", mode: "step" },
  ];

  const KEY = "piano.course";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  function complete(unitId, stars) {
    const c = load();
    if (!c[unitId] || stars > c[unitId]) { c[unitId] = stars; localStorage.setItem(KEY, JSON.stringify(c)); }
  }
  const starsFor = (unitId) => load()[unitId] || 0;

  // A unit is unlocked if it's the first, or the previous unit is completed.
  function unlocked(index) {
    if (index <= 0) return true;
    return starsFor(CURRICULUM[index - 1].id) > 0;
  }

  window.Course = { CURRICULUM, complete, starsFor, unlocked };
})();
