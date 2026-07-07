/* Simpli Piano — "which finger?" hands overlay (typing-tutor style).
 *
 * Draws two semi-transparent cartoon hands over the on-screen keyboard. Each
 * hand is ONE continuous silhouette — fingers emerge from the hand through
 * webbed valleys along an arched knuckle line, the thumb is a bent, angled
 * digit off the palm's side, and the pinky edge flows straight into the palm
 * and wrist (no shelf) — plus fingernails, knuckle/palm creases and a sleeve
 * cuff. A numbered badge rides each fingertip, numbered the piano way
 * (thumb = 1 … pinky = 5). When the lesson/trainer highlights a target key,
 * that whole finger glows.
 *
 * Usage:
 *   const hands = new window.Hands(keyboard, kbWrapEl);   // patches keyboard
 *   hands.set({ right: 60 });                  // RH thumb on C4 (C position)
 *   hands.set({ left: { pinky: 48 } });        // LH C position (pinky on C3)
 *   hands.set({ left: { thumb: 48 } });        // LH anchored by thumb (Free Play)
 *   hands.setOn(true/false);
 *
 * Geometry is computed in PIXELS at render time so proportions stay natural at
 * any keyboard size (bottom-anchored, height capped at ~3.2 key-widths so tall
 * Free Play keys don't stretch the fingers into spindles). The artwork is
 * authored for the right hand on a 0–100 × 0–112 grid (finger centers at
 * x = 10/30/50/70/90, i.e. key spacing 20) and mirrored via scaleX(-1) for the
 * left. A ResizeObserver re-draws on size change; keyboard.render() is patched
 * to re-draw on range change. Keys outside the five-finger span just get a
 * badge, no silhouette. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const { isWhite } = window.Theory;

  // Badge tops (fraction of hand height) — sit on each finger's pad.
  const TIP = { 1: 0.70, 2: 0.48, 3: 0.43, 4: 0.48, 5: 0.58 };

  // Semi-transparent skin palette (keys read through the hand).
  const A = 0.78;
  const SKIN_TOP = "rgba(246,212,180," + A + ")";
  const SKIN_MID = "rgba(236,190,152," + A + ")";
  const SKIN_BOT = "rgba(216,162,120," + A + ")";

  let uid = 0; // unique gradient id per gradient

  function whitesFrom(midi, count, dir) {
    const out = [];
    let m = midi;
    while (out.length < count && m > 8 && m < 120) { if (isWhite(m)) out.push(m); m += dir; }
    return out;
  }

  // Lengthen fingers a touch when keys are wide vs. tall (natural reach).
  function stretchFor(sp, H) { return Math.min(Math.max(sp / (H * 0.55), 1), 1.4); }
  // A hand is never taller than ~3.2 key-widths, but it MAY run a bit taller
  // than the keyboard strip — the palm/wrist hangs below the keys, like a real
  // hand resting on them (the reference art crops hands at the screen edge).
  function handHeight(sp, H) { return Math.min(H * 1.12, sp * 3.2); }

  /* Build one right hand. cx = the 5 ascending fingertip x-centers in px
     (thumb..pinky), H = keyboard height px. Returns { d, nails, cr, cf, hl }. */
  function buildHand(cx, H) {
    const [c1, c2, c3, c4, c5] = cx;
    const sp = (c5 - c1) / 4 || H * 0.4;
    const He = handHeight(sp, H);
    const Y = (fr) => H - He * (1 - fr);          // hand fraction → px (bottom-anchored)
    const st = stretchFor(sp, He);
    // Artwork y (0–112) → px; the upper hand stretches on wide keys, the
    // palm/wrist zone stays anchored at the bottom.
    const ys = (v) => { const fr = v / 112; return Y(fr >= 0.875 ? fr : 1 - (1 - fr) * st); };
    // Width unit: artwork widths are authored for key spacing 20; cap by hand
    // height so fingers stay in proportion on wide, short keyboards.
    const u = Math.min(sp / 20, (He / 112) * 1.75);
    // Structural x authored on the spacing-20 grid (c1 sits at artwork x 10).
    const X = (xa) => c1 + (xa - 10) * sp / 20;

    const n = (v) => (+v).toFixed(1);
    const P = (x, y) => n(x) + " " + n(y);
    const C = (x1, y1, x2, y2, x, y) => " C " + P(x1, y1) + ", " + P(x2, y2) + ", " + P(x, y);

    // Finger parameters: index, middle (longest), ring, pinky (short + low).
    const FC = [c2, c3, c4, c5];
    const TIPY = [48, 43, 48.5, 59.5];
    const HWT = [5.2, 5.4, 5.0, 4.4].map((v) => v * u);
    const HWB = HWT.map((v) => v * 1.15);
    const VY = [84.4, 85.2, 86.6];                 // web valley bottoms (low knuckle line)
    const VX = [(c2 + c3) / 2, (c3 + c4) / 2, (c4 + c5) / 2];
    const wristL = X(21), wristR = c5 + 2.0 * u;

    // ---- Unified silhouette (clockwise from the left wrist corner) ----
    let d = "M " + P(wristL, ys(108));
    // palm left edge rising to the thumb's root
    d += C(X(19), ys(103), X(16.5), ys(99), X(15), ys(95.5));
    // thumb outer edge — S-curve with a visible bend at the base joint
    d += C(X(12), ys(92), c1 - 4.5 * u, ys(86.5), c1 - 5.5 * u, ys(81.5));
    d += C(c1 - 5.9 * u, ys(79), c1 - 5.9 * u, ys(76.5), c1 - 4.6 * u, ys(74.4));
    // rounded, tilted thumb tip (pad centred on its key)
    d += C(c1 - 3.4 * u, ys(71.6), c1 + 0.4 * u, ys(70.6), c1 + 3.0 * u, ys(72.4));
    // inner thumb edge back down, then the thumb–index web
    d += C(c1 + 4.8 * u, ys(73.8), c1 + 5.3 * u, ys(76.4), c1 + 4.7 * u, ys(79));
    d += C(c1 + 6.4 * u, ys(85.5), X(20.4), ys(88.5), c2 - HWB[0] - 0.2 * u, ys(90));
    // index finger: bowed left edge up, rounded tip, right edge into web 1
    d += C(c2 - HWB[0] - 0.4 * u, ys(83), c2 - HWB[0], ys(66), c2 - HWT[0], ys(TIPY[0] + 5.2));
    d += C(c2 - HWT[0], ys(TIPY[0] + 1.7), c2 - HWT[0] * 0.67, ys(TIPY[0] - 0.2), c2, ys(TIPY[0] - 0.2));
    d += C(c2 + HWT[0] * 0.67, ys(TIPY[0] - 0.2), c2 + HWT[0], ys(TIPY[0] + 1.7), c2 + HWT[0], ys(TIPY[0] + 5.2));
    d += C(c2 + HWT[0] + 0.6 * u, ys(66), c2 + HWB[0], ys(77), c2 + HWB[0] + 0.4 * u, ys(81.4));
    // web valley 1 — a smooth U spanning the whole gap (no flat deck)
    let gL = VX[0] - (c2 + HWB[0]), gR = (c3 - HWB[1]) - VX[0];
    d += C(c2 + HWB[0] + gL * 0.4, ys(VY[0] - 0.8), VX[0] - gL * 0.35, ys(VY[0]), VX[0], ys(VY[0]));
    d += C(VX[0] + gR * 0.35, ys(VY[0]), c3 - HWB[1] - gR * 0.4, ys(VY[0] - 0.8), c3 - HWB[1] - 0.2 * u, ys(81.4));
    // middle finger
    d += C(c3 - HWB[1], ys(64), c3 - HWB[1] + 0.2 * u, ys(58), c3 - HWT[1], ys(TIPY[1] + 5.4));
    d += C(c3 - HWT[1], ys(TIPY[1] + 1.7), c3 - HWT[1] * 0.67, ys(TIPY[1] - 0.2), c3, ys(TIPY[1] - 0.2));
    d += C(c3 + HWT[1] * 0.67, ys(TIPY[1] - 0.2), c3 + HWT[1], ys(TIPY[1] + 1.7), c3 + HWT[1], ys(TIPY[1] + 5.4));
    d += C(c3 + HWT[1] + 0.6 * u, ys(64), c3 + HWB[1], ys(79), c3 + HWB[1] + 0.4 * u, ys(82.2));
    // web valley 2
    gL = VX[1] - (c3 + HWB[1]); gR = (c4 - HWB[2]) - VX[1];
    d += C(c3 + HWB[1] + gL * 0.4, ys(VY[1] - 0.8), VX[1] - gL * 0.35, ys(VY[1]), VX[1], ys(VY[1]));
    d += C(VX[1] + gR * 0.35, ys(VY[1]), c4 - HWB[2] - gR * 0.4, ys(VY[1] - 0.8), c4 - HWB[2] - 0.2 * u, ys(82.2));
    // ring finger
    d += C(c4 - HWB[2], ys(72), c4 - HWB[2] + 0.2 * u, ys(62), c4 - HWT[2], ys(TIPY[2] + 5));
    d += C(c4 - HWT[2], ys(TIPY[2] + 1.4), c4 - HWT[2] * 0.67, ys(TIPY[2] - 0.5), c4, ys(TIPY[2] - 0.5));
    d += C(c4 + HWT[2] * 0.67, ys(TIPY[2] - 0.5), c4 + HWT[2], ys(TIPY[2] + 1.4), c4 + HWT[2], ys(TIPY[2] + 5));
    d += C(c4 + HWT[2] + 0.5 * u, ys(68), c4 + HWB[2], ys(81.5), c4 + HWB[2] + 0.4 * u, ys(83.8));
    // web valley 3
    gL = VX[2] - (c4 + HWB[2]); gR = (c5 - HWB[3]) - VX[2];
    d += C(c4 + HWB[2] + gL * 0.4, ys(VY[2] - 0.8), VX[2] - gL * 0.35, ys(VY[2]), VX[2], ys(VY[2]));
    d += C(VX[2] + gR * 0.35, ys(VY[2]), c5 - HWB[3] - gR * 0.4, ys(VY[2] - 0.8), c5 - HWB[3] - 0.2 * u, ys(83.8));
    // pinky — short and low
    d += C(c5 - HWB[3], ys(77.5), c5 - HWB[3] + 0.2 * u, ys(71), c5 - HWT[3], ys(TIPY[3] + 4.4));
    d += C(c5 - HWT[3], ys(TIPY[3] + 1.3), c5 - HWT[3] * 0.64, ys(TIPY[3] - 0.4), c5, ys(TIPY[3] - 0.4));
    d += C(c5 + HWT[3] * 0.64, ys(TIPY[3] - 0.4), c5 + HWT[3], ys(TIPY[3] + 1.3), c5 + HWT[3], ys(TIPY[3] + 4.4));
    // pinky outer edge flows continuously into the palm's right side + wrist
    d += C(c5 + 5.2 * u, ys(72.5), c5 + 6.2 * u, ys(80), c5 + 6.8 * u, ys(85));
    d += C(c5 + 7.6 * u, ys(89), c5 + 7.4 * u, ys(95), c5 + 6.0 * u, ys(99.5));
    d += C(c5 + 5.0 * u, ys(103.5), c5 + 3.4 * u, ys(106.5), wristR, ys(108));
    // softly sagging wrist bottom, back to the start
    d += C(wristR - (wristR - wristL) * 0.25, ys(111), wristL + (wristR - wristL) * 0.25, ys(111), wristL, ys(108));
    d += " Z";

    // ---- Fingernails (thumb's is rotated with the thumb's tilt) ----
    const nails = [];
    for (let i = 0; i < 4; i++) {
      nails.push({ cx: FC[i], cy: ys(TIPY[i] + 3.4), rx: HWT[i] * 0.55, ry: HWT[i] * 0.75, rot: 0 });
    }
    nails.push({ cx: c1 - 0.2 * u, cy: ys(74.8), rx: 2.9 * u, ry: 3.9 * u, rot: -42 });

    // ---- Creases: knuckles ×2 per finger, thumb bend, palm, metacarpals ----
    let cr = "";
    const arc = (x, y, hw, sag) =>
      "M " + P(x - hw, ys(y)) + " Q " + P(x, ys(y + sag)) + " " + P(x + hw, ys(y)) + " ";
    for (let i = 0; i < 4; i++) {
      cr += arc(FC[i], TIPY[i] + 16, HWT[i] * 0.62, 1.8);
      cr += arc(FC[i], TIPY[i] + 7.5, HWT[i] * 0.5, 1.4);
    }
    cr += "M " + P(c1 + 0.5 * u, ys(80.2)) + " Q " + P(c1 + 2.4 * u, ys(82)) + " " + P(c1 + 4.4 * u, ys(81)) + " ";
    cr += "M " + P(X(26), ys(96)) + " Q " + P(X(45), ys(101.5)) + " " + P(X(72), ys(97.5)) + " ";
    VX.forEach((vx, i) => {
      cr += "M " + P(vx, ys(VY[i] + 1.2)) + " Q " + P(vx - 0.5 * u, ys(VY[i] + 4.5)) + " " + P(vx - 1.0 * u, ys(VY[i] + 7)) + " ";
    });

    // ---- Sleeve cuff across the wrist ----
    const cf = "M " + P(wristL - 1.0 * u, ys(104.5))
      + " Q " + P(X(56), ys(108.8)) + " " + P(wristR + 0.6 * u, ys(104.5))
      + " L " + P(wristR + 0.4 * u, ys(112))
      + " L " + P(wristL - 0.8 * u, ys(112)) + " Z";

    // ---- Whole-finger glow regions (finger number → closed path) ----
    const hl = {};
    for (let i = 0; i < 4; i++) {
      const x = FC[i], ht = HWT[i], hb = HWB[i], tip = TIPY[i];
      hl[i + 2] = "M " + P(x - hb, ys(90.5))
        + C(x - hb, ys(72), x - hb + 0.2 * u, ys(60), x - ht, ys(tip + 5))
        + C(x - ht, ys(tip + 1.6), x - ht * 0.67, ys(tip - 0.2), x, ys(tip - 0.2))
        + C(x + ht * 0.67, ys(tip - 0.2), x + ht, ys(tip + 1.6), x + ht, ys(tip + 5))
        + C(x + ht, ys(60), x + hb, ys(72), x + hb, ys(90.5))
        + C(x + hb * 0.6, ys(93.5), x - hb * 0.6, ys(93.5), x - hb, ys(90.5)) + " Z";
    }
    hl[1] = "M " + P(c1 - 5.5 * u, ys(81.5))
      + C(c1 - 5.9 * u, ys(76.5), c1 - 4.6 * u, ys(72.4), c1 - 3.4 * u, ys(71.2))
      + C(c1 - 1.4 * u, ys(69.8), c1 + 1.4 * u, ys(70), c1 + 3.0 * u, ys(72.4))
      + C(c1 + 4.8 * u, ys(74.6), c1 + 5.3 * u, ys(78), c1 + 4.2 * u, ys(81))
      + C(c1 + 3.0 * u, ys(84.2), c1 - 2.5 * u, ys(85.4), c1 - 4.4 * u, ys(84))
      + C(c1 - 5.3 * u, ys(83.2), c1 - 5.4 * u, ys(82.4), c1 - 5.5 * u, ys(81.5)) + " Z";

    return { d, nails, cr, cf, hl, He, st };
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
        // Headroom above the keys (tall hands) + room below for the wrist.
        svg.setAttribute("viewBox", "0 " + (-Math.ceil(H * 0.15)) + " " + Math.ceil(spanW) + " " + Math.ceil(H * 1.23));
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.top = "-15%";
        svg.style.height = "123%";
        svg.style.left = (spanL / W) * 100 + "%";
        svg.style.width = (spanW / W) * 100 + "%";
        if (handKey === "left") svg.style.transform = "scaleX(-1)";
        const defs = document.createElementNS(SVGNS, "defs");
        svg.appendChild(defs);

        // One soft vertical skin gradient across the whole hand.
        const gid = "hg" + (++uid);
        const g = document.createElementNS(SVGNS, "linearGradient");
        g.setAttribute("id", gid);
        g.setAttribute("gradientUnits", "userSpaceOnUse");
        g.setAttribute("x1", "0"); g.setAttribute("y1", (H - model.He).toFixed(1));
        g.setAttribute("x2", "0"); g.setAttribute("y2", H.toFixed(1));
        [["0%", SKIN_TOP], ["55%", SKIN_MID], ["100%", SKIN_BOT]].forEach(([o, c]) => {
          const s = document.createElementNS(SVGNS, "stop");
          s.setAttribute("offset", o); s.setAttribute("stop-color", c);
          g.appendChild(s);
        });
        defs.appendChild(g);

        const addPath = (dd, cls, fill) => {
          const p = document.createElementNS(SVGNS, "path");
          p.setAttribute("d", dd); p.setAttribute("class", cls);
          if (fill) p.setAttribute("fill", fill);
          p.setAttribute("vector-effect", "non-scaling-stroke");
          svg.appendChild(p);
          return p;
        };
        addPath(model.d, "hand-shape", "url(#" + gid + ")");
        model.nails.forEach((nl) => {
          const e2 = document.createElementNS(SVGNS, "ellipse");
          e2.setAttribute("cx", nl.cx.toFixed(1)); e2.setAttribute("cy", nl.cy.toFixed(1));
          e2.setAttribute("rx", nl.rx.toFixed(1)); e2.setAttribute("ry", nl.ry.toFixed(1));
          e2.setAttribute("class", "hand-nail");
          if (nl.rot) e2.setAttribute("transform", "rotate(" + nl.rot + " " + nl.cx.toFixed(1) + " " + nl.cy.toFixed(1) + ")");
          svg.appendChild(e2);
        });
        addPath(model.cr, "hand-crease");
        addPath(model.cf, "hand-cuff");
        // Whole-finger glow regions on top (finger n → its key's midi).
        Object.entries(model.hl).forEach(([fn, dd]) => {
          const midi = f2midi[fn];
          if (midi == null) return;
          const p = addPath(dd, "hand-fhl", null);
          this.hlByMidi.set(midi, p);
        });
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
