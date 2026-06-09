/* Simpli Piano — note-reading trainer.
 *
 * Flashcard reading drill (the Simply Piano "read the note, play the key" idea):
 * draw one note on a real staff (or show its letter name), the learner plays the
 * matching key, get color feedback, advance. Range expands as the streak grows.
 *
 * Naturals only (white keys) so it teaches staff reading cleanly.
 * Exposed as window.Trainer. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const { midiToName } = window.Theory;

  // pitch class -> diatonic ordinal (C=0,D=1,E=2,F=3,G=4,A=5,B=6) for naturals
  const PC_ORDINAL = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const isNatural = (m) => PC_ORDINAL[((m % 12) + 12) % 12] !== undefined;

  // Staff geometry (SVG viewBox 0 0 300 180). Treble bottom line E4 at y=120.
  const GAP = 12, HALF = 6;
  const E4_DI = 4 * 7 + 2, E4_Y = 120;
  function diatonicIndex(m) {
    const oct = Math.floor(m / 12) - 1;
    return oct * 7 + PC_ORDINAL[((m % 12) + 12) % 12];
  }
  const noteY = (m) => E4_Y - (diatonicIndex(m) - E4_DI) * HALF;

  function whiteInRange(lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (isNatural(m)) out.push(m);
    return out;
  }

  // Expanding levels (treble). goalToAdvance correct answers bumps the level.
  const LEVELS = [
    whiteInRange(60, 67),  // C4–G4
    whiteInRange(60, 72),  // C4–C5
    whiteInRange(60, 76),  // C4–E5
    whiteInRange(60, 84),  // C4–C6 (two octaves)
  ];

  function line(x1, y1, x2, y2, w = 1.4, color = "#cfd6e6") {
    const l = document.createElementNS(SVGNS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", color); l.setAttribute("stroke-width", w);
    return l;
  }

  function drawStaff(svg, midi, mode) {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", "0 0 300 180");
    const left = 14, right = 286;
    // 5 staff lines (E4..F5)
    for (let i = 0; i < 5; i++) {
      const y = E4_Y - i * GAP;
      svg.appendChild(line(left, y, right, y));
    }
    // treble clef glyph
    const clef = document.createElementNS(SVGNS, "text");
    clef.setAttribute("x", 18); clef.setAttribute("y", 124);
    clef.setAttribute("font-size", "78"); clef.setAttribute("fill", "#e8eaf0");
    clef.setAttribute("font-family", "Bravura, 'Noto Music', serif");
    clef.textContent = "𝄞"; // 𝄞
    svg.appendChild(clef);

    if (mode === "name") {
      const t = document.createElementNS(SVGNS, "text");
      t.setAttribute("x", 175); t.setAttribute("y", 96);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("font-size", "64");
      t.setAttribute("font-weight", "700"); t.setAttribute("fill", "#6ea8fe");
      t.textContent = midiToName(midi).replace(/\d+$/, "");
      svg.appendChild(t);
      return;
    }

    const cx = 180, y = noteY(midi);
    // ledger lines below / above the staff
    if (y > E4_Y) for (let ly = E4_Y + GAP; ly <= y; ly += GAP) svg.appendChild(line(cx - 16, ly, cx + 16, ly));
    if (y < E4_Y - 4 * GAP) for (let ly = E4_Y - 5 * GAP; ly >= y; ly -= GAP) svg.appendChild(line(cx - 16, ly, cx + 16, ly));
    // stem (up if low on staff, down if high)
    const up = y >= E4_Y - 2 * GAP;
    svg.appendChild(line(up ? cx + 9 : cx - 9, y, up ? cx + 9 : cx - 9, up ? y - 38 : y + 38, 1.8, "#e8eaf0"));
    // note head
    const head = document.createElementNS(SVGNS, "ellipse");
    head.setAttribute("cx", cx); head.setAttribute("cy", y);
    head.setAttribute("rx", 8.5); head.setAttribute("ry", 6.2);
    head.setAttribute("transform", "rotate(-20 " + cx + " " + y + ")");
    head.setAttribute("fill", "#e8eaf0");
    svg.appendChild(head);
  }

  class Trainer {
    constructor({ svgEl, keyboard, onUpdate, displayMode = "staff", fixedNotes = null, goal = null, onDone = null }) {
      this.svg = svgEl;
      this.keyboard = keyboard;
      this.onUpdate = onUpdate || (() => {});
      this.mode = displayMode;          // "staff" | "name"
      this.fixedNotes = fixedNotes;     // if set, drill only these (course key-find)
      this.goal = goal;                 // correct answers to finish (course), else endless
      this.onDone = onDone;
      this.level = 0;
      this.correct = 0; this.total = 0; this.streak = 0; this.done = false;
    }

    pool() { return this.fixedNotes || LEVELS[Math.min(this.level, LEVELS.length - 1)]; }

    start() { this.next(); }

    next() {
      this.keyboard.clearHighlights();
      const pool = this.pool();
      let m;
      do { m = pool[Math.floor(Math.random() * pool.length)]; } while (m === this.target && pool.length > 1);
      this.target = m;
      drawStaff(this.svg, m, this.mode);
      this._emit();
    }

    input(midi) {
      if (this.done) return;
      this.total++;
      if (midi === this.target) {
        this.correct++; this.streak++;
        this.keyboard.flash(midi, "good");
        // level up on a streak (only in endless/expanding mode)
        if (!this.fixedNotes && this.streak > 0 && this.streak % 5 === 0 && this.level < LEVELS.length - 1) this.level++;
        this._emit();
        if (this.goal && this.correct >= this.goal) { this._finish(); return; }
        setTimeout(() => this.next(), 320);
      } else {
        this.streak = 0;
        this.keyboard.flash(midi, "bad");
        this.keyboard.highlight(this.target, "hint"); // reveal the right key briefly
        setTimeout(() => this.keyboard.clearHighlights(), 700);
        this._emit();
      }
    }

    _emit() {
      const acc = this.total ? Math.round((this.correct / this.total) * 100) : 100;
      this.onUpdate({ level: this.level + 1, correct: this.correct, total: this.total, streak: this.streak, accuracy: acc, goal: this.goal });
    }

    _finish() {
      this.done = true;
      this.keyboard.clearHighlights();
      const acc = this.total ? this.correct / this.total : 1;
      const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
      if (this.onDone) this.onDone({ stars, accuracy: acc, correct: this.correct, total: this.total });
    }

    stop() { this.done = true; if (this.keyboard) this.keyboard.clearHighlights(); }
  }

  Trainer.LEVELS = LEVELS; // exposed so the course can pin a drill to one level
  window.Trainer = Trainer;
})();
