/* The two learning tracks: what unlocks, when, and whether every lesson it
 * offers actually exists.
 * Run: node tests/course.test.js
 *
 * Why this file exists: units reference songs by string id. Rename or remove a
 * song in library.js and the course still lists the lesson — it just refuses to
 * start, with no error anywhere. The curriculum checks at the bottom make that
 * a test failure instead of a dead lesson a learner finds first. */
"use strict";
const { t, eq, ok, done, loadApp } = require("./_stub.js");

const { window, storage } = loadApp(["version", "profiles", "keyboard", "library", "songs", "course"]);
const { Course, Chords, Songs } = window;

const reset = () => storage.clear();
const idx = (track, unitId) => track.CURRICULUM.findIndex((u) => u.id === unitId);

// ---- unlocking --------------------------------------------------------------
t("the first unit is always open", () => {
  reset();
  ok(Course.unlocked(0));
});

t("the second unit is locked until the first is complete", () => {
  reset();
  ok(!Course.unlocked(1), "locked to begin with");
  Course.complete(Course.CURRICULUM[0].id, 3, 1.0);
  ok(Course.unlocked(1), "open once the one before it is done");
});

t("80% completes a unit, 79% does not", () => {
  const first = Course.CURRICULUM[0].id;
  reset();
  eq(Course.complete(first, 2, 0.79), false, "just short");
  ok(!Course.isComplete(first));
  ok(!Course.unlocked(1), "and the next one stays shut");

  reset();
  eq(Course.complete(first, 2, 0.80), true, "exactly the pass mark");
  ok(Course.isComplete(first));
  ok(Course.unlocked(1));
});

t("a run with no accuracy (key-find drills) records stars without completing", () => {
  const first = Course.CURRICULUM[0].id;
  reset();
  Course.complete(first, 2, null);
  eq(Course.starsFor(first), 2);
  ok(!Course.isComplete(first));
});

t("stars only ever go up", () => {
  const first = Course.CURRICULUM[0].id;
  reset();
  Course.complete(first, 3, 1.0);
  Course.complete(first, 1, 1.0);          // a worse replay
  eq(Course.starsFor(first), 3, "the better run stands");
});

t("a completed unit stays complete after a worse replay", () => {
  const first = Course.CURRICULUM[0].id;
  reset();
  Course.complete(first, 3, 1.0);
  Course.complete(first, 1, 0.2);
  ok(Course.isComplete(first));
});

t("a manual unlock opens one unit without completing the ones before it", () => {
  reset();
  const fifth = Course.CURRICULUM[4].id;
  ok(!Course.unlocked(4));
  Course.unlock(fifth);
  ok(Course.unlocked(4), "open");
  ok(!Course.isComplete(Course.CURRICULUM[3].id), "without faking the earlier work");
});

t("nextIndex points at the first open, unfinished unit", () => {
  reset();
  eq(Course.nextIndex(), 0);
  Course.complete(Course.CURRICULUM[0].id, 3, 1.0);
  eq(Course.nextIndex(), 1);
});

t("legacy progress saved as a bare number still reads", () => {
  reset();
  const first = Course.CURRICULUM[0].id;
  storage.setItem(window.Profiles.key("piano.course"), JSON.stringify({ [first]: 2 }));
  eq(Course.starsFor(first), 2);
  ok(Course.isComplete(first), "an old entry with stars counted as done");
});

t("corrupt saved progress reads as a fresh start instead of throwing", () => {
  reset();
  storage.setItem(window.Profiles.key("piano.course"), "{not json");
  eq(Course.starsFor(Course.CURRICULUM[0].id), 0);
  ok(Course.unlocked(0));
});

t("the two tracks keep separate progress", () => {
  reset();
  Course.complete(Course.CURRICULUM[0].id, 3, 1.0);
  ok(!Chords.isComplete(Chords.CURRICULUM[0].id), "finishing a reading unit does not finish a chord unit");
  ok(!Chords.unlocked(1));
});

// ---- the curriculum itself --------------------------------------------------
const TRACKS = [["Course", Course], ["Chords", Chords]];

t("every song lesson points at a song that exists", () => {
  const missing = [];
  TRACKS.forEach(([name, track]) => {
    track.CURRICULUM.forEach((u) => {
      if (u.type === "song" && !Songs.byId(u.song)) missing.push(`${name}/${u.id} -> "${u.song}"`);
    });
  });
  eq(missing.join("; "), "", "lessons pointing at songs that are not in the library");
});

t("every unit id is unique across both tracks", () => {
  const ids = TRACKS.flatMap(([, track]) => track.CURRICULUM.map((u) => u.id));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  eq([...new Set(dupes)].join(","), "", "duplicate unit ids");
});

t("every unit sits in a tier the track declares", () => {
  const stray = [];
  TRACKS.forEach(([name, track]) => {
    const tiers = new Set(track.TIERS.map((x) => x.id));
    track.CURRICULUM.forEach((u) => {
      if (!tiers.has(u.level)) stray.push(`${name}/${u.id} -> "${u.level}"`);
    });
  });
  eq(stray.join("; "), "", "units in a tier that is not on the track");
});

t("every unit has a type the app knows how to run", () => {
  const known = new Set(["song", "trainer", "keyfind"]);
  const stray = [];
  TRACKS.forEach(([name, track]) => track.CURRICULUM.forEach((u) => {
    if (!known.has(u.type)) stray.push(`${name}/${u.id} -> "${u.type}"`);
  }));
  eq(stray.join("; "), "");
});

t("every song lesson asks for a mode the engine supports", () => {
  const stray = [];
  TRACKS.forEach(([name, track]) => track.CURRICULUM.forEach((u) => {
    if (u.type === "song" && !["step", "moving"].includes(u.mode)) stray.push(`${name}/${u.id} -> "${u.mode}"`);
  }));
  eq(stray.join("; "), "");
});

t("every unit has a title and a blurb to show", () => {
  const bare = [];
  TRACKS.forEach(([name, track]) => track.CURRICULUM.forEach((u) => {
    if (!u.title || !u.blurb) bare.push(`${name}/${u.id}`);
  }));
  eq(bare.join(", "), "");
});

t("the tracks are ordered, not empty", () => {
  TRACKS.forEach(([name, track]) => ok(track.CURRICULUM.length > 0, name + " has units"));
  eq(Course.PASS, 0.8);
});

done("course progression");
