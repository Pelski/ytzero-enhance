import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const targets = ["chromium", "firefox", "safari"] as const;
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = String(packageJson.version);

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Niepoprawna wersja pakietu: ${version}`);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const name = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, Buffer.from(data)])), 8 + data.length);
  return output;
}

function iconPng(size: number, rounded = true) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const insideRounded = (x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number) => {
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const triangle = (x: number, y: number) => {
    const ax = 196 / 512, ay = 143 / 512, bx = 196 / 512, by = 369 / 512, cx = 410 / 512, cy = .5;
    const sign = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d1 = sign(x, y, ax, ay, bx, by), d2 = sign(x, y, bx, by, cx, cy), d3 = sign(x, y, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const nx = (x + .5) / size, ny = (y + .5) / size;
      const screen = !rounded || insideRounded(nx, ny, 0, 0, 1, 1, 112 / 512);
      let color = screen ? [37, 99, 235, 255] : [0, 0, 0, 0];
      if (screen && triangle(nx, ny)) color = [255, 255, 255, 255];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      rows.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(rows)), pngChunk("IEND", new Uint8Array())]);
}

await mkdir(join(root, "static/icons"), { recursive: true });
// 19/38 are important for browser toolbars (notably Retina Safari). Without
// them Safari may select the 16 pt asset and render the glyph optically smaller
// than neighbouring toolbar items.
for (const size of [16, 19, 32, 38, 48, 64, 128]) await writeFile(join(root, "static/icons", `icon-${size}.png`), iconPng(size));

// Apple applies the final platform mask itself. App Store icons must therefore
// be opaque edge-to-edge, matching YT Zero's install icon rather than nesting
// a rounded web-extension glyph on a white converter background.
const safariAppIcons: Record<string, number> = {
  "mac-icon-16@1x.png": 16,
  "mac-icon-16@2x.png": 32,
  "mac-icon-32@1x.png": 32,
  "mac-icon-32@2x.png": 64,
  "mac-icon-128@1x.png": 128,
  "mac-icon-128@2x.png": 256,
  "mac-icon-256@1x.png": 256,
  "mac-icon-256@2x.png": 512,
  "mac-icon-512@1x.png": 512,
  "mac-icon-512@2x.png": 1024,
  "universal-icon-1024@1x.png": 1024,
};
const safariAppIconDir = join(root, "safari/YT Zero Enhance/Shared (App)/Assets.xcassets/AppIcon.appiconset");
try {
  await readFile(join(safariAppIconDir, "Contents.json"));
  for (const [filename, size] of Object.entries(safariAppIcons)) await writeFile(join(safariAppIconDir, filename), iconPng(size, false));
} catch {}

await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(join(root, "dist"), { recursive: true });

for (const target of targets) {
  const outdir = join(root, "dist", target);
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(root, "src/background.ts"), join(root, "src/content.ts"), join(root, "src/options.ts"), join(root, "src/popup.ts")],
    outdir,
    target: "browser",
    format: "iife",
    minify: false,
    sourcemap: "none",
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  await copyFile(join(root, "manifests", `${target}.json`), join(outdir, "manifest.json"));
  await copyFile(join(root, "src/player.css"), join(outdir, "player.css"));
  await copyFile(join(root, "static/options.html"), join(outdir, "options.html"));
  await copyFile(join(root, "static/options.css"), join(outdir, "options.css"));
  await copyFile(join(root, "static/popup.html"), join(outdir, "popup.html"));
  await copyFile(join(root, "static/popup.css"), join(outdir, "popup.css"));
  await cp(join(root, "static/icons"), join(outdir, "icons"), { recursive: true });
  await cp(join(root, "_locales"), join(outdir, "_locales"), { recursive: true });

  // Keep the checked-in Xcode wrapper current without regenerating it and
  // overwriting the owner's signing/team configuration.
  if (target === "safari") {
    const projectFile = join(root, "safari/YT Zero Enhance/YT Zero Enhance.xcodeproj/project.pbxproj");
    try {
      await readFile(projectFile);
      const resources = join(root, "safari/YT Zero Enhance/Shared (Extension)/Resources");
      await rm(resources, { recursive: true, force: true });
      await cp(outdir, resources, { recursive: true });
    } catch {}
  }
}

if (args.has("--package")) {
  const artifactDir = join(root, "artifacts");
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  for (const target of targets) {
    const process = Bun.spawn(["zip", "-qr", join(artifactDir, `ytzero-enhance-${target}-${version}.zip`), "."], { cwd: join(root, "dist", target) });
    if (await process.exited !== 0) throw new Error(`Nie udało się spakować ${target}`);
  }
}

if (args.has("--check")) {
  for (const target of targets) {
    const manifest = JSON.parse(await readFile(join(root, "dist", target, "manifest.json"), "utf8"));
    if (manifest.manifest_version !== 3 || manifest.name !== "__MSG_extensionName__" || manifest.default_locale !== "en" || manifest.version !== version) throw new Error(`Niepoprawny manifest ${target}`);
    for (const locale of ["en", "pl", "de"]) {
      const messages = JSON.parse(await readFile(join(root, "dist", target, "_locales", locale, "messages.json"), "utf8"));
      if (!messages.extensionName?.message || !messages.extensionDescription?.message) throw new Error(`Niepoprawne tłumaczenie ${locale} dla ${target}`);
    }
  }
}

console.log(`Zbudowano: ${targets.map((target) => `dist/${target}`).join(", ")}${args.has("--package") ? " oraz artifacts/*.zip" : ""}`);
