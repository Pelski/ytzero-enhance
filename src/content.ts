import { containedMediaRect, DEFAULT_SETTINGS, formatClock, normalizeSettings, youtubeVideoId } from "./core";
import { BridgeScreenshotRequest, claimScreenshotRequest, configuredPageMatches, embeddedPlayerParameters, EnhanceConfiguration, EnhanceContext, EnhancePlayerCommand, ENHANCE_BRIDGE_EVENTS, ENHANCE_PLAYER_EVENTS, frameStepSeconds, highestQualityAtOrBelow, isEditableShortcutTarget, parseBridgeDetail, playerPresentationState, validateEnhanceContext, validatePlayerCommand } from "./contract";
import { EMBEDDED_CONFIGURATION_ID, PAIRED_INSTANCES_KEY, parseEmbeddedConfigurationText } from "./instances";
import { t } from "./i18n";
import { addApiListener, callApi, ext, onExtensionContextInvalidated } from "./webext";

let config = normalizeSettings(DEFAULT_SETTINGS);
let remoteConfig: EnhanceConfiguration | null = null;
let bridgeContext: EnhanceContext | null = null;
let playerController: ReturnType<typeof enhanceYouTubePlayer> | null = null;
let bridgeCleanup: (() => void) | null = null;
let playerObserver: MutationObserver | null = null;
let configurationObserver: MutationObserver | null = null;
let extensionStatusObserver: MutationObserver | null = null;
let activeInstanceUrl = "";
let lastEmbeddedConfigurationText = "";

const PLAYER_ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  volume: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a9 9 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
  captions: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
  pip: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="10" width="8" height="5" rx="1"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  minimize: '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M16 3v3a2 2 0 0 0 2 2h3"/><path d="M8 21v-3a2 2 0 0 0-2-2H3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
};

void Promise.all([
  callApi<any>(ext.storage.sync, "get", DEFAULT_SETTINGS),
  callApi<any>(ext.runtime, "sendMessage", { type: "ytze-get-configuration-state" }).catch(() => ({ configuration: null })),
]).then(([stored, state]) => {
  config = normalizeSettings(stored);
  remoteConfig = state?.configuration ?? null;
  activeInstanceUrl = state?.instance?.url ?? "";
  boot();
}).catch(() => {});

addApiListener(ext?.storage?.onChanged, (changes: any, area: string) => {
  if (area !== "sync") return;
  const patch = Object.fromEntries(Object.entries(changes).map(([key, value]: any) => [key, value.newValue]));
  config = normalizeSettings({ ...config, ...patch });
  void reloadConfigurationState();
});

addApiListener(ext?.storage?.onChanged, (changes: any, area: string) => {
  if (area !== "local") return;
  if (changes[PAIRED_INSTANCES_KEY]) void reloadConfigurationState();
});

async function reloadConfigurationState() {
  const state = await callApi<any>(ext.runtime, "sendMessage", { type: "ytze-get-configuration-state" }).catch(() => ({ configuration: null }));
  remoteConfig = state?.configuration ?? null;
  activeInstanceUrl = state?.instance?.url ?? "";
  restart();
}

function restart() {
  shutdown();
  boot();
}

function shutdown() {
  playerController?.destroy();
  playerController = null;
  bridgeCleanup?.();
  bridgeCleanup = null;
  playerObserver?.disconnect();
  playerObserver = null;
  configurationObserver?.disconnect();
  configurationObserver = null;
  extensionStatusObserver?.disconnect();
  extensionStatusObserver = null;
  bridgeContext = null;
}

onExtensionContextInvalidated(shutdown);

function boot() {
  if (window.top === window) {
    const isPairedInstance = activeInstanceUrl && configuredPageMatches(location.href, activeInstanceUrl);
    if (isPairedInstance) watchEmbeddedConfiguration();
    bootPageBridge();
    if (isPairedInstance) markExtensionActiveWhenReady();
    return;
  }
  if (!config.enhancePlayer || !remoteConfig?.enabled || !youtubeVideoId(location.href)) return;
  const start = () => {
    const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
    if (!video || playerController) return;
    playerController = enhanceYouTubePlayer(video);
  };
  start();
  playerObserver = new MutationObserver(start);
  playerObserver.observe(document.documentElement, { childList: true, subtree: true });
  void callApi(ext.runtime, "sendMessage", { type: "ytze-player-ready", videoId: youtubeVideoId(location.href) }).catch(() => {});
}

function markExtensionActiveWhenReady() {
  const markExtensionActive = () => {
    const element = document.getElementById("ytzero-enhance-extension-status");
    if (!element) return false;
    element.setAttribute("data-extension-status", "active");
    return true;
  };
  if (markExtensionActive() || !document.body) return;
  extensionStatusObserver = new MutationObserver(() => {
    if (markExtensionActive()) {
      extensionStatusObserver?.disconnect();
      extensionStatusObserver = null;
    }
  });
  extensionStatusObserver.observe(document.body, { childList: true, subtree: true });
}

function watchEmbeddedConfiguration() {
  const read = () => {
    const text = document.body?.querySelector<HTMLElement>(`#${EMBEDDED_CONFIGURATION_ID}`)?.textContent?.trim() ?? "";
    if (!text || text === lastEmbeddedConfigurationText) return;
    const validation = parseEmbeddedConfigurationText(text);
    lastEmbeddedConfigurationText = text;
    if (!validation.ok) {
      void callApi(ext.runtime, "sendMessage", { type: "ytze-page-configuration-error", diagnostic: validation.diagnostic, blocked: Boolean(validation.unsupportedVersion) }).catch(() => {});
      return;
    }
    void callApi(ext.runtime, "sendMessage", { type: "ytze-page-configuration", configuration: validation.value }).catch(() => {});
  };
  read();
  configurationObserver = new MutationObserver(read);
  configurationObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}

