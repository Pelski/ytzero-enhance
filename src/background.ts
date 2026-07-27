import { DEFAULT_SETTINGS, isRedirectableYouTubeUrl, localContentUrl, normalizeSettings, screenshotFilename } from "./core";
import { EnhanceConfiguration, PLAYBACK_QUALITY_ORDER, validateEnhanceConfiguration, validateEnhanceContext, validatePlayerCommand, validatePlayerEvent, validateScreenshotRequest } from "./contract";
import { defaultPairedInstance, PairedInstance, PairedInstances, pairedInstanceForPage, PAIRED_INSTANCES_KEY } from "./instances";
import { PAIRED_INSTANCE_CONTENT_SCRIPT_ID, pairedInstanceContentScriptMatches } from "./content-registration";
import { t } from "./i18n";
import { callApi, ext } from "./webext";
import { operateYouTubeCaptions } from "./youtube-captions";

async function settings() {
  const stored = await callApi<Record<string, unknown>>(ext.storage.sync, "get", DEFAULT_SETTINGS);
  return normalizeSettings(stored as any);
}

async function pairedInstances(): Promise<PairedInstances> {
  const stored = await callApi<any>(ext.storage.local, "get", PAIRED_INSTANCES_KEY).catch(() => ({}));
  return stored?.[PAIRED_INSTANCES_KEY] && typeof stored[PAIRED_INSTANCES_KEY] === "object" ? stored[PAIRED_INSTANCES_KEY] : {};
}

async function savePairedInstances(instances: PairedInstances) {
  await callApi(ext.storage.local, "set", { [PAIRED_INSTANCES_KEY]: instances });
  await queuePairedInstanceContentScriptSync(instances);
}

async function syncPairedInstanceContentScript(instances: PairedInstances) {
  if (
    typeof ext.scripting?.getRegisteredContentScripts !== "function"
    || typeof ext.scripting?.registerContentScripts !== "function"
    || typeof ext.scripting?.unregisterContentScripts !== "function"
  ) throw new Error("Dynamic content script registration is unavailable");

  const registered = await callApi<any[]>(ext.scripting, "getRegisteredContentScripts", {});
  if (registered.some((script) => script.id === PAIRED_INSTANCE_CONTENT_SCRIPT_ID)) {
    await callApi(ext.scripting, "unregisterContentScripts", { ids: [PAIRED_INSTANCE_CONTENT_SCRIPT_ID] });
  }
  const matches = (await Promise.all(pairedInstanceContentScriptMatches(instances).map(async (pattern) => (
    await callApi<boolean>(ext.permissions, "contains", { origins: [pattern] }).catch(() => false) ? pattern : null
  )))).filter((pattern): pattern is string => Boolean(pattern));
  if (!matches.length) return;
  await callApi(ext.scripting, "registerContentScripts", [{
    id: PAIRED_INSTANCE_CONTENT_SCRIPT_ID,
    matches,
    js: ["content.js"],
    runAt: "document_idle",
    allFrames: false,
  }]);
}

let pairedInstanceContentScriptSync = Promise.resolve();
function queuePairedInstanceContentScriptSync(instances: PairedInstances) {
  pairedInstanceContentScriptSync = pairedInstanceContentScriptSync.catch(() => {}).then(() => syncPairedInstanceContentScript(instances));
  return pairedInstanceContentScriptSync;
}

async function configurationState(sender?: any) {
  const [instances, local] = await Promise.all([pairedInstances(), settings()]);
  const pageUrl = sender?.frameId === 0 ? sender?.url : sender?.tab?.url;
  const matched = pageUrl ? pairedInstanceForPage(instances, pageUrl) : null;
  const instance = matched ?? (sender?.frameId === 0 && pageUrl ? null : defaultPairedInstance(instances, local.instanceUrl));
  return { configuration: instance?.blocked ? null : instance?.configuration ?? null, instance, instances: Object.values(instances), defaultUrl: local.instanceUrl };
}

