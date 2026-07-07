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
  // Hand silhouette — fingers taper toward rounded tips, edges bow gently.
  const HAND_PATH =
    "M 16 104" +
    " C 14 98, 9 92, 7 86" +            // outer palm edge up
    " C 5.5 82.5, 4.6 79.5, 5 77" +     // outer thumb edge
    " C 5.6 73, 9 71, 12.4 72.5" +      // thumb tip
    " C 14.6 73.7, 15.6 76, 15.2 78.5" +
    " C 17 84, 20.5 89.5, 24.8 92.5" +  // inner thumb to the crotch
    " C 25.3 87, 25.8 68, 26 56.5" +    // index, left edge (tapering in)
    " C 26 52.4, 27.6 50.4, 30 50.4" +  // rounded tip
    " C 32.4 50.4, 34 52.4, 34 56.5" +
    " C 34.2 68, 34.5 80, 34.8 84.5" +  // right edge (widening to the base)
    " C 35.1 87.6, 36.6 88.4, 40 88.4" +// webbed valley
    " C 43.4 88.4, 44.9 87.6, 45.2 84.5" +
    " C 45.5 80, 45.8 68, 45.9 54.6" +  // middle (longest)
    " C 45.9 50.4, 47.6 48.4, 50 48.4" +
    " C 52.4 48.4, 54.1 50.4, 54.1 54.6" +
    " C 54.2 68, 54.5 80, 54.8 84.9" +
    " C 55.1 88, 56.8 88.8, 60 88.8" +
    " C 63.2 88.8, 64.9 88, 65.3 84.9" +
    " C 65.5 80, 65.8 70, 66 61.3" +    // ring
    " C 66 57.4, 67.6 55.5, 70 55.5" +
    " C 72.4 55.5, 74 57.4, 74 61.3" +
    " C 74.2 70, 74.4 80, 74.6 85.4" +
    " C 74.9 88.6, 76.6 89.4, 80 89.4" +
    " C 83.4 89.4, 85 88.6, 86 85.6" +
    " C 86.1 81, 86.3 74, 86.5 69.2" +  // pinky (smallest)
    " C 86.5 65.8, 88 64, 90 64" +
    " C 92 64, 93.5 65.8, 93.5 69.2" +
    " C 93.6 74, 93.7 80, 93.8 86" +
    " C 95.6 90, 97 94, 96.6 98" +      // outer palm, down to the wrist
    " C 96.3 100, 95.4 101.5, 94.4 103" +
    " C 94 104.4, 93.6 105.7, 93.2 107" +
    " L 24.8 107" +
    " C 23.2 105.5, 19.4 105, 16 104 Z";

  // Knuckle + palm creases (stroke-only detail lines).
  const CREASES =
    "M 27 66 Q 30 67.6 33 66" +         // index mid-joint
    " M 47 64 Q 50 65.6 53 64" +        // middle
    " M 67 68.5 Q 70 70 73 68.5" +      // ring
    " M 87.4 74 Q 90 75.4 92.6 74" +    // pinky
    " M 8.5 81 Q 11.5 82.3 14 80.6" +   // thumb joint
    " M 27 97 Q 46 102 66 98";          // palm line
  // Sleeve cuff across the wrist (drawn on top, like the reference art).
  const CUFF = "M 22.6 101.6 C 42 104.6, 76 104.6, 95.4 101.6 L 93.2 107 L 24.8 107 Z";

  // Fingertip badge tops matching the artwork's finger pads
  // (finger number → y as % of keyboard height; x comes from the key center).
  const TIP = { 1: 75, 2: 56, 3: 54, 4: 61, 5: 69 };
  let uid = 0; // unique gradient id per rendered hand

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
        svg.setAttribute("viewBox", "0 0 100 107");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.left = left + "%";
        svg.style.width = (right - left) + "%";
        if (handKey === "left") svg.style.transform = "scaleX(-1)";
        // Soft skin gradient (lighter at the fingers, warmer at the palm).
        const gid = "hand-g" + (++uid);
        const defs = document.createElementNS(SVGNS, "defs");
        const grad = document.createElementNS(SVGNS, "linearGradient");
        grad.setAttribute("id", gid);
        grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
        grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
        [["0%", "rgba(242, 205, 170, 0.55)"], ["100%", "rgba(224, 168, 124, 0.55)"]].forEach(([off, col]) => {
          const stop = document.createElementNS(SVGNS, "stop");
          stop.setAttribute("offset", off); stop.setAttribute("stop-color", col);
          grad.appendChild(stop);
        });
        defs.appendChild(grad);
        svg.appendChild(defs);
        const piece = (d, cls, fill) => {
          const p = document.createElementNS(SVGNS, "path");
          p.setAttribute("d", d);
          p.setAttribute("class", cls);
          if (fill) p.setAttribute("fill", fill);
          p.setAttribute("vector-effect", "non-scaling-stroke");
          svg.appendChild(p);
        };
        piece(HAND_PATH, "hand-shape", "url(#" + gid + ")");
        piece(CREASES, "hand-crease");
        piece(CUFF, "hand-cuff");
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