function bootPageBridge() {
  if (!config.enhancePlayer || !remoteConfig?.enabled || !activeInstanceUrl || !configuredPageMatches(location.href, activeInstanceUrl)) return;
  const configureEmbeds = (context?: EnhanceContext) => {
    for (const iframe of document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed/"], iframe[src*="youtube-nocookie.com/embed/"]')) {
      try {
        if (context && youtubeVideoId(iframe.src) !== context.video.id) continue;
        const url = new URL(iframe.src);
        const desired = embeddedPlayerParameters(remoteConfig!);
        if (remoteConfig!.player.preferredQuality !== "auto") desired.vq = remoteConfig!.player.preferredQuality;
        const captions = context?.playback.captions ?? remoteConfig!.player.captions;
        desired.cc_load_policy = captions.enabledByDefault ? "1" : "0";
        if (captions.language) desired.cc_lang_pref = captions.language;
        let changed = false;
        for (const [key, value] of Object.entries(desired)) if (url.searchParams.get(key) !== value) { url.searchParams.set(key, value); changed = true; }
        if (changed) iframe.src = url.toString();
      } catch {}
    }
  };
  const onContext = (event: Event) => {
    const context = validateEnhanceContext(parseBridgeDetail(event as CustomEvent));
    if (context) {
      configureEmbeds(context);
      void callApi(ext.runtime, "sendMessage", { type: "ytze-bridge-context", context }).catch(() => {});
    }
  };
  const onScreenshot = (event: Event) => {
    const request = claimScreenshotRequest(event as CustomEvent, location.href, activeInstanceUrl);
    if (!request) return;
    void callApi<any>(ext.runtime, "sendMessage", { type: "ytze-bridge-screenshot", request })
      .then((result) => dispatchScreenshotResult(result?.ok ? "saved" : "error", result?.error))
      .catch((error) => dispatchScreenshotResult("error", error.message));
  };
  const onPlayerCommand = (event: Event) => {
    const command = validatePlayerCommand(parseBridgeDetail(event as CustomEvent));
    if (!command) return;
    event.preventDefault();
    void callApi<any>(ext.runtime, "sendMessage", { type: "ytze-player-command", command })
      .then((result) => dispatchPlayerEvent({
        version: 1, videoId: command.videoId, type: "command-result", timestamp: Date.now(),
        payload: { requestId: command.requestId, command: command.command, ...result },
      }))
      .catch((error) => dispatchPlayerEvent({
        version: 1, videoId: command.videoId, type: "command-result", timestamp: Date.now(),
        payload: { requestId: command.requestId, command: command.command, ok: false, error: error.message },
      }));
  };
  document.addEventListener(ENHANCE_BRIDGE_EVENTS.context, onContext);
  document.addEventListener(ENHANCE_BRIDGE_EVENTS.screenshotRequest, onScreenshot);
  document.addEventListener(ENHANCE_PLAYER_EVENTS.command, onPlayerCommand);
  configureEmbeds();
  const observer = new MutationObserver(() => configureEmbeds());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.dispatchEvent(new Event(ENHANCE_BRIDGE_EVENTS.ready));
  bridgeCleanup = () => {
    document.removeEventListener(ENHANCE_BRIDGE_EVENTS.context, onContext);
    document.removeEventListener(ENHANCE_BRIDGE_EVENTS.screenshotRequest, onScreenshot);
    document.removeEventListener(ENHANCE_PLAYER_EVENTS.command, onPlayerCommand);
    observer.disconnect();
  };
}

function dispatchPlayerEvent(detail: Record<string, unknown>) {
  document.dispatchEvent(new CustomEvent(ENHANCE_PLAYER_EVENTS.event, { detail: JSON.stringify(detail) }));
}

function dispatchScreenshotResult(status: "saved" | "error", error?: string) {
  document.dispatchEvent(new CustomEvent(ENHANCE_BRIDGE_EVENTS.screenshotResult, {
    detail: JSON.stringify({ version: 1, status, ...(error ? { error: String(error).slice(0, 300) } : {}) }),
  }));
}

