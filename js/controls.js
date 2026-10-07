// Input: Phaser keyboard keys plus the on-screen touch buttons, merged into one interface.
(function () {
  var CP = window.CP = window.CP || {};

  // Shared state written by the HTML touch buttons.
  const touch = CP.touch = { left: false, right: false, down: false, jump: false, pressed: {} };

  // One-shot actions triggered by a key press (held state is read from Phaser keys).
  const ACTIONS = {
    ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'], ArrowDown: ['down'], KeyS: ['down'],
    ArrowUp: ['jump', 'confirm', 'up'], KeyW: ['jump', 'confirm', 'up'], Space: ['jump', 'confirm', 'start'], KeyZ: ['jump', 'confirm'], KeyK: ['jump', 'confirm'],
    Enter: ['confirm', 'start'], NumpadEnter: ['confirm', 'start'], KeyP: ['pause'], Escape: ['pause', 'exit'], KeyR: ['restart'], KeyE: ['editor'],
  };

  CP.Controls = class Controls {
    constructor(scene) {
      this.k = scene.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,Z,K,ENTER,P,ESC,R');
      this.p = {};
      scene.input.keyboard.on('keydown', e => {
        if (e.repeat) return;
        (ACTIONS[e.code] || []).forEach(a => { this.p[a] = true; });
      });
    }
    held(a) {
      const k = this.k;
      switch (a) {
        case 'left': return k.LEFT.isDown || k.A.isDown || touch.left;
        case 'right': return k.RIGHT.isDown || k.D.isDown || touch.right;
        case 'down': return k.DOWN.isDown || k.S.isDown || touch.down;
        case 'jump': return k.UP.isDown || k.W.isDown || k.SPACE.isDown || k.Z.isDown || k.K.isDown || touch.jump;
      }
      return false;
    }
    // True once if the action was pressed since the last frame.
    take(a) {
      const v = !!(this.p[a] || touch.pressed[a]);
      delete this.p[a]; delete touch.pressed[a];
      return v;
    }
    press(a) { this.p[a] = true; }
    endFrame() { this.p = {}; touch.pressed = {}; }
  };

  /* ---------- on-screen buttons ---------- */
  const el = document.getElementById('touch');
  CP.touchMode = () => !el.hidden;
  const show = () => { el.hidden = false; };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) show();
  window.addEventListener('touchstart', show, { passive: true, once: true });
  window.addEventListener('blur', () => { touch.left = touch.right = touch.down = touch.jump = false; });

  for (const b of el.querySelectorAll('.tbtn')) {
    const k = b.dataset.k;
    const down = e => {
      e.preventDefault();
      if (CP.audio) CP.audio.unlock();
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      b.classList.add('on');
      if (k === 'pause') { touch.pressed.pause = true; return; }
      touch[k] = true;
      touch.pressed[k] = true;
      if (k === 'jump') { touch.pressed.confirm = true; touch.pressed.start = true; }
    };
    const up = () => { b.classList.remove('on'); if (k !== 'pause') touch[k] = false; };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
})();
