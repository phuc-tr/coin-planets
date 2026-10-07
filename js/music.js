// Background music: three original adventure loops composed here and played by a small Web Audio synth
// (no audio files, so nothing to license): galloping bass, a bright doubled lead, power-chord stabs,
// a string pad, shimmering bell arpeggios and punchy synth drums with fills, with a little echo.
// N toggles the music, - / = change its volume; both are remembered with the save data.
(function () {
  var CP = window.CP = window.CP || {};

  // Note name ("C4", "Bb2", "F#5") to frequency.
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    const m = /^([A-G])([b#]?)(-?\d)$/.exec(n);
    const midi = 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ---------- the songs ----------
     The clock runs in sixteenth notes, 16 to a bar. A melody or bass bar is a list of tokens spread evenly over
     the bar (8 tokens = eighth notes, 16 = sixteenths): a note, '.' to hold the one before, '-' for rest.
     Bass tokens are R (chord root), O (root an octave up) and F (the fifth). Drum lists are sixteenth positions;
     the last bar of every 4 gets a fill, and every 8 bars opens with a crash. */
  const SONGS = {
    // Into the Stars: a marching A-minor theme for the menus.
    menu: {
      bpm: 104,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
      bass: 'R . . R R . O . R . . R R . F .',
      arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 2, 3],
      lead: [
        'A4 . . E5 . . A5 .', 'G5 . F5 . E5 . C5 .', 'E5 . . G5 . . C6 .', 'B5 . A5 . G5 . D5 .',
        'C6 . . B5 . . A5 .', 'A5 . G5 . F5 . A5 .', 'G5 . . F5 . . D5 .', 'E5 . . . G#5 . B5 .',
      ],
      drums: { kick: [0, 7, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    },
    // Ring Rider: a heroic C-major gallop for Venus, with a minor-key B section.
    titan: {
      bpm: 140,
      chords: ['C', 'Bb', 'F', 'C', 'C', 'Bb', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
      bass: 'R - R R R - R R R - R R O - O O',
      stabs: [2, 6, 10, 14],
      lead: [
        'G4 . C5 . E5 . G5 .', 'F5 . . D5 . . Bb4 .', 'C5 . F5 . A5 . . C6', 'G5 . . . E5 . . .',
        'G4 . C5 . E5 . G5 .', 'Bb5 . A5 . F5 . D5 .', 'F5 . A5 . C6 . A5 .', 'B5 . . . D6 . . .',
        'C6 . B5 . A5 . E5 .', 'F5 . . A5 . . C6 .', 'E6 . D6 . C6 . G5 .', 'D6 . . . B5 . . .',
        'A5 . C6 . E6 . C6 .', 'D6 . C6 . A5 . F5 .', 'G5 . A5 . B5 . D6 .', 'G5 . . . . . - -',
      ],
      drums: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    },
    // Red Canyon Chase: a fast D-minor chase for Mars that climbs to an A-major cliffhanger.
    mars: {
      bpm: 150,
      chords: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Bb', 'A'],
      bass: 'R . R . O . R . R . R . O . F .',
      arp: [0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 3, 2],
      stabs: [6, 14],
      lead: [
        'D5 . . A5 . . D6 .', 'C6 . Bb5 . A5 . F5 .', 'G5 . . E5 . . C5 .', 'D5 . F5 . A5 . . .',
        'D6 . . C6 . . A5 .', 'Bb5 . A5 . G5 . F5 .', 'A5 . . C6 . . A5 .', 'G5 . . . E5 . . .',
        'G5 . Bb5 . D6 . Bb5 .', 'A5 . . F5 . . D5 .', 'F5 . G5 . A5 . Bb5 .', 'C#6 . . . E6 . . .',
        'D6 . C6 . Bb5 . G5 .', 'A5 . F5 . D5 . F5 .', 'Bb5 . . A5 . . G5 .', 'A5 . . . C#6 . E6 .',
      ],
      drums: { kick: [0, 3, 8, 10], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    },
  };
  // Chord name to [bass root, three upper voices]: "Am", "Bb", "C#m", "E".
  function chord(name) {
    const m = /^([A-G][b#]?)(m?)$/.exec(name), third = m[2] ? 3 : 4;
    let root = freq(m[1] + '2'); if (root >= 90) root /= 2;             // bass between F1 and E2
    const up = k => root * 4 * Math.pow(2, k / 12);                     // voices two octaves up
    return [root, up(0), up(third), up(7)];
  }
  Object.values(SONGS).forEach(s => {
    s.bassT = s.bass.split(' ');
    s.leadT = s.lead.map(b => b.split(' '));
    s.chordF = s.chords.map(chord);
  });

  /* ---------- player ---------- */
  let ac = null, bus = null, echo = null, noise = null, timer = null;
  let cur = null;                     // { name, song, gain, step, next }
  let duck = 1;

  const save = CP.save || {};
  const music = CP.music = {
    volume: save.musicVol == null ? 0.6 : save.musicVol,
    on: save.musicOn !== false,
    want: null,                       // the song asked for (may be waiting for the first click)
    listeners: [],

    // Called by CP.audio once the browser allows sound.
    attach() {
      ac = CP.audio.ac;
      bus = ac.createGain();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3;
      bus.connect(comp).connect(CP.audio.master);
      // a soft echo send for the lead and bells
      echo = ac.createDelay(1);
      const fb = ac.createGain(), wet = ac.createGain(), tone = ac.createBiquadFilter();
      echo.delayTime.value = 0.36;
      fb.gain.value = 0.32; wet.gain.value = 0.5; tone.type = 'lowpass'; tone.frequency.value = 2400;
      echo.connect(tone).connect(fb).connect(echo);
      tone.connect(wet).connect(bus);
      // one second of white noise for the drums
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyLevel(0);
      if (music.want) start(music.want);
    },

    // Play a song by name (null for silence); a different song crossfades in.
    play(name) {
      music.want = name;
      if (!ac) return;
      if (cur && cur.name === name) return;
      start(name);
    },
    toggle() { music.setOn(!music.on); },
    setOn(on) {
      music.on = on;
      store();
      applyLevel(0.25);
    },
    setVolume(v) {
      music.volume = Math.round(Phaser.Math.Clamp(v, 0, 1) * 5) / 5;
      if (music.volume > 0 && !music.on) music.on = true;
      if (music.volume === 0) music.on = false;
      store();
      applyLevel(0.1);
    },
    // Quieter while the game is paused.
    duck(on) { duck = on ? 0.4 : 1; applyLevel(0.3); },
    onChange(fn) { music.listeners.push(fn); return () => { music.listeners = music.listeners.filter(f => f !== fn); }; },
  };

  function store() {
    if (CP.save) { CP.save.musicVol = music.volume; CP.save.musicOn = music.on; if (CP.persist) CP.persist(); }
    music.listeners.forEach(f => f());
  }

  function applyLevel(t) {
    if (!bus) return;
    const v = music.on ? music.volume * duck : 0;
    bus.gain.setTargetAtTime(v * v * 0.9 + v * 0.1, ac.currentTime, t || 0.01);   // gentler at the low end
  }

  function start(name) {
    if (cur) {
      const old = cur;
      old.gain.gain.setTargetAtTime(0, ac.currentTime, 0.25);
      setTimeout(() => old.gain.disconnect(), 1500);
      cur = null;
    }
    if (name && SONGS[name]) {
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.setTargetAtTime(1, ac.currentTime + 0.05, 0.3);
      gain.connect(bus);
      cur = { name, song: SONGS[name], gain, step: 0, next: ac.currentTime + 0.1 };
    }
    if (!timer) timer = setInterval(tick, 25);
  }

  // Schedule every step that starts within the next 150 ms.
  function tick() {
    if (!cur || ac.state !== 'running') return;
    const sd = 60 / cur.song.bpm / 4;
    while (cur.next < ac.currentTime + 0.15) {
      playStep(cur, cur.step, cur.next, sd);
      cur.step++;
      cur.next += sd;
    }
  }

  // Play the tokens of a bar list that start on sixteenth pos; calls fn(token, lengthInSixteenths).
  function tokensAt(list, pos, fn) {
    const per = 16 / list.length;
    if (pos % per) return;
    const i = pos / per, n = list[i];
    if (n === '-' || n === '.') return;
    let len = 1; while (list[i + len] === '.') len++;
    fn(n, len * per);
  }

  function playStep(c, s, t, sd) {
    const S = c.song, out = c.gain, pos = s % 16, bar = Math.floor(s / 16);
    const ch = S.chordF[bar % S.chordF.length];
    // galloping bass: a filtered saw with a sub sine under it
    tokensAt(S.bassT, pos, (b, len) => {
      const f = b === 'O' ? ch[0] * 2 : b === 'F' ? ch[0] * 1.5 : ch[0];
      voice(out, 'sawtooth', f, t, len * sd * 0.85, 0.11, 0.004, 700);
      voice(out, 'sine', f, t, len * sd * 0.85, 0.14, 0.004, 400);
    });
    // string pad: the chord swelling through each bar
    if (pos === 0) ch.slice(1).forEach(f => pad(out, f, t, sd * 16));
    // power-chord stabs (root + fifth + octave)
    if (S.stabs && S.stabs.includes(pos)) [ch[1], ch[1] * 1.5, ch[1] * 2].forEach(f => voice(out, 'square', f, t, sd * 1.2, 0.02, 0.003, 2200));
    // bell arpeggio, an octave above the pad
    if (S.arp) bell(out, ch[1 + (S.arp[pos] % 3)] * (S.arp[pos] === 3 ? 4 : 2), t, 0.022);
    // lead
    const lb = S.leadT[bar % S.leadT.length];
    tokensAt(lb, pos, (n, len) => lead(out, freq(n), t, len * sd));
    // drums, with a fill closing every fourth bar and a crash opening every eighth
    const D = S.drums, fill = bar % 4 === 3, big = bar % 8 === 7;
    if (bar % 8 === 0 && pos === 0) hit(out, t, 'highpass', 5000, 1.3, 0.06);
    if (fill && pos >= 8) {
      if (big) { if (pos % 2 === 0 || pos >= 12) tom(out, t, 220 - (pos - 8) * 16); }
      else if ([8, 10, 12, 13, 14, 15].includes(pos)) snare(out, t, pos >= 12 ? 0.7 + (pos - 12) * 0.1 : 0.8);
      if (pos === 8) kick(out, t);
    } else {
      if (D.kick.includes(pos)) kick(out, t);
      if (D.snare.includes(pos)) snare(out, t, 1);
    }
    if (D.hat.includes(pos)) hit(out, t, 'highpass', 8000, pos % 4 === 2 ? 0.09 : 0.035, pos % 4 === 2 ? 0.045 : 0.03);
  }

  /* ---------- instruments ---------- */
  function voice(out, type, f, t, dur, vol, att, cutoff) {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = cutoff || 3000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setTargetAtTime(0.0001, t + Math.max(att, dur * 0.6), dur * 0.25);
    o.connect(lp).connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.4);
    return g;
  }

  // A bright heroic lead: a square and a slightly detuned saw an octave down, through a filter that opens
  // on each note, with vibrato easing in on long notes.
  function lead(out, f, t, dur) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.linearRampToValueAtTime(3600, t + 0.03);
    lp.frequency.setTargetAtTime(2200, t + 0.05, 0.2);
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(dur, 0.45));
    lfo.connect(lg);
    [['square', 1, 0, 0.5], ['sawtooth', 0.5, 7, 0.35]].forEach(([type, k, cents, v]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = f * k; o.detune.value = cents; og.gain.value = v;
      lg.connect(o.frequency);
      o.connect(og).connect(lp);
      o.start(t); o.stop(t + dur + 0.5);
    });
    const vol = 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setTargetAtTime(vol * 0.7, t + 0.04, 0.12);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.05);
    lp.connect(g); g.connect(out); g.connect(echo);
    lfo.start(t); lfo.stop(t + dur + 0.5);
  }

  function bell(out, f, t, vol) {
    [[1, vol], [2.01, vol * 0.25]].forEach(([k, v]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * k;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(out); g.connect(echo);
      o.start(t); o.stop(t + 0.6);
    });
  }

  function pad(out, f, t, dur) {
    const g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.016, t + 0.12);
    g.gain.linearRampToValueAtTime(0.012, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
    [-8, 8].forEach(cents => {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
      o.connect(lp);
      o.start(t); o.stop(t + dur * 1.1);
    });
    lp.connect(g).connect(out);
  }

  function snare(out, t, v) {
    hit(out, t, 'bandpass', 1900, 0.16, 0.13 * v);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.1 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.12);
  }

  function tom(out, t, f) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.18);
    g.gain.setValueAtTime(0.24, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  }

  function kick(out, t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.3);
  }

  function hit(out, t, type, f, dur, vol) {
    const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise;
    flt.type = type; flt.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
})();
