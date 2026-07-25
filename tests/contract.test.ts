import { describe, expect, test } from "bun:test";
import {
  claimScreenshotRequest,
  captionsToggleRequestDetail,
  embeddedPlayerParameters,
  ENHANCE_BRIDGE_EVENTS,
  ENHANCE_PLAYER_EVENTS,
  frameStepSeconds,
  hostPermissionPattern,
  highestQualityAtOrBelow,
  installReadyBridge,
  isEditableShortcutTarget,
  playerPresentationState,
  validatePlayerCommand,
  validatePlayerEvent,
  validateEnhanceConfiguration,
  validateEnhanceContext,
} from "../src/contract";
import { defaultPairedInstance, inferInstanceUrl, instanceSettingsUrl, pairedInstanceForPage, parseEmbeddedConfigurationText, type PairedInstances } from "../src/instances";

const validConfiguration = (patch: Record<string, unknown> = {}) => ({
  format: "ytzero.enhance-configuration",
  version: 1,
  enabled: true,
  player: {
    replaceControls: true, language: "pl", preferredQuality: "auto", defaultPlaybackRate: 1,
    keyboardSeekSeconds: 5, frameStepFps: 30, autoFullscreenLandscape: false,
    captions: {
      enabledByDefault: false,
      language: "pl",
      availableLanguages: [
        { code: "en", label: "English" },
        { code: "pl", label: "Polski" },
        { code: "de", label: "Deutsch" },
        { code: "zh-Hans", label: "中文（简体）" },
      ],
      style: { fontSizePx: 19, color: "#ffffff", backgroundOpacityPercent: 75 },
    },
  },
  screenshots: { format: "png", jpegQuality: .92, filenameTemplate: "{channel}_{title}_{timestamp_ms}", templateFields: ["channel", "title"] },
  sponsorBlock: { enabled: true, categories: ["sponsor"] },
  bridge: { version: 1, detailEncoding: "json-string", events: ENHANCE_BRIDGE_EVENTS },
  ...patch,
});

describe("configuration contract", () => {
  test("accepts v1, clamps values and ignores unknown fields", () => {
    const input = validConfiguration({ secret: "must-not-survive" }) as any;
    input.player.frameStepFps = 999;
    input.player.captions.style.backgroundOpacityPercent = -20;
    input.player.captions.availableLanguages.push(null, { code: "fr" }, { code: 42, label: "Invalid" });
    const result = validateEnhanceConfiguration(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.frameStepFps).toBe(240);
    expect(result.value.player.captions.style.backgroundOpacityPercent).toBe(0);
    expect(result.value.player.captions.availableLanguages).toEqual([
      { code: "en", label: "English" },
      { code: "pl", label: "Polski" },
      { code: "de", label: "Deutsch" },
      { code: "zh-Hans", label: "中文（简体）" },
    ]);
    expect((result.value as any).secret).toBeUndefined();
  });

  test("rejects unknown format and a newer version", () => {
    const malformed = validateEnhanceConfiguration({ ...validConfiguration(), format: "other" });
    expect(malformed.ok).toBe(false);
    const newer = validateEnhanceConfiguration({ ...validConfiguration(), version: 2 });
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.unsupportedVersion).toBe(2);
  });

  test("builds the permission pattern for a reverse-proxy instance", () => {
    expect(hostPermissionPattern("https://home.test/apps/ytzero/")).toBe("https://home.test/*");
  });
});

