/* Simpli Piano — reusable on-screen keyboard + shared music-theory helpers.
 *
 * window.Theory : note-name <-> MIDI helpers used across modules.
 * window.Keyboard : a class that renders a playable keyboard into a container,
 *   reports presses/releases, and exposes highlight() + keyRect() so the lesson
 *   engine can show which key is next and align falling notes above the keys. */
(() => {
  "use strict";

  // ---- Theory ------------------------------------------------------------
  const NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_OFFSETS = new Set([0, 2, 4, 5, 7, 9, 11]);
  const LETTER_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const isWhite = (m) => WHITE_OFFSETS.has(((m % 12) + 12) % 12);
  const midiToName = (m) => NAMES_SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  // Parse a note name like "C", "C#4", "Db3" -> MIDI (octave optional; caller
  // supplies a default octave when omitted). Returns NaN if unparseable.
  function nameToMidi(name, defaultOctave = 4) {
    const m = /^([A-Ga-g])([#b]?)(-?\d+)?$/.exec(name.trim());
    if (!m) return NaN;
    let semi = LETTER_SEMITONE[m[1].toUpperCase()];
    if (m[2] === "#") semi += 1;
    else if (m[2] === "b") semi -= 1;
    const oct = m[3] !== undefined ? parseInt(m[3], 10) : defaultOctave;
    return (oct + 1) * 12 + semi;
  }

  window.Theory = { isWhite, midiToName, nameToMidi, NAMES_SHARP };

  // ---- Keyboard ----------------------------------------------------------
  const MIN_WHITE_KEY_PX = 46;
  const MIN_OCTAVES = 1, MAX_OCTAVES = 4;

  class Keyboard {
    constructor(el, opts = {}) {
      this.el = el;
      this.onPress = opts.onPress || null;     // (midi) => void
      this.onRelease = opts.onRelease || null;  // (midi) => void
      this.playAudio = opts.playAudio !== false; // sound on tap unless disabled
      this.showLabels = opts.showLabels !== false;
      this.startMidi = opts.startMidi ?? 60;    // C4
      this.octaves = opts.octaves ?? null;      // null => auto-fit to width
      this.fixedRange = opts.octaves != null;
      this.keyEls = new Map();                  // midi -> element
      this.pointerNote = new Map();             // pointerId -> midi
      this.el.classList.add("keyboard");
      this._bindPointer();
      this.render();
    }

    _autoOctaves() {
      const w = this.el.clientWidth || window.innerWidth;
      const fit = Math.floor(w / (MIN_WHITE_KEY_PX * 7));
      return Math.max(MIN_OCTAVES, Math.min(MAX_OCTAVES, fit || MIN_OCTAVES));
    }

    /* Fix the keyboard to a specific range (used by lessons to fit a song). */
    setRange(startMidi, octaves) {
      this.startMidi = startMidi;
      this.octaves = octaves;
      this.fixedRange = true;
      this.render();
    }

    setLabels(on) {
      this.showLabels = on;
      this.el.classList.toggle("no-labels", !on);
    }

    render() {
      const octaves = this.fixedRange ? (this.octaves || 2) : this._autoOctaves();
      this.octaves = octaves;
      this.el.innerHTML = "";
      this.el.classList.toggle("no-labels", !this.showLabels);
      this.keyEls = new Map();

      const total = octaves * 12 + 1; // end on a C
      const whiteMidis = [];
      for (let i = 0; i < total; i++) {
        const m = this.startMidi + i;
        if (isWhite(m)) whiteMidis.push(m);
      }
      this._whiteCount = whiteMidis.length;
      this._whiteIndex = new Map();

      whiteMidis.forEach((m, idx) => {
        this._whiteIndex.set(m, idx);
        this.el.appendChild(this._makeKey(m, "white"));
      });

      for (let i = 0; i < total; i++) {
        const m = this.startMidi + i;
        if (isWhite(m)) continue;
        const idx = this._whiteIndex.get(m - 1);
        if (idx === undefined) continue;
        const el = this._makeKey(m, "black");
        const unit = 100 / this._whiteCount;
        const bw = unit * 0.62;
        el.style.width = bw + "%";
        el.style.left = (unit * (idx + 1) - bw / 2) + "%";
        this.el.appendChild(el);
      }
    }

    _makeKey(midi, kind) {
      const el = document.createElement("div");
      el.className = "key " + kind;
      el.dataset.midi = String(midi);
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = midiToName(midi);
      el.appendChild(label);
      this.keyEls.set(midi, el);
      return el;
    }

    /* Geometry of a key as percentages of keyboard width (for the note lane). */
    keyRect(midi) {
      if (isWhite(midi)) {
        const idx = this._whiteIndex.get(midi);
        if (idx === undefined) return null;
        const unit = 100 / this._whiteCount;
        return { leftPct: unit * idx, widthPct: unit };
      }
      const idx = this._whiteIndex.get(midi - 1);
      if (idx === undefined) return null;
      const unit = 100 / this._whiteCount;
      const bw = unit * 0.62;
      return { leftPct: unit * (idx + 1) - bw / 2, widthPct: bw };
    }

    inRange(midi) {
      return midi >= this.startMidi && midi <= this.startMidi + this.octaves * 12;
    }

    // ---- Visual state ----
    setActive(midi, on) {
      const el = this.keyEls.get(midi);
      if (el) el.classList.toggle("active", on);
    }
    /* Highlight keys with a feedback class: "hint" | "good" | "bad". */
    highlight(midis, cls = "hint") {
      (Array.isArray(midis) ? midis : [midis]).forEach((m) => {
        const el = this.keyEls.get(m);
        if (el) el.classList.add("hl-" + cls);
      });
    }
    clearHighlights() {
      this.el.querySelectorAll(".hl-hint,.hl-good,.hl-bad")
        .forEach((el) => el.classList.remove("hl-hint", "hl-good", "hl-bad"));
    }
    flash(midi, cls, ms = 220) {
      const el = this.keyEls.get(midi);
      if (!el) return;
      el.classList.add("hl-" + cls);
      setTimeout(() => el.classList.remove("hl-" + cls), ms);
    }

    // ---- Input ----
    _midiFromPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      const key = el && el.closest(".key");
      return key && this.el.contains(key) ? Number(key.dataset.midi) : NaN;
    }
    _press(midi) {
      if (Number.isNaN(midi)) return;
      this.setActive(midi, true);
      if (this.playAudio) window.PianoAudio.noteOn(midi);
      if (this.onPress) this.onPress(midi);
    }
    _release(midi) {
      if (Number.isNaN(midi)) return;
      this.setActive(midi, false);
      if (this.playAudio) window.PianoAudio.noteOff(midi);
      if (this.onRelease) this.onRelease(midi);
    }
    _bindPointer() {
      const el = this.el;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const m = this._midiFromPoint(e.clientX, e.clientY);
        if (Number.isNaN(m)) return;
        this.pointerNote.set(e.pointerId, m);
        this._press(m);
      });
      el.addEventListener("pointermove", (e) => {
        if (!this.pointerNote.has(e.pointerId)) return;
        const m = this._midiFromPoint(e.clientX, e.clientY);
        const prev = this.pointerNote.get(e.pointerId);
        if (m === prev) return;
        if (!Number.isNaN(prev)) this._release(prev);
        if (!Number.isNaN(m)) { this.pointerNote.set(e.pointerId, m); this._press(m); }
        else this.pointerNote.delete(e.pointerId);
      });
      const end = (e) => {
        const m = this.pointerNote.get(e.pointerId);
        if (m !== undefined) { this._release(m); this.pointerNote.delete(e.pointerId); }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("pointerleave", end);
    }
  }

  window.Keyboard = Keyboard;
})();
