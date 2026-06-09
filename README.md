# Simpli Piano

A simple, **touch-first piano** you play right in the browser. No samples to
download and no account — it synthesizes every note with the Web Audio API, so
it loads instantly and works fully offline.

Simpli Piano is a **static installable web app (PWA)**: open it in Safari on the
iPad, tap **Share → Add to Home Screen**, and it runs full-screen like a native
app. Your last few notes don't need a server — the whole thing is self-contained.

## Device-adaptive

The keyboard adapts to the device it's on:

- The number of octaves shown is chosen so white keys never shrink below a
  comfortable finger width — fewer octaves on a phone, more on an iPad/desktop.
- **Multitouch**: play chords with several fingers at once.
- Slide a finger across the keys for a glissando.
- On desktop, the computer keyboard is mapped too (`A W S E D F T G Y H U J …`)
  for quick testing while developing.
- Respects iPad safe areas (notch / home indicator) and hides browser chrome in
  installed standalone mode.

Use the **+ / –** buttons to shift the visible octave range, and the **Note
labels** toggle to show or hide key names.

## Run locally

It's just static files — serve the folder with any static server:

```bash
python3 -m http.server 5010     # then open http://127.0.0.1:5010
```

## Hosting

Intended to be published with **GitHub Pages** from the repo root, e.g.
`https://jconiker.github.io/simpli-piano/`. All asset paths are relative so it
works under the project sub-path.

## Files

- `index.html` — app shell.
- `static/css/style.css` — dark theme, device-adaptive keyboard layout.
- `static/js/app.js` — Web Audio synth, key rendering, pointer/keyboard input.
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA manifest, service worker, app icons.

Part of the **Claude Hub** family.
