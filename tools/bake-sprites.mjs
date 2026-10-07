// Bakes the rigged characters from the sprite engine (~/sprite-engine) into flipbook sprite
// sheets and writes them, inlined as data URLs, to js/sprites.js.
//
//   node tools/bake-sprites.mjs            # uses ~/sprite-engine
//   SPRITE_ENGINE=/path/to/sprite-engine node tools/bake-sprites.mjs
//
// Needs Playwright with Chromium (npm i -g playwright && npx playwright install chromium).
// The sheets are inlined so the game still works when index.html is opened straight from disk.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ENGINE = process.env.SPRITE_ENGINE || join(homedir(), 'sprite-engine');
const OUT = fileURLToPath(new URL('../js/sprites.js', import.meta.url));

// What to bake. Each clip becomes a frame range in one sheet per character, so every frame
// shares one size and one origin (the feet). `air: true` keeps only the airborne part of a jump
// (between its takeoff and land events) and pins the root, because the game moves the body.
const SPEC = [
  {
    key: 'coin', project: 'projects/coin.json', scale: 0.07,
    clips: [
      { name: 'idle', clip: 'idle', fps: 12 },
      { name: 'walk', clip: 'walk', fps: 16 },
      { name: 'run', clip: 'run', fps: 20 },
      { name: 'air', clip: 'jump', air: true, frames: 10 },
      { name: 'air_side', clip: 'jump_side', air: true, frames: 10 },
      { name: 'celebrate', clip: 'celebrate', fps: 16 },
      { name: 'surprised', clip: 'surprised', fps: 12 },
    ],
  },
  {
    key: 'alien', project: 'projects/alien.json', scale: 0.11,
    clips: [
      { name: 'idle', clip: 'idle', fps: 12 },
      { name: 'walk', clip: 'walk', fps: 16 },
    ],
  },
  {
    key: 'rock', project: 'projects/rock.json', scale: 0.16,
    clips: [
      { name: 'idle', clip: 'idle', fps: 12 },
      { name: 'walk', clip: 'walk', fps: 16 },
    ],
  },
];

const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.html': 'text/html' };

function serve(root) {
  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/__bake.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>bake</title>'); }
      const file = normalize(join(root, path));
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); return res.end(); }
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch { res.writeHead(404); res.end(); }
    });
    server.listen(0, () => resolve(server));
  });
}

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const global = execSync('npm root -g').toString().trim();
  return createRequire(join(global, 'noop.js'))('playwright');
}

// Runs inside the browser page.
async function bake(spec) {
  const E = await import('/src/engine/index.js');
  const out = {};
  for (const ch of spec) {
    const project = await E.Project.fromUrl(ch.project);
    const evals = [], clips = {};
    for (const c of ch.clips) {
      const clip = project.getClip(c.clip);
      if (!clip) throw new Error(`${ch.project} has no clip "${c.clip}"`);
      let t0 = 0, t1 = clip.duration, n;
      if (c.air) {
        t0 = clip.events.find(e => e.name === 'takeoff').t;
        t1 = clip.events.find(e => e.name === 'land').t;
        n = c.frames;
      } else {
        n = Math.max(1, Math.round(clip.duration * c.fps) + (clip.loop ? 0 : 1));
      }
      const loop = !c.air && clip.loop;
      clips[c.name] = { start: evals.length, count: n, fps: c.fps || 12, loop };
      for (let i = 0; i < n; i++) {
        const t = loop ? t0 + (t1 - t0) * i / n : t0 + (t1 - t0) * (n === 1 ? 0 : i / (n - 1));
        const pose = E.samplePose(project, clip, t);
        if (c.air && pose.root) pose.root.y = 0;
        evals.push(E.evaluate(project, pose));
      }
    }
    let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const ev of evals) {
      const f = E.poseBounds(project, ev);
      b = { minX: Math.min(b.minX, f.minX), minY: Math.min(b.minY, f.minY), maxX: Math.max(b.maxX, f.maxX), maxY: Math.max(b.maxY, f.maxY) };
    }
    const s = ch.scale, pad = 2;
    // keep the feet (rig origin) centred horizontally so flipping a sprite doesn't shift it
    const half = Math.max(-b.minX, b.maxX);
    const fw = Math.ceil(half * 2 * s) + pad * 2, fh = Math.ceil((b.maxY - b.minY) * s) + pad * 2;
    const ox = fw / 2, oy = pad - b.minY * s;
    const cols = Math.ceil(Math.sqrt(evals.length)), rows = Math.ceil(evals.length / cols);
    // draw at 4x, then shrink in two halving steps for clean downsampling
    const big = document.createElement('canvas');
    big.width = fw * 4; big.height = fh * 4;
    const bg = big.getContext('2d');
    const mid = document.createElement('canvas');
    mid.width = fw * 2; mid.height = fh * 2;
    const mg = mid.getContext('2d');
    const sheet = document.createElement('canvas');
    sheet.width = fw * cols; sheet.height = fh * rows;
    const g = sheet.getContext('2d');
    for (const ctx of [bg, mg, g]) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    evals.forEach((ev, i) => {
      bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, big.width, big.height);
      E.drawRig(bg, project, ev, [s * 4, 0, 0, s * 4, ox * 4, oy * 4]);
      mg.clearRect(0, 0, mid.width, mid.height);
      mg.drawImage(big, 0, 0, mid.width, mid.height);
      g.drawImage(mid, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
    });
    out[ch.key] = { frameWidth: fw, frameHeight: fh, originX: +(ox / fw).toFixed(4), originY: +(oy / fh).toFixed(4), frames: evals.length, clips, png: sheet.toDataURL('image/png') };
  }
  return out;
}

const server = await serve(ENGINE);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/__bake.html`);
  const result = await page.evaluate(bake, SPEC);
  const lines = Object.entries(result).map(([key, v]) => {
    const { png, ...meta } = v;
    return `CP.SPRITES[${JSON.stringify(key)}] = Object.assign(${JSON.stringify(meta)},\n  { png: ${JSON.stringify(png)} });`;
  });
  await writeFile(OUT, `// Generated by tools/bake-sprites.mjs from ${ENGINE.replace(homedir(), '~')}. Do not edit by hand.
// Each character is one sprite sheet; clips are frame ranges. originX/originY is the feet.
var CP = window.CP = window.CP || {};
CP.SPRITES = CP.SPRITES || {};
${lines.join('\n')}
`);
  for (const [k, v] of Object.entries(result)) {
    console.log(`${k}: ${v.frames} frames of ${v.frameWidth}x${v.frameHeight}, ${Math.round(v.png.length / 1024)} KB, clips ${Object.keys(v.clips).join(', ')}`);
  }
} finally {
  await browser.close();
  server.close();
}
