import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const targets = ["chromium", "firefox", "safari"] as const;
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = String(packageJson.version);
const iconColor = "#0a5fff";
const playPath = "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z";

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Niepoprawna wersja pakietu: ${version}`);
}

function iconSvg(rounded = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512"${rounded ? ' rx="112"' : ""} fill="${iconColor}"/>
    <svg x="112" y="112" width="288" height="288" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="${playPath}"/>
    </svg>
  </svg>`;
}

function iconPng(size: number, rounded = true) {
  return new Uint8Array(new Resvg(iconSvg(rounded), { fitTo: { mode: "width", value: size } }).render().asPng());
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
  const iconSvg = await readFile(join(root, "static/icons/icon.svg"), "utf8");
  if (!iconSvg.includes(`fill="${iconColor}"`) || !iconSvg.includes(`d="${playPath}"`)) throw new Error("Źródłowe SVG nie zgadza się z generatorem ikon");
  for (const target of targets) {
    const manifest = JSON.parse(await readFile(join(root, "dist", target, "manifest.json"), "utf8"));
    if (manifest.manifest_version !== 3 || manifest.name !== "__MSG_extensionName__" || manifest.default_locale !== "en" || manifest.version !== version) throw new Error(`Niepoprawny manifest ${target}`);
    if (target === "firefox" && manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.[0] !== "none") {
      throw new Error("Manifest Firefoxa musi deklarować brak zbierania danych dla AMO");
    }
    for (const locale of ["en", "pl", "de"]) {
      const messages = JSON.parse(await readFile(join(root, "dist", target, "_locales", locale, "messages.json"), "utf8"));
      if (!messages.extensionName?.message || !messages.extensionDescription?.message) throw new Error(`Niepoprawne tłumaczenie ${locale} dla ${target}`);
    }
  }
}

console.log(`Zbudowano: ${targets.map((target) => `dist/${target}`).join(", ")}${args.has("--package") ? " oraz artifacts/*.zip" : ""}`);
