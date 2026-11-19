// Pixel layers baked once at 1 px per game pixel: the dithered sky and the instrument city (plus where its lights
// are). Everything is drawn in code from a seeded generator, so it's the same every time.
import { HEIGHT, TOP, WIDTH } from '../config';

export const TAU = Math.PI * 2;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable pseudo-random 0..1 for an integer. */
export function hash(n: number) {
  let t = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  t ^= t >>> 13;
  t = Math.imul(t, 0xc2b2ae35);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

export const hsl = (h: number, s = 95, l = 62, a = 1) => `hsla(${mod(h, 360)},${s}%,${l}%,${a})`;

/**
 * A movement's look: palette and which layers it has. The landscape stays dim and cool enough that anything that
 * can hurt you, which is bright, outlined and on top, always reads.
 */
export interface Theme {
  sky: string[];
  spec: string[];
  peak: string;
  city: string;
  cityRim: string;
  cityDetail: string;
  string: string;
  mass: string;
  eqRim: string;
  eqDim: string[];
  /** The speaker moon's halo and rings, outside in (null: no moon). */
  moon: { halo: string; rings: string[]; core: string; rim: string } | null;
  /** Two haze gradients over the far layers, as [top, middle, bottom] and [top, bottom] rgba colours. */
  haze: [string, string, string];
  haze2: [string, string];
  /** The skyline: the instrument city, or the cave's rock and crystals. */
  skyline: 'city' | 'cave';
  spectrum: boolean;
  /** Vibrating strings across the sky: none, or how many. */
  strings: number;
  stave: boolean;
  /** Dim colour for the stave and unlit notes, as an "r,g,b" triple. */
  staveRgb: string;
  /** Baked stars: [bright, dim]. */
  stars: [string, string];
}

export const THEMES: Theme[] = [
  // I Pulse: violet dusk over the instrument city.
  {
    sky: ['#0a0420', '#110630', '#1a0a3e', '#25104c', '#341559', '#4a1a66', '#62206e', '#7e2a74'],
    spec: ['#1d2559', '#243069', '#2c3d7c', '#354d90', '#3f60a4', '#4b74b8'],
    peak: '#8fdcff',
    city: '#150a2b',
    cityRim: '#2c1a58',
    cityDetail: '#1f1140',
    string: '#3a2670',
    mass: '#0a0518',
    eqRim: '#e6dcff',
    eqDim: ['#4a2478', '#3a1d64', '#2d1752', '#231243', '#1b0f37'],
    moon: {
      halo: '#3a1660',
      rings: ['#24123f', '#3a1f66', '#2a1549', '#46287c', '#331a58', '#5b3a96', '#2a1549', '#8f6ad0'],
      core: '#d9c4ff',
      rim: '#9a7ae0',
    },
    haze: ['rgba(42,15,79,0)', 'rgba(52,18,90,0.75)', 'rgba(30,10,55,0.9)'],
    haze2: ['rgba(60,20,100,0)', 'rgba(60,20,100,0.55)'],
    skyline: 'city',
    spectrum: true,
    strings: 0,
    stave: true,
    staveRgb: '205,180,255',
    stars: ['#b9a8ff', '#5a4a9a'],
  },
  // II Strings: a teal cave, strung with strings that ring on the beat.
  {
    sky: ['#02080d', '#030c13', '#05121a', '#071922', '#0a212b', '#0d2a34', '#11343e', '#163e47'],
    spec: [],
    peak: '#9ffff0',
    city: '#05111a',
    cityRim: '#14394a',
    cityDetail: '#0a2230',
    string: '#2a7f88',
    mass: '#03090e',
    eqRim: '#d6fff4',
    eqDim: ['#145a5e', '#0f4a50', '#0b3a42', '#082c34', '#061f28'],
    moon: null,
    haze: ['rgba(8,40,50,0)', 'rgba(8,40,50,0.6)', 'rgba(4,22,30,0.85)'],
    haze2: ['rgba(10,60,70,0)', 'rgba(10,60,70,0.45)'],
    skyline: 'cave',
    spectrum: false,
    strings: 7,
    stave: false,
    staveRgb: '170,240,235',
    stars: ['#9ffff0', '#1d4a55'],
  },
  // III Crescendo: a red-gold dusk with everything at once.
  {
    sky: ['#12020a', '#1e0414', '#2e071f', '#410b28', '#571030', '#701735', '#8a2036', '#a52e34'],
    spec: ['#45102e', '#581436', '#6c193d', '#822044', '#992948', '#b0344c'],
    peak: '#ffd2a8',
    city: '#170511',
    cityRim: '#4a1636',
    cityDetail: '#2a0b20',
    string: '#7a2a58',
    mass: '#0e020a',
    eqRim: '#fff0dc',
    eqDim: ['#6a1838', '#561430', '#421028', '#300c20', '#220818'],
    moon: {
      halo: '#5a1430',
      rings: ['#3a0c22', '#5e1634', '#45102a', '#7a2040', '#561630', '#a03448', '#45102a', '#e0785a'],
      core: '#ffe0c0',
      rim: '#f09070',
    },
    haze: ['rgba(80,15,40,0)', 'rgba(90,18,45,0.7)', 'rgba(50,8,28,0.9)'],
    haze2: ['rgba(110,25,50,0)', 'rgba(110,25,50,0.5)'],
    skyline: 'city',
    spectrum: true,
    strings: 4,
    stave: true,
    staveRgb: '255,190,200',
    stars: ['#ffc8b0', '#6a2a40'],
  },
];

/** Movement I's palette (the frame's colours and the mockup's names). */
export const PAL = THEMES[0];

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

interface Painter {
  set(x: number, y: number, hex: string): void;
  rect(x: number, y: number, w: number, h: number, hex: string): void;
  disc(cx: number, cy: number, r: number, hex: string): void;
  h: number;
}

const rgbCache = new Map<string, [number, number, number]>();
function rgbOf(hex: string) {
  let v = rgbCache.get(hex);
  if (!v) {
    v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, v);
  }
  return v;
}

