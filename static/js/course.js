/* Simpli Piano — structured learning tracks.
 *
 * Two paths, each its own ordered journey with tiers and its own saved progress:
 *   window.Course  — the reading/soloist path (Beginner → Intermediate → Advanced)
 *   window.Chords  — the chords path (Chord Basics → Progressions → Advanced)
 *
 * Units unlock in order; a unit counts as COMPLETE (and unlocks the next) only at
 * 80%+. Progress is stored per active player, per track (Profiles.key). Exposed
 * via window.Course and window.Chords (same shape). */
(() => {
  "use strict";

  const PASS = 0.8; // 80% to complete a unit

  // ============================ READING / SOLOIST ============================
  const SOLOIST = [
    // ----- BEGINNER -----
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
    // ----- INTERMEDIATE -----
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
  const SOLOIST_TIERS = [
    { id: "beginner", name: "Beginner" },
    { id: "intermediate", name: "Intermediate" },
    { id: "advanced", name: "Advanced" },
  ];

  // ============================ CHORDS PATH ============================
  // Tap the whole chord (3 keys). The next-key hint glows all the chord's keys,
  // so you learn each shape. (Chords are graded by tapping — the mic grades single
  // notes only.)
  const CHORDS = [
    // ----- CHORD BASICS -----
    { id: "c1", level: "chords-basics", title: "The C Chord", blurb: "Play C–E–G together", type: "song", song: "chord-c", mode: "step" },
    { id: "c2", level: "chords-basics", title: "The G Chord", blurb: "Play G–B–D together", type: "song", song: "chord-g", mode: "step" },
    { id: "c3", level: "chords-basics", title: "The F Chord", blurb: "Play F–A–C together", type: "song", song: "chord-f", mode: "step" },
    { id: "c4", level: "chords-basics", title: "Switch C ↔ G", blurb: "Change between two chords", type: "song", song: "switch-cg", mode: "step" },
    { id: "c5", level: "chords-basics", title: "Switch C ↔ F", blurb: "Another chord change", type: "song", song: "switch-cf", mode: "step" },
    { id: "c6", level: "chords-basics", title: "Minor Chords: Am & Em", blurb: "Your first minor chords", type: "song", song: "minor-chords", mode: "step" },
    // ----- PROGRESSIONS -----
    { id: "c7", level: "chords-prog", title: "C – F – G", blurb: "The I–IV–V progression", type: "song", song: "prog-145", mode: "step" },
    { id: "c8", level: "chords-prog", title: "The 4-Chord Song", blurb: "C – G – Am – F", type: "song", song: "prog-4chord", mode: "step" },
    { id: "c9", level: "chords-prog", title: "4 Chords — in time", blurb: "Play C–G–Am–F to a beat", type: "song", song: "prog-4chord", mode: "moving" },
    { id: "c10", level: "chords-prog", title: "The '50s Progression", blurb: "C – Am – F – G", type: "song", song: "prog-50s", mode: "step" },
    { id: "c11", level: "chords-prog", title: "'50s — in time", blurb: "Play C–Am–F–G to a beat", type: "song", song: "prog-50s", mode: "moving" },
  ];
  const CHORD_TIERS = [
    { id: "chords-basics", name: "Chord Basics" },
    { id: "chords-prog", name: "Progressions" },
    { id: "advanced", name: "Advanced" },
  ];

  // ---- Track factory ----------------------------------------------------
  function makeTrack(units, base, tiers) {
    const KEY = () => (window.Profiles ? window.Profiles.key(base) : base);
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY())) || {}; } catch { return {}; } };
    function entry(id) {
      const e = load()[id];
      if (e == null) return { stars: 0, complete: false };
      if (typeof e === "number") return { stars: e, complete: e > 0 }; // legacy
      return { stars: e.stars || 0, complete: !!e.complete };
    }
    function complete(unitId, stars, accuracy) {
      const c = load();
      const prev = entry(unitId);
      const nowComplete = prev.complete || (accuracy != null && accuracy >= PASS);
      c[unitId] = { stars: Math.max(prev.stars, stars || 0), complete: nowComplete };
      localStorage.setItem(KEY(), JSON.stringify(c));
      return nowComplete;
    }
    const starsFor = (id) => entry(id).stars;
    const isComplete = (id) => entry(id).complete;
    function unlocked(index) { return index <= 0 || isComplete(units[index - 1].id); }
    function nextIndex() {
      for (let i = 0; i < units.length; i++) if (unlocked(i) && !isComplete(units[i].id)) return i;
      return -1;
    }
    return { CURRICULUM: units, TIERS: tiers, PASS, complete, starsFor, isComplete, unlocked, nextIndex };
  }

  window.Course = makeTrack(SOLOIST, "piano.course", SOLOIST_TIERS);
  window.Chords = makeTrack(CHORDS, "piano.chords", CHORD_TIERS);
})();
