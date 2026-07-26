# Store release guide

## Common checklist

1. Update the version in `package.json` and every `manifests/*.json` file.
2. Run `bun run check` and the manual scenarios in `embedded-player-compatibility.md`.
3. Pair a test instance from an authenticated video page and confirm that the extension reads the embedded DOM configuration.
4. Run `bun run package`.
5. Extract every ZIP and confirm that packages contain no source files, source maps, test data, or secrets.
6. Prepare settings and player screenshots in the sizes required by each store.
7. Use the public URL of `PRIVACY.md` as the privacy-policy URL.
8. Explain the required embedded-player hosts and optional paired-instance access using the text below.

## GitHub Release

After approving the changes, create and push a tag matching the version in `package.json`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `.github/workflows/release.yml` workflow runs the complete check, builds every target, and attaches the archives from `artifacts/` to the GitHub Release. If a release already exists for the tag, its description is preserved and its archives are replaced with the current build.

## Chrome Web Store / Edge Add-ons

Upload `ytzero-enhance-chromium-<version>.zip`. Use this single-purpose declaration: “Redirect supported video links to a user-configured self-hosted YT Zero instance and enhance embedded player controls.”

Host-permission justification: “The extension needs access to supported embed origins to enhance their controls. Access to HTTP/HTTPS pages is optional and requested only when the user pairs an authenticated self-hosted YT Zero page. It reads the safe configuration embedded in that page and locates the iframe for an explicitly requested screenshot. Data is processed locally and never transmitted.”

Do not claim advertisement, geoblocking, or authentication bypass. Describe screenshots as capture of the rendered embedded video, not source-frame extraction.

## Firefox Add-ons (AMO)

Upload `ytzero-enhance-firefox-<version>.zip`. AMO may also request sources for a reproducible build; provide the repository without `dist/` and include the `bun run package` instruction. The Gecko ID is fixed at `ytzero-enhance@pelski.dev`. Change it before the first publication if a different domain or identifier is required, then keep it stable.

## Safari on macOS and iOS/iPadOS

1. Use `safari/YT Zero Enhance/YT Zero Enhance.xcodeproj`. `bun run safari:project` recreates the wrapper from scratch and overwrites its configuration; a normal `bun run build` updates resources without changing Team or signing settings.
2. Open the project and configure the Apple Developer Team, signing, App Groups if requested by Xcode, and final bundle identifiers.
3. Build both schemes and test on macOS and a physical iPhone or iPad.
4. Prepare the listing and privacy policy in App Store Connect.
5. Create an archive separately for each required destination and upload the build through Organizer.

Safari 17+ requires explicit user approval for website access. On iOS, access is managed in Safari settings and the extensions menu. Embedded-player capture remains best effort: if iOS does not expose visible-tab capture or a protected video layer produces a black image, the local YT Zero player is the only reliable path.

## Owner tasks before the first release

- confirm the final repository license;
- provide a public privacy-policy URL and contact address;
- provide the publisher name and promotional artwork;
- test on a physical Android device with Firefox and on an iPhone or iPad if mobile platforms will be officially supported;
- sign the Firefox extension and review store warnings related to optional host permissions.
