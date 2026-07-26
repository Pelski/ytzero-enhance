export interface YouTubeCaptionOperationResult {
  ok: boolean;
  enabled?: boolean;
  language?: string;
  appliedLanguage?: string;
  translated?: boolean;
  verified?: boolean;
  error?: string;
}

/**
 * Runs in the embedded player's MAIN world. Keep this function self-contained:
 * browser.scripting.executeScript serializes it without module scope.
 */
export async function operateYouTubeCaptions(turnOn: boolean, languageCode: string, languageLabel: string): Promise<YouTubeCaptionOperationResult> {
  const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const currentButton = () => document.querySelector<HTMLElement>(".ytmClosedCaptioningButtonButton");
  const currentButtonState = () => {
    const pressed = currentButton()?.getAttribute("aria-pressed");
    return pressed === "true" ? true : pressed === "false" ? false : null;
  };
  const player = document.querySelector(".html5-video-player") as any;
  if (!player || typeof player.setOption !== "function") return { ok: false, enabled: currentButtonState() === true, error: "caption-api-unavailable" };

  if (!turnOn) {
    try { player.setOption("captions", "track", {}); }
    catch (error) { return { ok: false, enabled: currentButtonState() === true, error: String(error).slice(0, 200) }; }
    await sleep(400);
    const state = currentButtonState();
    return state === true
      ? { ok: false, enabled: true, verified: false, error: "caption-disable-rejected" }
      : { ok: true, enabled: false, language: languageCode, verified: state === false };
  }

  if (typeof player.loadModule === "function") player.loadModule("captions");
  let tracks: any[] = [];
  let translationLanguages: any[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      tracks = player.getOption?.("captions", "tracklist");
      translationLanguages = player.getOption?.("captions", "translationLanguages");
    } catch {}
    if (Array.isArray(tracks) && tracks.length) break;
    tracks = [];
    await sleep(100);
  }
  if (!tracks.length) return { ok: false, enabled: currentButtonState() === true, error: "caption-tracks-unavailable" };
  if (!Array.isArray(translationLanguages)) translationLanguages = [];

  const normalize = (value: unknown) => String(value ?? "").trim().replace(/_/g, "-").toLowerCase();
  const requested = normalize(languageCode);
  const aliases: Record<string, string> = { he: "iw", iw: "he" };
  const candidates = [requested, aliases[requested]];
  if (requested.includes("-") && !requested.startsWith("zh-")) candidates.push(requested.split("-")[0]);
  const acceptedCodes = new Set(candidates.filter(Boolean));

  const exact = tracks.find((track) => acceptedCodes.has(normalize(track?.languageCode ?? track?.language_code)));
  let selectedTrack: any;
  let appliedLanguage = languageCode;
  let translated = false;
  if (exact) {
    selectedTrack = exact;
    appliedLanguage = String(exact.languageCode ?? exact.language_code ?? languageCode);
  } else {
    const translation = translationLanguages.find((language) => acceptedCodes.has(normalize(language?.languageCode ?? language?.language_code)));
    if (!translation) return { ok: false, enabled: currentButtonState() === true, error: "caption-language-unavailable" };
    const source = tracks.find((track) => track?.is_translateable === true || track?.isTranslatable === true || track?.is_translatable === true);
    if (!source) return { ok: false, enabled: currentButtonState() === true, error: "caption-translation-unavailable" };
    appliedLanguage = String(translation.languageCode ?? translation.language_code ?? languageCode);
    selectedTrack = {
      ...source,
      translationLanguage: {
        languageCode: appliedLanguage,
        languageName: String(translation.languageName ?? translation.language_name ?? (languageLabel || appliedLanguage)),
      },
    };
    translated = true;
  }

  try { player.setOption("captions", "track", selectedTrack); }
  catch (error) { return { ok: false, enabled: currentButtonState() === true, error: String(error).slice(0, 200) }; }
  await sleep(500);
  const state = currentButtonState();
  if (state === false) return { ok: false, enabled: false, verified: false, error: "caption-enable-rejected" };
  return { ok: true, enabled: true, language: languageCode, appliedLanguage, translated, verified: state === true };
}
