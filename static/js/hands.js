/* Simpli Piano — "which finger?" hands overlay (typing-tutor style).
 *
 * Draws two semi-transparent cartoon hands over the on-screen keyboard — a
 * single natural hand silhouette per hand (curved fingers of different
 * lengths, opposed thumb, palm + wrist), with a numbered fingertip badge on
 * each key of the current five-finger position, numbered the piano way
 * (thumb = 1 … pinky = 5). When the lesson/trainer highlights a target key,
 * the matching fingertip badge lights up as well.
 *
 * Usage:
 *   const hands = new window.Hands(keyboard, kbWrapEl);   // patches keyboard
 *   hands.set({ right: 60 });                  // RH thumb on C4 (C position)
 *   hands.set({ left: { pinky: 48 } });        // LH C position (pinky on C3)
 *   hands.set({ left: { thumb: 48 } });        // LH anchored by thumb (Free Play)
 *   hands.setOn(true/false);
 *
 * Geometry: the silhouette is authored for the RIGHT hand in a 100×112 box
 * where the five fingertips sit at x = 10/30/50/70/90 — exactly the centers
 * of five equal-width keys — so stretching the SVG across the mapped keys
 * lines every finger up with its key. The left hand is the same artwork
 * mirrored. y runs 0–100 over the keyboard height; 100–112 is the wrist,
 * drawn just below the keys. Positions are % so resize needs no relayout;
 * keyboard.render() is patched to re-draw when the range changes. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const { isWhite } = window.Theory;

  // Natural right-hand silhouette (see geometry note above): wrist → outer
  // thumb edge → thumb tip → crotch → index/middle/ring/pinky with rounded
  // tips and webbed valleys → outer palm → wrist.
  const HAND_PATH =
    "M 16 104" +
    " C 14 98, 9 92, 7 86" +
    " C 5.5 82.5, 4.6 79.5, 5 77" +
    " C 5.6 73, 9 71, 12.4 72.5" +
    " C 14.6 73.7, 15.6 76, 15.2 78.5" +
    " C 17 84, 20.5 89.5, 24.8 92.5" +
    " C 25.3 88, 25.4 72, 25.4 57.6" +
    " C 25.4 53.4, 27.3 51.4, 30 51.4" +
    " C 32.7 51.4, 34.6 53.4, 34.6 57.6" +
    " L 34.6 84" +
    " C 34.9 87.4, 36.6 88.2, 40 88.2" +
    " C 43.4 88.2, 45 87.4, 45.2 84" +
    " L 45.2 55.6" +
    " C 45.2 51.4, 47.2 49.4, 50 49.4" +
    " C 52.8 49.4, 54.8 51.4, 54.8 55.6" +
    " L 54.8 84.4" +
    " C 55.1 87.8, 56.8 88.6, 60 88.6" +
    " C 63.2 88.6, 64.9 87.8, 65.4 84.4" +
    " L 65.6 62.4" +
    " C 65.6 58.4, 67.5 56.4, 70 56.4" +
    " C 72.5 56.4, 74.4 58.4, 74.4 62.4" +
    " L 74.4 85" +
    " C 74.7 88.4, 76.6 89.2, 80 89.2" +
    " C 83.4 89.2, 85.2 88.4, 86.2 85.4" +
    " L 86.2 70" +
    " C 86.2 66.4, 87.9 64.6, 90 64.6" +
    " C 92.1 64.6, 93.8 66.4, 93.8 70" +
    " L 93.8 86" +
    " C 95.6 90, 97 94, 96.6 98" +
    " C 96.3 101, 95.4 103, 94.4 105" +
    " C 93.8 107.5, 93.2 110, 92.8 112" +
    " L 25 112" +
    " C 23.5 108.5, 19.5 106, 16 104 Z";

  // Fingertip badge tops matching the artwork's finger pads
  // (finger number → y as % of keyboard height; x comes from the key center).
  const TIP = { 1: 75, 2: 56, 3: 54, 4: 61, 5: 69 };

  function whitesFrom(midi, count, dir) {
    const out = [];
    let m = midi;
    while (out.length < count && m > 8 && m < 120) { if (isWhite(m)) out.push(m); m += dir; }
    return out;
  }

  class Hands {
    constructor(keyboard, wrapEl) {
      this.kb = keyboard;
      this.wrap = wrapEl;
      this.map = {};            // "left"/"right" -> [{midi, finger}]
      this.byMidi = new Map();  // midi -> fingertip badge element
      this.on = true;

      this.overlay = document.createElement("div");
      this.overlay.className = "hands-overlay";
      wrapEl.classList.add("has-hands");
      wrapEl.appendChild(this.overlay);

      // Mirror the keyboard's visual state onto the fingertips, and re-draw
      // whenever the keyboard re-renders (range/size change).
      const kb = this.kb;
      const origHi = kb.highlight.bind(kb), origClear = kb.clearHighlights.bind(kb);
      const origFlash = kb.flash.bind(kb), origRender = kb.render.bind(kb);
      kb.highlight = (midis, cls) => {
        origHi(midis, cls);
        (Array.isArray(midis) ? midis : [midis]).forEach((m) => {
          const tip = this.byMidi.get(m);
          if (tip) tip.classList.add(cls === "hint" ? "active" : "good");
        });
      };
      kb.clearHighlights = () => {
        origClear();
        this.byMidi.forEach((tip) => tip.classList.remove("active", "good"));
      };
      kb.flash = (m, cls, ms = 220) => {
        origFlash(m, cls, ms);
        const tip = this.byMidi.get(m);
        if (tip && cls === "good") { tip.classList.add("good"); setTimeout(() => tip.classList.remove("good"), ms); }
      };
      kb.render = () => { origRender(); this.render(); };
    }

    /* mapping: { right: midi | {thumb: midi}, left: midi | {pinky|thumb: midi} }
       Right hand spans 5 white keys up from the thumb. Left hand: pinky-anchored
       spans up (C position), thumb-anchored spans down (Free Play). */
    set(mapping) {
      this.map = {};
      if (mapping.right != null) {
        const thumb = typeof mapping.right === "number" ? mapping.right : mapping.right.thumb;
        this.map.right = whitesFrom(thumb, 5, +1).map((m, i) => ({ midi: m, finger: i + 1 }));
      }
      if (mapping.left != null) {
        const a = typeof mapping.left === "number" ? { pinky: mapping.left } : mapping.left;
        this.map.left = a.thumb != null
          ? whitesFrom(a.thumb, 5, -1).map((m, i) => ({ midi: m, finger: i + 1 }))
          : whitesFrom(a.pinky, 5, +1).map((m, i) => ({ midi: m, finger: 5 - i }));
      }
      this.render();
    }

    setOn(on) {
      this.on = on;
      this.overlay.style.display = on ? "" : "none";
    }

    render() {
      this.overlay.innerHTML = "";
      this.byMidi = new Map();
      ["left", "right"].forEach((h) => this._renderHand(h));
    }

    _renderHand(handKey) {
      const fingers = this.map[handKey];
      if (!fingers || !fingers.length) return;
      const placed = [];
      fingers.forEach(({ midi, finger }) => {
        const r = this.kb.keyRect(midi);
        if (r) placed.push({ midi, finger, r });
      });
      if (!placed.length) return;

      // The hand silhouette needs all five keys on screen (it spans them
      // edge-to-edge); with fewer visible we still show the number badges.
      if (placed.length === 5) {
        const left = Math.min(...placed.map((p) => p.r.leftPct));
        const right = Math.max(...placed.map((p) => p.r.leftPct + p.r.widthPct));
        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", "0 0 100 112");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.left = left + "%";
        svg.style.width = (right - left) + "%";
        if (handKey === "left") svg.style.transform = "scaleX(-1)";
        const path = document.createElementNS(SVGNS, "path");
        path.setAttribute("d", HAND_PATH);
        path.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(path);
        this.overlay.appendChild(svg);
      }

      placed.forEach(({ midi, finger, r }) => {
        const cx = r.leftPct + r.widthPct / 2;
        const w = Math.min(r.widthPct * 0.52, 4.4);
        const tip = document.createElement("div");
        tip.className = "hand-tip";
        tip.textContent = finger;
        tip.style.left = cx + "%";
        tip.style.width = w + "%";
        tip.style.top = TIP[finger] + "%";
        this.overlay.appendChild(tip);
        this.byMidi.set(midi, tip);
      });
    }
  }

  window.Hands = Hands;
})();
