/* Note names, MIDI numbers, and the text notation the whole library is written in.
 * Run: node tests/theory.test.js
 *
 * Why this file exists: every song in library.js is stored as text ("E D Ch"),
 * and Theory + the songs.js parser are what turn that text into pitches. A drift
 * in either does not crash anything — it silently transposes or mis-times the
 * entire library, and the first person to notice is a beginner who assumes they
 * played it wrong. */
"use strict";
const { t, eq, ok, done, loadApp } = require("./_stub.js");

const { window } = loadApp(["version", "profiles", "keyboard", "library", "songs"]);
const { isWhite, midiToName, nameToMidi } = window.Theory;
const Songs = window.Songs;

// ---- names <-> MIDI ---------------------------------------------------------
t("middle C is MIDI 60 both ways", () => {
  eq(midiToName(60), "C4");
  eq(nameToMidi("C4"), 60);
});

t("every MIDI number round-trips through its name", () => {
  for (let m = 21; m <= 108; m++) eq(nameToMidi(midiToName(m)), m, "midi " + m);
});

t("A440 is MIDI 69", () => eq(nameToMidi("A4"), 69));

t("flats and sharps land on the same key", () => {
  eq(nameToMidi("Db3"), nameToMidi("C#3"));
  eq(nameToMidi("Bb4"), nameToMidi("A#4"));
});

t("lower case parses the same as upper", () => eq(nameToMidi("c4"), nameToMidi("C4")));

t("the octave defaults when the name omits it", () => {
  eq(nameToMidi("C"), 60);          // default octave 4
  eq(nameToMidi("C", 3), 48);
});

t("an unparseable name is NaN, not a plausible number", () => {
  ok(Number.isNaN(nameToMidi("H")), "H is not a note");
  ok(Number.isNaN(nameToMidi("")), "empty");
  ok(Number.isNaN(nameToMidi("C##4")), "double sharp is unsupported");
});

t("white and black keys across one octave", () => {
  const white = [60, 62, 64, 65, 67, 69, 71];   // C D E F G A B
  const black = [61, 63, 66, 68, 70];           // C# D# F# G# A#
  white.forEach((m) => ok(isWhite(m), midiToName(m) + " is white"));
  black.forEach((m) => ok(!isWhite(m), midiToName(m) + " is black"));
});

t("negative MIDI does not fall off the pitch-class wheel", () => {
  // The code guards with ((m % 12) + 12) % 12; a plain m % 12 goes negative and
  // indexes past the end of the name table.
  eq(isWhite(-12), true);
  eq(midiToName(0), "C-1");
});

// ---- the text notation ------------------------------------------------------
const parse = (s) => Songs.parseSong(s);

t("a bare letter is a quarter note in the default octave", () => {
  const { notes, errors } = parse("C");
  eq(errors.length, 0);
  eq(notes.length, 1);
  eq(notes[0].midi, 60);
  eq(notes[0].beats, 1);
});

t("duration letters map to beats", () => {
  const { notes } = parse("Cw Ch Cq Ce Cs");
  eq(notes.map((n) => n.beats).join(","), "4,2,1,0.5,0.25");
});

t("a dot adds half the duration", () => {
  eq(parse("Ch.").notes[0].beats, 3);
  eq(parse("Cq.").notes[0].beats, 1.5);
  eq(parse("Ce.").notes[0].beats, 0.75);
});

t("the octave is sticky until a digit changes it", () => {
  const { notes } = parse("G4 A B C5 D");
  eq(notes.map((n) => n.midi).join(","), "67,69,71,72,74");
});

t("a chord is one step holding several pitches", () => {
  const { notes } = parse("C4+E4+G4h");
  eq(notes.length, 1);
  eq(notes[0].midi.join(","), "60,64,67");
  eq(notes[0].beats, 2);
});

t("rests carry a duration and no pitch", () => {
  const { notes } = parse("R Rh");
  eq(notes[0].rest, true);
  eq(notes[0].beats, 1);
  eq(notes[1].beats, 2);
});

t("bar lines are readability only", () => {
  eq(parse("C D | E F").notes.length, parse("C D E F").notes.length);
});

t("a bad token is reported, and the good ones still parse", () => {
  const { notes, errors } = parse("C X D");
  eq(errors.join(","), "X");
  eq(notes.length, 2);
});

t("serialize round-trips through the parser", () => {
  const src = "E D Ch | C4+E4+G4h R Gq. A5e";
  const first = parse(src).notes;
  const again = parse(Songs.serialize(first)).notes;
  eq(JSON.stringify(again), JSON.stringify(first));
});

t("rangeOf spans the lowest and highest pitch, chords included", () => {
  const r = Songs.rangeOf(parse("C4 C4+E4+G5 A3").notes);
  eq(r.lo, 57);
  eq(r.hi, 79);
});

t("rangeOf falls back to one octave when there is nothing to measure", () => {
  const r = Songs.rangeOf(parse("R Rh").notes);
  eq(r.lo, 60);
  eq(r.hi, 72);
});

// ---- the shipped library ----------------------------------------------------
t("every song in the library parses with no bad tokens", () => {
  const bad = [];
  (window.SongData || []).forEach((s) => {
    const { errors } = parse(s.src);
    if (errors.length) bad.push(s.id + " -> " + errors.join(" "));
  });
  eq(bad.join("; "), "", "songs with unparseable tokens");
});

t("every song in the library produces at least one playable note", () => {
  const empty = Songs.LIBRARY.filter((s) => !s.notes.some((n) => !n.rest)).map((s) => s.id);
  eq(empty.join(","), "");
});

t("song ids are unique", () => {
  const ids = (window.SongData || []).map((s) => s.id);
  eq(ids.length, new Set(ids).size, "duplicate id in library.js");
});

done("theory + notation");
