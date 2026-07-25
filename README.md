<div align="center">
  <img src="static/icons/icon.svg" width="112" height="112" alt="YT Zero Enhance logo">
  <h1>YT Zero Enhance</h1>
  <p><strong>A smoother YT Zero experience, wherever you watch.</strong></p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="AGPL-3.0-only"></a>
    <img src="https://img.shields.io/badge/Manifest-V3-3ea6ff" alt="Manifest V3">
    <img src="https://img.shields.io/badge/locales-EN%20%7C%20PL%20%7C%20DE-f2293a" alt="English, Polish and German">
  </p>
</div>

YT Zero Enhance is the companion browser extension for [YT Zero](https://github.com/Pelski/ytzero). It routes supported video links to your own instance and brings familiar controls, shortcuts, profile settings, SponsorBlock chapters and frame capture to embedded players.

Main project: [Pelski/ytzero](https://github.com/Pelski/ytzero)

> [!IMPORTANT]
> YT Zero Enhance requires access to a running YT Zero instance. It is not a standalone video client and it does not bypass authentication, advertisements, DRM, region restrictions or bot protection.

## Install

Store releases are being prepared. The official download buttons will appear here as soon as each listing is public. Until then, use the [manual installation](#build-and-install-manually) instructions below.

<!--
STORE BADGES — replace every STORE_LISTING_URL, then uncomment only after the
corresponding listing is publicly available. Official artwork and its aspect
ratio must not be modified.

<p align="center">
  <a href="CHROME_WEB_STORE_LISTING_URL"><img src="https://developer.chrome.com/static/docs/webstore/branding/image/iNEddTyWiMfLSwFD6qGq.png" height="58" alt="Available in the Chrome Web Store"></a>
  <a href="FIREFOX_AMO_LISTING_URL"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" height="58" alt="Get the add-on for Firefox"></a>
  <a href="EDGE_ADDONS_LISTING_URL"><img src="https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/add-ons-badge-images/microsoft-edge-add-ons-badge.png" height="58" alt="Get it from Microsoft Edge Add-ons"></a>
  <a href="APPLE_APP_STORE_LISTING_URL"><img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" height="58" alt="Download on the App Store"></a>
</p>

Generate the final localized Apple image/link pair in App Store Marketing Tools:
https://tools.applemediaservices.com/app-store/
-->

## What it adds

- Redirects supported watch, Shorts, live and short-link URLs to `/watch/:videoId` on your default YT Zero instance, preserving timestamps.
- Pairs securely from any signed-in YT Zero page; supports multiple local, LAN, HTTPS and reverse-proxy-path instances.
- Reads the active YT Zero profile's playback speed, seek interval, FPS, quality ceiling, captions, chapters, SponsorBlock and screenshot naming settings.
- Replaces the embedded player's native controls with a YT Zero-style control bar, buffering/progress display, chapters, SponsorBlock segments, volume, captions, PiP, fullscreen and theatre mode.
- Makes shortcuts work without first focusing the iframe, including approximate frame stepping with `,` / `.`.
- Captures the visible embedded video frame to PNG, JPEG or WebP.
- Ships in English, Polish and German, selected from the browser UI language.
- Keeps extension toggles in `storage.sync`; paired instances and cached profile configuration stay in `storage.local`.

The extension does not modify the YT Zero application or its database.

## Browser support

| Browser | Build | Manual install | Store package |
|---|---|---|---|
| Chrome, Chromium, Brave, Vivaldi | `dist/chromium` | Unpacked extension | `ytzero-enhance-chromium-<version>.zip` |
| Microsoft Edge | `dist/chromium` | Unpacked extension | Chromium ZIP for Edge Add-ons |
| Firefox 128+ | `dist/firefox` | Temporary add-on | `ytzero-enhance-firefox-<version>.zip` |
| Safari on macOS | `dist/safari` or Xcode wrapper | Temporary extension / containing app | App Store app |
| Safari on iPhone and iPad | Xcode wrapper | Containing iOS app | App Store app |

## First connection

1. Install the extension for your browser.
2. Open any signed-in page on your YT Zero instance, including its homepage.
3. Select the YT Zero Enhance toolbar icon.
4. Choose **Connect this tab**.
5. Grant access to the instance when your browser asks.

Pair other instances in the same way. Each paired page uses its own active profile; only supported video-link redirects use the instance marked as default. The popup lets you toggle redirects and player enhancements, capture a frame, open your instance and manage connections.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play or pause |
| Hold `Space` | Temporarily play at 2× speed |
| `J` / `L` | Seek −10 s / +10 s |
| `←` / `→` | Seek by the profile interval |
| `↑` / `↓` / `M` | Volume up, down or mute |
| `C`, `+`, `-` | Captions and caption size |
| `0`–`9` | Jump to 0–90% |
| `,` / `.` | Previous / next approximate frame |
| `S` | Save the current frame |
| `F` / `T` | Fullscreen / YT Zero theatre mode |
| `Alt+Shift+S` | Capture the active embedded player |
| `Alt+Shift+Y` | Toggle redirects globally |

## Build and install manually

### Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) 1.3 or newer
- macOS with Xcode for the packaged Safari app

```bash
git clone https://github.com/Pelski/ytzero-enhance.git
cd ytzero-enhance
bun install --frozen-lockfile
bun run check
```

`bun run check` type-checks, tests and builds all browser targets. For a build without checks, run `bun run build`.

### Chrome, Chromium, Brave and Vivaldi

1. Open `chrome://extensions` (Brave: `brave://extensions`, Vivaldi: `vivaldi://extensions`).
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the generated `dist/chromium` directory.
5. Reload the extension from this page after rebuilding it.

### Microsoft Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/chromium`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json` (or the Firefox ZIP created by `bun run package`).

Firefox removes temporary add-ons when it restarts. A persistent installation requires a package signed by Mozilla; normal users should install the eventual AMO release.

### Safari on macOS — quick temporary test

Recent Safari versions can load the web-extension folder directly:

1. Open **Safari → Settings → Advanced** and enable web-developer features if the **Developer** tab is hidden.
2. Open **Safari → Settings → Developer**.
3. Select **Add Temporary Extension…** and choose `dist/safari`.
4. Enable the extension and grant website access in **Safari → Settings → Extensions**.

Safari removes a temporary extension after 24 hours or when Safari quits.

### Safari on macOS — Xcode app

The repository contains a generated universal wrapper at `safari/YT Zero Enhance`. Recreate it only when changing converter-level project structure:

```bash
bun run safari:project
open "safari/YT Zero Enhance/YT Zero Enhance.xcodeproj"
```

`safari:project` replaces the generated wrapper. After setting your Team and signing configuration, use regular `bun run build`; it synchronizes extension resources without overwriting Xcode signing state.

In Xcode, select the macOS scheme and run the containing app once. Then enable YT Zero Enhance in **Safari → Settings → Extensions**.

### Safari on iPhone and iPad

1. Open `safari/YT Zero Enhance/YT Zero Enhance.xcodeproj`.
2. Set your development **Team** and unique bundle identifiers.
3. Select the iOS scheme and an iPhone/iPad simulator or connected device, then choose **Run**.
4. Enable the extension in Safari's **Extensions** menu or **Settings → Apps → Safari → Extensions**.
5. Allow access to the supported player hosts, your YT Zero host and sites containing players you want to enhance.

The simulator works without a paid membership. Testing on a physical device requires Apple Developer Program membership. Safari distribution uses the containing application, not a browser ZIP.

## Frame capture notes

The local YT Zero player can export the source video frame and therefore gives the best quality. An embedded cross-origin player cannot expose those pixels directly, so the extension captures the rendered tab and crops the visible video. That result is limited to on-screen resolution; hardware overlays, DRM or another window covering the browser can produce a black frame. Use the local player when exact source pixels matter.

## Packages and releases

```bash
bun run check
bun run package
```

This creates versioned archives in `artifacts/` for Chromium, Firefox and Safari. Keep the version in `package.json` and all three files in `manifests/` identical. Before publishing, follow [the store release checklist](docs/store-release.md), [privacy policy](PRIVACY.md) and [the compatibility matrix](docs/embedded-player-compatibility.md).

## Privacy and permissions

YT Zero Enhance has no analytics, advertising or external backend. Access to supported player hosts is required for its core behavior. Access to a self-hosted instance is optional and requested only after you choose its address. See the complete [privacy policy](PRIVACY.md).

## Development

```text
_locales/   Browser translations
manifests/  Per-browser Manifest V3 files
safari/     Generated macOS/iOS containing-app project
scripts/    Build and packaging tools
src/        TypeScript extension code and injected player CSS
static/     Popup, options and source icon assets
tests/      Unit tests and UI preview fixtures
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security issues must be reported privately as described in [SECURITY.md](SECURITY.md).

## License

YT Zero Enhance is free software licensed under the [GNU Affero General Public License v3.0 only](LICENSE).

YT Zero Enhance is an independent project and is not affiliated with or endorsed by Google, Mozilla, Microsoft or Apple.
