/* Simpli Piano — lesson engine.
 *
 * Drives the core teaching loop on a song:
 *   show what to play (falling-notes lane + highlighted keys) → learner plays →
 *   color-coded feedback (good/ok/bad) → advance the cursor → score it.
 *
 * Two modes:
 *   - "step":   patient. Highlights the next key and waits until it's played.
 *   - "moving": notes scroll down to a tempo, with a metronome and timing window.
 *
 * The app wires the keyboard's onPress to engine.input(midi). Exposed as
 * window.LessonEngine. */
(() => {
  "use strict";

  const PPB = 70;            // lane pixels per beat
  const GAP = 4;            // px gap between stacked note blocks
  const HITLINE_PX = 8;     // hit line height above the keyboard
  const WINDOW_BEATS = 0.4; // moving-mode timing tolerance (± beats)
  const COUNT_IN = 4;       // count-in beats before the first note in moving mode

  function midisOf(step) { return Array.isArray(step.midi) ? step.midi : [step.midi]; }

  class LessonEngine {
    constructor({ laneEl, keyboard, onProgress, onComplete, onStatus }) {
      this.laneEl = laneEl;
      this.keyboard = keyboard;
      this.onProgress = onProgress || (() => {});
      this.onComplete = onComplete || (() => {});
      this.onStatus = onStatus || (() => {});
      this.raf = null;
    }

    load(song, { mode = "step", tempoScale = 1 } = {}) {
      this.stop();
      this.song = song;
      this.mode = mode;
      this.tempoScale = tempoScale;

      // Lay out steps along the beat axis; keep note steps for the cursor.
      let beat = 0;
      this.steps = song.notes.map((n) => {
        const s = { ...n, startBeat: beat };
        beat += n.beats;
        return s;
      });
      this.totalBeats = beat;
      this.playable = this.steps.filter((s) => !s.rest);
      this.playable.forEach((s, i) => (s.idx = i));

      this._buildLane();
      this._reset();
    }

    _reset() {
      this.cursor = 0;            // index into this.playable
      this.remaining = null;      // Set of midis still needed for current note
      this.mistakeThisNote = false;
      this.score = { good: 0, ok: 0, missed: 0, total: this.playable.length };
      this.playhead = this.mode === "moving" ? -COUNT_IN : 0;
      this.lastClickBeat = null;
      this._renderHead(false);
      this.onProgress(0, this.playable.length);
    }

    _buildLane() {
      this.laneEl.innerHTML = "";
      const notes = document.createElement("div");
      notes.className = "lane-notes";
      this.notesEl = notes;
      this.blockOf = new Map(); // playable idx -> element

      this.steps.forEach((s) => {
        if (s.rest) return;
        midisOf(s).forEach((m) => {
          const rect = this.keyboard.keyRect(m);
          if (!rect) return;
          const b = document.createElement("div");
          b.className = "note-block" + (window.Theory.isWhite(m) ? "" : " accidental");
          b.style.left = rect.leftPct + "%";
          b.style.width = "calc(" + rect.widthPct + "% - 3px)";
          b.style.bottom = (HITLINE_PX + s.startBeat * PPB) + "px";
          b.style.height = Math.max(10, s.beats * PPB - GAP) + "px";
          b.dataset.idx = String(s.idx);
          b.textContent = window.Theory.midiToName(m).replace(/\d+$/, "");
          notes.appendChild(b);
          // last block wins the map slot; fine — used only to color the chord group
          this.blockOf.set(s.idx, b);
        });
      });

      const hit = document.createElement("div");
      hit.className = "hitline";
      this.laneEl.appendChild(notes);
      this.laneEl.appendChild(hit);
      this._applyPlayhead();
    }

    _applyPlayhead() {
      if (this.notesEl) this.notesEl.style.transform = "translateY(" + (this.playhead * PPB) + "px)";
    }

    _blocksFor(idx) {
      return this.notesEl.querySelectorAll('.note-block[data-idx="' + idx + '"]');
    }

    // ---- Run control ------------------------------------------------------
    start() {
      window.PianoAudio.ensure();
      this.running = true;
      if (this.mode === "moving") {
        this.startTime = performance.now();
        this._tick();
      } else {
        this.notesEl.style.transition = "transform 0.18s ease";
        this.onStatus("Play the highlighted key");
      }
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.keyboard) this.keyboard.clearHighlights();
    }

    restart() { this._reset(); this.start(); }

    msPerBeat() { return 60000 / (this.song.tempo * this.tempoScale); }

    // ---- Step mode --------------------------------------------------------
    _renderHead(animate) {
      this.keyboard.clearHighlights();
      const note = this.playable[this.cursor];
      if (!note) return;
      this.remaining = new Set(midisOf(note));
      this.mistakeThisNote = false;
      // Glide the lane so the current note rests on the hit line.
      this.playhead = note.startBeat;
      if (animate === false && this.notesEl) this.notesEl.style.transition = "none";
      this._applyPlayhead();
      this.keyboard.highlight(midisOf(note), "hint");
      this._blocksFor(note.idx).forEach((b) => b.classList.add("active"));
    }

    // ---- Moving mode ------------------------------------------------------
    _tick() {
      if (!this.running) return;
      const elapsedBeats = ((performance.now() - this.startTime) / this.msPerBeat());
      this.playhead = -COUNT_IN + elapsedBeats;
      this._applyPlayhead();
      this._metronome();
      this._advanceMoving();
      if (this.playhead > this.totalBeats + 0.5) { this._finish(); return; }
      // Highlight the key(s) of the note currently nearest the line.
      const active = this.playable[this.cursor];
      if (active) {
        this.keyboard.clearHighlights();
        this.keyboard.highlight(midisOf(active), "hint");
      }
      this.raf = requestAnimationFrame(() => this._tick());
    }

    _metronome() {
      const b = Math.floor(this.playhead);
      if (b !== this.lastClickBeat && this.playhead >= -COUNT_IN) {
        this.lastClickBeat = b;
        window.PianoAudio.click(((b % 4) + 4) % 4 === 0);
      }
    }

    // In moving mode, retire notes whose window has closed without a full hit.
    _advanceMoving() {
      let note = this.playable[this.cursor];
      while (note && this.playhead > note.startBeat + WINDOW_BEATS) {
        if (this.remaining && this.remaining.size > 0 && !note._resolved) {
          this.score.missed++;
          this._blocksFor(note.idx).forEach((b) => b.classList.add("missed"));
        }
        this.cursor++;
        note = this.playable[this.cursor];
        this.remaining = note ? new Set(midisOf(note)) : null;
        this.mistakeThisNote = false;
        if (note) this.onProgress(this.cursor, this.playable.length);
      }
    }

    // ---- Input (from the keyboard) ---------------------------------------
    input(midi) {
      if (!this.running) return;
      const note = this.playable[this.cursor];
      if (!note) return;

      // Moving mode: only accept while the note is within its timing window.
      if (this.mode === "moving") {
        const dist = Math.abs(this.playhead - note.startBeat);
        if (dist > WINDOW_BEATS + 0.15) { this.keyboard.flash(midi, "bad"); return; }
      }

      // Exact match, or (when the mic is on) any octave of an expected note —
      // the mic can mis-guess octave, so we grade by note name there.
      let matched;
      if (this.remaining.has(midi)) matched = midi;
      else if (this.octaveTolerant) matched = [...this.remaining].find((r) => ((r - midi) % 12 + 12) % 12 === 0);

      if (matched !== undefined) {
        this.remaining.delete(matched);
        this.keyboard.flash(matched, "good"); // light the on-screen key for the expected note
        if (this.remaining.size === 0) this._noteComplete(note);
      } else {
        this.mistakeThisNote = true;
        this.keyboard.flash(midi, "bad");
      }
    }

    setOctaveTolerant(on) { this.octaveTolerant = on; }

    _noteComplete(note) {
      note._resolved = true;
      if (this.mistakeThisNote) this.score.ok++; else this.score.good++;
      const cls = this.mistakeThisNote ? "done-ok" : "done-good";
      this._blocksFor(note.idx).forEach((b) => { b.classList.remove("active", "missed"); b.classList.add(cls); });

      if (this.mode === "step") {
        this.cursor++;
        this.onProgress(this.cursor, this.playable.length);
        if (this.cursor >= this.playable.length) { this._finish(); return; }
        this.notesEl.style.transition = "transform 0.18s ease";
        this._renderHead(true);
      } else {
        // moving mode advances on its own clock; just prep the next note's set
        this.cursor++;
        const next = this.playable[this.cursor];
        this.remaining = next ? new Set(midisOf(next)) : null;
        this.mistakeThisNote = false;
        this.onProgress(this.cursor, this.playable.length);
      }
    }

    _finish() {
      this.stop();
      const { good, ok, total } = this.score;
      const accuracy = total ? (good + ok * 0.5) / total : 0;
      const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.4 ? 1 : 0;
      this.onStatus("Done!");
      this.onComplete({ stars, accuracy, ...this.score });
    }

    /* Play the song's notes so the learner can hear it first (no input needed). */
    listen() {
      this.stop();
      let t = 0;
      const mpb = this.msPerBeat();
      this.steps.forEach((s) => {
        if (!s.rest) {
          midisOf(s).forEach((m) => {
            setTimeout(() => window.PianoAudio.pluck(m, Math.max(180, s.beats * mpb * 0.9)), t);
          });
        }
        t += s.beats * mpb;
      });
    }
  }

  window.LessonEngine = LessonEngine;
})();
