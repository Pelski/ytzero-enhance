# Repository working guide

This file applies to the entire `ytzero-enhance` repository. Keep it current when a product decision, integration contract, build workflow, or non-obvious browser workaround changes.

## Project purpose

YT Zero Enhance is the browser-extension companion for the self-hosted YT Zero application. It supports Chromium browsers, Firefox, and Safari on macOS/iOS/iPadOS from one TypeScript codebase.

The sibling `../ytzero` repository owns the application-side bridge. Its relevant contract is documented in `../ytzero/docs/browser-extension-integration.md`, and its configuration element is emitted by `../ytzero/ui/src/App.tsx`. Do not modify the sibling repository unless the user explicitly puts it in scope.

## Source layout

- `src/background.ts` — extension background messaging, paired-instance registry, redirects, captures, and page/player coordination.
- `src/content.ts` — top-page bridge plus embedded player controls and shortcuts. It runs in all matching frames.
- `src/instances.ts` — embedded configuration parsing, instance URL inference, matching, and settings URLs.
- `src/contract.ts` — validated, versioned application/player bridge contract and security boundaries.
- `src/core.ts` — browser-independent URL, settings, filename, timestamp, and screenshot geometry helpers.
- `src/popup.ts` and `src/options.ts` — extension UI behavior.
- `static/` — popup/options HTML and CSS; `static/icons/icon.svg` is the icon source of truth.
- `_locales/{en,pl,de}` — browser locale catalogs. Every user-facing key must exist in all three locales.
- `manifests/` — per-browser Manifest V3 inputs.
- `scripts/build.ts` — builds all browser targets, generates raster icons, syncs Safari resources, validates manifests, and creates ZIP packages.
- `PRIVACY.md` — authoritative English and Polish privacy policy linked from the README and store listings.
- `safari/YT Zero Enhance/` — checked-in containing-app/Xcode wrapper.
- `tests/` — Bun unit tests and browser UI preview fixtures.

## YT Zero pairing contract

- A signed-in YT Zero page inserts `#ytzero-enhance-configuration` as JSON inside `<body>` on every application route, not only watch pages.
- Pairing must work from any authenticated YT Zero page, including `/`, settings, history, plugin/future routes, and watch pages.
- In `src/popup.ts`, read and validate the embedded configuration before accepting an instance. The application manifest URL is used as the preferred base-URL hint.
- `inferInstanceUrl()` must retain support for an installation prefix such as `/apps/ytzero`, including when a reverse proxy exposes the app below a path.
- Do not trust configuration solely because an element has the expected ID. Always validate format, version, bridge version, events, and field shapes through the contract helpers.
- Pairing an instance requests optional host access only after the user initiates the action. Keep host permissions and origin matching as narrow as the browser APIs allow.
- Multiple instances are supported. Each page uses its matching instance/profile; only supported video-link redirects use the default instance.

## Embedded player interaction decisions

- A single click on the player surface toggles play/pause.
- A double-click anywhere on the iframe surface toggles fullscreen, except when the event comes from the custom controls. Do not depend on the upstream player's `.html5-video-player` class for the double-click target.
- Fullscreen must toggle both ways with the standard Fullscreen API and with Safari's native video fallback (`webkitEnterFullscreen` / `webkitExitFullscreen`).
- The custom control bar intentionally has no cinema button and no frame-capture button.
- The captions button opens a local-player-style menu with an on/off switch and the validated `player.captions.availableLanguages` catalog. Choosing a language must update the native caption track without reloading the iframe; use a narrowly validated background `scripting.executeScript` call in the frame's `MAIN` world.
- Treat the result of that player operation as the caption switch's source of truth. The hidden native `.ytp-subtitles-button` can keep reporting `aria-pressed="false"` while captions are visibly active, so it must not overwrite the custom control state.
- Keep `C` as the quick captions toggle and keep the selected language local to the current embedded player. The profile's default language remains owned by YT Zero.
- Frame capture functionality must remain available through the `S` shortcut, extension popup, background messages, and the `capture-frame` bridge command. Removing a controls button does not authorize removing capture logic.
- The `T` shortcut may request YT Zero theatre/cinema behavior on the containing application page even though there is no cinema button in the embedded controls.
- Keep keyboard shortcuts usable without focusing the embedded iframe first, subject to editable-target guards.
- Native upstream UI suppression must preserve video, captions, loading, and advertisement layers and tolerate both classic and experimental controls.

## Extension lifecycle and cross-browser behavior

- Treat an invalidated extension context as a teardown signal. Content scripts from an older extension build must remove controls/listeners instead of continuing with a dead runtime.
- Keep Chrome callback APIs and Firefox promise APIs behind the helpers in `src/webext.ts`.
- Messages crossing page/extension isolated worlds use validated JSON-string details. Preserve synchronous ownership/claim behavior for screenshot events.
- Avoid adding remotely hosted executable code; store packages must contain reviewable code.
- Keep Firefox `browser_specific_settings.gecko.data_collection_permissions.required` set to `["none"]`. AMO requires the declaration even though the extension does not collect or transmit data; the build check enforces it.
- Keep Firefox `strict_min_version` at 128 or newer while the manifest uses `optional_host_permissions`; this applies to desktop and the inherited Android minimum.
- Avoid `innerHTML` assignments in production extension code. AMO flags them even for controlled markup; construct UI nodes and replace trusted SVG children through DOM APIs instead.
- Public-facing copy must not use the upstream platform's brand name or mechanically substitute an abbreviation. Describe the behavior naturally with terms such as supported video links, embedded player, source site, or player hosts. Technical domains, manifest permissions, code identifiers, and selectors may retain their required literal values.

## Generated files and Safari

Do not hand-edit or commit generated output:

- `dist/`
- `artifacts/`
- `static/icons/icon-*.png`
- `safari/YT Zero Enhance/Shared (Extension)/Resources/`
- generated Safari app icon PNGs

Use `bun run build` to regenerate them. `bun run safari:project` replaces the generated Xcode wrapper, so use it only when converter-level project structure must change. Once Team/signing values are configured, normal builds should synchronize resources without overwriting signing state.

The logo must match the canonical app icon from `../ytzero/app/src/app-icon.ts`: color `#0a5fff`, the rounded play path, and the same 112/288 layout. Keep `static/icons/icon.svg` synchronized with `scripts/build.ts`; the build check enforces it and Resvg generates clean toolbar and app sizes.

Never commit certificates, private keys, provisioning profiles, archives, Xcode user data, or local signing state.

## Validation

Use Bun 1.3 or newer. Before handing off a change, run:

```bash
bun run check
```

This performs TypeScript checking, all Bun tests, all browser builds, locale validation, and manifest validation. Add or update a focused regression test for behavior changes. Keep UI preview fixtures consistent with production controls and onboarding copy.

For release packaging, run:

```bash
bun run package
```

The version in `package.json` and every `manifests/*.json` file must match. Artifact filenames derive from `package.json`.

## Documentation and repository policy

- README is the primary public guide and should remain suitable for an international audience.
- Do not copy or create a wiki in this repository.
- Keep manual installation instructions for Chromium, Edge, Firefox, Safari macOS, and Safari iPhone/iPad in README.
- Store badges remain commented out until their listings are public. Use official artwork and replace the placeholder listing URLs only after publication.
- Update `PRIVACY.md` for any data, permission, host-access, or disclosure change.
- Update `docs/embedded-player-compatibility.md` for browser/player limitations or workarounds.
- Preserve unrelated user changes in the worktree and do not stage, commit, or rewrite them unless asked.
