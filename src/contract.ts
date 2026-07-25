export const ENHANCE_CONFIGURATION_FORMAT = "ytzero.enhance-configuration";
export const ENHANCE_CONFIGURATION_VERSION = 1;
export const ENHANCE_BRIDGE_VERSION = 1;

export const ENHANCE_BRIDGE_EVENTS = {
  ready: "ytzero:enhance:ready",
  context: "ytzero:enhance:context",
  screenshotRequest: "ytzero:enhance:screenshot-request",
  screenshotResult: "ytzero:enhance:screenshot-result",
} as const;

export const ENHANCE_PLAYER_EVENTS = {
  captionsToggleRequest: "ytzero:enhance:captions-toggle-request",
  event: "ytzero:enhance:player-event",
  command: "ytzero:enhance:player-command",
} as const;

export const ENHANCE_PLAYER_COMMANDS = [
  "play", "pause", "toggle-play", "seek-by", "seek-to", "set-volume", "set-muted", "toggle-muted",
  "set-playback-rate", "set-captions", "toggle-captions", "set-caption-size", "capture-frame",
  "toggle-fullscreen", "enter-fullscreen", "exit-fullscreen", "request-state",
] as const;

export type EnhancePlayerCommandName = typeof ENHANCE_PLAYER_COMMANDS[number];

export type ScreenshotFormat = "png" | "jpeg" | "webp";

export interface CaptionStyle {
  fontSizePx: number;
  color: string;
  backgroundOpacityPercent: number;
}

export interface EnhanceConfiguration {
  format: typeof ENHANCE_CONFIGURATION_FORMAT;
  version: typeof ENHANCE_CONFIGURATION_VERSION;
  enabled: boolean;
  player: {
    replaceControls: boolean;
    language: string;
    preferredQuality: string;
    defaultPlaybackRate: number;
    keyboardSeekSeconds: number;
    frameStepFps: number;
    autoFullscreenLandscape: boolean;
    captions: { enabledByDefault: boolean; language: string; style: CaptionStyle };
  };
  screenshots: {
    format: ScreenshotFormat;
    jpegQuality: number;
    filenameTemplate: string;
    templateFields: string[];
  };
  sponsorBlock: { enabled: boolean; categories: string[] };
  bridge: {
    version: typeof ENHANCE_BRIDGE_VERSION;
    detailEncoding: "json-string";
    events: typeof ENHANCE_BRIDGE_EVENTS;
  };
}

export interface EnhanceContext {
  version: 1;
  active: true;
  video: { id: string; title: string; channelId: string; channelTitle: string; duration: number };
  playback: {
    rate: number;
    keyboardSeekSeconds: number;
    frameStepFps: number;
    captions: { enabledByDefault: boolean; language: string; style: CaptionStyle };
    chapters: Array<{ title: string; start: number }>;
    sponsorBlockSegments: Array<{ category: string; actionType: string; segment: [number, number]; UUID: string }>;
  };
  screenshot: { format: ScreenshotFormat; quality: number; filenameTemplate: string };
}

export interface BridgeScreenshotRequest {
  version: 1;
  video: { id: string; title: string; channelTitle: string; seconds: number };
  screenshot: { format: ScreenshotFormat; quality: number; filenameTemplate: string };
}

export interface CaptionsToggleRequestDetail {
  version: 1;
  videoId: string;
  action: "toggle";
  currentEnabled: boolean | null;
  requestedEnabled: boolean | null;
}

export interface EnhancePlayerCommand {
  version: 1;
  requestId: string;
  videoId: string;
  command: EnhancePlayerCommandName;
  payload: Record<string, unknown>;
}

export interface EnhancePlayerEvent {
  version: 1;
  videoId: string;
  type: "ready" | "state" | "shortcut" | "captions-toggle-request" | "ended" | "command-result";
  timestamp: number;
  payload: Record<string, unknown>;
}

export type ConfigurationValidation =
  | { ok: true; value: EnhanceConfiguration }
  | { ok: false; diagnostic: string; unsupportedVersion?: number };

