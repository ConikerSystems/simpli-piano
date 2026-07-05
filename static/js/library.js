/* Simpli Piano — built-in song library (DATA ONLY).
 *
 * Each entry: { id, title, difficulty (1-4), tempo, hand, genre, exercise, src }.
 * `src` is the app's text notation, parsed by songs.js:
 *   - tokens separated by spaces; "|" bar lines are ignored (readability only)
 *   - note = Letter + optional #/b + optional octave digit + optional duration
 *   - octave is STICKY (carries from the previous note) — write the digit
 *     explicitly on every octave change to be safe
 *   - durations: w=4 h=2 q=1(default) e=0.5 s=0.25 beats; trailing "." dots it
 *   - rest = R + duration; chord = notes joined by "+" (duration at the end)
 *
 * Hands-together convention: the engine plays sequential steps only, so a
 * left-hand bass/chord cannot sustain under several melody notes. Arrange
 * accompaniment by FUSING bass tokens onto downbeat melody notes, e.g.
 *   C3+C4 C4 G3+G4 G4 ...   (bass restruck with the melody note on the beat)
 *
 * difficulty: 1 = five-finger beginner · 2 = ~one octave · 3 = wider range /
 * accidentals / full-length · 4 = hands together (melody + bass/chords).
 * genre: "kids" | "folk" | "classical" | "holiday" | "hymn" | "pop" (exercises: none).
 * All songs are public domain except the short "pop" excerpts. */
