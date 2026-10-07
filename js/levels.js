// Level data. Each planet is one 1024x768 screen.
var CP = window.CP = window.CP || {};

// LEVELS-BEGIN
// plat: [x, top, width]  (one-way rock slabs, stand on top)
// movers: metal lifts, position = base + (ax, ay) * sin(2πt/period + phase)
// walkers: [platformIndex, speed, offsetX?]   flyers: [x, y, ax, ay, period]   orbs: [x, y, vx, vy]
// Mars only: golems: [platformIndex, speed, offsetX?]   boulders (chutes): [x, y, dir, seconds]
//            fallers: [x, y]   lava: [x, peakY, seconds]
// icicles hang under a platform, spikes stand on top: [platformIndex, offsetX]
// Every planet is built around one idea, noted above it. The screen wraps left/right, and falling
// off the bottom drops you back in from the top, so several planets are laid out across those seams.
// World 1: Venus (internal id 'titan', kept so saved progress carries over), home of the grey aliens.
const LEVELS = [
  // The valley: a V of steps climbs out of a small floor on both sides and meets across the left/right seam,
  // with a summit pad above the middle. Either side of the floor is open: fall off and you drop back in from the top.
  {
    name: 'Vale',
    theme: { sky: '#07050a', glow: '#f5a524', glow2: '#ffe27a',
      planet: { x: 512, y: 330, r: 40, kind: 'banded', c: ['#c98f4e', '#f2d6a2', '#9a5f2c', '#e6bf80'] } },
    start: [512, 700],
    plat: [[362,700,300],[210,590,150],[664,590,150],[70,480,150],[804,480,150],[0,370,110],[914,370,110],
      [220,260,150],[654,260,150],[442,150,140]],
    movers: [],
    coins: c => {
      c.on(0,'b',3); c.on(1,'b',2,2); c.on(2,'b',2,2); c.on(3,'g',2,2); c.on(4,'g',2,2);
      c.on(5,'g',2,3); c.on(6,'g',2,3); c.on(7,'s',2,3); c.on(8,'s',2,3); c.on(9,'g',1,4);
      // drop off either edge of the summit and fall through a coin column onto the floor
      c.col('g',414,250,6,60); c.col('g',610,250,6,60);
    },
    walkers: [[0,40,270]],
    flyers: [], orbs: [],
    icicles: [],
    spikes: [],
    items: [['burger',1004,330]],
  },
  // Freefall well: almost no ground. Drop off the bottom, re-enter at the top, and steer through the coin rain.
  // Hard part: a ghost circles the gold tower on the centre pad, and spikes split the right landing pad.
  {
    name: 'Rubra',
    theme: { sky: '#0a0405', glow: '#e0412a', glow2: '#ffb07a',
      planet: { x: 880, y: 150, r: 46, kind: 'cratered', c: ['#b5603f', '#d98a63', '#7e3a24', '#e9a585'] } },
    start: [150, 160],
    plat: [[60,160,180],[800,160,180],[60,600,160],[810,600,160],[462,420,100]],
    movers: [],
    coins: c => {
      for (let j = 0; j < 9; j++) {
        c.row('g', 310 + 36 * Math.sin(j * 0.8), 110 + j * 70, 1);
        c.row('s', 714 - 36 * Math.sin(j * 0.8), 110 + j * 70, 1);
      }
      c.col('s',405,110,9,70); c.col('g',619,110,9,70);
      c.on(0,'b',3); c.on(1,'b',3,2); c.on(2,'g',2,2); c.on(3,'g',2,2); c.on(4,'g',1,4);
    },
    walkers: [[2,35]],
    flyers: [[512,260,260,30,6],[512,560,260,30,8],[512,370,110,30,5]], orbs: [],
    icicles: [[0,90],[1,90]],
    spikes: [[3,80]],
    items: [['heart',890,520]],
  },
  // Lift city: two small pads and a sky full of moving lifts. Ride them to sweep their coin trails.
  // Hard part: a second ghost sweeps the high gold row, so grab it between passes.
  {
    name: 'Verdis',
    theme: { sky: '#030a06', glow: '#2fc463', glow2: '#d4ff9a',
      planet: { x: 110, y: 340, r: 36, kind: 'banded', c: ['#5f9e57', '#a6d48a', '#3c6b3a', '#d6efb0'] } },
    start: [100, 700],
    plat: [[30,700,150],[420,110,180]],
    movers: [
      { x: 260, y: 690, w: 110, ax: 110, ay: 0, period: 4.5, phase: 0 },
      { x: 520, y: 530, w: 100, ax: 0, ay: 150, period: 5, phase: 0 },
      { x: 740, y: 600, w: 110, ax: 130, ay: 0, period: 5, phase: 1.5 },
      { x: 820, y: 360, w: 100, ax: 0, ay: 150, period: 6, phase: 0.5 },
      { x: 560, y: 250, w: 110, ax: 200, ay: 0, period: 7, phase: 0 },
      { x: 200, y: 330, w: 100, ax: 90, ay: 90, period: 5, phase: 2 },
    ],
    coins: c => {
      c.row('b',190,658,7,50); c.col('g',570,360,8,42); c.row('s',640,568,7,50); c.col('g',870,190,8,40);
      c.row('g',400,218,9,50);
      for (let s = -1; s <= 1; s += 0.5) c.row('s', 250 + 90 * s, 298 + 90 * s, 1);
      c.on(0,'g',2,2); c.on(1,'g',4,2);
    },
    walkers: [],
    flyers: [[512,450,150,20,6],[600,170,260,20,9]], orbs: [[700,420,70,60]],
    icicles: [[1,90]],
    spikes: [],
    items: [['burger',100,560]],
  },
  // Spiral stair: one staircase that coils around the planet, leaving the right edge and coming back on the left.
  // Hard part: aliens on three steps and a ghost that sweeps the whole width of the stair.
  {
    name: 'Violetta',
    theme: { sky: '#07040d', glow: '#8f52ec', glow2: '#f4b9ff',
      planet: { x: 640, y: 420, r: 38, kind: 'ringed', c: ['#c7a6f0', '#8f6cc4', '#f1e3ff', '#6a4c99'] } },
    start: [100, 710],
    plat: [[40,710,150],[296,615,150],[552,520,150],[808,425,150],[40,330,150],[296,235,150],[552,140,150]],
    movers: [],
    coins: c => {
      for (let k = 0; k < 7; k++) {
        const [x, y] = c.plat(k);
        c.on(k, k % 2 ? 's' : 'g', 2, 3);
        if (k < 6) { const [nx, ny] = c.plat(k + 1); c.arc('b', x + 150, y - 32, nx + (nx < x ? 1024 : 0), ny - 32, 2, 50); }
      }
    },
    walkers: [[2,35],[5,35],[6,40]],
    flyers: [[512,300,420,40,10]], orbs: [[512,400,110,80]],
    icicles: [[3,75],[6,75]],
    spikes: [[1,75],[4,75]],
    items: [['heart',880,330]],
  },
  // Layer cake: five floors, each with one hole. Jump up through the floors, fall down through the holes;
  // the hole in the bottom floor drops you off the screen and back onto the top floor. Mind the icicles.
  // Hardest Venus planet: three aliens, two orbs and spikes on three floors.
  {
    name: 'Nova Prime',
    theme: { sky: '#0b040a', glow: '#ff4a86', glow2: '#ffd27a',
      planet: { x: 880, y: 400, r: 48, kind: 'cratered', c: ['#e7d3c4', '#f8eadf', '#b39684', '#fff6ee'] } },
    start: [200, 700],
    // each floor is two slabs around a 150px hole; the holes zigzag so every fall lands on solid rock
    plat: [[0,700,437],[587,700,437],[0,570,120],[270,570,754],[0,440,760],[910,440,114],
           [0,310,300],[450,310,574],[0,180,640],[790,180,234]],
    movers: [],
    coins: c => {
      c.on(0,'b',2); c.on(1,'b',3); c.stack('g',60,570,2); c.on(3,'g',4,2); c.on(4,'s',4,2); c.on(5,'s',1,2);
      c.on(6,'g',2,2); c.on(7,'g',3,2); c.on(8,'g',3,3); c.on(9,'g',1,3);
      // a pair of coins hangs in every hole, collected on the way down
      [[512,700],[195,570],[835,440],[375,310],[715,180]].forEach(([x, y]) => c.col('g', x, y - 20, 2, 40));
    },
    walkers: [[3,60],[4,70],[7,80]],
    flyers: [], orbs: [[300,380,120,90],[760,250,-100,110]],
    icicles: [[3,150],[3,490],[4,380],[6,120],[7,460],[8,400],[9,120]],
    spikes: [[0,320],[1,100],[4,120]],
    items: [['heart',390,120],['burger',640,640]],
  },
];