export function playerPresentationState(localEnabled: boolean, localReplaceControls: boolean, configuration: EnhanceConfiguration | null, nativeControlsVisible: boolean) {
  const active = localEnabled && configuration?.enabled === true;
  return { active, replaceControls: active && localReplaceControls && configuration.player.replaceControls && !nativeControlsVisible };
}

export function embeddedPlayerParameters(configuration: EnhanceConfiguration): Record<string, string> {
  return {
    hl: configuration.player.language,
    controls: configuration.player.replaceControls ? "0" : "1",
    disablekb: configuration.player.replaceControls ? "1" : "0",
    iv_load_policy: "3",
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
  };
}

export const PLAYBACK_QUALITY_ORDER = ["highres", "hd4320", "hd2880", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];

export function highestQualityAtOrBelow(available: unknown, maximum: string): string | null {
  if (!Array.isArray(available)) return null;
  const levels = available.filter((value): value is string => typeof value === "string" && PLAYBACK_QUALITY_ORDER.includes(value));
  if (!levels.length) return null;
  const maximumIndex = maximum === "auto" ? 0 : PLAYBACK_QUALITY_ORDER.indexOf(maximum);
  const threshold = maximumIndex < 0 ? 0 : maximumIndex;
  return PLAYBACK_QUALITY_ORDER.slice(threshold).find((quality) => levels.includes(quality)) ?? null;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const QUALITY = /^[A-Za-z0-9_-]{1,32}$/;

const object = (value: unknown): Record<string, any> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;

export function captionsToggleRequestDetail(videoId: unknown, currentEnabled: unknown): CaptionsToggleRequestDetail | null {
  if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) return null;
  const current = typeof currentEnabled === "boolean" ? currentEnabled : null;
  return { version: 1, videoId, action: "toggle", currentEnabled: current, requestedEnabled: current == null ? null : !current };
}

export function validatePlayerCommand(value: unknown): EnhancePlayerCommand | null {
  const root = object(value);
  if (root?.version !== 1 || typeof root.requestId !== "string" || !root.requestId.trim() || root.requestId.length > 120 || typeof root.videoId !== "string" || !VIDEO_ID.test(root.videoId) || !ENHANCE_PLAYER_COMMANDS.includes(root.command)) return null;
  const input = object(root.payload) ?? {};
  let payload: Record<string, unknown> = {};
  if (root.command === "seek-by" || root.command === "seek-to") payload = { seconds: finite(input.seconds, 0, -86_400 * 30, 86_400 * 30) };
  else if (root.command === "set-volume") payload = { volume: finite(input.volume, 1, 0, 1) };
  else if (root.command === "set-muted" || root.command === "set-captions") payload = { enabled: input.enabled === true };
  else if (root.command === "set-playback-rate") payload = { rate: finite(input.rate, 1, .25, 4) };
  else if (root.command === "set-caption-size") payload = { pixels: finite(input.pixels, 19, 12, 48) };
  return { version: 1, requestId: root.requestId.trim(), videoId: root.videoId, command: root.command, payload };
}

export function validatePlayerEvent(value: unknown): EnhancePlayerEvent | null {
  const root = object(value);
  const types = ["ready", "state", "shortcut", "captions-toggle-request", "ended", "command-result"];
  if (root?.version !== 1 || typeof root.videoId !== "string" || !VIDEO_ID.test(root.videoId) || typeof root.type !== "string" || !types.includes(root.type)) return null;
  return { version: 1, videoId: root.videoId, type: root.type as EnhancePlayerEvent["type"], timestamp: finite(root.timestamp, Date.now(), 0, Number.MAX_SAFE_INTEGER), payload: object(root.payload) ?? {} };
}
const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const text = (value: unknown, fallback: string, max = 200) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
const format = (value: unknown, fallback: ScreenshotFormat = "png"): ScreenshotFormat => value === "jpeg" || value === "webp" || value === "png" ? value : fallback;
const style = (value: unknown): CaptionStyle => {
  const input = object(value) ?? {};
  return {
    fontSizePx: finite(input.fontSizePx, 19, 12, 48),
    color: typeof input.color === "string" && COLOR.test(input.color) ? input.color : "#ffffff",
    backgroundOpacityPercent: finite(input.backgroundOpacityPercent, 75, 0, 100),
  };
};

