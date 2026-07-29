import { describe, expect, test } from "bun:test";
import { containedMediaRect, embeddedPlayerModeForPage, hasNoRedirectMarker, isRedirectableYouTubeUrl, localContentUrl, localWatchUrl, parseTimestamp, playableLiveRange, playerTimeline, resolveEmbeddedPlayerMode, safeFilename, screenshotFilename, youtubePlaylistId, youtubeVideoId } from "../src/core";

describe("YouTube URL mapping", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts %s", (url, id) => expect(youtubeVideoId(url)).toBe(id));

  test("does not redirect embeds", () => expect(localWatchUrl("https://www.youtube.com/embed/dQw4w9WgXcQ", "http://localhost:3001")).toBeNull());
  test("preserves a reverse-proxy base path and timestamp", () => expect(localWatchUrl("https://youtu.be/dQw4w9WgXcQ?t=1m2s", "https://home.test/apps/ytzero/")).toBe("https://home.test/apps/ytzero/watch/dQw4w9WgXcQ?t=62"));
  test("preserves playlist context on watch URLs", () => {
    const source = "https://www.youtube.com/watch?v=1T9xQy-dsQo&list=PLFwX-cbGMT6Rwt2RgjFa6gThFyCay_0Zl&t=42s";
    expect(localContentUrl(source, "https://home.test/apps/ytzero")).toBe("https://home.test/apps/ytzero/watch/1T9xQy-dsQo/playlist/PLFwX-cbGMT6Rwt2RgjFa6gThFyCay_0Zl?t=42");
  });
  test("maps manual video, playlist and channel redirects", () => {
    const instance = "https://home.test/apps/ytzero";
    expect(localContentUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ#ytNoRedirect", instance)).toBe("https://home.test/apps/ytzero/watch/dQw4w9WgXcQ");
    expect(localContentUrl("https://www.youtube.com/playlist?list=PL1234567890", instance)).toBe("https://home.test/apps/ytzero/playlist/PL1234567890");
    expect(localContentUrl("https://www.youtube.com/show/VLPLJ6RfgV0G_-g?sbp=Kgstb0poXzBXYi1nb0AB", instance)).toBe("https://home.test/apps/ytzero/playlist/PLJ6RfgV0G_-g");
    expect(localContentUrl("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", instance)).toBe("https://home.test/apps/ytzero/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(localContentUrl("https://www.youtube.com/@GoogleDevelopers/videos", instance)).toBe("https://home.test/apps/ytzero/search?q=%40GoogleDevelopers");
    expect(localContentUrl("https://www.youtube.com/@GoogleDevelopers", instance, "UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe("https://home.test/apps/ytzero/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });
  test("redirects current and legacy public-playlist URLs automatically", () => {
    expect(youtubePlaylistId("https://www.youtube.com/playlist?list=PL1234567890")).toBe("PL1234567890");
    expect(youtubePlaylistId("https://www.youtube.com/show/VLPLJ6RfgV0G_-g?sbp=ignored")).toBe("PLJ6RfgV0G_-g");
    expect(isRedirectableYouTubeUrl("https://www.youtube.com/show/VLPLJ6RfgV0G_-g?sbp=ignored")).toBe(true);
    expect(isRedirectableYouTubeUrl("https://www.youtube.com/show/VLPLJ6RfgV0G_-g#ytNoRedirect")).toBe(false);
  });
  test("the no-redirect marker blocks only automatic redirects", () => {
    const source = "https://www.youtube.com/watch?v=dQw4w9WgXcQ#section&ytNoRedirect";
    expect(hasNoRedirectMarker(source)).toBe(true);
    expect(isRedirectableYouTubeUrl(source)).toBe(false);
    expect(localWatchUrl(source, "https://home.test")).toBeNull();
  });
});

test("timestamps", () => {
  expect(parseTimestamp("1h2m3s")).toBe(3723);
  expect(parseTimestamp("90")).toBe(90);
});

test("embedded player modes and live timeline", () => {
  expect(embeddedPlayerModeForPage("https://home.test/apps/ytzero/shorts/dQw4w9WgXcQ")).toBe("shorts");
  expect(embeddedPlayerModeForPage("https://home.test/apps/ytzero/watch/dQw4w9WgXcQ")).toBe("standard");
  expect(resolveEmbeddedPlayerMode("standard", true, true)).toBe("standard");
  expect(resolveEmbeddedPlayerMode("shorts", true, true)).toBe("shorts");
  expect(resolveEmbeddedPlayerMode("standard", false, true)).toBe("live");
  expect(playerTimeline(125, Infinity, { start: 100, end: 130 })).toEqual({
    start: 100, end: 130, length: 30, fraction: 5 / 6, liveDelay: 5,
  });
  expect(playerTimeline(80, 100)).toEqual({ start: 0, end: 100, length: 100, fraction: .8, liveDelay: null });
  expect(playableLiveRange(100, 140, 125, 132, 128)).toEqual({ start: 100, end: 131.5 });
  expect(playableLiveRange(100, 140, 125, null, 128)).toEqual({ start: 100, end: 128 });
  expect(playableLiveRange(100, 140, 135, 132, 128)).toEqual({ start: 100, end: 135 });
});

test("safe screenshot names", () => {
  expect(safeFilename('a<b>:c/')).toBe("a_b__c_");
  expect(screenshotFilename("{channel}_{title}_{timestamp_ms}", { channel: "Kanał", title: "Film", seconds: 62.125 }, "png")).toBe("Kanał_Film_01-02-125.png");
  expect(screenshotFilename("CON", {}, "webp")).toBe("_CON.webp");
});

test("crops object-fit contain letterboxing", () => {
  expect(containedMediaRect({ x: 10, y: 20, width: 1000, height: 1000 }, 1920, 1080)).toEqual({ x: 10, y: 238.75, width: 1000, height: 562.5 });
  expect(containedMediaRect({ x: 10, y: 20, width: 1000, height: 400 }, 1000, 1000)).toEqual({ x: 310, y: 20, width: 400, height: 400 });
});
