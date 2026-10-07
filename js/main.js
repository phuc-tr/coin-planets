// Phaser game configuration and start-up.
(function () {
  var CP = window.CP = window.CP || {};

  function start(data) {
    if (CP.game) return;
    CP.bootData = data || {};
    const pr = CP.bootData.progress;
    if (pr) Object.keys(CP.save.progress).forEach(k => { CP.save.progress[k] = Math.max(CP.save.progress[k], pr[k] || 0); });
    CP.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: 1024,
      height: 768,
      backgroundColor: '#04050b',
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1900 }, fps: 120, debug: false },
      },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 3 },
      scene: [CP.BootScene, CP.TitleScene, CP.GameScene, CP.HudScene, CP.EditorScene],
    });
  }

  // When this page is hosted as a Claude artifact, keep the player's place across page updates.
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) {
    try { hot.snapshot(() => Object.assign({ progress: CP.save.progress }, CP.live || { inGame: false })); } catch (e) {}
  }
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