export function configuredPageMatches(pageUrl: string, instanceUrl: string): boolean {
  try {
    const page = new URL(pageUrl);
    const instance = new URL(instanceUrl);
    const prefix = instance.pathname.replace(/\/$/, "");
    return page.origin === instance.origin && (page.pathname === prefix || page.pathname.startsWith(`${prefix}/`));
  } catch { return false; }
}

export function hostPermissionPattern(instanceUrl: string): string | null {
  try {
    const url = new URL(instanceUrl);
    return /^https?:$/.test(url.protocol) ? `${url.origin}/*` : null;
  } catch { return null; }
}

export function validateEnhanceConfiguration(value: unknown): ConfigurationValidation {
  const root = object(value);
  if (!root || root.format !== ENHANCE_CONFIGURATION_FORMAT) return { ok: false, diagnostic: t("unknownConfigurationFormat") };
  const version = Number(root.version);
  if (!Number.isInteger(version) || version < 1) return { ok: false, diagnostic: t("invalidConfigurationVersion") };
  if (version > ENHANCE_CONFIGURATION_VERSION) return { ok: false, diagnostic: `${t("newerExtensionRequired")} (v${version})`, unsupportedVersion: version };
  const player = object(root.player) ?? {};
  const captions = object(player.captions) ?? {};
  const screenshots = object(root.screenshots) ?? {};
  const sponsorBlock = object(root.sponsorBlock) ?? {};
  const bridge = object(root.bridge) ?? {};
  if (bridge.version !== 1 || bridge.detailEncoding !== "json-string") return { ok: false, diagnostic: t("unsupportedBridge") };
  const eventInput = object(bridge.events) ?? {};
  if (Object.entries(ENHANCE_BRIDGE_EVENTS).some(([key, name]) => eventInput[key] !== name)) return { ok: false, diagnostic: t("incompatibleBridgeEvents") };
  return { ok: true, value: {
    format: ENHANCE_CONFIGURATION_FORMAT,
    version: 1,
    enabled: root.enabled === true,
    player: {
      replaceControls: player.replaceControls === true,
      language: text(player.language, "en", 16),
      preferredQuality: typeof player.preferredQuality === "string" && QUALITY.test(player.preferredQuality) ? player.preferredQuality : "auto",
      defaultPlaybackRate: finite(player.defaultPlaybackRate, 1, .25, 4),
      keyboardSeekSeconds: finite(player.keyboardSeekSeconds, 5, 1, 120),
      frameStepFps: finite(player.frameStepFps, 30, 1, 240),
      autoFullscreenLandscape: player.autoFullscreenLandscape === true,
      captions: {
        enabledByDefault: captions.enabledByDefault === true,
        language: text(captions.language, text(player.language, "en", 16), 16),
        style: style(captions.style),
      },
    },
    screenshots: {
      format: format(screenshots.format),
      jpegQuality: finite(screenshots.jpegQuality, .92, .1, 1),
      filenameTemplate: text(screenshots.filenameTemplate, "{channel}_{title}_{timestamp_ms}", 300),
      templateFields: Array.isArray(screenshots.templateFields) ? screenshots.templateFields.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
    },
    sponsorBlock: {
      enabled: sponsorBlock.enabled === true,
      categories: Array.isArray(sponsorBlock.categories) ? sponsorBlock.categories.filter((item): item is string => typeof item === "string" && item.length <= 40).slice(0, 20) : [],
    },
    bridge: { version: 1, detailEncoding: "json-string", events: ENHANCE_BRIDGE_EVENTS },
  }};
}

