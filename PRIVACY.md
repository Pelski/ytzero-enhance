# Privacy policy

Effective date: July 26, 2026

YT Zero Enhance does not collect, transmit to the developer, sell, share, or monetize personal data. The extension contains no analytics, advertising, telemetry, tracking, external backend, or remotely hosted executable code.

## Data stored by the extension

The extension stores only the information needed to provide its features:

- extension preferences and the default instance address in browser-managed `storage.sync`;
- connected instance addresses and the last valid player configuration in browser-managed `storage.local`.

This information remains under the browser's control. Depending on the user's browser-account settings, values in `storage.sync` may be synchronized between their devices by the browser vendor. The extension developer cannot access this information.

The player configuration contains presentation preferences such as playback speed, captions, quality, shortcuts, and screenshot settings. It does not contain profile identity, credentials, authentication secrets, private viewing history, or account data.

## Frame capture

When the user explicitly requests a frame capture, the browser creates an image of the visible tab. The extension crops that image locally in memory, starts a local file download, and releases the temporary image. Captures are never uploaded or transmitted.

## Network access

The extension communicates only with:

- the self-hosted YT Zero instance selected and connected by the user;
- supported player hosts as part of a page or embedded player opened by the user.

It does not send usage information, diagnostics, browsing history, player activity, or captured images to the developer or any analytics service.

## Permissions

- `storage` saves extension preferences and connected instances.
- `webNavigation` recognizes supported video links selected by the user.
- `activeTab` performs a user-requested action in the active tab.
- Required player-host access provides enhanced controls inside supported embedded players.
- Optional HTTP/HTTPS host access is requested only for an instance explicitly connected by the user. It is used to read the safe configuration exposed by that instance and locate its embedded player.

## Changes and contact

Any material change to this policy will be published in this repository before it is included in a release. Source code and issue tracking are available at [Pelski/ytzero-enhance](https://github.com/Pelski/ytzero-enhance). The main project is available at [Pelski/ytzero](https://github.com/Pelski/ytzero).
