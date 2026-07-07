/* Simpli Piano — "which finger?" hands overlay (typing-tutor style).
 *
 * Draws two semi-transparent cartoon hands over the on-screen keyboard — a
 * natural hand silhouette per hand (curved tapered fingers, opposed thumb,
 * knuckle/palm creases, palm + sleeve cuff), with a numbered fingertip badge
 * on each key of the current five-finger position, numbered the piano way
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
 * Geometry is computed in PIXELS at render time (not a stretched viewBox), so
 * finger proportions stay natural at any keyboard size: on wide keyboards the
 * fingers splay apart like a real stretched hand instead of distorting. The
 * silhouette is authored for the right hand and mirrored (scaleX) for the
 * left — the five keys are evenly spaced, so the span is mirror-symmetric.
 * A ResizeObserver re-draws on size changes; keyboard.render() is patched to
 * re-draw when the range changes. Keys outside the mapped five-finger span
 * simply get no finger. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const { isWhite } = window.Theory;

  // Fingertip TOP per finger (fraction of keyboard height): middle reaches
  // highest; pads land on the white-key touch area below the black keys.
  const TOPF = { 2: 0.504, 3: 0.484, 4: 0.555, 5: 0.64 };
  // Badge tops (fraction of keyboard height), matching the finger pads.
  const TIP = { 1: 0.75, 2: 0.56, 3: 0.54, 4: 0.61, 5: 0.69 };

  let uid = 0; // unique gradient id per rendered hand

  function whitesFrom(midi, count, dir) {
    const out = [];
    let m = midi;
    while (out.length < count && m > 8 && m < 120) { if (isWhite(m)) out.push(m); m += dir; }
    return out;
  }

  /* How much to lengthen the fingers when the keys are wide relative to the
     keyboard height — a hand reaching across wide keys looks stretched, not
     squashed. 1 = artwork proportions. */
  function stretchFor(sp, H) {
    return Math.min(Math.max(sp / (H * 0.55), 1), 1.4);
  }

  /* Build the right-hand silhouette in px. cx = 5 ascending fingertip x's
     (thumb..pinky for a right hand), H = keyboard height px. Returns path
     strings for the hand, the creases, and the cuff. */
  /* Natural hand height in px: a hand is never taller than ~3.2 key-widths,
     so on tall keyboards (Free Play) it hugs the bottom of the keys instead
     of stretching into long spindly fingers. */
  function handHeight(sp, H) {
    return Math.min(H, sp * 3.2);
  }

  function buildHand(cx, H) {
    const n = (v) => (+v).toFixed(1);
    const C = (a, b, c2, d, e2, f) => " C " + n(a) + " " + n(b) + ", " + n(c2) + " " + n(d) + ", " + n(e2) + " " + n(f);
    const k = 0.5523; // circle-approximation constant for rounded tips
    const [c1, c2, c3, c4, c5] = cx;
    const sp = (c5 - c1) / 4 || H * 0.4;               // key spacing
    const He = handHeight(sp, H);                      // hand's own height
    const Y = (f) => H - He * (1 - f);                 // artwork fraction → px, bottom-anchored
    const st = stretchFor(sp, He);
    // Raise upper-hand y-fractions (fingers/thumb) by the stretch factor;
    // the palm/valley/wrist zone (>= 0.87) stays anchored at the bottom.
    const T = (f) => (f >= 0.87 ? f : 1 - (1 - f) * st);
    // Finger half-width: proportional to hand height, never wide enough to
    // touch the neighbouring finger even on narrow keys.
    const fw = Math.min(Math.max(He * 0.055, sp * 0.14), sp * 0.34, He * 0.085);
    const hwT = [fw, fw * 1.05, fw * 0.95, fw * 0.85]; // tip half-widths (index..pinky)
    const hwB = hwT.map((v) => v * 1.22);              // base half-widths
    const r1 = fw * 1.2;                               // thumb radius
    const e = Math.min(fw * 1.6, sp * 0.35);           // outer palm margin
    const FING = [c2, c3, c4, c5];
    const TOPS = [TOPF[2], TOPF[3], TOPF[4], TOPF[5]].map((f) => Y(T(f)));
    const vy = [0.884, 0.888, 0.894].map((f) => Y(f)); // web valleys
    const yB = Y(1.07);                                // wrist bottom
    const wristL = c2 - sp * 0.7, wristR = c5 + e * 0.35;

    let d = "M " + n(wristL) + " " + n(Y(1.04));
    // outer palm edge up + thumb (tip centred on the thumb's key)
    d += C(c2 - sp * 0.8, Y(0.98), c1 - e * 0.8, Y(0.92), c1 - e, Y(T(0.86)));
    d += C(c1 - e - r1 * 0.2, Y(T(0.815)), c1 - r1 * 1.5, Y(T(0.79)), c1 - r1 * 1.45, Y(T(0.765)));
    d += C(c1 - r1 * 1.3, Y(T(0.716)), c1 - r1 * 0.35, Y(T(0.698)), c1 + r1 * 0.4, Y(T(0.712)));
    d += C(c1 + r1 * 0.95, Y(T(0.722)), c1 + r1 * 1.15, Y(T(0.748)), c1 + r1 * 1.05, Y(T(0.775)));
    d += C(c1 + r1 * 1.5, Y(T(0.83)), (c1 + c2) / 2, Y(0.9), c2 - hwB[0] * 1.05, Y(0.925));
    // index → pinky, webbed together
    for (let i = 0; i < 4; i++) {
      const x = FING[i], hb = hwB[i], ht = hwT[i], top = TOPS[i];
      const tipBase = top + ht;
      d += C(x - hb, Y(T(0.8)), x - ht, top + He * 0.16 * st, x - ht, tipBase); // left edge up
      d += C(x - ht, tipBase - k * ht, x - k * ht, top, x, top);                // rounded tip
      d += C(x + k * ht, top, x + ht, tipBase - k * ht, x + ht, tipBase);
      if (i < 3) {
        const nx = FING[i + 1], nhb = hwB[i + 1], vc = (x + nx) / 2, v = vy[i];
        d += C(x + ht, top + He * 0.16 * st, x + hb, v - He * 0.1, x + hb * 1.02, v - He * 0.035);
        d += C(x + hb * 1.3, v + He * 0.005, vc - fw * 0.5, v + He * 0.012, vc, v + He * 0.012);
        d += C(vc + fw * 0.5, v + He * 0.012, nx - nhb * 1.3, v + He * 0.005, nx - nhb * 1.02, v - He * 0.035);
      } else {
        d += C(x + ht, top + He * 0.16 * st, x + hb, Y(T(0.84)), x + hb * 1.02, Y(0.875));
      }
    }
    // outer palm right, down to the wrist
    d += C(c5 + e, Y(0.91), c5 + e * 1.05, Y(0.95), c5 + e * 0.85, Y(0.985));
    d += C(c5 + e * 0.6, Y(1.02), wristR, Y(1.045), wristR - e * 0.2, yB);
    d += " L " + n(wristL + sp * 0.06) + " " + n(yB);
    d += C(wristL + sp * 0.02, Y(1.058), wristL, Y(1.05), wristL, Y(1.04)) + " Z";

    // knuckle creases + thumb joint + palm line
    let cr = "";
    for (let i = 0; i < 4; i++) {
      const x = FING[i], ht = hwT[i], cy = TOPS[i] + He * 0.15;
      cr += "M " + n(x - ht * 0.7) + " " + n(cy) + " Q " + n(x) + " " + n(cy + He * 0.018) + " " + n(x + ht * 0.7) + " " + n(cy) + " ";
    }
    cr += "M " + n(c1 - r1 * 0.5) + " " + n(Y(T(0.82))) + " Q " + n(c1 + r1 * 0.4) + " " + n(Y(T(0.838))) + " " + n(c1 + r1 * 0.9) + " " + n(Y(T(0.82))) + " ";
    cr += "M " + n(c2) + " " + n(Y(0.962)) + " Q " + n((c2 + c4) / 2) + " " + n(Y(1.002)) + " " + n(c4 + hwB[2]) + " " + n(Y(0.965));

    // sleeve cuff across the wrist
    const cf = "M " + n(wristL - sp * 0.04) + " " + n(Y(1.012))
      + C((wristL + wristR) / 2 - sp * 0.2, Y(1.048), (wristL + wristR) / 2 + sp * 0.2, Y(1.048), wristR + e * 0.1, Y(1.012))
      + " L " + n(wristR - e * 0.2) + " " + n(yB)
      + " L " + n(wristL + sp * 0.06) + " " + n(yB) + " Z";

    // Per-finger highlight regions (finger number 1..5 → closed capsule that
    // lights up when that finger's key is the target).
    const hl = {};
    {
      // thumb: a tilted blob over the thumb artwork
      const cy = Y(T(0.745));
      hl[1] = "M " + n(c1 - r1 * 1.35) + " " + n(cy + r1 * 0.3)
        + C(c1 - r1 * 1.45, cy - r1 * 0.75, c1 - r1 * 0.5, cy - r1 * 1.25, c1 + r1 * 0.35, cy - r1 * 0.85)
        + C(c1 + r1 * 1.15, cy - r1 * 0.45, c1 + r1 * 1.35, cy + r1 * 0.55, c1 + r1 * 0.75, cy + r1 * 1.05)
        + C(c1 + r1 * 0.1, cy + r1 * 1.5, c1 - r1 * 1.1, cy + r1 * 1.15, c1 - r1 * 1.35, cy + r1 * 0.3) + " Z";
    }
    for (let i = 0; i < 4; i++) {
      const x = FING[i], hb = hwB[i], ht = hwT[i], top = TOPS[i];
      const tipBase = top + ht, base = Y(0.915);
      hl[i + 2] = "M " + n(x - hb) + " " + n(base)
        + C(x - hb, Y(T(0.8)), x - ht, top + He * 0.16 * st, x - ht, tipBase)
        + C(x - ht, tipBase - k * ht, x - k * ht, top, x, top)
        + C(x + k * ht, top, x + ht, tipBase - k * ht, x + ht, tipBase)
        + C(x + ht, top + He * 0.16 * st, x + hb, Y(T(0.8)), x + hb, base)
        + C(x + hb * 0.6, base + He * 0.03, x - hb * 0.6, base + He * 0.03, x - hb, base) + " Z";
    }

    return { d, cr, cf, hl };
  }

  class Hands {
    constructor(keyboard, wrapEl) {
      this.kb = keyboard;
      this.wrap = wrapEl;
      this.map = {};            // "left"/"right" -> [{midi, finger}]
      this.byMidi = new Map();  // midi -> fingertip badge element
      this.hlByMidi = new Map();// midi -> whole-finger highlight path
      this.on = true;

      this.overlay = document.createElement("div");
      this.overlay.className = "hands-overlay";
      wrapEl.classList.add("has-hands");
      wrapEl.appendChild(this.overlay);

      // Geometry is in px → re-draw when the keyboard's box changes size.
      if (window.ResizeObserver) {
        let raf = null;
        this._ro = new ResizeObserver(() => {
          if (raf) return;
          raf = requestAnimationFrame(() => { raf = null; this.render(); });
        });
        this._ro.observe(this.overlay);
      }

      // Mirror the keyboard's visual state onto the fingertips, and re-draw
      // whenever the keyboard re-renders (range/size change).
      const kb = this.kb;
      const origHi = kb.highlight.bind(kb), origClear = kb.clearHighlights.bind(kb);
      const origFlash = kb.flash.bind(kb), origRender = kb.render.bind(kb);
      kb.highlight = (midis, cls) => {
        origHi(midis, cls);
        (Array.isArray(midis) ? midis : [midis]).forEach((m) => {
          const c = cls === "hint" ? "active" : "good";
          const tip = this.byMidi.get(m), fin = this.hlByMidi.get(m);
          if (tip) tip.classList.add(c);
          if (fin) fin.classList.add(c);
        });
      };
      kb.clearHighlights = () => {
        origClear();
        this.byMidi.forEach((tip) => tip.classList.remove("active", "good"));
        this.hlByMidi.forEach((fin) => fin.classList.remove("active", "good"));
      };
      kb.flash = (m, cls, ms = 220) => {
        origFlash(m, cls, ms);
        if (cls !== "good") return;
        [this.byMidi.get(m), this.hlByMidi.get(m)].forEach((el2) => {
          if (el2) { el2.classList.add("good"); setTimeout(() => el2.classList.remove("good"), ms); }
        });
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
      this.hlByMidi = new Map();
      ["left", "right"].forEach((h) => this._renderHand(h));
      // Re-sync with the keyboard's current highlights — a re-render (resize,
      // range change) must not lose the lit finger mid-lesson.
      this.kb.keyEls.forEach((keyEl, m) => {
        const cls = keyEl.classList.contains("hl-hint") ? "active"
          : keyEl.classList.contains("hl-good") ? "good" : null;
        if (!cls) return;
        const tip = this.byMidi.get(m), fin = this.hlByMidi.get(m);
        if (tip) tip.classList.add(cls);
        if (fin) fin.classList.add(cls);
      });
    }

    _renderHand(handKey) {
      const fingers = this.map[handKey];
      if (!fingers || !fingers.length) return;
      const W = this.overlay.clientWidth, H = this.overlay.clientHeight;
      if (!W || !H) return;
      const placed = [];
      fingers.forEach(({ midi, finger }) => {
        const r = this.kb.keyRect(midi);
        if (r) placed.push({ midi, finger, r });
      });
      if (!placed.length) return;

      // The silhouette needs all five keys on screen (it spans them); with
      // fewer visible we still show the number badges.
      if (placed.length === 5) {
        const centers = placed.map((p) => ((p.r.leftPct + p.r.widthPct / 2) / 100) * W).sort((a, b) => a - b);
        const spanL = Math.min(...placed.map((p) => (p.r.leftPct / 100) * W));
        const spanW = Math.max(...placed.map((p) => ((p.r.leftPct + p.r.widthPct) / 100) * W)) - spanL;
        // Ascending centers relative to the span; the grid is uniform, so the
        // same numbers serve the mirrored left hand.
        const cx = centers.map((c) => c - spanL);
        const { d, cr, cf, hl } = buildHand(cx, H);

        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", "0 0 " + Math.ceil(spanW) + " " + Math.ceil(H * 1.07));
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.left = (spanL / W) * 100 + "%";
        svg.style.width = (spanW / W) * 100 + "%";
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
        const piece = (path, cls, fill) => {
          const p = document.createElementNS(SVGNS, "path");
          p.setAttribute("d", path);
          p.setAttribute("class", cls);
          if (fill) p.setAttribute("fill", fill);
          p.setAttribute("vector-effect", "non-scaling-stroke");
          svg.appendChild(p);
        };
        piece(d, "hand-shape", "url(#" + gid + ")");
        piece(cr, "hand-crease");
        piece(cf, "hand-cuff");
        // Whole-finger highlight regions on top of the artwork (finger k → its key).
        placed.forEach(({ midi, finger }) => {
          if (!hl[finger]) return;
          const p = document.createElementNS(SVGNS, "path");
          p.setAttribute("d", hl[finger]);
          p.setAttribute("class", "hand-fhl");
          svg.appendChild(p);
          this.hlByMidi.set(midi, p);
        });
        this.overlay.appendChild(svg);
      }

      // Badges ride the fingertips — same bottom-anchored, stretched math
      // as the silhouette so they stay on the finger pads.
      const keyW = (placed[0].r.widthPct / 100) * W;
      const He = handHeight(keyW, H);
      const st = stretchFor(keyW, He);
      placed.forEach(({ midi, finger, r }) => {
        const cxPct = r.leftPct + r.widthPct / 2;
        const wPx = Math.min((r.widthPct / 100) * W * 0.52, He * 0.115, 30);
        const tf = 1 - (1 - TIP[finger]) * st;         // stretched artwork fraction
        const topPx = H - He * (1 - tf);               // bottom-anchored
        const tip = document.createElement("div");
        tip.className = "hand-tip";
        tip.textContent = finger;
        tip.style.left = cxPct + "%";
        tip.style.width = wPx + "px";
        tip.style.top = (topPx / H) * 100 + "%";
        this.overlay.appendChild(tip);
        this.byMidi.set(midi, tip);
      });
    }
  }

  window.Hands = Hands;
})();
