/* Simpli Piano — "which finger?" hands overlay (typing-tutor style).
 *
 * Draws two semi-transparent hands over the on-screen keyboard. Each hand is
 * built from separately-shaded parts — a palm plus five rounded, tapered
 * fingers, each with a cylindrical skin gradient (so it looks 3D, not flat)
 * and a fingernail — with a numbered badge on the fingertip of each key of the
 * current five-finger position, numbered the piano way (thumb = 1 … pinky = 5).
 * When the lesson/trainer highlights a target key, that whole finger glows.
 *
 * Usage:
 *   const hands = new window.Hands(keyboard, kbWrapEl);   // patches keyboard
 *   hands.set({ right: 60 });                  // RH thumb on C4 (C position)
 *   hands.set({ left: { pinky: 48 } });        // LH C position (pinky on C3)
 *   hands.set({ left: { thumb: 48 } });        // LH anchored by thumb (Free Play)
 *   hands.setOn(true/false);
 *
 * Geometry is computed in PIXELS at render time so finger proportions stay
 * natural at any keyboard size (bottom-anchored, height capped so tall Free
 * Play keys don't stretch the fingers into spindles). The artwork is authored
 * for the right hand and mirrored (scaleX) for the left. A ResizeObserver
 * re-draws on size change; keyboard.render() is patched to re-draw on range
 * change. Keys outside the five-finger span just get a badge, no silhouette. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const { isWhite } = window.Theory;

  // Badge tops (fraction of keyboard height) — sit on each finger's pad.
  const TIP = { 1: 0.75, 2: 0.55, 3: 0.53, 4: 0.60, 5: 0.68 };

  // Semi-transparent skin palette (keys read through the hand).
  const A = 0.76;
  const SKIN_EDGE = "rgba(193,137,96," + A + ")";   // shaded finger edge
  const SKIN_MID = "rgba(231,181,142," + A + ")";
  const SKIN_HI = "rgba(250,218,187," + A + ")";    // lit centre ridge
  const PALM_TOP = "rgba(244,203,167," + A + ")";
  const PALM_BOT = "rgba(214,159,116," + A + ")";

  let uid = 0; // unique gradient id per gradient

  function whitesFrom(midi, count, dir) {
    const out = [];
    let m = midi;
    while (out.length < count && m > 8 && m < 120) { if (isWhite(m)) out.push(m); m += dir; }
    return out;
  }

  // Lengthen fingers a touch when keys are wide vs. tall (natural reach).
  function stretchFor(sp, H) { return Math.min(Math.max(sp / (H * 0.55), 1), 1.4); }
  // A hand is never taller than ~3.2 key-widths — hug the bottom of tall keys.
  function handHeight(sp, H) { return Math.min(H, sp * 3.2); }

  /* Rounded, tapered finger from base (x0,y0,hw0) to a rounded tip
     (x1,y1,hw1). Returns the SVG path plus a gradient axis running ACROSS the
     finger at mid-length, which gives it a cylindrical (3D) shading. */
  function capsule(x0, y0, x1, y1, hw0, hw1) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;          // along (base → tip)
    const px = -uy, py = ux;                      // perpendicular unit
    const f = (a, b) => a.toFixed(1) + " " + b.toFixed(1);
    const aLx = x0 + px * hw0, aLy = y0 + py * hw0, aRx = x0 - px * hw0, aRy = y0 - py * hw0;
    const bLx = x1 + px * hw1, bLy = y1 + py * hw1, bRx = x1 - px * hw1, bRy = y1 - py * hw1;
    const clx = bLx + ux * hw1 * 1.33, cly = bLy + uy * hw1 * 1.33;
    const crx = bRx + ux * hw1 * 1.33, cry = bRy + uy * hw1 * 1.33;
    const path = "M " + f(aLx, aLy) + " L " + f(bLx, bLy)
      + " C " + f(clx, cly) + ", " + f(crx, cry) + ", " + f(bRx, bRy)
      + " L " + f(aRx, aRy) + " Z";
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, gw = (hw0 + hw1) / 2;
    return { path, g: [mx + px * gw, my + py * gw, mx - px * gw, my - py * gw], ux, uy };
  }

  /* Build one right hand for fingertip x-centres cx=[thumb..pinky], height H.
     Returns { parts:[{finger, body, nail}], palm, palmG, cr, cf }. */
  function buildHand(cx, H) {
    const n = (v) => (+v).toFixed(1);
    const [c1, c2, c3, c4, c5] = cx;
    const sp = (c5 - c1) / 4 || H * 0.4;
    const He = handHeight(sp, H);
    const Y = (fr) => H - He * (1 - fr);            // artwork fraction → px (bottom-anchored)
    const st = stretchFor(sp, He);
    const T = (fr) => (fr >= 0.88 ? fr : 1 - (1 - fr) * st); // stretch upper hand only

    const fw = Math.min(Math.max(sp * 0.17, He * 0.05), sp * 0.23, He * 0.11);
    const FING = [c2, c3, c4, c5];
    const tipFr = [0.505, 0.482, 0.556, 0.64];     // index, middle, ring, pinky tops
    const hwTip = [fw * 0.9, fw * 0.95, fw * 0.88, fw * 0.76];
    const hwBase = hwTip.map((v) => v * 1.3);
    const baseY = Y(0.885);

    const parts = [];
    for (let i = 0; i < 4; i++) {
      const x = FING[i], tip = Y(T(tipFr[i]));
      const cap = capsule(x, baseY, x, tip, hwBase[i], hwTip[i]);
      parts.push({ finger: i + 2, body: cap,
        nail: { cx: x, cy: tip + hwTip[i] * 1.15, rx: hwTip[i] * 0.6, ry: hwTip[i] * 0.92, rot: 0 } });
    }
    // Thumb: fat angled capsule from the palm's lower-right to the tip on c1.
    {
      const tipX = c1, tipY = Y(T(0.72));
      const bx = c2 - fw * 0.35, by = Y(0.965);
      const cap = capsule(bx, by, tipX, tipY, fw * 1.18, fw * 0.98);
      const ang = Math.atan2(tipY - by, tipX - bx) * 180 / Math.PI + 90;
      parts.push({ finger: 1, body: cap,
        nail: { cx: tipX + (bx - tipX) * 0.15, cy: tipY + (by - tipY) * 0.15,
          rx: fw * 0.6, ry: fw * 0.86, rot: ang } });
    }

    // Palm behind the fingers, with a thumb-side (thenar) bulge toward c1.
    const wr = c5 + fw * 1.5;
    const palm =
      "M " + n(c2 - fw * 1.15) + " " + n(Y(0.88))
      + " Q " + n((c2 + c3) / 2) + " " + n(Y(0.905)) + " " + n(c3) + " " + n(Y(0.885))
      + " Q " + n((c3 + c4) / 2) + " " + n(Y(0.905)) + " " + n(c4) + " " + n(Y(0.888))
      + " Q " + n((c4 + c5) / 2) + " " + n(Y(0.905)) + " " + n(c5) + " " + n(Y(0.892))
      + " C " + n(c5 + fw * 0.7) + " " + n(Y(0.868)) + ", " + n(wr) + " " + n(Y(0.89)) + ", " + n(wr) + " " + n(Y(0.955))
      + " C " + n(wr) + " " + n(Y(1.02)) + ", " + n(c3) + " " + n(Y(1.075)) + ", " + n((c1 + c2) / 2) + " " + n(Y(1.045))
      + " C " + n(c1 - fw * 0.3) + " " + n(Y(1.0)) + ", " + n(c1 - fw * 1.05) + " " + n(Y(0.95)) + ", " + n(c1 - fw * 0.7) + " " + n(Y(0.905))
      + " C " + n(c1) + " " + n(Y(0.858)) + ", " + n(c2 - fw * 1.45) + " " + n(Y(0.85)) + ", " + n(c2 - fw * 1.15) + " " + n(Y(0.88))
      + " Z";
    const palmG = [0, Y(0.85), 0, Y(1.05)];

    // Knuckle creases (small arcs mid-finger) + a palm crease.
    let cr = "";
    for (let i = 0; i < 4; i++) {
      const x = FING[i], tip = Y(T(tipFr[i])), cy = tip + (baseY - tip) * 0.42, hw = hwTip[i];
      cr += "M " + n(x - hw * 0.65) + " " + n(cy) + " Q " + n(x) + " " + n(cy + He * 0.015) + " " + n(x + hw * 0.65) + " " + n(cy) + " ";
    }
    cr += "M " + n(c2) + " " + n(Y(0.96)) + " Q " + n((c2 + c4) / 2) + " " + n(Y(0.998)) + " " + n(c4 + fw) + " " + n(Y(0.968));

    // Sleeve cuff at the wrist.
    const cf = "M " + n(c1 - fw * 0.2) + " " + n(Y(1.03))
      + " Q " + n(c3) + " " + n(Y(1.064)) + " " + n(wr) + " " + n(Y(1.03))
      + " L " + n(wr) + " " + n(Y(1.075))
      + " L " + n(c1 - fw * 0.2) + " " + n(Y(1.075)) + " Z";

    return { parts, palm, palmG, cr, cf };
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

      if (window.ResizeObserver) {
        let raf = null;
        this._ro = new ResizeObserver(() => {
          if (raf) return;
          raf = requestAnimationFrame(() => { raf = null; this.render(); });
        });
        this._ro.observe(this.overlay);
      }

      // Mirror the keyboard's highlight state onto the fingers, and re-draw
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

    /* mapping: { right: midi | {thumb: midi}, left: midi | {pinky|thumb: midi} } */
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

    setOn(on) { this.on = on; this.overlay.style.display = on ? "" : "none"; }

    render() {
      this.overlay.innerHTML = "";
      this.byMidi = new Map();
      this.hlByMidi = new Map();
      ["left", "right"].forEach((h) => this._renderHand(h));
      // Re-sync with the keyboard's current highlights so a re-render (resize,
      // range change) doesn't lose the lit finger mid-lesson.
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

      if (placed.length === 5) {
        const centers = placed.map((p) => ((p.r.leftPct + p.r.widthPct / 2) / 100) * W).sort((a, b) => a - b);
        const spanL = Math.min(...placed.map((p) => (p.r.leftPct / 100) * W));
        const spanW = Math.max(...placed.map((p) => ((p.r.leftPct + p.r.widthPct) / 100) * W)) - spanL;
        const cx = centers.map((c) => c - spanL);
        const model = buildHand(cx, H);
        const f2midi = {}; placed.forEach((p) => (f2midi[p.finger] = p.midi));

        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", "0 0 " + Math.ceil(spanW) + " " + Math.ceil(H * 1.08));
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.left = (spanL / W) * 100 + "%";
        svg.style.width = (spanW / W) * 100 + "%";
        if (handKey === "left") svg.style.transform = "scaleX(-1)";
        const defs = document.createElementNS(SVGNS, "defs");
        svg.appendChild(defs);

        const grad = (axis, stops) => {
          const id = "hg" + (++uid);
          const g = document.createElementNS(SVGNS, "linearGradient");
          g.setAttribute("id", id);
          g.setAttribute("gradientUnits", "userSpaceOnUse");
          g.setAttribute("x1", axis[0].toFixed(1)); g.setAttribute("y1", axis[1].toFixed(1));
          g.setAttribute("x2", axis[2].toFixed(1)); g.setAttribute("y2", axis[3].toFixed(1));
          stops.forEach(([o, c]) => {
            const s = document.createElementNS(SVGNS, "stop");
            s.setAttribute("offset", o); s.setAttribute("stop-color", c);
            g.appendChild(s);
          });
          defs.appendChild(g);
          return "url(#" + id + ")";
        };
        const addPath = (d, cls, fill) => {
          const p = document.createElementNS(SVGNS, "path");
          p.setAttribute("d", d); p.setAttribute("class", cls);
          if (fill) p.setAttribute("fill", fill);
          p.setAttribute("vector-effect", "non-scaling-stroke");
          svg.appendChild(p);
          return p;
        };
        const FINGER_STOPS = [["0%", SKIN_EDGE], ["28%", SKIN_MID], ["50%", SKIN_HI], ["72%", SKIN_MID], ["100%", SKIN_EDGE]];

        // Palm first (behind), then thumb, then fingers index→pinky on top.
        addPath(model.palm, "hand-shape", grad(model.palmG, [["0%", PALM_TOP], ["100%", PALM_BOT]]));
        [1, 2, 3, 4, 5].forEach((fn) => {
          const part = model.parts.find((p) => p.finger === fn);
          if (!part) return;
          addPath(part.body.path, "hand-shape", grad(part.body.g, FINGER_STOPS));
          const hp = addPath(part.body.path, "hand-fhl", null); // whole-finger glow
          this.hlByMidi.set(f2midi[fn], hp);
          const nl = document.createElementNS(SVGNS, "ellipse");
          nl.setAttribute("cx", part.nail.cx.toFixed(1)); nl.setAttribute("cy", part.nail.cy.toFixed(1));
          nl.setAttribute("rx", part.nail.rx.toFixed(1)); nl.setAttribute("ry", part.nail.ry.toFixed(1));
          nl.setAttribute("class", "hand-nail");
          if (part.nail.rot) nl.setAttribute("transform", "rotate(" + part.nail.rot.toFixed(1) + " " + part.nail.cx.toFixed(1) + " " + part.nail.cy.toFixed(1) + ")");
          svg.appendChild(nl);
        });
        addPath(model.cr, "hand-crease");
        addPath(model.cf, "hand-cuff");
        this.overlay.appendChild(svg);
      }

      // Number badges ride the fingertips (bottom-anchored, same stretch math).
      const keyW = (placed[0].r.widthPct / 100) * W;
      const He = handHeight(keyW, H);
      const st = stretchFor(keyW, He);
      placed.forEach(({ midi, finger, r }) => {
        const cxPct = r.leftPct + r.widthPct / 2;
        const wPx = Math.min((r.widthPct / 100) * W * 0.5, He * 0.11, 28);
        const tf = 1 - (1 - TIP[finger]) * st;
        const topPx = H - He * (1 - tf);
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
