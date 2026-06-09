/* Simpli Piano — microphone input (monophonic).
 *
 * Listens through the device mic and reports single notes you play on a real
 * acoustic/digital piano, using autocorrelation pitch detection (the well-known
 * ACF2+ approach). Single notes / melodies only — chord detection is out of
 * scope (that's Simply Piano's deep-learning "MusicSense" moat).
 *
 * Emits onNote(midi) once per note onset (debounced). Exposed as window.Mic. */
(() => {
  "use strict";

  const freqToMidi = (f) => Math.round(69 + 12 * Math.log2(f / 440));

  // Autocorrelation pitch detector. Returns frequency in Hz or -1 if unsure.
  function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // too quiet

    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const b = buf.slice(r1, r2);
    const n = b.length;

    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += b[j] * b[j + i];

    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < n; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    let T0 = maxpos;
    // parabolic interpolation for a finer period estimate
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
    if (a) T0 = T0 - bb / (2 * a);
    return sampleRate / T0;
  }

  class Mic {
    constructor({ onNote, onLevel } = {}) {
      this.onNote = onNote || (() => {});
      this.onLevel = onLevel || (() => {});
      this.running = false;
      this.lastMidi = null;
      this.silentFrames = 0;
    }

    async start() {
      const ctx = window.PianoAudio.ensure();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.source = ctx.createMediaStreamSource(this.stream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.source.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
      this.running = true;
      this._loop(ctx.sampleRate);
    }

    _loop(sampleRate) {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(this.buf);
      const freq = autoCorrelate(this.buf, sampleRate);

      if (freq > 0 && freq < 2000) {
        const midi = freqToMidi(freq);
        this.silentFrames = 0;
        // Fire once per onset: when the detected note changes (or after a gap).
        if (midi !== this.lastMidi) {
          this.lastMidi = midi;
          this.onNote(midi);
        }
        this.onLevel(midi);
      } else {
        this.silentFrames++;
        if (this.silentFrames > 4) { this.lastMidi = null; } // allow the same note to retrigger
      }
      this.raf = requestAnimationFrame(() => this._loop(sampleRate));
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.source) this.source.disconnect();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.lastMidi = null;
    }
  }

  window.Mic = { Mic, freqToMidi, supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
})();