window.SongData = [
  // ================= Beginner songs (difficulty 1) =================
  { id: "hot-cross-buns", title: "Hot Cross Buns", difficulty: 1, tempo: 80, genre: "kids",
    src: "E D Ch E D Ch C C C C D D D D E D Ch" },
  { id: "mary-lamb", title: "Mary Had a Little Lamb", difficulty: 1, tempo: 90, genre: "kids",
    src: "E D C D E E Eh D D Dh E G Gh E D C D E E E E D D E D Cw" },
  { id: "au-clair", title: "Au Clair de la Lune", difficulty: 1, tempo: 90, genre: "folk",
    src: "C C C D Eh Dh C E D D Cw" },
  { id: "old-macdonald", title: "Old MacDonald", difficulty: 1, tempo: 100, genre: "kids",
    src: "G G G D E E Dh B B A A Gw" },
  { id: "london-bridge", title: "London Bridge", difficulty: 1, tempo: 100, genre: "kids",
    src: "G A G F E F Gh D E Fh E F Gh" },
  { id: "merrily", title: "Merrily We Roll Along", difficulty: 1, tempo: 100, genre: "kids",
    src: "E D C D E E Eh | D D Dh | E G Gh | E D C D E E E E | D D E D Cw" },
  { id: "rain-rain", title: "Rain, Rain, Go Away", difficulty: 1, tempo: 90, genre: "kids",
    src: "Gh Eh G G Eh | G G A G G Eh | Gh Eh G G Eh | G G A G G Ew" },
  { id: "ring-around", title: "Ring Around the Rosie", difficulty: 1, tempo: 100, genre: "kids",
    src: "G G A G E E | G G A G Eh | Gh Eh Gh Eh | G A G E Cw" },
  { id: "its-raining", title: "It's Raining, It's Pouring", difficulty: 1, tempo: 100, genre: "kids",
    src: "G G E A G Eh | G G E A G Eh | G G G G E G Eh | G G G A A G G Ew" },
  { id: "itsy-bitsy", title: "Itsy Bitsy Spider", difficulty: 1, tempo: 95, genre: "kids",
    src: "G3 C4 C C D E Eh | E D C D E Ch | E F G Gh F E F G Eh | "
       + "C C D E Eh D C D E Ch | G3 C4 C C D E Eh | E D C D E Cw" },

  // ================= Easy songs (difficulty 2) =================
  { id: "twinkle", title: "Twinkle Twinkle Little Star", difficulty: 2, tempo: 100, genre: "kids",
    src: "C C G G A A Gh F F E E D D Ch G G F F E E Dh G G F F E E Dh "
       + "C C G G A A Gh F F E E D D Cw" },
  { id: "ode-to-joy", title: "Ode to Joy", difficulty: 2, tempo: 100, genre: "classical",
    src: "E E F G G F E D C C D E E D Dh E E F G G F E D C C D E D C Ch" },
  { id: "lightly-row", title: "Lightly Row", difficulty: 2, tempo: 100, genre: "folk",
    src: "G E E F D D Ch D E F G Gh G E E F D D C E G G Cw" },
  { id: "frere-jacques", title: "Frère Jacques", difficulty: 2, tempo: 100, genre: "kids",
    src: "C D E C C D E C E F Gh E F Gh G A G F E Ch G A G F E Ch" },
  { id: "when-the-saints", title: "When the Saints Go Marching In", difficulty: 2, tempo: 100, genre: "hymn",
    src: "C E F Gw C E F Gw C E F G E C E Dw" },
  { id: "row-your-boat", title: "Row, Row, Row Your Boat", difficulty: 2, tempo: 100, genre: "kids",
    src: "C C C D E E D E F Gh C5 C5 C5 G G G E E E C C C G F E D Cw" },
  { id: "baa-baa", title: "Baa, Baa, Black Sheep", difficulty: 2, tempo: 100, genre: "kids",
    src: "C C G G A A A A Gh | F F E E D D Ch | G G F F E E Dh | G G G G F F F F E E Dh | "
       + "C C G G A A A A Gh | F F E E D D Cw" },
  { id: "happy-birthday", title: "Happy Birthday", difficulty: 2, tempo: 100, genre: "folk",
    src: "G3e. G3s A3 G3 C4 B3h | G3e. G3s A3 G3 D4 C4h | G3e. G3s G4 E4 C4 B3 A3h | F4e. F4s E4 C4 D4 C4h" },
  { id: "yankee-doodle", title: "Yankee Doodle", difficulty: 2, tempo: 110, genre: "folk",
    src: "C4 C4 D4 E4 C4 E4 D4 G3 | C4 C4 D4 E4 C4h B3h | C4 C4 D4 E4 F4 E4 D4 C4 | B3 G3 A3 B3 C4h C4h" },
  { id: "oh-susanna", title: "Oh! Susanna", difficulty: 2, tempo: 110, genre: "folk",
    src: "C4 D4 E4 G4 G4 A4 G4 E4 C4 D4 E4 E4 D4 C4 D4h | "
       + "C4 D4 E4 G4 G4 A4 G4 E4 C4 D4 E4 E4 D4 D4 C4h | "
       + "F4h F4 A4h A4 G4 G4 E4 C4 D4h | "
       + "C4 D4 E4 G4 G4 A4 G4 E4 C4 D4 E4 E4 D4 D4 C4h" },
  { id: "kumbaya", title: "Kumbaya", difficulty: 2, tempo: 90, genre: "hymn",
    src: "C4 E4 G4 G4h A4 A4 G4w | C4 E4 G4 G4h G4 E4 D4w | "
       + "C4 E4 G4 G4h A4 A4 G4w | E4h D4h C4 D4 C4w" },
  { id: "we-wish", title: "We Wish You a Merry Christmas", difficulty: 2, tempo: 110, genre: "holiday",
    src: "G3 C4 C4 D4 C4 B3 A3 A3h | A3 D4 D4 E4 D4 C4 B3 B3h | "
       + "B3 E4 E4 F4 E4 D4 C4 C4h | G3 C4 C4 B3 D4 C4w" },

  // ================= Medium / full-length (difficulty 3) =================
  { id: "jingle-bells", title: "Jingle Bells", difficulty: 3, tempo: 110, genre: "holiday",
    src: "E E Eh E E Eh E G C D Ew F F F F F E E E E D D E Dh Gh" },
  { id: "twinkle-full", title: "Twinkle — Full (3 verses)", difficulty: 3, tempo: 100, genre: "kids",
    src: "C C G G A A Gh F F E E D D Ch G G F F E E Dh G G F F E E Dh C C G G A A Gh F F E E D D Cw "
       + "C C G G A A Gh F F E E D D Ch G G F F E E Dh G G F F E E Dh C C G G A A Gh F F E E D D Cw "
       + "C C G G A A Gh F F E E D D Ch G G F F E E Dh G G F F E E Dh C C G G A A Gh F F E E D D Cw" },
  { id: "ode-to-joy-full", title: "Ode to Joy — Full", difficulty: 3, tempo: 100, genre: "classical",
    src: "E E F G G F E D C C D E E D Dh | E E F G G F E D C C D E D C Ch | "
       + "D D E C D Ee Fe E C D Ee Fe E D C D G3h | E4 E F G G F E D C C D E D C Cw" },
  { id: "joy-to-the-world", title: "Joy to the World", difficulty: 3, tempo: 90, genre: "holiday",
    src: "C5h B4q. A4e G4h. F4 E4h D4h C4h. G4 A4h. A4 B4h. B4 C5h. | "
       + "C5 C5e B4e A4e G4e G4q. F4e E4 C5 C5e B4e A4e G4e G4q. F4e E4 | "
       + "E4 E4 E4 E4e F4e G4h. F4e E4e D4 D4 D4e E4e F4h. E4e D4e | "
       + "C5q A4 G4q. F4e E4 F4 E4 D4 C4w" },
  { id: "fur-elise", title: "Für Elise (Theme)", difficulty: 3, tempo: 72, genre: "classical",
    src: "E5e D#5e E5e D#5e E5e B4e D5e C5e A4q. Re C4e E4e A4e B4q. Re E4e G#4e B4e C5q. Re E4e | "
       + "E5e D#5e E5e D#5e E5e B4e D5e C5e A4q. Re C4e E4e A4e B4q. Re E4e C5e B4e A4h." },
  { id: "canon-in-c", title: "Canon in D (in C)", difficulty: 3, tempo: 80, genre: "classical",
    src: "E5h D5h C5h B4h A4h G4h A4h B4h | C5h B4h A4h G4h F4h E4h F4h D4h | "
       + "E5 D5 C5 B4 A4 G4 A4 B4 | C5 B4 A4 G4 F4 E4 D4 C4w" },
  { id: "jingle-bells-full", title: "Jingle Bells — Full Chorus", difficulty: 3, tempo: 110, genre: "holiday",
    src: "E4 E4 E4h E4 E4 E4h E4 G4 C4 D4 E4w | F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4h G4h | "
       + "E4 E4 E4h E4 E4 E4h E4 G4 C4 D4 E4w | F4 F4 F4 F4 F4 E4 E4 E4 G4 G4 F4 D4 C4w" },
  { id: "amazing-grace", title: "Amazing Grace", difficulty: 3, tempo: 80, genre: "hymn",
    src: "G3 C4h E4e C4e E4h D4 C4h A3 G3h. | G3 C4h E4e C4e E4h D4 G4h. Rq | "
       + "G4 G4h E4e G4e G4h E4 C4h A3 G3h. | G3 C4h E4e C4e E4h D4 C4w" },
  { id: "silent-night", title: "Silent Night", difficulty: 3, tempo: 90, genre: "holiday",
    src: "G4q. A4e G4 E4h. | G4q. A4e G4 E4h. | D5h D5 B4h. | C5h C5 G4h. | "
       + "A4h A4 C5q. B4e A4 G4q. A4e G4 E4h. | A4h A4 C5q. B4e A4 G4q. A4e G4 E4h. | "
       + "D5h D5 F5q. D5e B4 C5h. E5h. | C5 G4 E4 G4q. F4e D4 C4h." },
  { id: "greensleeves", title: "Greensleeves", difficulty: 3, tempo: 90, genre: "classical",
    src: "A4 C5h D5 E5q. F5e E5 D5h B4 G4q. A4e B4 C5h A4 A4q. G#4e A4 B4h G#4 E4h "
       + "A4 C5h D5 E5q. F5e E5 D5h B4 G4q. A4e B4 C5q. B4e A4 G#4q. F#4e G#4 A4h. | "
       + "G5h. G5q. F#5e E5 D5h B4 G4q. A4e B4 C5h A4 A4q. G#4e A4 B4h G#4 E4h. "
       + "G5h. G5q. F#5e E5 D5h B4 G4q. A4e B4 C5q. B4e A4 G#4q. F#4e G#4 A4h." },
  { id: "minuet-g", title: "Minuet in G", difficulty: 3, tempo: 100, genre: "classical",
    src: "D5 G4e A4e B4e C5e | D5 G4 G4 | E5 C5e D5e E5e F#5e | G5 G4 G4 | "
       + "C5 D5e C5e B4e A4e | B4 C5e B4e A4e G4e | F#4 G4e A4e B4e G4e | A4h. | "
       + "D5 G4e A4e B4e C5e | D5 G4 G4 | E5 C5e D5e E5e F#5e | G5 G4 G4 | "
       + "C5 D5e C5e B4e A4e | B4 C5e B4e A4e G4e | A4 B4e A4e G4e F#4e | G4h." },
  { id: "mountain-king", title: "In the Hall of the Mountain King", difficulty: 3, tempo: 100, genre: "classical",
    src: "A3e B3e C4e D4e E4e C4e E4q | D#4e B3e D#4q D4e B3e D4q | "
       + "A3e B3e C4e D4e E4e C4e E4q | D#4e B3e D#4e B3e A3h | "
       + "A3e B3e C4e D4e E4e C4e E4q | D#4e B3e D#4q D4e B3e D4q | "
       + "A3e B3e C4e D4e E4e C4e E4q A3w" },

  // ============ Pop excerpts (difficulty 3) — short riffs to enjoy ============
  // Not public domain, so these are brief by-ear practice excerpts, kept
  // separate from the teaching material.
  { id: "clocks-riff", title: "Clocks (Coldplay) — Opening Riff", difficulty: 3, tempo: 130, genre: "pop",
    src: "C5e G4e E4e C5e G4e E4e C5e G4e | Bb4e G4e D4e Bb4e G4e D4e Bb4e G4e | "
       + "A4e F4e D4e A4e F4e D4e A4e F4e | A4e F4e D4e A4e F4e D4e A4e F4e | "
       + "C5e G4e E4e C5e G4e E4e C5e G4e | Bb4e G4e D4e Bb4e G4e D4e Bb4e G4e | "
       + "A4e F4e D4e A4e F4e D4e A4e F4e | A4e F4e D4e A4e F4e D4e A4e F4e | C4+E4+G4w" },
  { id: "country-roads", title: "Country Roads (John Denver) — Chorus", difficulty: 3, tempo: 100, genre: "pop",
    src: "G4 A4 C5h. C5 A4 G4h. | G4 A4 G4 E4 D4 C4h. | "
       + "E4 G4 A4 A4 G4 E4 G4 G4h | C5 A4 G4h E4 D4 C4w" },

  // ============ Hands together (difficulty 4) — melody + bass fused ============
  { id: "twinkle-bass", title: "Twinkle — with Bass", difficulty: 4, tempo: 90, hand: "both", genre: "kids",
    src: "C3+C4 C4 C3+G4 G4 F3+A4 A4 C3+G4h | F3+F4 F4 C3+E4 E4 G3+D4 D4 C3+C4h | "
       + "C3+G4 G4 F3+F4 F4 C3+E4 E4 G3+D4h | C3+G4 G4 F3+F4 F4 C3+E4 E4 G3+D4h | "
       + "C3+C4 C4 C3+G4 G4 F3+A4 A4 C3+G4h | F3+F4 F4 C3+E4 E4 G3+D4 D4 C3+C4w" },
  { id: "ode-hands", title: "Ode to Joy — Hands Together", difficulty: 4, tempo: 90, hand: "both", genre: "classical",
    src: "C3+E4 E4 F4 G4 | G3+G4 F4 E4 D4 | C3+C4 C4 D4 E4 | G3+E4 D4 D4h | "
       + "C3+E4 E4 F4 G4 | G3+G4 F4 E4 D4 | C3+C4 C4 D4 E4 | G3+D4 C4 C3+C4h" },
  { id: "jingle-bass", title: "Jingle Bells — with Bass", difficulty: 4, tempo: 100, hand: "both", genre: "holiday",
    src: "C3+E4 E4 E4h C3+E4 E4 E4h | C3+E4 G4 C4 D4 E4w | "
       + "F3+F4 F4 F4 F4 C3+F4 E4 E4 E4 | G3+E4 D4 D4 E4 G3+D4h G3+G4h | "
       + "C3+E4 E4 E4h C3+E4 E4 E4h | C3+E4 G4 C4 D4 E4w | "
       + "F3+F4 F4 F4 F4 C3+F4 E4 E4 E4 | G3+G4 G4 F4 D4 C3+C4w" },
  { id: "saints-chords", title: "When the Saints — with Chords", difficulty: 4, tempo: 100, hand: "both", genre: "hymn",
    src: "C3+C4 E4 F4 G4w | C3+C4 E4 F4 G4w | C3+C4 E4 F4 G4 E4 C4 E4 G3+D4w | "
       + "C3+C4 E4 F4 G4 E4 C4 E4 G3+D4w" },
  { id: "amazing-chords", title: "Amazing Grace — with Chords", difficulty: 4, tempo: 80, hand: "both", genre: "hymn",
    src: "G3 C3+C4h E4e C4e E4h D4 C3+C4h A3 G3h. | G3 C3+C4h E4e C4e E4h D4 C3+G4h. Rq | "
       + "G4 C3+G4h E4e G4e G4h E4 F3+C4h A3 C3+G3h. | G3 C3+C4h E4e C4e E4h D4 C3+E3+C4w" },
  { id: "silent-chords", title: "Silent Night — with Chords", difficulty: 4, tempo: 90, hand: "both", genre: "holiday",
    src: "C3+G4q. A4e G4 E4h. | C3+G4q. A4e G4 E4h. | G3+D5h D5 B4h. | C3+C5h C5 G4h. | "
       + "F3+A4h A4 C5q. B4e A4 C3+G4q. A4e G4 E4h. | F3+A4h A4 C5q. B4e A4 C3+G4q. A4e G4 E4h. | "
       + "G3+D5h D5 F5q. D5e B4 C3+C5h. E5h. | C5 G4 E4 G3+G4q. F4e D4 C3+C4h." },

  // ================= Intermediate exercises (course) =================
  { id: "lh-warmup", title: "Left-Hand Warm-Up", difficulty: 2, tempo: 90, hand: "left", exercise: true,
    src: "C3 D E F G F E D Cw" },
  { id: "c-scale", title: "C Major Scale", difficulty: 2, tempo: 100, exercise: true,
    src: "C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4w" },
  { id: "hands-together", title: "Hands Together", difficulty: 3, tempo: 80, hand: "both", exercise: true,
    src: "C3+C4 C3+D4 C3+E4 C3+F4 C3+G4h G3+G4 G3+F4 G3+E4 G3+D4 G3+C4h" },
  { id: "triads-cfg", title: "First Chords: C F G", difficulty: 3, tempo: 80, hand: "both", exercise: true,
    src: "C4+E4+G4h F4+A4+C5h G4+B4+D5h C4+E4+G4h" },

  // ================= Chords path exercises (tap the whole chord) =================
  { id: "chord-c", title: "C major chord", difficulty: 1, tempo: 60, exercise: true,
    src: "C4+E4+G4w C4+E4+G4w C4+E4+G4w C4+E4+G4w" },
  { id: "chord-g", title: "G major chord", difficulty: 1, tempo: 60, exercise: true,
    src: "G4+B4+D5w G4+B4+D5w G4+B4+D5w G4+B4+D5w" },
  { id: "chord-f", title: "F major chord", difficulty: 1, tempo: 60, exercise: true,
    src: "F4+A4+C5w F4+A4+C5w F4+A4+C5w F4+A4+C5w" },
  { id: "switch-cg", title: "Switch C and G", difficulty: 2, tempo: 60, exercise: true,
    src: "C4+E4+G4h G4+B4+D5h C4+E4+G4h G4+B4+D5h C4+E4+G4h G4+B4+D5h C4+E4+G4w" },
  { id: "switch-cf", title: "Switch C and F", difficulty: 2, tempo: 60, exercise: true,
    src: "C4+E4+G4h F4+A4+C5h C4+E4+G4h F4+A4+C5h C4+E4+G4h F4+A4+C5h C4+E4+G4w" },
  { id: "minor-chords", title: "A minor & E minor", difficulty: 2, tempo: 60, exercise: true,
    src: "A4+C5+E5h E4+G4+B4h A4+C5+E5h E4+G4+B4h A4+C5+E5w" },
  { id: "prog-145", title: "C – F – G", difficulty: 2, tempo: 70, exercise: true,
    src: "C4+E4+G4h F4+A4+C5h G4+B4+D5h C4+E4+G4h" },
  { id: "prog-4chord", title: "C – G – Am – F", difficulty: 3, tempo: 70, exercise: true,
    src: "C4+E4+G4h G4+B4+D5h A4+C5+E5h F4+A4+C5h C4+E4+G4h G4+B4+D5h A4+C5+E5h F4+A4+C5h" },
  { id: "prog-50s", title: "C – Am – F – G", difficulty: 3, tempo: 70, exercise: true,
    src: "C4+E4+G4h A4+C5+E5h F4+A4+C5h G4+B4+D5h C4+E4+G4h A4+C5+E5h F4+A4+C5h G4+B4+D5h" },
];
