// Captures UI states from a running web app and composes them into framed
// images.
//
//   node shoot.mjs <shots.mjs> --url <base-url> --out <dir>
//     [--style clean|glass] [--format png|webp] [--only a,b] [--raw <dir>]
//
// <shots.mjs> default-exports an array of shot definitions; see
// shots.example.mjs for the full shape and working recipes. --style sets the
// style for every shot that doesn't set its own. --format defaults to
// lossless png, a master the site's own image pipeline can re-encode; webp
// (q86) is much smaller but lossy, and its chroma subsampling softens
// coloured text.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, loadSharp, parseArgs } from './lib.mjs';

const usage =
  'usage: node shoot.mjs <shots.mjs> --url <base-url> --out <dir> [--style clean|glass] [--format png|webp] [--only a,b] [--raw <dir>]';
const { flags, positional } = parseArgs(process.argv.slice(2));
const [shotsFile] = positional;
if (!shotsFile || typeof flags.url !== 'string' || !flags.out) {
  console.error(usage);
  process.exit(1);
}
const STYLES = ['clean', 'glass'];
const defaultStyle = typeof flags.style === 'string' ? flags.style : 'clean';
if (!STYLES.includes(defaultStyle)) {
  console.error(`unknown --style ${defaultStyle}; expected ${STYLES.join(' or ')}`);
  process.exit(1);
}
const FORMATS = ['png', 'webp'];
const format = typeof flags.format === 'string' ? flags.format : 'png';
if (!FORMATS.includes(format)) {
  console.error(`unknown --format ${format}; expected ${FORMATS.join(' or ')}`);
  process.exit(1);
}

const base = flags.url;
const outDir = path.resolve(flags.out);
const rawDir = typeof flags.raw === 'string' ? path.resolve(flags.raw) : null;
const only = typeof flags.only === 'string' ? flags.only.split(',') : [];
mkdirSync(outDir, { recursive: true });
if (rawDir) mkdirSync(rawDir, { recursive: true });

const shots = (await import(pathToFileURL(path.resolve(shotsFile)).href)).default;
const { chromium } = loadPlaywright();
const sharp = loadSharp();

// The look: a 1000-css-px stage rendered at 2x (2000px wide), the app as a
// rounded window with a layered shadow. Crop edges that touch the viewport
// get padding; edges that cut through the UI bleed off the stage, which is
// what makes a crop read as a detail of a real window rather than a pasted
// rectangle.
//
// Two styles share that geometry:
//   clean  soft warm-gray gradient stage, 56px padding.
//   glass  gradient stage coloured from the shot itself, 96px padding, and
//          a frosted, semi-transparent white bezel around the window.
// Extra padding widens the stage rather than shrinking the UI, so the same
// crop renders the UI at the same scale in either style.
const STAGE_W = 1000;
const PAD = { clean: 56, glass: 96 };
const BEZEL = 10;
const UI_DPR = 3;
const OUT_DPR = 2;

const browser = await chromium.launch();

async function capture(shot) {
  const viewport = shot.viewport ?? { width: 1280, height: 800 };
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: UI_DPR,
    reducedMotion: 'reduce',
    baseURL: base,
    colorScheme: shot.colorScheme ?? 'light',
  });
  if (shot.init) await context.addInitScript(shot.init);
  if (shot.routes) await shot.routes(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`[${shot.name}] pageerror`, e.message));
  if (shot.path) {
    await page.goto(shot.path);
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  const target = (shot.setup && (await shot.setup({ page, context, base }))) || page;
  await target.waitForTimeout(shot.settle ?? 700);
  // Park the cursor in a corner so no stray hover state lands in the frame.
  await target.mouse.move(viewport.width - 1, viewport.height - 1).catch(() => {});
  if (shot.beforeShot) await shot.beforeShot({ page: target });
  await target.waitForTimeout(250);
  const buf = await target.screenshot();
  if (rawDir) writeFileSync(path.join(rawDir, `${shot.name}.png`), buf);
  await context.close();
  return { buf, viewport };
}

