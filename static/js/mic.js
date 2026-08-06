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
  // Absolute floor is deliberately LOW; the useful gate is the adaptive noise
  // floor below, so a quiet piano (or a quiet iPad mic) still registers while
  // a noisy room doesn't produce phantom notes.
  const QUIET_RMS = 0.0012;
  const STABLE_FRAMES = 3;   // frames that must agree before a note fires (~50ms;
                             // 2 let noise-to-signal transitions slip through)
  const FREQ_LO = 55, FREQ_HI = 2100; // accept piano melody range only
  // Re-attack (onset) detection, so REPEATED notes register — melodies are full
  // of them (Sound of Silence plays A A, then A A A). A struck piano note
  // DECAYS, so a fresh strike shows up as a rise above the decaying floor.
  // Comparing against the previous frame alone can't see this: at 60fps the
  // attack is over within a frame or two and the frame-to-frame ratio collapses
  // before the pitch is confirmed. So track the quietest level since the last
  // onset and re-trigger when the level climbs back above it.
  // The reliable discriminator is the RISING EDGE: a ringing note only ever
  // decays, so any genuine rise means the key was struck again. The ratio then
  // just filters jitter. Tuned SENSITIVE on purpose — a stray detection is
  // harmless (the lesson ignores mic notes that don't match), while a missed
  // strike blocks the learner, so the costs are lopsided.
  const ONSET_FLOOR = 0.004; // ignore rises in near-silence (room noise)
  const NOISE_MULT = 2.2;    // signal must beat the measured room noise by this
  const ONSET_RATIO = 1.12;  // rise above the recent average that counts
  const ONSET_MIN_MS = 100;  // debounce: no two onsets closer than this
  const AVG_ALPHA = 0.18;    // EMA weight (~6 frames ≈ 100ms of history)

  function rmsOf(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  // Autocorrelation pitch detector. Returns frequency in Hz or -1 if unsure.
  function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    const rms = rmsOf(buf);
    if (rms < QUIET_RMS) return -1; // too quiet

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
    constructor({ onNote, onLevel, onAudio } = {}) {
      this.onNote = onNote || (() => {});
      this.onLevel = onLevel || (() => {});
      // Fires EVERY frame with the raw level — powers the "is it hearing me?"
      // meter, which is the only way a learner can tell the mic is working.
      this.onAudio = onAudio || (() => {});
      // Starts low and converges DOWN quickly, so a quiet room yields a quiet
      // gate within a second rather than staying deaf to a soft piano.
      this.noiseFloor = 0.0015;
      this.running = false;
      this.lastMidi = null;
      this.silentFrames = 0;
      this.pendingMidi = null; // candidate awaiting STABLE_FRAMES agreement
      this.pendingCount = 0;
      this.avgRms = 0;         // EMA of recent level (lags a decaying note)
      this.prevRms = 0;
      this.lastOnsetAt = 0;
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

    /* Analyse one frame. Split out from the rAF loop so it can be driven with
       synthetic audio in tests. `now` is injectable for the same reason. */
    _process(buf, sampleRate, now) {
      now = now === undefined ? performance.now() : now;
      const rms = rmsOf(buf);
      const freq = autoCorrelate(buf, sampleRate);
      // Loud enough to be a note rather than room tone?
      const audible = rms > QUIET_RMS && rms > this.noiseFloor * NOISE_MULT;
      this.onAudio(rms, audible, this.noiseFloor);

      if (freq >= FREQ_LO && freq <= FREQ_HI && audible) {
        const midi = freqToMidi(freq);
        this.silentFrames = 0;

        // Re-attack: a ringing note only decays, so a RISE means the key was
        // struck again. Clear lastMidi so a REPEAT of the same pitch fires a
        // fresh note instead of being swallowed as "still ringing".
        if (rms > ONSET_FLOOR && rms > this.prevRms && rms > this.avgRms * ONSET_RATIO
            && now - this.lastOnsetAt > ONSET_MIN_MS) {
          this.lastMidi = null;
          this.lastOnsetAt = now;
        }

        if (midi === this.lastMidi) {
          this.pendingMidi = null; this.pendingCount = 0;
        } else if (midi === this.pendingMidi) {
          // Same candidate again — fire once it's held STABLE_FRAMES frames.
          if (++this.pendingCount >= STABLE_FRAMES) {
            this.pendingMidi = null; this.pendingCount = 0;
            this.lastMidi = midi;
            this.lastOnsetAt = now;
            this.onNote(midi);
          }
        } else {
          this.pendingMidi = midi; this.pendingCount = 1; // new candidate
        }
        this.onLevel(midi);
      } else {
        this.silentFrames++;
        this.pendingMidi = null; this.pendingCount = 0;
        if (this.silentFrames > 4) this.lastMidi = null; // a gap — allow retrigger
        // Learn the room's noise level from the quiet stretches (slowly, and
        // only downward-biased, so a sustained note can't raise the gate).
        this.noiseFloor += (rms < this.noiseFloor ? 0.15 : 0.004) * (rms - this.noiseFloor);
        this.noiseFloor = Math.max(0.0004, Math.min(0.05, this.noiseFloor));
      }
      // Track the level last, so the comparisons above see the PREVIOUS frame.
      this.avgRms = this.avgRms ? this.avgRms + AVG_ALPHA * (rms - this.avgRms) : rms;
      this.prevRms = rms;
    }

    _loop(sampleRate) {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(this.buf);
      this._process(this.buf, sampleRate);
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