/** A canvas painted pixel by pixel, opaque where painted and clear elsewhere. */
export function pixLayer(w: number, h: number, paint: (p: Painter) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const set = (x: number, y: number, hex: string) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, gg, b] = rgbOf(hex);
    const o = (y * w + x) * 4;
    img.data[o] = r;
    img.data[o + 1] = gg;
    img.data[o + 2] = b;
    img.data[o + 3] = 255;
  };
  const rect = (x: number, y: number, rw: number, rh: number, hex: string) => {
    for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) set(x + xx, y + yy, hex);
  };
  const disc = (cx: number, cy: number, r: number, hex: string) => {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      rect(cx - half, cy + dy, half * 2 + 1, 1, hex);
    }
  };
  paint({ set, rect, disc, h });
  g.putImageData(img, 0, 0);
  return c;
}

export interface CityLight {
  x: number;
  y: number;
  kind: 'pipe' | 'tip' | 'cone';
  k: number;
}

export interface Art {
  theme: Theme;
  sky: HTMLCanvasElement;
  twinkle: { x: number; y: number; k: number }[];
  city: HTMLCanvasElement;
  cityLights: CityLight[];
}

export const CITY_W = 1024;
export const CITY_H = 124;

const arts = new Map<number, Art>();

/** A movement's baked art, made on first use and shared after that. */
export function artFor(movement: number): Art {
  const have = arts.get(movement);
  if (have) return have;
  const theme = THEMES[movement] ?? THEMES[0];
  const PAL = theme;
  const sky = pixLayer(WIDTH + 2, HEIGHT, ({ set }) => {
    const bands = PAL.sky.length - 1;
    const horizon = 184;
    for (let y = TOP; y < HEIGHT; y++) {
      const v = clamp((y - TOP) / (horizon - TOP), 0, 1) * bands;
      const i = Math.floor(v);
      const f = v - i;
      for (let x = 0; x < WIDTH + 2; x++) set(x, y, f * 16 > BAYER[y & 3][x & 3] ? PAL.sky[Math.min(i + 1, bands)] : PAL.sky[i]);
    }
    const r = mulberry32(7);
    for (let i = 0; i < 110; i++) {
      const y = TOP + r() * 120;
      const b = r();
      set(r() * WIDTH, y, b > 0.9 ? '#ffffff' : b > 0.6 ? PAL.stars[0] : PAL.stars[1]);
    }
  });
  const twinkle = Array.from({ length: 18 }, (_, i) => ({
    x: Math.floor(hash(i * 3 + 1) * WIDTH),
    y: TOP + 4 + Math.floor(hash(i * 3 + 2) * 110),
    k: i,
  }));

  const cityLights: CityLight[] = [];
  const city = theme.skyline === 'cave' ? bakeCave(theme, cityLights) : bakeCity(theme, cityLights);
  const art: Art = { theme, sky, twinkle, city, cityLights };
  arts.set(movement, art);
  return art;
}

