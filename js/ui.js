// Text and panel helpers shared by the scenes. The look matches the sprite-engine characters:
// soft 3D clay/vinyl, lit from the top-left, no black outlines.
(function () {
  var CP = window.CP = window.CP || {};
  const FONT_D = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
  const FONT_B = '"Nunito", "Trebuchet MS", system-ui, sans-serif';

  // Move a hex colour toward white (k > 0) or black (k < 0).
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.min(1, Math.abs(k));
    const ch = v => Math.round(v + (t - v) * a);
    return '#' + ((ch(n >> 16 & 255) << 16) | (ch(n >> 8 & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0');
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  CP.ui = {
    FONT_D, FONT_B, shade,

    // Big rounded game text: a gradient face sitting on a darker "extruded" copy of itself.
    chunky(scene, x, y, str, size, top, bot) {
      const t = scene.add.text(x, y, str, {
        fontFamily: FONT_D, fontStyle: '700', fontSize: size + 'px',
        padding: { x: 4, y: Math.ceil(size * 0.14) },
      }).setOrigin(0.5);
      t.depthPx = Math.max(2, Math.round(size * 0.075));
      CP.ui.gradient(t, top || '#fff4b8', bot || '#ffb300');
      return t;
    },
    gradient(t, top, bot) {
      const g = t.context.createLinearGradient(0, 0, 0, t.height);
      g.addColorStop(0.18, top); g.addColorStop(0.62, bot); g.addColorStop(0.92, shade(bot, -0.12));
      t.setFill(g);
      t.setShadow(0, t.depthPx || 3, shade(bot, -0.45), 0, false, true);
      return t;
    },
    // Small floating score text ("+10"), extruded the same way.
    pop(scene, x, y, str, color) {
      const t = scene.add.text(x, y, str, { fontFamily: FONT_D, fontStyle: '700', fontSize: '20px', color, padding: { x: 2, y: 3 } }).setOrigin(0.5);
      t.setShadow(0, 2, shade(color, -0.5), 0, false, true);
      return t;
    },
    label(scene, x, y, str, size, color, spacing) {
      const t = scene.add.text(x, y, str, {
        fontFamily: FONT_B, fontStyle: '800', fontSize: size + 'px', color: color || '#ffffff', align: 'center',
        padding: { x: 2, y: 4 },
      }).setOrigin(0.5);
      t.setShadow(0, 2, 'rgba(0,0,0,0.45)', 5, false, true);
      if (spacing && t.setLetterSpacing) t.setLetterSpacing(spacing);
      return t;
    },

    // A glassy rounded panel with a soft shadow, a lit top edge and a hint of the planet's glow.
    panel(scene, x, y, w, h, glowHex) {
      const pad = 28, key = `panel-${w}x${h}-${glowHex}`;
      if (!scene.textures.exists(key)) {
        const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2), g = tex.getContext();
        const r = 26;
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
        rrect(g, pad, pad, w, h, r); g.fillStyle = 'rgba(14,16,40,0.92)'; g.fill();
        g.restore();
        g.save(); rrect(g, pad, pad, w, h, r); g.clip();
        let gr = g.createLinearGradient(0, pad, 0, pad + h);
        gr.addColorStop(0, 'rgba(58,64,112,0.95)'); gr.addColorStop(0.5, 'rgba(24,27,58,0.94)'); gr.addColorStop(1, 'rgba(12,14,34,0.96)');
        g.fillStyle = gr; g.fillRect(pad, pad, w, h);
        // the planet's colour glowing in from the top
        const n = parseInt(glowHex.slice(1), 16), rgb = `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`;
        gr = g.createRadialGradient(pad + w / 2, pad - h * 0.2, 10, pad + w / 2, pad, Math.max(w, h) * 0.7);
        gr.addColorStop(0, `rgba(${rgb},0.32)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.fillRect(pad, pad, w, h);
        // glossy sheen across the top third
        gr = g.createLinearGradient(0, pad, 0, pad + h * 0.38);
        gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; rrect(g, pad + 6, pad + 4, w - 12, h * 0.38, r - 6); g.fill();
        g.restore();
        // bevel: light along the top, shade along the bottom (no dark outline)
        g.save(); rrect(g, pad + 1, pad + 1, w - 2, h - 2, r - 1); g.clip();
        g.lineWidth = 3;
        gr = g.createLinearGradient(0, pad, 0, pad + h);
        gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.04)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
        g.strokeStyle = gr; rrect(g, pad + 1.5, pad + 1.5, w - 3, h - 3, r - 1.5); g.stroke();
        g.restore();
        tex.refresh();
      }
      return scene.add.image(x - pad, y - pad, key).setOrigin(0);
    },

    // A small glossy pill, used behind buttons drawn in the canvas.
    pill(scene, w, h, top, bot) {
      const key = `pill-${w}x${h}-${top}-${bot}`, pad = 10;
      if (!scene.textures.exists(key)) {
        const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2), g = tex.getContext(), r = h / 2;
        g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
        rrect(g, pad, pad, w, h, r); g.fillStyle = bot; g.fill(); g.restore();
        let gr = g.createLinearGradient(0, pad, 0, pad + h);
        gr.addColorStop(0, top); gr.addColorStop(1, bot);
        rrect(g, pad, pad, w, h, r); g.fillStyle = gr; g.fill();
        gr = g.createLinearGradient(0, pad, 0, pad + h * 0.5);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        rrect(g, pad + 4, pad + 2, w - 8, h * 0.5, r - 2); g.fillStyle = gr; g.fill();
        tex.refresh();
      }
      return key;
    },

    // Mosaic out: the screen breaks into ever bigger blocks while it fades to black, then calls done.
    // (Pixelation needs WebGL; the canvas renderer just fades.)
    mosaic(scene, done) {
      const cam = scene.cameras.main;
      const fx = scene.game.renderer.type === Phaser.WEBGL && cam.postFX ? cam.postFX.addPixelate(1) : null;
      const cover = scene.add.rectangle(512, 384, 1024, 768, 0x000000, 0).setDepth(1000);
      scene.input.enabled = false;
      scene.tweens.addCounter({
        from: 0, to: 1, duration: 650, ease: 'Quad.in',
        onUpdate: tw => {
          const v = tw.getValue();
          if (fx) fx.amount = 1 + v * 44;
          cover.fillAlpha = Phaser.Math.Clamp((v - 0.3) / 0.7, 0, 1);
        },
        onComplete: () => { if (fx) cam.postFX.remove(fx); scene.input.enabled = true; done(); },
      });
    },

    // Music control in the menus' square style: a note button (music on/off) and five volume bars.
    // (x, y) is its top-left corner; it is 150 x 48. Returns the display objects.
    musicControl(scene, x, y) {
      const M = CP.music, S = 48, BW = 12, GAP = 6, L = 4, g = scene.add.graphics();
      const bx = x + S + 14;
      const draw = (hover) => {
        const on = M.on, lvl = on ? Math.round(M.volume * 5) : 0;
        g.clear().fillStyle(hover ? 0xffffff : 0x000000, 1).fillRect(x, y, S, S).lineStyle(L, 0xffffff, 1).strokeRect(x, y, S, S);
        const ink = hover ? 0x000000 : 0xffffff, cx = x + S / 2, cy = y + S / 2;
        // an eighth note
        g.fillStyle(ink, 1).fillEllipse(cx - 5, cy + 9, 13, 10).fillRect(cx, cy - 13, 3, 22)
          .fillTriangle(cx + 3, cy - 13, cx + 13, cy - 5, cx + 3, cy - 4);
        if (!on) g.lineStyle(4, hover ? 0x000000 : 0xff6b7d, 1).lineBetween(x + 9, y + S - 9, x + S - 9, y + 9);
        for (let i = 0; i < 5; i++) {
          const h = 14 + i * 7, left = bx + i * (BW + GAP), top = y + S - 6 - h;
          if (i < lvl) g.fillStyle(0xffffff, 1).fillRect(left, top, BW, h);
          else g.lineStyle(2, 0xffffff, 0.35).strokeRect(left + 1, top + 1, BW - 2, h - 2);
        }
      };
      draw(false);
      const tog = scene.add.zone(x + S / 2, y + S / 2, S, S).setInteractive({ useHandCursor: true });
      tog.on('pointerover', () => draw(true));
      tog.on('pointerout', () => draw(false));
      tog.on('pointerdown', () => { CP.audio.unlock(); M.toggle(); });
      const zones = [tog];
      for (let i = 0; i < 5; i++) {
        const z = scene.add.zone(bx + i * (BW + GAP) + BW / 2, y + S / 2, BW + GAP, S).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => { CP.audio.unlock(); M.setVolume(M.on && Math.round(M.volume * 5) === i + 1 && i === 0 ? 0 : (i + 1) / 5); });
        zones.push(z);
      }
      const off = M.onChange(() => draw(false));
      g.once('destroy', off);
      scene.events.once('shutdown', off);
      return [g, ...zones];
    },

    dim(scene, a) { return scene.add.rectangle(512, 384, 1024, 768, 0x03040a, a); },
    blink(scene, target) {
      scene.tweens.add({ targets: target, alpha: 0.15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return target;
    },
  };
})();
