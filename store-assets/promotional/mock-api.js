const locale = new URL(location.href).searchParams.get("locale") || "en";
const messages = {
  pl: {
    extensionName: "YT Zero Enhance", instancesAndSettings: "Instancje i ustawienia", browserExtension: "Rozszerzenie przeglądarki",
    optionsIntro: "Połączone instancje i ustawienia aktywnego profilu.", yourYtZero: "Twoje YT Zero", connectedInstances: "Połączone instancje",
    addAnotherHelp: "Aby dodać kolejną, otwórz ją i użyj ikony rozszerzenia.", defaultBadge: "Domyślna", open: "Otwórz", remove: "Usuń",
    defaultInstance: "Domyślna instancja", settings: "Ustawienia", changeInYtZero: "Zmień w YT Zero",
    readonlyNote: "Te wartości pochodzą z aktywnego profilu YT Zero i są tutaj tylko do podglądu.", integration: "Integracja",
    enabled: "Włączone", disabled: "Wyłączone", ytZeroControls: "Kontrolki YT Zero", quality: "Jakość", speed: "Prędkość",
    seek: "Przewijanie", seconds: "sekund", frameStep: "Krok klatkowy", captions: "Napisy", disabledByDefault: "Domyślnie wyłączone",
    screenshots: "Zrzuty klatek", category: "kategoria", categories: "kategorie",
    defaultInstanceTip: "Do tej instancji trafiają przekierowane linki do filmów. Odtwarzacz na każdej połączonej instancji korzysta z jej własnego profilu.",
  },
  de: {
    extensionName: "YT Zero Enhance", instancesAndSettings: "Instanzen und Einstellungen", browserExtension: "Browser-Erweiterung",
    optionsIntro: "Verbundene Instanzen und Einstellungen des aktiven Profils.", yourYtZero: "Dein YT Zero", connectedInstances: "Verbundene Instanzen",
    addAnotherHelp: "Öffne eine weitere Instanz und verwende das Erweiterungssymbol, um sie hinzuzufügen.", defaultBadge: "Standard", open: "Öffnen", remove: "Entfernen",
    defaultInstance: "Standardinstanz", settings: "Einstellungen", changeInYtZero: "In YT Zero ändern",
    readonlyNote: "Diese Werte stammen aus dem aktiven YT-Zero-Profil und sind hier schreibgeschützt.", integration: "Integration",
    enabled: "Aktiviert", disabled: "Deaktiviert", ytZeroControls: "YT-Zero-Steuerung", quality: "Qualität", speed: "Geschwindigkeit",
    seek: "Spulen", seconds: "Sekunden", frameStep: "Einzelbildschritt", captions: "Untertitel", disabledByDefault: "Standardmäßig deaktiviert",
    screenshots: "Screenshots", category: "Kategorie", categories: "Kategorien",
    defaultInstanceTip: "Umgeleitete Videolinks werden an diese Instanz gesendet. Der Player jeder verbundenen Instanz verwendet das jeweilige Profil.",
  },
};
const configuration = {
  format: "ytzero.enhance-configuration", version: 1, enabled: true,
  player: {
    replaceControls: true, language: locale, preferredQuality: "2160p", defaultPlaybackRate: 1,
    keyboardSeekSeconds: 15, frameStepFps: 30, autoFullscreenLandscape: false,
    captions: {
      enabledByDefault: false, language: locale, availableLanguages: [],
      style: { fontSizePx: 19, color: "#ffffff", backgroundOpacityPercent: 75 },
    },
  },
  screenshots: { format: "jpeg", jpegQuality: .92, filenameTemplate: "{channel}_{title}_{timestamp_ms}", templateFields: [] },
  sponsorBlock: { enabled: true, categories: ["sponsor", "intro", "outro"] },
  bridge: { version: 1, detailEncoding: "json-string", events: { ready: "ytzero:enhance:ready", context: "ytzero:enhance:context", screenshotRequest: "ytzero:enhance:screenshot-request", screenshotResult: "ytzero:enhance:screenshot-result" } },
};
const instance = { url: "http://localhost:5173", name: "localhost", configuration, pairedAt: 1, lastSeenAt: Date.now() };
const asyncReply = (callback, value) => queueMicrotask(() => callback?.(value));
const reply = (callback, value) => callback ? asyncReply(callback, value) : Promise.resolve(value);
const previewChrome = {
  i18n: { getUILanguage: () => locale, getMessage: (key) => messages[locale]?.[key] || "" },
  runtime: {
    id: "preview",
    lastError: null,
    getURL: (path = "") => `chrome-extension://preview/${path}`,
    sendMessage(message, callback) {
      if (message.type === "ytze-list-instances" || message.type === "ytze-get-configuration-state") {
        return reply(callback, { instances: [instance], defaultUrl: instance.url, instance, configuration });
      }
      return reply(callback, { ok: true });
    },
    openOptionsPage() {},
  },
  storage: {
    sync: { get(defaults, callback) { asyncReply(callback, { ...defaults, instanceUrl: instance.url, redirectEnabled: true, enhancePlayer: true }); }, set(_value, callback) { asyncReply(callback); } },
    local: { get(_keys, callback) { asyncReply(callback, {}); }, set(_value, callback) { asyncReply(callback); }, remove(_keys, callback) { asyncReply(callback); } },
    onChanged: { addListener() {} },
  },
  tabs: { query(_query, callback) { asyncReply(callback, []); }, create(_options, callback) { asyncReply(callback); }, reload(_id, callback) { asyncReply(callback); } },
  scripting: { executeScript(_options, callback) { asyncReply(callback, []); } },
  permissions: { request(_options, callback) { asyncReply(callback, true); }, remove(_options, callback) { asyncReply(callback, true); } },
};
globalThis.browser = previewChrome;
