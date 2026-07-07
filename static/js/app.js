/* Simpli Piano — app shell: view routing, screens, progress, mic input.
 * Vanilla single-page app; each view rebuilds the #view container. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const view = document.getElementById("view");
  const titleEl = document.getElementById("view-title");
  const backBtn = document.getElementById("back-btn");
  const actionsEl = document.getElementById("topbar-actions");

  // ---- Progress (localStorage, per active player) ----------------------
  const progKey = () => window.Profiles.key("piano.progress");
  const loadProgress = () => { try { return JSON.parse(localStorage.getItem(progKey())) || {}; } catch { return {}; } };
  const saveStars = (songId, stars) => {
    const p = loadProgress();
    if (!p[songId] || stars > p[songId].stars) { p[songId] = { stars }; localStorage.setItem(progKey(), JSON.stringify(p)); }
  };
  const starsFor = (songId) => (loadProgress()[songId]?.stars || 0);
  const starRow = (n) => "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);

  // ---- DOM helpers ------------------------------------------------------
  function el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  const svgEl = () => document.createElementNS(SVGNS, "svg");

  function setChrome(title, { back = false, actions = [] } = {}) {
    titleEl.innerHTML = title;
    backBtn.hidden = !back;
    actionsEl.innerHTML = "";
    actions.forEach((a) => actionsEl.append(a));
  }
  function clearView() {
    // NOTE: the mic is intentionally NOT stopped here — it stays on across pages
    // so you can keep playing your real piano while moving between lessons. Only
    // the per-view routing target is cleared; each view sets its own.
    if (window._active && window._active.stop) { try { window._active.stop(); } catch {} window._active = null; }
    flushClock(); practicing = false;
    view.innerHTML = "";
    window._kb = null;
    window._relayout = null;
    window._micTarget = null;
  }

  // ---- Practice clock (feeds Stats; per local day, per player) ----------
  // Paused while the app is hidden — iOS keeps the page suspended in the
  // background and that time must not count as practice.
  let practicing = false, clockStart = null;
  function startClock() { practicing = true; clockStart = performance.now(); }
  function flushClock() {
    if (clockStart != null) window.Stats.log((performance.now() - clockStart) / 1000);
    clockStart = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushClock();
    else if (practicing) clockStart = performance.now();
  });
  // Checkpoint the clock (e.g. at a finish overlay) so Stats.today() is fresh;
  // returns today's seconds from BEFORE this stretch was logged (for callouts).
  function checkpointClock() {
    const prev = window.Stats.today();
    flushClock();
    if (practicing) clockStart = performance.now();
    return prev;
  }

  // ---- "Which finger?" hands overlay — device-wide display preference ----
  const HANDS_KEY = "piano.showHands";
  const handsOn = () => localStorage.getItem(HANDS_KEY) !== "0";
  function fingersChip(getHands) {
    const b = el("button", { class: "chip" + (handsOn() ? " active" : ""), onclick: () => {
      const on = !handsOn();
      localStorage.setItem(HANDS_KEY, on ? "1" : "0");
      const h = getHands();
      if (h) h.setOn(on);
      b.classList.toggle("active", on);
    } }, "🖐 Hands");
    return b;
  }
  // Five-finger mapping for a song: anchor each hand on the C of the octave
  // where most of its notes live (for "both", notes below middle C = left hand).
  function fingerMapForSong(song) {
    const counts = { low: {}, high: {} };
    song.notes.forEach((n) => {
      if (n.rest) return;
      (Array.isArray(n.midi) ? n.midi : [n.midi]).forEach((m) => {
        const c = Math.floor(m / 12) * 12; // the C at/below this note
        const side = song.hand === "both" && m < 60 ? "low" : "high";
        counts[side][c] = (counts[side][c] || 0) + 1;
      });
    });
    const modeC = (o, dflt) => { let best = dflt, n = 0; for (const [c, k] of Object.entries(o)) if (k > n) { n = k; best = +c; } return best; };
    if (song.hand === "left") return { left: { pinky: modeC(counts.high, 48) } };
    if (song.hand === "both") return { left: { pinky: modeC(counts.low, 48) }, right: modeC(counts.high, 60) };
    return { right: modeC(counts.high, 60) };
  }

  // Coarse device detection so the keyboard sizes sensibly per device.
  // (iPadOS 13+ reports as "MacIntel" with touch points, so check that too.)
  function deviceProfile() {
    const ua = navigator.userAgent || "";
    const ipad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const iphone = /iPhone|iPod/.test(ua);
    const minDim = Math.min(window.screen.width, window.screen.height);
    const tablet = ipad || minDim >= 700;
    return { ios: ipad || iphone, tablet, phone: iphone && !ipad };
  }

  // ---- Persistent chrome: footer (every page) + global mic --------------
  // The mic is global so it keeps listening as you move between pages. Each view
  // sets window._micTarget(midi) to receive detected notes; views that don't set
  // it simply leave the mic idle-but-on.
  function initChrome() {
    // Current year, auto-updated — never needs manual editing.
    document.getElementById("app-footer").innerHTML =
      '© ' + new Date().getFullYear() + ' <a href="https://conikersystems.com" target="_blank" rel="noopener">Coniker Systems™</a>'
      + '<span class="footer-sep">·</span>v' + (window.APP_VERSION || "1.0");

    const micBtn = document.getElementById("mic-btn");
    const micNote = document.getElementById("mic-note");
    let noteTimer = null;

    const setOff = (label) => {
      window._mic = null;
      micBtn.classList.remove("active");
      micBtn.setAttribute("aria-pressed", "false");
      micBtn.textContent = label || "🎤 Mic";
      micNote.textContent = "";
      if (window._active && window._active.setOctaveTolerant) window._active.setOctaveTolerant(false);
    };

    micBtn.onclick = async () => {
      if (window._mic) { window._mic.stop(); setOff(); return; }
      if (!window.Mic || !window.Mic.supported) { micBtn.textContent = "🎤 n/a"; return; }
      micBtn.textContent = "🎤 …";
      try {
        const mic = new window.Mic.Mic({
          onNote: (m) => { if (typeof window._micTarget === "function") window._micTarget(m); },
          onLevel: (m) => {
            micNote.textContent = window.Theory.midiToName(m);
            clearTimeout(noteTimer);
            noteTimer = setTimeout(() => { micNote.textContent = ""; }, 500);
          },
        });
        await mic.start();
        window._mic = mic;
        micBtn.classList.add("active");
        micBtn.setAttribute("aria-pressed", "true");
        micBtn.textContent = "🎤 On";
        if (window._active && window._active.setOctaveTolerant) window._active.setOctaveTolerant(true);
      } catch { setOff("🎤 ✕"); }
    };
  }

  // Force-pull the latest version (iOS often resumes the installed app from
  // memory instead of reloading, so it never sees a new release). Needs network.
  function updateApp(btn) {
    if (!navigator.onLine) { alert("Connect to Wi-Fi or cellular, then tap Update again."); return; }
    if (btn) btn.textContent = "🔄  Updating…";
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
        }
        if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
      } catch (e) { /* ignore */ }
      location.href = "index.html?u=" + Date.now(); // cache-busted reload
    })();
  }

  // ---- Players (profiles) ----------------------------------------------
  function start() {
    if (!window.Profiles.activeId()) profilePicker();
    else home();
  }

  function profilePicker() {
    clearView();
    const hasActive = !!window.Profiles.activeId();
    setChrome("Players", { back: hasActive });
    backBtn.onclick = home;

    const list = window.Profiles.all();
    const wrap = el("div", { class: "profiles" }, [
      el("h2", { class: "profiles-title" }, list.length ? "Who's playing?" : "Welcome to Simpli Piano"),
      el("p", { class: "profiles-sub" }, "Your stars and progress are saved just for you. Up to 5 players on this device."),
    ]);
    const grid = el("div", { class: "profiles-grid" });
    list.forEach((p) => {
      grid.append(el("button", { class: "profile-card" + (p.id === window.Profiles.activeId() ? " active" : ""),
        onclick: () => { window.Profiles.setActive(p.id); home(); } }, [
        el("span", { class: "profile-emoji" }, p.emoji),
        el("span", { class: "profile-name" }, p.name),
        el("span", { class: "profile-del", title: "Remove player",
          onclick: (e) => { e.stopPropagation(); if (confirm("Remove " + p.name + " and their progress?")) { window.Profiles.remove(p.id); profilePicker(); } } }, "✕"),
      ]));
    });
    if (window.Profiles.canAdd()) {
      grid.append(el("button", { class: "profile-card add", onclick: () => showCreate(wrap) }, [
        el("span", { class: "profile-emoji" }, "＋"),
        el("span", { class: "profile-name" }, "Add player"),
      ]));
    }
    wrap.append(grid);
    view.append(wrap);
    if (!list.length) showCreate(wrap); // first run → go straight to create
  }

  function showCreate(wrap) {
    if (wrap.querySelector(".profile-create")) return;
    let emoji = window.Profiles.EMOJIS[0];
    const name = el("input", { type: "text", class: "field", placeholder: "Type a name", maxlength: "14", value: "" });
    const emojiRow = el("div", { class: "emoji-row" });
    window.Profiles.EMOJIS.forEach((e, i) => {
      const b = el("button", { class: "emoji-pick" + (i === 0 ? " active" : ""), onclick: () => {
        emoji = e; emojiRow.querySelectorAll(".emoji-pick").forEach((x) => x.classList.remove("active")); b.classList.add("active");
      } }, e);
      emojiRow.append(b);
    });
    const create = el("div", { class: "profile-create" }, [
      el("div", { class: "create-label" }, "New player"),
      name, emojiRow,
      el("button", { class: "chip play", onclick: () => {
        const p = window.Profiles.add(name.value || "Player", emoji);
        if (p) home();
      } }, "Create player"),
    ]);
    wrap.append(create);
    name.focus();
  }

  // ---- Home -------------------------------------------------------------
  // Streak / today's-goal / weekly-minutes strip (hidden until first practice).
  function statsStrip() {
    const S = window.Stats;
    const todayMin = Math.floor(S.today() / 60), weekMin = Math.round(S.week() / 60);
    const s = S.streak();
    if (!todayMin && !weekMin && !s) return null;
    const goal = S.goalMin();
    const pct = Math.min(100, Math.round((S.today() / (goal * 60)) * 100));
    return el("div", { class: "stats-strip" }, [
      el("span", { class: "stat" }, "🔥 " + s + (s === 1 ? " day" : " days")),
      el("span", { class: "stat goal" }, [
        el("span", { class: "goal-bar" }, el("span", { class: "goal-fill", style: "width:" + pct + "%" })),
        el("span", {}, todayMin + " of " + goal + " min today"),
      ]),
      el("span", { class: "stat" }, weekMin + " min this week"),
    ]);
  }

  function trackProgressText(track, intro) {
    const total = track.CURRICULUM.length;
    const done = track.CURRICULUM.filter((u) => track.isComplete(u.id)).length;
    return done ? done + " of " + total + " done — keep going!" : intro;
  }
  function home() {
    // First visit for this player → the quick "make it yours" quiz.
    if (window.Profiles.active() && !window.Stats.getOnboard()) return onboardView();
    clearView();
    setChrome("Simpli&nbsp;Piano", { back: false });
    backBtn.onclick = null;
    const tile = (label, sub, onclick, cls) =>
      el("button", { class: "tile " + (cls || ""), onclick }, [
        el("span", { class: "tile-label" }, label),
        el("span", { class: "tile-sub" }, sub),
      ]);
    const me = window.Profiles.active();
    view.append(el("div", { class: "home" }, [
      me ? el("button", { class: "player-chip", onclick: () => profilePicker() }, [
        el("span", { class: "profile-emoji" }, me.emoji),
        el("span", {}, me.name),
        el("span", { class: "swap" }, "⇄"),
      ]) : null,
      statsStrip(),
      el("p", { class: "tagline" }, "Learn piano the simple way — follow the falling notes."),
      el("p", { class: "home-hint" }, "New to piano? Start with Course → “Meet the Keys.”"),
      el("div", { class: "tiles" }, [
        tile("🎓  Course", trackProgressText(window.Course, "Reading lessons, beginner → up"), () => pathView(window.Course, "Course"), "primary"),
        tile("⏱  Daily Workout", window.Workout.doneToday() ? "Done today ✓ — go again?" : "A quick session keeps the streak", () => workoutView()),
        tile("🎸  Chords", trackProgressText(window.Chords, "Play chords to accompany songs"), () => pathView(window.Chords, "Chords")),
        tile("🎵  Songs", window.Songs.all().filter((s) => !s.exercise).length + " songs to play", () => songList()),
        tile("📖  Read Notes", "Practice + reading tests", () => readNotesMenu()),
        tile("🎹  Free Play", "Just play around", () => freePlay()),
      ]),
      el("div", { class: "home-footer" }, [
        el("button", { class: "foot-btn", onclick: () => { window.location.href = "about.html"; } }, "ℹ️  About"),
        el("button", { class: "foot-btn", onclick: () => window.Feedback.shareApp() }, "📤  Share"),
        el("button", { class: "foot-btn", onclick: () => window.Feedback.open() }, "💬  Feedback"),
        el("button", { class: "foot-btn", onclick: (e) => updateApp(e.currentTarget) }, "🔄  Update"),
      ]),
    ]));
  }

  // ---- Learning path (next-up prominent · tiers · completed collapsed) --
  // Generic over a track (window.Course reading path, or window.Chords).
  function pathView(track, title) {
    clearView();
    setChrome(title, { back: true });
    backBtn.onclick = home;
    const C = track;
    const back = () => pathView(track, title);
    const wrap = el("div", { class: "course-wrap" });

    const unitIcon = (u) => (u.type === "song" ? "♪" : u.type === "trainer" ? "📖" : "🎹");
    const askUnlock = (u) => {
      if (confirm("Unlock “" + u.title + "”?\n\nYou can start here and continue forward on the normal path from this point.")) {
        C.unlock(u.id);
        back();
      }
    };
    const unitRow = (u, i, done) => {
      const locked = !done && !C.unlocked(i);
      return el("button", {
        class: "song-row" + (locked ? " locked" : ""),
        onclick: locked ? () => askUnlock(u) : () => launchUnit(track, i, back),
      }, [
        el("span", { class: "song-dot unit" + (done ? " done" : "") }, locked ? "🔒" : done ? "✓" : unitIcon(u)),
        el("span", { class: "song-meta" }, [
          el("span", { class: "song-title" }, u.title),
          el("span", { class: "song-sub" }, u.blurb),
        ]),
        el("span", { class: "song-stars" + (locked ? " unlock-hint" : "") }, locked ? "🔓 Unlock" : (C.starsFor(u.id) ? starRow(C.starsFor(u.id)) : "")),
      ]);
    };

    // 1) Next up — the most prominent thing on the screen.
    const ni = C.nextIndex();
    if (ni >= 0) {
      const u = C.CURRICULUM[ni];
      wrap.append(el("div", { class: "next-up" }, [
        el("div", { class: "next-label" }, "NEXT UP"),
        el("button", { class: "next-card", onclick: () => launchUnit(track, ni, back) }, [
          el("span", { class: "next-icon" }, unitIcon(u)),
          el("span", { class: "next-meta" }, [
            el("span", { class: "next-title" }, u.title),
            el("span", { class: "next-blurb" }, u.blurb + "  ·  reach 80% to pass"),
          ]),
          el("span", { class: "next-go" }, "▶"),
        ]),
      ]));
    } else {
      wrap.append(el("div", { class: "next-up" }, el("div", { class: "next-done" }, "🎉 You've completed every lesson! Replay any below.")));
    }

    // 2) The path, grouped by tier — upcoming (not-complete) units shown openly.
    C.TIERS.forEach((tier) => {
      const idxs = C.CURRICULUM.map((u, i) => i).filter((i) => C.CURRICULUM[i].level === tier.id && !C.isComplete(C.CURRICULUM[i].id));
      if (tier.id === "advanced" && !C.CURRICULUM.some((u) => u.level === "advanced")) {
        wrap.append(el("h3", { class: "group-head" }, tier.name));
        wrap.append(el("div", { class: "coming-soon" }, "Coming soon — more lessons on the way."));
        return;
      }
      if (!idxs.length) return;
      wrap.append(el("h3", { class: "group-head" }, tier.name));
      const list = el("div", { class: "song-list course" });
      idxs.forEach((i) => list.append(unitRow(C.CURRICULUM[i], i, false)));
      wrap.append(list);
    });

    // 3) Completed — grouped, collapsed, replayable.
    const doneIdxs = C.CURRICULUM.map((u, i) => i).filter((i) => C.isComplete(C.CURRICULUM[i].id));
    if (doneIdxs.length) {
      const list = el("div", { class: "song-list course" });
      doneIdxs.forEach((i) => list.append(unitRow(C.CURRICULUM[i], i, true)));
      wrap.append(el("details", { class: "completed" }, [
        el("summary", {}, "✓ Completed (" + doneIdxs.length + ") — tap to review or redo"),
        list,
      ]));
    }

    view.append(wrap);
  }

  function launchUnit(track, i, back) {
    const u = track.CURRICULUM[i];
    const onDone = (res) => track.complete(u.id, res.stars || 0, res.accuracy);
    if (u.type === "song") {
      lesson(u.song, { mode: u.mode, onDone, returnTo: back, courseTitle: u.title, passMark: track.PASS });
    } else {
      trainerView({
        title: u.title, returnTo: back, onDone, goal: u.goal, passMark: track.PASS,
        displayMode: u.type === "keyfind" ? "name" : "staff",
        clef: u.clef || "treble",
        kbStart: u.kbStart, kbOctaves: u.kbOctaves,
        fixedNotes: u.type === "keyfind" ? u.notes : (u.fixedNotes || window.Trainer.LEVELS[u.level2 || 0]),
        prompt: u.type === "keyfind" ? "Find the key" : "Name the note",
      });
    }
  }

  // ---- Song list (grouped by difficulty, like Simply Piano's library) ---
  const GENRES = [
    ["all", "All"], ["kids", "Kids"], ["folk", "Folk"],
    ["classical", "Classical"], ["holiday", "Holiday"], ["hymn", "Hymns"], ["pop", "Pop"],
  ];
  function songDuration(song) {
    const beats = song.notes.reduce((t, n) => t + (n.beats || 1), 0);
    const secs = Math.round((beats / song.tempo) * 60);
    return secs >= 60 ? Math.round(secs / 60) + " min" : secs + " sec";
  }
  function songList(genre) {
    if (typeof genre !== "string") genre = "all"; // also used as a click handler
    clearView();
    setChrome("Songs", { back: true });
    backBtn.onclick = home;

    const wrap = el("div", { class: "song-wrap" });
    const chips = el("div", { class: "genre-chips" });
    GENRES.forEach(([id, label]) => {
      chips.append(el("button", { class: "chip" + (id === genre ? " active" : ""),
        onclick: () => songList(id) }, label));
    });
    wrap.append(chips);
    const list = el("div", { class: "song-list" });

    const genreLabel = (g) => (GENRES.find(([id]) => id === g) || [])[1] || "";
    const songRow = (song) => {
      const stars = starsFor(song.id);
      const sub = songDuration(song) + (song.genre ? "  ·  " + genreLabel(song.genre) : "");
      return el("button", { class: "song-row", onclick: () => lesson(song.id) }, [
        el("span", { class: "song-dot diff-" + song.difficulty }, "♪"),
        el("span", { class: "song-meta" }, [
          el("span", { class: "song-title" }, song.title + (song.user ? "  ·  yours" : "")),
          el("span", { class: "song-sub" }, sub),
        ]),
        el("span", { class: "song-stars" }, starRow(stars)),
      ]);
    };

    const all = window.Songs.all().filter((s) => !s.user && !s.exercise && (genre === "all" || s.genre === genre));
    const groups = [
      { name: "Beginner", test: (s) => s.difficulty <= 1 },
      { name: "Easy", test: (s) => s.difficulty === 2 },
      { name: "A bit more", test: (s) => s.difficulty === 3 },
      { name: "Hands together", test: (s) => s.difficulty >= 4 },
    ];
    groups.forEach((g) => {
      const songs = all.filter(g.test);
      if (!songs.length) return;
      list.append(el("h3", { class: "group-head" }, g.name));
      songs.forEach((s) => list.append(songRow(s)));
    });
    if (!all.length) list.append(el("div", { class: "coming-soon" }, "No songs in this style yet."));
    wrap.append(list);
    view.append(wrap);
  }

  // ---- Lesson -----------------------------------------------------------
  function lesson(songId, opts = {}) {
    const song = window.Songs.byId(songId);
    if (!song) return songList();
    clearView();
    setChrome(opts.courseTitle || song.title, { back: true });
    backBtn.onclick = opts.onBack || opts.returnTo || songList;

    let mode = opts.mode || "step";
    let tempoScale = 1;

    const progress = el("div", { class: "progress-bar" }, el("span"));
    const modeLabel = (m) => (m === "step" ? "Practice" : "Play in time");
    const modeHint = (m) => (m === "step"
      ? "Practice — play the glowing key when you're ready, no rush."
      : "Play in time — the notes fall to a beat. Use Tempo to slow it down.");
    const status = el("div", { class: "lesson-status" }, "Tap Start to begin");
    const lane = el("div", { class: "lane" });
    const kbEl = el("div", {});
    const kbWrap = el("div", { class: "kb-wrap" }, kbEl);

    const modeBtn = el("button", { class: "chip" + (mode === "step" ? " active" : ""), onclick: () => toggleMode() }, modeLabel(mode));
    const tempoVal = el("span", { class: "tempo-val" }, "100%");
    const tempo = el("input", { type: "range", min: "50", max: "100", step: "5", value: "100",
      oninput: (e) => { tempoScale = e.target.value / 100; tempoVal.textContent = e.target.value + "%"; } });
    const startBtn = el("button", { class: "chip play", onclick: () => begin() }, "▶ Start");
    const listenBtn = el("button", { class: "chip", onclick: () => engine.listen() }, "🔊 Listen");

    let hands = null;
    const controls = el("div", { class: "lesson-controls" }, [
      modeBtn, el("label", { class: "tempo" }, [el("span", {}, "Tempo"), tempo, tempoVal]),
      fingersChip(() => hands), listenBtn, startBtn,
    ]);
    view.append(el("div", { class: "lesson" }, [controls, progress, status, lane, kbWrap]));

    const r = window.Songs.rangeOf(song.notes);
    const startC = r.lo - ((r.lo % 12 + 12) % 12);
    const octaves = Math.max(1, Math.ceil((r.hi - startC) / 12));
    const kb = new window.Keyboard(kbEl, { startMidi: startC, octaves, showLabels: true });
    window._kb = kb;
    hands = new window.Hands(kb, kbWrap);
    hands.set(fingerMapForSong(song));
    hands.setOn(handsOn());

    const engine = new window.LessonEngine({
      laneEl: lane, keyboard: kb,
      onProgress: (i, n) => { progress.firstChild.style.width = (n ? (i / n) * 100 : 0) + "%"; },
      onStatus: (t) => (status.textContent = t),
      onComplete: (res) => finish(res),
    });
    window._active = engine;
    kb.onPress = (m) => engine.input(m);
    // Route the (persistent) mic to this lesson; grade by note name while it's on.
    window._micTarget = (m) => engine.input(m);
    engine.setOctaveTolerant(!!window._mic);

    function toggleMode() {
      mode = mode === "step" ? "moving" : "step";
      modeBtn.textContent = modeLabel(mode);
      modeBtn.classList.toggle("active", mode === "step");
      engine.load(song, { mode, tempoScale });
      status.textContent = modeHint(mode);
    }
    function begin() {
      engine.load(song, { mode, tempoScale });
      engine.start();
      startClock();
      startBtn.textContent = "↻ Restart";
      status.textContent = modeHint(mode);
    }
    function finish(res) {
      saveStars(song.id, res.stars);
      const prevToday = checkpointClock();
      const passed = !opts.passMark || res.accuracy >= opts.passMark;
      if (opts.onDone) opts.onDone(res, passed);
      const cont = opts.returnTo
        ? el("button", { class: "chip play", onclick: () => { overlay.remove(); opts.returnTo(); } }, passed ? "Continue ›" : "Back")
        : el("button", { class: "chip", onclick: () => { overlay.remove(); songList(); } }, "Songs");
      const again = el("button", { class: opts.returnTo ? "chip" : "chip play", onclick: () => { overlay.remove(); begin(); } }, opts.returnTo && !passed ? "Try again" : "Again");
      const passNote = opts.passMark
        ? el("div", { class: "result-sub" }, passed ? "Passed! (80%+)" : "Reach 80% to pass — try again.")
        : el("div", { class: "result-sub" }, res.good + " clean · " + res.ok + " with slips" + (res.missed ? " · " + res.missed + " missed" : ""));
      const overlay = el("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) overlay.remove(); } }, [
        el("div", { class: "card" }, [
          el("div", { class: "big-stars" }, starRow(res.stars)),
          el("div", { class: "result" }, Math.round(res.accuracy * 100) + "% accuracy"),
          passNote,
          el("div", { class: "result-callout" }, window.Stats.callout(prevToday)),
          el("div", { class: "card-actions" }, opts.returnTo ? [again, cont] : [cont, again]),
        ]),
      ]);
      view.append(overlay);
    }

    engine.load(song, { mode, tempoScale });
  }

  // ---- Onboarding quiz (per player): motivation → experience → daily goal.
  // Like Simply Piano's intro funnel — three taps, then a recommended plan.
  function onboardView() {
    const me = window.Profiles.active();
    const answers = {};
    const QUESTIONS = [
      { key: "goal", title: "Why do you want to play piano?", sub: "There's no wrong answer — this shapes your plan.",
        options: [["songs", "🎵", "Play songs I love"], ["relax", "🌙", "Relax and unwind"], ["challenge", "🏆", "Challenge myself"]] },
      { key: "exp", title: "Have you played before?", sub: "We'll start you in the right place.",
        options: [["new", "🌱", "Brand new"], ["some", "🌿", "I know a little"], ["played", "🌳", "I've played before"]] },
      { key: "minutes", title: "How long will you practice each day?", sub: "Short and steady beats long and rare.",
        options: [[5, "⏱", "5 minutes"], [10, "⏲", "10 minutes"], [15, "⏰", "15 minutes"]] },
    ];

    const ask = (qi) => {
      if (qi >= QUESTIONS.length) return plan();
      const q = QUESTIONS[qi];
      clearView();
      setChrome("Welcome" + (me ? ", " + me.name : ""), { back: qi > 0 });
      backBtn.onclick = () => ask(qi - 1);
      const grid = el("div", { class: "profiles-grid onboard-grid" });
      q.options.forEach(([val, emoji, label]) => {
        grid.append(el("button", { class: "profile-card", onclick: () => { answers[q.key] = val; ask(qi + 1); } }, [
          el("span", { class: "profile-emoji" }, emoji),
          el("span", { class: "profile-name" }, label),
        ]));
      });
      view.append(el("div", { class: "profiles" }, [
        el("h2", { class: "profiles-title" }, q.title),
        el("p", { class: "profiles-sub" }, q.sub),
        grid,
        el("button", { class: "foot-btn onboard-skip", onclick: () => { save({ skipped: true }); homeNow(); } }, "Skip for now"),
      ]));
    };

    function save(extra) {
      window.Stats.setOnboard(Object.assign({ done: true }, answers, extra || {}));
      if (answers.minutes) window.Stats.setGoalMin(answers.minutes);
    }
    function homeNow() { home(); }

    function plan() {
      save();
      // Recommended starting point by experience.
      const C = window.Course;
      let unitIdx = 0, note = "We'll start at the very beginning — Meet the Keys.";
      if (answers.exp === "some") {
        unitIdx = C.CURRICULUM.findIndex((u) => u.id === "u4");
        note = "You know the keys — we'll start you at reading notes.";
      } else if (answers.exp === "played") {
        unitIdx = C.CURRICULUM.findIndex((u) => u.id === "i1");
        note = "Welcome back! We'll start you at the Intermediate tier.";
      }
      const extra = answers.goal === "songs"
        ? " Since you're here to play songs, try the 🎸 Chords path too — it gets you accompanying songs fast."
        : answers.goal === "relax"
          ? " Take it at your own pace — Practice mode never rushes you."
          : " Reading tests and the Daily Workout will keep you sharp.";
      clearView();
      setChrome("Your plan", { back: false });
      view.append(el("div", { class: "profiles" }, [
        el("h2", { class: "profiles-title" }, "🎹 Your plan is ready" + (me ? ", " + me.name : "")),
        el("p", { class: "profiles-sub" }, note + extra),
        el("p", { class: "profiles-sub" }, "Daily goal: " + (answers.minutes || 10) + " minutes — the ⏱ Daily Workout fits it exactly."),
        el("div", { class: "card-actions" }, [
          el("button", { class: "chip play", onclick: () => {
            if (unitIdx > 0) window.Course.unlock(window.Course.CURRICULUM[unitIdx].id);
            launchUnit(window.Course, Math.max(0, unitIdx), () => pathView(window.Course, "Course"));
          } }, "▶ Start your first lesson"),
          el("button", { class: "chip", onclick: () => homeNow() }, "Explore first"),
        ]),
      ]));
    }

    ask(0);
  }

  // ---- Daily Workout: an auto-built 5/10/15-minute session --------------
  function workoutView() {
    clearView();
    setChrome("Daily Workout", { back: true });
    backBtn.onclick = home;

    let minutes = (window.Stats.getOnboard() || {}).minutes || 5;
    const wrap = el("div", { class: "profiles" }, [
      el("h2", { class: "profiles-title" }, window.Workout.doneToday() ? "Workout done today ✓" : "Today's workout"),
      el("p", { class: "profiles-sub" }, "A short session built for where you are: a reading warm-up, a song, and chords."
        + (window.Workout.doneToday() ? " Another round never hurts!" : "")),
    ]);
    const seg = el("div", { class: "seg" });
    const preview = el("div", { class: "song-list workout-preview" });
    const renderPreview = () => {
      preview.innerHTML = "";
      window.Workout.build(minutes).forEach((s, i) => {
        preview.append(el("div", { class: "song-row locked" }, [
          el("span", { class: "song-dot" }, s.kind === "song" ? "♪" : "📖"),
          el("span", { class: "song-meta" }, [
            el("span", { class: "song-title" }, (i + 1) + ". " + s.title),
          ]),
        ]));
      });
    };
    [5, 10, 15].forEach((m) => {
      const b = el("button", { class: "seg-btn" + (m === minutes ? " active" : ""), onclick: () => {
        minutes = m;
        seg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        renderPreview();
      } }, m + " min");
      seg.append(b);
    });
    wrap.append(el("div", { class: "workout-controls" }, [seg,
      el("button", { class: "chip play", onclick: () => run() }, "▶ Start workout")]));
    renderPreview();
    wrap.append(preview);
    view.append(wrap);

    function run() {
      const plan = window.Workout.build(minutes);
      const results = [];
      const t0 = performance.now();
      let i = 0;

      const launch = () => {
        if (i >= plan.length) return summary();
        const s = plan[i], idx = i;
        const label = "Workout " + (i + 1) + "/" + plan.length + " — " + s.title;
        const record = (res) => { results[idx] = res; };
        const nextSeg = () => { i++; launch(); };
        const quit = () => workoutView();
        if (s.kind === "song") {
          lesson(s.songId, { mode: s.mode, courseTitle: label, returnTo: nextSeg, onBack: quit, onDone: record });
        } else {
          trainerView(Object.assign({ title: label, returnTo: nextSeg, onBack: quit, onDone: record },
            s.trainerOpts));
        }
      };

      function summary() {
        window.Workout.markDone(minutes);
        clearView();
        setChrome("Workout complete", { back: true });
        backBtn.onclick = home;
        const done = results.filter(Boolean);
        const avg = done.length ? done.reduce((t, r) => t + (r.accuracy || 0), 0) / done.length : 0;
        const mins = Math.max(1, Math.round((performance.now() - t0) / 60000));
        const list = el("div", { class: "song-list" });
        plan.forEach((s, j) => {
          const r = results[j];
          list.append(el("div", { class: "song-row" }, [
            el("span", { class: "song-dot" + (r ? " unit done" : "") }, r ? "✓" : "–"),
            el("span", { class: "song-meta" }, [
              el("span", { class: "song-title" }, s.title),
              el("span", { class: "song-sub" }, r ? Math.round((r.accuracy || 0) * 100) + "%" : "skipped"),
            ]),
            el("span", { class: "song-stars" }, r ? starRow(r.stars || 0) : ""),
          ]));
        });
        view.append(el("div", { class: "profiles" }, [
          el("h2", { class: "profiles-title" }, "🎉 Workout complete!"),
          el("p", { class: "profiles-sub" }, Math.round(avg * 100) + "% average  ·  about " + mins + " min  ·  " + window.Stats.callout()),
          list,
          el("div", { class: "card-actions" }, [
            el("button", { class: "chip play", onclick: () => home() }, "Done"),
            el("button", { class: "chip", onclick: () => workoutView() }, "Go again"),
          ]),
        ]));
      }

      launch();
    }
  }

  // ---- Read Notes menu: practice (streak drill) or a longer test --------
  function readNotesMenu() {
    clearView();
    setChrome("Read Notes", { back: true });
    backBtn.onclick = home;
    const wrap = el("div", { class: "song-list" });

    wrap.append(el("h3", { class: "group-head" }, "Practice"));
    wrap.append(el("button", { class: "song-row", onclick: () => trainerView({ returnTo: readNotesMenu }) }, [
      el("span", { class: "song-dot" }, "📖"),
      el("span", { class: "song-meta" }, [
        el("span", { class: "song-title" }, "Endless practice"),
        el("span", { class: "song-sub" }, "Range grows as your streak builds — no pressure"),
      ]),
    ]));

    const TESTS = [
      { label: "30 notes", promptCount: 30 }, { label: "60 notes", promptCount: 60 },
      { label: "100 notes", promptCount: 100 }, { label: "2 minutes", timeLimit: 120 },
      { label: "5 minutes", timeLimit: 300 },
    ];
    [["treble", "Treble clef tests"], ["bass", "Bass clef tests"]].forEach(([clef, head]) => {
      wrap.append(el("h3", { class: "group-head" }, head));
      const chips = el("div", { class: "genre-chips test-chips" });
      TESTS.forEach((t) => {
        const testId = clef + "-" + (t.promptCount || (t.timeLimit / 60) + "min");
        let bests = {}; try { bests = JSON.parse(localStorage.getItem(window.Profiles.key("piano.trainerBest"))) || {}; } catch {}
        const b = bests[testId];
        chips.append(el("button", { class: "chip", onclick: () => trainerView({
          title: (clef === "bass" ? "Bass" : "Treble") + " test — " + t.label,
          promptCount: t.promptCount, timeLimit: t.timeLimit,
          showKey: false, clef, testId, returnTo: readNotesMenu,
          kbStart: clef === "bass" ? 48 : 60, kbOctaves: 2,
          fixedNotes: clef === "bass" ? [48, 50, 52, 53, 55, 57, 59, 60] : null,
        }) }, t.label + (b ? " · " + b.pct + "%" : "")));
      });
      wrap.append(chips);
    });
    wrap.append(el("p", { class: "profiles-sub" }, "Tests don't show the key hint and don't repeat misses — they measure how fluently you read. Your best score is saved."));
    view.append(wrap);
  }

  // ---- Note-reading trainer --------------------------------------------
  function trainerView(opts = {}) {
    clearView();
    setChrome(opts.title || "Read Notes", { back: true });
    backBtn.onclick = opts.onBack || opts.returnTo || home;

    const stats = el("div", { class: "trainer-stats" }, "Play the note you see");
    const svg = svgEl();
    const staff = el("div", { class: "staff-wrap" }, svg);
    const kbEl = el("div", {});
    const kbWrap = el("div", { class: "kb-wrap" }, kbEl);

    const kb = new window.Keyboard(kbEl, { startMidi: opts.kbStart || 60, octaves: opts.kbOctaves || 2, showLabels: true });
    window._kb = kb;
    const hands = new window.Hands(kb, kbWrap);
    hands.set(opts.clef === "bass" ? { left: { pinky: opts.kbStart || 48 } } : { right: opts.kbStart || 60 });
    hands.setOn(handsOn());

    const trainer = new window.Trainer({
      svgEl: svg, keyboard: kb,
      displayMode: opts.displayMode || "staff",
      clef: opts.clef || "treble",
      fixedNotes: opts.fixedNotes || null,
      goal: opts.goal || null,
      showKey: opts.showKey !== false,
      promptCount: opts.promptCount || null,
      timeLimit: opts.timeLimit || null,
      onUpdate: (s) => {
        if (opts.promptCount || opts.timeLimit) {
          const parts = [];
          if (opts.promptCount) parts.push("Note " + Math.min(s.prompts, opts.promptCount) + "/" + opts.promptCount);
          if (s.timeLeft != null) parts.push("⏱ " + Math.floor(s.timeLeft / 60) + ":" + String(s.timeLeft % 60).padStart(2, "0"));
          parts.push("✓ " + s.firstTry + "/" + s.answered + "  ·  " + s.accuracy + "%");
          stats.textContent = parts.join("  ·  ");
        } else if (opts.goal) {
          stats.textContent = (opts.prompt || "Name the note") + " — " + s.correct + "/" + s.goal + "  ·  " + s.accuracy + "%";
        } else {
          stats.textContent = "Level " + s.level + "  ·  ✓ " + s.correct + "/" + s.total + "  ·  streak " + s.streak + "  ·  " + s.accuracy + "%";
        }
      },
      onDone: (res) => finish(res),
    });
    window._active = trainer;
    kb.onPress = (m) => trainer.input(m);
    window._micTarget = (m) => trainer.input(m); // global mic feeds the drill

    const showKeyBtn = el("button", { class: "chip" + (opts.showKey !== false ? " active" : ""),
      onclick: () => { const on = !showKeyBtn.classList.contains("active"); showKeyBtn.classList.toggle("active", on); trainer.setShowKey(on); } }, "Show key");
    const controls = el("div", { class: "lesson-controls" }, [
      showKeyBtn, fingersChip(() => hands),
      el("button", { class: "chip", onclick: () => trainer.next() }, "Skip ›"),
    ]);
    view.append(el("div", { class: "lesson" }, [controls, stats, staff, kbWrap]));

    function finish(res) {
      const prevToday = checkpointClock();
      const passed = !opts.passMark || res.accuracy >= opts.passMark;
      if (opts.onDone) opts.onDone(res, passed);
      const pct = Math.round((res.accuracy || 0) * 100);
      const actions = [];
      actions.push(el("button", { class: "chip", onclick: () => { overlay.remove(); restart(); } }, "Try again"));
      if (opts.returnTo) actions.push(el("button", { class: "chip play", onclick: () => { overlay.remove(); opts.returnTo(); } }, passed ? "Continue ›" : "Back"));
      // Test results: time, speed, and a saved personal best per test id.
      let testLines = null;
      if (res.elapsedMs != null) {
        const secs = Math.round(res.elapsedMs / 1000);
        const time = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
        let bestNote = "";
        if (opts.testId) {
          const bKey = window.Profiles.key("piano.trainerBest");
          let bests = {}; try { bests = JSON.parse(localStorage.getItem(bKey)) || {}; } catch {}
          const prev = bests[opts.testId];
          const better = !prev || pct > prev.pct || (pct === prev.pct && res.notesPerMin > prev.npm);
          if (better) { bests[opts.testId] = { pct, npm: res.notesPerMin }; localStorage.setItem(bKey, JSON.stringify(bests)); }
          bestNote = better ? "  ·  🏆 New personal best!" : "  ·  best: " + prev.pct + "% at " + prev.npm + "/min";
        }
        testLines = el("div", { class: "result-sub" },
          res.firstTry + "/" + res.prompts + " first try  ·  " + time + "  ·  " + res.notesPerMin + " notes/min" + bestNote);
      }
      const overlay = el("div", { class: "overlay" }, [
        el("div", { class: "card" }, [
          el("div", { class: "big-stars" }, starRow(res.stars)),
          el("div", { class: "result" }, res.elapsedMs != null ? pct + "% accuracy" : res.correct + "/" + res.total + " correct · " + pct + "%"),
          testLines,
          opts.passMark ? el("div", { class: "result-sub" }, passed ? "Passed! (80%+)" : "Reach 80% to pass — give it another go.") : null,
          el("div", { class: "result-callout" }, window.Stats.callout(prevToday)),
          el("div", { class: "card-actions" }, actions),
        ]),
      ]);
      view.append(overlay);
    }
    function restart() { trainerView(opts); }

    trainer.start();
    startClock();
  }

  // ---- Free play --------------------------------------------------------
  // Real-piano-sized keys, calibrated to an 11" iPad and adapting per device.
  // Pick a hand so keys stay finger-sized; a full two-hand span is wider than
  // an 11" screen, so "Both" shows a slightly tighter, fully-visible layout.
  function freePlay() {
    clearView();
    setChrome("Free Play", { back: true });
    backBtn.onclick = home;

    const dev = deviceProfile();
    let hand = "right";    // left | both | right
    let shift = 0;         // octave offset from the hand's home position
    let kb, hands;

    const kbEl = el("div", {});
    const kbWrap = el("div", { class: "kb-wrap grow" }, kbEl);

    const handBtns = {};
    const seg = el("div", { class: "seg" });
    [["left", "🤚 Left hand"], ["right", "✋ Right hand"]].forEach(([h, label]) => {
      const b = el("button", { class: "seg-btn" + (h === hand ? " active" : ""), onclick: () => setHand(h) }, label);
      handBtns[h] = b; seg.append(b);
    });

    const octLabel = el("span", { class: "tempo-val" }, "C4");
    const down = el("button", { class: "chip", onclick: () => moveBy(-1) }, "▼ Lower");
    const up = el("button", { class: "chip", onclick: () => moveBy(1) }, "Higher ▲");
    const labels = el("label", { class: "tempo" }, [
      el("input", { type: "checkbox", checked: "checked", onchange: (e) => kb.setLabels(e.target.checked) }),
      el("span", {}, "Labels"),
    ]);
    const hint = el("div", { class: "lesson-status" });

    view.append(el("div", { class: "lesson" }, [
      el("div", { class: "lesson-controls" }, [seg, down, octLabel, up, labels, fingersChip(() => hands)]),
      hint, kbWrap,
    ]));

    kb = new window.Keyboard(kbEl, { startMidi: 60 });
    window._kb = kb;
    hands = new window.Hands(kb, kbWrap);
    hands.setOn(handsOn());
    // With the mic on, light up the key for whatever note it hears (if in view).
    window._micTarget = (m) => { if (kb.keyEls.get(m)) kb.flash(m, "good"); };

    // The C your thumb anchors on: Right = middle C (C4), Left = an octave lower (C3).
    const anchorC = (h) => (h === "left" ? 48 : 60);
    // ~real-piano white-key width. Calibrated for an 11" iPad; a touch smaller on a phone.
    const targetKeyPx = () => (dev.tablet ? 112 : 80);

    function layout() {
      const w = kbEl.clientWidth || kbWrap.clientWidth || window.innerWidth;
      const whiteCount = Math.max(5, Math.min(22, Math.round(w / targetKeyPx())));
      const home = anchorC(hand) + shift * 12;
      // Place the home C 3 white keys in (leftmost = the G a fourth below) so the
      // thumb sits a bit toward the middle with lower keys to its left. The left
      // hand's fingers reach a 5th BELOW the thumb, so give it one more step.
      const start = Math.max(21, Math.min(96, home - (hand === "left" ? 7 : 5)));
      kb.setWhiteRange(start, whiteCount);
      // Thumb anchors on the home C for either hand (matches the hint text).
      hands.set(hand === "left" ? { left: { thumb: home } } : { right: home });
      octLabel.textContent = window.Theory.midiToName(home);
      let msg = "Real-size keys — thumb on " + window.Theory.midiToName(home)
        + " for your " + hand + " hand. Use ▼ / ▲ to slide along the keyboard.";
      if (dev.phone && window.innerHeight > window.innerWidth) msg += "  Turn your phone sideways for more keys.";
      hint.textContent = msg;
    }
    function setHand(h) { hand = h; shift = 0; Object.entries(handBtns).forEach(([k, b]) => b.classList.toggle("active", k === h)); layout(); }
    function moveBy(d) { shift = Math.max(-2, Math.min(2, shift + d)); layout(); }

    layout();
    window._relayout = layout; // recompute key count on resize/orientation change
    startClock(); // free play counts as practice too
  }

  // Unlock audio on first gesture (iOS requirement).
  window.addEventListener("pointerdown", function unlock() {
    window.PianoAudio.ensure();
    window.removeEventListener("pointerdown", unlock);
  });
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => {
    if (window._relayout) window._relayout();
    else if (window._kb && !window._kb.fixedRange) window._kb.render();
  }, 150); });
  // Service worker + auto-update on reopen/refocus. iOS resumes the installed app
  // from memory and never checks for a new version on its own, so we explicitly
  // check whenever the app becomes visible; when a new version activates it takes
  // control and we reload once to the fresh build.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const hadController = !!navigator.serviceWorker.controller;
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || refreshing) return; // ignore the first-ever install
        refreshing = true;
        location.reload();
      });
      navigator.serviceWorker.register("sw.js").then((reg) => {
        const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
        document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
        window.addEventListener("focus", check);
        check();
      }).catch(() => {});
    });
  }

  initChrome();
  start();
})();
