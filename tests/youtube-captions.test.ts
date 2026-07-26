import { expect, test } from "bun:test";
import { operateYouTubeCaptions } from "../src/youtube-captions";

test("caption operations use current tracks, translations and verified state", async () => {
  const originalDocument = globalThis.document;
  let player: any;
  let pressed = "true";
  (globalThis as any).document = {
    querySelector(selector: string) {
      if (selector === ".html5-video-player") return player;
      if (selector === ".ytmClosedCaptioningButtonButton") return { getAttribute: () => pressed };
      return null;
    },
  };

  try {
    let applied: any = null;
    player = { setOption(_module: string, _option: string, value: unknown) { applied = value; } };
    pressed = "false";
    expect(await operateYouTubeCaptions(false, "en", "English")).toMatchObject({ ok: true, enabled: false, verified: true });
    expect(applied).toEqual({});

    const english = { languageCode: "en", languageName: "English", is_translateable: true };
    player = {
      loadModule() {},
      getOption(_module: string, option: string) {
        if (option === "tracklist") return [english];
        if (option === "translationLanguages") return [{ languageCode: "iw", languageName: "Hebrew" }];
      },
      setOption(_module: string, _option: string, value: unknown) { applied = value; },
    };
    pressed = "true";
    expect(await operateYouTubeCaptions(true, "en", "English")).toMatchObject({ ok: true, enabled: true, translated: false, appliedLanguage: "en" });
    expect(applied).toBe(english);

    expect(await operateYouTubeCaptions(true, "he", "עברית")).toMatchObject({ ok: true, enabled: true, translated: true, appliedLanguage: "iw" });
    expect(applied.translationLanguage).toEqual({ languageCode: "iw", languageName: "Hebrew" });

    expect(await operateYouTubeCaptions(true, "xx", "Unknown")).toEqual({ ok: false, enabled: true, error: "caption-language-unavailable" });
  } finally {
    (globalThis as any).document = originalDocument;
  }
});
