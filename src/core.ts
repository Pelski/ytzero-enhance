export const DEFAULT_SETTINGS = {
  instanceUrl: "",
  redirectEnabled: false,
  enhancePlayer: true,
  replaceControls: true,
  screenshotFormat: "png" as "png" | "jpeg" | "webp",
  screenshotQuality: 0.92,
  screenshotFilename: "{channel}_{title}_{timestamp_ms}",
  seekSeconds: 5,
  frameRate: 30,
};

export type Settings = typeof DEFAULT_SETTINGS;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;
export const YT_NO_REDIRECT_MARKER = "ytNoRedirect";

function youtubeUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) return null;
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch { return null; }
}

function localBase(instanceUrl: string): URL | null {
  try {
    const base = new URL(instanceUrl);
    return /^https?:$/.test(base.protocol) ? base : null;
  } catch { return null; }
}

function withInstancePath(instanceUrl: string, path: string, search = ""): string | null {
  const base = localBase(instanceUrl);
  if (!base) return null;
  const prefix = base.pathname.replace(/\/$/, "");
  base.pathname = `${prefix}${path}`.replace(/\/{2,}/g, "/");
  base.search = search;
  base.hash = "";
  return base.toString();
}

export function hasNoRedirectMarker(input: string): boolean {
  const url = youtubeUrl(input);
  return Boolean(url?.hash.slice(1).split("&").includes(YT_NO_REDIRECT_MARKER));
}

export function parseTimestamp(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export function youtubeVideoId(input: string): string | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function youtubePlaylistId(input: string): string | null {
  const url = youtubeUrl(input);
  if (!url) return null;
  let id = url.pathname === "/playlist" || url.pathname === "/watch" ? url.searchParams.get("list") : null;
  if (!id) id = url.pathname.match(/^\/show\/VL([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ?? null;
  return id && PLAYLIST_ID.test(id) ? id : null;
}

export function isRedirectableYouTubeUrl(input: string): boolean {
  const url = youtubeUrl(input);
  if (!url || hasNoRedirectMarker(input)) return false;
  if (/^\/embed\//.test(url.pathname)) return false;
  return youtubeVideoId(input) !== null || youtubePlaylistId(input) !== null;
}

export function localWatchUrl(input: string, instanceUrl: string): string | null {
  if (!isRedirectableYouTubeUrl(input)) return null;
  const id = youtubeVideoId(input);
  if (!id) return null;
  let source: URL;
  try {
    source = new URL(input);
  } catch { return null; }
  const seconds = parseTimestamp(source.searchParams.get("t") ?? source.searchParams.get("start"));
  const playlistId = youtubePlaylistId(input);
  const path = playlistId ? `/watch/${id}/playlist/${encodeURIComponent(playlistId)}` : `/watch/${id}`;
  return withInstancePath(instanceUrl, path, seconds > 0 ? `?t=${seconds}` : "");
}

/** Map a source-site video, public playlist, or channel page to YT Zero. */
export function localContentUrl(input: string, instanceUrl: string, resolvedChannelId?: string | null): string | null {
  const source = youtubeUrl(input);
  if (!source) return null;

  const unmarked = new URL(source);
  unmarked.hash = "";
  const video = youtubeVideoId(unmarked.toString());
  if (video && !/^\/embed\//.test(source.pathname)) return localWatchUrl(unmarked.toString(), instanceUrl);

  const playlistId = youtubePlaylistId(unmarked.toString());
  if (playlistId) return withInstancePath(instanceUrl, `/playlist/${encodeURIComponent(playlistId)}`);

  const directChannelId = source.pathname.match(/^\/channel\/([^/?#]+)/)?.[1] ?? "";
  const channelId = resolvedChannelId && CHANNEL_ID.test(resolvedChannelId) ? resolvedChannelId : directChannelId;
  if (CHANNEL_ID.test(channelId)) return withInstancePath(instanceUrl, `/channel/${channelId}`);

  const channelPath = source.pathname.match(/^\/(?:@([^/?#]+)|(?:c|user)\/([^/?#]+))(?:\/|$)/);
  const channelQuery = channelPath?.[1] ? `@${channelPath[1]}` : channelPath?.[2];
  if (channelQuery) return withInstancePath(instanceUrl, "/search", `?q=${encodeURIComponent(channelQuery)}`);
  return null;
}

export function formatClock(seconds: number, milliseconds = false): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const base = `${hours ? `${String(hours).padStart(2, "0")}-` : ""}${String(minutes).padStart(2, "0")}-${String(secs).padStart(2, "0")}`;
  return milliseconds ? `${base}-${String(Math.floor((safe % 1) * 1000)).padStart(3, "0")}` : base;
}

export function safeFilename(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180) || "ytzero-frame";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(sanitized) ? `_${sanitized}` : sanitized;
}

export function screenshotFilename(template: string, values: {
  channel?: string;
  title?: string;
  videoId?: string;
  seconds?: number;
}, extension: "png" | "jpg" | "webp"): string {
  const seconds = Math.max(0, values.seconds ?? 0);
  const replacements: Record<string, string> = {
    channel: values.channel || "YouTube",
    title: values.title || values.videoId || "video",
    video_id: values.videoId || "unknown",
    timestamp: formatClock(seconds),
    timestamp_ms: formatClock(seconds, true),
  };
  const expanded = template.replace(/\{(channel|title|video_id|timestamp|timestamp_ms)\}/g, (_, key) => replacements[key]);
  return `${safeFilename(expanded)}.${extension}`;
}

export function normalizeSettings(input: Partial<Settings> | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  merged.instanceUrl = String(merged.instanceUrl || DEFAULT_SETTINGS.instanceUrl).replace(/\/$/, "");
  merged.screenshotFormat = merged.screenshotFormat === "jpeg" || merged.screenshotFormat === "webp" ? merged.screenshotFormat : "png";
  merged.screenshotQuality = Math.min(1, Math.max(0.1, Number(merged.screenshotQuality) || 0.92));
  merged.seekSeconds = Math.min(60, Math.max(1, Number(merged.seekSeconds) || 5));
  merged.frameRate = Math.min(120, Math.max(1, Number(merged.frameRate) || 30));
  return merged;
}

export function containedMediaRect(element: { x: number; y: number; width: number; height: number }, mediaWidth: number, mediaHeight: number) {
  if (element.width <= 0 || element.height <= 0 || mediaWidth <= 0 || mediaHeight <= 0) return element;
  const elementRatio = element.width / element.height;
  const mediaRatio = mediaWidth / mediaHeight;
  if (elementRatio > mediaRatio) {
    const width = element.height * mediaRatio;
    return { x: element.x + (element.width - width) / 2, y: element.y, width, height: element.height };
  }
  const height = element.width / mediaRatio;
  return { x: element.x, y: element.y + (element.height - height) / 2, width: element.width, height };
}