/** The instrument city, tiling every CITY_W px. Its lights are recorded so they can play in turn. */
function bakeCity(PAL: Theme, cityLights: CityLight[]) {
  return pixLayer(CITY_W, CITY_H, ({ set, rect, disc, h }) => {
    const r = mulberry32(21);
    const body = PAL.city;
    const rim = PAL.cityRim;
    const light = (x: number, y: number, kind: CityLight['kind']) => cityLights.push({ x, y, kind, k: cityLights.length });
    const organ = (x: number) => {
      const n = 5 + Math.floor(r() * 5);
      const top = 46 + r() * 50;
      const vee = r() < 0.5;
      for (let i = 0; i < n; i++) {
        const t = vee ? 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1) : i / (n - 1);
        const ph = Math.round(top * (0.5 + 0.5 * t));
        const px = x + i * 5;
        rect(px, h - ph, 4, ph, body);
        rect(px, h - ph, 1, ph, rim);
        rect(px + 1, h - ph - 1, 2, 1, rim);
        rect(px + 1, h - 15, 2, 2, '#07030f');
        light(px + 1, h - 16, 'pipe');
      }
      return n * 5;
    };
    const harp = (x: number) => {
      const wd = 26;
      const hh = 68 + Math.round(r() * 22);
      const top = h - hh;
      rect(x, top, 3, hh, body);
      rect(x, top, 1, hh, rim);
      const neck = (sx: number) => top + Math.round(7 * Math.sin(((sx - x) / wd) * Math.PI));
      for (let sx = x; sx <= x + wd; sx++) {
        const ny = neck(sx);
        rect(sx, ny, 1, 3, body);
        set(sx, ny, rim);
      }
      const board = (sx: number) => Math.round(h - 3 - ((sx - x - 3) / (wd - 3)) * (hh - 12));
      for (let sx = x + 3; sx <= x + wd; sx++) rect(sx, board(sx), 1, 3, body);
      for (let sx = x + 5; sx < x + wd - 1; sx += 3) for (let y = neck(sx) + 3; y < board(sx); y++) set(sx, y, PAL.string);
      light(x + 1, top - 1, 'tip');
      return wd + 2;
    };
    const fork = (x: number) => {
      const tall = 70 + Math.round(r() * 20);
      rect(x + 2, h - 4, 9, 4, body);
      rect(x + 5, h - 40, 3, 36, body);
      rect(x + 5, h - 40, 1, 36, rim);
      rect(x, h - 46, 13, 6, body);
      rect(x, h - tall, 3, tall - 40, body);
      rect(x + 10, h - tall, 3, tall - 40, body);
      rect(x, h - tall, 1, tall - 40, rim);
      rect(x + 10, h - tall, 1, tall - 40, rim);
      light(x + 1, h - tall - 1, 'tip');
      light(x + 11, h - tall - 1, 'tip');
      return 14;
    };
    const metronome = (x: number) => {
      const hh = 48 + Math.round(r() * 14);
      const cx = x + 11;
      for (let row = 0; row < hh; row++) {
        const half = Math.round(3 + 8 * (row / hh));
        rect(cx - half, h - hh + row, half * 2, 1, body);
        set(cx - half, h - hh + row, rim);
      }
      rect(cx - 2, h - hh + 10, 4, hh - 16, PAL.cityDetail);
      for (let i = 0; i < hh - 18; i++) set(cx + Math.round(i * 0.12) - 1, h - 8 - i, PAL.string);
      light(cx - 1, h - hh - 1, 'tip');
      return 24;
    };
    const speakers = (x: number) => {
      const wd = 14 + Math.round(r() * 6);
      const hh = 26 + Math.round(r() * 18);
      rect(x, h - hh, wd, hh, body);
      rect(x, h - hh, 1, hh, rim);
      const cx = x + Math.floor(wd / 2);
      for (const cy of [h - hh + 8, h - 9]) {
        disc(cx, cy, 5, '#0c0618');
        disc(cx, cy, 4, PAL.cityDetail);
        disc(cx, cy, 2, rim);
        set(cx, cy, '#4a3484');
      }
      light(cx, h - hh + 8, 'cone');
      return wd;
    };
    const spire = (x: number) => {
      const hh = 60 + Math.round(r() * 30);
      rect(x + 3, h - hh, 2, hh, body);
      set(x + 3, h - hh + 4, rim);
      for (let a = 0; a < TAU * 1.6; a += 0.12) {
        const rr = 4 - a * 0.7;
        set(x + 4 + Math.cos(a) * rr * 1.2, h - hh - 4 + Math.sin(a) * rr, rim);
      }
      light(x + 4, h - hh - 4, 'tip');
      return 9;
    };
    const kinds = [organ, harp, fork, metronome, speakers, spire, organ, speakers];
    let x = 6;
    while (x < CITY_W - 40) x += kinds[Math.floor(r() * kinds.length)](x) + 3 + Math.floor(r() * 14);
    rect(0, h - 3, CITY_W, 3, body);
  });
}