// Remove data from the superseded public-endpoint implementation. Paired
// configurations below are sourced exclusively from authenticated page DOM.
void callApi(ext.storage.local, "remove", ["ytzeRemoteConfiguration", "ytzeConfigurationDiagnostic", "ytzeConfigurationBlocked", "ytzeConfigurationFetchedAt"]).catch(() => {});
void pairedInstances().then(queuePairedInstanceContentScriptSync).catch(() => {});

async function redirect(details: any) {
  if (details.frameId !== 0 || !isRedirectableYouTubeUrl(details.url)) return;
  const config = await settings();
  if (!config.redirectEnabled) return;
  const destination = localContentUrl(details.url, config.instanceUrl);
  if (destination) await callApi(ext.tabs, "update", details.tabId, { url: destination }).catch(() => {});
}

ext.webNavigation.onCommitted.addListener(redirect, {
  url: [{ hostSuffix: "youtube.com" }, { hostEquals: "youtu.be" }],
});

ext.commands?.onCommand.addListener(async (command: string) => {
  if (command === "toggle-redirect") {
    const current = await settings();
    await callApi(ext.storage.sync, "set", { redirectEnabled: !current.redirectEnabled });
    await ext.action?.setBadgeText?.({ text: current.redirectEnabled ? "" : "ON" });
    await ext.action?.setBadgeBackgroundColor?.({ color: "#ef4444" });
  }
  if (command === "capture-frame") {
    await triggerActiveCapture();
  }
});

ext.action?.onClicked.addListener(() => ext.runtime.openOptionsPage());

