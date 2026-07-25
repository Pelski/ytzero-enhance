import { describe, expect, test } from "bun:test";
import { containedMediaRect, localWatchUrl, parseTimestamp, safeFilename, screenshotFilename, youtubeVideoId } from "../src/core";

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
});

test("timestamps", () => {
  expect(parseTimestamp("1h2m3s")).toBe(3723);
  expect(parseTimestamp("90")).toBe(90);
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
