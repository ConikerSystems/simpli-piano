/* Simpli Piano service worker — NETWORK-FIRST so updates show when online,
   with a cached copy as the offline fallback. The app is fully self-contained
   (Web Audio synth, no external assets), so it works completely offline. */
const VERSION = "simpli-piano-v7"; // bump to invalidate old caches on deploy
const SHELL = [
  "./",
  "index.html",
  "about.html",
  "manifest.webmanifest",
  "static/css/style.css",
  "static/js/feedback.js",
  "static/js/audio.js",
  "static/js/keyboard.js",
  "static/js/songs.js",
  "static/js/engine.js",
  "static/js/trainer.js",
  "static/js/course.js",
  "static/js/mic.js",
  "static/js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("index.html");
          return Response.error();
        })
      )
  );
});
