import { expect, test } from "bun:test";

const css = await Bun.file(new URL("../src/player.css", import.meta.url)).text();
const content = await Bun.file(new URL("../src/content.ts", import.meta.url)).text();
const background = await Bun.file(new URL("../src/background.ts", import.meta.url)).text();

test("replacement CSS structurally removes native player layers", () => {
  expect(css).toContain("html.ytze-replace-controls .html5-video-player >");
  expect(css).toContain(":not(video)");
  expect(css).toContain(":not(.html5-video-container)");
  expect(css).toContain(":not(#ytp-caption-window-container)");
  expect(css).toContain(":not(.ytp-spinner)");
  expect(css).toContain(":not([class*=\"ytp-ad-\"])");
});

test("player CSS is inserted only after the parent tab is authorized as paired", () => {
  expect(background).toContain('message?.type === "ytze-authorize-player-frame"');
  expect(background).toContain('ext.scripting, "insertCSS"');
  expect(background.indexOf("await pairedPlayerFrame(message, sender)")).toBeLessThan(background.indexOf('ext.scripting, "insertCSS"'));
  expect(content.indexOf('type: "ytze-authorize-player-frame"')).toBeLessThan(content.indexOf("playerController = enhanceYouTubePlayer(video)"));
});

test("replacement CSS covers both classic and experimental embedded controls", () => {
  expect(css).toContain(".ytp-chrome-bottom");
  expect(css).toContain(".ytwPlayerMiddleControlsHost");
  expect(css).toContain("[class*=\"ytwPlayer\"][class*=\"Controls\"]");
  expect(css).toContain(".player-controls-bottom");
  expect(css).toContain("player-fullscreen-action-menu");
  expect(css).toContain("yt-sheet-view-model");
});

test("the custom control bar omits cinema and capture buttons without removing their commands", () => {
  expect(content).not.toContain('class="cinema"');
  expect(content).not.toContain('class="capture"');
  expect(content).toContain('key === "s"');
  expect(content).toContain('command.command === "capture-frame"');
  expect(content).toContain('type: "ytze-player-event"');
  expect(content).toContain('emitPlayerEvent("captions-toggle-request"');
  expect(content).toContain("ENHANCE_PLAYER_EVENTS.captionsToggleRequest");
});

test("double-click toggles fullscreen across the iframe surface", () => {
  const handler = content.slice(content.indexOf("const onSurfaceDoubleClick"), content.indexOf("play.addEventListener"));
  expect(handler).toContain('target.closest("#ytze-player-controls")');
  expect(handler).not.toContain('target.closest(".html5-video-player")');
  expect(handler).toContain("toggleFullscreen()");
  expect(content).toContain("safariVideo.webkitExitFullscreen?.()");
});

test("caption control opens a language menu and applies the selection in YouTube", () => {
  expect(content).toContain('create("div", "caption-menu")');
  expect(content).toContain('create("button", "caption-switch")');
  expect(content).toContain("availableLanguages");
  expect(content).toContain('type: "ytze-set-youtube-captions"');
  expect(content).toContain("setCaptionMenuOpen(!captionMenuOpen)");
  expect(background).toContain('world: "MAIN"');
  expect(background).toContain("operateYouTubeCaptions");
});

test("production content avoids innerHTML assignments rejected by AMO", () => {
  expect(content).not.toContain(".innerHTML");
  expect(content).toContain("button.replaceChildren");
});

test("extension teardown restores iframe parameters owned by the bridge", () => {
  expect(content).toContain("ownedIframeParameters");
  expect(content).toContain("restoreEmbeddedParameters()");
  expect(content).toContain("onExtensionContextInvalidated(() => shutdown(true))");
  expect(content).toContain("window.setInterval(extensionContextAvailable, 2_000)");
  expect(content).toContain("url.searchParams.get(key) !== value.applied");
  expect(content).toContain('setAttribute("data-extension-status", "inactive")');
});

test("player icons are created as SVG namespace elements", () => {
  expect(content).toContain('document.createElementNS(SVG_NAMESPACE, "svg")');
  expect(content).toContain('document.createElementNS(SVG_NAMESPACE, tag)');
  expect(content).not.toContain("new DOMParser()");
});

test("caption switch tracks the result of player operations instead of hidden YouTube controls", () => {
  expect(content).toContain("captionsEnabled = response.enabled");
  expect(content).toContain("const captionsAreEnabled = () => captionsEnabled");
  expect(content).toContain("setYouTubeCaptions(!captionsAreEnabled())");
  expect(content).toContain("captionOperationQueue.then(operation, operation)");
  expect(content).toContain("scheduleCaptionDefaults(800)");
  expect(content).not.toContain("window.setTimeout(() => void setYouTubeCaptions(context.playback.captions.enabledByDefault");
});

test("live and short-form players receive purpose-built controls", () => {
  expect(content).toContain('classList.toggle("mode-live"');
  expect(content).toContain('classList.toggle("mode-shorts"');
  expect(content).toContain('create("button", "live-edge")');
  expect(content).toContain("liveSeekRange()");
  expect(content).toContain('playerMode === "live" && (key === "," || key === ".")');
  expect(content).toContain(":host(.mode-shorts) .controls");
  expect(content).toContain(":host(.mode-shorts) .volume");
  expect(content).toContain(":host(.mode-live) .time");
  expect(background).toContain('"ytze-authorize-player-frame"');
  expect(background).toContain("embeddedPlayerModeForPage");
  expect(background).toContain("getVideoData?.()?.isLive");
  expect(content).toContain('"previous-short"');
  expect(content).toContain('"next-short"');
  expect(content).toContain('key: "shorts-prev"');
  expect(content).toContain('key: "shorts-next"');
  expect(content).toContain("setContentType(context.video.contentType");
  expect(content).toContain("contentTypeAuthoritative");
  expect(content).toContain("set-playback-rate is unavailable for livestreams");
  expect(content).toContain("env(safe-area-inset-bottom");
  expect(content).toContain(".live-edge.active .live-dot { animation: none; }");
  expect(content).toContain('if (playerMode !== "shorts") showControls()');
  expect(content).toContain('if (requestedPlayerMode === "shorts")');
  expect(content).toContain(":host(.mode-shorts):not(.visible) .big-play");
});
