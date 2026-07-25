# Contributing to YT Zero Enhance

Thanks for helping improve YT Zero Enhance. This is a small companion project for the self-hosted [YT Zero](https://github.com/Pelski/ytzero) application, so contributions are welcome but kept focused.

For anything non-trivial, open an issue first. That gives us a chance to confirm the browser scope, permissions and UX before implementation work begins.

## Ways to contribute

- Report a reproducible browser or website compatibility bug.
- Suggest a focused improvement and explain the user problem it solves.
- Improve translations in every locale under `_locales/`.
- Submit a fix or an agreed feature through a pull request.

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or newer
- A Chromium-based browser and Firefox
- macOS and Xcode only when changing or testing the Safari wrapper

## Set up the project

```bash
git clone https://github.com/Pelski/ytzero-enhance.git
cd ytzero-enhance
bun install --frozen-lockfile
bun run check
```

Load a generated target from `dist/` using the manual browser instructions in [README.md](README.md). UI preview fixtures live in `tests/ui-preview-*.html`.

## Project layout

```text
_locales/   Browser translations
manifests/  Per-browser Manifest V3 files
safari/     macOS/iOS containing-app project
scripts/    Build and packaging tools
src/        TypeScript extension code and injected CSS
static/     Popup, options and icon source assets
tests/      Unit tests and UI preview fixtures
```

Generated `dist/`, `artifacts/`, Safari extension resources and raster icons are intentionally ignored. The SVG in `static/icons/icon.svg` is the icon source of truth.

## Before opening a pull request

Run the same command as CI:

```bash
bun run check
```

Also test the browsers affected by your change. For cross-browser code, test at least one Chromium browser and Firefox. Safari-specific changes should be tested in Safari; changes to the containing app should also be built in Xcode.

Keep these constraints in mind:

- Do not add remotely hosted executable code; extension stores require reviewable packaged code.
- Keep requested permissions as narrow as possible and explain any new permission in the PR.
- Preserve the trust boundary around paired YT Zero origins and embedded configuration.
- Add user-facing strings to every locale: English, Polish and German.
- Keep `package.json` and all `manifests/*.json` versions identical.
- Never commit signing certificates, provisioning profiles, private keys or Xcode user state.

## Pull request workflow

1. Branch from `main`.
2. Keep the change and commits focused.
3. Run `bun run check` and the relevant browser tests.
4. Open a pull request with the related issue, behavior change and verification steps.

Pull requests are squash-merged. By contributing, you agree that your contribution is licensed under `AGPL-3.0-only`, the same license as the project.
