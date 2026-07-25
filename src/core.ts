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

export function isRedirectableYouTubeUrl(input: string): boolean {
  let url: URL;
  try { url = new URL(input); } catch { return false; }
  if (/^\/embed\//.test(url.pathname)) return false;
  return youtubeVideoId(input) !== null;
}

export function localWatchUrl(input: string, instanceUrl: string): string | null {
  if (!isRedirectableYouTubeUrl(input)) return null;
  const id = youtubeVideoId(input);
  if (!id) return null;
  let source: URL;
  let base: URL;
  try {
    source = new URL(input);
    base = new URL(instanceUrl);
  } catch { return null; }
  if (!/^https?:$/.test(base.protocol)) return null;
  const prefix = base.pathname.replace(/\/$/, "");
  base.pathname = `${prefix}/watch/${id}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  const seconds = parseTimestamp(source.searchParams.get("t") ?? source.searchParams.get("start"));
  if (seconds > 0) base.searchParams.set("t", String(seconds));
  return base.toString();
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
