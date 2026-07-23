// Generates every SEO / PWA image variant Tradly ships, from a small set
// of high-res sources under brand-assets/. Writes into the public/ folder
// of every sibling repo so all three front-ends stay in visual sync.
//
// Run with:  node scripts/build-brand-assets.mjs [--only=market|flow|marketing]
//
// Outputs, per target public/:
//   favicon-16x16.png              — legacy small favicon
//   favicon-32x32.png              — standard favicon
//   apple-touch-icon.png           — 180x180, iOS Home Screen
//   icon-192.png                   — PWA install
//   icon-512.png                   — PWA install (high-res)
//   icon-maskable-512.png          — PWA maskable (padded safe zone)
//   og-default.jpg                 — 1200x630, social share card
//
// Sizes are optimised: apple-touch-icon lands ~15-25 KB (was 1.3 MB),
// og-default lands ~150-250 KB (was 1.1 MB). Fetch is now instantaneous.

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const BRAND = resolve(ROOT, "brand-assets");
const WORKSPACE = resolve(ROOT, "..");

// Sibling public/ folders. Keyed so `--only=<name>` narrows the write set.
const TARGETS = {
  market: resolve(ROOT, "public"),
  flow: resolve(WORKSPACE, "tradly-flow", "public"),
  marketing: resolve(WORKSPACE, "remix-of-tradly-marketing-suite", "public"),
};

const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.slice("--only=".length);
const chosen = only ? { [only]: TARGETS[only] } : TARGETS;

if (only && !TARGETS[only]) {
  console.error(`--only=${only} is not one of: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

async function ensureDir(dir) {
  try { await stat(dir); } catch { await mkdir(dir, { recursive: true }); }
}

async function writeAll(name, buffer) {
  for (const [label, dir] of Object.entries(chosen)) {
    await ensureDir(dir);
    const out = join(dir, name);
    await writeFile(out, buffer);
    console.log(`  → ${label.padEnd(9)} ${name.padEnd(24)} ${(buffer.length / 1024).toFixed(1)} KB`);
  }
}

// ── ICONS ────────────────────────────────────────────────────────────────
// The icon source is a square RGBA mark. We flatten to opaque white for
// the tiny favicons (browsers render them tiny, alpha edges look muddy)
// and keep alpha for the PWA + apple-touch variants (iOS masks its own).

const iconSourceBuf = await readFile(join(BRAND, "icon-source.png"));

async function iconAt(size, { flatten = false, padding = 0 } = {}) {
  let img = sharp(iconSourceBuf).resize(size - padding * 2, size - padding * 2, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (padding > 0) {
    img = img.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  if (flatten) {
    img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
  }
  return img.png({ compressionLevel: 9, palette: true }).toBuffer();
}

console.log("icons:");
await writeAll("favicon-16x16.png", await iconAt(16, { flatten: true }));
await writeAll("favicon-32x32.png", await iconAt(32, { flatten: true }));
await writeAll("apple-touch-icon.png", await iconAt(180));
await writeAll("icon-192.png", await iconAt(192));
await writeAll("icon-512.png", await iconAt(512));
// Maskable spec: safe zone is a circle of radius 40% of canvas. Padding
// the icon to ~10% of the canvas each side keeps the mark inside the
// safe zone regardless of the OS mask shape (circle, squircle, teardrop).
await writeAll("icon-maskable-512.png", await iconAt(512, { padding: 52 }));

// ── OG IMAGE ─────────────────────────────────────────────────────────────
// 1200x630 is the aspect Facebook / LinkedIn / Twitter/X all crop to.
// JPEG q82 progressive gives sharp text with sub-250 KB payload.

console.log("og:");
const ogSourceBuf = await readFile(join(BRAND, "og-source.png"));
const ogOut = await sharp(ogSourceBuf)
  .resize(1200, 630, { fit: "cover", position: "center" })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toBuffer();
await writeAll("og-default.jpg", ogOut);

console.log("\ndone.");
