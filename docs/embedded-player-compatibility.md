# Embedded player compatibility audit

Issue tracker status reviewed on July 25, 2026. All public issues in the YT Zero repository were reviewed; the table below lists those related to differences between the external iframe and the local player or those that directly affect the extension.

| Issue | Iframe limitation compared with the local player | Handling in YT Zero Enhance |
|---|---|---|
| [#68](https://github.com/Pelski/ytzero/issues/68) | No `,` / `.` frame stepping | Added; intervals are measured with `requestVideoFrameCallback`, with the configured FPS as a fallback. VFR remains an approximation. |
| [#67](https://github.com/Pelski/ytzero/issues/67) | No raw iframe frame capture | Added rendered-frame capture using `captureVisibleTab` and cropping. Raw source resolution remains available only from the local `<video>`. |
| [#52](https://github.com/Pelski/ytzero/issues/52) | Cursor remains visible in iframe fullscreen | The extension hides its control bar and cursor after 2.6 seconds without movement during playback. |
| [#51](https://github.com/Pelski/ytzero/issues/51) | Keyboard input leaves native controls visible | Custom controls use an independent timer; the native control bar can remain hidden. |
| [#37](https://github.com/Pelski/ytzero/issues/37) | PiP is unavailable from the iframe context menu | A direct `requestPictureInPicture` button is provided when the browser and OS permit it. |
| [#27](https://github.com/Pelski/ytzero/issues/27) | The parent application cannot style a cross-origin player | A content script runs inside the iframe and adds the YT Zero skin and control bar. |
| [#25](https://github.com/Pelski/ytzero/issues/25) | Shortcuts do not work before the iframe receives focus | Shortcuts are registered inside the frame as soon as the `<video>` element is detected. |
| [#61](https://github.com/Pelski/ytzero/issues/61), [#55](https://github.com/Pelski/ytzero/issues/55) | The application's up-next overlay is hidden by native player fullscreen | After `ended`, the extension asks the parent page to exit fullscreen. YT Zero still owns autoplay and feed behavior. |
| [#38](https://github.com/Pelski/ytzero/issues/38) | LibreWolf removes the referrer and the service rejects the embed | Not fixed at the expense of global privacy. Allow the referrer in LibreWolf or use the local player. |
| [#22](https://github.com/Pelski/ytzero/issues/22) | “Sign in to confirm you're not a bot” | Outside the extension's scope; possible workarounds include changing IP/VPN, using an authenticated source-site session, or using yt-dlp/local playback. |
| [#64](https://github.com/Pelski/ytzero/issues/64) | Background playback on Android | Best effort through YT Zero's existing Media Session. The extension cannot bypass OS suspension of an iframe. |
| [#23](https://github.com/Pelski/ytzero/issues/23) | Automatic fullscreen on iOS/Safari | Platform limitation; the extension does not create user activation or bypass Apple policy. |
| [#8](https://github.com/Pelski/ytzero/issues/8) | Playback speed is reset by the player | The bridge supplies the effective profile or per-channel speed, and the extension restores it after a player reset. |
| [#60](https://github.com/Pelski/ytzero/issues/60), [#41](https://github.com/Pelski/ytzero/issues/41) | Local/shareable links | Redirects turn private clicks into `/watch/:id`; they do not create public anonymous share tokens, which require a secure server-side feature. |
| [#15](https://github.com/Pelski/ytzero/issues/15) | Browser tab titles are difficult to distinguish | Fixed in YT Zero; the extension uses the title and channel only when naming a captured frame. |

## Local-player features intentionally not emulated by the extension

- direct image export at `videoWidth × videoHeight`;
- local WebVTT subtitles; the extension uses native tracks from the external player, while providing a local-player-style language menu and synchronized size, color, and background settings;
- chapter descriptions in a separate panel; the extension shows chapter ticks and SponsorBlock segments on the timeline;
- guaranteed programmatic stream-quality control; the extension supplies `vq` and retries the highest level within the profile limit through the internal player, but the platform retains its adaptive algorithm and may change this mechanism;
- offline playback and seeking within a local file;
- full Media Session and background-playback control;
- removal of advertisements, end screens, and links imposed by the platform.

When control replacement is active, `controls=0` and `disablekb=1` are only additional URL hints; the extension does not depend on the player honoring them. CSS running inside the iframe hides direct `.html5-video-player` layers except the video container, captions, loading indicator, and advertisement labels and controls. Separate selectors cover both classic UI portals and newer variants (`ytwPlayer…`, `player-controls-*`, settings menus, and fullscreen recommendations), including elements mounted outside the usual player layer tree.

The player stylesheet is not a static manifest injection. Before inserting it or creating custom controls, the background validates the exact embedded frame and confirms that its parent tab matches an enabled paired instance. Ordinary embeds on unrelated sites remain untouched.

### Content-specific control modes

YT Zero supplies the semantic presentation through validated `context.video.contentType`. The extension applies `default`, `short`, and `livestream` changes in place. Older application builds fall back to the `/shorts` route and native active-broadcast detection; aspect ratio is never used to classify content.

The replacement UI has three presentations:

- **standard** keeps the complete timeline, volume slider, elapsed/duration label, captions, PiP and fullscreen;
- **live** uses the current seekable DVR window instead of the non-finite media duration, clamps its end to buffered or already observed playable media so the timeline cannot seek into a manifest's unavailable future edge, shows a live-edge action with the current delay, keeps playback at 1× and disables frame stepping and hold-for-2×;
- **shorts** uses compact circular controls and a thinner timeline for a vertical viewport, while hiding the expanded volume slider, time label and PiP button. Controls start hidden and are revealed only by pointer movement or a click/tap, never by autoplay, pause, initialization, or a context change while scrolling. When the iframe has focus, Up/Down is forwarded to YT Zero's previous/next short-form navigation instead of changing volume.

Shorts mode is derived from the authenticated paired page's `/shorts` route. Live mode is verified inside the exact embedded frame through a narrow `MAIN`-world player-state probe, with media duration and the native live class retained as fallbacks. No additional permission is required.

## Bidirectional player bridge

Communication uses two DOM events on the paired instance's top-level `document`. The `detail` value is always a JSON string because the application and extension content script run in isolated JavaScript worlds.

- iframe → application: `ytzero:enhance:player-event`;
- application → iframe: `ytzero:enhance:player-command`.

Player events share this envelope:

```json
{
  "version": 1,
  "videoId": "dQw4w9WgXcQ",
  "type": "state",
  "timestamp": 1785012300000,
  "payload": {}
}
```

Supported event types:

- `ready` — the player is ready; `payload.state` contains the initial snapshot;
- `state` — a snapshot after play/pause, volume, speed, fullscreen/PiP, or a command, and at most once per second during playback;
- `shortcut` — a handled shortcut with its `key`, `code`, logical `action`, `repeat` state, and modifiers;
- `captions-toggle-request` — a quick caption toggle requested by `C`; the caption button opens its own language menu and controls the embedded player directly;
- `ended` — playback ended;
- `command-result` — a command result correlated by `payload.requestId`.

The `state` snapshot contains `paused`, `ended`, `currentTime`, `duration`, `volume`, `muted`, `playbackRate`, `captionSize`, `captionsEnabled`, `fullscreen`, and `pictureInPicture`.

Application command:

```json
{
  "version": 1,
  "requestId": "unique-request-id",
  "videoId": "dQw4w9WgXcQ",
  "command": "seek-by",
  "payload": { "seconds": 15 }
}
```

Supported commands:

| Command | Payload |
|---|---|
| `play`, `pause`, `toggle-play` | `{}` |
| `seek-by`, `seek-to` | `{ "seconds": number }` |
| `set-volume` | `{ "volume": 0..1 }` |
| `set-muted`, `set-captions` | `{ "enabled": boolean }` |
| `toggle-muted`, `toggle-captions` | `{}` |
| `set-playback-rate` | `{ "rate": 0.25..4 }` |
| `set-caption-size` | `{ "pixels": 12..48 }` |
| `capture-frame` | `{}` |
| `toggle-fullscreen`, `enter-fullscreen`, `exit-fullscreen` | `{}` |
| `request-state` | `{}` |

The `C` shortcut retains the compatible `ytzero:enhance:captions-toggle-request` event. It includes `currentEnabled` and `requestedEnabled`. The CC button opens a local-player-style menu: its switch enables or disables captions, and the language list comes from `player.captions.availableLanguages`. At runtime, the extension waits for the player's caption module, selects an exact native track when available, or intersects the requested language with `translationLanguages` and translates a translatable base track. Known player aliases such as `he`/`iw` are normalized. Caption operations are serialized, the profile default is applied once, and later context refreshes do not overwrite a user choice in the current player.

## Regression scenarios

Test at least:

1. `youtube.com/embed/:id` and `youtube-nocookie.com/embed/:id` iframes on another domain;
2. an iframe created dynamically by the IFrame Player API in YT Zero;
3. normal, theatre, and fullscreen player layouts;
4. PNG, JPEG, and WebP at DPR 1 and DPR 2;
5. 16:9, portrait, and letterboxed videos;
6. two embeds on one page, capturing the active or visible player;
7. preferred quality, captions through `C`, the language menu with exact and translated tracks, caption resizing, and collapsible volume controls;
8. standard, live/DVR and shorts control modes, including live-edge seeking, disabled live frame stepping and compact vertical controls;
9. `watch` with and without playlist context, `shorts`, `live`, `youtu.be`, `/playlist?list=…`, and legacy `/show/VL…` navigation, timestamps, and an instance installed below a path prefix;
10. manual popup redirects for video, public-playlist, direct channel-ID, and handle-based channel pages;
11. disabled redirects, the `#ytNoRedirect` escape marker, and the `Alt+Shift+Y` shortcut;
12. Chrome, Edge, Brave, and Firefox, including strict tracking protection;
13. pairing root and reverse-proxy instances, DOM configuration, profile changes, and default-instance switching;
14. a screenshot request from YT Zero, synchronous `preventDefault()`, and the `saved`/`error` result.
