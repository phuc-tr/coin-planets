// Procedural art. Everything is drawn once with the Canvas 2D API and registered as a
// Phaser texture: single images for scenery, and sprite sheets (frames side by side)
// for anything that animates. Phaser then plays those frames as animations.
(function () {
  var CP = window.CP = window.CP || {};
  const W = 1024, H = 768, TAU = Math.PI * 2;

  /* ---------- helpers ---------- */
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
  }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }

  // A single image texture.
  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h);
    draw(t.getContext());
    t.refresh();
  }
  // A sprite sheet: n frames of fw x fh laid out in a row, frame names 0..n-1.
  function sheet(scene, key, fw, fh, n, drawFrame) {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, fw * n, fh);
    const g = t.getContext();
    for (let i = 0; i < n; i++) {
      g.save(); g.translate(i * fw, 0);
      g.beginPath(); g.rect(0, 0, fw, fh); g.clip();
      drawFrame(g, i);
      g.restore();
      t.add(i, 0, i * fw, 0, fw, fh);
    }
    t.refresh();
  }

  /* ---------- scenery ---------- */
  function spikeShape(g, cx, base, w, h, up) {
    const tip = up ? base - h : base + h, mid = (base + tip) / 2;
    const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    gr.addColorStop(0, '#6c707a'); gr.addColorStop(0.42, '#f3f5f9'); gr.addColorStop(1, '#868b96');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx - w / 2, base);
    g.quadraticCurveTo(cx - w * 0.14, mid, cx, tip);
    g.quadraticCurveTo(cx + w * 0.14, mid, cx + w / 2, base);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(25,26,36,0.55)'; g.lineWidth = 1; g.stroke();
  }

  function drawPlanet(g, p, rng) {
    const { x, y, r, kind, c } = p;
    const ring = (front) => {
      g.save(); g.translate(x, y); g.rotate(-0.32); g.scale(1, 0.26);
      g.beginPath(); g.arc(0, 0, r * 1.9, front ? 0 : Math.PI, front ? Math.PI : TAU);
      g.lineWidth = r * 0.5; g.strokeStyle = hexA(c[1], 0.55); g.stroke();
      g.lineWidth = r * 0.12; g.strokeStyle = hexA(c[2], 0.7); g.stroke();
      g.restore();
    };
    if (kind === 'ringed') ring(false);
    const halo = g.createRadialGradient(x, y, r * 0.9, x, y, r * 1.8);
    halo.addColorStop(0, hexA(c[1], 0.18)); halo.addColorStop(1, hexA(c[1], 0));
    g.fillStyle = halo; g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    g.fillStyle = c[0]; g.fillRect(x - r, y - r, r * 2, r * 2);
    if (kind === 'banded' || kind === 'ringed') {
      let yy = y - r;
      while (yy < y + r) {
        const h = r * (0.05 + rng() * (kind === 'banded' ? 0.17 : 0.1));
        g.fillStyle = hexA(c[1 + ((rng() * 3) | 0)], kind === 'banded' ? 0.5 + rng() * 0.45 : 0.25 + rng() * 0.25);
        g.beginPath();
        g.moveTo(x - r, yy);
        for (let i = 0; i <= 8; i++) g.lineTo(x - r + i * r / 4, yy + Math.sin(i * 1.3 + yy) * r * 0.02);
        g.lineTo(x + r, yy + h); g.lineTo(x - r, yy + h); g.closePath(); g.fill();
        yy += h;
      }
    } else {
      for (let i = 0; i < 16; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.9, cr = r * (0.05 + rng() * 0.16);
        const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
        g.fillStyle = hexA(c[2], 0.45); ell(g, cx, cy, cr, cr * 0.85); g.fill();
        g.fillStyle = hexA(c[3], 0.35); ell(g, cx - cr * 0.15, cy - cr * 0.2, cr * 0.75, cr * 0.6); g.fill();
      }
    }
    const sh = g.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.1, x, y, r * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,0.35)');
    sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.fillStyle = sh; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
    if (kind === 'ringed') ring(true);
  }

  function hashStr(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
    return h;
  }

  function makeBG(th, seed, art) {
    const c = mk(W, H), g = c.getContext('2d');
    const rng = mulberry(seed);
    if (art) {
      // painted backdrop, dimmed a little so platforms and coins stay readable
      g.drawImage(art, 0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, W, H);
      return c;
    }
    g.fillStyle = th.sky; g.fillRect(0, 0, W, H);
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, hexA(th.glow, 0.22));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 430; i++) {
      const x = rng() * W, y = rng() * H * 0.88, big = rng() > 0.93;
      const r = big ? 1 + rng() * 1.2 : 0.3 + rng() * 0.8;
      g.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.75})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (big && rng() > 0.5) {
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x - r * 4, y); g.lineTo(x + r * 4, y); g.moveTo(x, y - r * 4); g.lineTo(x, y + r * 4); g.stroke();
      }
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const x = rng() * W, y = H * (0.15 + rng() * 0.45), rx = 120 + rng() * 220;
      const rg = g.createRadialGradient(x, y, 0, x, y, rx);
      rg.addColorStop(0, hexA(th.glow, 0.05 + rng() * 0.04)); rg.addColorStop(1, hexA(th.glow, 0));
      g.fillStyle = rg; g.save(); g.translate(x, y); g.scale(1, 0.35); g.translate(-x, -y);
      g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
    }
    for (let i = 0; i < 70; i++) {
      const x = rng() * W, y = H * 0.66 + rng() * H * 0.42, r = 70 + rng() * 220;
      const col = rng() < 0.62 ? th.glow : th.glow2;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, hexA(col, 0.08 + rng() * 0.12)); rg.addColorStop(1, hexA(col, 0));
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    gr = g.createLinearGradient(0, H * 0.7, 0, H);
    gr.addColorStop(0, hexA(th.glow, 0)); gr.addColorStop(0.4, hexA(th.glow, 0.32)); gr.addColorStop(1, hexA(th.glow2, 0.55));
    g.fillStyle = gr; g.fillRect(0, H * 0.7, W, H * 0.3);
    g.globalCompositeOperation = 'source-over';
    drawPlanet(g, th.planet, rng);
    let x = -10;
    while (x < W + 10) {
      const n = 3 + (rng() * 6 | 0);
      for (let i = 0; i < n; i++) {
        const w = 11 + rng() * 8, h = 24 + rng() * 30;
        spikeShape(g, x + w / 2, H + 2, w, h, true);
        x += w * 0.8;
      }
      x += 30 + rng() * 110;
    }
    return c;
  }

  // Slab colours: grey moon rock by default, or a theme's own [top, middle, bottom].
  const GREY_ROCK = ['#7a7a82', '#55555d', '#2a2a30'];

  // A rock slab texture of (w + 8) x 44; the walkable top edge sits at y = 4.
  // Smooth slabs (Jupiter) trade the speckles and cracks for soft cloud bands.
  function makeRock(w, rng, pal, smooth) {
    pal = pal || GREY_ROCK;
    const c = mk(w + 8, 44), g = c.getContext('2d');
    const pts = [];
    for (let x = 14; x <= w - 6; x += 9 + rng() * 4) pts.push([x, 3.5 + rng() * 2]);
    const rc = [w + 4 - 13, 18];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 6, rr = 14 + (rng() - 0.5) * 2.5; pts.push([rc[0] + Math.cos(a) * rr, rc[1] + Math.sin(a) * rr]); }
    for (let x = w - 6; x >= 14; x -= 8 + rng() * 5) pts.push([x, 30 + rng() * 4]);
    const lc = [17, 18];
    for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + i * Math.PI / 6, rr = 14 + (rng() - 0.5) * 2.5; pts.push([lc[0] + Math.cos(a) * rr, lc[1] + Math.sin(a) * rr]); }
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); };
    g.save(); g.translate(0, 3); path(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.restore();
    path();
    const gr = g.createLinearGradient(0, 3, 0, 34);
    gr.addColorStop(0, pal[0]); gr.addColorStop(0.35, pal[1]); gr.addColorStop(1, pal[2]);
    g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip();
    if (smooth) {
      for (let y = 8; y < 34; y += 5 + rng() * 4) {
        const h = 2 + rng() * 3, light = rng() < 0.5;
        g.fillStyle = light ? `rgba(255,240,210,${0.1 + rng() * 0.12})` : `rgba(90,40,10,${0.1 + rng() * 0.14})`;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= w + 8; x += 12) g.lineTo(x, y + Math.sin(x / 23 + y) * 1.2);
        for (let x = w + 8; x >= 0; x -= 12) g.lineTo(x, y + h + Math.sin(x / 19 + y) * 1.2);
        g.fill();
      }
      g.restore();
    } else {
    for (let i = 0; i < w * 1.8; i++) {
      const x = 4 + rng() * w, y = 2 + rng() * 34, r = 0.5 + rng() * 2;
      g.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${0.04 + rng() * 0.13})` : `rgba(0,0,0,${0.12 + rng() * 0.28})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (let i = 0; i < w / 14; i++) {
      const x = 6 + rng() * (w - 4), y = 8 + rng() * 20;
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + rng() * 6, y + (rng() - 0.5) * 6); g.stroke();
    }
    g.restore();
    }
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4;
    g.beginPath(); let first = true;
    for (const p of pts) { if (p[1] > 7) continue; first ? g.moveTo(p[0], p[1] + 0.6) : g.lineTo(p[0], p[1] + 0.6); first = false; }
    g.stroke();
    path(); g.strokeStyle = 'rgba(10,10,14,0.6)'; g.lineWidth = 1.2; g.stroke();
    return c;
  }

  /* ---------- enemies drawn in code (drawn facing right; Phaser flips them) ---------- */
  function drawFlyer(g, sw) {
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 34);
    glow.addColorStop(0, 'rgba(220,230,255,0.25)'); glow.addColorStop(1, 'rgba(220,230,255,0)');
    g.fillStyle = glow; g.fillRect(-34, -34, 68, 68);
    g.strokeStyle = '#b4b8c4'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-3, 12); g.quadraticCurveTo(-10, 18, -9 + sw, 26);
    g.moveTo(3, 12); g.quadraticCurveTo(10, 18, 9 + sw, 26);
    g.moveTo(-2, 16); g.lineTo(-3 + sw, 30); g.moveTo(2, 16); g.lineTo(3 + sw, 30);
    g.stroke();
    g.fillStyle = '#d4d7df'; ell(g, 0, 16, 5, 7); g.fill();
    const gr = g.createRadialGradient(-5, -6, 2, 0, 0, 20);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#c9ccd5'); gr.addColorStop(1, '#7a7e8b');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 13); g.bezierCurveTo(-14, 10, -17, -4, -15, -9); g.bezierCurveTo(-12, -19, 12, -19, 15, -9); g.bezierCurveTo(17, -4, 14, 10, 0, 13); g.fill();
    g.fillStyle = '#05050a';
    ell(g, -5.5, -2, 4.6, 6.6, 0.5); g.fill();
    ell(g, 7.5, -2, 4.6, 6.6, -0.5); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    ell(g, -6.5, -5, 1.2, 1.6); g.fill(); ell(g, 6.5, -5, 1.2, 1.6); g.fill();
  }

  // An irregular rock lump with speckles; used by boulders, falling rocks and the boulder chute.
  function rockLump(g, x, y, rx, ry, rng, pal, sharpBottom) {
    const pts = [], n = 11;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, k = 0.84 + rng() * 0.24;
      let py = y + Math.sin(a) * ry * k;
      if (sharpBottom && Math.sin(a) > 0.6) py += ry * 0.5 * (Math.sin(a) - 0.6) * 2.5;
      pts.push([x + Math.cos(a) * rx * k, py]);
    }
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => g.lineTo(p[0], p[1])); g.closePath(); };
    const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 1, x, y, Math.max(rx, ry) * 1.15);
    gr.addColorStop(0, pal[0]); gr.addColorStop(0.55, pal[1]); gr.addColorStop(1, pal[2]);
    path(); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip();
    for (let i = 0; i < rx * ry * 0.25; i++) {
      g.fillStyle = rng() < 0.5 ? `rgba(255,230,210,${0.05 + rng() * 0.12})` : `rgba(0,0,0,${0.12 + rng() * 0.25})`;
      g.beginPath(); g.arc(x + (rng() - 0.5) * rx * 2, y + (rng() - 0.5) * ry * 2, 0.5 + rng() * 1.6, 0, TAU); g.fill();
    }
    g.restore();
    path(); g.strokeStyle = 'rgba(25,8,2,0.7)'; g.lineWidth = 1.2; g.stroke();
  }
  const MARS_ROCK = ['#c27a52', '#8a4428', '#3d170a'];

  function drawLavaBlob(g, k) {
    const flick = [0, 2, -1][k];
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 22);
    glow.addColorStop(0, 'rgba(255,150,40,0.55)'); glow.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = glow; g.fillRect(-22, -22, 44, 44);
    // flame tail trails below while rising (the sprite flips when falling)
    g.fillStyle = 'rgba(255,120,30,0.85)';
    g.beginPath(); g.moveTo(-10, 4); g.quadraticCurveTo(-6 + flick, 16, -2, 20 + flick); g.quadraticCurveTo(2, 12, 4, 20 - flick); g.quadraticCurveTo(8, 12, 10, 4); g.closePath(); g.fill();
    const gr = g.createRadialGradient(-4, -5, 1, 0, 0, 14);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.35, '#ffc23a'); gr.addColorStop(0.75, '#ff5a17'); gr.addColorStop(1, '#a8220a');
    g.fillStyle = gr; ell(g, 0, 0, 12.5, 12.5); g.fill();
    g.fillStyle = '#3a0c02'; ell(g, -4, -2, 1.9, 3); g.fill(); ell(g, 4, -2, 1.9, 3); g.fill();
  }

  function drawChute(g, rng) {
    rockLump(g, 0, 0, 32, 24, rng, MARS_ROCK);
    rockLump(g, -22, 10, 12, 10, rng, MARS_ROCK);
    rockLump(g, 23, 9, 11, 10, rng, MARS_ROCK);
    const hole = g.createRadialGradient(0, 6, 2, 0, 6, 18);
    hole.addColorStop(0, '#000'); hole.addColorStop(0.8, '#140502'); hole.addColorStop(1, 'rgba(20,5,2,0.6)');
    g.fillStyle = hole; ell(g, 0, 7, 17, 13); g.fill();
  }

  // A spinning coin with real thickness: a ridged edge shows as it turns, the face has a raised rim,
  // a recessed centre and a glossy highlight, like the coin character's body. No outline.
  function drawCoin(g, i, n, kind) {
    const th = i / n * TAU, cs = Math.cos(th), sn = Math.sin(th);
    const R = 9.5, Hh = 13.5, w = Math.abs(cs) * R, t = 3.4 * Math.abs(sn), side = sn >= 0 ? -1 : 1;
    const P = {
      g: { hi: '#fff7cf', face: '#f8cd52', mid: '#e3a72a', low: '#b67812', edgeHi: '#f1c25a', edge: '#c88a1c', edgeLo: '#8f5a0b', inset: '#d99a22' },
      s: { hi: '#ffffff', face: '#eef1f7', mid: '#c9cfda', low: '#8f98a9', edgeHi: '#e2e6ee', edge: '#b3bac8', edgeLo: '#7a8395', inset: '#bcc3cf' },
      b: { hi: '#ffe1c2', face: '#d98b4e', mid: '#b5652f', low: '#7c3f18', edgeHi: '#d2834a', edge: '#a2582a', edgeLo: '#6a3313', inset: '#b0612d' },
    }[kind];
    // the coin's edge (a short cylinder) on the side it is turning away from
    if (t > 0.25) {
      const x0 = Math.min(0, side * t), ew = Math.max(w, 0.8);
      const eg = g.createLinearGradient(0, -Hh, 0, Hh);
      eg.addColorStop(0, P.edgeHi); eg.addColorStop(0.5, P.edge); eg.addColorStop(1, P.edgeLo);
      g.fillStyle = eg;
      ell(g, side * t, 0, ew, Hh); g.fill();
      g.fillRect(x0, -Hh, Math.abs(side * t), Hh * 2);
      // reeding on the edge
      if (w < 3) {
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.8;
        for (let y = -Hh + 3; y < Hh - 2; y += 3) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + Math.abs(side * t), y); g.stroke(); }
      }
    }
    if (w < 0.7) return;
    // face, lit from the top-left
    let gr = g.createRadialGradient(-w * 0.4, -Hh * 0.45, 0.5, 0, 0, Hh * 1.15);
    gr.addColorStop(0, P.hi); gr.addColorStop(0.35, P.face); gr.addColorStop(0.75, P.mid); gr.addColorStop(1, P.low);
    g.fillStyle = gr; ell(g, 0, 0, w, Hh); g.fill();
    if (w > 2.5) {
      // recessed centre: in shadow at the top-left, catching light at the bottom-right
      gr = g.createLinearGradient(-w, -Hh, w, Hh);
      gr.addColorStop(0, P.low); gr.addColorStop(0.55, P.inset); gr.addColorStop(1, P.hi);
      g.fillStyle = gr; ell(g, 0, 0, w * 0.76, Hh * 0.78); g.fill();
      gr = g.createRadialGradient(-w * 0.25, -Hh * 0.3, 0.5, 0, 0, Hh * 0.8);
      gr.addColorStop(0, P.face); gr.addColorStop(1, P.mid);
      g.fillStyle = gr; ell(g, w * 0.03, Hh * 0.03, w * 0.68, Hh * 0.7); g.fill();
    }
    // glossy highlight
    g.fillStyle = 'rgba(255,255,255,0.7)';
    ell(g, -w * 0.42, -Hh * 0.52, Math.max(0.6, w * 0.2), Hh * 0.14, -0.5); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    ell(g, -w * 0.12, -Hh * 0.68, Math.max(0.4, w * 0.08), Hh * 0.05, -0.3); g.fill();
  }

  // A glossy red vinyl heart with soft shading and a highlight. No outline.
  function drawHeart(g, s) {
    g.save(); g.scale(s / 32, s / 32);
    const path = () => {
      g.beginPath();
      g.moveTo(0, 11); g.bezierCurveTo(-3, 7, -16, 0, -16, -7); g.bezierCurveTo(-16, -15, -6, -18, 0, -10);
      g.bezierCurveTo(6, -18, 16, -15, 16, -7); g.bezierCurveTo(16, 0, 3, 7, 0, 11); g.closePath();
    };
    // soft shadow underneath
    g.save(); g.shadowColor = 'rgba(60,0,10,0.45)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
    path(); g.fillStyle = '#c4142a'; g.fill(); g.restore();
    const gr = g.createRadialGradient(-6, -9, 1, -1, -2, 19);
    gr.addColorStop(0, '#ff9aa4'); gr.addColorStop(0.35, '#f5344a'); gr.addColorStop(0.75, '#d01a31'); gr.addColorStop(1, '#9c0d1e');
    path(); g.fillStyle = gr; g.fill();
    // rim light along the lower right, and a darker cleft between the lobes
    g.save(); path(); g.clip();
    const rim = g.createLinearGradient(4, -4, 14, 6);
    rim.addColorStop(0, 'rgba(255,120,140,0)'); rim.addColorStop(1, 'rgba(255,150,165,0.35)');
    g.fillStyle = rim; g.fillRect(-16, -18, 32, 30);
    g.fillStyle = 'rgba(110,0,15,0.25)'; ell(g, 0, -10, 2.2, 3.5); g.fill();
    g.restore();
    // highlights
    g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, -8, -9, 3.6, 2.3, -0.6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; ell(g, 7.5, -10.5, 1.6, 1.1, 0.4); g.fill();
    g.restore();
  }

  function drawBurger(g) {
    g.fillStyle = '#c47a2c'; rrect(g, -15, 5, 30, 7, 3.5); g.fill();
    g.fillStyle = '#5a2e14'; rrect(g, -16, -1, 32, 7, 3.5); g.fill();
    g.fillStyle = '#ffcc33'; g.beginPath(); g.moveTo(-15, -2); g.lineTo(15, -2); g.lineTo(9, 3); g.lineTo(-11, 2); g.closePath(); g.fill();
    g.fillStyle = '#4fbf3a'; g.beginPath(); g.moveTo(-16, -3);
    for (let i = 0; i <= 8; i++) g.lineTo(-16 + i * 4, -3 + (i % 2 ? 3 : 0));
    g.lineTo(16, -5); g.lineTo(-16, -5); g.closePath(); g.fill();
    const gr = g.createLinearGradient(0, -18, 0, -4);
    gr.addColorStop(0, '#f2b45e'); gr.addColorStop(1, '#b8691f');
    const dome = () => { g.beginPath(); g.moveTo(-16, -4); g.quadraticCurveTo(-16, -19, 0, -19); g.quadraticCurveTo(16, -19, 16, -4); g.closePath(); };
    g.fillStyle = gr; dome(); g.fill();
    g.fillStyle = '#fff4d6';
    for (const [sx, sy] of [[-8, -12], [-2, -15], [5, -12], [10, -9], [-11, -8], [1, -9]]) { ell(g, sx, sy, 1.4, 0.8, 0.4); g.fill(); }
    g.strokeStyle = 'rgba(40,20,5,0.55)'; g.lineWidth = 1; dome(); g.stroke();
  }

  function drawOrb(g, r) {
    let gr = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.1);
    gr.addColorStop(0, 'rgba(70,160,255,0.45)'); gr.addColorStop(1, 'rgba(70,160,255,0)');
    g.fillStyle = gr; g.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
    gr = g.createRadialGradient(-r * 0.1, -r * 0.1, 1, 0, 0, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#bfe8ff'); gr.addColorStop(0.6, '#2c86e6'); gr.addColorStop(1, '#0a2a72');
    g.fillStyle = gr; ell(g, 0, 0, r, r); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(200,235,255,0.75)'; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4, l = k % 2 ? r * 0.7 : r * 1.05;
      g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * l, Math.sin(a) * l);
    }
    g.stroke();
    g.globalCompositeOperation = 'source-over';
  }

  function drawMover(g, w) {
    const h = 18;
    g.fillStyle = 'rgba(0,0,0,0.3)'; rrect(g, 2, 4, w, h, 9); g.fill();
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fbfcff'); gr.addColorStop(0.45, '#b3b9c6'); gr.addColorStop(1, '#5b6170');
    g.fillStyle = gr; rrect(g, 0, 0, w, h, 9); g.fill();
    g.strokeStyle = 'rgba(20,24,34,0.75)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(40,46,60,0.35)'; rrect(g, 18, 6, w - 36, 6, 3); g.fill();
    for (const wx of [9, w - 9]) {
      g.fillStyle = '#3a3f4c'; ell(g, wx, 9, 6.5, 6.5); g.fill();
      g.strokeStyle = '#d6dbe6'; g.lineWidth = 1.4;
      g.beginPath();
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + wx; g.moveTo(wx, 9); g.lineTo(wx + Math.cos(a) * 5, 9 + Math.sin(a) * 5); }
      g.stroke();
    }
  }

  /* ---------- public API ---------- */
  CP.art = {
    mulberry, hexA,

    // Baked rig characters: frame index of a clip, and the feet origin for setOrigin().
    spriteFrame: (key, clip, i) => CP.SPRITES[key].clips[clip].start + (i || 0),
    spriteOrigin: key => [CP.SPRITES[key].originX, CP.SPRITES[key].originY],
    // Load the baked sheets; called from the Boot scene's preload.
    loadSprites(scene) {
      ['titan', 'mars'].forEach(k => scene.load.image('art-' + k, `img/bg-${k}.jpg`));
      scene.load.image('art-menu', 'img/bg-menu.jpg');
      Object.entries(CP.SPRITES).forEach(([key, sp]) => scene.load.spritesheet(key, sp.png, { frameWidth: sp.frameWidth, frameHeight: sp.frameHeight }));
    },
    color: hex => parseInt(hex.slice(1), 16),

    // Textures and animations shared by every planet. Called once from the Boot scene.
    makeShared(scene) {
      ['g', 's', 'b'].forEach(k => sheet(scene, 'coin-' + k, 24, 32, 16, (g, i) => { g.translate(12, 16); drawCoin(g, i, 16, k); }));

      sheet(scene, 'flyer', 72, 72, 6, (g, i) => { g.translate(36, 30); drawFlyer(g, Math.sin(i / 6 * TAU) * 3); });

      // Mars: boulders, falling rocks, lava blobs (golems use the baked Rock rig)
      canvasTex(scene, 'boulder', 40, 40, g => {
        const rng = mulberry(7); rockLump(g, 20, 20, 16.5, 16.5, rng, MARS_ROCK);
        g.strokeStyle = 'rgba(30,8,2,0.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(12, 14); g.lineTo(19, 19); g.lineTo(17, 27); g.moveTo(24, 10); g.lineTo(28, 16); g.stroke();
      });
      canvasTex(scene, 'faller', 36, 36, g => rockLump(g, 18, 15, 15, 12, mulberry(11), MARS_ROCK, true));
      sheet(scene, 'lava', 44, 48, 3, (g, i) => { g.translate(22, 22); drawLavaBlob(g, i); });
      canvasTex(scene, 'chute', 76, 60, g => { g.translate(38, 30); drawChute(g, mulberry(5)); });

      canvasTex(scene, 'orb', 96, 96, g => { g.translate(48, 48); drawOrb(g, 20); });
      canvasTex(scene, 'heart', 36, 32, g => { g.translate(18, 18); drawHeart(g, 30); });
      canvasTex(scene, 'burger', 36, 34, g => { g.translate(18, 21); drawBurger(g); });
      canvasTex(scene, 'icicle', 16, 36, g => spikeShape(g, 8, 1, 14, 34, false));
      canvasTex(scene, 'spike', 16, 28, g => spikeShape(g, 8, 27, 14, 26, true));
      canvasTex(scene, 'spike-s', 16, 20, g => spikeShape(g, 8, 19, 14, 18, true));
      canvasTex(scene, 'spark', 5, 5, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 5, 5); });
      canvasTex(scene, 'puff', 16, 16, g => {
        const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
      });
      // a soap-bubble ring the hero materialises from: clear middle, blue rim, a glint top-left
      canvasTex(scene, 'bubble', 28, 28, g => {
        const gr = g.createRadialGradient(14, 14, 4, 14, 14, 13);
        gr.addColorStop(0, 'rgba(120,200,255,0.12)'); gr.addColorStop(0.75, 'rgba(110,190,255,0.35)'); gr.addColorStop(1, 'rgba(70,160,255,0.9)');
        g.fillStyle = gr; g.beginPath(); g.arc(14, 14, 12.5, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(190,235,255,0.95)'; g.lineWidth = 1.5; g.beginPath(); g.arc(14, 14, 12, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.9)'; ell(g, 9.5, 9, 3.2, 2, -0.7); g.fill();
      });
      // invisible physics box for the player (the visible hero sprite follows it)
      canvasTex(scene, 'hit', 20, 34, () => {});
    },

    makeAnims(scene) {
      const A = scene.anims;
      const frames = (key, list) => list.map(f => (typeof f === 'number' ? { key, frame: f } : { key, frame: f[0], duration: f[1] }));
      const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
      ['g', 's', 'b'].forEach(k => A.create({ key: `coin-${k}-spin`, frames: frames('coin-' + k, range(0, 15)), frameRate: 14, repeat: -1 }));
      A.create({ key: 'flyer-drift', frames: frames('flyer', [0, 1, 2, 3, 4, 5]), frameRate: 8, repeat: -1 });
      A.create({ key: 'lava-flicker', frames: frames('lava', [0, 1, 2]), frameRate: 12, repeat: -1 });
      // baked rig characters from the sprite engine (js/sprites.js): one animation per clip, e.g. 'coin-run'
      Object.entries(CP.SPRITES).forEach(([key, sp]) => Object.entries(sp.clips).forEach(([name, c]) => {
        A.create({ key: `${key}-${name}`, frames: frames(key, range(c.start, c.start + c.count - 1)), frameRate: c.fps, repeat: c.loop ? -1 : 0 });
      }));
    },

    // Background and rock slab textures for a level, cached by theme and slab width.
    ensureLevel(scene, D) {
      const seed = hashStr(JSON.stringify(D.theme)), bg = 'bg-' + seed;
      const art = D.theme.art && scene.textures.exists('art-' + D.theme.art) ? scene.textures.get('art-' + D.theme.art).getSourceImage() : null;
      if (!scene.textures.exists(bg)) scene.textures.addCanvas(bg, makeBG(D.theme, seed, art));
      return { bg, rocks: D.plat.map(([, , w], j) => CP.art.rockKey(scene, w, j % 5, D.theme)) };
    },
    rockKey(scene, w, variant, theme) {
      w = Math.max(20, Math.round(w));
      const pal = theme && theme.rock, smooth = !!(theme && theme.smooth);
      const key = `rock-${w}-${variant}` + (pal ? '-' + hashStr(pal.join()) : '') + (smooth ? '-smooth' : '');
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, makeRock(w, mulberry(w * 131 + variant * 977 + 3), pal, smooth));
      return key;
    },
    moverKey(scene, w) {
      w = Math.max(20, Math.round(w));
      canvasTex(scene, 'mover-' + w, w + 4, 26, g => drawMover(g, w));
      return 'mover-' + w;
    },

  };
})();
