// Boot: generate every shared texture and animation, wait for the web fonts, then start.
(function () {
  var CP = window.CP = window.CP || {};

  CP.BootScene = class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() { CP.art.loadSprites(this); }

    create() {
      this.add.text(512, 384, 'Loading planets…', { fontFamily: 'sans-serif', fontSize: '20px', color: '#c9c6e8' }).setOrigin(0.5);
      CP.art.makeShared(this);
      CP.art.makeAnims(this);

      // Phaser text is rasterised once, so the fonts must be ready before any scene draws text.
      const fonts = document.fonts
        ? Promise.all([document.fonts.load('700 40px "Fredoka"'), document.fonts.load('800 18px "Nunito"')])
        : Promise.resolve();
      const timeout = new Promise(r => setTimeout(r, 3000));
      Promise.race([fonts, timeout]).catch(() => {}).then(() => {
        const d = CP.bootData || {};
        const world = CP.world(d.world);
        if (d.inGame && d.level >= 0 && d.level < world.levels.length) {
          this.scene.start('Game', { world: world.id, level: d.level, score: d.score || 0, lives: d.lives || 3 });
        } else {
          this.scene.start('Title', {});
        }
      });
    }
  };
})();
