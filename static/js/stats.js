/* Simpli Piano — practice stats, daily streak, and per-player settings.
 *
 * Practice seconds are logged per LOCAL calendar day (never UTC — evening
 * practice must not roll into tomorrow) in localStorage, per active player:
 *   piano.stats.<playerId>  →  { days: { "2026-07-04": 480, ... }, goalMin: 10 }
 * Onboarding answers live under piano.onboard.<playerId>.
 *
 * A day counts toward the streak once it has >= 60 seconds of practice.
 * Exposed as window.Stats. */
(() => {
  "use strict";

  const BASE = "piano.stats";
  const ONBOARD = "piano.onboard";
  const STREAK_MIN_SECS = 60;

  const key = () => window.Profiles.key(BASE);
  const load = () => {
    try { return JSON.parse(localStorage.getItem(key())) || { days: {} }; }
    catch { return { days: {} }; }
  };
  const save = (d) => localStorage.setItem(key(), JSON.stringify(d));

  // Local-timezone YYYY-MM-DD (offset in days from today).
  function dayKey(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function log(seconds) {
    seconds = Math.round(seconds);
    if (!(seconds > 0)) return;
    const d = load();
    d.days = d.days || {};
    d.days[dayKey()] = (d.days[dayKey()] || 0) + seconds;
    save(d);
  }

  const today = () => (load().days || {})[dayKey()] || 0;
  function week() { // seconds over the last 7 days, today included
    const days = load().days || {};
    let t = 0;
    for (let i = 0; i > -7; i--) t += days[dayKey(i)] || 0;
    return t;
  }
  function streak() { // consecutive days (ending today or yesterday) with practice
    const days = load().days || {};
    const counts = (k) => (days[k] || 0) >= STREAK_MIN_SECS;
    let n = 0, offset = counts(dayKey()) ? 0 : -1; // today not practiced yet? count back from yesterday
    while (counts(dayKey(offset - n))) n++;
    return n;
  }

  const goalMin = () => load().goalMin || 10;
  function setGoalMin(min) { const d = load(); d.goalMin = min; save(d); }

  // One motivational line for finish overlays (goal crossed / streak / to-go).
  function callout(prevTodaySecs) {
    const goal = goalMin() * 60, now = today();
    if (prevTodaySecs != null && prevTodaySecs < goal && now >= goal)
      return "🎯 Daily goal done — " + Math.round(now / 60) + " min today!";
    const s = streak();
    if (s >= 2 && now >= STREAK_MIN_SECS) return "🔥 That's " + s + " days in a row!";
    if (now < goal) return Math.max(1, Math.ceil((goal - now) / 60)) + " min to today's goal — keep going!";
    return "🎯 Goal done — " + Math.round(now / 60) + " min today!";
  }

  // ---- Onboarding answers (per player) ----------------------------------
  const obKey = () => window.Profiles.key(ONBOARD);
  const getOnboard = () => { try { return JSON.parse(localStorage.getItem(obKey())); } catch { return null; } };
  const setOnboard = (obj) => localStorage.setItem(obKey(), JSON.stringify(obj));

  window.Stats = { log, today, week, streak, goalMin, setGoalMin, callout, getOnboard, setOnboard, dayKey };
})();
