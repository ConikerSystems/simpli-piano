/* Practice time, the daily streak, and the goal callouts.
 * Run: node tests/stats.test.js
 *
 * Why this file exists: practice is logged per LOCAL calendar day. If that ever
 * became UTC, evening practice east of Greenwich would land on tomorrow — a
 * learner practising at 9pm would watch their streak reset overnight, with
 * nothing in the app looking broken. The clock is faked here so that stays
 * provable rather than assumed. */
"use strict";
const { t, eq, ok, done, loadApp } = require("./_stub.js");

const { window, storage } = loadApp(["version", "profiles", "keyboard", "library", "songs", "stats"]);
const Stats = window.Stats;
const KEY = () => window.Profiles.key("piano.stats");

/* Run fn with the wall clock pinned to a local date/time. */
function at(y, mo, d, h, mi, fn) {
  const Real = Date;
  const fixed = new Real(y, mo - 1, d, h, mi, 0);
  class Fake extends Real {
    constructor(...a) { if (a.length === 0) super(fixed.getTime()); else super(...a); }
    static now() { return fixed.getTime(); }
  }
  global.Date = Fake;
  try { return fn(); } finally { global.Date = Real; }
}

const seed = (days, extra = {}) => { storage.clear(); storage.setItem(KEY(), JSON.stringify({ days, ...extra })); };
const read = () => JSON.parse(storage.getItem(KEY()));

// ---- the day boundary -------------------------------------------------------
t("late-evening practice belongs to today, not tomorrow", () => {
  // The bug this guards: a UTC day key would roll 23:30 EDT into the next date.
  at(2026, 7, 4, 23, 30, () => eq(Stats.dayKey(), "2026-07-04"));
});

t("early-morning practice belongs to today, not yesterday", () => {
  at(2026, 7, 4, 0, 15, () => eq(Stats.dayKey(), "2026-07-04"));
});

t("day keys are zero-padded so they sort", () => {
  at(2026, 1, 5, 12, 0, () => eq(Stats.dayKey(), "2026-01-05"));
});

t("an offset walks back real calendar days, across a month boundary", () => {
  at(2026, 3, 2, 12, 0, () => {
    eq(Stats.dayKey(-1), "2026-03-01");
    eq(Stats.dayKey(-2), "2026-02-28");
  });
});

// ---- logging ----------------------------------------------------------------
t("logging adds to today and accumulates", () => {
  at(2026, 7, 4, 10, 0, () => {
    seed({});
    Stats.log(120);
    Stats.log(60);
    eq(Stats.today(), 180);
    eq(read().days["2026-07-04"], 180);
  });
});

t("zero and negative practice are ignored", () => {
  at(2026, 7, 4, 10, 0, () => {
    seed({});
    Stats.log(0); Stats.log(-30);
    eq(Stats.today(), 0);
  });
});

t("seconds are rounded, not truncated to nothing", () => {
  at(2026, 7, 4, 10, 0, () => {
    seed({});
    Stats.log(0.6);
    eq(Stats.today(), 1);
  });
});

t("a day with no practice reads as zero, not undefined", () => {
  at(2026, 7, 4, 10, 0, () => { seed({}); eq(Stats.today(), 0); });
});

t("corrupt saved stats read as an empty history", () => {
  at(2026, 7, 4, 10, 0, () => {
    storage.clear();
    storage.setItem(KEY(), "{not json");
    eq(Stats.today(), 0);
    eq(Stats.streak(), 0);
  });
});

// ---- the week ---------------------------------------------------------------
t("the week is the last 7 days including today", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({
      "2026-07-08": 100, "2026-07-07": 100, "2026-07-06": 100, "2026-07-05": 100,
      "2026-07-04": 100, "2026-07-03": 100, "2026-07-02": 100,
      "2026-07-01": 999,   // 8 days ago - outside the window
    });
    eq(Stats.week(), 700);
  });
});

// ---- the streak -------------------------------------------------------------
t("consecutive days count", () => {
  at(2026, 7, 8, 20, 0, () => {
    seed({ "2026-07-08": 120, "2026-07-07": 120, "2026-07-06": 120 });
    eq(Stats.streak(), 3);
  });
});

t("a gap breaks the streak", () => {
  at(2026, 7, 8, 20, 0, () => {
    seed({ "2026-07-08": 120, "2026-07-06": 120, "2026-07-05": 120 });
    eq(Stats.streak(), 1, "only today; the 7th is missing");
  });
});

t("the streak survives a day that has not been practised yet", () => {
  // Counting back from yesterday is what stops the streak reading 0 all morning.
  at(2026, 7, 8, 9, 0, () => {
    seed({ "2026-07-07": 120, "2026-07-06": 120 });
    eq(Stats.streak(), 2);
  });
});

t("a day under a minute does not count toward the streak", () => {
  at(2026, 7, 8, 20, 0, () => {
    seed({ "2026-07-08": 59, "2026-07-07": 120 });
    eq(Stats.streak(), 1, "today is too short; yesterday still counts");
    seed({ "2026-07-08": 60, "2026-07-07": 120 });
    eq(Stats.streak(), 2, "a full minute counts");
  });
});

t("no history is a streak of zero", () => {
  at(2026, 7, 8, 20, 0, () => { seed({}); eq(Stats.streak(), 0); });
});

// ---- goal and callouts ------------------------------------------------------
t("the daily goal defaults to 10 minutes and can be changed", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({});
    eq(Stats.goalMin(), 10);
    Stats.setGoalMin(20);
    eq(Stats.goalMin(), 20);
  });
});

t("changing the goal does not wipe the practice history", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({ "2026-07-08": 300 });
    Stats.setGoalMin(15);
    eq(Stats.today(), 300);
  });
});

t("crossing the goal is called out", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({ "2026-07-08": 700 });
    ok(/goal done/i.test(Stats.callout(500)), "crossed it this session");
  });
});

t("a streak is called out once it is worth mentioning", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({ "2026-07-08": 120, "2026-07-07": 120, "2026-07-06": 120 });
    eq(Stats.callout(120), "🔥 That's 3 days in a row!");
  });
});

t("short of the goal, the callout says how much is left", () => {
  at(2026, 7, 8, 12, 0, () => {
    seed({ "2026-07-08": 120 });          // 2 of 10 minutes
    eq(Stats.callout(0), "8 min to today's goal — keep going!");
  });
});

// ---- onboarding answers -----------------------------------------------------
t("onboarding answers round-trip and start empty", () => {
  at(2026, 7, 8, 12, 0, () => {
    storage.clear();
    eq(Stats.getOnboard(), null);
    Stats.setOnboard({ age: 8, goal: "songs" });
    eq(Stats.getOnboard().goal, "songs");
  });
});

// ---- per player -------------------------------------------------------------
t("two players keep separate practice histories", () => {
  at(2026, 7, 8, 12, 0, () => {
    storage.clear();
    const a = window.Profiles.add("A", "🎹");
    Stats.log(300);
    const b = window.Profiles.add("B", "🎵");
    eq(Stats.today(), 0, "a new player starts at zero");
    Stats.log(60);
    window.Profiles.setActive(a.id);
    eq(Stats.today(), 300, "the first player's practice is untouched");
    window.Profiles.setActive(b.id);
    eq(Stats.today(), 60);
  });
});

done("practice stats");