ext.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (value: any) => void) => {
  if (message?.type === "ytze-capture-frame") {
    void captureFrame(message, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-page-configuration") {
    void storePageConfiguration(message.configuration, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-page-configuration-error") {
    void storePageConfigurationError(message, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-pair-instance") {
    void pairInstance(message, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-set-default-instance") {
    void setDefaultInstance(message.url).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-remove-instance") {
    void removeInstance(message.url).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-list-instances") {
    void configurationState(sender).then(sendResponse);
    return true;
  }
  if (message?.type === "ytze-get-configuration-state") {
    void configurationState(sender).then(sendResponse);
    return true;
  }
  if (message?.type === "ytze-bridge-context") {
    void routeBridgeContext(message.context, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-player-ready") {
    if (sender.tab?.id != null && youtubeFrameMatches(sender.url, message.videoId)) {
      void callApi(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-request-context" }, { frameId: 0 }).catch(() => {});
    }
    sendResponse({ ok: true });
  }
  if (message?.type === "ytze-apply-preferred-quality") {
    void applyPreferredQuality(sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-set-youtube-captions") {
    void setYouTubeCaptions(message, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-bridge-screenshot") {
    void captureBridgeScreenshot(message.request, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-player-ended" && sender.tab?.id != null) {
    void callApi(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-exit-fullscreen" }, { frameId: 0 }).catch(() => {});
  }
  if (message?.type === "ytze-player-page-shortcut" && sender.tab?.id != null && youtubeFrameMatches(sender.url, youtubeVideoIdFromFrame(sender.url)) && message.key === "t") {
    void callApi(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-dispatch-page-shortcut", key: "t" }, { frameId: 0 }).catch(() => {});
    sendResponse({ ok: true });
  }
  if (message?.type === "ytze-player-event") {
    void routePlayerEvent(message.event, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-player-command") {
    void routePlayerCommand(message.command, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-trigger-active-capture") {
    void triggerActiveCapture().then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

function youtubeFrameMatches(url: string | undefined, videoId: unknown) {
  return typeof url === "string" && typeof videoId === "string" && isYouTubeFrameUrl(url) && url.includes(videoId);
}

function youtubeVideoIdFromFrame(url: string | undefined) {
  if (!url) return null;
  try { return new URL(url).pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/)?.[1] ?? null; }
  catch { return null; }
}

async function routePlayerEvent(input: unknown, sender: any) {
  const event = validatePlayerEvent(input);
  const frameVideoId = youtubeVideoIdFromFrame(sender.url);
  if (sender.tab?.id == null || !event || event.videoId !== frameVideoId) throw new Error(t("invalidPlayerFrame"));
  const instances = await pairedInstances();
  if (!pairedInstanceForPage(instances, sender.tab.url || "")) throw new Error(t("unpairedPage"));
  await callApi(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-dispatch-player-event", event }, { frameId: 0 });
  return { ok: true };
}

async function routePlayerCommand(input: unknown, sender: any) {
  const { instance } = await assertPairedTopPage(sender);
  const command = validatePlayerCommand(input);
  if (!command) throw new Error("Invalid player command");
  const frames = await callApi<any[]>(ext.webNavigation, "getAllFrames", { tabId: sender.tab.id }).catch(() => []);
  const target = frames.find((frame) => frame.frameId !== 0 && youtubeFrameMatches(frame.url, command.videoId));
  if (!target) throw new Error(t("activeEmbeddedPlayerNotFound"));
  const result = await callApi<any>(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-execute-player-command", command }, { frameId: target.frameId });
  return { ...result, instanceUrl: instance.url };
}

async function applyPreferredQuality(sender: any) {
  if (sender.tab?.id == null || sender.frameId == null || !isYouTubeFrameUrl(sender.url || "")) throw new Error(t("invalidPlayerFrame"));
  const state = await configurationState(sender);
  const maximum = state.configuration?.player.preferredQuality;
  if (!maximum) return { ok: false, error: t("missingQualityConfiguration") };
  const results = await callApi<any[]>(ext.scripting, "executeScript", {
    target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
    world: "MAIN",
    args: [maximum, PLAYBACK_QUALITY_ORDER],
    func: (maximumQuality: string, qualityOrder: string[]) => {
      const player = document.querySelector(".html5-video-player") as any;
      const available = player?.getAvailableQualityLevels?.();
      if (!Array.isArray(available) || !available.length) return null;
      const maximumIndex = maximumQuality === "auto" ? 0 : qualityOrder.indexOf(maximumQuality);
      const threshold = maximumIndex < 0 ? 0 : maximumIndex;
      const selected = qualityOrder.slice(threshold).find((quality) => available.includes(quality));
      if (!selected) return null;
      player.setPlaybackQualityRange?.(selected, selected);
      player.setPlaybackQuality?.(selected);
      return selected;
    },
  });
  return { ok: true, quality: results?.[0]?.result ?? null };
}

async function setYouTubeCaptions(message: any, sender: any) {
  if (sender.tab?.id == null || sender.frameId == null || !isYouTubeFrameUrl(sender.url || "")) throw new Error(t("invalidPlayerFrame"));
  const enabled = message.enabled === true;
  const language = typeof message.language === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(message.language) ? message.language : "";
  const label = typeof message.label === "string" ? message.label.trim().slice(0, 120) : language;
  if (enabled && !language) throw new Error(t("invalidCaptionLanguage"));
  const results = await callApi<any[]>(ext.scripting, "executeScript", {
    target: { tabId: sender.tab.id, frameIds: [sender.frameId] },
    world: "MAIN",
    args: [enabled, language, label],
    func: operateYouTubeCaptions,
  });
  return results?.[0]?.result ?? { ok: false, error: t("captionsUnavailable") };
}

function isYouTubeFrameUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(parsed.hostname) && parsed.pathname.startsWith("/embed/");
  } catch { return false; }
}

async function assertPairedTopPage(sender: any) {
  const instances = await pairedInstances();
  const instance = pairedInstanceForPage(instances, sender.url || "");
  if (sender.frameId !== 0 || sender.tab?.id == null || !instance) throw new Error(t("unpairedPage"));
  return { instances, instance };
}

async function pairInstance(message: any, sender: any) {
  if (sender.tab || (sender.url && !String(sender.url).startsWith(ext.runtime.getURL("")))) throw new Error(t("pairingOnlyFromExtension"));
  let url: string;
  try {
    url = new URL(String(message.url)).toString().replace(/\/$/, "");
  } catch { throw new Error(t("invalidInstanceAddress")); }
  const validation = validateEnhanceConfiguration(message.configuration);
  if (!validation.ok) throw new Error(validation.diagnostic);
  const instances = await pairedInstances();
  const now = Date.now();
  const current = instances[url];
  instances[url] = {
    url,
    name: String(message.name || new URL(url).hostname).trim().slice(0, 60),
    configuration: validation.value,
    diagnostic: undefined,
    blocked: false,
    pairedAt: current?.pairedAt ?? now,
    lastSeenAt: now,
  };
  await savePairedInstances(instances);
  const local = await settings();
  if (!local.instanceUrl || !instances[local.instanceUrl]) await callApi(ext.storage.sync, "set", { instanceUrl: url });
  return { ok: true, instance: instances[url], default: !local.instanceUrl || !instances[local.instanceUrl] };
}

async function setDefaultInstance(url: unknown) {
  const instances = await pairedInstances();
  if (typeof url !== "string" || !instances[url]) throw new Error(t("pairedInstanceNotFound"));
  await callApi(ext.storage.sync, "set", { instanceUrl: url });
  return { ok: true };
}

async function removeInstance(url: unknown) {
  const instances = await pairedInstances();
  if (typeof url !== "string" || !instances[url]) throw new Error(t("pairedInstanceNotFound"));
  const removed = instances[url];
  delete instances[url];
  await savePairedInstances(instances);
  const local = await settings();
  if (local.instanceUrl === url) {
    const next = defaultPairedInstance(instances, "");
    await callApi(ext.storage.sync, "set", { instanceUrl: next?.url ?? "", redirectEnabled: next ? local.redirectEnabled : false });
  }
  const sameOriginRemains = Object.values(instances).some((instance) => {
    try { return new URL(instance.url).origin === new URL(removed.url).origin; } catch { return false; }
  });
  if (!sameOriginRemains && ext.permissions) {
    const origin = new URL(removed.url).origin;
    await callApi(ext.permissions, "remove", { origins: [`${origin}/*`] }).catch(() => false);
  }
  return { ok: true };
}

async function storePageConfiguration(input: unknown, sender: any) {
  const { instances, instance } = await assertPairedTopPage(sender);
  const validation = validateEnhanceConfiguration(input);
  if (!validation.ok) throw new Error(validation.diagnostic);
  instances[instance.url] = { ...instance, configuration: validation.value, diagnostic: undefined, blocked: false, lastSeenAt: Date.now() };
  await savePairedInstances(instances);
  return { ok: true, instance: instances[instance.url] };
}

async function storePageConfigurationError(message: any, sender: any) {
  const { instances, instance } = await assertPairedTopPage(sender);
  instances[instance.url] = {
    ...instance,
    diagnostic: String(message.diagnostic || t("embeddedSettingsReadFailed")).slice(0, 300),
    blocked: Boolean(message.blocked),
    lastSeenAt: Date.now(),
  };
  await savePairedInstances(instances);
  return { ok: true };
}

async function routeBridgeContext(input: unknown, sender: any) {
  await assertPairedTopPage(sender);
  const context = validateEnhanceContext(input);
  if (!context) throw new Error(t("invalidBridgeContext"));
  const frames = await callApi<any[]>(ext.webNavigation, "getAllFrames", { tabId: sender.tab.id }).catch(() => []);
  const targets = frames.filter((frame) => frame.frameId !== 0 && youtubeFrameMatches(frame.url, context.video.id));
  await Promise.all(targets.map((frame) => callApi(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-apply-context", context }, { frameId: frame.frameId }).catch(() => null)));
  return { ok: true, frames: targets.length };
}

async function captureBridgeScreenshot(input: unknown, sender: any) {
  await assertPairedTopPage(sender);
  const request = validateScreenshotRequest(input);
  if (!request) throw new Error(t("invalidScreenshotRequest"));
  const frames = await callApi<any[]>(ext.webNavigation, "getAllFrames", { tabId: sender.tab.id }).catch(() => []);
  const target = frames.find((frame) => frame.frameId !== 0 && youtubeFrameMatches(frame.url, request.video.id));
  if (!target) throw new Error(t("activeEmbeddedPlayerNotFound"));
  return callApi<any>(ext.tabs, "sendMessage", sender.tab.id, { type: "ytze-capture-with-settings", request }, { frameId: target.frameId });
}

async function triggerActiveCapture() {
  const tabs = await callApi<any[]>(ext.tabs, "query", { active: true, currentWindow: true });
  if (tabs[0]?.id == null) return { ok: false, error: t("activeTabNotFound") };
  const frames = await callApi<any[]>(ext.webNavigation, "getAllFrames", { tabId: tabs[0].id }).catch(() => []);
  for (const frame of frames.filter((item) => item.frameId !== 0)) {
    const result = await callApi<any>(ext.tabs, "sendMessage", tabs[0].id, { type: "ytze-trigger-capture" }, { frameId: frame.frameId }).catch(() => null);
    if (result?.ok) return { ok: true };
  }
  return { ok: false, error: t("activeEmbeddedPlayerNotFound") };
}

async function captureFrame(message: any, sender: any) {
  if (sender.tab?.id == null) throw new Error(t("activeTabNotFound"));
  if (!youtubeFrameMatches(sender.url, message.videoId)) throw new Error(t("captureOutsideYouTubeRejected"));
  const tabId = sender.tab.id;
  const config = await settings();
  const resolved = await callApi<any>(ext.tabs, "sendMessage", tabId, {
    type: "ytze-resolve-frame",
    videoId: message.videoId,
    innerRect: message.rect,
    innerViewport: message.viewport,
  }, { frameId: 0 });
  if (!resolved?.rect) throw new Error(t("playerPositionFailed"));

  await callApi(ext.tabs, "sendMessage", tabId, { type: "ytze-capture-visibility", hidden: true }, { frameId: sender.frameId });
  await new Promise((resolve) => setTimeout(resolve, 100));
  let imageUrl: string;
  try {
    imageUrl = await callApi<string>(ext.tabs, "captureVisibleTab", sender.tab.windowId, { format: "png" });
  } finally {
    callApi(ext.tabs, "sendMessage", tabId, { type: "ytze-capture-visibility", hidden: false }, { frameId: sender.frameId }).catch(() => {});
  }
  const requested = message.captureSettings;
  const screenshotFormat = requested?.format === "webp" || requested?.format === "jpeg" || requested?.format === "png" ? requested.format : config.screenshotFormat;
  const screenshotQuality = Number.isFinite(Number(requested?.quality)) ? Math.min(1, Math.max(.1, Number(requested.quality))) : config.screenshotQuality;
  const filenameTemplate = typeof requested?.filenameTemplate === "string" ? requested.filenameTemplate.slice(0, 300) : config.screenshotFilename;
  const extension = screenshotFormat === "jpeg" ? "jpg" : screenshotFormat;
  const filename = screenshotFilename(filenameTemplate, message.metadata ?? {}, extension);
  await callApi(ext.tabs, "sendMessage", tabId, {
    type: "ytze-crop-download",
    imageUrl,
    rect: resolved.rect,
    filename,
    format: screenshotFormat,
    quality: screenshotQuality,
  }, { frameId: 0 });
  return { ok: true, filename };
}
