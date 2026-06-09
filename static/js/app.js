/* Simpli Piano — app shell: view routing, screens, progress, mic input.
 * Vanilla single-page app; each view rebuilds the #view container. */
(() => {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const view = document.getElementById("view");
  const titleEl = document.getElementById("view-title");
  const backBtn = document.getElementById("back-btn");
  const actionsEl = document.getElementById("topbar-actions");

  // ---- Progress (localStorage) -----------------------------------------
  const PROG_KEY = "piano.progress";
  const loadProgress = () => { try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch { return {}; } };
  const saveStars = (songId, stars) => {
    const p = loadProgress();
    if (!p[songId] || stars > p[songId].stars) { p[songId] = { stars }; localStorage.setItem(PROG_KEY, JSON.stringify(p)); }
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
    if (window._mic) { window._mic.stop(); window._mic = null; }
    if (window._active && window._active.stop) { try { window._active.stop(); } catch {} window._active = null; }
    view.innerHTML = "";
    window._kb = null;
  }

  // ---- Microphone toggle (shared by lessons + trainer) ------------------
  function micToggle(feed, hooks = {}) {
    const note = el("span", { class: "mic-note" });
    const btn = el("button", { class: "chip mic" }, "🎤 Mic");
    btn.onclick = async () => {
      if (window._mic) { window._mic.stop(); window._mic = null; btn.classList.remove("active"); note.textContent = ""; hooks.onStop && hooks.onStop(); return; }
      if (!window.Mic.supported) { note.textContent = "no mic"; return; }
      try {
        const mic = new window.Mic.Mic({
          onNote: (m) => feed(m),
          onLevel: (m) => { note.textContent = "♪ " + window.Theory.midiToName(m); },
        });
        await mic.start();
        window._mic = mic; btn.classList.add("active"); note.textContent = "listening…";
        hooks.onStart && hooks.onStart();
      } catch { note.textContent = "mic blocked"; }
    };
    return el("span", { class: "mic-wrap" }, [btn, note]);
  }

  // ---- Home -------------------------------------------------------------
  function home() {
    clearView();
    setChrome("Simpli&nbsp;Piano", { back: false });
    backBtn.onclick = null;
    const tile = (label, sub, onclick, cls) =>
      el("button", { class: "tile " + (cls || ""), onclick }, [
        el("span", { class: "tile-label" }, label),
        el("span", { class: "tile-sub" }, sub),
      ]);
    view.append(el("div", { class: "home" }, [
      el("p", { class: "tagline" }, "Learn piano the simple way — follow the falling notes."),
      el("div", { class: "tiles" }, [
        tile("🎓  Course", "Step-by-step lessons", () => courseView(), "primary"),
        tile("🎵  Songs", "Guided play-along", () => songList()),
        tile("📖  Read Notes", "Note-reading practice", () => trainerView()),
        tile("🎹  Free Play", "Just play around", () => freePlay()),
        tile("✏️  Add a Song", "Type in your own", () => editor()),
      ]),
      el("div", { class: "home-footer" }, [
        el("button", { class: "foot-btn", onclick: () => window.Feedback.shareApp() }, "📤  Share"),
        el("button", { class: "foot-btn", onclick: () => window.Feedback.open() }, "💬  Feedback"),
      ]),
    ]));
  }

  // ---- Course path ------------------------------------------------------
  function courseView() {
    clearView();
    setChrome("Course", { back: true });
    backBtn.onclick = home;
    const list = el("div", { class: "song-list course" });
    window.Course.CURRICULUM.forEach((u, i) => {
      const open = window.Course.unlocked(i);
      const stars = window.Course.starsFor(u.id);
      const icon = !open ? "🔒" : stars ? "✓" : (u.type === "song" ? "♪" : u.type === "trainer" ? "📖" : "🎹");
      const row = el("button", { class: "song-row" + (open ? "" : " locked"), onclick: open ? () => launchUnit(i) : null }, [
        el("span", { class: "song-dot unit" + (stars ? " done" : "") }, icon),
        el("span", { class: "song-meta" }, [
          el("span", { class: "song-title" }, (i + 1) + ". " + u.title),
          el("span", { class: "song-sub" }, u.blurb),
        ]),
        el("span", { class: "song-stars" }, stars ? starRow(stars) : ""),
      ]);
      list.append(row);
    });
    view.append(list);
  }

  function launchUnit(i) {
    const u = window.Course.CURRICULUM[i];
    const onDone = (res) => window.Course.complete(u.id, res.stars || 1);
    if (u.type === "song") {
      lesson(u.song, { mode: u.mode, onDone, returnTo: courseView, courseTitle: u.title });
    } else {
      trainerView({
        title: u.title, returnTo: courseView, onDone, goal: u.goal,
        displayMode: u.type === "keyfind" ? "name" : "staff",
        fixedNotes: u.type === "keyfind" ? u.notes : window.Trainer.LEVELS[u.level],
        prompt: u.type === "keyfind" ? "Find the key" : "Name the note",
      });
    }
  }

  // ---- Song list --------------------------------------------------------
  function songList() {
    clearView();
    setChrome("Songs", { back: true });
    backBtn.onclick = home;
    const list = el("div", { class: "song-list" });
    window.Songs.all().forEach((song) => {
      const stars = starsFor(song.id);
      list.append(el("button", { class: "song-row", onclick: () => lesson(song.id) }, [
        el("span", { class: "song-dot diff-" + song.difficulty }, "♪"),
        el("span", { class: "song-meta" }, [
          el("span", { class: "song-title" }, song.title + (song.user ? "  ·  yours" : "")),
          el("span", { class: "song-sub" }, "Level " + song.difficulty + " · " + song.notes.length + " notes"),
        ]),
        el("span", { class: "song-stars" }, starRow(stars)),
      ]));
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
    const status = el("div", { class: "lesson-status" }, "Tap Start");
    const lane = el("div", { class: "lane" });
    const kbEl = el("div", {});
    const kbWrap = el("div", { class: "kb-wrap" }, kbEl);

    const modeBtn = el("button", { class: "chip" + (mode === "step" ? " active" : ""), onclick: () => toggleMode() }, mode === "step" ? "Step" : "Moving");
    const tempoVal = el("span", { class: "tempo-val" }, "100%");
    const tempo = el("input", { type: "range", min: "50", max: "100", step: "5", value: "100",
      oninput: (e) => { tempoScale = e.target.value / 100; tempoVal.textContent = e.target.value + "%"; } });
    const startBtn = el("button", { class: "chip play", onclick: () => begin() }, "▶ Start");
    const listenBtn = el("button", { class: "chip", onclick: () => engine.listen() }, "🔊 Listen");

    const controls = el("div", { class: "lesson-controls" }, [
      modeBtn, el("label", { class: "tempo" }, [el("span", {}, "Tempo"), tempo, tempoVal]),
      listenBtn, startBtn,
      micToggle((m) => engine.input(m), {
        onStart: () => engine.setOctaveTolerant(true),
        onStop: () => engine.setOctaveTolerant(false),
      }),
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

    function toggleMode() {
      mode = mode === "step" ? "moving" : "step";
      modeBtn.textContent = mode === "step" ? "Step" : "Moving";
      modeBtn.classList.toggle("active", mode === "step");
      engine.load(song, { mode, tempoScale });
    }
    function begin() {
      engine.load(song, { mode, tempoScale });
      engine.start();
      startBtn.textContent = "↻ Restart";
    }
    function finish(res) {
      saveStars(song.id, res.stars);
      if (opts.onDone) opts.onDone(res);
      const cont = opts.returnTo
        ? el("button", { class: "chip play", onclick: () => { overlay.remove(); opts.returnTo(); } }, "Continue ›")
        : el("button", { class: "chip", onclick: () => { overlay.remove(); songList(); } }, "Songs");
      const again = el("button", { class: opts.returnTo ? "chip" : "chip play", onclick: () => { overlay.remove(); begin(); } }, "Again");
      const overlay = el("div", { class: "overlay", onclick: (e) => { if (e.target === overlay) overlay.remove(); } }, [
        el("div", { class: "card" }, [
          el("div", { class: "big-stars" }, starRow(res.stars)),
          el("div", { class: "result" }, Math.round(res.accuracy * 100) + "% accuracy"),
          el("div", { class: "result-sub" }, res.good + " clean · " + res.ok + " with slips" + (res.missed ? " · " + res.missed + " missed" : "")),
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

    const kb = new window.Keyboard(kbEl, { startMidi: 60, octaves: 2, showLabels: true });
    window._kb = kb;

    const trainer = new window.Trainer({
      svgEl: svg, keyboard: kb,
      displayMode: opts.displayMode || "staff",
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

    const showKeyBtn = el("button", { class: "chip" + (opts.showKey !== false ? " active" : ""),
      onclick: () => { const on = !showKeyBtn.classList.contains("active"); showKeyBtn.classList.toggle("active", on); trainer.setShowKey(on); } }, "Show key");
    const controls = el("div", { class: "lesson-controls" }, [
      showKeyBtn,
      el("button", { class: "chip", onclick: () => trainer.next() }, "Skip ›"),
      micToggle((m) => trainer.input(m)),
    ]);
    view.append(el("div", { class: "lesson" }, [controls, stats, staff, kbWrap]));

    function finish(res) {
      if (opts.onDone) opts.onDone(res);
      const overlay = el("div", { class: "overlay" }, [
        el("div", { class: "card" }, [
          el("div", { class: "big-stars" }, starRow(res.stars)),
          el("div", { class: "result" }, res.correct + "/" + res.total + " correct"),
          el("div", { class: "card-actions" }, [
            el("button", { class: "chip play", onclick: () => { overlay.remove(); (opts.returnTo || home)(); } }, "Continue ›"),
          ]),
        ]),
      ]);
      view.append(overlay);
    }

    trainer.start();
  }

  // ---- Free play --------------------------------------------------------
  function freePlay() {
    clearView();
    let start = 60, kb;
    const kbEl = el("div", {});
    const octLabel = el("span", { class: "tempo-val" }, "C4");
    const setOct = (d) => { start = Math.min(96, Math.max(24, start + d)); kb.setRange(start, kb.octaves); octLabel.textContent = window.Theory.midiToName(start); };
    const down = el("button", { class: "chip", onclick: () => setOct(-12) }, "–");
    const up = el("button", { class: "chip", onclick: () => setOct(12) }, "+");
    const labels = el("label", { class: "tempo" }, [
      el("input", { type: "checkbox", checked: "checked", onchange: (e) => kb.setLabels(e.target.checked) }),
      el("span", {}, "Labels"),
    ]);
    setChrome("Free Play", { back: true, actions: [down, octLabel, up] });
    backBtn.onclick = home;
    view.append(el("div", { class: "lesson" }, [el("div", { class: "lesson-controls" }, [labels]), el("div", { class: "kb-wrap grow" }, kbEl)]));
    kb = new window.Keyboard(kbEl, { startMidi: start });
    window._kb = kb;
  }

  // ---- Song editor ------------------------------------------------------
  function editor(editId) {
    clearView();
    setChrome("Add a Song", { back: true });
    backBtn.onclick = songList;

    const existing = editId ? window.Songs.byId(editId) : null;
    const title = el("input", { type: "text", class: "field", placeholder: "Song title", value: existing?.title || "" });
    const tempo = el("input", { type: "number", class: "field small", min: "40", max: "200", value: existing?.tempo || 90 });
    const notes = el("textarea", { class: "field area", placeholder: "E D C D E E Eh   D D Dh   E G Gh",
      html: existing ? window.Songs.serialize(existing.notes) : "" });
    const msg = el("div", { class: "editor-msg" });
    const showMsg = (t, bad) => { msg.textContent = t; msg.className = "editor-msg" + (bad ? " bad" : " ok"); };

    const help = el("details", { class: "help" }, [
      el("summary", {}, "How to type notes"),
      el("div", { class: "html",
        html: "Letters <b>A–G</b>, space-separated. Octave digit optional (sticky), e.g. <code>C4</code>. "
            + "Durations: <code>w</code> whole · <code>h</code> half · <code>q</code> quarter (default) · "
            + "<code>e</code> eighth · <code>s</code> sixteenth (add <code>.</code> to dot). "
            + "Sharps/flats: <code>F#</code> <code>Bb</code>. Rest: <code>Rq</code>. Chord: <code>C+E+G</code>." }),
    ]);

    const preview = el("button", { class: "chip", onclick: () => {
      const { notes: ns, errors } = window.Songs.parseSong(notes.value);
      if (errors.length) return showMsg("Can't read: " + errors.join(", "), true);
      if (!ns.length) return showMsg("Nothing to play yet.", true);
      tempPlay(ns, +tempo.value || 90);
    } }, "🔊 Preview");

    const save = el("button", { class: "chip play", onclick: () => {
      const res = window.Songs.saveUserSong({ id: existing?.id, title: title.value.trim(), tempo: +tempo.value || 90, src: notes.value });
      if (res.errors) return showMsg("Can't save: " + res.errors.join(", "), true);
      songList();
    } }, existing ? "Save changes" : "Save song");

    view.append(el("div", { class: "editor" }, [
      el("div", { class: "field-row" }, [title, tempo]),
      notes, help, msg,
      el("div", { class: "editor-actions" }, [preview, save]),
      userSongsPanel(),
    ]));
  }

  function userSongsPanel() {
    const mine = window.Songs.loadUser();
    if (!mine.length) return el("div", {});
    const wrap = el("div", { class: "mine" }, el("h3", {}, "Your songs"));
    mine.forEach((s) => wrap.append(el("div", { class: "mine-row" }, [
      el("span", {}, s.title),
      el("button", { class: "link", onclick: () => editor(s.id) }, "Edit"),
      el("button", { class: "link danger", onclick: () => { window.Songs.deleteUserSong(s.id); editor(); } }, "Delete"),
    ])));
    return wrap;
  }

  function tempPlay(ns, tempo) {
    let t = 0; const mpb = 60000 / tempo;
    ns.forEach((s) => {
      if (!s.rest) (Array.isArray(s.midi) ? s.midi : [s.midi]).forEach((m) =>
        setTimeout(() => window.PianoAudio.pluck(m, Math.max(180, s.beats * mpb * 0.9)), t));
      t += s.beats * mpb;
    });
  }

  // Unlock audio on first gesture (iOS requirement).
  window.addEventListener("pointerdown", function unlock() {
    window.PianoAudio.ensure();
    window.removeEventListener("pointerdown", unlock);
  });
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (window._kb && !window._kb.fixedRange) window._kb.render(); }, 150); });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  home();
})();
