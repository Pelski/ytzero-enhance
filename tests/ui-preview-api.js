const previewConfiguration = {
  format: "ytzero.enhance-configuration", version: 1, enabled: true,
  player: {
    replaceControls: true, language: "pl", preferredQuality: "1080p", defaultPlaybackRate: 1.25,
    keyboardSeekSeconds: 5, frameStepFps: 30, autoFullscreenLandscape: false,
    captions: {
      enabledByDefault: true,
      language: "pl",
      availableLanguages: [
        { code: "en", label: "English" }, { code: "pl", label: "Polski" },
        { code: "de", label: "Deutsch" }, { code: "zh-Hans", label: "中文（简体）" },
      ],
      style: { fontSizePx: 19, color: "#ffffff", backgroundOpacityPercent: 75 },
    },
  },
  screenshots: { format: "png", jpegQuality: .92, filenameTemplate: "{channel}_{title}_{timestamp_ms}", templateFields: [] },
  sponsorBlock: { enabled: true, categories: ["sponsor", "intro", "outro"] },
  bridge: { version: 1, detailEncoding: "json-string", events: { ready: "ytzero:enhance:ready", context: "ytzero:enhance:context", screenshotRequest: "ytzero:enhance:screenshot-request", screenshotResult: "ytzero:enhance:screenshot-result" } },
};
const previewInstances = [
  { url: "https://yt.wdomciu.pl", name: "YT Zero w domciu", configuration: previewConfiguration, pairedAt: 1, lastSeenAt: Date.now() },
  { url: "https://media.example.net/apps/ytzero", name: "Rodzinna biblioteka", configuration: { ...previewConfiguration, player: { ...previewConfiguration.player, preferredQuality: "auto" } }, pairedAt: 2, lastSeenAt: Date.now() },
];
const isEmptyPreview = new URL(location.href).searchParams.has("empty");
const asyncReply = (callback, value) => queueMicrotask(() => callback?.(value));
globalThis.chrome = {
  runtime: {
    lastError: null,
    getURL: (path = "") => `chrome-extension://preview/${path}`,
    sendMessage(message, callback) {
      if (message.type === "ytze-list-instances" || message.type === "ytze-get-configuration-state") {
        const list = isEmptyPreview ? [] : previewInstances;
        asyncReply(callback, { instances: list, defaultUrl: list[0]?.url || "", instance: list[0] || null, configuration: list[0]?.configuration || null });
      } else asyncReply(callback, { ok: true });
    },
    openOptionsPage() {},
  },
  storage: {
    sync: { get(defaults, callback) { asyncReply(callback, { ...defaults, instanceUrl: previewInstances[0].url, redirectEnabled: true, enhancePlayer: true }); }, set(_value, callback) { asyncReply(callback); } },
    local: { get(_keys, callback) { asyncReply(callback, {}); }, set(_value, callback) { asyncReply(callback); }, remove(_keys, callback) { asyncReply(callback); } },
    onChanged: { addListener() {} },
  },
  tabs: { query(_query, callback) { asyncReply(callback, []); }, create(_options, callback) { asyncReply(callback); }, reload(_id, callback) { asyncReply(callback); } },
  scripting: { executeScript(_options, callback) { asyncReply(callback, []); } },
  permissions: { request(_options, callback) { asyncReply(callback, true); }, remove(_options, callback) { asyncReply(callback, true); } },
};