describe("embedded DOM configuration and multiple instances", () => {
  test("parses the JSON script and infers an instance from every application route", () => {
    expect(parseEmbeddedConfigurationText(JSON.stringify(validConfiguration())).ok).toBe(true);
    expect(parseEmbeddedConfigurationText("<html>").ok).toBe(false);
    expect(inferInstanceUrl("https://yt.example/")).toBe("https://yt.example");
    expect(inferInstanceUrl("https://yt.example/settings?tab=player#quality")).toBe("https://yt.example");
    expect(inferInstanceUrl("https://yt.example/history")).toBe("https://yt.example");
    expect(inferInstanceUrl("https://yt.example/watch/dQw4w9WgXcQ")).toBe("https://yt.example");
    expect(inferInstanceUrl("https://home.test/apps/ytzero/watch/dQw4w9WgXcQ")).toBe("https://home.test/apps/ytzero");
    expect(inferInstanceUrl("https://home.test/apps/ytzero/settings")).toBe("https://home.test/apps/ytzero");
    expect(inferInstanceUrl("https://home.test/apps/ytzero/")).toBe("https://home.test/apps/ytzero");
    expect(inferInstanceUrl("https://yt.example/plugins/archive-view", "https://yt.example/manifest.webmanifest")).toBe("https://yt.example");
    expect(inferInstanceUrl("https://home.test/apps/ytzero/plugins/archive-view", "/apps/ytzero/manifest.webmanifest")).toBe("https://home.test/apps/ytzero");
    expect(inferInstanceUrl("https://yt.example/settings", "https://evil.example/manifest.webmanifest")).toBe("https://yt.example");
    expect(inferInstanceUrl("file:///Applications/YTZero/index.html")).toBeNull();
  });

  test("selects the matching instance and keeps one default", () => {
    const parsed = validateEnhanceConfiguration(validConfiguration());
    if (!parsed.ok) throw new Error("fixture");
    const instances: PairedInstances = {
      "https://home.test": { url: "https://home.test", name: "Home", configuration: parsed.value, pairedAt: 1, lastSeenAt: 1 },
      "https://home.test/apps/ytzero": { url: "https://home.test/apps/ytzero", name: "Family", configuration: parsed.value, pairedAt: 2, lastSeenAt: 2 },
    };
    expect(pairedInstanceForPage(instances, "https://home.test/apps/ytzero/watch/dQw4w9WgXcQ")?.name).toBe("Family");
    expect(defaultPairedInstance(instances, "https://home.test")?.name).toBe("Home");
    expect(instanceSettingsUrl("https://home.test/apps/ytzero")).toBe("https://home.test/apps/ytzero/settings?tab=display");
  });
});

