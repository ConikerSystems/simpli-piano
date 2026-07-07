/* Simpli Piano — "which finger?" hands overlay (typing-tutor style).
 *
 * Draws two semi-transparent cartoon hands over the on-screen keyboard, one
 * fingertip per key of the current five-finger position, numbered the piano
 * way (thumb = 1 … pinky = 5). When the lesson/trainer highlights a target
 * key, the matching fingertip lights up as well.
 *
 * Usage:
 *   const hands = new window.Hands(keyboard, kbWrapEl);   // patches keyboard
 *   hands.set({ right: 60 });                  // RH thumb on C4 (C position)
 *   hands.set({ left: { pinky: 48 } });        // LH C position (pinky on C3)
 *   hands.set({ left: { thumb: 48 } });        // LH anchored by thumb (Free Play)
 *   hands.setOn(true/false);
 *
 * Positions are % of keyboard width/height so no relayout is needed on
 * resize; keyboard.render() is patched to re-draw when the range changes.
 * Keys outside the mapped five-finger span simply get no finger. */
(() => {
  "use strict";

  const { isWhite } = window.Theory;

  // Fingertip height per finger number (% from keyboard top — middle reaches highest).
  const TIP_TOP = { 1: 64, 2: 46, 3: 40, 4: 46, 5: 54 };

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
      this.byMidi = new Map();  // midi -> fingertip element
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
        if (!r) return; // key not on screen — no finger for it
        const cx = r.leftPct + r.widthPct / 2;
        const fw = Math.min(r.widthPct * 0.56, 4.6); // finger width, % of kb width
        const top = TIP_TOP[finger];
        const f = document.createElement("div");
        f.className = "hand-finger" + (finger === 1 ? " thumb " + handKey : "");
        f.style.left = (cx - fw / 2) + "%";
        f.style.width = fw + "%";
        f.style.top = top + "%";
        const tip = document.createElement("div");
        tip.className = "hand-tip";
        tip.textContent = finger;
        f.appendChild(tip);
        this.overlay.appendChild(f);
        this.byMidi.set(midi, tip);
        placed.push({ cx, fw });
      });
      if (!placed.length) return;
      const lo = Math.min(...placed.map((p) => p.cx)), hi = Math.max(...placed.map((p) => p.cx));
      const pad = placed[0].fw * 1.1;
      const palm = document.createElement("div");
      palm.className = "hand-palm";
      palm.style.left = (lo - pad) + "%";
      palm.style.width = (hi - lo + pad * 2) + "%";
      this.overlay.appendChild(palm);
    }
  }

  window.Hands = Hands;
})();
