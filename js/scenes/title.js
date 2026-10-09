// Title: three screens over the key art. The main menu (game title + Play), then, behind a dark veil, a planet carousel and the level
// list of the chosen planet: one preview card per level. Levels open by clearing the one before;
// locked cards can't be picked. Everything here is drawn square: hard edges, no rounded corners.
(function () {
  var CP = window.CP = window.CP || {};
  const W = 1024;
  const BOX = 320, BX = W / 2, BY = 300;     // the planet square (artwork goes here)
  const LINE = 4;

  // A square outlined button with a text label; it inverts on hover.
  function button(scene, x, y, w, h, str, size, onPress) {
    const g = scene.add.graphics();
    const t = CP.ui.label(scene, x, y, str, size, '#ffffff', 4);
    t.setShadow(0, 0, 'rgba(0,0,0,0)', 0);
    const draw = on => {
      g.clear().fillStyle(on ? 0xffffff : 0x000000, 1).fillRect(x - w / 2, y - h / 2, w, h)
        .lineStyle(LINE, 0xffffff, 1).strokeRect(x - w / 2, y - h / 2, w, h);
      t.setColor(on ? '#000000' : '#ffffff');
    };
    draw(false);
    const hit = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => { if (CP.audio) CP.audio.unlock(); onPress(); });
    return { g, t, hit, draw, all: [g, t, hit] };
  }

  // A square arrow button: a hollow box with a solid triangle pointing in direction d (-1 / +1).
  // A disabled arrow is drawn faint and ignores the pointer.
  function arrow(scene, x, y, d, onPress) {
    const s = 72, g = scene.add.graphics();
    const b = { g, enabled: true };
    const draw = on => {
      on = on && b.enabled;
      const a = b.enabled ? 1 : 0.22;
      g.clear().fillStyle(on ? 0xffffff : 0x000000, 1).fillRect(x - s / 2, y - s / 2, s, s)
        .lineStyle(LINE, 0xffffff, a).strokeRect(x - s / 2, y - s / 2, s, s)
        .fillStyle(on ? 0x000000 : 0xffffff, a)
        .fillTriangle(x + d * 14, y, x - d * 10, y - 18, x - d * 10, y + 18);
    };
    draw(false);
    const hit = scene.add.zone(x, y, s, s).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => { if (b.enabled) onPress(); });
    return Object.assign(b, { hit, draw, all: [g, hit] });
  }

  CP.TitleScene = class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    // data.world (from a finished run) opens that planet's level list with data.sel picked;
    // otherwise the main menu.
    init(data) {
      data = data || {};
      const wi = data.world ? CP.WORLDS.findIndex(w => w.id === data.world) : -1;
      this.idx = Math.max(0, wi);
      this.startMode = wi >= 0 ? 'levels' : 'menu';
      // picked level per planet; defaults to the furthest one reached
      this.pick = {};
      CP.WORLDS.forEach(w => { this.pick[w.id] = this.opened(w) - 1; });
      if (wi >= 0 && data.sel != null) this.pick[data.world] = Phaser.Math.Clamp(data.sel, 0, this.opened(CP.WORLDS[wi]) - 1);
      CP.live = { inGame: false };
    }

    create() {
      this.cameras.main.setBackgroundColor('#000000');
      this.ctrl = new CP.Controls(this);
      this.sliding = false;
      this.leaving = false;
      this.busy = false;                                  // true while a screen change is animating

      /* ---------- main menu ---------- */
      // painted key art: the coin runs in from the left, so the title and Play sit in the open sky on the right
      this.add.image(0, 0, 'art-menu').setOrigin(0);
      // the planet and level screens keep the art behind a dark veil
      this.veil = this.add.rectangle(W / 2, 384, W, 768, 0x000000, 1).setAlpha(0).setVisible(false);
      const MX = 760;
      const title = CP.ui.chunky(this, MX, 250, 'Coin', 112);
      const title2 = CP.ui.chunky(this, MX, 360, 'Planets', 112);
      const play = button(this, MX, 520, 280, 84, 'PLAY', 34, () => this.show('select'));
      this.buttons = [play];
      // each screen is a list of groups; a group flies in from (dx, dy) after its delay
      this.menuGroups = [
        { objs: [title], dx: 90, dy: 0, delay: 0 },
        { objs: [title2], dx: 90, dy: 0, delay: 60 },
        { objs: play.all, dx: 90, dy: 0, delay: 120 },
      ];

      /* ---------- planet select ---------- */
      const head = CP.ui.label(this, W / 2, 84, 'CHOOSE A PLANET', 22, '#ffffff', 6);
      const frame = this.add.graphics().fillStyle(0x000000, 1).fillRect(BX - BOX / 2, BY - BOX / 2, BOX, BOX)
        .lineStyle(LINE, 0xffffff, 1).strokeRect(BX - BOX / 2, BY - BOX / 2, BOX, BOX);
      // the square clips the sliding planet art; the mask flies in with the frame
      this.maskG = this.make.graphics({ add: false }).fillStyle(0xffffff).fillRect(BX - BOX / 2, BY - BOX / 2, BOX, BOX);
      this.artMask = this.maskG.createGeometryMask();
      this.art = this.planetArt(this.idx, 0);
      this.la = arrow(this, BX - BOX / 2 - 76, BY, -1, () => this.move(-1));
      this.ra = arrow(this, BX + BOX / 2 + 76, BY, 1, () => this.move(1));
      this.pName = CP.ui.chunky(this, W / 2, BY + BOX / 2 + 46, '', 48);
      this.pInfo = CP.ui.label(this, W / 2, BY + BOX / 2 + 90, '', 16, 'rgba(255,255,255,0.7)', 4);
      const go = button(this, W / 2, BY + BOX / 2 + 160, 280, 76, 'PLAY', 30, () => this.show('levels'));
      const back = button(this, 24 + 60, 24 + 24, 120, 48, 'BACK', 16, () => this.show('menu'));
      this.frame = frame;
      this.selStatic = [
        { objs: [head], dx: 0, dy: -40, delay: 0 },
        { objs: back.all, dx: -120, dy: 0, delay: 40 },
        { objs: this.la.all, dx: -110, dy: 0, delay: 160 },
        { objs: this.ra.all, dx: 110, dy: 0, delay: 160 },
        { objs: [this.pName], dx: 0, dy: 36, delay: 200 },
        { objs: [this.pInfo], dx: 0, dy: 36, delay: 240 },
        { objs: go.all, dx: 0, dy: 50, delay: 280 },
      ];
      this.buttons.push(this.la, this.ra, go, back);

      /* ---------- level list ---------- */
      this.lvHead = CP.ui.chunky(this, W / 2, 84, '', 52);
      const lvBack = button(this, 24 + 60, 24 + 24, 120, 48, 'BACK', 16, () => this.show('select'));
      this.lvGroups = [
        { objs: [this.lvHead], dx: 0, dy: -40, delay: 0 },
        { objs: lvBack.all, dx: -120, dy: 0, delay: 40 },
      ];
      this.buttons.push(lvBack);
      this.cards = [];                                    // level cards, rebuilt per planet
      this.cardTimers = [];

      // remember where everything rests, then start with every screen hidden
      [...this.menuGroups, ...this.selStatic, ...this.lvGroups].forEach(g => g.objs.forEach(o => { o.hx = o.x; o.hy = o.y; }));
      [frame, this.maskG].forEach(o => { o.hx = o.x; o.hy = o.y; });
      [...this.selGroups(), ...this.lvGroups].forEach(g => this.hide(g.objs));

      // music: the dreamy menu loop, with its control in the top-right corner of every screen
      CP.music.play('menu');
      CP.ui.musicControl(this, W - 24 - 150, 24);

      this.mode = null;
      if (this.startMode === 'menu') {
        this.mode = 'menu';
        this.setInput();
      } else {
        this.veil.setVisible(true).setAlpha(0.78);
        this.menuGroups.forEach(g => this.hide(g.objs));
        this.show(this.startMode);
      }
    }

    // The planet screen's groups; the art is rebuilt as the carousel turns, so this is read fresh.
    selGroups() {
      return [{ objs: [this.frame, this.art, this.maskG], dx: 0, dy: 60, delay: 80, ease: 'Back.out' }, ...this.selStatic];
    }
    groupsOf(mode) {
      return mode === 'menu' ? this.menuGroups : mode === 'select' ? this.selGroups() : mode === 'levels' ? this.lvGroups : [];
    }

    hide(objs) {
      objs.forEach(o => {
        this.tweens.killTweensOf(o);
        if (o !== this.maskG) o.setVisible(false);
        if (o.input) o.input.enabled = false;
      });
    }

    // Fly a screen's groups in from their offsets, starting after base ms.
    flyIn(groups, base) {
      groups.forEach(g => g.objs.forEach(o => {
        this.tweens.killTweensOf(o);
        o.setVisible(true);
        if (!o.setAlpha) return;                          // hit zones stay put; their input waits for the end
        o.setAlpha(0); o.setPosition(o.hx + g.dx, o.hy + g.dy);
        this.tweens.add({ targets: o, x: o.hx, y: o.hy, alpha: 1, delay: base + g.delay, duration: 480, ease: g.ease || 'Cubic.out' });
      }));
    }

    // Fly a screen's groups out (a short drift back toward their offsets while fading), then hide them.
    flyOut(groups) {
      groups.forEach(g => g.objs.forEach(o => {
        this.tweens.killTweensOf(o);
        if (o.input) o.input.enabled = false;
        if (!o.setAlpha) { o.setVisible(false); return; }
        this.tweens.add({
          targets: o, x: o.hx + g.dx * 0.5, y: o.hy + g.dy * 0.5, alpha: 0, delay: g.delay * 0.3, duration: 220, ease: 'Cubic.in',
          onComplete: () => { if (o !== this.maskG) o.setVisible(false); o.setPosition(o.hx, o.hy); },
        });
      }));
    }

    // Turn on the pointer for the current screen (arrows only where there is a planet to go to).
    setInput() {
      this.groupsOf(this.mode).forEach(g => g.objs.forEach(o => { if (o.input) o.input.enabled = true; }));
      if (this.mode === 'select') this.updateArrows();
      this.input.setDefaultCursor('default');
    }

    updateArrows() {
      const n = CP.WORLDS.length;
      this.la.enabled = this.idx > 0;
      this.ra.enabled = this.idx < n - 1;
      [this.la, this.ra].forEach(a => {
        if (this.mode === 'select' && !this.busy) a.hit.input.enabled = a.enabled;
        a.draw(false);
      });
      this.input.setDefaultCursor('default');
    }

    // Change screens: the old one drifts out, the veil fades in (or out, back to the menu), the new one flies in.
    show(mode) {
      const prev = this.mode;
      if (mode === prev) return;
      this.mode = mode;
      this.busy = true;
      // a button hidden while hovered would come back inverted
      this.buttons.forEach(b => b.draw(false));
      this.input.setDefaultCursor('default');

      if (prev) this.flyOut(this.groupsOf(prev));
      if (prev === 'levels') this.clearCards(true);

      this.tweens.killTweensOf(this.veil);
      let base = prev ? 200 : 0;
      if (mode === 'menu') {
        this.tweens.add({ targets: this.veil, alpha: 0, duration: 520, ease: 'Sine.inOut', onComplete: () => this.veil.setVisible(false) });
        base = 160;
      } else if (prev === 'menu') {
        // the key art slowly sinks into the dark before the planet screen arrives
        this.veil.setVisible(true);
        this.tweens.add({ targets: this.veil, alpha: 0.78, duration: 700, ease: 'Sine.inOut' });
        base = 320;
      }

      if (mode === 'select') { this.refresh(); this.updateArrows(); }
      this.flyIn(this.groupsOf(mode), base);
      if (mode === 'levels') this.buildCards(base + 60);

      this.time.delayedCall(base + 120, () => {
        if (this.mode !== mode) return;
        this.busy = false;
        this.setInput();
      });
    }

    // How many levels of planet w are open (at least the first).
    opened(w) {
      return Phaser.Math.Clamp(CP.save.progress[w.id] || 1, 1, w.levels.length);
    }

    refresh() {
      const w = CP.WORLDS[this.idx], th = w.levels[0].theme;
      this.pName.setText(w.name.toUpperCase());
      CP.ui.gradient(this.pName, '#ffffff', th.glow2);
      this.pInfo.setText(`${this.opened(w)} / ${w.levels.length} LEVELS OPEN`);
    }

    // Remove the level cards; animated, they sink and fade first.
    clearCards(animate) {
      this.cardTimers.forEach(t => t.remove());
      this.cardTimers = [];
      this.cards.forEach((c, n) => c.objs.forEach(o => {
        this.tweens.killTweensOf(o);
        if (o.input) o.input.enabled = false;
        if (!animate || !o.setAlpha) return o.destroy();
        this.tweens.add({ targets: o, y: o.y + 30, alpha: 0, delay: n * 15, duration: 200, ease: 'Cubic.in', onComplete: () => o.destroy() });
      }));
      this.cards = [];
    }

    // The level list: a 3-wide grid of cards, each a preview of the level over a bar with its number.
    // Hovering or arrowing onto an open card picks it; clicking it (or Enter) plays it.
    // Cards fly in one after another, starting after base ms; each preview is drawn as its card arrives.
    buildCards(base) {
      this.clearCards();
      const w = CP.WORLDS[this.idx], th = w.levels[0].theme;
      this.lvHead.setText(w.name.toUpperCase());
      CP.ui.gradient(this.lvHead, '#ffffff', th.glow2);
      w.levels.forEach((_, i) => {
        this.cardTimers.push(this.time.delayedCall(base + i * 55, () => this.addCard(w, i)));
      });
    }

    addCard(w, i) {
      const TW = 256, TH = 192, BAR = 40, GX = 36, GY = 34, COLS = 3;
      const x0 = W / 2 - ((COLS - 1) * (TW + GX)) / 2, y0 = 160 + TH / 2;
      const x = x0 + (i % COLS) * (TW + GX), y = y0 + Math.floor(i / COLS) * (TH + BAR + GY);
      const locked = i >= this.opened(w), left = x - TW / 2, top = y - TH / 2;
      const img = this.add.image(x, y, this.thumb(w, i)).setDisplaySize(TW, TH);
      const g = this.add.graphics();
      const t = CP.ui.label(this, x, top + TH + BAR / 2, `LEVEL ${i + 1}`, 16, '#ffffff', 4)
        .setShadow(0, 0, 'rgba(0,0,0,0)', 0);
      const objs = [img, g, t];
      if (locked) img.setTint(0x333333);
      const hit = this.add.zone(x, y + BAR / 2, TW, TH + BAR);
      objs.push(hit);
      const card = { i, locked, objs };
      card.draw = () => {
        const on = i === this.pick[w.id];
        g.clear().fillStyle(on ? 0xffffff : 0x000000, 1).fillRect(left, top + TH, TW, BAR)
          .lineStyle(LINE, 0xffffff, locked ? 0.2 : on ? 1 : 0.45).strokeRect(left, top, TW, TH + BAR)
          .lineStyle(LINE, 0xffffff, locked ? 0.2 : on ? 1 : 0.45).lineBetween(left, top + TH, left + TW, top + TH);
        t.setColor(on ? '#000000' : locked ? 'rgba(255,255,255,0.3)' : '#ffffff');
      };
      if (!locked) {
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => this.pickLevel(i));
        hit.on('pointerdown', () => { if (CP.audio) CP.audio.unlock(); this.pickLevel(i); this.go(); });
      }
      card.draw();
      // rise into place
      [img, g, t].forEach(o => {
        const hy = o.y;
        o.setAlpha(0).setY(hy + 50);
        this.tweens.add({ targets: o, y: hy, alpha: 1, duration: 420, ease: 'Back.out' });
      });
      this.cards.push(card);
    }

    // The next level preview not drawn yet, nearest the current planet first; null when all are made.
    nextThumb() {
      if (this.thumbsDone) return null;
      const n = CP.WORLDS.length;
      for (let k = 0; k < n; k++) {
        const w = CP.WORLDS[(this.idx + k) % n];
        for (let i = 0; i < w.levels.length; i++) if (!this.textures.exists(`thumb-${w.id}-${i}`)) return [w, i];
      }
      this.thumbsDone = true;
      return null;
    }

    drawCards() { this.cards.forEach(c => c.draw()); }

    // A 256x192 picture of level i of world w (background, rocks, lifts, hazards, coins), made once.
    thumb(w, i) {
      const key = `thumb-${w.id}-${i}`;
      if (this.textures.exists(key)) return key;
      const D = w.levels[i], keys = CP.art.ensureLevel(this, D), k = 0.25;
      const c = this.make.container({ x: 0, y: 0, scale: k }, false);
      const img = (x, y, tex, ox, oy) => c.add(this.make.image({ x, y, key: tex }, false).setOrigin(ox == null ? 0.5 : ox, oy == null ? 0.5 : oy));
      img(0, 0, keys.bg, 0, 0);
      (D.movers || []).forEach(m => img(m.x, m.y, CP.art.moverKey(this, m.w), 0, 0));
      D.plat.forEach(([x, y], j) => img(x - 4, y - 4, keys.rocks[j], 0, 0));
      (D.icicles || []).forEach(([pi, rx]) => D.plat[pi] && img(D.plat[pi][0] + rx, D.plat[pi][1] + 27, 'icicle', 0.5, 0));
      (D.spikes || []).forEach(([pi, rx]) => D.plat[pi] && img(D.plat[pi][0] + rx, D.plat[pi][1] + 1, 'spike', 0.5, 1));
      (D.pads || []).forEach(([pi, rx]) => D.plat[pi] && img(D.plat[pi][0] + rx, D.plat[pi][1] + 2, 'bouncer', 0.5, 1).last.setFrame(0));
      CP.buildCoins(D).forEach(o => img(o.x, o.y, 'coin-' + o.k));
      img(D.start[0], D.start[1], 'coin-g', 0.5, 1);
      const dt = this.textures.addDynamicTexture(key, 256, 192);
      dt.draw(c);
      c.destroy();
      return key;
    }

    // Pick level i of the current planet, if it is open.
    pickLevel(i) {
      const w = CP.WORLDS[this.idx];
      if (i < 0 || i >= this.opened(w) || i === this.pick[w.id]) return;
      this.pick[w.id] = i;
      this.drawCards();
    }

    // Placeholder artwork for planet i, centred in the square and shifted by dx: a lit sphere in the
    // planet's own colours over a few stars. Swap this for the real planet art later.
    planetArt(i, dx) {
      const th = CP.WORLDS[i].levels[0].theme, c = this.add.container(BX + dx, BY);
      const g = this.add.graphics(), col = CP.art.color(th.glow), lit = CP.art.color(th.glow2);
      const rng = new Phaser.Math.RandomDataGenerator([CP.WORLDS[i].id]);
      for (let k = 0; k < 26; k++) {
        g.fillStyle(0xffffff, rng.realInRange(0.25, 0.8));
        const s = rng.pick([2, 2, 3]);
        g.fillRect(rng.between(-BOX / 2 + 8, BOX / 2 - 8), rng.between(-BOX / 2 + 8, BOX / 2 - 8), s, s);
      }
      g.fillStyle(col, 0.12).fillCircle(0, 0, 124);
      g.fillStyle(col, 1).fillCircle(0, 0, 104);
      g.fillStyle(lit, 0.55).fillCircle(-26, -28, 70);
      g.fillStyle(0x000000, 0.35).fillCircle(30, 32, 84);
      g.fillStyle(0x000000, 0.18).fillCircle(-40, 30, 14).fillCircle(38, -44, 10).fillCircle(10, 60, 9);
      c.add(g);
      c.setMask(this.artMask);
      c.hx = BX; c.hy = BY;
      return c;
    }

    // Slide to the next/previous planet; the carousel stops at the first and last planet.
    move(d) {
      if (this.sliding || this.busy || this.mode !== 'select') return;
      const to = this.idx + d;
      if (to < 0 || to >= CP.WORLDS.length) return;
      this.idx = to;
      const old = this.art, next = this.planetArt(this.idx, d * BOX);
      this.art = next;
      this.sliding = true;
      this.tweens.add({ targets: old, x: BX - d * BOX, duration: 260, ease: 'Cubic.inOut', onComplete: () => old.destroy() });
      this.tweens.add({ targets: next, x: BX, duration: 260, ease: 'Cubic.inOut', onComplete: () => { this.sliding = false; } });
      this.refresh();
      this.updateArrows();
    }

    go() {
      const w = CP.WORLDS[this.idx];
      if (this.leaving) return;
      this.leaving = true;
      CP.ui.mosaic(this, () => this.scene.start('Game', { world: w.id, level: this.pick[w.id], score: 0, lives: 3 }));
    }

    update() {
      const c = this.ctrl;
      // draw level previews in the background (a few ms a frame) so the level list opens at once
      if (!this.busy && !this.leaving) {
        const t0 = performance.now();
        let nx;
        while (performance.now() - t0 < 6 && (nx = this.nextThumb())) this.thumb(nx[0], nx[1]);
      }
      if (this.busy || this.leaving) return c.endFrame();
      if (c.take('editor')) { c.endFrame(); return this.scene.start('Editor', { id: null }); }
      if (this.mode === 'menu') {
        if (c.take('start')) this.show('select');
      } else if (this.mode === 'select') {
        if (c.take('left')) this.move(-1);
        if (c.take('right')) this.move(1);
        if (c.take('exit')) this.show('menu');
        else if (c.take('start')) this.show('levels');
      } else {
        const cur = this.pick[CP.WORLDS[this.idx].id];
        if (c.take('left')) this.pickLevel(cur - 1);
        if (c.take('right')) this.pickLevel(cur + 1);
        if (c.take('up')) this.pickLevel(cur - 3);
        if (c.take('down')) this.pickLevel(cur + 3);
        if (c.take('exit')) this.show('select');
        else if (c.take('start')) this.go();
      }
      c.endFrame();
    }
  };
})();
