/* Shared harness for the Simpli Piano node tests.
 *
 * The app is a no-build PWA: every module is an IIFE that hangs itself off
 * `window` and index.html loads them in order with <script> tags. There is no
 * bundler and no package.json, and these tests keep it that way — they build a
 * `global.window`, require the files in the same order the page does, and read
 * the same globals the app reads. Nothing here is installed; `node` is enough.
 *
 * What is faked, and why only this much:
 *   localStorage — every module persists through it, and node has none that is
 *                  isolated per test. Ours is a plain Map, cleared between tests.
 *   document     — engine.js builds the falling-note lane out of real elements.
 *                  The fake records class names and data-idx, which is exactly
 *                  what the engine reads back when it colours a note.
 *   keyboard     — records highlight/flash calls so a test can assert the engine
 *                  lit the key it claims to have lit.
 *   PianoAudio   — silent.
 *
 * Deliberately NOT faked: a browser. app.js, mic.js, trainer.js, hands.js and
 * feedback.js are DOM/audio surfaces that need a real page, and pretending
 * otherwise would test the fake instead of the app. See tests/README.md.
 */
"use strict";

const path = require("path");
const JS_DIR = path.join(__dirname, "..", "static", "js");

// ---- assertions -------------------------------------------------------------
let passed = 0, failed = 0;

function t(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) {
    failed++;
    console.log("FAIL  " + name + " — " + e.message);
    if (process.env.V) console.log(e.stack);
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ": " : "") + `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > (tol ?? 1e-9)) throw new Error((msg ? msg + ": " : "") + `expected ~${b}, got ${a}`);
}
function throws(fn, msg) {
  try { fn(); } catch { return; }
  throw new Error(msg || "expected it to throw");
}
function done(label) {
  console.log(`\n${label}: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// ---- localStorage -----------------------------------------------------------
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    _map: m,
  };
}

// ---- a DOM just large enough for the lesson lane ----------------------------
function makeEl(tag) {
  const el = {
    tagName: tag,
    children: [],
    style: {},
    dataset: {},
    textContent: "",
    _classes: new Set(),
    get className() { return [...el._classes].join(" "); },
    set className(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    classList: {
      add: (...c) => c.forEach((x) => el._classes.add(x)),
      remove: (...c) => c.forEach((x) => el._classes.delete(x)),
      contains: (c) => el._classes.has(c),
    },
    appendChild: (child) => { el.children.push(child); return child; },
    set innerHTML(v) { if (v === "") el.children.length = 0; },
    get innerHTML() { return ""; },
    // Only the one selector shape the engine uses: '.note-block[data-idx="N"]'.
    querySelectorAll: (sel) => {
      const m = /^\.note-block\[data-idx="(\d+)"\]$/.exec(sel);
      if (!m) throw new Error("test DOM got an unexpected selector: " + sel);
      const want = m[1];
      const out = [];
      const walk = (node) => node.children.forEach((c) => {
        if (c._classes.has("note-block") && c.dataset.idx === want) out.push(c);
        walk(c);
      });
      walk(el);
      return out;
    },
  };
  return el;
}

/* A keyboard that records what the engine asked it to show. */
function makeKeyboard() {
  return {
    highlights: [],
    flashes: [],
    cleared: 0,
    keyRect: (midi) => ({ leftPct: (midi % 12) * 8, widthPct: 8 }),
    highlight(midis, kind) { this.highlights.push({ midis: [...midis], kind }); },
    flash(midi, kind) { this.flashes.push({ midi, kind }); },
    clearHighlights() { this.cleared++; },
    flashesOf(kind) { return this.flashes.filter((f) => f.kind === kind); },
  };
}

/* Build the global environment and load modules in index.html order.
 * `names` are module basenames; dependencies must come first, exactly as the
 * page orders its <script> tags. */
function loadApp(names) {
  const storage = makeLocalStorage();
  global.localStorage = storage;
  global.window = { localStorage: storage };
  global.document = {
    createElement: makeEl,
    // Nothing under test reads from a live tree; a module that starts to will
    // fail loudly here rather than silently receiving null.
    getElementById: () => { throw new Error("test DOM has no element tree"); },
  };
  // Node ships a read-only `navigator`; keyboard.js only reads it when a real
  // Keyboard is constructed (which these tests never do), so redefine rather
  // than assign and move on.
  const nav = { userAgent: "node", platform: "node", maxTouchPoints: 0, screen: { width: 1024, height: 768 } };
  try { Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true }); }
  catch { /* keep node's own */ }
  global.window.navigator = nav;
  global.window.screen = nav.screen;
  global.performance = { now: () => 0 };
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.window.PianoAudio = { ensure() {}, click() {}, pluck() {} };

  for (const n of names) {
    delete require.cache[require.resolve(path.join(JS_DIR, n + ".js"))];
    require(path.join(JS_DIR, n + ".js"));
  }
  return { window: global.window, storage };
}

module.exports = { t, eq, ok, near, throws, done, loadApp, makeEl, makeKeyboard, makeLocalStorage, JS_DIR };
