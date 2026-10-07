// HUD: runs in parallel on top of the Game scene and redraws when the registry changes.
(function () {
  var CP = window.CP = window.CP || {};
  const W = 1024;

  CP.HudScene = class HudScene extends Phaser.Scene {
    constructor() { super('Hud'); }

    create() {
      const r = this.registry;
      this.add.image(30, 30, 'heart').setScale(34 / 30);
      this.lives = CP.ui.chunky(this, 52, 30, '3', 40).setOrigin(0, 0.5);
      this.score = CP.ui.chunky(this, W - 18, 30, '0', 40).setOrigin(1, 0.5);
      this.mute = CP.ui.label(this, W - 20, 66, 'SOUND OFF · M', 11, 'rgba(255,255,255,0.6)', 1.5).setOrigin(1, 0.5);

      const refresh = () => {
        this.lives.setText(String(r.get('lives')));
        this.score.setText(String(r.get('score')));
        this.sys.setVisible(r.get('hud') !== false);      // hidden while a level fades in or out
      };
      refresh();
      r.events.on('changedata', refresh);
      this.events.once('shutdown', () => r.events.off('changedata', refresh));
    }

    update() { this.mute.setVisible(CP.audio.muted); }
  };
})();
