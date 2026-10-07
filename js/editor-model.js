// Level editor data: an editable model of a planet, conversion to and from the game's level
// format, browser storage for your planets, and text export/import.
(function () {
  var CP = window.CP = window.CP || {};
  const STORE_KEY = 'coin-planets-custom-v1', LAST_KEY = 'coin-planets-editor-last';
  const W = 1024, H = 768;
  const r = Math.round;
  let seq = 0;
  const nid = () => 'o' + Date.now().toString(36) + (seq++).toString(36);
  const levelId = () => 'lvl-' + Date.now().toString(36) + (seq++).toString(36);
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);

  /*
   * Model shape (everything has an id so the editor can select it):
   *   plat    {id, x, y, w}                    y is the walkable top
   *   movers  {id, x, y, w, ax, ay, period, phase}
   *   coins   {id, x, y, k}                    k: 'g' gold, 's' silver, 'b' bronze
   *   walkers {id, plat, rx, sp}               plat = platform id, rx = offset along it
   *   icicles / spikes {id, plat, rx}
   *   flyers  {id, x, y, ax, ay, per}
   *   orbs    {id, x, y, vx, vy}
   *   items   {id, type, x, y}                 type: 'heart' | 'burger'
   *   golems  {id, plat, rx, sp}               Mars rock golems, attached like walkers
   *   boulders {id, x, y, dir, every}          a chute that drops a rolling boulder every `every` s
   *   fallers {id, x, y}                       a rock that drops when the hero walks underneath
   *   lava    {id, x, top, wait}               a blob that leaps from the floor up to `top`
   *   start   [x, y]                           the hero's feet
   */
  const E = CP.edit = {
    LISTS: ['plat', 'movers', 'coins', 'walkers', 'icicles', 'spikes', 'flyers', 'orbs', 'items', 'golems', 'boulders', 'fallers', 'lava'],

    // Older saves predate some lists; fill them in.
    normalize(M) {
      E.LISTS.forEach(k => { if (!Array.isArray(M[k])) M[k] = []; });
      return M;
    },

    blank() {
      const p = { id: nid(), x: 80, y: 690, w: 260 };
      return {
        id: levelId(), name: 'New planet', theme: clone(CP.LEVELS[0].theme), start: [150, 690],
        plat: [p], movers: [],
        coins: [0, 1, 2].map(i => ({ id: nid(), x: 270 + i * 40, y: 640, k: 'g' })),
        walkers: [], icicles: [], spikes: [], flyers: [], orbs: [], items: [],
        golems: [], boulders: [], fallers: [], lava: [],
      };
    },

    fromLevel(D, name) {
      const plat = D.plat.map(([x, y, w]) => ({ id: nid(), x, y, w }));
      const attach = list => (list || []).filter(([pi]) => plat[pi]).map(([pi, rx]) => ({ id: nid(), plat: plat[pi].id, rx }));
      return {
        id: levelId(), name: name || D.name || 'Imported planet', theme: clone(D.theme || CP.LEVELS[0].theme),
        start: [D.start[0], D.start[1]],
        plat,
        movers: (D.movers || []).map(m => ({ id: nid(), x: m.x, y: m.y, w: m.w, ax: m.ax || 0, ay: m.ay || 0, period: m.period || 4, phase: m.phase || 0 })),
        coins: CP.buildCoins(D).map(c => ({ id: nid(), x: r(c.x), y: r(c.y), k: c.k })),
        walkers: (D.walkers || []).filter(([pi]) => plat[pi]).map(([pi, sp, rx], k) => ({
          id: nid(), plat: plat[pi].id, sp, rx: rx != null ? rx : r(D.plat[pi][2] * (k % 2 ? 0.3 : 0.7)),
        })),
        icicles: attach(D.icicles),
        spikes: attach(D.spikes),
        flyers: (D.flyers || []).map(([x, y, ax, ay, per]) => ({ id: nid(), x, y, ax, ay, per })),
        orbs: (D.orbs || []).map(([x, y, vx, vy]) => ({ id: nid(), x, y, vx, vy })),
        items: (D.items || []).map(([type, x, y]) => ({ id: nid(), type, x, y })),
        golems: (D.golems || []).filter(([pi]) => plat[pi]).map(([pi, sp, rx], k) => ({
          id: nid(), plat: plat[pi].id, sp, rx: rx != null ? rx : r(D.plat[pi][2] * (k % 2 ? 0.3 : 0.7)),
        })),
        boulders: (D.boulders || []).map(([x, y, dir, every]) => ({ id: nid(), x, y, dir: dir < 0 ? -1 : 1, every: every || 4 })),
        fallers: (D.fallers || []).map(([x, y]) => ({ id: nid(), x, y })),
        lava: (D.lava || []).map(([x, top, wait]) => ({ id: nid(), x, top, wait: wait || 3 })),
      };
    },

    // The game's level format (the same shape as the planets in js/levels.js).
    toLevel(M) {
      const idx = new Map(M.plat.map((p, i) => [p.id, i]));
      const on = o => idx.has(o.plat);
      return {
        name: M.name,
        theme: M.theme,
        start: [r(M.start[0]), r(M.start[1])],
        plat: M.plat.map(p => [r(p.x), r(p.y), r(p.w)]),
        movers: M.movers.map(m => ({ x: r(m.x), y: r(m.y), w: r(m.w), ax: r(m.ax), ay: r(m.ay), period: m.period, phase: m.phase })),
        coins: M.coins.map(c => [r(c.x), r(c.y), c.k]),
        walkers: M.walkers.filter(on).map(w => [idx.get(w.plat), w.sp, r(w.rx)]),
        flyers: M.flyers.map(f => [r(f.x), r(f.y), r(f.ax), r(f.ay), f.per]),
        orbs: M.orbs.map(o => [r(o.x), r(o.y), r(o.vx), r(o.vy)]),
        icicles: M.icicles.filter(on).map(h => [idx.get(h.plat), r(h.rx)]),
        spikes: M.spikes.filter(on).map(h => [idx.get(h.plat), r(h.rx)]),
        items: M.items.map(i => [i.type, r(i.x), r(i.y)]),
        golems: M.golems.filter(on).map(w => [idx.get(w.plat), w.sp, r(w.rx)]),
        boulders: M.boulders.map(b => [r(b.x), r(b.y), b.dir, b.every]),
        fallers: M.fallers.map(f => [r(f.x), r(f.y)]),
        lava: M.lava.map(l => [r(l.x), r(l.top), l.wait]),
      };
    },

    plat(M, id) { return M.plat.find(p => p.id === id); },

    // Problems worth telling the designer about. `blocking` ones stop a play test.
    issues(M) {
      const out = [];
      if (!M.coins.length) out.push({ blocking: true, text: 'Add at least one coin. A planet is cleared by collecting every coin.' });
      const [sx, sy] = M.start;
      const under = M.plat.some(p => sx >= p.x && sx <= p.x + p.w && sy <= p.y && p.y - sy < 40)
        || M.movers.some(m => Math.abs(m.ay) < 1 && sx >= m.x && sx <= m.x + m.w && sy <= m.y && m.y - sy < 40);
      if (!under) out.push({ text: 'The hero starts in mid-air. Drop the start marker onto a platform.' });
      const high = M.coins.filter(c => c.y < 60).length;
      if (high) out.push({ text: `${high} coin${high > 1 ? 's sit' : ' sits'} under the score bar at the top.` });
      return out;
    },

    /* ---------- storage (this browser only) ---------- */
    store: {
      all() {
        try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); return Array.isArray(v) ? v.map(E.normalize) : []; } catch (e) { return []; }
      },
      get(id) { return E.store.all().find(m => m.id === id) || null; },
      put(M) {
        const all = E.store.all(), i = all.findIndex(m => m.id === M.id);
        if (i >= 0) all[i] = M; else all.push(M);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); localStorage.setItem(LAST_KEY, M.id); return true; } catch (e) { return false; }
      },
      remove(id) {
        const all = E.store.all().filter(m => m.id !== id);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) {}
      },
      lastId() { try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; } },
    },

    newId: levelId,
    nid,
    clone,

    /* ---------- text export / import ---------- */
    // JSON laid out one object per line, so it pastes cleanly into the LEVELS array in js/levels.js.
    exportText(M) {
      const L = E.toLevel(M);
      const lines = Object.keys(L).map(k => {
        const v = L[k];
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
          return `  ${JSON.stringify(k)}: [\n    ${v.map(x => JSON.stringify(x)).join(',\n    ')}\n  ]`;
        }
        return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
      });
      return '{\n' + lines.join(',\n') + '\n}';
    },

    importText(text) {
      let D;
      try { D = JSON.parse(text.trim().replace(/,\s*$/, '')); } catch (e) {
        throw new Error('That text is not a planet export. Paste the full text from Export, starting with { and ending with }.');
      }
      if (!D || !Array.isArray(D.plat) || !D.plat.length) throw new Error('The planet needs at least one platform in "plat".');
      const pair = a => (Array.isArray(a) ? a : []);
      const theme = D.theme && typeof D.theme.glow === 'string' && D.theme.planet ? D.theme : CP.LEVELS[0].theme;
      const clean = {
        name: String(D.name || 'Imported planet').slice(0, 40),
        theme,
        start: [num(pair(D.start)[0], 150), num(pair(D.start)[1], 690)],
        plat: D.plat.filter(Array.isArray).map(([x, y, w]) => [num(x, 0), num(y, 600), Math.max(20, num(w, 120))]),
        movers: pair(D.movers).filter(m => m && typeof m === 'object').map(m => ({
          x: num(m.x, 0), y: num(m.y, 0), w: Math.max(20, num(m.w, 90)), ax: num(m.ax, 0), ay: num(m.ay, 0), period: Math.max(0.5, num(m.period, 4)), phase: num(m.phase, 0),
        })),
        coins: pair(D.coins).filter(Array.isArray).map(([x, y, k]) => [num(x, 0), num(y, 0), CP.coinKind(k)]),
        walkers: pair(D.walkers).filter(Array.isArray).map(([pi, sp, rx]) => [num(pi, -1), num(sp, 45), rx == null ? null : num(rx, 20)]),
        flyers: pair(D.flyers).filter(Array.isArray).map(a => [0, 1, 2, 3].map(i => num(a[i], 0)).concat([Math.max(1, num(a[4], 6))])),
        orbs: pair(D.orbs).filter(Array.isArray).map(a => [0, 1, 2, 3].map(i => num(a[i], 0))),
        icicles: pair(D.icicles).filter(Array.isArray).map(([pi, rx]) => [num(pi, -1), num(rx, 0)]),
        spikes: pair(D.spikes).filter(Array.isArray).map(([pi, rx]) => [num(pi, -1), num(rx, 0)]),
        items: pair(D.items).filter(Array.isArray).map(([t, x, y]) => [t === 'heart' ? 'heart' : 'burger', num(x, 0), num(y, 0)]),
        golems: pair(D.golems).filter(Array.isArray).map(([pi, sp, rx]) => [num(pi, -1), num(sp, 40), rx == null ? null : num(rx, 20)]),
        boulders: pair(D.boulders).filter(Array.isArray).map(([x, y, dir, every]) => [num(x, 500), num(y, 100), num(dir, 1) < 0 ? -1 : 1, Math.max(1.5, num(every, 4))]),
        fallers: pair(D.fallers).filter(Array.isArray).map(([x, y]) => [num(x, 0), num(y, 100)]),
        lava: pair(D.lava).filter(Array.isArray).map(([x, top, wait]) => [num(x, 0), num(top, 500), Math.max(0.5, num(wait, 3))]),
      };
      return E.fromLevel(clean, clean.name);
    },

    W, H,
  };
})();
