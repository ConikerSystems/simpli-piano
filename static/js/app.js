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
    view.innerHTML = "";
    window._kb = null;
    window._relayout = null;
    window._micTarget = null;
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
    document.getElementById("app-footer").innerHTML =
      'Developed by <a href="https://conikersystems.com" target="_blank" rel="noopener">Coniker Systems™</a>'
      + '<span class="footer-sep">·</span>© 2026 Coniker Systems™'
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
  function trackProgressText(track, intro) {
    const total = track.CURRICULUM.length;
    const done = track.CURRICULUM.filter((u) => track.isComplete(u.id)).length;
    return done ? done + " of " + total + " done — keep going!" : intro;
  }
  function home() {
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
      el("p", { class: "tagline" }, "Learn piano the simple way — follow the falling notes."),
      el("p", { class: "home-hint" }, "New to piano? Start with Course → “Meet the Keys.”"),
      el("div", { class: "tiles" }, [
        tile("🎓  Course", trackProgressText(window.Course, "Reading lessons, beginner → up"), () => pathView(window.Course, "Course"), "primary"),
        tile("🎸  Chords", trackProgressText(window.Chords, "Play chords to accompany songs"), () => pathView(window.Chords, "Chords")),
        tile("🎵  Songs", window.Songs.all().filter((s) => !s.exercise).length + " songs to play", () => songList()),
        tile("📖  Read Notes", "Note-reading practice", () => trainerView()),
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
    const unitRow = (u, i, done) => el("button", {
      class: "song-row" + (!done && !C.unlocked(i) ? " locked" : ""),
      onclick: (!done && !C.unlocked(i)) ? null : () => launchUnit(track, i, back),
    }, [
      el("span", { class: "song-dot unit" + (done ? " done" : "") }, !done && !C.unlocked(i) ? "🔒" : done ? "✓" : unitIcon(u)),
      el("span", { class: "song-meta" }, [
        el("span", { class: "song-title" }, u.title),
        el("span", { class: "song-sub" }, u.blurb),
      ]),
      el("span", { class: "song-stars" }, C.starsFor(u.id) ? starRow(C.starsFor(u.id)) : ""),
    ]);

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
  function songList() {
    clearView();
    setChrome("Songs", { back: true });
    backBtn.onclick = home;
    const list = el("div", { class: "song-list" });

    const songRow = (song) => {
      const stars = starsFor(song.id);
      return el("button", { class: "song-row", onclick: () => lesson(song.id) }, [
        el("span", { class: "song-dot diff-" + song.difficulty }, "♪"),
        el("span", { class: "song-meta" }, [
          el("span", { class: "song-title" }, song.title + (song.user ? "  ·  yours" : "")),
          el("span", { class: "song-sub" }, song.notes.length + " notes"),
        ]),
        el("span", { class: "song-stars" }, starRow(stars)),
      ]);
    };

    const all = window.Songs.all();
    const groups = [
      { name: "Beginner", test: (s) => !s.user && !s.exercise && s.difficulty <= 1 },
      { name: "Easy", test: (s) => !s.user && !s.exercise && s.difficulty === 2 },
      { name: "A bit more", test: (s) => !s.user && !s.exercise && s.difficulty >= 3 },
    ];
    groups.forEach((g) => {
      const songs = all.filter(g.test);
      if (!songs.length) return;
      list.append(el("h3", { class: "group-head" }, g.name));
      songs.forEach((s) => list.append(songRow(s)));
    });
    view.append(list);
  }

  // ---- Lesson -----------------------------------------------------------
  function lesson(songId, opts = {}) {
    const song = window.Songs.byId(songId);
    if (!song) return songList();
    clearView();
    setChrome(opts.courseTitle || song.title, { back: true });
    backBtn.onclick = opts.returnTo || songList;

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

    const controls = el("div", { class: "lesson-controls" }, [
      modeBtn, el("label", { class: "tempo" }, [el("span", {}, "Tempo"), tempo, tempoVal]),
      listenBtn, startBtn,
    ]);
    view.append(el("div", { class: "lesson" }, [controls, progress, status, lane, kbWrap]));

    const r = window.Songs.rangeOf(song.notes);
    const startC = r.lo - ((r.lo % 12 + 12) % 12);
    const octaves = Math.max(1, Math.ceil((r.hi - startC) / 12));
    const kb = new window.Keyboard(kbEl, { startMidi: startC, octaves, showLabels: true });
    window._kb = kb;

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
      startBtn.textContent = "↻ Restart";
      status.textContent = modeHint(mode);
    }
    function finish(res) {
      saveStars(song.id, res.stars);
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
          el("div", { class: "card-actions" }, opts.returnTo ? [again, cont] : [cont, again]),
        ]),
      ]);
      view.append(overlay);
    }

    engine.load(song, { mode, tempoScale });
  }

  // ---- Note-reading trainer --------------------------------------------
  function trainerView(opts = {}) {
    clearView();
    setChrome(opts.title || "Read Notes", { back: true });
    backBtn.onclick = opts.returnTo || home;

    const stats = el("div", { class: "trainer-stats" }, "Play the note you see");
    const svg = svgEl();
    const staff = el("div", { class: "staff-wrap" }, svg);
    const kbEl = el("div", {});
    const kbWrap = el("div", { class: "kb-wrap" }, kbEl);

    const kb = new window.Keyboard(kbEl, { startMidi: opts.kbStart || 60, octaves: opts.kbOctaves || 2, showLabels: true });
    window._kb = kb;

    const trainer = new window.Trainer({
      svgEl: svg, keyboard: kb,
      displayMode: opts.displayMode || "staff",
      clef: opts.clef || "treble",
      fixedNotes: opts.fixedNotes || null,
      goal: opts.goal || null,
      showKey: opts.showKey !== false,
      onUpdate: (s) => {
        stats.textContent = opts.goal
          ? (opts.prompt || "Name the note") + " — " + s.correct + "/" + s.goal + "  ·  " + s.accuracy + "%"
          : "Level " + s.level + "  ·  ✓ " + s.correct + "/" + s.total + "  ·  streak " + s.streak + "  ·  " + s.accuracy + "%";
      },
      onDone: (res) => finish(res),
    });
    window._active = trainer;
    kb.onPress = (m) => trainer.input(m);
    window._micTarget = (m) => trainer.input(m); // global mic feeds the drill

    const showKeyBtn = el("button", { class: "chip" + (opts.showKey !== false ? " active" : ""),
      onclick: () => { const on = !showKeyBtn.classList.contains("active"); showKeyBtn.classList.toggle("active", on); trainer.setShowKey(on); } }, "Show key");
    const controls = el("div", { class: "lesson-controls" }, [
      showKeyBtn,
      el("button", { class: "chip", onclick: () => trainer.next() }, "Skip ›"),
    ]);
    view.append(el("div", { class: "lesson" }, [controls, stats, staff, kbWrap]));

    function finish(res) {
      const passed = !opts.passMark || res.accuracy >= opts.passMark;
      if (opts.onDone) opts.onDone(res, passed);
      const pct = Math.round((res.accuracy || 0) * 100);
      const actions = [];
      actions.push(el("button", { class: "chip", onclick: () => { overlay.remove(); restart(); } }, "Try again"));
      if (opts.returnTo) actions.push(el("button", { class: "chip play", onclick: () => { overlay.remove(); opts.returnTo(); } }, passed ? "Continue ›" : "Back"));
      const overlay = el("div", { class: "overlay" }, [
        el("div", { class: "card" }, [
          el("div", { class: "big-stars" }, starRow(res.stars)),
          el("div", { class: "result" }, res.correct + "/" + res.total + " correct · " + pct + "%"),
          opts.passMark ? el("div", { class: "result-sub" }, passed ? "Passed! (80%+)" : "Reach 80% to pass — give it another go.") : null,
          el("div", { class: "card-actions" }, actions),
        ]),
      ]);
      view.append(overlay);
    }
    function restart() { trainerView(opts); }

    trainer.start();
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
    let kb;

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
      el("div", { class: "lesson-controls" }, [seg, down, octLabel, up, labels]),
      hint, kbWrap,
    ]));

    kb = new window.Keyboard(kbEl, { startMidi: 60 });
    window._kb = kb;
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
      // thumb sits a bit toward the middle with lower keys to its left.
      const start = Math.max(21, Math.min(96, home - 5));
      kb.setWhiteRange(start, whiteCount);
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
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  initChrome();
  start();
})();