/**
 * The cave, tiling every CITY_W px: stalagmites, rock columns, and clusters of crystals whose tips light in turn,
 * with string posts (two pegs and their strings) between them.
 */
function bakeCave(PAL: Theme, cityLights: CityLight[]) {
  return pixLayer(CITY_W, CITY_H, ({ set, rect, h }) => {
    const r = mulberry32(37);
    const body = PAL.city;
    const rim = PAL.cityRim;
    const light = (x: number, y: number, kind: CityLight['kind']) => cityLights.push({ x, y, kind, k: cityLights.length });
    const stalagmite = (x: number) => {
      const w = 10 + Math.round(r() * 14);
      const hh = 30 + Math.round(r() * 60);
      for (let row = 0; row < hh; row++) {
        const half = Math.max(0, Math.round((w / 2) * (row / hh) + (r() < 0.3 ? 1 : 0)));
        rect(x + w / 2 - half, h - hh + row, half * 2 + 1, 1, body);
        set(x + w / 2 - half, h - hh + row, rim);
      }
      light(x + Math.round(w / 2), h - hh - 1, 'tip');
      return w;
    };
    const mesa = (x: number) => {
      // A flat-topped outcrop, banded with strata, its top corners worn round.
      const w = 22 + Math.round(r() * 26);
      const hh = 34 + Math.round(r() * 40);
      for (let row = 0; row < hh; row++) {
        const inset = row < 3 ? 3 - row : Math.round(row / 12);
        rect(x + inset, h - hh + row, w - inset * 2, 1, body);
        set(x + inset, h - hh + row, rim);
      }
      rect(x + 3, h - hh, w - 6, 1, rim);
      for (let y = h - hh + 8; y < h - 6; y += 7 + Math.floor(r() * 6)) rect(x + 4, y, w - 8, 1, PAL.cityDetail);
      light(x + Math.round(w / 2), h - hh - 1, 'tip');
      return w;
    };
    const crystals = (x: number) => {
      let w = 0;
      for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
        const hh = 10 + Math.round(r() * 22);
        const cx = x + i * 5;
        for (let row = 0; row < hh; row++) {
          const half = Math.round(2 * Math.min(1, (hh - row) / 4, row / 3 + 0.5));
          rect(cx - half, h - hh + row, half * 2 + 1, 1, row < 3 ? rim : body);
        }
        light(cx, h - hh, 'cone');
        w = i * 5 + 4;
      }
      return w + 2;
    };
    const posts = (x: number) => {
      const span = 40 + Math.round(r() * 30);
      const hh = 50 + Math.round(r() * 30);
      for (const px of [x, x + span]) {
        rect(px, h - hh, 3, hh, body);
        rect(px, h - hh, 1, hh, rim);
        rect(px - 1, h - hh - 2, 5, 2, rim);
        light(px + 1, h - hh - 3, 'pipe');
      }
      for (let k = 0; k < 4; k++) {
        const y0 = h - hh + 4 + k * 5;
        for (let sx = x + 3; sx < x + span; sx++) set(sx, y0 + Math.round(2 * Math.sin(((sx - x) / span) * Math.PI)), PAL.string);
      }
      return span + 4;
    };
    const kinds = [stalagmite, stalagmite, crystals, mesa, posts, crystals, stalagmite];
    let x = 6;
    while (x < CITY_W - 90) x += kinds[Math.floor(r() * kinds.length)](x) + 3 + Math.floor(r() * 12);
    rect(0, h - 3, CITY_W, 3, body);
  });
}
