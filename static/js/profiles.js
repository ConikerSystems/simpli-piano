/* Simpli Piano — local user profiles (up to 5), like KeyQuest's "Who's playing?"
 *
 * Each player has a name + emoji and their OWN saved progress. Progress lives in
 * localStorage keyed by the active player's id (Profiles.key(base)), so it is
 * never lost when a new app version is pushed (code cache and localStorage are
 * separate), and removing a song/course just orphans that one id — every other
 * entry stays. Exposed as window.Profiles. */
(() => {
  "use strict";

  const KEY = "piano.profiles";
  const MAX = 5;
  const EMOJIS = ["🎹", "🎵", "⭐", "🎸", "🦄", "🚀", "🐱", "🐶", "🌈", "🎯"];

  let data = (() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { list: [], activeId: null }; }
    catch { return { list: [], activeId: null }; }
  })();
  const persist = () => localStorage.setItem(KEY, JSON.stringify(data));

  const all = () => data.list;
  const active = () => data.list.find((p) => p.id === data.activeId) || null;
  const activeId = () => data.activeId;
  const canAdd = () => data.list.length < MAX;

  function setActive(id) {
    if (data.list.some((p) => p.id === id)) { data.activeId = id; persist(); }
  }

  function add(name, emoji) {
    if (!canAdd()) return null;
    const firstEver = data.list.length === 0;
    const id = "p" + Date.now().toString(36) + Math.floor(performance.now()).toString(36);
    const p = { id, name: (name || "Player").trim().slice(0, 14) || "Player", emoji: emoji || EMOJIS[0] };
    data.list.push(p);
    data.activeId = id;
    persist();
    // Migrate any pre-profiles global progress to the very first player created,
    // so early testing progress isn't stranded.
    if (firstEver) {
      ["piano.progress", "piano.course", "piano.chords"].forEach((base) => {
        const old = localStorage.getItem(base);
        if (old != null && localStorage.getItem(base + "." + id) == null) {
          localStorage.setItem(base + "." + id, old);
        }
      });
    }
    return p;
  }

  function rename(id, name) {
    const p = data.list.find((x) => x.id === id);
    if (p) { p.name = (name || p.name).trim().slice(0, 14) || "Player"; persist(); }
  }

  function remove(id) {
    data.list = data.list.filter((p) => p.id !== id);
    ["piano.progress", "piano.course", "piano.chords", "piano.stats", "piano.onboard",
     "piano.workout", "piano.trainerBest"].forEach((b) => localStorage.removeItem(b + "." + id));
    if (data.activeId === id) data.activeId = data.list[0] ? data.list[0].id : null;
    persist();
  }

  // Per-user storage key for a progress namespace.
  const key = (base) => base + "." + (data.activeId || "default");

  window.Profiles = { EMOJIS, MAX, all, active, activeId, canAdd, setActive, add, rename, remove, key };
})();