test("shortcut focus guard and exact frame-step math", () => {
  expect(isEditableShortcutTarget({ tagName: "INPUT" })).toBe(true);
  expect(isEditableShortcutTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  expect(isEditableShortcutTarget({ tagName: "DIV", closest: () => null })).toBe(false);
  expect(frameStepSeconds(25)).toBe(.04);
  expect(frameStepSeconds(0)).toBe(1);
  expect(frameStepSeconds("bad")).toBe(1 / 30);
});

test("ready is dispatched only after the context listener is installed", () => {
  const order: string[] = [];
  const target = {
    addEventListener(name: string) { order.push(`listen:${name}`); },
    removeEventListener() {},
    dispatchEvent(event: Event) { order.push(`dispatch:${event.type}`); return true; },
  };
  installReadyBridge(target as any, (() => {}) as EventListener);
  expect(order).toEqual([`listen:${ENHANCE_BRIDGE_EVENTS.context}`, `dispatch:${ENHANCE_BRIDGE_EVENTS.ready}`]);
});

test("caption control emits a stable application event contract", () => {
  expect(ENHANCE_PLAYER_EVENTS.captionsToggleRequest).toBe("ytzero:enhance:captions-toggle-request");
  expect(captionsToggleRequestDetail("dQw4w9WgXcQ", false)).toEqual({
    version: 1, videoId: "dQw4w9WgXcQ", action: "toggle", currentEnabled: false, requestedEnabled: true,
  });
  expect(captionsToggleRequestDetail("dQw4w9WgXcQ", null)?.requestedEnabled).toBeNull();
  expect(captionsToggleRequestDetail("bad", false)).toBeNull();
});

test("validates bidirectional player commands and events", () => {
  expect(ENHANCE_PLAYER_EVENTS.command).toBe("ytzero:enhance:player-command");
  expect(ENHANCE_PLAYER_EVENTS.event).toBe("ytzero:enhance:player-event");
  expect(validatePlayerCommand({ version: 1, requestId: "req-1", videoId: "dQw4w9WgXcQ", command: "seek-by", payload: { seconds: 15 } })).toEqual({
    version: 1, requestId: "req-1", videoId: "dQw4w9WgXcQ", command: "seek-by", payload: { seconds: 15 },
  });
  expect(validatePlayerCommand({ version: 1, requestId: "req-2", videoId: "dQw4w9WgXcQ", command: "set-volume", payload: { volume: 8 } })?.payload.volume).toBe(1);
  expect(validatePlayerCommand({ version: 1, requestId: "", videoId: "dQw4w9WgXcQ", command: "play" })).toBeNull();
  expect(validatePlayerEvent({ version: 1, videoId: "dQw4w9WgXcQ", type: "shortcut", timestamp: 1, payload: { key: "k" } })?.type).toBe("shortcut");
  expect(validatePlayerEvent({ version: 1, videoId: "bad", type: "state", payload: {} })).toBeNull();
});

test("screenshot ownership is synchronous, cancelable and origin-bound", () => {
  let prevented = false;
  const event = {
    detail: JSON.stringify({
      version: 1,
      video: { id: "dQw4w9WgXcQ", title: "Film", channelTitle: "Kanał", seconds: 12.5 },
      screenshot: { format: "webp", quality: .8, filenameTemplate: "{title}_{timestamp_ms}" },
    }),
    preventDefault() { prevented = true; },
  };
  const request = claimScreenshotRequest(event, "https://yt.example/watch/dQw4w9WgXcQ", "https://yt.example");
  expect(prevented).toBe(true);
  expect(request?.screenshot.format).toBe("webp");
  prevented = false;
  expect(claimScreenshotRequest(event, "https://evil.example/watch/dQw4w9WgXcQ", "https://yt.example")).toBeNull();
  expect(prevented).toBe(false);
});

test("validates and normalizes per-video bridge context", () => {
  const context = validateEnhanceContext({
    version: 1, active: true,
    video: { id: "dQw4w9WgXcQ", title: "Film", channelId: "UC1", channelTitle: "Kanał", duration: 100 },
    playback: {
      rate: 1.5, keyboardSeekSeconds: 10, frameStepFps: 50,
      captions: { enabledByDefault: true, language: "pl", style: { fontSizePx: 21, color: "#ffffff", backgroundOpacityPercent: 80 } },
      chapters: [{ title: "Intro", start: 0 }],
      sponsorBlockSegments: [{ category: "sponsor", actionType: "skip", segment: [10, 20], UUID: "abc" }],
    },
    screenshot: { format: "png", quality: .9, filenameTemplate: "{title}" },
  });
  expect(context?.playback.rate).toBe(1.5);
  expect(context?.playback.sponsorBlockSegments[0]?.segment).toEqual([10, 20]);
});

test("disabled and reveal-native-controls states never hide YouTube controls", () => {
  const result = validateEnhanceConfiguration(validConfiguration());
  if (!result.ok) throw new Error("fixture");
  expect(playerPresentationState(true, true, result.value, false)).toEqual({ active: true, replaceControls: true });
  expect(playerPresentationState(true, true, result.value, true)).toEqual({ active: true, replaceControls: false });
  expect(playerPresentationState(false, true, result.value, false)).toEqual({ active: false, replaceControls: false });
  const disabled = validateEnhanceConfiguration(validConfiguration({ enabled: false }));
  if (!disabled.ok) throw new Error("fixture");
  expect(playerPresentationState(true, true, disabled.value, false)).toEqual({ active: false, replaceControls: false });
});

test("replacement player requests a control-free inline YouTube embed", () => {
  const result = validateEnhanceConfiguration(validConfiguration());
  if (!result.ok) throw new Error("fixture");
  expect(embeddedPlayerParameters(result.value)).toMatchObject({ controls: "0", disablekb: "1", playsinline: "1", iv_load_policy: "3" });
  result.value.player.replaceControls = false;
  expect(embeddedPlayerParameters(result.value)).toMatchObject({ controls: "1", disablekb: "0" });
});

test("chooses the highest available quality without exceeding the profile threshold", () => {
  const levels = ["hd2160", "hd1080", "hd720", "medium"];
  expect(highestQualityAtOrBelow(levels, "auto")).toBe("hd2160");
  expect(highestQualityAtOrBelow(levels, "hd1440")).toBe("hd1080");
  expect(highestQualityAtOrBelow(levels, "hd720")).toBe("hd720");
  expect(highestQualityAtOrBelow(["medium"], "hd1080")).toBe("medium");
  expect(highestQualityAtOrBelow([], "hd1080")).toBeNull();
});
