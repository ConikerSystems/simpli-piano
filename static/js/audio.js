/* Simpli Piano — audio engine.
 * A small Web Audio synth (two detuned oscillators + ADSR + lowpass) plus a
 * metronome click. No samples to load, so it works instantly and offline.
 * Exposed as window.PianoAudio. */
(() => {
  "use strict";

  let ctx = null;
  let master = null;
  const voices = new Map(); // midi -> { osc1, osc2, gain }

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    return ctx;
  }

  function noteOn(midi) {
    ensure();
    if (voices.has(midi)) return;
    const now = ctx.currentTime;
    const freq = midiToFreq(midi);

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;

    const osc1 = ctx.createOscillator();
    osc1.type = "triangle";
    osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq;
    osc2.detune.value = -6;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.35);

    osc1.start(now);
    osc2.start(now);
    voices.set(midi, { osc1, osc2, gain });
  }

  function noteOff(midi) {
    const v = voices.get(midi);
    if (!v) return;
    voices.delete(midi);
    const now = ctx.currentTime;
    const release = 0.28;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
    v.osc1.stop(now + release + 0.02);
    v.osc2.stop(now + release + 0.02);
  }

  /* Play a short note for `ms`, used for previews / "listen" playback. */
  function pluck(midi, ms = 400) {
    noteOn(midi);
    setTimeout(() => noteOff(midi), ms);
  }

  /* Metronome / UI tick. `accent` = downbeat (higher, louder). */
  function click(accent = false) {
    ensure();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.15, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  window.PianoAudio = { ensure, noteOn, noteOff, pluck, click, midiToFreq };
})();
