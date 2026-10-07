// Synthesised sound effects (Web Audio, no files) and per-browser save data.
// Mixer: sound effects -> sfx bus -> master -> speakers; the music (music.js) has its own bus into master.
(function () {
  var CP = window.CP = window.CP || {};

  let ac = null, master = null, sfxBus = null;
  const audio = CP.audio = {
    muted: false,
    get ac() { return ac; },
    get master() { return master; },
    unlock() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
        if (ac) {
          master = ac.createGain(); master.connect(ac.destination);
          sfxBus = ac.createGain(); sfxBus.connect(master);
          audio.setMuted(audio.muted);
          if (CP.music) CP.music.attach();
        }
      }
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    setMuted(on) {
      audio.muted = on;
      if (master) master.gain.setTargetAtTime(on ? 0 : 1, ac.currentTime, 0.03);
    },
    tone(freq, dur, type, vol, slideTo, delay) {
      if (!ac || audio.muted) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol || 0.06, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(sfxBus);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
  };
  const tone = audio.tone;

  CP.sfx = {
    coin(k) { const b = { g: 988, s: 784, b: 587 }[k] || 988; tone(b, 0.05, 'square', 0.045); tone(b * 1.335, 0.12, 'square', 0.045, null, 0.05); },
    jump() { tone(300, 0.16, 'sine', 0.09, 640); },
    stomp() { tone(260, 0.14, 'triangle', 0.14, 70); tone(520, 0.08, 'square', 0.04, null, 0.04); },
    die() { tone(560, 0.7, 'sawtooth', 0.06, 70); },
    item() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, 'triangle', 0.08, null, i * 0.07)); },
    clear() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.4 : 0.14, 'square', 0.05, null, i * 0.11)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'triangle', 0.09, null, i * 0.22)); },
    crack() { tone(150, 0.16, 'square', 0.08, 60); tone(95, 0.22, 'triangle', 0.12, 45, 0.03); },
    shatter() { [220, 160, 120, 80].forEach((f, i) => tone(f, 0.12, 'square', 0.07, f * 0.5, i * 0.04)); },
    rumble() { tone(55, 0.5, 'sawtooth', 0.05, 38); },
    // spawn: a stream of little sine blips that slide upward like rising bubbles, then the cloud pops
    bubbles() {
      for (let i = 0; i < 16; i++) {
        const f = 380 + Math.random() * 520;
        tone(f, 0.07 + Math.random() * 0.05, 'sine', 0.05, f * (1.6 + Math.random() * 0.8), i * 0.075 + Math.random() * 0.03);
      }
    },
    pop() { [0, 0.04, 0.09].forEach((d, i) => tone(900 + i * 260, 0.06, 'sine', 0.07, 2200 + i * 300, d)); },
    hiss() { tone(1200, 0.22, 'sawtooth', 0.015, 300); },
  };

  // Browsers only allow sound after the player interacts with the page.
  window.addEventListener('keydown', e => {
    audio.unlock();
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (typing || e.repeat) return;
    if (e.code === 'KeyM') audio.setMuted(!audio.muted);
    if (CP.music) {
      if (e.code === 'KeyN') CP.music.toggle();
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') CP.music.setVolume(CP.music.volume - 0.2);
      if (e.code === 'Equal' || e.code === 'NumpadAdd') CP.music.setVolume(CP.music.volume + 0.2);
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock());

  const SAVE_KEY = 'coin-planets-v1';
  // progress = how many levels of each world are open; both worlds start with level 1 open
  CP.save = { best: 0, progress: null };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(CP.save, s); } catch (e) {}
  if (!CP.save.progress) CP.save.progress = { titan: CP.save.unlocked || 1, mars: 1 };
  CP.save.progress.titan = Math.max(1, CP.save.progress.titan || 0);
  CP.save.progress.mars = Math.max(1, CP.save.progress.mars || 0);
  delete CP.save.unlocked;
  CP.persist = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(CP.save)); } catch (e) {} };
})();
