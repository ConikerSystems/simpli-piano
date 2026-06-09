/* Simpli Piano — a touch-first, device-adaptive piano.
 *
 * - Web Audio synth (two detuned oscillators + ADSR + lowpass) — no samples to load.
 * - Pointer events give unified mouse + multitouch; multiple keys can sound at once.
 * - The number of octaves shown adapts to the device width so keys stay finger-sized.
 * - Computer keyboard (A,W,S,E,D...) is mapped too, for desktop development.
 */

(() => {
  "use strict";

  // ---- Note model -------------------------------------------------------
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_OFFSETS = new Set([0, 2, 4, 5, 7, 9, 11]); // semitone offsets that are white keys
  const MIN_WHITE_KEY_PX = 46;   // keep white keys at least this wide (touch target)
  const MIN_OCTAVES = 1;
  const MAX_OCTAVES = 4;

  // midi -> frequency (A4 = MIDI 69 = 440 Hz)
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const midiToName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
  const isWhite = (m) => WHITE_OFFSETS.has(((m % 12) + 12) % 12);

  // ---- Audio engine -----------------------------------------------------
  let audioCtx = null;
  let masterGain = null;
  const voices = new Map(); // midi -> { osc1, osc2, gain }

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(audioCtx.destination);
  }

  function noteOn(midi) {
    ensureAudio();
    if (voices.has(midi)) return; // already sounding
    const now = audioCtx.currentTime;
    const freq = midiToFreq(midi);

    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;

    const osc1 = audioCtx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = freq;

    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq;
    osc2.detune.value = -6; // slight detune for warmth

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    // ADSR-ish: quick attack, gentle decay toward a sustain level
    const peak = 0.28;
    const sustain = 0.16;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(sustain, now + 0.35);

    osc1.start(now);
    osc2.start(now);
    voices.set(midi, { osc1, osc2, gain });
  }

  function noteOff(midi) {
    const v = voices.get(midi);
    if (!v) return;
    voices.delete(midi);
    const now = audioCtx.currentTime;
    const release = 0.28;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
    v.osc1.stop(now + release + 0.02);
    v.osc2.stop(now + release + 0.02);
  }

  // ---- Keyboard rendering ----------------------------------------------
  const keyboardEl = document.getElementById("keyboard");
  const octaveLabel = document.getElementById("octave-label");
  const hintEl = document.getElementById("hint");

  let startMidi = 60;   // C4
  let octaves = 2;      // recomputed per device
  let keyEls = new Map(); // midi -> element

  function computeOctaves() {
    const w = keyboardEl.clientWidth || window.innerWidth;
    const fit = Math.floor(w / (MIN_WHITE_KEY_PX * 7)); // 7 white keys per octave
    return Math.max(MIN_OCTAVES, Math.min(MAX_OCTAVES, fit || MIN_OCTAVES));
  }

  function render() {
    octaves = computeOctaves();
    keyboardEl.innerHTML = "";
    keyEls = new Map();

    const total = octaves * 12 + 1; // +1 so the range ends on a C
    const whiteMidis = [];
    for (let i = 0; i < total; i++) {
      const m = startMidi + i;
      if (isWhite(m)) whiteMidis.push(m);
    }
    const whiteCount = whiteMidis.length;

    // White keys first (flex children), record their index for black-key positioning
    const whiteIndex = new Map();
    whiteMidis.forEach((m, idx) => {
      whiteIndex.set(m, idx);
      keyboardEl.appendChild(makeKey(m, "white"));
    });

    // Black keys positioned over the gaps
    for (let i = 0; i < total; i++) {
      const m = startMidi + i;
      if (isWhite(m)) continue;
      const leftWhite = m - 1;            // black key sits to the right of this white
      const idx = whiteIndex.get(leftWhite);
      if (idx === undefined) continue;
      const el = makeKey(m, "black");
      const unit = 100 / whiteCount;      // width of one white key in %
      const blackW = unit * 0.62;
      el.style.width = blackW + "%";
      el.style.left = (unit * (idx + 1) - blackW / 2) + "%";
      keyboardEl.appendChild(el);
    }

    octaveLabel.textContent = midiToName(startMidi);
  }

  function makeKey(midi, kind) {
    const el = document.createElement("div");
    el.className = "key " + kind;
    el.dataset.midi = String(midi);
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = midiToName(midi);
    el.appendChild(label);
    keyEls.set(midi, el);
    return el;
  }

  function setActive(midi, on) {
    const el = keyEls.get(midi);
    if (el) el.classList.toggle("active", on);
  }

  function press(midi) {
    if (Number.isNaN(midi)) return;
    setActive(midi, true);
    noteOn(midi);
  }
  function release(midi) {
    if (Number.isNaN(midi)) return;
    setActive(midi, false);
    noteOff(midi);
  }

  // ---- Pointer input (mouse + multitouch) -------------------------------
  const pointerNote = new Map(); // pointerId -> midi

  function midiFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return NaN;
    const key = el.closest(".key");
    return key ? Number(key.dataset.midi) : NaN;
  }

  keyboardEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const midi = midiFromPoint(e.clientX, e.clientY);
    if (Number.isNaN(midi)) return;
    pointerNote.set(e.pointerId, midi);
    press(midi);
  });

  keyboardEl.addEventListener("pointermove", (e) => {
    if (!pointerNote.has(e.pointerId)) return; // only while pressed (glissando)
    const midi = midiFromPoint(e.clientX, e.clientY);
    const prev = pointerNote.get(e.pointerId);
    if (midi === prev) return;
    if (!Number.isNaN(prev)) release(prev);
    if (!Number.isNaN(midi)) {
      pointerNote.set(e.pointerId, midi);
      press(midi);
    } else {
      pointerNote.delete(e.pointerId);
    }
  });

  function endPointer(e) {
    const midi = pointerNote.get(e.pointerId);
    if (midi !== undefined) {
      release(midi);
      pointerNote.delete(e.pointerId);
    }
  }
  keyboardEl.addEventListener("pointerup", endPointer);
  keyboardEl.addEventListener("pointercancel", endPointer);
  keyboardEl.addEventListener("pointerleave", endPointer);

  // ---- Computer keyboard (desktop dev convenience) ----------------------
  // Two rows mapped to a piano octave starting at the current startMidi.
  const KEY_MAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
    g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15,
  };
  const heldKeys = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!(k in KEY_MAP) || heldKeys.has(k) || e.metaKey || e.ctrlKey) return;
    heldKeys.add(k);
    press(startMidi + KEY_MAP[k]);
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (!(k in KEY_MAP)) return;
    heldKeys.delete(k);
    release(startMidi + KEY_MAP[k]);
  });

  // ---- Controls ---------------------------------------------------------
  document.getElementById("octave-up").addEventListener("click", () => {
    if (startMidi <= 96) { startMidi += 12; render(); }
  });
  document.getElementById("octave-down").addEventListener("click", () => {
    if (startMidi >= 24) { startMidi -= 12; render(); }
  });
  document.getElementById("labels-toggle").addEventListener("change", (e) => {
    document.body.classList.toggle("no-labels", !e.target.checked);
  });

  // Unlock audio on first interaction (iOS requires a user gesture).
  const unlock = () => { ensureAudio(); window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("pointerdown", unlock);

  // Re-render on resize/orientation change (debounced).
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  render();

  // ---- Service worker (PWA) --------------------------------------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
