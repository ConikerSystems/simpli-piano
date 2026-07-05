/* Simpli Piano — Daily Workout session builder (like Simply Piano's 5-minute
 * workout): a short auto-built practice session chaining a note-reading
 * warm-up, song lessons picked from where the player is, a chord drill, and
 * (longer sessions) a reading test. Data only — app.js renders and chains the
 * segments through the existing lesson()/trainerView() plumbing.
 *
 * Last-done state per player: piano.workout.<id> → { date: "YYYY-MM-DD", minutes }.
 * Exposed as window.Workout. */
(() => {
  "use strict";

  const BASE = "piano.workout";
  const key = () => window.Profiles.key(BASE);

  const progress = () => {
    try { return JSON.parse(localStorage.getItem(window.Profiles.key("piano.progress"))) || {}; }
    catch { return {}; }
  };
  const starsFor = (songId) => (progress()[songId] || {}).stars || 0;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Next not-yet-complete unit of a track matching a predicate (or null).
  function nextUnit(track, test) {
    const i = track.nextIndex();
    if (i < 0) return null;
    for (let j = i; j < track.CURRICULUM.length; j++) {
      const u = track.CURRICULUM[j];
      if (track.isComplete(u.id)) continue;
      if (!test || test(u)) return u;
      break; // only look at the immediate next-up unlocked stretch
    }
    return null;
  }

  // The player's current tier (1-3) inferred from Course position.
  function tier() {
    const i = window.Course.nextIndex();
    if (i < 0) return 3;
    return window.Course.CURRICULUM[i].level === "beginner" ? 1 : 2;
  }

  // A library song to practice: prefer un-3-starred at the player's tier.
  function pickSong(excludeIds) {
    const all = window.Songs.LIBRARY.filter((s) => !s.exercise && !excludeIds.includes(s.id));
    const t = tier();
    const atTier = all.filter((s) => s.difficulty <= t + 1);
    const fresh = atTier.filter((s) => starsFor(s.id) < 3);
    return pick(fresh.length ? fresh : (atTier.length ? atTier : all));
  }

  /* Build the ordered segment list for a session of ~`minutes`. Each segment:
   *   { kind: "drill"|"test", title, trainerOpts }  or
   *   { kind: "song", title, songId, mode }            */
  function build(minutes) {
    const segs = [];
    const used = [];

    // 1) Warm-up reading drill, bass clef once the player is past beginner.
    const inter = tier() >= 2;
    segs.push({
      kind: "drill", title: "Warm-up: read notes",
      trainerOpts: inter && Math.random() < 0.4
        ? { goal: 10, clef: "bass", fixedNotes: [48, 50, 52, 53, 55, 57, 59], kbStart: 48, kbOctaves: 2, prompt: "Name the note" }
        : { goal: 10, prompt: "Name the note" },
    });

    // 2) A song — the next-up Course song if there is one, else a fresh library pick.
    const cu = nextUnit(window.Course, (u) => u.type === "song");
    let s1;
    if (cu) { segs.push({ kind: "song", title: cu.title, songId: cu.song, mode: cu.mode }); used.push(cu.song); }
    else { s1 = pickSong(used); segs.push({ kind: "song", title: s1.title, songId: s1.id, mode: "step" }); used.push(s1.id); }

    // 3) A chord drill — next-up Chords unit, else a random chord exercise.
    const ch = nextUnit(window.Chords, (u) => u.type === "song");
    const chordSong = ch ? ch.song : pick(window.Songs.LIBRARY.filter((s) => s.exercise && /chord|prog|switch|triads/.test(s.id)).map((s) => s.id));
    segs.push({ kind: "song", title: ch ? ch.title : "Chord practice", songId: chordSong, mode: "step" });
    used.push(chordSong);

    // 4) Longer sessions: another song (in time if already passed), then a reading test.
    if (minutes >= 10) {
      const s2 = pickSong(used);
      segs.push({ kind: "song", title: s2.title, songId: s2.id, mode: starsFor(s2.id) >= 2 ? "moving" : "step" });
      used.push(s2.id);
    }
    if (minutes >= 15) {
      segs.push({ kind: "test", title: "Reading test — 30 notes",
        trainerOpts: { promptCount: 30, showKey: false, prompt: "Name the note" } });
      const s3 = pickSong(used);
      segs.push({ kind: "song", title: s3.title, songId: s3.id, mode: "step" });
    }
    return segs;
  }

  // ---- Done-today state ---------------------------------------------------
  function markDone(minutes) {
    localStorage.setItem(key(), JSON.stringify({ date: window.Stats.dayKey(), minutes }));
  }
  function doneToday() {
    try {
      const d = JSON.parse(localStorage.getItem(key()));
      return !!d && d.date === window.Stats.dayKey();
    } catch { return false; }
  }

  window.Workout = { build, markDone, doneToday };
})();