export function validateEnhanceContext(value: unknown): EnhanceContext | null {
  const root = object(value), video = object(root?.video), playback = object(root?.playback), captions = object(playback?.captions), screenshot = object(root?.screenshot);
  if (root?.version !== 1 || root.active !== true || !video || !VIDEO_ID.test(String(video.id ?? "")) || !playback || !captions || !screenshot) return null;
  const chapters = Array.isArray(playback.chapters) ? playback.chapters.flatMap((item: unknown) => {
    const chapter = object(item), start = Number(chapter?.start);
    return chapter && typeof chapter.title === "string" && Number.isFinite(start) && start >= 0 ? [{ title: chapter.title.slice(0, 200), start }] : [];
  }).slice(0, 500) : [];
  const sponsorBlockSegments = Array.isArray(playback.sponsorBlockSegments) ? playback.sponsorBlockSegments.flatMap((item: unknown) => {
    const segment = object(item), bounds = segment?.segment;
    const start = Number(bounds?.[0]), end = Number(bounds?.[1]);
    return segment && Array.isArray(bounds) && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && typeof segment.category === "string"
      ? [{ category: segment.category.slice(0, 40), actionType: text(segment.actionType, "skip", 40), segment: [start, end] as [number, number], UUID: text(segment.UUID, `${start}-${end}`, 200) }] : [];
  }).slice(0, 500) : [];
  return {
    version: 1, active: true,
    video: {
      id: String(video.id), title: text(video.title, "YouTube", 300), channelId: text(video.channelId, "", 200),
      channelTitle: text(video.channelTitle, "YouTube", 200), duration: finite(video.duration, 0, 0, 86_400 * 30),
    },
    playback: {
      rate: finite(playback.rate, 1, .25, 4), keyboardSeekSeconds: finite(playback.keyboardSeekSeconds, 5, 1, 120),
      frameStepFps: finite(playback.frameStepFps, 30, 1, 240),
      captions: { enabledByDefault: captions.enabledByDefault === true, language: text(captions.language, "en", 16), style: style(captions.style) },
      chapters, sponsorBlockSegments,
    },
    screenshot: { format: format(screenshot.format), quality: finite(screenshot.quality, .92, .1, 1), filenameTemplate: text(screenshot.filenameTemplate, "{channel}_{title}_{timestamp_ms}", 300) },
  };
}

export function parseBridgeDetail<T = unknown>(event: { detail?: unknown }): T | null {
  if (typeof event.detail !== "string") return null;
  try { return JSON.parse(event.detail) as T; } catch { return null; }
}

export function validateScreenshotRequest(value: unknown): BridgeScreenshotRequest | null {
  const root = object(value), video = object(root?.video), screenshot = object(root?.screenshot);
  if (root?.version !== 1 || !video || !VIDEO_ID.test(String(video.id ?? "")) || !screenshot) return null;
  return {
    version: 1,
    video: { id: String(video.id), title: text(video.title, "YouTube", 300), channelTitle: text(video.channelTitle, "YouTube", 200), seconds: finite(video.seconds, 0, 0, 86_400 * 30) },
    screenshot: { format: format(screenshot.format), quality: finite(screenshot.quality, .92, .1, 1), filenameTemplate: text(screenshot.filenameTemplate, "{channel}_{title}_{timestamp_ms}", 300) },
  };
}

export function claimScreenshotRequest(event: { detail?: unknown; preventDefault(): void }, pageUrl: string, instanceUrl: string): BridgeScreenshotRequest | null {
  if (!configuredPageMatches(pageUrl, instanceUrl)) return null;
  const request = validateScreenshotRequest(parseBridgeDetail(event));
  if (!request) return null;
  event.preventDefault();
  return request;
}

export function installReadyBridge(target: Pick<Document, "addEventListener" | "removeEventListener" | "dispatchEvent">, onContext: EventListener) {
  target.addEventListener(ENHANCE_BRIDGE_EVENTS.context, onContext);
  target.dispatchEvent(new Event(ENHANCE_BRIDGE_EVENTS.ready));
  return () => target.removeEventListener(ENHANCE_BRIDGE_EVENTS.context, onContext);
}

export function isEditableShortcutTarget(target: any): boolean {
  const tag = String(target?.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable) || Boolean(target?.closest?.("[contenteditable]"));
}

export function frameStepSeconds(fps: unknown): number {
  return 1 / finite(fps, 30, 1, 240);
}
import { t } from "./i18n";