function enhanceYouTubePlayer(video: HTMLVideoElement) {
  const presentation = playerPresentationState(config.enhancePlayer, true, remoteConfig, false);
  if (presentation.active) document.documentElement.classList.add("ytze-active");
  if (presentation.replaceControls) document.documentElement.classList.add("ytze-replace-controls");
  const host = document.createElement("div");
  host.id = "ytze-player-controls";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${CONTROL_STYLES}</style>
    <button class="big-play" aria-label="${t("play")}">${PLAYER_ICONS.play}</button>
    <div class="controls" role="group" aria-label="${t("playerControls")}">
      <div class="progress" role="slider" tabindex="0" aria-label="${t("progress")}" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="0">
        <div class="progress-track"><div class="buffered"></div><div class="markers" aria-hidden="true"></div><div class="played"></div></div>
        <div class="knob"></div>
        <div class="progress-tooltip"><span class="chapter"></span><span class="hover-time">0:00</span></div>
      </div>
      <div class="buttons">
        <button class="play" aria-label="${t("playPause")}">${PLAYER_ICONS.play}</button>
        <div class="volume-wrap"><button class="mute" aria-label="${t("mute")}">${PLAYER_ICONS.volume}</button><input class="volume" aria-label="${t("volume")}" type="range" min="0" max="1" step="0.05" value="1"></div>
        <span class="time">0:00 / 0:00</span><span class="spacer"></span>
        <div class="caption-menu-wrap">
          <button class="captions" aria-label="${t("captions")}" title="${t("captionsShortcut")}" aria-haspopup="dialog" aria-expanded="false">${PLAYER_ICONS.captions}</button>
          <div class="caption-menu" role="dialog" aria-label="${t("captions")}" hidden>
            <div class="caption-toggle"><span>${t("captions")}</span><button class="caption-switch" role="switch" aria-checked="false" aria-label="${t("captions")}"><span></span></button></div>
            <div class="caption-list" role="listbox" aria-label="${t("captions")}"></div>
          </div>
        </div>
        <button class="pip" aria-label="${t("pictureInPicture")}">${PLAYER_ICONS.pip}</button>
        <button class="fullscreen" aria-label="${t("fullscreen")}">${PLAYER_ICONS.fullscreen}</button>
      </div>
    </div><div class="toast" aria-live="polite"></div>`;
  document.documentElement.append(host);
  const q = <T extends Element>(selector: string) => shadow.querySelector<T>(selector)!;
  const play = q<HTMLButtonElement>(".play");
  const bigPlay = q<HTMLButtonElement>(".big-play");
  const time = q<HTMLElement>(".time");
  const progress = q<HTMLElement>(".progress");
  const played = q<HTMLElement>(".played");
  const buffered = q<HTMLElement>(".buffered");
  const knob = q<HTMLElement>(".knob");
  const tooltip = q<HTMLElement>(".progress-tooltip");
  const hoverTime = q<HTMLElement>(".hover-time");
  const chapter = q<HTMLElement>(".chapter");
  const mute = q<HTMLButtonElement>(".mute");
  const volume = q<HTMLInputElement>(".volume");
  const captions = q<HTMLButtonElement>(".captions");
  const captionMenuWrap = q<HTMLElement>(".caption-menu-wrap");
  const captionMenu = q<HTMLElement>(".caption-menu");
  const captionSwitch = q<HTMLButtonElement>(".caption-switch");
  const captionList = q<HTMLElement>(".caption-list");
  const fullscreen = q<HTMLButtonElement>(".fullscreen");
  const toast = q<HTMLElement>(".toast");
  let toastTimer = 0;
  let idleTimer = 0;
  let frameCallback = 0;
  let qualityInterval = 0;
  let scrubbing = false;
  let spaceHoldTimer = 0;
  let spaceHoldActive = false;
  let lastMediaTime: number | null = null;
  const frameSamples: number[] = [];
  let lastSkippedSegment = "";
  let desiredRate = remoteConfig?.player.defaultPlaybackRate ?? 1;
  let subtitleSize = remoteConfig?.player.captions.style.fontSizePx ?? 19;
  let selectedCaptionLanguage = new URL(location.href).searchParams.get("cc_lang_pref") || remoteConfig?.player.captions.language || "en";
  let captionLanguageUserSelected = false;
  let captionsEnabled = document.querySelector(".ytp-subtitles-button")?.getAttribute("aria-pressed") === "true";
  let captionMenuOpen = false;
  let lastStateEmit = 0;
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const videoId = youtubeVideoId(location.href)!;
  const playerState = () => ({
    paused: video.paused,
    ended: video.ended,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    volume: video.volume,
    muted: video.muted,
    playbackRate: video.playbackRate,
    captionSize: subtitleSize,
    captionsEnabled,
    fullscreen: Boolean(document.fullscreenElement),
    pictureInPicture: document.pictureInPictureElement === video,
  });
  const emitPlayerEvent = (type: "ready" | "state" | "shortcut" | "captions-toggle-request" | "ended", payload: Record<string, unknown>) => {
    void callApi(ext.runtime, "sendMessage", {
      type: "ytze-player-event",
      event: { version: 1, videoId, type, timestamp: Date.now(), payload },
    }).catch(() => {});
  };
  const emitState = (reason: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastStateEmit < 1_000) return;
    lastStateEmit = now;
    emitPlayerEvent("state", { reason, state: playerState() });
  };
  const applyPreferredQuality = () => {
    const player = document.querySelector(".html5-video-player") as any;
    const selected = highestQualityAtOrBelow(player?.getAvailableQualityLevels?.(), remoteConfig?.player.preferredQuality ?? "auto");
    if (selected) {
      player.setPlaybackQualityRange?.(selected, selected);
      player.setPlaybackQuality?.(selected);
    }
    void callApi(ext.runtime, "sendMessage", { type: "ytze-apply-preferred-quality" }).catch(() => {});
  };

  const playbackSettings = () => bridgeContext?.video.id === youtubeVideoId(location.href) ? bridgeContext.playback : {
    rate: remoteConfig?.player.defaultPlaybackRate ?? 1,
    keyboardSeekSeconds: remoteConfig?.player.keyboardSeekSeconds ?? config.seekSeconds,
    frameStepFps: remoteConfig?.player.frameStepFps ?? config.frameRate,
    captions: remoteConfig?.player.captions ?? { enabledByDefault: false, language: "en", availableLanguages: [], style: { fontSizePx: 19, color: "#ffffff", backgroundOpacityPercent: 75 } },
    chapters: [], sponsorBlockSegments: [],
  };

  const applyContext = (context: EnhanceContext) => {
    if (context.video.id !== youtubeVideoId(location.href)) return;
    bridgeContext = context;
    desiredRate = context.playback.rate;
    video.playbackRate = context.playback.rate;
    if (!captionLanguageUserSelected) selectedCaptionLanguage = context.playback.captions.language || selectedCaptionLanguage;
    subtitleSize = context.playback.captions.style.fontSizePx;
    applyCaptionPreferences(context.playback.captions);
    window.setTimeout(() => void setYouTubeCaptions(context.playback.captions.enabledByDefault, selectedCaptionLanguage, false), 300);
    renderMarkers(context);
  };

  const say = (message: string) => {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1500);
  };
  const captionLanguages = () => remoteConfig?.player.captions.availableLanguages ?? [];
  const captionsAreEnabled = () => captionsEnabled;
  const setCaptionMenuOpen = (open: boolean) => {
    captionMenuOpen = open;
    captionMenu.hidden = !open;
    captions.setAttribute("aria-expanded", String(open));
    if (open) showControls();
  };
  const syncCaptionControls = () => {
    const enabled = captionsAreEnabled();
    captions.classList.toggle("active", enabled);
    captionSwitch.classList.toggle("active", enabled);
    captionSwitch.setAttribute("aria-checked", String(enabled));
    for (const option of captionList.querySelectorAll<HTMLButtonElement>("button[data-language]")) {
      const selected = option.dataset.language === selectedCaptionLanguage;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
      option.querySelector(".caption-option-status")!.textContent = selected ? "✓" : "";
    }
  };
  const setYouTubeCaptions = async (enabled: boolean, language = selectedCaptionLanguage, userInitiated = true) => {
    const configured = captionLanguages().find((item) => item.code === language);
    const response = await callApi<any>(ext.runtime, "sendMessage", {
      type: "ytze-set-youtube-captions",
      enabled,
      language,
      label: configured?.label ?? language,
    }).catch((error) => ({ ok: false, error: error.message }));
    if (!response?.ok) {
      say(`${t("captionsUnavailable")}: ${response?.error || t("unknown")}`);
      return false;
    }
    captionsEnabled = response.enabled === true;
    if (enabled) {
      selectedCaptionLanguage = language;
      if (userInitiated) captionLanguageUserSelected = true;
    }
    setCaptionMenuOpen(false);
    window.setTimeout(() => { update(); syncCaptionControls(); }, 150);
    return true;
  };
  const renderCaptionLanguageMenu = () => {
    const languages = captionLanguages();
    captionList.replaceChildren();
    for (const language of languages) {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.language = language.code;
      option.setAttribute("role", "option");
      const label = document.createElement("span");
      label.textContent = language.label;
      const status = document.createElement("span");
      status.className = "caption-option-status";
      option.append(label, status);
      option.addEventListener("click", () => void setYouTubeCaptions(true, language.code), { signal });
      captionList.append(option);
    }
    syncCaptionControls();
  };
  const showControls = () => {
    host.classList.add("visible");
    document.documentElement.classList.remove("ytze-idle");
    clearTimeout(idleTimer);
    if (!video.paused) idleTimer = window.setTimeout(() => {
      if (captionMenuOpen) return;
      host.classList.remove("visible");
      document.documentElement.classList.add("ytze-idle");
    }, 2600);
  };
  const togglePlay = () => video.paused ? video.play().catch(() => {}) : video.pause();
  const toggleFullscreen = () => {
    const safariVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      webkitDisplayingFullscreen?: boolean;
    };
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (safariVideo.webkitDisplayingFullscreen) safariVideo.webkitExitFullscreen?.();
    else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen();
    else safariVideo.webkitEnterFullscreen?.();
  };
  const toggleCaptions = () => {
    const button = document.querySelector<HTMLElement>(".ytp-subtitles-button");
    const currentEnabled = button ? button.getAttribute("aria-pressed") === "true" : null;
    emitPlayerEvent("captions-toggle-request", {
      action: "toggle",
      currentEnabled,
      requestedEnabled: currentEnabled == null ? null : !currentEnabled,
    });
  };
  const requestCapture = async (bridgeRequest?: BridgeScreenshotRequest) => {
    const bounds = video.getBoundingClientRect();
    const fitted = getComputedStyle(video).objectFit === "fill"
      ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      : containedMediaRect(bounds, video.videoWidth, video.videoHeight);
    const title = document.querySelector<HTMLElement>(".ytp-title-link")?.innerText?.trim() || document.title.replace(/\s*-\s*YouTube$/, "");
    const channel = document.querySelector<HTMLElement>(".ytp-title-channel")?.textContent?.trim() || "YouTube";
    const metadata = bridgeRequest ? {
      title: bridgeRequest.video.title, channel: bridgeRequest.video.channelTitle, videoId: bridgeRequest.video.id, seconds: bridgeRequest.video.seconds,
    } : { title, channel, videoId: youtubeVideoId(location.href), seconds: video.currentTime };
    const contextScreenshot = bridgeContext?.video.id === youtubeVideoId(location.href) ? bridgeContext.screenshot : null;
    const defaultCaptureSettings = contextScreenshot ?? (remoteConfig ? {
      format: remoteConfig.screenshots.format,
      quality: remoteConfig.screenshots.jpegQuality,
      filenameTemplate: remoteConfig.screenshots.filenameTemplate,
    } : undefined);
    const response = await callApi<any>(ext.runtime, "sendMessage", {
      type: "ytze-capture-frame",
      videoId: youtubeVideoId(location.href),
      rect: fitted,
      viewport: { width: innerWidth, height: innerHeight },
      metadata,
      captureSettings: bridgeRequest?.screenshot ?? defaultCaptureSettings,
    }).catch((error) => ({ ok: false, error: error.message }));
    say(response?.ok ? `${t("saved")}: ${response.filename}` : `${t("captureError")}: ${response?.error || t("unknown")}`);
    return response;
  };
  const executeCommand = async (command: EnhancePlayerCommand) => {
    const payload = command.payload as Record<string, any>;
    if (command.command === "play") await video.play();
    else if (command.command === "pause") video.pause();
    else if (command.command === "toggle-play") await (video.paused ? video.play() : Promise.resolve(video.pause()));
    else if (command.command === "seek-by") seekBy(Number(payload.seconds));
    else if (command.command === "seek-to") video.currentTime = Math.min(Math.max(0, Number(payload.seconds)), video.duration || Infinity);
    else if (command.command === "set-volume") { video.volume = Number(payload.volume); video.muted = false; }
    else if (command.command === "set-muted") video.muted = Boolean(payload.enabled);
    else if (command.command === "toggle-muted") video.muted = !video.muted;
    else if (command.command === "set-playback-rate") { desiredRate = Number(payload.rate); video.playbackRate = desiredRate; }
    else if (command.command === "set-captions") await setYouTubeCaptions(Boolean(payload.enabled));
    else if (command.command === "toggle-captions") await setYouTubeCaptions(!captionsAreEnabled());
    else if (command.command === "set-caption-size") { subtitleSize = Number(payload.pixels); document.documentElement.style.setProperty("--ytze-caption-size", `${subtitleSize}px`); }
    else if (command.command === "capture-frame") await requestCapture();
    else if (command.command === "toggle-fullscreen") toggleFullscreen();
    else if (command.command === "enter-fullscreen" && !document.fullscreenElement) toggleFullscreen();
    else if (command.command === "exit-fullscreen" && document.fullscreenElement) await document.exitFullscreen();
    update();
    emitState("command", true);
    return { ok: true, state: playerState() };
  };
  const update = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const fraction = duration ? Math.min(1, Math.max(0, video.currentTime / duration)) : 0;
    if (!scrubbing) {
      played.style.width = `${fraction * 100}%`;
      knob.style.left = `${fraction * 100}%`;
      progress.setAttribute("aria-valuenow", String(Math.round(fraction * 1000)));
    }
    let bufferedEnd = 0;
    for (let index = 0; index < video.buffered.length; index++) if (video.buffered.start(index) <= video.currentTime + .2) bufferedEnd = Math.max(bufferedEnd, video.buffered.end(index));
    buffered.style.width = `${duration ? Math.min(100, bufferedEnd / duration * 100) : 0}%`;
    time.textContent = `${formatClock(video.currentTime).replace(/-/g, ":")} / ${formatClock(duration).replace(/-/g, ":")}`;
    play.innerHTML = video.paused ? PLAYER_ICONS.play : PLAYER_ICONS.pause;
    bigPlay.hidden = !video.paused || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
    mute.innerHTML = video.muted || video.volume === 0 ? PLAYER_ICONS.muted : PLAYER_ICONS.volume;
    volume.value = String(video.muted ? 0 : video.volume);
    syncCaptionControls();
    fullscreen.innerHTML = document.fullscreenElement ? PLAYER_ICONS.minimize : PLAYER_ICONS.fullscreen;
    const playback = playbackSettings();
    if (remoteConfig?.sponsorBlock.enabled) {
      const segment = playback.sponsorBlockSegments.find((item) => item.actionType === "skip" && video.currentTime >= item.segment[0] && video.currentTime < item.segment[1] - .25);
      if (segment && segment.UUID !== lastSkippedSegment) {
        lastSkippedSegment = segment.UUID;
        video.currentTime = segment.segment[1];
        say(`${t("skipped")}: ${segment.category}`);
      }
    }
    emitState("timeupdate");
  };
  const seekBy = (seconds: number) => { video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || Infinity); };
  const progressFraction = (clientX: number) => {
    const bounds = progress.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - bounds.left) / Math.max(1, bounds.width)));
  };
  const scrubTo = (clientX: number) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const fraction = progressFraction(clientX);
    video.currentTime = fraction * video.duration;
    played.style.width = `${fraction * 100}%`;
    knob.style.left = `${fraction * 100}%`;
  };
  const showProgressTooltip = (clientX: number) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const fraction = progressFraction(clientX);
    const seconds = fraction * video.duration;
    tooltip.style.left = `${fraction * 100}%`;
    hoverTime.textContent = formatClock(seconds).replace(/-/g, ":");
    const activeChapter = [...(bridgeContext?.playback.chapters ?? [])].reverse().find((item) => item.start <= seconds);
    chapter.textContent = activeChapter?.title ?? "";
    chapter.hidden = !activeChapter;
    tooltip.classList.add("show");
  };
  const frameDuration = () => frameSamples.length
    ? [...frameSamples].sort((a, b) => a - b)[Math.floor(frameSamples.length / 2)]
    : frameStepSeconds(playbackSettings().frameStepFps);
  const sampleFrames = (_now: number, metadata: VideoFrameCallbackMetadata) => {
    if (lastMediaTime != null) {
      const delta = metadata.mediaTime - lastMediaTime;
      if (delta > 1 / 240 && delta < .25) {
        frameSamples.push(delta);
        if (frameSamples.length > 60) frameSamples.shift();
      }
    }
    lastMediaTime = metadata.mediaTime;
    frameCallback = video.requestVideoFrameCallback(sampleFrames);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && captionMenuOpen) {
      event.preventDefault(); event.stopImmediatePropagation(); setCaptionMenuOpen(false); return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || isEditableShortcutTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const handled = [" ", "k", "j", "l", "arrowleft", "arrowright", "arrowup", "arrowdown", "m", "s", "f", "c", "+", "=", "-", "_", ",", "."].includes(key) || (key === "t" && Boolean(bridgeContext)) || /^\d$/.test(key);
    if (!handled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const actions: Record<string, string> = {
      " ": "play-or-hold-speed", k: "toggle-play", j: "seek-back-10", l: "seek-forward-10",
      arrowleft: "seek-back", arrowright: "seek-forward", arrowup: "volume-up", arrowdown: "volume-down",
      m: "toggle-muted", c: "toggle-captions", s: "capture-frame", t: "cinema-mode", f: "toggle-fullscreen",
      "+": "captions-larger", "=": "captions-larger", "-": "captions-smaller", _: "captions-smaller",
      ",": "previous-frame", ".": "next-frame",
    };
    emitPlayerEvent("shortcut", {
      key: event.key, code: event.code, action: actions[key] ?? (/^\d$/.test(key) ? "seek-percent" : "unknown"),
      repeat: event.repeat, modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey },
    });
    if (key === " ") {
      if (event.repeat || spaceHoldTimer || spaceHoldActive) return;
      spaceHoldTimer = window.setTimeout(() => {
        spaceHoldTimer = 0;
        spaceHoldActive = true;
        video.playbackRate = 2;
        say("2×");
      }, 220);
    }
    else if (key === "k") togglePlay();
    else if (key === "j") seekBy(-10);
    else if (key === "l") seekBy(10);
    else if (key === "arrowleft") { seekBy(-playbackSettings().keyboardSeekSeconds); say(`−${playbackSettings().keyboardSeekSeconds} s`); }
    else if (key === "arrowright") { seekBy(playbackSettings().keyboardSeekSeconds); say(`+${playbackSettings().keyboardSeekSeconds} s`); }
    else if (key === "arrowup") { video.volume = Math.min(1, video.volume + 0.05); video.muted = false; say(`${Math.round(video.volume * 100)}%`); }
    else if (key === "arrowdown") { video.volume = Math.max(0, video.volume - 0.05); say(`${Math.round(video.volume * 100)}%`); }
    else if (key === "m") video.muted = !video.muted;
    else if (key === "c") toggleCaptions();
    else if (key === "+" || key === "=") { subtitleSize = Math.min(48, subtitleSize + 2); document.documentElement.style.setProperty("--ytze-caption-size", `${subtitleSize}px`); say(`${subtitleSize}px`); }
    else if (key === "-" || key === "_") { subtitleSize = Math.max(12, subtitleSize - 2); document.documentElement.style.setProperty("--ytze-caption-size", `${subtitleSize}px`); say(`${subtitleSize}px`); }
    else if (key === "s" && !event.repeat) void requestCapture();
    else if (key === "t") void callApi(ext.runtime, "sendMessage", { type: "ytze-player-page-shortcut", key: "t" }).catch(() => {});
    else if (key === "f") toggleFullscreen();
    else if (key === ",") { video.pause(); seekBy(-frameDuration()); say(t("oneFrameBack")); }
    else if (key === ".") { video.pause(); seekBy(frameDuration()); say(t("oneFrameForward")); }
    else if (/^\d$/.test(key) && video.duration) video.currentTime = Number(key) / 10 * video.duration;
    update();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space" || isEditableShortcutTarget(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (spaceHoldTimer) {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = 0;
      togglePlay();
    } else if (spaceHoldActive) {
      spaceHoldActive = false;
      video.playbackRate = desiredRate;
    }
  };
  const onSurfaceClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || target.closest("#ytze-player-controls") || !target.closest(".html5-video-player")) return;
    event.preventDefault(); event.stopImmediatePropagation(); togglePlay(); showControls();
  };
  const onSurfaceDoubleClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || target.closest("#ytze-player-controls")) return;
    event.preventDefault(); event.stopImmediatePropagation(); toggleFullscreen();
  };

  play.addEventListener("click", togglePlay, { signal });
  bigPlay.addEventListener("click", togglePlay, { signal });
  progress.addEventListener("pointerdown", (event) => { scrubbing = true; progress.setPointerCapture(event.pointerId); scrubTo(event.clientX); showProgressTooltip(event.clientX); }, { signal });
  progress.addEventListener("pointermove", (event) => { showProgressTooltip(event.clientX); if (scrubbing) scrubTo(event.clientX); }, { signal });
  progress.addEventListener("pointerup", (event) => { scrubbing = false; progress.releasePointerCapture(event.pointerId); }, { signal });
  progress.addEventListener("pointerleave", () => { if (!scrubbing) tooltip.classList.remove("show"); }, { signal });
  mute.addEventListener("click", () => { video.muted = !video.muted; update(); }, { signal });
  volume.addEventListener("input", () => { video.volume = Number(volume.value); video.muted = false; update(); }, { signal });
  captions.addEventListener("click", () => setCaptionMenuOpen(!captionMenuOpen), { signal });
  captionSwitch.addEventListener("click", () => void setYouTubeCaptions(!captionsAreEnabled()), { signal });
  q(".pip").addEventListener("click", () => {
    const safariVideo = video as HTMLVideoElement & { webkitSupportsPresentationMode?: (mode: string) => boolean; webkitSetPresentationMode?: (mode: string) => void };
    if (video.requestPictureInPicture) video.requestPictureInPicture().catch(() => say(t("pipUnavailable")));
    else if (safariVideo.webkitSupportsPresentationMode?.("picture-in-picture")) safariVideo.webkitSetPresentationMode?.("picture-in-picture");
    else say(t("pipUnavailable"));
  }, { signal });
  fullscreen.addEventListener("click", toggleFullscreen, { signal });
  document.addEventListener("keydown", onKey, { capture: true, signal });
  document.addEventListener("keyup", onKeyUp, { capture: true, signal });
  document.addEventListener("click", onSurfaceClick, { capture: true, signal });
  document.addEventListener("dblclick", onSurfaceDoubleClick, { capture: true, signal });
  document.addEventListener("pointerdown", (event) => {
    if (captionMenuOpen && !event.composedPath().includes(captionMenuWrap)) setCaptionMenuOpen(false);
  }, { capture: true, signal });
  document.addEventListener("mousemove", showControls, { passive: true, signal });
  video.addEventListener("play", () => { showControls(); applyPreferredQuality(); emitState("play", true); }, { signal });
  video.addEventListener("pause", () => { showControls(); emitState("pause", true); }, { signal });
  video.addEventListener("volumechange", () => emitState("volumechange", true), { signal });
  video.addEventListener("loadedmetadata", () => { if (Math.abs(video.playbackRate - desiredRate) > .001) video.playbackRate = desiredRate; }, { signal });
  video.addEventListener("ratechange", () => {
    if (!spaceHoldActive && Math.abs(video.playbackRate - desiredRate) > .001) queueMicrotask(() => { if (!spaceHoldActive) video.playbackRate = desiredRate; });
    emitState("ratechange", true);
  }, { signal });
  video.addEventListener("ended", () => {
    emitPlayerEvent("ended", { state: playerState() });
    void callApi(ext.runtime, "sendMessage", { type: "ytze-player-ended" }).catch(() => {});
  }, { signal });
  video.addEventListener("enterpictureinpicture", () => emitState("enterpictureinpicture", true), { signal });
  video.addEventListener("leavepictureinpicture", () => emitState("leavepictureinpicture", true), { signal });
  document.addEventListener("fullscreenchange", () => { update(); emitState("fullscreenchange", true); }, { signal });
  const interval = window.setInterval(update, 250);
  qualityInterval = window.setInterval(applyPreferredQuality, 5_000);
  if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(sampleFrames);
  desiredRate = playbackSettings().rate;
  video.playbackRate = desiredRate;
  applyCaptionPreferences(playbackSettings().captions);
  renderCaptionLanguageMenu();
  window.setTimeout(() => void setYouTubeCaptions(Boolean(remoteConfig?.player.captions.enabledByDefault), selectedCaptionLanguage, false), 800);
  const removeLandscapeFullscreen = installLandscapeFullscreen(video);
  showControls();
  applyPreferredQuality();
  update();
  emitPlayerEvent("ready", { state: playerState() });
  return {
    capture: requestCapture,
    applyContext,
    command: executeCommand,
    setHidden: (hidden: boolean) => host.classList.toggle("capture-hidden", hidden),
    destroy: () => {
      clearInterval(interval);
      clearInterval(qualityInterval);
      clearTimeout(toastTimer);
      clearTimeout(idleTimer);
      clearTimeout(spaceHoldTimer);
      if (frameCallback && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallback);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousemove", showControls);
      removeLandscapeFullscreen();
      lifecycle.abort();
      document.documentElement.classList.remove("ytze-active", "ytze-replace-controls", "ytze-idle");
      host.remove();
    },
  };
}

function applyCaptionPreferences(captions: { style: { fontSizePx: number; color: string; backgroundOpacityPercent: number } }) {
  document.documentElement.style.setProperty("--ytze-caption-size", `${captions.style.fontSizePx}px`);
  document.documentElement.style.setProperty("--ytze-caption-color", captions.style.color);
  document.documentElement.style.setProperty("--ytze-caption-background", `rgba(0,0,0,${captions.style.backgroundOpacityPercent / 100})`);
}

function renderMarkers(context: EnhanceContext) {
  const controllerHost = document.querySelector<HTMLElement>("#ytze-player-controls");
  const root = controllerHost?.shadowRoot;
  const markers = root?.querySelector<HTMLElement>(".markers");
  if (!markers || context.video.duration <= 0) return;
  markers.replaceChildren();
  for (const chapter of context.playback.chapters) {
    if (chapter.start <= 0 || chapter.start >= context.video.duration) continue;
    const marker = document.createElement("i");
    marker.className = "chapter-marker";
    marker.style.left = `${chapter.start / context.video.duration * 100}%`;
    marker.title = chapter.title;
    markers.append(marker);
  }
  if (remoteConfig?.sponsorBlock.enabled) for (const segment of context.playback.sponsorBlockSegments) {
    const marker = document.createElement("i");
    marker.className = "sponsor-marker";
    marker.style.left = `${segment.segment[0] / context.video.duration * 100}%`;
    marker.style.width = `${Math.max(.25, (segment.segment[1] - segment.segment[0]) / context.video.duration * 100)}%`;
    marker.style.background = SPONSOR_COLORS[segment.category] ?? "#888888";
    marker.title = segment.category;
    markers.append(marker);
  }
}

const SPONSOR_COLORS: Record<string, string> = {
  sponsor: "#00d400", selfpromo: "#ffff00", interaction: "#cc00ff", intro: "#00ffff",
  outro: "#0202ed", preview: "#008fd6", music_offtopic: "#ff9900", filler: "#7300ab",
};

function installLandscapeFullscreen(video: HTMLVideoElement) {
  if (!remoteConfig?.player.autoFullscreenLandscape || typeof matchMedia !== "function") return () => {};
  const query = matchMedia("(orientation: landscape) and (max-width: 1024px)");
  const enter = () => {
    if (!query.matches || document.fullscreenElement) return;
    const safariVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    void document.documentElement.requestFullscreen?.().catch(() => safariVideo.webkitEnterFullscreen?.());
  };
  query.addEventListener?.("change", enter);
  return () => query.removeEventListener?.("change", enter);
}

addApiListener(ext?.runtime?.onMessage, (message: any, _sender: any, sendResponse: (value: any) => void) => {
  const respond = (value: any) => { try { sendResponse(value); } catch {} };
  if (message?.type === "ytze-execute-player-command" && playerController) {
    const command = validatePlayerCommand(message.command);
    if (!command || command.videoId !== youtubeVideoId(location.href)) { respond({ ok: false, error: "Invalid player command" }); return; }
    void playerController.command(command).then(respond, (error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-trigger-capture" && playerController) {
    void playerController.capture().then(respond, (error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-capture-with-settings" && playerController) {
    void playerController.capture(message.request).then(respond, (error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-apply-context" && playerController) {
    const context = validateEnhanceContext(message.context);
    if (context && context.video.id === youtubeVideoId(location.href)) playerController.applyContext(context);
    respond({ ok: Boolean(context) });
  }
  if (message?.type === "ytze-request-context" && window.top === window && activeInstanceUrl && configuredPageMatches(location.href, activeInstanceUrl)) {
    document.dispatchEvent(new Event(ENHANCE_BRIDGE_EVENTS.ready));
    respond({ ok: true });
  }
  if (message?.type === "ytze-capture-visibility" && playerController) { playerController.setHidden(Boolean(message.hidden)); respond({ ok: true }); }
  if (message?.type === "ytze-resolve-frame" && window.top === window) {
    const frames = [...document.querySelectorAll<HTMLIFrameElement>("iframe")];
    const frame = frames.find((item) => youtubeVideoId(item.src) === message.videoId && visible(item))
      ?? frames.find((item) => youtubeVideoId(item.src) === message.videoId);
    if (!frame) { respond({ rect: null }); return; }
    const outer = frame.getBoundingClientRect();
    const inner = message.innerRect;
    const viewport = message.innerViewport;
    const scaleX = outer.width / Math.max(1, viewport.width);
    const scaleY = outer.height / Math.max(1, viewport.height);
    respond({ rect: {
      x: outer.x + inner.x * scaleX,
      y: outer.y + inner.y * scaleY,
      width: inner.width * scaleX,
      height: inner.height * scaleY,
    }});
  }
  if (message?.type === "ytze-crop-download" && window.top === window) {
    void cropAndDownload(message).then(() => respond({ ok: true }), (error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "ytze-exit-fullscreen" && window.top === window) {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    respond({ ok: true });
  }
  if (message?.type === "ytze-dispatch-page-shortcut" && window.top === window && message.key === "t") {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", code: "KeyT", bubbles: true }));
    respond({ ok: true });
  }
  if (message?.type === "ytze-dispatch-player-event" && window.top === window) {
    dispatchPlayerEvent(message.event);
    if (message.event?.type === "captions-toggle-request") {
      document.dispatchEvent(new CustomEvent(ENHANCE_PLAYER_EVENTS.captionsToggleRequest, {
        detail: JSON.stringify({ version: 1, videoId: message.event.videoId, ...message.event.payload }),
      }));
    }
    respond({ ok: true });
  }
});

function visible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
}

async function cropAndDownload(message: any) {
  const image = new Image();
  image.src = message.imageUrl;
  await image.decode();
  const scaleX = image.naturalWidth / innerWidth;
  const scaleY = image.naturalHeight / innerHeight;
  const rect = message.rect;
  const sx = Math.max(0, Math.round(rect.x * scaleX));
  const sy = Math.max(0, Math.round(rect.y * scaleY));
  const sw = Math.min(image.naturalWidth - sx, Math.max(1, Math.round(rect.width * scaleX)));
  const sh = Math.min(image.naturalHeight - sy, Math.max(1, Math.round(rect.height * scaleY)));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("canvasUnavailable"));
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const mime = message.format === "jpeg" ? "image/jpeg" : message.format === "webp" ? "image/webp" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(t("imageEncodingFailed"))), mime, message.quality));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = message.filename;
  link.style.display = "none";
  document.documentElement.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const CONTROL_STYLES = `
  :host { position: fixed; z-index: 2147483647; inset: 0; pointer-events: none; font: 400 14px "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #fff; }
  :host(.capture-hidden) { opacity: 0 !important; }
  .controls { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 12px 8px; background: linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.4) 60%, transparent); opacity: 0; transition: opacity .2s ease; pointer-events: none; }
  :host(.visible) .controls, .controls:focus-within { opacity: 1; pointer-events: auto; }
  .buttons { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  button { display: inline-flex; align-items: center; justify-content: center; color: inherit; background: transparent; border: 0; border-radius: 6px; width: 38px; height: 34px; padding: 0; font: inherit; cursor: pointer; opacity: .92; }
  button:hover { opacity: 1; background: rgba(255,255,255,.14); }
  button.active { opacity: 1; background: rgba(255,255,255,.2); }
  button[hidden] { display: none; }
  button:focus-visible, input:focus-visible, .progress:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 2px; }
  button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .play svg path, .play svg rect, .big-play svg path { fill: currentColor; stroke: none; }
  .big-play { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 68px; height: 68px; border-radius: 50%; background: rgba(0,0,0,.65); pointer-events: auto; opacity: 1; transition: background .15s ease, transform .15s ease; }
  .big-play:hover { background: rgba(0,0,0,.85); transform: translate(-50%,-50%) scale(1.06); }
  .big-play svg { width: 30px; height: 30px; }
  .big-play[hidden] { display: none; }
  .time { margin-left: 8px; white-space: nowrap; font-size: 12.5px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.95); }
  .spacer { flex: 1; }
  input[type=range] { accent-color: #fff; cursor: pointer; }
  .progress { position: relative; height: 16px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
  .progress-track { position: relative; width: 100%; height: 3px; border-radius: 2px; background: rgba(255,255,255,.25); overflow: hidden; transition: height .12s ease; }
  .progress:hover .progress-track, .progress:focus-visible .progress-track { height: 5px; }
  .buffered, .played { position: absolute; inset: 0 auto 0 0; }
  .buffered { background: rgba(255,255,255,.35); }
  .played { background: #f2293a; z-index: 2; }
  .markers { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .markers i { position: absolute; top: 0; bottom: 0; display: block; pointer-events: auto; }
  .chapter-marker { width: 2px; background: rgba(0,0,0,.7); }
  .sponsor-marker { min-width: 2px; border-radius: 2px; background: #00d400; opacity: .9; }
  .knob { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: #f2293a; transform: translate(-50%,-50%) scale(0); transition: transform .12s ease; pointer-events: none; z-index: 3; }
  .progress:hover .knob, .progress:focus-visible .knob { transform: translate(-50%,-50%) scale(1); }
  .progress-tooltip { position: absolute; bottom: 22px; transform: translateX(-50%); padding: 4px 8px; border-radius: 5px; background: rgba(0,0,0,.85); color: #fff; font-size: 11.5px; white-space: nowrap; display: flex; flex-direction: column; align-items: center; gap: 2px; opacity: 0; pointer-events: none; }
  .progress-tooltip.show { opacity: 1; }
  .chapter { max-width: 220px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .volume-wrap { display: flex; align-items: center; }
  .volume { width: 0; opacity: 0; transition: width .18s ease, opacity .18s ease; }
  .volume-wrap:hover .volume, .volume:focus-visible { width: 64px; opacity: 1; }
  .caption-menu-wrap { position: relative; display: flex; }
  .caption-menu { position: absolute; right: 0; bottom: 42px; width: 230px; max-height: min(300px, 70vh); padding: 7px; display: flex; flex-direction: column; gap: 8px; color: #fff; background: rgba(22,22,27,.98); border-radius: 14px; box-shadow: 0 18px 42px rgba(0,0,0,.58); pointer-events: auto; overflow: hidden; }
  .caption-menu[hidden] { display: none; }
  .caption-toggle { display: flex; align-items: center; justify-content: space-between; padding: 5px 5px 9px; border-bottom: 1px solid rgba(255,255,255,.09); color: rgba(255,255,255,.72); font-size: 12px; }
  button.caption-switch { position: relative; width: 32px; height: 18px; padding: 0; border-radius: 999px; background: rgba(255,255,255,.22); opacity: 1; }
  button.caption-switch:hover { background: rgba(255,255,255,.3); }
  button.caption-switch.active { background: #3ea6ff; }
  .caption-switch span { position: absolute; left: 3px; top: 3px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .16s ease; }
  .caption-switch.active span { transform: translateX(14px); }
  .caption-list { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: rgba(255,255,255,.28) transparent; padding-top: 4px; }
  .caption-list button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; height: auto; min-height: 32px; padding: 7px 8px; border-radius: 8px; color: #fff; font-size: 13px; text-align: left; opacity: 1; }
  .caption-list button:hover { background: rgba(255,255,255,.09); }
  .caption-list button.is-selected { color: #3ea6ff; font-weight: 500; background: color-mix(in srgb, #3ea6ff 14%, transparent); }
  .caption-option-status { display: inline-flex; align-items: center; justify-content: flex-end; min-width: 14px; font-size: 14px; }
  .toast { position: absolute; left: 50%; bottom: 74px; transform: translate(-50%, 5px) scale(.94); padding: 7px 10px; border-radius: 999px; background: rgba(10,10,10,.62); color: #fff; backdrop-filter: blur(7px); opacity: 0; transition: .18s ease; max-width: 80vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 650; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 480px) { .time, .pip { display: none; } .buttons { gap: 1px; } button { width: 34px; } .controls { padding-inline: 8px; } }
  @media (prefers-reduced-motion: reduce) { .controls, .toast, .knob, .progress-track { transition: none; } }
`;
