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
  const TIP = { 1: 0.70, 2: 0.50, 3: 0.42, 4: 0.46, 5: 0.61 };

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
     (thumb..pinky), H = keyboard height px. Returns { d, nails, cr, cf, hl }.

     Anatomy model: the four fingers FAN OUT from knuckles that sit closer
     together than the fingertips (bases pulled ~22% toward the palm centre),
     and each finger is gently BENT along its length (a lateral bow toward the
     hand's centre, strongest away from the middle finger). The thumb is a
     long, broad digit rooted down by the wrist, reaching diagonally to its
     key, separated from the index by a deep notch. */
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
    const Pt = (p) => P(p[0], p[1]);
    const C = (x1, y1, x2, y2, x, y) => " C " + P(x1, y1) + ", " + P(x2, y2) + ", " + P(x, y);
    const Cp = (a, b, c) => " C " + Pt(a) + ", " + Pt(b) + ", " + Pt(c);

    /* One digit: base (bx,by) → tip pad (tx,ty), half-widths hwB/hwT, and a
       lateral bend (px units, + = geometric right). Returns edge/cap path
       segments, endpoints, a closed outline (for the glow), nail + creases. */
    function digit(bx, by, tx, ty, hwB, hwT, bend) {
      const dxv = tx - bx, dyv = ty - by, len = Math.hypot(dxv, dyv) || 1;
      const ux = dxv / len, uy = dyv / len;
      const px = -uy, py = ux;                    // always the geometric right here
      const off = (x, y, s) => [x + px * s, y + py * s];
      const along = (x, y, s) => [x + ux * s, y + uy * s];
      const baseR = off(bx, by, hwB), baseL = off(bx, by, -hwB);
      const tipR = off(tx, ty, hwT), tipL = off(tx, ty, -hwT);
      const apex = along(tx, ty, hwT * 1.05);
      const bX = px * bend, bY = py * bend;       // lateral bend vector
      // left edge up (with the bend bowing the shaft), rounded cap, right edge down
      const eL = Cp([baseL[0] + ux * len * 0.34 + bX, baseL[1] + uy * len * 0.34 + bY],
                    [tipL[0] - ux * len * 0.26 + bX * 0.55, tipL[1] - uy * len * 0.26 + bY * 0.55], tipL);
      const cap = Cp(along(tipL[0], tipL[1], hwT * 0.6), [apex[0] - px * hwT * 0.58, apex[1] - py * hwT * 0.58], apex)
                + Cp([apex[0] + px * hwT * 0.58, apex[1] + py * hwT * 0.58], along(tipR[0], tipR[1], hwT * 0.6), tipR);
      const eR = Cp([tipR[0] - ux * len * 0.26 + bX * 0.55, tipR[1] - uy * len * 0.26 + bY * 0.55],
                    [baseR[0] + ux * len * 0.34 + bX, baseR[1] + uy * len * 0.34 + bY], baseR);
      const closed = "M " + Pt(baseL) + eL + cap + eR + " Z";
      const nc = along(tx, ty, hwT * 0.15);
      const nail = { cx: nc[0], cy: nc[1], rx: hwT * 0.55, ry: hwT * 0.8,
        rot: Math.atan2(uy, ux) * 180 / Math.PI + 90 };
      let creases = "";
      [0.46, 0.7].forEach((t) => {
        const w = (hwB + (hwT - hwB) * t) * 0.62;
        const mx = bx + dxv * t + px * bend * Math.sin(Math.PI * t);
        const my = by + dyv * t + py * bend * Math.sin(Math.PI * t);
        const a = off(mx, my, -w), b = off(mx, my, w);
        creases += "M " + Pt(a) + " Q " + P(mx + ux * 1.8, my + uy * 1.8) + " " + Pt(b) + " ";
      });
      return { baseL, baseR, eL, cap, eR, closed, nail, creases };
    }

    // Knuckles fan toward the palm centre; tips stay on their key centres.
    const pcx = (c2 + c5) / 2 - 0.04 * (c5 - c2);
    const FC = [c2, c3, c4, c5];
    // Distinct natural lengths (lower y = taller): middle longest, then ring,
    // then index, pinky clearly shortest.
    const TIPY = [49, 41, 45, 61];
    const HWT = [5.2, 5.5, 5.0, 4.1].map((v) => v * u);
    // Base a bit wider than the tip (knuckle), but the PINKY barely so — its
    // outer base is exposed (no finger to its right) and a wide base read as a
    // lump/growth beside finger 5.
    const HWB = HWT.map((v, i) => v * (i === 3 ? 1.04 : 1.28));
    const baseY = ys(89), valleyY = ys(91.2);
    const digits = [];
    for (let i = 0; i < 4; i++) {
      const fcx = FC[i];
      const bx = fcx + (pcx - fcx) * 0.22;
      // Gentle lateral bow toward the hand centre — least on the middle finger,
      // softened overall so nothing hooks unnaturally (the pinky looked odd).
      const bend = Math.max(-1.15, Math.min(1.15, (pcx - fcx) / sp)) * 0.8 * u;
      digits.push(digit(bx, baseY, fcx, ys(TIPY[i] + 4), HWB[i], HWT[i], bend));
    }

    // The pinky's knuckles fan toward the palm centre, so its base sits LEFT of
    // its tip. The hand's outer edge below the pinky must follow THAT base, not
    // c5 — anchoring to it kills the lobe that read as a stubbed 6th finger.
    const pbr = digits[3].baseR;                 // pinky base, outer (right) corner
    const wristL = X(21), wristR = Math.min(c5 + 2.0 * u, pbr[0] - 2.5 * u);

    // ---- Thumb — a dedicated BENT digit with a fat pad, drawn as its own
    // piece over the lower-left palm. A symmetric capsule reads as a stubby
    // finger; a real thumb has a wide base, an outer knuckle bulge, a hook,
    // and a broad rounded pad. Tip pad sits on the c1 key. ----
    const thumb = (() => {
      // TWO-segment bent digit: a long shaft from deep in the palm up to the
      // MCP knuckle, then a shorter distal segment hooking to the fat pad on
      // the c1 key. The knuckle is offset OUTWARD from the straight base→tip
      // line, so the thumb has a real bend (not just a width bulge).
      const B = [X(26), ys(101)];    // root, deep in the palm
      const K = [X(13), ys(89)];     // MCP knuckle — bowed outward (left)
      const T = [c1 + 0.6 * u, ys(80.5)]; // pad centre, on the c1 key
      const seg = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        return { ux: dx / L, uy: dy / L, px: -dy / L, py: dx / L, L }; };
      const s1 = seg(B, K), s2 = seg(K, T);
      let bpx = s1.px + s2.px, bpy = s1.py + s2.py;      // bisector perpendicular at the knuckle
      const bl = Math.hypot(bpx, bpy) || 1; bpx /= bl; bpy /= bl;
      const wBase = 5.2 * u, wMid = 5.6 * u, wPad = 4.5 * u;
      const off = (pt, px, py, s) => [pt[0] + px * s, pt[1] + py * s];
      const baseO = off(B, s1.px, s1.py, -wBase), baseI = off(B, s1.px, s1.py, wBase);
      const kO = off(K, bpx, bpy, -wMid), kI = off(K, bpx, bpy, wMid);
      const padO = off(T, s2.px, s2.py, -wPad), padI = off(T, s2.px, s2.py, wPad);
      const apex = off(T, s2.ux, s2.uy, wPad * 1.15);
      const closed = "M " + Pt(baseO)
        + Cp(off(baseO, s1.ux, s1.uy, s1.L * 0.42), off(kO, s1.ux, s1.uy, -s1.L * 0.14), kO)       // outer shaft up to knuckle
        + Cp(off(kO, s2.ux, s2.uy, s2.L * 0.22), off(padO, s2.ux, s2.uy, -s2.L * 0.26), padO)      // outer distal to pad
        + Cp(off(padO, s2.ux, s2.uy, wPad * 0.6), off(apex, s2.px, s2.py, -wPad * 0.5), apex)      // round the pad
        + Cp(off(apex, s2.px, s2.py, wPad * 0.5), off(padI, s2.ux, s2.uy, wPad * 0.6), padI)
        + Cp(off(padI, s2.ux, s2.uy, -s2.L * 0.26), off(kI, s2.ux, s2.uy, s2.L * 0.22), kI)        // inner distal down
        + Cp(off(kI, s1.ux, s1.uy, -s1.L * 0.14), off(baseI, s1.ux, s1.uy, s1.L * 0.42), baseI)    // inner shaft into palm
        + " Z";
      const nc = off(T, s2.ux, s2.uy, wPad * 0.05);
      const nail = { cx: nc[0], cy: nc[1], rx: wPad * 0.5, ry: wPad * 0.72,
        rot: Math.atan2(s2.uy, s2.ux) * 180 / Math.PI + 90 };
      // knuckle crease across the bend
      const creases = "M " + Pt(off(K, bpx, bpy, -wMid * 0.62)) + " Q " + P(K[0] + s2.ux * 2, K[1] + s2.uy * 2)
        + " " + Pt(off(K, bpx, bpy, wMid * 0.62)) + " ";
      return { closed, nail, creases };
    })();

    // ---- Palm + four fingers silhouette (the thumb is a separate piece) ----
    let d = "M " + P(wristL, ys(106));
    // left palm edge rising to the index knuckle (the thumb overlaps below)
    d += Cp([X(19.5), ys(100)], [digits[0].baseL[0] - 3.0 * u, ys(93)], digits[0].baseL);
    // four fingers, webbed together
    for (let i = 0; i < 4; i++) {
      d += digits[i].eL + digits[i].cap + digits[i].eR;
      if (i < 3) {
        const a = digits[i].baseR, b = digits[i + 1].baseL;
        const vx = (a[0] + b[0]) / 2;
        d += C(a[0] + (vx - a[0]) * 0.5, a[1] + (valleyY - a[1]) * 1.3, vx - (vx - a[0]) * 0.35, valleyY, vx, valleyY);
        d += C(vx + (b[0] - vx) * 0.35, valleyY, b[0] - (b[0] - vx) * 0.5, b[1] + (valleyY - b[1]) * 1.3, b[0], b[1]);
      }
    }
    // pinky-side palm edge — start at the pinky's actual base and move strictly
    // LEFT+down to the wrist (never right of the base), so no lobe forms
    d += Cp([pbr[0] - 0.2 * u, ys(94.5)], [pbr[0] - 1.2 * u, ys(100)], [pbr[0] - 2.2 * u, ys(104)]);
    d += Cp([pbr[0] - 2.8 * u, ys(105.6)], [wristR, ys(105.9)], [wristR, ys(106)]);
    d += C(wristR - 0.4 * u, ys(112), wristR - 1.2 * u, ys(118), wristR - 1.6 * u, ys(126));
    d += " L " + P(wristL + 1.6 * u, ys(126));
    d += C(wristL + 1.2 * u, ys(118), wristL + 0.4 * u, ys(112), wristL, ys(106));
    d += " Z";

    // ---- Nails ----
    const nails = digits.map((f) => f.nail);
    nails.push(thumb.nail);

    // ---- Creases: finger joints (from the digits), thumb joint, palm ----
    let cr = digits.map((f) => f.creases).join("") + thumb.creases;
    cr += "M " + P(X(28), ys(96.5)) + " Q " + P(X(46), ys(101.5)) + " " + P(X(70), ys(97.5)) + " ";
    // metacarpal hints running from each web valley toward the wrist
    for (let i = 0; i < 3; i++) {
      const vx = (digits[i].baseR[0] + digits[i + 1].baseL[0]) / 2;
      cr += "M " + P(vx, valleyY + 1.5) + " Q " + P(vx + (pcx - vx) * 0.1, valleyY + He * 0.045)
        + " " + P(vx + (pcx - vx) * 0.22, valleyY + He * 0.075) + " ";
    }

    // ---- Sleeve cuff — arched band over the forearm, off the bottom ----
    const cf = "M " + P(wristL - 1.4 * u, ys(112))
      + " Q " + P((wristL + wristR) / 2, ys(106.5)) + " " + P(wristR + 1.4 * u, ys(112))
      + " L " + P(wristR + 0.6 * u, ys(128))
      + " L " + P(wristL - 0.6 * u, ys(128)) + " Z";

    // ---- Whole-finger glow regions (finger number → closed outline) ----
    const hl = { 1: thumb.closed };
    digits.forEach((f, i) => { hl[i + 2] = f.closed; });

    return { d, dThumb: thumb.closed, nails, cr, cf, hl, He, st };
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

    setOn(on) {
      this.on = on;
      this.overlay.style.display = on ? "" : "none";
      // With hands on, the keyboard area grows (CSS) so the hand has room.
      this.wrap.classList.toggle("hands-on", on);
    }

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
        // Headroom above the keys (tall hands) + room below for the forearm.
        svg.setAttribute("viewBox", "0 " + (-Math.ceil(H * 0.15)) + " " + Math.ceil(spanW) + " " + Math.ceil(H * 1.35));
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "hand-svg");
        svg.style.top = "-15%";
        svg.style.height = "135%";
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
        addPath(model.dThumb, "hand-shape", "url(#" + gid + ")"); // thumb over the palm
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