// World 2: Mars. Rock golems and lava blobs.
const MARS_ROCK = ['#b8714a', '#7d3d22', '#38150a'];
const MARS = [
  // Islands: small rocks in open space; coin arcs trace each jump, lava leaps through the gaps.
  {
    name: 'Red Dunes',
    theme: { sky: '#0d0504', glow: '#e8622c', glow2: '#ffb27a', rock: MARS_ROCK,
      planet: { x: 870, y: 130, r: 22, kind: 'cratered', c: ['#8a7a6e', '#a8968a', '#5a4b42', '#c2b2a6'] } },
    start: [130, 690],
    plat: [[60,690,160],[360,640,120],[620,690,140],[880,560,120],[600,450,120],[300,410,120],[40,320,140],[300,200,120],[600,220,140]],
    coins: c => {
      c.on(0,'g',2,2); c.on(1,'s',1,3); c.on(2,'g',2,2); c.on(3,'s',1,3); c.on(4,'g',1,3); c.on(5,'s',1,3);
      c.on(6,'g',2,2); c.on(7,'s',1,3); c.on(8,'g',2,3);
      c.arc('b',220,658,360,608,3,80); c.arc('b',480,608,620,658,3,80); c.arc('g',760,658,880,528,3,80);
      c.arc('g',880,528,720,418,3,80); c.arc('g',600,418,420,378,3,80); c.arc('g',300,378,180,288,3,80);
      c.arc('g',180,288,300,168,3,80); c.arc('g',420,168,600,188,3,80); c.arc('s',1000,528,1084,658,2,60);
    },
    golems: [[2,30]],
    lava: [[290,470,3],[800,500,3.5],[510,330,4]],
    items: [['burger',100,200]],
  },
  // The mountain: a stepped peak with golems pacing three terraces; coin rain falls past the cliffs.
  {
    name: 'Olympus Mons',
    theme: { sky: '#0c0405', glow: '#d9472b', glow2: '#ffd08a', rock: MARS_ROCK,
      planet: { x: 150, y: 120, r: 26, kind: 'banded', c: ['#2f6fb5', '#5fa0e0', '#2d7a4a', '#d8ecff'] } },
    start: [200, 700],
    plat: [[112,700,800],[212,570,600],[312,440,400],[412,310,200],[462,180,100]],
    coins: c => {
      c.stack('g',160,700,4); c.stack('g',864,700,4); c.stack('g',262,570,4); c.stack('g',762,570,4);
      c.stack('g',362,440,4); c.stack('g',662,440,4); c.stack('g',437,310,3); c.stack('g',587,310,3); c.stack('g',512,180,4);
      c.row('b',300,668,5,106); c.row('s',380,538,4,88); c.row('s',470,408,2,84);
      c.col('s',50,200,5,90); c.col('s',974,200,5,90);
    },
    golems: [[0,35],[1,30],[2,30]],
    lava: [[56,250,3.5],[968,250,4]],
    items: [['heart',50,120]],
  },
  // Switchbacks: four long corridors zigzag up the canyon; lava leaps at the turn and golems guard two corridors.
  // Hard part: spikes between the silver stacks in the second corridor, and a ghost circling the gold on the third.
  {
    name: 'Valles Marineris',
    theme: { sky: '#0a0403', glow: '#c2502e', glow2: '#ff9a6b', rock: MARS_ROCK,
      planet: { x: 150, y: 110, r: 18, kind: 'cratered', c: ['#7e6a5c', '#9c887a', '#4e3e34', '#b8a496'] } },
    start: [100, 700],
    plat: [[0,700,760],[264,560,760],[0,420,760],[264,280,760],[0,140,420]],
    coins: c => {
      c.stack('g',60,700,4); c.stack('g',190,700,4); [380,530,680].forEach(x => c.stack('b',x,700,2));
      c.stack('g',850,560,4); c.stack('g',950,560,4); [360,510,660].forEach(x => c.stack('s',x,560,2));
      c.stack('g',60,420,4); c.stack('g',190,420,4); [360,510,660].forEach(x => c.stack('s',x,420,2));
      c.stack('g',850,280,4); c.stack('g',950,280,4); c.stack('s',340,280,2);
      c.stack('g',60,140,3); c.stack('g',200,140,3);
    },
    golems: [[2,35],[3,35]],
    flyers: [[130,350,70,25,5]],
    spikes: [[1,172],[1,322]],
    lava: [[890,600,3.5]],
    items: [['heart',900,470]],
  },
  // Geysers: four shafts drop straight through the planet. Coins hang in them; lava erupts on a timer.
  {
    name: 'Dust Storm',
    theme: { sky: '#120a05', glow: '#d88a3a', glow2: '#ffe0a0', rock: MARS_ROCK, dust: true,
      planet: { x: 760, y: 220, r: 30, kind: 'cratered', c: ['#8a7a6e', '#a8968a', '#5a4b42', '#c2b2a6'] } },
    start: [110, 700],
    plat: [[30,700,170],[290,700,170],[550,700,170],[810,700,180],[55,570,120],[315,570,120],[575,570,120],[840,570,120]],
    coins: c => {
      c.col('g',245,300,8,50); c.col('s',505,300,8,50); c.col('g',765,300,8,50); c.col('s',1010,300,8,50);
      [4,5,6,7].forEach(i => c.on(i, i % 2 ? 's' : 'g', 1, 4));
      [0,1,2,3].forEach(i => c.on(i, 'b', 2));
    },
    golems: [[1,35],[2,35],[3,35]],
    lava: [[245,250,2.6],[505,250,3.1],[765,250,2.8],[1010,250,3.4]],
    items: [['heart',505,240]],
  },
  // The frame: a ring of rock around an empty middle. A lift rises through a hoop of coins; the seam is the stair.
  // Hard part: a ghost loops inside the hoop, crossing the lift's path.
  {
    name: 'Polar Cap',
    theme: { sky: '#0b0607', glow: '#e07a5a', glow2: '#ffe8e0', rock: ['#c58a72', '#86503c', '#3b1d14'],
      planet: { x: 300, y: 100, r: 24, kind: 'banded', c: ['#2f6fb5', '#5fa0e0', '#2d7a4a', '#d8ecff'] } },
    start: [250, 700],
    plat: [[160,700,704],[160,190,704],[904,580,120],[0,450,120],[904,320,120]],
    movers: [{ x: 462, y: 445, w: 100, ax: 0, ay: 180, period: 6, phase: 0 }],
    coins: c => {
      c.col('g',512,245,9,42); c.ring('s',512,445,190,150,12,Math.PI / 12);
      c.on(1,'g',4,3); c.on(0,'b',6); c.on(2,'g',2,2); c.on(3,'g',2,2); c.on(4,'g',2,2);
      c.col('s',60,130,5,60);
    },
    golems: [[0,40],[1,35]],
    flyers: [[512,445,150,120,8]],
    items: [['heart',60,640]],
  },
];
// LEVELS-END

