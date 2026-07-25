# Security Policy

YT Zero Enhance is maintained in spare time. Security reports are taken seriously, but there is no service-level agreement and fixes are released on a best-effort basis.

## Supported versions

Only the latest code on `main` and the latest published store version are supported. Please reproduce an issue on the newest available version before reporting it.

## Report a vulnerability

**Do not open a public issue for a suspected vulnerability.**

Use GitHub's [private vulnerability reporting](https://github.com/Pelski/ytzero-enhance/security/advisories/new). Include:

- the affected version or commit and browser version;
- clear reproduction steps and security impact;
- the affected origin or page type, with secrets removed;
- a proof of concept when it can be shared safely.

## Security scope

Reports are particularly useful for:

- executing extension-privileged actions from an untrusted page or frame;
- bypassing paired-origin or message-origin validation;
- leaking paired instance data, profile configuration or captured frames;
- redirecting to an unintended host or accepting a spoofed YT Zero instance;
- cross-site scripting or injection in the popup, options page or injected UI;
- permission escalation beyond what the user approved.

Expected behavior that is normally out of scope:

- YouTube, browser or operating-system restrictions on playback, fullscreen, screenshots, DRM, ads or region access;
- an administrator-controlled browser policy changing extension behavior;
- data visible to another user who already controls the same browser profile;
- a deliberately granted host permission allowing the extension to run on that host;
- limitations already documented in README.md or the compatibility matrix without a separate security impact.

When unsure, report privately and we can assess it together.