const hsl = (h, s, l) =>
  `hsl(${Math.round((h + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Reads the shot's main hues for the glass stage. Hues are weighted by
// chroma squared, so a small saturated brand accent outweighs a large pale
// tint. Returns null colours for a neutral UI.
async function palette(buf) {
  const { data, info } = await sharp(buf)
    .resize(96, 60, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 24 }, () => ({ w: 0, x: 0, y: 0, s: 0 }));
  let luma = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (chroma < 0.12) continue;
    const sector =
      max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    const h = (sector * 60 + 360) % 360;
    const l = (max + min) / 2;
    const w = chroma * chroma;
    const bin = bins[Math.floor(h / 15) % 24];
    bin.w += w;
    bin.x += Math.cos((h * Math.PI) / 180) * w;
    bin.y += Math.sin((h * Math.PI) / 180) * w;
    bin.s += (chroma / (1 - Math.abs(2 * l - 1))) * w;
  }
  const dark = luma / (info.width * info.height) < 0.35;
  const peaks = bins
    .filter((b) => b.w > 0)
    .map((b) => ({
      w: b.w,
      h: ((Math.atan2(b.y, b.x) * 180) / Math.PI + 360) % 360,
      s: (b.s / b.w) * 100,
    }))
    .sort((a, b) => b.w - a.w);
  const hues = [];
  for (const p of peaks) {
    if (p.w < peaks[0].w * 0.12 || hues.length === 3) break;
    if (hues.every((q) => Math.abs(((p.h - q.h + 540) % 360) - 180) >= 40)) hues.push(p);
  }
  if (!hues.length) return { dark, colors: null };
  // With fewer than three hues, fill in neighbours close to the main hue so
  // a single-colour brand doesn't drift into another colour family.
  const [a, b = { ...a, h: a.h + 12 }, c = { ...a, h: a.h - 30 }] = hues;
  const corners = [a, b, c, { ...a, h: a.h - 12 }];
  const tint = dark
    ? (p, k) => hsl(p.h, clamp(p.s * 0.7, 35, 70), 22 + k * 4)
    : (p, k) => hsl(p.h, clamp(p.s, 55, 90), 80 + k * 3);
  return {
    dark,
    colors: corners.map((p, k) => tint(p, k % 2)),
    base: dark ? [hsl(a.h, 25, 9), hsl(c.h, 25, 12)] : [hsl(a.h, 70, 96), hsl(c.h, 60, 94)],
  };
}

const NEUTRAL = {
  light: 'radial-gradient(130% 120% at 0% 0%, #f5f4f2 0%, #ecebe8 55%, #e4e3df 100%)',
  dark: 'radial-gradient(130% 120% at 0% 0%, #2a2a2c 0%, #1c1c1e 55%, #161618 100%)',
};

function glassGradient({ dark, colors, base }) {
  if (!colors) return dark ? NEUTRAL.dark : NEUTRAL.light;
  const at = ['0% 0%', '100% 6%', '100% 100%', '0% 100%'];
  const size = ['70% 58%', '65% 55%', '75% 60%', '70% 58%'];
  return [
    ...colors.map((c, i) => `radial-gradient(${size[i]} at ${at[i]}, ${c} 0%, transparent 100%)`),
    `linear-gradient(160deg, ${base[0]} 0%, ${base[1]} 100%)`,
  ].join(', ');
}

async function compose(shot, { buf, viewport }) {
  const style = shot.style ?? defaultStyle;
  if (!STYLES.includes(style)) throw new Error(`unknown style ${style}`);
  const glass = style === 'glass';
  const crop = shot.crop ?? { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const pad = shot.pad ?? PAD[style];
  const pl = crop.x <= 0 ? pad : 0;
  const pt = crop.y <= 0 ? pad : 0;
  const pr = crop.x + crop.w >= viewport.width ? pad : 0;
  const pb = crop.y + crop.h >= viewport.height ? pad : 0;
  const stageW = shot.stageW ?? STAGE_W + (pl ? pad - PAD.clean : 0) + (pr ? pad - PAD.clean : 0);
  const s = (stageW - pl - pr) / crop.w;
  const stageH = Math.round(crop.h * s + pt + pb);
  const win = {
    left: pl - crop.x * s,
    top: pt - crop.y * s,
    width: viewport.width * s,
    height: viewport.height * s,
  };
  const radius = shot.radius ?? 12;

  let dark;
  let background;
  if (glass) {
    const colours = await palette(buf);
    dark = shot.stage ? shot.stage === 'dark' : colours.dark;
    background = shot.gradient ?? glassGradient({ ...colours, dark });
    console.log(`[${shot.name}] stage: ${background}`);
  } else {
    dark = (shot.stage ?? (shot.colorScheme === 'dark' ? 'dark' : 'light')) === 'dark';
    background = shot.gradient ?? (dark ? NEUTRAL.dark : NEUTRAL.light);
  }

  const bezel = shot.bezel ?? BEZEL;
  const shade = dark ? '0,0,0' : '30,40,80';
  const windowShadow = glass
    ? `0 0 0 1px rgba(255,255,255,${dark ? 0.18 : 0.5}), 0 2px 8px rgba(${shade},0.12)`
    : `0 0 0 1px ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'},
        0 1px 2px rgba(0,0,0,${dark ? 0.3 : 0.04}),
        0 10px 28px -8px rgba(0,0,0,${dark ? 0.45 : 0.1}),
        0 28px 72px -16px rgba(0,0,0,${dark ? 0.55 : 0.16})`;
  const html = `<!doctype html><html><head><style>
    html, body { margin: 0; background: transparent; }
    .stage {
      position: relative; overflow: hidden;
      width: ${stageW}px; height: ${stageH}px;
      background: ${background};
    }
    .grain { position: absolute; inset: 0; opacity: 0.05; mix-blend-mode: overlay; }
    .bezel {
      position: absolute;
      left: ${win.left - bezel}px; top: ${win.top - bezel}px;
      width: ${win.width + bezel * 2}px; height: ${win.height + bezel * 2}px;
      border-radius: ${radius + bezel}px;
      background: rgba(255,255,255,${dark ? 0.12 : 0.32});
      backdrop-filter: blur(18px) saturate(1.4);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,${dark ? 0.25 : 0.65}),
        0 18px 48px -12px rgba(${shade},${dark ? 0.45 : 0.22}),
        0 40px 90px -24px rgba(${shade},${dark ? 0.55 : 0.28});
    }
    .win {
      position: absolute;
      left: ${win.left}px; top: ${win.top}px;
      width: ${win.width}px; height: ${win.height}px;
      border-radius: ${radius}px;
      overflow: hidden;
      box-shadow: ${windowShadow};
    }
    .win img { display: block; width: 100%; height: 100%; }
  </style></head><body>
    <div class="stage">${
      glass
        ? `
      <svg class="grain" width="100%" height="100%">
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/></filter>
        <rect width="100%" height="100%" filter="url(#noise)"/>
      </svg>
      <div class="bezel"></div>`
        : ''
    }
      <div class="win"><img src="data:image/png;base64,${buf.toString('base64')}"></div>
    </div>
  </body></html>`;
  const context = await browser.newContext({
    viewport: { width: Math.ceil(stageW), height: stageH },
    deviceScaleFactor: OUT_DPR,
  });
  const page = await context.newPage();
  await page.setContent(html);
  await page.locator('img').evaluate((img) => img.decode());
  const png = await page.locator('.stage').screenshot();
  await context.close();
  const file = path.join(outDir, `${shot.name}.${format}`);
  const encoded =
    format === 'webp'
      ? sharp(png).webp({ quality: 86, effort: 6 })
      : sharp(png).png({ compressionLevel: 9, adaptiveFiltering: true });
  const info = await encoded.toFile(file);
  console.log(`${file}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}

let failed = 0;
try {
  for (const shot of shots) {
    if (only.length && !only.includes(shot.name)) continue;
    try {
      await compose(shot, await capture(shot));
    } catch (err) {
      failed++;
      console.log(`[${shot.name}] FAILED`, err.message);
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
