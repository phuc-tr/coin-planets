// Game: one planet. Arcade Physics handles gravity, one-way platforms, riding lifts and overlaps.
(function () {
  var CP = window.CP = window.CP || {};
  const W = 1024, H = 768, TAU = Math.PI * 2;
  const GRAV = 1900, JUMP = 780, RUN = 215, ACC_G = 2300, ACC_A = 1400, FRIC = 2700;
  // falling is 10% slower than rising: gravity and top speed on the way down are scaled by FALL
  const FALL = 0.9, MAX_FALL = 950 * FALL;
  // how fast hazards move relative to the speeds written in levels.js (lifts, ghosts, orbs, lava; not walkers)
  const PACE = 0.78;
  // px the baked alien walk covers per second at normal speed (rig walk groundSpeed 177.8 x bake scale 0.121)
  const ALIEN_STRIDE = 21.5;
  // same for the baked rock golem (walk groundSpeed 203.6 x bake scale 0.176)
  const ROCK_STRIDE = 35.8;
  // every walker (alien, rock golem, crab, Mercury walking golem) patrols at this one speed, px/s
  // (the speed written in levels.js is ignored)
  const ENEMY_SPEED = 62;
  // same for the baked crab's sideways scuttle (walk groundSpeed 144 x bake scale 0.206)
  const CRAB_STRIDE = 29.7;
  // crabs animate slower than their stride would give: a lazier scuttle and spin
  const CRAB_ANIM = 0.7;
  // the Mercury golem's lumbering walk and its charge (groundSpeed 68 and 365.1 x bake scale 0.18)
  const GOLEM_STRIDE = 12.2, GOLEM_CHARGE_STRIDE = 65.7;
  // a charging golem runs at this speed (the hero runs 215) and rests this long at each end of its slab;
  // its legs can't keep up with that, so the charge clip plays at most this much faster than baked
  const CHARGE = 270, GOLEM_REST = 1.6, CHARGE_ANIM_MAX = 2.5;
  // bounce pads launch the hero about 330px up (a normal jump reaches 160)
  const PAD_BOUNCE = 1120, PAD_TOP = 36, PAD_HALF = 25;

  // Platforms are solid only from above, so the player can jump up through them.
  function oneWay(body) {
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  CP.GameScene = class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    // mode 'campaign' plays the built-in planets in order, 'custom' plays one of your planets,
    // and 'test' is a play test from the level editor (unlimited lives, Esc goes back).
    init(data) {
      this.startData = data;
      this.mode = data.mode || 'campaign';
      if (this.mode === 'campaign') {
        this.worldDef = CP.world(data.world);
        this.levelIndex = Math.min(data.level || 0, this.worldDef.levels.length - 1);
        this.D = this.worldDef.levels[this.levelIndex];
      } else {
        this.levelIndex = -1;
        this.D = data.custom;
      }
      this.score = data.score || 0;
      this.lives = data.lives == null ? 3 : data.lives;
      this.levelScore = this.score;
    }

    create() {
      const D = this.D, th = D.theme;
      const keys = CP.art.ensureLevel(this, D);
      // each planet has its own loop; your own planets pick one by their rocks
      CP.music.play(this.worldDef && this.worldDef.music || (this.worldDef && this.worldDef.id === 'mars' || th.rock ? 'mars' : 'titan'));
      CP.music.duck(false);
      this.ctrl = new CP.Controls(this);
      this.state = 'intro';
      this.clock = 0; this.spawnGuard = 0;
      this.face = 1; this.buf = 0; this.coyote = 0; this.inv = 0; this.standT = 0; this.grounded = false; this.bouncing = false;
      this.wasGround = true; this.lastVy = 0;

      this.physics.world.setBounds(0, -300, W, H + 600, true, true, false, false);
      this.physics.pause();

      this.add.image(0, 0, keys.bg).setOrigin(0).setDepth(0);
      if (th.dust) {
        this.add.particles(0, 0, 'puff', {
          x: -20, y: { min: 60, max: 740 }, speedX: { min: 220, max: 460 }, speedY: { min: -30, max: 30 },
          lifespan: 4200, scale: { min: 0.3, max: 1.4 }, alpha: { start: 0.35, end: 0 }, tint: 0xd99a5a, frequency: 35,
        }).setDepth(25);
      }

      // rock slabs: static bodies trimmed to the walkable top of the texture
      this.rocks = D.plat.map(([x, y, w], j) => {
        const r = this.physics.add.staticImage(x - 4, y - 4, keys.rocks[j]).setOrigin(0).setDepth(6);
        r.refreshBody();
        r.body.setSize(w, 18, false).setOffset(4, 4);
        oneWay(r.body);
        return r;
      });

      // lifts: immovable bodies driven by velocity, so Arcade carries whoever rides them
      this.movers = (D.movers || []).map(m => {
        const img = this.physics.add.image(m.x, m.y, CP.art.moverKey(this, m.w)).setOrigin(0).setDepth(5);
        img.body.setAllowGravity(false).setImmovable(true).setSize(m.w, 16, false);
        oneWay(img.body);
        img.cfg = m;
        return img;
      });

      // coins
      this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
      CP.buildCoins(D).forEach(c => {
        const s = this.coins.create(c.x, c.y, 'coin-' + c.k).setDepth(9);
        s.kind = c.k;
        s.body.setCircle(10, 2, 6);
        s.play({ key: `coin-${c.k}-spin`, startFrame: Phaser.Math.Between(0, 15) });
      });
      this.left = this.coins.getLength();
      this.total = this.left;

      // bonus pickups
      this.items = this.physics.add.group({ allowGravity: false, immovable: true });
      (D.items || []).forEach(([type, x, y]) => {
        const it = this.items.create(x, y, type).setDepth(8);
        it.kind = type;
        it.body.setCircle(13, it.width / 2 - 13, it.height / 2 - 13);
        this.tweens.add({ targets: it, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 900 });
      });

      // hazards: images for the art, invisible static zones for the hit boxes
      this.hazards = [];
      const zone = (cx, cy, w, h) => { const z = this.add.zone(cx, cy, w, h); this.physics.add.existing(z, true); this.hazards.push(z); };
      (D.icicles || []).forEach(([pi, rx]) => {
        const p = D.plat[pi];
        if (!p) return;
        const cx = p[0] + rx, base = p[1] + 27;
        this.add.image(cx, base, 'icicle').setOrigin(0.5, 0).setDepth(7);
        zone(cx, base + 13, 8, 26);
      });
      (D.spikes || []).forEach(([pi, rx]) => {
        const p = D.plat[pi];
        if (!p) return;
        [-11, 11, 0].forEach(dx => {
          const tall = dx === 0, cx = p[0] + rx + dx, base = p[1] + 1, h = tall ? 22 : 14;
          this.add.image(cx, base, tall ? 'spike' : 'spike-s').setOrigin(0.5, 1).setDepth(7);
          zone(cx, base - h / 2, 8, h);
        });
      });

      // bounce pads stand on a platform like spikes. They aren't solid: walk straight past one,
      // but drop onto its dome and it springs you high into the air.
      this.pads = (D.pads || []).filter(([pi]) => D.plat[pi]).map(([pi, rx]) => {
        const p = D.plat[pi], x = p[0] + rx, y = p[1] + 2;
        return this.add.sprite(x, y, 'bouncer', 0).setOrigin(0.5, 1).setDepth(8);
      });

      // grey aliens that patrol their platform
      this.walkers = this.physics.add.group({ allowGravity: false });
      (D.walkers || []).forEach(([pi, , rx], k) => {
        const p = D.plat[pi];
        if (!p) return;
        const w = this.walkers.create(p[0] + (rx != null ? rx : p[2] * (k % 2 ? 0.3 : 0.7)), p[1], 'alien').setDepth(10);
        const [ox, oy] = CP.art.spriteOrigin('alien');
        w.setOrigin(ox, oy);
        w.body.setSize(26, 51, false).setOffset(w.width * ox - 13, w.height * oy - 51);
        w.kind = 'alien'; w.hp = 2;
        w.minX = p[0] + 15; w.maxX = p[0] + p[2] - 15; w.sp = ENEMY_SPEED;
        w.dir = k % 2 ? 1 : -1;
        w.setVelocityX(w.dir * w.sp);
        this.faceWalker(w);
        // match the walk cycle to the ground speed so the feet don't slide
        w.play({ key: 'alien-walk', startFrame: Phaser.Math.Between(0, CP.SPRITES.alien.clips.walk.count - 1) });
        w.anims.timeScale = Phaser.Math.Clamp(w.sp / ALIEN_STRIDE, 0.6, 4);
      });
      // rock golems (the sprite engine's Rock rig): walkers that need two stomps
      (D.golems || []).forEach(([pi, , rx], k) => {
        const p = D.plat[pi];
        if (!p) return;
        const w = this.walkers.create(p[0] + (rx != null ? rx : p[2] * (k % 2 ? 0.3 : 0.7)), p[1], 'rock').setDepth(10);
        const [ox, oy] = CP.art.spriteOrigin('rock');
        w.setOrigin(ox, oy);
        w.body.setSize(40, 55, false).setOffset(w.width * ox - 20, w.height * oy - 55);
        w.kind = 'golem'; w.hp = 2;
        w.minX = p[0] + 18; w.maxX = p[0] + p[2] - 18; w.sp = ENEMY_SPEED;
        w.dir = k % 2 ? 1 : -1;
        w.setVelocityX(w.dir * w.sp);
        this.faceWalker(w);
        w.play({ key: 'rock-walk', startFrame: Phaser.Math.Between(0, CP.SPRITES.rock.clips.walk.count - 1) });
        w.anims.timeScale = Phaser.Math.Clamp(w.sp / ROCK_STRIDE, 0.6, 3);
      });

      // Jupiter crabs (the sprite engine's Crab rig): walkers that scuttle sideways, two stomps like aliens
      (D.crabs || []).forEach(([pi, , rx], k) => {
        const p = D.plat[pi];
        if (!p) return;
        const w = this.walkers.create(p[0] + (rx != null ? rx : p[2] * (k % 2 ? 0.3 : 0.7)), p[1], 'crab').setDepth(10);
        const [ox, oy] = CP.art.spriteOrigin('crab');
        w.setOrigin(ox, oy);
        w.body.setSize(88, 50, false).setOffset(w.width * ox - 44, w.height * oy - 50);
        w.kind = 'crab'; w.hp = 2;
        w.minX = p[0] + 42; w.maxX = p[0] + p[2] - 42; w.sp = ENEMY_SPEED;
        w.dir = k % 2 ? 1 : -1;
        w.setVelocityX(w.dir * w.sp);
        this.faceWalker(w);
        w.play({ key: 'crab-walk', startFrame: Phaser.Math.Between(0, CP.SPRITES.crab.clips.walk.count - 1) });
        w.anims.timeScale = Phaser.Math.Clamp(w.sp / CRAB_STRIDE, 0.6, 4) * CRAB_ANIM;
      });

      // Mercury golems (the sprite engine's Golem rig). Tripods patrol their slab like aliens.
      // Chargers ignore the hero: they rest at one end of their slab, paw the ground, charge to the
      // other end, skid, rest, and charge back. Both take two stomps.
      const golem = (p, x) => {
        const w = this.walkers.create(x, p[1], 'golem').setDepth(10);
        const [ox, oy] = CP.art.spriteOrigin('golem');
        w.setOrigin(ox, oy);
        w.body.setSize(46, 58, false).setOffset(w.width * ox - 23, w.height * oy - 58);
        w.hp = 2; w.rage = 1;
        w.minX = p[0] + 24; w.maxX = p[0] + p[2] - 24;
        return w;
      };
      (D.tripods || []).forEach(([pi, , rx], k) => {
        const p = D.plat[pi];
        if (!p) return;
        const w = golem(p, p[0] + (rx != null ? rx : p[2] * (k % 2 ? 0.3 : 0.7)));
        w.kind = 'tripod'; w.sp = ENEMY_SPEED;
        w.dir = k % 2 ? 1 : -1;
        w.setVelocityX(w.dir * w.sp);
        this.faceWalker(w);
        this.golemAnim(w, 'walk', Phaser.Math.Between(0, CP.SPRITES.golem.clips.walk.count - 1));
      });
      (D.chargers || []).forEach(([pi, side, wait]) => {
        const p = D.plat[pi];
        if (!p) return;
        const w = golem(p, side ? p[0] + p[2] - 24 : p[0] + 24);
        w.kind = 'charger'; w.mode = 'rest'; w.t = GOLEM_REST - (wait == null ? 1 : wait); w.sp = 0;
        w.dir = side ? -1 : 1;
        this.faceWalker(w);
        this.golemAnim(w, 'idle', Phaser.Math.Between(0, CP.SPRITES.golem.clips.idle.count - 1));
      });

      // ghosts float on a figure-eight; their bodies follow the sprite (moves = false).
      // Spinning crabs fly the same path but take two stomps.
      this.flyers = (D.flyers || []).map(([x, y, ax, ay, per]) => {
        const f = this.physics.add.sprite(x, y, 'flyer').setDepth(11).play('flyer-drift');
        f.body.setAllowGravity(false); f.body.moves = false;
        f.body.setCircle(15, 21, 15);
        f.kind = 'ghost'; f.hp = 1;
        f.cfg = { x, y, ax, ay, per, ph: Math.random() * TAU };
        return f;
      });
      // A sixth value 'o' flies an orbit (ellipse) instead; ax 0 makes a pure up-and-down bob,
      // and a negative period flies the path the other way round.
      (D.spinners || []).forEach(([x, y, ax, ay, per, shape]) => {
        const f = this.physics.add.sprite(x, y, 'crabspin').setDepth(11);
        f.play({ key: 'crabspin-spin', startFrame: Phaser.Math.Between(0, CP.SPRITES.crabspin.clips.spin.count - 1) });
        f.body.setAllowGravity(false); f.body.moves = false;
        f.body.setSize(88, 46).setOffset(f.width / 2 - 44, f.height / 2 - 20);
        f.anims.timeScale = CRAB_ANIM;
        f.kind = 'spinner'; f.hp = 2;
        f.cfg = { x, y, ax, ay, per, orbit: shape === 'o', ph: Math.random() * TAU };
        this.flyers.push(f);
      });

      // plasma orbs bounce around the play area
      const orbBounds = new Phaser.Geom.Rectangle(0, 70, W, 670);
      this.orbs = (D.orbs || []).map(([x, y, vx, vy]) => {
        const o = this.physics.add.image(x, y, 'orb').setDepth(12);
        o.body.setAllowGravity(false).setCircle(17, 31, 31).setBoundsRectangle(orbBounds);
        o.setCollideWorldBounds(true).setBounce(1).setVelocity(vx * PACE, vy * PACE);
        this.tweens.add({ targets: o, angle: 360, duration: 3000, repeat: -1 });
        return o;
      });

      // boulder chutes drop rolling boulders on a timer
      this.chutes = (D.boulders || []).map(([x, y, dir, every]) => {
        this.add.image(x, y, 'chute').setDepth(7);
        return { x, y, dir: dir < 0 ? -1 : 1, every: every || 4, t: (every || 4) * 0.35 };
      });
      this.boulders = this.physics.add.group();

      // falling rocks shake when the hero walks underneath, drop, then grow back
      this.fallers = (D.fallers || []).map(([x, y]) => {
        const f = this.physics.add.image(x, y, 'faller').setDepth(11);
        f.body.setAllowGravity(false).setCircle(12, 6, 4);
        f.home = { x, y }; f.state = 'idle'; f.t = 0;
        return f;
      });

      // lava blobs leap out of the floor
      this.lavas = (D.lava || []).map(([x, top, wait], k) => {
        const b = this.physics.add.sprite(x, H + 40, 'lava').setDepth(13).setVisible(false).play('lava-flicker');
        b.body.setAllowGravity(false); b.body.moves = false;
        b.body.setCircle(11, 11, 11);
        b.top = Math.min(top, H - 40); b.wait = wait || 3; b.state = 'wait'; b.t = 0.8 + k * 0.7; b.vy = 0;
        return b;
      });

      // player: an invisible physics box, plus the animated hero sprite that follows it
      const [sx, sy] = D.start;
      this.player = this.physics.add.image(sx, sy, 'hit').setOrigin(0.5, 1).setVisible(false);
      this.player.setMaxVelocity(RUN, PAD_BOUNCE);     // no world bounds: the screen wraps
      const [hox, hoy] = CP.art.spriteOrigin('coin');
      this.hero = this.add.sprite(sx, sy, 'coin', 0).setOrigin(hox, hoy).setDepth(20).play('coin-idle');
      // copies of the hero drawn on the opposite edges while it straddles the screen wrap
      this.heroGhosts = [0, 1, 2].map(() => this.add.sprite(0, 0, 'coin', 0).setOrigin(hox, hoy).setDepth(20).setVisible(false));

      // standing is read from this collider alone: Arcade also sets body.touching on plain overlaps
      // (coins, enemies), which would otherwise count as ground and give a free mid-air jump
      this.physics.add.collider(this.player, [...this.rocks, ...this.movers], (pl, r) => {
        // held a little over one 120 Hz physics step, so frames that run no step still see the ground
        if (pl.body.touching.down && pl.body.bottom <= r.body.top + 2) this.standT = 0.02;
      }, () => this.state === 'play');
      this.physics.add.overlap(this.player, this.coins, (pl, c) => this.collectCoin(c));
      this.physics.add.overlap(this.player, this.items, (pl, it) => this.collectItem(it));
      this.physics.add.overlap(this.player, this.walkers, (pl, w) => this.touchWalker(w));
      this.physics.add.overlap(this.player, this.flyers, (pl, f) => this.touchFlyer(f));
      this.physics.add.overlap(this.player, [...this.hazards, ...this.orbs], () => this.hurt());
      const solids = [...this.rocks, ...this.movers];
      this.physics.add.collider(this.boulders, solids);
      this.physics.add.overlap(this.player, this.boulders, () => this.hurt());
      if (this.fallers.length) {
        this.physics.add.collider(this.fallers, solids, f => this.shatterFaller(f), f => f.state === 'fall');
        this.physics.add.overlap(this.player, this.fallers, () => this.hurt(), (pl, f) => f.state === 'fall');
      }
      if (this.lavas.length) this.physics.add.overlap(this.player, this.lavas, () => this.hurt(), (pl, b) => b.visible);

      // particles
      const em = (key, cfg) => this.add.particles(0, 0, key, Object.assign({ emitting: false }, cfg)).setDepth(30);
      const spark = tint => em('spark', { speed: { min: 60, max: 170 }, lifespan: 450, scale: { start: 0.8, end: 0.2 }, alpha: { start: 1, end: 0 }, gravityY: 300, tint });
      this.fx = {
        g: spark(0xffd76a), s: spark(0xeef2ff), b: spark(0xe0935a), grey: spark(0xd8dbe4), red: spark(0xff5d73), orange: spark(0xffb347),
        rock: em('spark', { speed: { min: 80, max: 260 }, lifespan: 750, scale: { start: 1.6, end: 0.6 }, alpha: { start: 1, end: 0 }, gravityY: 700, tint: [0xb8714a, 0x7d3d22, 0x5a2a16] }),
        stone: em('spark', { speed: { min: 80, max: 260 }, lifespan: 750, scale: { start: 1.6, end: 0.6 }, alpha: { start: 1, end: 0 }, gravityY: 700, tint: [0xb4b0b8, 0x7c7884, 0x4a4650] }),
        ember: em('spark', { speed: { min: 60, max: 200 }, angle: { min: 230, max: 310 }, lifespan: 600, scale: { start: 1, end: 0.2 }, alpha: { start: 1, end: 0 }, gravityY: 500, tint: [0xffd36b, 0xff7a2a] }),
        hero: em('spark', { speed: { min: 100, max: 240 }, lifespan: 700, scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, gravityY: 300, tint: 0xffd21f }),
        dust: em('puff', { speed: { min: 20, max: 80 }, angle: { min: 200, max: 340 }, lifespan: 450, scale: { start: 0.35, end: 1 }, alpha: { start: 0.5, end: 0 }, tint: 0xd2d2dc }),
        bubble: em('spark', { speed: { min: 60, max: 150 }, lifespan: 380, scale: { start: 0.9, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0x8fd8ff, 0xd8f4ff, 0x4aa8ff] }),
        confetti: em('spark', { speed: { min: 120, max: 260 }, lifespan: 900, scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 }, gravityY: 300, tint: [0xffd76a, CP.art.color(th.glow2), 0xffffff] }),
      };

      // keep the hero glued to its body after Arcade has written positions back
      this.events.on('postupdate', this.syncHero, this);
      // a tap anywhere confirms (resume, continue) unless it lands on a button, like the music control
      this.input.on('pointerdown', (p, over) => { if (this.state !== 'play' && this.state !== 'dying' && !over.length) this.ctrl.press('confirm'); });
      const autoPause = () => { if (this.state === 'play') this.pauseGame(); };
      this.game.events.on('blur', autoPause);
      this.game.events.on('hidden', autoPause);
      this.events.once('shutdown', () => {
        this.events.off('postupdate', this.syncHero, this);
        this.game.events.off('blur', autoPause);
        this.game.events.off('hidden', autoPause);
      });

      if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
      this.scene.bringToTop('Hud');
      this.registry.set('hud', false);                    // the HUD shows once the black screen opens
      this.syncRegistry();
      this.showReady();
    }

    /* ---------- registry / HUD ---------- */
    syncRegistry() {
      this.registry.set({ score: this.score, lives: this.lives });
      CP.live = this.mode === 'campaign'
        ? { inGame: true, world: this.worldDef.id, level: this.levelIndex, score: this.levelScore, lives: this.lives }
        : { inGame: false };
    }

    tag() {
      return this.mode === 'campaign' ? `${this.worldDef.name.toUpperCase()} ${this.levelIndex + 1}` : this.mode === 'test' ? 'TEST PLAY' : 'MY PLANET';
    }

    /* ---------- overlays ---------- */
    overlay(children) {
      if (this.ov) this.ov.destroy();
      this.ov = children ? this.add.container(0, 0, children).setDepth(100) : null;
      return this.ov;
    }

    // Level start: a black screen reading READY, which then splits open (top half up, bottom half down)
    // onto the planet, and the hero bubbles into view.
    showReady() {
      this.hero.setAlpha(0);
      const top = this.add.rectangle(0, 0, W, H / 2 + 1, 0x000000).setOrigin(0).setDepth(200);
      const bot = this.add.rectangle(0, H / 2, W, H / 2, 0x000000).setOrigin(0).setDepth(200);
      const ready = CP.ui.chunky(this, W / 2, H / 2, 'READY', 96).setDepth(201).setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: ready, scale: 1, alpha: 1, duration: 320, ease: 'Back.out' });
      this.time.delayedCall(1150, () => this.tweens.add({ targets: ready, alpha: 0, duration: 140 }));
      this.time.delayedCall(1300, () => {
        this.registry.set('hud', true);
        this.physics.resume();
        this.tweens.add({ targets: top, y: -H / 2 - 1, duration: 520, ease: 'Cubic.inOut' });
        this.tweens.add({
          targets: bot, y: H, duration: 520, ease: 'Cubic.inOut',
          onComplete: () => { top.destroy(); bot.destroy(); ready.destroy(); this.appear(); },
        });
      });
    }

    // The hero materialises on the start point inside a cloud of blue bubbles. It can't move (or be
    // hurt) until the bubbles have popped. Used at level start and after every death.
    appear() {
      this.state = 'appearing';
      this.spawnGuard = 3;
      this.walkers.getChildren().forEach(w => { w.guarded = false; });
      const [sx, sy] = this.D.start, cy = sy - 22;
      this.player.body.enable = false;
      this.player.body.reset(sx, sy);
      this.hero.setAngle(0).setScale(1).setAlpha(0).setPosition(sx, sy).play('coin-idle');
      this.face = 1; this.buf = 0; this.wasGround = true; this.lastBottom = null;
      this.tweens.add({ targets: this.hero, alpha: 1, delay: 250, duration: 1000, ease: 'Sine.in' });
      CP.sfx.bubbles();
      const bubbles = [];
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 40;
        const bx = sx + Math.cos(a) * r * 0.85, by = cy + Math.sin(a) * r;
        const b = this.add.image(bx, by, 'bubble').setDepth(21).setScale(0);
        const s = 0.45 + Math.random() * 0.75;
        this.tweens.add({ targets: b, scale: s, delay: i * 45, duration: 260, ease: 'Back.out' });
        // bubbles drift and wobble upward while the coin fills in
        this.tweens.add({ targets: b, y: by - 10 - Math.random() * 16, x: bx + (Math.random() - 0.5) * 14, delay: i * 45, duration: 1300, ease: 'Sine.inOut' });
        bubbles.push(b);
      }
      this.time.delayedCall(1350, () => {
        bubbles.forEach((b, i) => this.tweens.add({
          targets: b, scale: b.scale * 1.6, alpha: 0, delay: Math.random() * 160, duration: 170, ease: 'Quad.out',
          onComplete: () => b.destroy(),
        }));
        this.fx.bubble.explode(14, sx, cy);
        CP.sfx.pop();
      });
      this.time.delayedCall(1600, () => {
        if (this.state !== 'appearing') return;
        this.hero.setAlpha(1);
        this.player.body.enable = true;
        this.player.body.reset(sx, sy);
        this.inv = 0.6;
        this.state = 'play';
      });
    }

    pauseGame() {
      this.state = 'paused';
      this.physics.pause(); this.tweens.pauseAll(); this.anims.pauseAll();
      this.overlay([
        CP.ui.dim(this, 0.55),
        CP.ui.chunky(this, 512, 340, 'Paused', 80),
        CP.ui.label(this, 512, 404, CP.touchMode() ? 'Tap II to resume' : 'Press P to resume', 22, '#ffffff'),
      ]);
      this.ov.add(CP.ui.label(this, 512, 444, this.mode === 'test' ? 'Esc  back to the editor' : 'Esc  back to the menu', 18, '#ffe6a0'));
      this.ov.add(CP.ui.musicControl(this, 512 - 75, 492));
      this.ov.add(CP.ui.label(this, 512, 562, 'N  music on / off     -  +  volume', 14, 'rgba(255,255,255,0.6)', 2));
      CP.music.duck(true);
    }

    resumeGame() {
      CP.music.duck(false);
      this.state = 'play';
      this.overlay(null);
      this.physics.resume(); this.tweens.resumeAll(); this.anims.resumeAll();
    }

    /* ---------- main update ---------- */
    update(time, delta) {
      const dt = delta / 1000, c = this.ctrl;
      switch (this.state) {
        case 'play':
          if (this.mode === 'test' && c.take('exit')) this.toEditor();
          else if (c.take('pause')) this.pauseGame();
          else if (c.take('restart')) this.nextLevel(Object.assign({}, this.startData, { score: this.levelScore, lives: this.lives }));
          else this.updatePlayer(dt);
          break;
        case 'paused':
          if (c.take('exit')) { this.anims.resumeAll(); this.mode === 'test' ? this.toEditor() : this.toTitle(); }
          else if (c.take('pause') || c.take('confirm')) this.resumeGame();
          break;
        case 'over':
          this.overT += dt;
          if (this.overT > 0.8 && c.take('confirm')) this.toTitle();
          break;
      }
      if (this.state === 'play' || this.state === 'dying' || this.state === 'appearing') {
        this.clock += dt * PACE;
        this.updateWorld(dt * PACE);
        }
      c.endFrame();
    }

    updateWorld(dt) {
      const t = this.clock;
      for (const m of this.movers) {
        const cfg = m.cfg, w = TAU / cfg.period, a = w * t + (cfg.phase || 0);
        const tx = cfg.x + cfg.ax * Math.sin(a), ty = cfg.y + cfg.ay * Math.sin(a);
        // follow the sine path by velocity, with a small correction so it never drifts
        m.body.setVelocity(cfg.ax * w * Math.cos(a) + (tx - m.x) * 8, cfg.ay * w * Math.cos(a) + (ty - m.y) * 8);
      }
      // while the hero materialises (and a moment after), a walker heading at the spawn point turns away once,
      // then patrols normally (turning it every time would trap it in a strip at the end of its platform)
      this.spawnGuard -= dt;
      const [sx, sy] = this.D.start, guard = this.spawnGuard > 0;
      this.walkers.getChildren().forEach(w => {
        if (w.dead || (w.mode && w.mode !== 'walk')) return;
        const nearSpawn = guard && !w.guarded && Math.abs(w.y - sy) < 8 && Math.abs(w.x - sx) < 110 && (sx - w.x) * w.dir > 0;
        if (nearSpawn) w.guarded = true;
        if (nearSpawn || (w.x <= w.minX && w.dir < 0) || (w.x >= w.maxX && w.dir > 0)) {
          w.dir *= -1; w.setVelocityX(w.dir * w.sp);
          this.faceWalker(w);
        }
      });
      this.updateGolems(dt);
      this.updateMars(dt);
      for (const f of this.flyers) {
        if (f.dead) continue;
        // the phase advances by time (not t / per) so an angry spinner can speed up without jumping
        const k = f.cfg, a = (k.ph += TAU * dt / k.per);
        if (k.orbit) { f.setPosition(k.x + k.ax * Math.cos(a), k.y + k.ay * Math.sin(a)); continue; }
        const nx = k.x + k.ax * Math.sin(a);
        if (f.kind === 'ghost') f.setFlipX(nx < f.x);
        f.setPosition(nx, k.y + k.ay * Math.sin(2 * a));
      }
    }

    // Play a golem clip at the pace of its movement (an angry golem moves, and so animates, faster).
    golemAnim(w, clip, startFrame) {
      w.play({ key: 'golem-' + clip, startFrame: startFrame || 0 });
      w.anims.timeScale = clip === 'walk' ? Phaser.Math.Clamp(w.sp / GOLEM_STRIDE, 0.6, 5.5)
        : clip === 'charge' ? Math.min(CHARGE * w.rage / GOLEM_CHARGE_STRIDE, CHARGE_ANIM_MAX) : w.rage;
    }

    // Charging golems: rest (at an end, facing across) → windup (paws the ground) → charge → skid
    // (stops right at the far end) → rest, turned round. They pay no attention to the hero.
    updateGolems(dt) {
      this.walkers.getChildren().forEach(w => {
        if (w.dead || w.kind !== 'charger') return;
        const v = CHARGE * w.rage;
        w.t += dt;
        if (w.mode === 'rest') {
          if (w.t >= GOLEM_REST / w.rage) { w.mode = 'windup'; w.t = 0; this.golemAnim(w, 'charge_start'); }
        } else if (w.mode === 'windup') {
          // the clip lunges at 0.58 s: start moving there and reach full speed as the clip ends
          const e = w.t * w.rage, launch = 0.58, ramp = 0.22;
          if (e >= launch) w.setVelocityX(w.dir * v * Math.min(1, (e - launch) / ramp));
          if (e >= launch + ramp) {
            w.mode = 'charge'; w.t = 0;
            this.golemAnim(w, 'charge');
            this.fx.dust.explode(5, w.x - w.dir * 20, w.y);
          }
        } else if (w.mode === 'charge') {
          w.setVelocityX(w.dir * v);
          // start the skid so that it stops right at the end of the slab
          const left = w.dir > 0 ? w.maxX - w.x : w.x - w.minX;
          if (left <= v * 0.17) {
            w.mode = 'skid'; w.t = 0;
            this.golemAnim(w, 'charge_end');
            this.fx.dust.explode(8, w.x + w.dir * 20, w.y);
          }
        } else if (w.mode === 'skid') {
          w.setVelocityX(w.dir * v * Math.max(0, 1 - w.t / 0.34));
          if (w.t >= 0.34 && !w.thudded) { w.thudded = true; CP.sfx.crack(); }
          if (w.t >= 0.9 / w.rage) {
            w.mode = 'rest'; w.t = 0; w.thudded = false;
            w.setVelocityX(0);
            w.dir *= -1; this.faceWalker(w);
            this.golemAnim(w, 'idle');
          }
        }
        w.x = Phaser.Math.Clamp(w.x, w.minX, w.maxX);
      });
    }

    // Alien, golem and crab art all face screen-right; mirror them when walking left.
    faceWalker(w) { w.setFlipX(w.dir < 0); }

    updateMars(dt) {
      const px = this.player.x, py = this.player.y, alive = this.state === 'play';
      // boulder chutes
      for (const c of this.chutes) {
        c.t -= dt;
        if (c.t <= 0) {
          c.t = c.every;
          if (this.boulders.countActive() < 6) {
            const b = this.boulders.create(c.x + c.dir * 8, c.y + 4, 'boulder').setDepth(12);
            b.setCircle(16, 4, 4);
            b.body.setMaxVelocityY(900);
            b.dir = c.dir;
            this.fx.rock.explode(6, c.x, c.y + 8);
          }
        }
      }
      this.boulders.getChildren().slice().forEach(b => {
        if (b.x < 18) b.dir = 1;
        if (b.x > W - 18) b.dir = -1;
        b.setVelocityX(b.dir * 135);
        b.rotation += b.dir * 135 * dt / 16;
        if (b.y > H + 60) b.destroy();
      });
      // falling rocks
      for (const f of this.fallers) {
        if (f.state === 'idle' && alive && Math.abs(px - f.home.x) < 42 && py > f.home.y + 20 && py - f.home.y < 560) {
          f.state = 'shake'; f.t = 0.6; CP.sfx.rumble();
        } else if (f.state === 'shake') {
          f.t -= dt;
          f.x = f.home.x + Math.sin(f.t * 90) * 2.2;
          if (f.t <= 0) { f.x = f.home.x; f.state = 'fall'; f.body.setAllowGravity(true); }
        } else if (f.state === 'fall' && f.y > H + 40) {
          this.hideFaller(f);
        } else if (f.state === 'gone') {
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'idle';
            f.body.reset(f.home.x, f.home.y);
            f.body.setAllowGravity(false);
            f.body.enable = true;
            f.setVisible(true).setAlpha(0).setScale(0.4);
            this.tweens.add({ targets: f, alpha: 1, scale: 1, duration: 500, ease: 'Back.out' });
          }
        }
      }
      // lava blobs
      for (const b of this.lavas) {
        if (b.state === 'wait') {
          b.t -= dt;
          if (b.t <= 0) {
            b.state = 'air'; b.y = H + 40; b.setVisible(true);
            b.vy = -Math.sqrt(2 * GRAV * (H + 40 - b.top));
            this.fx.ember.explode(8, b.x, H - 30);
            CP.sfx.hiss();
          }
        } else {
          b.vy += GRAV * dt;
          b.y += b.vy * dt;
          b.setFlipY(b.vy > 0);
          if (b.vy > 0 && b.y > H + 40) { b.state = 'wait'; b.t = b.wait; b.setVisible(false); this.fx.ember.explode(5, b.x, H - 30); }
        }
      }
    }

    shatterFaller(f) {
      if (f.state !== 'fall') return;
      this.fx.rock.explode(12, f.x, f.y);
      CP.sfx.shatter();
      this.hideFaller(f);
    }

    hideFaller(f) {
      f.state = 'gone'; f.t = 3;
      f.body.setVelocity(0, 0).setAllowGravity(false);
      f.body.enable = false;
      f.setVisible(false);
    }

    updatePlayer(dt) {
      const c = this.ctrl, b = this.player.body;
      const onGround = this.standT > 0;
      this.grounded = onGround; this.standT -= dt;
      const dir = (c.held('right') ? 1 : 0) - (c.held('left') ? 1 : 0);

      if (dir) {
        this.face = dir;
        let acc = onGround ? ACC_G : ACC_A;
        if (Math.sign(b.velocity.x) === -dir) acc *= 1.8;   // snappy turnarounds
        b.setAccelerationX(dir * acc); b.setDragX(0);
      } else {
        b.setAccelerationX(0); b.setDragX(onGround ? FRIC : FRIC * 0.3);
      }

      // jump buffering + coyote time make jumps forgiving
      if (c.take('jump')) this.buf = 0.13;
      this.buf -= dt; this.inv -= dt;
      this.coyote = onGround ? 0.1 : this.coyote - dt;
      if (this.buf > 0 && this.coyote > 0) {
        this.buf = 0; this.coyote = 0;
        b.setVelocityY(-JUMP);
        CP.sfx.jump();
        this.fx.dust.explode(5, this.player.x, this.player.y);
        this.squash(0.86, 1.16);
      }
      // releasing jump early cuts a jump short (not a stomp bounce); on the way down the hero falls a little floatier
      if (this.bouncing && (b.velocity.y >= 0 || onGround)) this.bouncing = false;
      b.setGravityY(b.velocity.y < 0 ? (c.held('jump') || this.bouncing ? 0 : GRAV * 1.3) : -GRAV * (1 - FALL));
      if (b.velocity.y > MAX_FALL) b.setVelocityY(MAX_FALL);

      this.checkPads();

      if (onGround && !this.wasGround && this.lastVy > 380) {
        this.squash(1 + Math.min(0.2, this.lastVy / 4000), 1 - Math.min(0.2, this.lastVy / 4000));
        this.fx.dust.explode(6, this.player.x, this.player.y);
      }
      this.wasGround = onGround;
      this.lastVy = b.velocity.y;
      this.lastBottom = b.bottom;
    }

    // A pad fires only when the hero's feet come down through its dome this step: falling onto it
    // from above. Walking through it, or rising up through it, does nothing.
    checkPads() {
      const b = this.player.body, prev = this.lastBottom;
      if (prev == null || b.velocity.y <= 0) return;
      for (const pad of this.pads) {
        const top = pad.y - PAD_TOP;
        let dx = Math.abs(this.player.x - pad.x);
        dx = Math.min(dx, W - dx);
        if (dx < PAD_HALF + b.width / 2 && prev <= top + 6 && b.bottom >= top) return this.padBounce(pad, top);
      }
    }

    padBounce(pad, top) {
      const b = this.player.body;
      b.reset(this.player.x, top);
      b.setVelocityY(-PAD_BOUNCE);
      this.bouncing = true;
      this.buf = 0; this.coyote = 0; this.standT = 0;
      this.lastBottom = b.bottom;
      CP.sfx.boing();
      this.squash(1.25, 0.75);
      this.fx.dust.explode(8, pad.x, pad.y - 6);
      // the dome shows pressed flat for a moment, then pops back up
      if (pad.timer) pad.timer.remove();
      pad.setFrame(1);
      pad.timer = this.time.delayedCall(120, () => pad.setFrame(0));
    }

    // Screen wrap: when the middle of the hero crosses an edge, move it one screen width or height
    // to the opposite edge. Velocity is untouched, so motion carries straight through.
    // The top edge is open sky, not a wrap: jumping above the screen just falls back down.
    wrapPlayer() {
      const p = this.player, mid = p.y - p.body.height / 2;
      let dx = 0, dy = 0;
      if (p.x < 0) dx = W; else if (p.x >= W) dx = -W;
      if (mid >= H) { dy = -H; this.wrappedDown = true; }
      if (!dx && !dy) return;
      p.setPosition(p.x + dx, p.y + dy);
      p.body.updateFromGameObject();
    }

    // Draw the hero again on the far side of any edge it overlaps, so half of it shows on each side.
    drawHeroGhosts() {
      const h = this.hero, ghosts = this.heroGhosts;
      ghosts.forEach(g => g.setVisible(false));
      if (this.state === 'dying' || !h.visible) return;
      const left = h.x - h.displayWidth * h.originX, right = left + h.displayWidth;
      const top = h.y - h.displayHeight * h.originY, bottom = top + h.displayHeight;
      const dxs = [0], dys = [0];
      if (left < 0) dxs.push(W); else if (right > W) dxs.push(-W);
      // only mirror the top edge onto the bottom while the hero is coming in from a fall-through
      if (top >= 0) this.wrappedDown = false;
      if (top < 0 && this.wrappedDown) dys.push(H); else if (bottom > H) dys.push(-H);
      let n = 0;
      for (const dx of dxs) for (const dy of dys) {
        if (!dx && !dy) continue;
        ghosts[n++].setTexture(h.texture.key, h.frame.name).setPosition(h.x + dx, h.y + dy)
          .setFlipX(h.flipX).setScale(h.scaleX, h.scaleY).setAngle(h.angle).setAlpha(h.alpha).setVisible(true);
      }
    }

    squash(sx, sy) {
      if (this.squashTw) this.squashTw.stop();
      this.hero.setScale(sx, sy);
      this.squashTw = this.tweens.add({ targets: this.hero, scaleX: 1, scaleY: 1, duration: 220, ease: 'Quad.out' });
    }

    syncHero() {
      if (this.state === 'dying') return this.drawHeroGhosts();
      if (this.state === 'play') this.wrapPlayer();
      const h = this.hero, b = this.player.body;
      h.setPosition(this.player.x, this.player.y).setFlipX(this.face < 0);
      if (this.state !== 'play') return this.drawHeroGhosts();
      const onGround = this.grounded || this.coyote > 0.05;
      const vx = Math.abs(b.velocity.x);
      if (!onGround) {
        // airborne frames of the coin's jump (takeoff stretch to landing reach), picked by vertical speed
        const c = CP.SPRITES.coin.clips[vx > 40 ? 'air_side' : 'air'];
        const k = Phaser.Math.Clamp((b.velocity.y + JUMP) / (2 * JUMP), 0, 1);
        h.anims.stop(); h.setFrame(c.start + Math.round(k * (c.count - 1)));
      } else if (vx > 20) {
        const run = vx > 150;
        h.play(run ? 'coin-run' : 'coin-walk', true);
        h.anims.timeScale = Phaser.Math.Clamp(run ? vx / RUN * 1.5 : vx / 150 * 1.6, 0.6, 1.8);
      } else h.play('coin-idle', true);
      h.setAlpha(this.inv > 0 && Math.floor(this.time.now / 60) % 2 ? 0.25 : 1);
      this.drawHeroGhosts();
    }

    /* ---------- interactions ---------- */
    floatText(x, y, text, color) {
      const t = CP.ui.pop(this, x, y, text, color).setDepth(40);
      this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
    }

    collectCoin(c) {
      if (this.state !== 'play') return;
      const v = CP.COIN_POINTS[c.kind];
      this.fx[c.kind].explode(7, c.x, c.y);
      this.floatText(c.x, c.y - 10, '+' + v, { g: '#ffe28a', s: '#e6ecff', b: '#ffc79a' }[c.kind]);
      c.destroy();
      this.score += v; this.left--;
      CP.sfx.coin(c.kind);
      this.syncRegistry();
      if (this.left <= 0) this.levelClear();
    }

    collectItem(it) {
      if (this.state !== 'play') return;
      CP.sfx.item();
      if (it.kind === 'heart') { this.lives = Math.min(9, this.lives + 1); this.floatText(it.x, it.y - 12, '1UP', '#ff7a8a'); this.fx.red.explode(14, it.x, it.y); }
      else { this.score += 100; this.floatText(it.x, it.y - 12, '+100', '#ffd36b'); this.fx.orange.explode(14, it.x, it.y); }
      this.tweens.killTweensOf(it);
      it.destroy();
      this.syncRegistry();
    }

    touchWalker(w) {
      if (w.dead || this.state !== 'play') return;
      const b = this.player.body;
      const onTop = b.velocity.y > 60 && b.bottom - w.body.top < 22;
      // right after a stomp the hero is still touching the enemy on the way back up: that's not a hit
      if (!onTop && this.clock < (w.safeUntil || 0)) return;
      if (onTop && w.hp > 1) {
        // the first stomp angers an enemy: it keeps walking, now faster (a second stomp finishes it)
        const golem = w.kind === 'golem' || w.kind === 'charger' || w.kind === 'tripod';
        w.hp--;
        w.safeUntil = this.clock + 0.35;
        w.sp *= 1.45;
        if (w.kind === 'charger') {
          // an angry charging golem charges faster and rests less
          w.rage = 1.25;
          w.anims.timeScale *= 1.25;
        } else {
          w.setVelocityX(w.dir * w.sp);
          w.anims.timeScale *= 1.45;
        }
        // white flash, then a tint marks a hurt enemy: hot orange for a cracked golem, red for an alien
        w.setTintFill(0xffffff);
        this.time.delayedCall(90, () => w.active && w.setTint(golem ? 0xff8a5c : 0xff7070));
        b.setVelocityY(this.stompBounce(w));
        this.score += 20; this.syncRegistry();
        this.floatText(w.x, w.y - 62, '+20', '#ffd3a0');
        if (golem) {
          CP.sfx.crack();
          this.cameras.main.shake(120, 0.004);
          (w.kind === 'golem' ? this.fx.rock : this.fx.stone).explode(8, w.x, w.y - 50);
        } else {
          CP.sfx.stomp();
          this.fx.grey.explode(6, w.x, w.y - 40);
        }
      } else if (onTop) {
        // stomp
        const golem = w.kind === 'golem' || w.kind === 'charger' || w.kind === 'tripod';
        w.dead = true; w.body.enable = false; w.anims.stop();
        this.tweens.add({ targets: w, scaleY: 0.2, scaleX: 1.3, alpha: 0, duration: 450, ease: 'Quad.out', onComplete: () => w.destroy() });
        b.setVelocityY(this.stompBounce(w));
        const pts = golem ? 100 : 50;
        this.score += pts; this.syncRegistry();
        if (golem) { CP.sfx.shatter(); (w.kind === 'golem' ? this.fx.rock : this.fx.stone).explode(22, w.x, w.y - 30); w.setVisible(false); }
        else { CP.sfx.stomp(); this.fx.grey.explode(10, w.x, w.y - 40); }
        this.floatText(w.x, w.y - 56, '+' + pts, '#ffffff');
      } else this.hurt();
    }

    // Ghosts die to a single stomp, spinning crabs to two; touching one any other way hurts.
    touchFlyer(f) {
      if (f.dead || this.state !== 'play') return;
      const b = this.player.body;
      const onTop = b.velocity.y > 60 && b.bottom - f.body.top < 22;
      if (!onTop && this.clock < (f.safeUntil || 0)) return;
      if (!onTop) return this.hurt();
      if (f.hp > 1) {
        // the first stomp angers a spinner: red, spinning faster and flying its loop faster
        f.hp--;
        f.safeUntil = this.clock + 0.35;
        f.cfg.per /= 1.45;
        f.anims.timeScale *= 1.6;
        f.setTintFill(0xffffff);
        this.time.delayedCall(90, () => f.active && f.setTint(0xff7070));
        b.setVelocityY(this.stompBounce(f));
        this.score += 20; this.syncRegistry();
        CP.sfx.stomp();
        this.fx.grey.explode(6, f.x, f.y);
        this.floatText(f.x, f.y - 30, '+20', '#ffd3a0');
        return;
      }
      const pts = f.kind === 'spinner' ? 100 : 50;
      f.dead = true; f.body.enable = false; f.anims.stop();
      this.tweens.add({ targets: f, scaleY: 0.2, scaleX: 1.3, alpha: 0, duration: 450, ease: 'Quad.out', onComplete: () => f.destroy() });
      b.setVelocityY(this.stompBounce(f));
      this.score += pts; this.syncRegistry();
      CP.sfx.stomp();
      this.fx.grey.explode(10, f.x, f.y);
      this.floatText(f.x, f.y - 30, '+' + pts, '#ffffff');
    }

    // Upward speed after landing on an enemy's head. A stomp is a bounce, not a jump: about 50px high
    // off every enemy, whatever you do with the jump button, and it can't be jumped out of again.
    stompBounce() {
      this.bouncing = true;
      this.buf = 0; this.coyote = 0;
      return -JUMP * 0.55;
    }

    hurt() { if (this.inv <= 0 && this.state === 'play') this.die(); }

    die() {
      if (this.state !== 'play') return;
      this.state = 'dying';
      if (this.mode !== 'test') this.lives--;
      this.syncRegistry();
      this.player.body.setVelocity(0, 0).setAcceleration(0, 0);
      this.player.body.enable = false;
      CP.sfx.die();
      this.cameras.main.shake(180, 0.006);
      this.fx.hero.explode(18, this.hero.x, this.hero.y - 20);
      const h = this.hero;
      h.setAlpha(1).setScale(1).play('coin-surprised');
      this.tweens.chain({
        targets: h,
        tweens: [
          { y: h.y - 90, angle: this.face * -200, duration: 330, ease: 'Quad.out' },
          { y: H + 90, angle: this.face * -720, duration: 900, ease: 'Quad.in' },
        ],
      });
      this.time.delayedCall(1500, () => (this.lives <= 0 ? this.gameOver() : this.respawn()));
    }

    respawn() { this.appear(); }

    // Mosaic the screen to black, then start a level (the next one, or this one again).
    nextLevel(data) {
      this.state = 'leaving';
      this.physics.pause();
      this.registry.set('hud', false);
      CP.ui.mosaic(this, () => this.scene.restart(data));
    }

    levelClear() {
      this.state = 'complete';
      if (this.mode === 'campaign') {
        const pr = CP.save.progress, id = this.worldDef.id, n = this.worldDef.levels.length;
        pr[id] = Math.max(pr[id] || 0, Math.min(n, this.levelIndex + 2));
        // clearing the last level of a world opens the next world
        const wi = CP.WORLDS.indexOf(this.worldDef), next = CP.WORLDS[wi + 1];
        if (this.levelIndex === n - 1 && next) pr[next.id] = Math.max(pr[next.id] || 0, 1);
        CP.save.best = Math.max(CP.save.best, this.score);
        CP.persist();
      }
      CP.sfx.clear();
      this.physics.pause();
      this.hero.setAlpha(1).setScale(1).play('coin-celebrate');
      const head = CP.ui.chunky(this, 512, 340, 'Level completed', 84);
      this.overlay([head]);
      head.setScale(0.5);
      this.tweens.add({ targets: head, scale: 1, duration: 500, ease: 'Back.out' });
      this.time.addEvent({ delay: 110, repeat: 24, callback: () => this.fx.confetti.explode(16, Phaser.Math.Between(80, W - 80), Phaser.Math.Between(120, 520)) });
      this.time.delayedCall(3000, () => {
        if (this.mode === 'test') this.toEditor();
        else if (this.mode === 'custom') this.endScreen(true);
        else if (this.levelIndex + 1 < this.worldDef.levels.length) this.nextLevel({ world: this.worldDef.id, level: this.levelIndex + 1, score: this.score, lives: this.lives });
        else this.endScreen(true);
      });
    }

    gameOver() {
      if (this.mode === 'campaign') { CP.save.best = Math.max(CP.save.best, this.score); CP.persist(); }
      CP.sfx.over();
      this.endScreen(false);
    }

    endScreen(won) {
      this.state = 'over'; this.overT = 0; this.won = won;
      CP.live = { inGame: false };
      const prompt = CP.ui.label(this, 512, 470, '', 20, '#ffe6a0').setAlpha(0);
      const tap = CP.touchMode();
      prompt.setText(won ? (tap ? 'Tap to play again' : 'Press Enter to play again')
        : (tap ? 'Tap to return to the planet map' : 'Press Enter to return to the planet map'));
      const campaign = this.mode === 'campaign';
      const next = campaign && CP.WORLDS[CP.WORLDS.indexOf(this.worldDef) + 1];
      if (!campaign || next) prompt.setText(tap ? 'Tap to return to the planet map' : 'Press Enter to return to the planet map');
      const head = campaign ? `${this.worldDef.name} cleared!` : 'Planet cleared!';
      const line = !campaign ? this.D.name
        : next ? `Next stop: ${next.name}. ${next.tagline}.`
        : 'Every world is coin-free. For now.';
      this.overlay(won ? [
        CP.ui.dim(this, 0.5),
        CP.ui.chunky(this, 512, 290, head, 76),
        CP.ui.label(this, 512, 360, campaign ? `Final score ${this.score}   ·   Best ${CP.save.best}` : `Score ${this.score}`, 26, '#ffffff'),
        CP.ui.label(this, 512, 402, line, 20, 'rgba(255,255,255,0.85)'),
        prompt,
      ] : [
        CP.ui.dim(this, 0.6),
        CP.ui.chunky(this, 512, 310, 'Game over', 92, '#ffd0d0', '#ff4d5e'),
        CP.ui.label(this, 512, 382, campaign ? `Score ${this.score}   ·   Best ${CP.save.best}` : `Score ${this.score}`, 24, '#ffffff'),
        prompt,
      ]);
      this.time.delayedCall(800, () => { prompt.setAlpha(1); CP.ui.blink(this, prompt); });
    }

    toTitle() {
      CP.music.duck(false);
      this.scene.stop('Hud');
      if (this.mode === 'campaign') {
        const next = this.won && CP.WORLDS[CP.WORLDS.indexOf(this.worldDef) + 1];
        this.scene.start('Title', next ? { world: next.id, sel: 0 } : { world: this.worldDef.id, sel: this.won ? 0 : this.levelIndex });
      }
      else this.scene.start('Title', { customId: this.startData.editId });
    }

    toEditor() {
      CP.music.duck(false);
      this.scene.stop('Hud');
      this.scene.start('Editor', { id: this.startData.editId });
    }
  };
})();
