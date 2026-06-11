/* Simpli Piano — structured course, organized into tiers (Beginner →
 * Intermediate → Advanced). Units unlock in order; a unit counts as COMPLETE
 * only when the player reaches 80%+ — that's the bar for marking it done and
 * unlocking the next. Progress is stored per active player (Profiles.key).
 * Exposed as window.Course. */
(() => {
  "use strict";

  const PASS = 0.8; // 80% to complete a unit

  const CURRICULUM = [
    // ===================== BEGINNER =====================
    { id: "u1", level: "beginner", title: "Meet the Keys", blurb: "Find C, D and E", type: "keyfind", notes: [60, 62, 64], goal: 6 },
    { id: "u2", level: "beginner", title: "Find F and G", blurb: "Two more keys", type: "keyfind", notes: [65, 67], goal: 6 },
    { id: "u3", level: "beginner", title: "C-D-E-F-G", blurb: "All five, mixed up", type: "keyfind", notes: [60, 62, 64, 65, 67], goal: 10 },
    { id: "u4", level: "beginner", title: "Reading C–E", blurb: "Your first notes on the staff", type: "trainer", fixedNotes: [60, 62, 64], goal: 8 },
    { id: "u5", level: "beginner", title: "Reading C–G", blurb: "Name notes on the staff", type: "trainer", level2: 0, goal: 10 },
    { id: "u6", level: "beginner", title: "Hot Cross Buns", blurb: "Your first song", type: "song", song: "hot-cross-buns", mode: "step" },
    { id: "u7", level: "beginner", title: "Au Clair de la Lune", blurb: "A gentle 3-note tune", type: "song", song: "au-clair", mode: "step" },
    { id: "u8", level: "beginner", title: "Hot Cross Buns — in time", blurb: "Play it to the beat", type: "song", song: "hot-cross-buns", mode: "moving" },
    { id: "u9", level: "beginner", title: "Mary Had a Little Lamb", blurb: "A longer melody", type: "song", song: "mary-lamb", mode: "step" },
    { id: "u10", level: "beginner", title: "Old MacDonald", blurb: "Reach up to a B", type: "song", song: "old-macdonald", mode: "step" },
    { id: "u11", level: "beginner", title: "Reading A–C", blurb: "More notes to read", type: "trainer", level2: 1, goal: 10 },
    { id: "u12", level: "beginner", title: "London Bridge", blurb: "A familiar tune", type: "song", song: "london-bridge", mode: "step" },
    { id: "u13", level: "beginner", title: "Frère Jacques", blurb: "A round to play", type: "song", song: "frere-jacques", mode: "step" },
    { id: "u14", level: "beginner", title: "Twinkle Twinkle", blurb: "A class favorite", type: "song", song: "twinkle", mode: "step" },
    { id: "u15", level: "beginner", title: "Ode to Joy", blurb: "Beethoven's theme", type: "song", song: "ode-to-joy", mode: "step" },
    { id: "u16", level: "beginner", title: "When the Saints", blurb: "Go marching in", type: "song", song: "when-the-saints", mode: "step" },
    { id: "u17", level: "beginner", title: "Lightly Row — in time", blurb: "Keep the rhythm", type: "song", song: "lightly-row", mode: "moving" },
    { id: "u18", level: "beginner", title: "Jingle Bells", blurb: "Bring it together", type: "song", song: "jingle-bells", mode: "step" },

    // ===================== INTERMEDIATE =====================
    { id: "i1", level: "intermediate", title: "Read the Bass Clef", blurb: "The left-hand staff", type: "trainer",
      clef: "bass", fixedNotes: [48, 50, 52, 53, 55, 57, 59], kbStart: 48, kbOctaves: 2, goal: 10 },
    { id: "i2", level: "intermediate", title: "Left-Hand Warm-Up", blurb: "Play with your left hand", type: "song", song: "lh-warmup", mode: "step" },
    { id: "i3", level: "intermediate", title: "The C Major Scale", blurb: "Up and back down", type: "song", song: "c-scale", mode: "step" },
    { id: "i4", level: "intermediate", title: "Hands Together", blurb: "Both hands at once", type: "song", song: "hands-together", mode: "step" },
    { id: "i5", level: "intermediate", title: "First Chords: C F G", blurb: "Play three triads", type: "song", song: "triads-cfg", mode: "step" },
    { id: "i6", level: "intermediate", title: "Bass Clef Around Middle C", blurb: "More left-hand reading", type: "trainer",
      clef: "bass", fixedNotes: [53, 55, 57, 59, 60], kbStart: 48, kbOctaves: 2, goal: 10 },
    { id: "i7", level: "intermediate", title: "Ode to Joy — in time", blurb: "To the beat", type: "song", song: "ode-to-joy", mode: "moving" },
    { id: "i8", level: "intermediate", title: "Twinkle — in time", blurb: "Steady rhythm", type: "song", song: "twinkle", mode: "moving" },
  ];

  const TIERS = [
    { id: "beginner", name: "Beginner" },
    { id: "intermediate", name: "Intermediate" },
    { id: "advanced", name: "Advanced" }, // no units yet — shown as "coming soon"
  ];

  const KEY = () => (window.Profiles ? window.Profiles.key("piano.course") : "piano.course");
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch { return {}; } };

  // Normalize a stored entry (old format was a bare star number).
  function entry(id) {
    const e = load()[id];
    if (e == null) return { stars: 0, complete: false };
    if (typeof e === "number") return { stars: e, complete: e > 0 }; // legacy
    return { stars: e.stars || 0, complete: !!e.complete };
  }

  // Mark a result. Complete (and unlock next) only at 80%+.
  function complete(unitId, stars, accuracy) {
    const c = load();
    const prev = entry(unitId);
    const nowComplete = prev.complete || (accuracy != null && accuracy >= PASS);
    c[unitId] = { stars: Math.max(prev.stars, stars || 0), complete: nowComplete };
    localStorage.setItem(KEY(), JSON.stringify(c));
    return nowComplete;
  }

  const starsFor = (unitId) => entry(unitId).stars;
  const isComplete = (unitId) => entry(unitId).complete;

  // A unit is unlocked if it's first, or the previous unit is complete.
  function unlocked(index) {
    if (index <= 0) return true;
    return isComplete(CURRICULUM[index - 1].id);
  }

  // The next unit to play: first unlocked unit that isn't complete yet.
  function nextIndex() {
    for (let i = 0; i < CURRICULUM.length; i++) {
      if (unlocked(i) && !isComplete(CURRICULUM[i].id)) return i;
    }
    return -1; // everything complete
  }

  window.Course = { CURRICULUM, TIERS, PASS, complete, starsFor, isComplete, unlocked, nextIndex };
})();
