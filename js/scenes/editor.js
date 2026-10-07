// Level editor: a Phaser scene that draws the planet being built, plus an HTML toolbar and
// side panel (index.html #editor-ui) for tools, properties, and saving.
(function () {
  var CP = window.CP = window.CP || {};
  const W = 1024, H = 768, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);

  const TOOLS = [
    { id: 'select', name: 'Select', key: 'V', icon: '↖' },
    { id: 'plat', name: 'Platform', key: '1', tex: 'rock' },
    { id: 'mover', name: 'Lift', key: '2', tex: 'mover' },
    { id: 'coin-g', name: 'Gold coin', key: '3', tex: ['coin-g', 0] },
    { id: 'coin-s', name: 'Silver coin', key: '4', tex: ['coin-s', 0] },
    { id: 'walker', name: 'Alien', key: '5', tex: ['alien', 0] },
    { id: 'flyer', name: 'Ghost', key: '6', tex: ['flyer', 0] },
    { id: 'orb', name: 'Plasma orb', key: '7', tex: ['orb'] },
    { id: 'icicle', name: 'Icicle', key: '8', tex: ['icicle'] },
    { id: 'spike', name: 'Spikes', key: '9', tex: ['spike'] },
    { id: 'heart', name: 'Heart', key: 'H', tex: ['heart'] },
    { id: 'burger', name: 'Burger', key: 'B', tex: ['burger'] },
    { id: 'golem', name: 'Rock golem', key: 'Q', tex: ['rock', 0] },
    { id: 'boulder', name: 'Boulders', key: 'U', tex: ['boulder'] },
    { id: 'faller', name: 'Falling rock', key: 'F', tex: ['faller'] },
    { id: 'lava', name: 'Lava blob', key: 'L', tex: ['lava', 0] },
    { id: 'start', name: 'Start', key: 'S', tex: ['coin', 0] },
    { id: 'erase', name: 'Eraser', key: 'X', icon: '✕' },
  ];
  const HINTS = {
    select: 'Click something to select it, then drag to move it. Drag the gold handle on a platform or lift to resize it. Right-click erases with any tool.',
    plat: 'Click to add a 160px platform, or drag sideways to set its width. Platforms are solid from above only, so the hero can jump up through them.',
    mover: 'Click to add a lift. Select it to set how far it sways and how fast.',
    'coin-g': 'Click to place a gold coin (10 points), or drag to paint a row.',
    'coin-s': 'Click to place a silver coin (5 points), or drag to paint a row.',
    walker: 'Click on a platform. Aliens patrol the platform they stand on and can be stomped.',
    flyer: 'Click to add a ghost. It floats in a figure-eight around where you place it.',
    orb: 'Click to add a plasma orb. It bounces off the edges of the screen.',
    icicle: 'Click on a platform. The icicle hangs underneath it.',
    spike: 'Click on a platform to put a cluster of spikes on top of it.',
    heart: 'Click to place a heart. It gives the player an extra life.',
    burger: 'Click to place a burger. It is worth 100 points.',
    start: 'Click where the hero should start. The marker snaps onto a platform you click near.',
    golem: 'Click on a platform. Rock golems take two stomps: the first cracks them and makes them faster.',
    boulder: 'Click to add a boulder chute. It drops a rolling boulder every few seconds, rolling away from the nearer screen edge.',
    faller: 'Click under a platform. The rock shakes when the hero walks underneath, then drops and grows back.',
    lava: 'Click at the height the blob should reach. It leaps out of the floor, then waits before leaping again.',
    erase: 'Click or drag over things to remove them.',
  };
  // fields: [key, label, min, max, step]; min 'kind' / 'item' means a dropdown
  const PROPS = {
    plat: { title: 'Platform', fields: [['x', 'Left', 0, W], ['y', 'Top', 40, 760], ['w', 'Width', 40, W]] },
    movers: {
      title: 'Lift', note: 'The lift travels the sway distance each way from where it was placed.',
      fields: [['x', 'Left', 0, W], ['y', 'Top', 40, 760], ['w', 'Width', 40, 400], ['ax', 'Sway left/right', -500, 500], ['ay', 'Sway up/down', -300, 300], ['period', 'Seconds per round trip', 0.5, 20, 0.1], ['phase', 'Start offset', -7, 7, 0.1]],
    },
    coins: { title: 'Coin', fields: [['k', 'Metal', 'kind'], ['x', 'X', 0, W], ['y', 'Y', 0, H]] },
    walkers: { title: 'Alien', note: 'Aliens walk back and forth along their platform.', fields: [['sp', 'Walk speed', 10, 200], ['rx', 'Position on platform', 0, W]] },
    flyers: { title: 'Ghost', fields: [['x', 'Centre X', 0, W], ['y', 'Centre Y', 0, H], ['ax', 'Drift width', 0, 500], ['ay', 'Drift height', 0, 200], ['per', 'Seconds per loop', 1, 30, 0.5]] },
    orbs: { title: 'Plasma orb', note: 'The arrow shows where the orb travels in half a second.', fields: [['x', 'X', 0, W], ['y', 'Y', 70, 740], ['vx', 'Speed X', -400, 400], ['vy', 'Speed Y', -400, 400]] },
    icicles: { title: 'Icicle', fields: [['rx', 'Position on platform', 0, W]] },
    spikes: { title: 'Spikes', fields: [['rx', 'Position on platform', 0, W]] },
    items: { title: 'Pickup', fields: [['type', 'Kind', 'item'], ['x', 'X', 0, W], ['y', 'Y', 0, H]] },
    start: { title: 'Start', fields: [['0', 'X', 13, W - 13], ['1', 'Feet Y', 40, 760]] },
    golems: { title: 'Rock golem', note: 'The first stomp cracks a golem and makes it faster. The second shatters it for 100 points.', fields: [['sp', 'Walk speed', 10, 200], ['rx', 'Position on platform', 0, W]] },
    boulders: {
      title: 'Boulder chute', note: 'Boulders roll off platform ends, turn around at the screen edges and fall into the floor. At most 6 roll at once.',
      fields: [['x', 'X', 20, W - 20], ['y', 'Y', 40, 740], ['dir', 'Rolls', 'dir'], ['every', 'Seconds between boulders', 1.5, 20, 0.5]],
    },
    fallers: { title: 'Falling rock', note: 'Drops when the hero is within about 40px sideways and below it. Grows back after 3 seconds.', fields: [['x', 'X', 0, W], ['y', 'Y', 40, 740]] },
    lava: { title: 'Lava blob', note: 'Leaps from the floor up to the peak, falls back, then waits.', fields: [['x', 'X', 0, W], ['top', 'Peak height (Y)', 80, 720], ['wait', 'Seconds between leaps', 0.5, 15, 0.5]] },
  };
  const MARGIN = { walkers: 14, icicles: 8, spikes: 18, golems: 16 };
  const ATTACHED = ['walkers', 'icicles', 'spikes', 'golems'];
  const PICK_ORDER = ['start', 'items', 'coins', 'walkers', 'golems', 'flyers', 'orbs', 'lava', 'fallers', 'boulders', 'spikes', 'icicles', 'movers', 'plat'];
  const ALL = () => CP.ALL_LEVELS;
  const levelLabel = L => `${CP.world(L.world).name}: ${L.name}`;

  CP.EditorScene = class EditorScene extends Phaser.Scene {
    constructor() { super('Editor'); }

    init(data) { this.openId = (data && data.id) || null; }

    create() {
      const st = CP.edit.store;
      let M = (this.openId && st.get(this.openId)) || (!this.openId && st.lastId() && st.get(st.lastId())) || null;
      if (!M) { M = CP.edit.blank(); st.put(M); }
      CP.edit.normalize(M);
      this.M = M;
      this.hist = []; this.future = [];
      this.tool = 'select'; this.sel = null; this.hover = null;
      this.snap = true; this.mode = null; this.pointer = null;

      this.input.keyboard.clearCaptures();          // let the HTML fields receive every key
      this.input.mouse.disableContextMenu();
      this.layer = this.add.container(0, 0);
      this.gfx = this.add.graphics().setDepth(50);
      this.cursorImg = this.add.image(0, 0, 'coin-g', 0).setAlpha(0.55).setDepth(60).setVisible(false);

      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', this.onMove, this);
      this.input.on('pointerup', this.onUp, this);
      this.input.on('pointerupoutside', this.onUp, this);
      this.input.on('gameout', () => { this.pointer = null; this.hover = null; });

      // native listener so shortcuts like Ctrl+D can be stopped before the browser acts on them
      this.keyHandler = e => this.onKey(e);
      window.addEventListener('keydown', this.keyHandler);
      this.events.once('shutdown', () => { window.removeEventListener('keydown', this.keyHandler); this.input.setDefaultCursor('default'); UI.hide(); });

      this.dirty = true;
      UI.show(this);
      CP.live = { inGame: false };
    }

    /* ---------- model helpers ---------- */
    platOf(o) { return CP.edit.plat(this.M, o.plat); }
    get(sel) {
      if (!sel) return null;
      if (sel.type === 'start') return this.M.start;
      return this.M[sel.type].find(o => o.id === sel.id) || null;
    }
    bounds(type, o) {
      const M = this.M;
      switch (type) {
        case 'plat': return { x: o.x, y: o.y - 4, w: o.w, h: 34 };
        case 'movers': return { x: o.x, y: o.y, w: o.w, h: 20 };
        case 'coins': return { x: o.x - 11, y: o.y - 15, w: 22, h: 30 };
        case 'flyers': return { x: o.x - 18, y: o.y - 20, w: 36, h: 52 };
        case 'orbs': return { x: o.x - 22, y: o.y - 22, w: 44, h: 44 };
        case 'items': return { x: o.x - 18, y: o.y - 18, w: 36, h: 36 };
        case 'start': return { x: M.start[0] - 20, y: M.start[1] - 56, w: 40, h: 56 };
        case 'boulders': return { x: o.x - 34, y: o.y - 28, w: 68, h: 56 };
        case 'fallers': return { x: o.x - 18, y: o.y - 17, w: 36, h: 34 };
        case 'lava': return { x: o.x - 16, y: o.top - 22, w: 32, h: 44 };
      }
      const p = this.platOf(o);
      if (!p) return null;
      const cx = p.x + o.rx;
      if (type === 'walkers') return { x: cx - 13, y: p.y - 52, w: 26, h: 52 };
      if (type === 'golems') return { x: cx - 18, y: p.y - 60, w: 36, h: 60 };
      if (type === 'icicles') return { x: cx - 8, y: p.y + 26, w: 16, h: 36 };
      return { x: cx - 18, y: p.y - 26, w: 36, h: 27 };
    }
    pick(x, y) {
      for (const type of PICK_ORDER) {
        const list = type === 'start' ? [null] : this.M[type];
        for (let i = list.length - 1; i >= 0; i--) {
          const b = this.bounds(type, list[i]);
          if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return type === 'start' ? { type } : { type, id: list[i].id };
        }
      }
      return null;
    }
    // The platform an alien, icicle or spike would attach to at this point.
    attachTarget(x, y) {
      let best = null;
      for (const p of this.M.plat) {
        if (x < p.x || x > p.x + p.w || y < p.y - 70 || y > p.y + 70) continue;
        if (!best || Math.abs(y - p.y) < Math.abs(y - best.y)) best = p;
      }
      return best;
    }
    landing(x, y) {
      const p = this.M.plat.find(q => x >= q.x && x <= q.x + q.w && Math.abs(q.y - y) < 26);
      return p ? p.y : null;
    }
    snapV(v, ev) { return (!this.snap || (ev && ev.shiftKey)) ? Math.round(v) : Math.round(v / 10) * 10; }
    pt(p) {
      const ev = p.event, s = v => this.snapV(v, ev);
      return { x: clamp(s(p.worldX), 0, W), y: clamp(s(p.worldY), 0, H), rx: p.worldX, ry: p.worldY, ev };
    }
    anchor(sel) {
      const o = this.get(sel);
      if (sel.type === 'start') return { x: o[0], y: o[1] };
      if (sel.type === 'lava') return { x: o.x, y: o.top };
      if (ATTACHED.includes(sel.type)) { const p = this.platOf(o); return { x: p.x + o.rx, y: p.y }; }
      return { x: o.x, y: o.y };
    }
    onHandle(sel, x, y) {
      const o = this.get(sel), hy = sel.type === 'plat' ? o.y + 12 : o.y + 9;
      return Math.abs(x - (o.x + o.w)) < 10 && Math.abs(y - hy) < 16;
    }

    /* ---------- history + saving ---------- */
    record() {
      this.hist.push(JSON.stringify(this.M));
      if (this.hist.length > 150) this.hist.shift();
      this.future = [];
    }
    commit() {
      this.dirty = true;
      if (!CP.edit.store.put(this.M)) UI.toast('This browser blocked saving. Use Export to keep a copy.');
      UI.refresh();
    }
    restore(json) {
      this.M = JSON.parse(json);
      if (this.sel && !this.get(this.sel)) this.sel = null;
      this.commit();
    }
    undo() { if (!this.hist.length) return; this.future.push(JSON.stringify(this.M)); this.restore(this.hist.pop()); }
    redo() { if (!this.future.length) return; this.hist.push(JSON.stringify(this.M)); this.restore(this.future.pop()); }

    /* ---------- editing actions ---------- */
    select(hit) {
      this.sel = hit ? (hit.type === 'start' ? { type: 'start' } : { type: hit.type, id: hit.id }) : null;
      UI.refreshProps();
    }
    setTool(id) {
      this.tool = id; this.hover = null;
      if (id !== 'select') this.select(null);
      UI.refreshTools(); UI.refreshProps();
    }
    toggleGrid() { this.snap = !this.snap; UI.refreshTools(); }

    place(q) {
      const M = this.M, nid = CP.edit.nid;
      const add = (list, o) => { this.record(); M[list].push(o); this.select({ type: list, id: o.id }); this.commit(); };
      const attach = (list, msg) => {
        const t = this.attachTarget(q.rx, q.ry);
        if (!t) return UI.toast(msg);
        const o = { id: nid(), plat: t.id, rx: clamp(this.snapV(q.rx - t.x, q.ev), MARGIN[list], t.w - MARGIN[list]) };
        if (list === 'walkers') o.sp = 45;
        if (list === 'golems') o.sp = 40;
        add(list, o);
      };
      switch (this.tool) {
        case 'mover': return add('movers', { id: nid(), x: clamp(q.x - 45, 0, W - 90), y: clamp(q.y, 40, 760), w: 90, ax: 100, ay: 0, period: 4, phase: 0 });
        case 'walker': return attach('walkers', 'Aliens need a platform to walk on. Click on top of one.');
        case 'icicle': return attach('icicles', 'Icicles hang under a platform. Click on one.');
        case 'spike': return attach('spikes', 'Spikes sit on top of a platform. Click on one.');
        case 'flyer': return add('flyers', { id: nid(), x: q.x, y: q.y, ax: 120, ay: 20, per: 6 });
        case 'orb': return add('orbs', { id: nid(), x: q.x, y: clamp(q.y, 90, 720), vx: 110, vy: 90 });
        case 'heart': case 'burger': return add('items', { id: nid(), type: this.tool, x: q.x, y: q.y });
        case 'golem': return attach('golems', 'Golems need a platform to walk on. Click on top of one.');
        case 'boulder': return add('boulders', { id: nid(), x: clamp(q.x, 20, W - 20), y: clamp(q.y, 40, 740), dir: q.x < W / 2 ? 1 : -1, every: 4 });
        case 'faller': return add('fallers', { id: nid(), x: q.x, y: clamp(q.y, 40, 740) });
        case 'lava': return add('lava', { id: nid(), x: q.x, top: clamp(q.y, 80, 720), wait: 3 });
        case 'start':
          this.record();
          M.start = [clamp(q.x, 13, W - 13), this.landing(q.x, q.y) || clamp(q.y, 40, 760)];
          this.select({ type: 'start' }); this.commit();
      }
    }

    paint(q) {
      if (this.last && Math.hypot(q.x - this.last.x, q.y - this.last.y) < 36) return;
      if (this.M.coins.some(c => Math.hypot(c.x - q.x, c.y - q.y) < 16)) return;
      this.M.coins.push({ id: CP.edit.nid(), x: q.x, y: q.y, k: this.tool === 'coin-s' ? 's' : 'g' });
      this.last = { x: q.x, y: q.y };
      this.dirty = true;
    }

    remove(hit) {
      if (!hit || hit.type === 'start') return false;
      const M = this.M;
      M[hit.type] = M[hit.type].filter(o => o.id !== hit.id);
      if (hit.type === 'plat') ATTACHED.forEach(l => { M[l] = M[l].filter(o => o.plat !== hit.id); });
      if (this.sel && this.sel.id === hit.id) this.select(null);
      this.dirty = true;
      return true;
    }
    eraseAt(x, y) { this.remove(this.pick(x, y)); }

    deleteSel() {
      if (!this.sel || this.sel.type === 'start') return;
      this.record(); this.remove(this.sel); this.commit();
    }

    duplicate() {
      const s = this.sel, o = this.get(s);
      if (!o || s.type === 'start') return;
      this.record();
      const c = CP.edit.clone(o);
      c.id = CP.edit.nid();
      if (ATTACHED.includes(s.type)) { const p = this.platOf(o); c.rx = clamp(c.rx + 30, MARGIN[s.type], p.w - MARGIN[s.type]); }
      else if (s.type === 'plat' || s.type === 'movers') { c.y = clamp(c.y - 120, 40, 760); }
      else { c.x = clamp(c.x + 30, 0, W); }
      this.M[s.type].push(c);
      this.select({ type: s.type, id: c.id });
      this.commit();
    }

    moveTo(sel, x, y, ev) {
      const o = this.get(sel), s = v => this.snapV(v, ev);
      switch (sel.type) {
        case 'plat': case 'movers':
          o.x = clamp(s(x), 0, W - o.w); o.y = clamp(s(y), 40, 760); break;
        case 'coins': case 'flyers': case 'items':
          o.x = clamp(s(x), 0, W); o.y = clamp(s(y), 0, H); break;
        case 'orbs':
          o.x = clamp(s(x), 20, W - 20); o.y = clamp(s(y), 90, 720); break;
        case 'boulders': case 'fallers':
          o.x = clamp(s(x), 20, W - 20); o.y = clamp(s(y), 40, 740); break;
        case 'lava':
          o.x = clamp(s(x), 0, W); o.top = clamp(s(y), 80, 720); break;
        case 'start': {
          const fx = clamp(s(x), 13, W - 13);
          this.M.start = [fx, this.landing(fx, y) || clamp(s(y), 40, 760)];
          break;
        }
        default: {
          const t = this.attachTarget(x, y) || this.platOf(o);
          if (!t) return;
          o.plat = t.id;
          o.rx = clamp(s(x - t.x), MARGIN[sel.type], t.w - MARGIN[sel.type]);
        }
      }
    }

    setProp(k, raw) {
      const s = this.sel, o = this.get(s);
      if (!o) return;
      this.record();
      if (k === 'k' || k === 'type') o[k] = raw;
      else if (k === 'dir') o.dir = +raw < 0 ? -1 : 1;
      else {
        const f = PROPS[s.type].fields.find(x => x[0] === k);
        let v = parseFloat(raw);
        if (!Number.isFinite(v)) { this.hist.pop(); return UI.refreshProps(); }
        v = clamp(v, f[2], f[3]);
        if (ATTACHED.includes(s.type) && k === 'rx') { const p = this.platOf(o); v = clamp(v, MARGIN[s.type], p.w - MARGIN[s.type]); }
        if ((s.type === 'plat' || s.type === 'movers') && k === 'w') v = Math.min(v, W - o.x);
        if ((s.type === 'plat' || s.type === 'movers') && k === 'x') v = Math.min(v, W - o.w);
        o[k] = v;
        if (s.type === 'plat' && k === 'w') this.clampAttached(o);
      }
      this.commit();
    }

    clampAttached(p) {
      ATTACHED.forEach(l => this.M[l].forEach(o => { if (o.plat === p.id) o.rx = clamp(o.rx, MARGIN[l], p.w - MARGIN[l]); }));
    }

    /* ---------- level-level actions (from the toolbar) ---------- */
    openLevel(value) {
      let M;
      if (value === 'new') M = CP.edit.blank();
      else if (value.startsWith('tpl:')) { const D = ALL()[+value.slice(4)]; M = CP.edit.fromLevel(D, `${D.name} remix`); }
      else M = CP.edit.store.get(value);
      if (!M) return;
      this.M = CP.edit.normalize(M); this.hist = []; this.future = []; this.sel = null;
      CP.edit.store.put(M);
      this.dirty = true;
      UI.refresh();
    }
    setTheme(i) {
      this.record();
      this.M.theme = CP.edit.clone(ALL()[i].theme);
      this.commit();
    }
    rename(name) {
      this.record();
      this.M.name = name.trim().slice(0, 40) || 'Untitled planet';
      this.commit();
    }
    deleteLevel() {
      CP.edit.store.remove(this.M.id);
      const rest = CP.edit.store.all();
      this.openLevel(rest.length ? rest[rest.length - 1].id : 'new');
      UI.toast('Planet deleted.');
    }
    playTest() {
      const block = CP.edit.issues(this.M).find(i => i.blocking);
      if (block) return UI.toast(block.text);
      CP.edit.store.put(this.M);
      this.scene.start('Game', { mode: 'test', custom: CP.edit.toLevel(this.M), editId: this.M.id, score: 0, lives: 3 });
    }
    exit() { this.scene.start('Title', { customId: this.M.id }); }

    /* ---------- input ---------- */
    onDown(p) {
      if (UI.modalOpen()) return;
      const q = this.pt(p);
      if (p.rightButtonDown()) { this.record(); this.mode = 'erase'; this.eraseAt(q.rx, q.ry); return; }
      this.moved = false;
      switch (this.tool) {
        case 'select': {
          if (this.sel && (this.sel.type === 'plat' || this.sel.type === 'movers') && this.onHandle(this.sel, q.rx, q.ry)) { this.mode = 'resize'; return; }
          const hit = this.pick(q.rx, q.ry);
          this.select(hit);
          if (hit) { const a = this.anchor(hit); this.mode = 'move'; this.grab = { dx: q.rx - a.x, dy: q.ry - a.y }; }
          return;
        }
        case 'plat': this.mode = 'newplat'; this.drag = { x: q.x, y: q.y, x2: q.x }; return;
        case 'coin-g': case 'coin-s': this.record(); this.mode = 'paint'; this.last = null; this.paint(q); return;
        case 'erase': this.record(); this.mode = 'erase'; this.eraseAt(q.rx, q.ry); return;
        default: this.place(q);
      }
    }

    onMove(p) {
      const q = this.pt(p);
      this.pointer = q;
      if (!p.isDown || !this.mode) {
        this.hover = (this.tool === 'select' || this.tool === 'erase') ? this.pick(q.rx, q.ry) : null;
        const handle = this.tool === 'select' && this.sel && (this.sel.type === 'plat' || this.sel.type === 'movers') && this.onHandle(this.sel, q.rx, q.ry);
        this.input.setDefaultCursor(handle ? 'ew-resize' : this.tool === 'select' && this.hover ? 'move' : this.tool === 'select' ? 'default' : 'crosshair');
        return;
      }
      switch (this.mode) {
        case 'move':
          if (!this.moved) { this.record(); this.moved = true; }
          this.moveTo(this.sel, q.rx - this.grab.dx, q.ry - this.grab.dy, q.ev);
          this.dirty = true;
          break;
        case 'resize': {
          if (!this.moved) { this.record(); this.moved = true; }
          const o = this.get(this.sel);
          o.w = clamp(this.snapV(q.rx - o.x, q.ev), 40, W - o.x);
          if (this.sel.type === 'plat') this.clampAttached(o);
          this.dirty = true;
          break;
        }
        case 'newplat': this.drag.x2 = q.x; break;
        case 'paint': this.paint(q); break;
        case 'erase': this.eraseAt(q.rx, q.ry); break;
      }
    }

    onUp() {
      const mode = this.mode;
      this.mode = null;
      if (mode === 'newplat') {
        const d = this.drag;
        let x = Math.min(d.x, d.x2), w = Math.abs(d.x2 - d.x);
        if (w < 40) { x = d.x - 80; w = 160; }
        x = clamp(x, 0, W - 40); w = Math.min(w, W - x);
        this.record();
        const o = { id: CP.edit.nid(), x, y: clamp(d.y, 40, 760), w };
        this.M.plat.push(o);
        this.select({ type: 'plat', id: o.id });
        this.commit();
      } else if (mode === 'paint' || mode === 'erase' || ((mode === 'move' || mode === 'resize') && this.moved)) {
        this.commit();
      }
    }

    onKey(e) {
      if (!this.scene.isActive()) return;
      if (UI.modalOpen()) { if (e.key === 'Escape') UI.closeModal(); return; }
      const t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { if (e.key === 'Enter' && t.tagName === 'INPUT') t.blur(); return; }
      const ctrl = e.ctrlKey || e.metaKey, k = e.key;
      if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
      if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); return this.redo(); }
      if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); return this.duplicate(); }
      if (ctrl || e.altKey) return;
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.deleteSel(); }
      if (k === 'Escape') { this.select(null); return this.setTool('select'); }
      if (k.startsWith('Arrow') && this.sel) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10, a = this.anchor(this.sel);
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        this.record();
        this.moveTo(this.sel, a.x + dx, a.y + dy, { shiftKey: true });
        return this.commit();
      }
      if (k === 'g' || k === 'G') return this.toggleGrid();
      if (k === 't' || k === 'T') return this.playTest();
      const tool = TOOLS.find(x => x.key.toLowerCase() === k.toLowerCase());
      if (tool) this.setTool(tool.id);
    }

    /* ---------- drawing ---------- */
    rebuild() {
      this.dirty = false;
      const M = this.M, L = this.layer;
      L.removeAll(true);
      const add = o => { L.add(o); return o; };
      add(this.add.image(0, 0, CP.art.ensureLevel(this, { theme: M.theme, plat: [] }).bg).setOrigin(0));
      M.movers.forEach(m => add(this.add.image(m.x, m.y, CP.art.moverKey(this, m.w)).setOrigin(0)));
      M.plat.forEach((p, j) => add(this.add.image(p.x - 4, p.y - 4, CP.art.rockKey(this, p.w, j % 5, M.theme)).setOrigin(0)));
      M.boulders.forEach(b => add(this.add.image(b.x, b.y, 'chute')));
      M.fallers.forEach(f => add(this.add.image(f.x, f.y, 'faller')));
      M.icicles.forEach(h => { const p = this.platOf(h); if (p) add(this.add.image(p.x + h.rx, p.y + 27, 'icicle').setOrigin(0.5, 0)); });
      M.spikes.forEach(h => {
        const p = this.platOf(h);
        if (p) [-11, 11, 0].forEach(dx => add(this.add.image(p.x + h.rx + dx, p.y + 1, dx ? 'spike-s' : 'spike').setOrigin(0.5, 1)));
      });
      M.items.forEach(i => add(this.add.image(i.x, i.y, i.type)));
      M.coins.forEach(c => add(this.add.image(c.x, c.y, 'coin-' + c.k, 0)));
      const [aox, aoy] = CP.art.spriteOrigin('alien'), [cox, coy] = CP.art.spriteOrigin('coin');
      M.walkers.forEach(w => { const p = this.platOf(w); if (p) add(this.add.image(p.x + w.rx, p.y, 'alien', 0).setOrigin(aox, aoy)); });
      M.golems.forEach(w => { const p = this.platOf(w); if (p) add(this.add.image(p.x + w.rx, p.y, 'rock', 0).setOrigin(0.5, CP.SPRITES.rock.originY)); });
      M.lava.forEach(l => add(this.add.image(l.x, l.top, 'lava', 0)));
      M.flyers.forEach(f => add(this.add.image(f.x, f.y, 'flyer', 0)));
      M.orbs.forEach(o => add(this.add.image(o.x, o.y, 'orb')));
      add(this.add.image(M.start[0], M.start[1], 'coin', 0).setOrigin(cox, coy));
    }

    drawOverlay() {
      const g = this.gfx, M = this.M;
      g.clear();
      if (this.snap) {
        g.lineStyle(1, 0xffffff, 0.05);
        for (let x = 40; x < W; x += 40) g.lineBetween(x, 0, x, H);
        for (let y = 40; y < H; y += 40) g.lineBetween(0, y, W, y);
      }
      // the strip under the score bar
      g.fillStyle(0xffffff, 0.04); g.fillRect(0, 0, W, 60);
      g.lineStyle(1, 0xffffff, 0.18); g.lineBetween(0, 60, W, 60);

      // motion previews
      M.movers.forEach(m => {
        g.lineStyle(2, 0x9fd8ff, 0.55);
        g.lineBetween(m.x + m.w / 2 - m.ax, m.y + 9 - m.ay, m.x + m.w / 2 + m.ax, m.y + 9 + m.ay);
        g.lineStyle(1, 0x9fd8ff, 0.35);
        g.strokeRoundedRect(m.x - m.ax, m.y - m.ay, m.w, 18, 9);
        g.strokeRoundedRect(m.x + m.ax, m.y + m.ay, m.w, 18, 9);
      });
      M.flyers.forEach(f => {
        const pts = [];
        for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; pts.push({ x: f.x + f.ax * Math.sin(a), y: f.y + f.ay * Math.sin(2 * a) }); }
        g.lineStyle(1.5, 0xdfe6ff, 0.45); g.strokePoints(pts);
      });
      M.orbs.forEach(o => {
        const ex = o.x + o.vx * 0.5, ey = o.y + o.vy * 0.5, a = Math.atan2(o.vy, o.vx);
        g.lineStyle(2, 0x7cc4ff, 0.8); g.lineBetween(o.x, o.y, ex, ey);
        g.fillStyle(0x7cc4ff, 0.9);
        g.fillTriangle(ex, ey, ex - 10 * Math.cos(a - 0.45), ey - 10 * Math.sin(a - 0.45), ex - 10 * Math.cos(a + 0.45), ey - 10 * Math.sin(a + 0.45));
      });
      [...M.walkers, ...M.golems].forEach(w => {
        const p = this.platOf(w);
        if (!p) return;
        g.lineStyle(2, 0xff8a7a, 0.5); g.lineBetween(p.x + 14, p.y - 3, p.x + p.w - 14, p.y - 3);
      });
      M.boulders.forEach(b => {
        const ex = b.x + b.dir * 60, ay = b.y + 40;
        g.lineStyle(3, 0xffd3a0, 0.95); g.lineBetween(b.x - b.dir * 10, ay, ex, ay);
        g.fillStyle(0xffd3a0, 1); g.fillTriangle(ex + b.dir * 12, ay, ex, ay - 7, ex, ay + 7);
      });
      M.fallers.forEach(f => {
        const below = M.plat.filter(p => f.x >= p.x && f.x <= p.x + p.w && p.y > f.y + 10).sort((a, b) => a.y - b.y)[0];
        const ey = below ? below.y : H;
        g.lineStyle(1.5, 0xffb07a, 0.6);
        for (let y = f.y + 18; y < ey; y += 14) g.lineBetween(f.x, y, f.x, Math.min(ey, y + 7));
      });
      M.lava.forEach(l => {
        g.lineStyle(2, 0xff7a2a, 0.55);
        for (let y = H - 30; y > l.top + 20; y -= 16) g.lineBetween(l.x, y, l.x, Math.max(l.top + 20, y - 8));
      });

      // hover + selection
      const box = (hit, color, alpha, width) => {
        const b = hit && this.bounds(hit.type, hit.type === 'start' ? null : this.get(hit));
        if (!b) return;
        g.lineStyle(width, color, alpha); g.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      };
      if (this.hover && !(this.sel && this.hover.type === this.sel.type && this.hover.id === this.sel.id)) {
        box(this.hover, this.tool === 'erase' ? 0xff5d73 : 0xffffff, 0.6, 1.5);
      }
      if (this.sel) {
        box(this.sel, 0xffd02a, 1, 2);
        const o = this.get(this.sel);
        if (o && (this.sel.type === 'plat' || this.sel.type === 'movers')) {
          const hy = this.sel.type === 'plat' ? o.y + 12 : o.y + 9;
          g.fillStyle(0xffd02a, 1); g.fillRoundedRect(o.x + o.w - 4, hy - 10, 8, 20, 3);
        }
      }
      if (this.mode === 'newplat') {
        const d = this.drag, x = Math.min(d.x, d.x2), w = Math.max(4, Math.abs(d.x2 - d.x));
        g.fillStyle(0xffd02a, 0.25); g.fillRect(x, d.y, w, 30);
        g.lineStyle(2, 0xffd02a, 0.9); g.strokeRect(x, d.y, w, 30);
      }

      // placement preview under the cursor
      const q = this.pointer, c = this.cursorImg;
      c.setVisible(false);
      if (!q || this.mode || UI.modalOpen()) return;
      if (this.tool === 'plat') {
        g.lineStyle(1.5, 0xffd02a, 0.7); g.strokeRect(q.x - 80, q.y, 160, 30);
        return;
      }
      const tex = {
        mover: [CP.art.moverKey(this, 90)], 'coin-g': ['coin-g', 0], 'coin-s': ['coin-s', 0], walker: ['alien', 0], flyer: ['flyer', 0],
        orb: ['orb'], icicle: ['icicle'], spike: ['spike'], heart: ['heart'], burger: ['burger'], start: ['coin', 0],
        golem: ['rock', 0], boulder: ['chute'], faller: ['faller'], lava: ['lava', 0],
      }[this.tool];
      if (!tex) return;
      c.setTexture(tex[0], tex[1]).setVisible(true).setTint(0xffffff).setOrigin(0.5);
      let x = q.x, y = q.y;
      if (this.tool === 'mover') { c.setOrigin(0); x = q.x - 45; }
      if (['walker', 'golem', 'icicle', 'spike'].includes(this.tool)) {
        const t = this.attachTarget(q.rx, q.ry);
        if (t) {
          y = this.tool === 'icicle' ? t.y + 27 : t.y + (this.tool === 'spike' ? 1 : 0);
          x = clamp(x, t.x + 14, t.x + t.w - 14);
        } else c.setTint(0xff6070);
        c.setOrigin(0.5, this.tool === 'walker' ? CP.SPRITES.alien.originY : this.tool === 'golem' ? CP.SPRITES.rock.originY : this.tool === 'icicle' ? 0 : 1);
      }
      if (this.tool === 'start') { c.setOrigin(0.5, CP.SPRITES.coin.originY); y = this.landing(q.x, q.y) || q.y; }
      c.setPosition(x, y);
    }

    update() {
      if (this.dirty) this.rebuild();
      this.drawOverlay();
    }
  };

  // The editor panels change the size of the game's container. Phaser's refresh() uses the last
  // measured container size, so measure it again first.
  function refitCanvas() {
    if (!CP.game) return;
    CP.game.scale.getParentBounds();
    CP.game.scale.refresh();
  }

  /* ---------- HTML toolbar + side panel ---------- */
  const UI = {
    bound: false,
    scene: null,

    bind() {
      if (this.bound) return;
      this.bound = true;
      const s = () => this.scene;
      $('ed-exit').addEventListener('click', () => s() && s().exit());
      $('ed-open').addEventListener('change', e => { s() && s().openLevel(e.target.value); });
      $('ed-name').addEventListener('change', e => s() && s().rename(e.target.value));
      $('ed-theme').addEventListener('change', e => s() && s().setTheme(+e.target.value));
      $('ed-undo').addEventListener('click', () => s() && s().undo());
      $('ed-redo').addEventListener('click', () => s() && s().redo());
      $('ed-grid').addEventListener('click', () => s() && s().toggleGrid());
      $('ed-play').addEventListener('click', () => s() && s().playTest());
      $('ed-export').addEventListener('click', () => this.openExport());
      $('ed-import').addEventListener('click', () => this.openImport());
      $('ed-modal-close').addEventListener('click', () => this.closeModal());
      $('ed-modal').addEventListener('click', e => { if (e.target.id === 'ed-modal') this.closeModal(); });
      $('ed-modal-go').addEventListener('click', () => this.modalAction && this.modalAction());
      const del = $('ed-delete');
      del.addEventListener('click', () => {
        if (!s()) return;
        if (del.dataset.armed) { clearTimeout(this.delTimer); this.disarm(); s().deleteLevel(); return; }
        del.dataset.armed = '1'; del.textContent = 'Click again to delete';
        this.delTimer = setTimeout(() => this.disarm(), 3000);
      });
    },
    disarm() { const d = $('ed-delete'); delete d.dataset.armed; d.textContent = 'Delete'; },

    show(scene) {
      this.scene = scene;
      this.bind();
      this.buildTools(scene);
      const th = $('ed-theme');
      th.textContent = '';
      ALL().forEach((L, i) => th.add(new Option(`${levelLabel(L)} sky`, i)));
      document.body.classList.add('editing');
      $('editor-ui').hidden = false;
      this.refresh();
      requestAnimationFrame(refitCanvas);
    },
    hide() {
      this.closeModal();
      document.body.classList.remove('editing');
      $('editor-ui').hidden = true;
      this.scene = null;
      requestAnimationFrame(refitCanvas);
    },

    buildTools(scene) {
      const box = $('ed-tools');
      if (box.childElementCount) return;
      TOOLS.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ed-tool'; b.id = 'ed-tool-' + t.id; b.title = `${t.name} (${t.key})`;
        const ic = document.createElement('span');
        ic.className = 'ed-ico';
        if (t.tex) {
          const tex = t.tex === 'rock' ? [CP.art.rockKey(scene, 80, 0)] : t.tex === 'mover' ? [CP.art.moverKey(scene, 90)] : t.tex;
          const img = document.createElement('img');
          img.alt = ''; img.src = scene.textures.getBase64(tex[0], tex[1]);
          ic.append(img);
        } else ic.textContent = t.icon;
        const name = document.createElement('span'); name.className = 'ed-tname'; name.textContent = t.name;
        const key = document.createElement('kbd'); key.textContent = t.key;
        b.append(ic, name, key);
        b.addEventListener('click', () => this.scene && this.scene.setTool(t.id));
        box.append(b);
      });
    },

    refresh() {
      const s = this.scene;
      if (!s) return;
      const M = s.M, open = $('ed-open');
      open.textContent = '';
      const mine = document.createElement('optgroup'); mine.label = 'Your planets';
      CP.edit.store.all().forEach(m => mine.append(new Option(m.name, m.id)));
      const fresh = document.createElement('optgroup'); fresh.label = 'Start a new planet';
      fresh.append(new Option('Blank planet', 'new'));
      ALL().forEach((L, i) => fresh.append(new Option(`Remix ${levelLabel(L)}`, 'tpl:' + i)));
      open.append(mine, fresh);
      open.value = M.id;
      const name = $('ed-name');
      if (document.activeElement !== name) name.value = M.name;
      const ti = ALL().findIndex(L => L.theme.glow === M.theme.glow);
      $('ed-theme').value = String(Math.max(0, ti));
      $('ed-undo').disabled = !s.hist.length;
      $('ed-redo').disabled = !s.future.length;
      this.refreshTools();
      this.refreshProps();
      this.refreshStatus();
    },

    refreshTools() {
      const s = this.scene;
      if (!s) return;
      TOOLS.forEach(t => {
        const b = $('ed-tool-' + t.id);
        if (b) { b.classList.toggle('on', s.tool === t.id); b.setAttribute('aria-pressed', s.tool === t.id); }
      });
      const grid = $('ed-grid');
      grid.classList.toggle('on', s.snap);
      grid.setAttribute('aria-pressed', s.snap);
      grid.textContent = s.snap ? 'Snap on' : 'Snap off';
    },

    refreshProps() {
      const s = this.scene;
      if (!s) return;
      const box = $('ed-props'), title = $('ed-props-title');
      box.textContent = '';
      const o = s.get(s.sel);
      if (!o) {
        title.textContent = TOOLS.find(t => t.id === s.tool).name;
        const p = document.createElement('p'); p.className = 'ed-hint'; p.textContent = HINTS[s.tool];
        box.append(p);
        return;
      }
      const spec = PROPS[s.sel.type];
      title.textContent = spec.title;
      const grid = document.createElement('div'); grid.className = 'ed-props';
      spec.fields.forEach(([k, label, min, max, step]) => {
        const row = document.createElement('label'); row.className = 'ed-prop';
        const span = document.createElement('span'); span.textContent = label;
        let input;
        if (min === 'kind' || min === 'item' || min === 'dir') {
          input = document.createElement('select');
          const opts = min === 'kind' ? [['g', 'Gold (10)'], ['s', 'Silver (5)']]
            : min === 'dir' ? [['1', 'Right'], ['-1', 'Left']]
            : [['heart', 'Heart (extra life)'], ['burger', 'Burger (100)']];
          opts.forEach(([v, t]) => input.add(new Option(t, v)));
          input.value = String(o[k]);
        } else {
          input = document.createElement('input');
          input.type = 'number'; input.step = step || 1; input.min = min; input.max = max;
          input.value = Math.round(o[k] * 100) / 100;
          input.inputMode = 'decimal';
        }
        input.id = 'ed-prop-' + k;
        input.addEventListener('change', () => s.setProp(k, input.value));
        row.append(span, input);
        grid.append(row);
      });
      box.append(grid);
      if (spec.note) { const p = document.createElement('p'); p.className = 'ed-hint'; p.textContent = spec.note; box.append(p); }
      if (s.sel.type !== 'start') {
        const actions = document.createElement('div'); actions.className = 'ed-row';
        const dup = document.createElement('button'); dup.type = 'button'; dup.className = 'ed-btn'; dup.textContent = 'Duplicate';
        dup.addEventListener('click', () => s.duplicate());
        const del = document.createElement('button'); del.type = 'button'; del.className = 'ed-btn danger'; del.textContent = 'Remove';
        del.addEventListener('click', () => s.deleteSel());
        actions.append(dup, del);
        box.append(actions);
      }
    },

    refreshStatus() {
      const s = this.scene, M = s.M, box = $('ed-status');
      box.textContent = '';
      const gold = M.coins.filter(c => c.k === 'g').length, silver = M.coins.length - gold;
      const enemies = M.walkers.length + M.flyers.length + M.orbs.length + M.golems.length + M.boulders.length + M.fallers.length + M.lava.length;
      const facts = [
        [M.coins.length, `coins (${gold} gold, ${silver} silver)`],
        [M.coins.reduce((n, c) => n + (c.k === 'g' ? 10 : 5), 0) + 250, 'points to clear, plus bonuses'],
        [M.plat.length + M.movers.length, 'platforms and lifts'],
        [enemies, enemies === 1 ? 'enemy' : 'enemies'],
      ];
      const dl = document.createElement('dl'); dl.className = 'ed-facts';
      facts.forEach(([n, t]) => { const dt = document.createElement('dt'); dt.textContent = n; const dd = document.createElement('dd'); dd.textContent = t; dl.append(dt, dd); });
      box.append(dl);
      const issues = CP.edit.issues(M);
      if (!issues.length) {
        const ok = document.createElement('p'); ok.className = 'ed-ok'; ok.textContent = 'Ready to play.'; box.append(ok);
      }
      issues.forEach(i => {
        const p = document.createElement('p'); p.className = i.blocking ? 'ed-error' : 'ed-warn'; p.textContent = i.text; box.append(p);
      });
      const saved = document.createElement('p'); saved.className = 'ed-hint';
      saved.textContent = 'Changes save automatically in this browser. Use Export to keep a copy elsewhere.';
      box.append(saved);
    },

    /* ---------- modal ---------- */
    modalOpen() { return !$('ed-modal').hidden; },
    openModal(title, text, value, goLabel, action, readOnly) {
      $('ed-modal-title').textContent = title;
      $('ed-modal-text').textContent = text;
      const area = $('ed-modal-area');
      area.value = value; area.readOnly = !!readOnly;
      $('ed-modal-error').textContent = '';
      $('ed-modal-go').textContent = goLabel;
      this.modalAction = action;
      $('ed-modal').hidden = false;
      area.focus();
      if (readOnly) area.select();
    },
    closeModal() { $('ed-modal').hidden = true; this.modalAction = null; },
    openExport() {
      const s = this.scene;
      if (!s) return;
      this.openModal('Export planet',
        'Copy this text to keep or share your planet. To make it a permanent planet, paste it into the LEVELS list in js/levels.js.',
        CP.edit.exportText(s.M), 'Copy text', () => {
          const area = $('ed-modal-area'), go = $('ed-modal-go');
          const fallback = () => { area.focus(); area.select(); go.textContent = 'Press Ctrl+C to copy'; };
          try {
            navigator.clipboard.writeText(area.value).then(() => { go.textContent = 'Copied'; }, fallback);
          } catch (e) { fallback(); }
        }, true);
    },
    openImport() {
      this.openModal('Import planet', 'Paste a planet that was exported from this editor. It is added to your planets as a new one.',
        '', 'Add planet', () => {
          try {
            const M = CP.edit.importText($('ed-modal-area').value);
            CP.edit.store.put(M);
            this.closeModal();
            this.scene.openLevel(M.id);
            this.toast(`Imported "${M.name}".`);
          } catch (e) { $('ed-modal-error').textContent = e.message; }
        });
    },

    toast(msg) {
      const t = $('ed-toast');
      t.textContent = msg; t.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
    },
  };
  CP.editorUI = UI;
})();
