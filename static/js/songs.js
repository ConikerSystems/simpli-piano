/* Simpli Piano — song model, text-notation parser/serializer, starter library.
 *
 * Text notation (used by the in-app "type a song" editor, and to author the
 * starter library below):
 *   - Tokens separated by spaces (and optional "|" bar lines, which are ignored).
 *   - A note is a letter A-G, optional accidental (# or b), optional octave digit,
 *     optional duration letter. Octave is "sticky" — omit it to reuse the last one.
 *   - Durations: w=whole(4) h=half(2) q=quarter(1) e=eighth(0.5) s=sixteenth(0.25).
 *     A trailing "." dots the duration (adds half its value). Default = quarter.
 *   - Rest: R + optional duration  (e.g. Rq, Rh).
 *   - Chord: notes joined by "+", duration on the end  (e.g. C+E+G  or  C4+E4+G4h).
 *   Examples:  "E D C D E E Eh"   "C+E+G h"   "G4 A B C5w"
 *
 * Exposed as window.Songs. */
(() => {
  "use strict";

  const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  const { nameToMidi, midiToName } = window.Theory;

  // Does `str` parse as a chord/note (every "+"-separated part is a valid pitch)?
  function pitchesParse(str) {
    if (!str) return false;
    return str.split("+").every((p) => !Number.isNaN(nameToMidi(p)));
  }

  function durToBeats(letter, dots) {
    let base = DUR[letter];
    let beats = base, add = base;
    for (let i = 0; i < dots; i++) { add /= 2; beats += add; }
    return beats;
  }

  // Parse one token using/updating ctx.octave. Returns a note step or {error}.
  function parseToken(tok, ctx) {
    let body = tok, beats = 1; // default quarter
    const dm = /^(.*?)([whqes])(\.*)$/i.exec(tok);
    if (dm && (pitchesParse(dm[1]) || /^r$/i.test(dm[1]))) {
      body = dm[1];
      beats = durToBeats(dm[2].toLowerCase(), dm[3].length);
    }
    if (/^r$/i.test(body)) return { rest: true, beats };

    const parts = body.split("+");
    const midis = [];
    for (const p of parts) {
      const m = nameToMidi(p, ctx.octave);
      if (Number.isNaN(m)) return { error: tok };
      midis.push(m);
    }
    ctx.octave = Math.floor(midis[midis.length - 1] / 12) - 1; // sticky
    return { midi: midis.length === 1 ? midis[0] : midis, beats };
  }

  /* Parse a whole song body. Returns { notes, errors }. */
  function parseSong(text) {
    const ctx = { octave: 4 };
    const notes = [], errors = [];
    const tokens = String(text || "").replace(/\|/g, " ").split(/\s+/).filter(Boolean);
    tokens.forEach((tok) => {
      const step = parseToken(tok, ctx);
      if (step.error) errors.push(step.error);
      else notes.push(step);
    });
    return { notes, errors };
  }

  function beatsToToken(beats) {
    const table = { 4: "w", 3: "h.", 2: "h", 1.5: "q.", 1: "q", 0.75: "e.", 0.5: "e", 0.25: "s" };
    return table[beats] || "q";
  }

  /* Turn a notes array back into editable text (used to edit saved songs). */
  function serialize(notes) {
    return notes.map((n) => {
      const dur = beatsToToken(n.beats);
      if (n.rest) return "R" + (dur === "q" ? "" : dur);
      const pitch = (Array.isArray(n.midi) ? n.midi : [n.midi]).map(midiToName).join("+");
      return pitch + (dur === "q" ? "" : dur);
    }).join(" ");
  }

  function rangeOf(notes) {
    let lo = Infinity, hi = -Infinity;
    notes.forEach((n) => {
      if (n.rest) return;
      (Array.isArray(n.midi) ? n.midi : [n.midi]).forEach((m) => {
        lo = Math.min(lo, m); hi = Math.max(hi, m);
      });
    });
    if (lo === Infinity) { lo = 60; hi = 72; }
    return { lo, hi };
  }

  function makeSong({ id, title, difficulty = 1, tempo = 90, hand = "right", src, exercise = false, genre = "folk" }) {
    const { notes, errors } = parseSong(src);
    if (errors.length) console.warn("Song", id, "has bad tokens:", errors);
    return { id, title, difficulty, tempo, hand, notes, exercise, genre };
  }

  // ---- Built-in library ---------------------------------------------------
  // Song DATA lives in static/js/library.js (window.SongData) so adding songs
  // is a data-only change; this file owns the parsing/model.
  const LIBRARY = (window.SongData || []).map(makeSong);

  // ---- User songs (localStorage) ----------------------------------------
  const USER_KEY = "piano.userSongs";
  function loadUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || []; }
    catch { return []; }
  }
  function saveUserList(list) { localStorage.setItem(USER_KEY, JSON.stringify(list)); }

  function slugify(title) {
    return "user-" + (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song");
  }

  /* Create or update a user song from editor input. Returns {song} or {errors}. */
  function saveUserSong({ id, title, tempo, src }) {
    const { notes, errors } = parseSong(src);
    if (errors.length) return { errors };
    if (!notes.length) return { errors: ["(empty — add some notes)"] };
    const list = loadUser();
    const song = {
      id: id || slugify(title || "song") + "-" + (list.length + 1),
      title: title || "Untitled", difficulty: 1, tempo: tempo || 90, hand: "right",
      notes, src, user: true,
    };
    const i = list.findIndex((s) => s.id === song.id);
    if (i >= 0) list[i] = song; else list.push(song);
    saveUserList(list);
    return { song };
  }
  function deleteUserSong(id) { saveUserList(loadUser().filter((s) => s.id !== id)); }

  function all() { return [...LIBRARY, ...loadUser()]; }
  function byId(id) { return all().find((s) => s.id === id) || null; }

  window.Songs = {
    parseSong, serialize, rangeOf, LIBRARY,
    loadUser, saveUserSong, deleteUserSong, all, byId,
  };
})();