// painted backdrops (img/bg-*.jpg): Titan's ringed sky for the alien stages, the red rock plain for Mars
LEVELS.forEach(L => { L.world = 'titan'; L.theme.art = 'titan'; });
MARS.forEach(L => { L.world = 'mars'; L.theme.art = 'mars'; });
CP.LEVELS = LEVELS;
CP.WORLDS = [
  { id: 'titan', name: 'Venus', tagline: 'Home of the grey aliens', levels: LEVELS },
  { id: 'mars', name: 'Mars', tagline: 'Rock golems and lava', levels: MARS },
];
CP.world = id => CP.WORLDS.find(w => w.id === id) || CP.WORLDS[0];
CP.ALL_LEVELS = [...LEVELS, ...MARS];

// Coin kinds and their points. Anything unknown counts as gold.
CP.COIN_POINTS = { g: 10, s: 5, b: 2 };
CP.coinKind = k => (k in CP.COIN_POINTS ? k : 'g');

// Expands a level's coins into a flat list of {x, y, k} where k is 'g' (gold), 's' (silver) or 'b' (bronze).
// Coins are either a recipe function (built-in planets) or a list of [x, y, k] (editor planets).
CP.buildCoins = function (D) {
  if (Array.isArray(D.coins)) return D.coins.map(([x, y, k]) => ({ x, y, k: CP.coinKind(k) }));
  const out = [];
  const add = (x, y, k) => out.push({ x: ((x % 1024) + 1024) % 1024, y, k });
  const api = {
    plat: i => D.plat[i],
    // n coins spread along platform i, each one a column h coins tall
    on(i, k, n, h) {
      const [x, y, w] = D.plat[i], pad = 20;
      for (let j = 0; j < n; j++) api.stack(k, x + pad + (w - 2 * pad) * (n === 1 ? 0.5 : j / (n - 1)), y, h);
    },
    // a column of h coins standing on a surface whose top is at y
    stack(k, x, y, h) { for (let j = 0; j < (h || 1); j++) add(x, y - 32 - j * 38, k); },
    row(k, x, y, n, dx) { for (let j = 0; j < n; j++) add(x + j * (dx || 40), y, k); },
    col(k, x, y, n, dy) { for (let j = 0; j < n; j++) add(x, y + j * (dy || 40), k); },
    // n coins along a jump arc from (x0, y0) to (x1, y1), peaking `lift` px above the straight line;
    // x past either screen edge wraps, so arcs can cross the seam
    arc(k, x0, y0, x1, y1, n, lift) {
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1);
        add(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - lift * 4 * t * (1 - t), k);
      }
    },
    ring(k, cx, cy, rx, ry, n, a0) {
      for (let j = 0; j < n; j++) { const a = (a0 || 0) + j * Math.PI * 2 / n; add(cx + rx * Math.cos(a), cy + ry * Math.sin(a), k); }
    },
  };
  D.coins(api);
  return out;
};
