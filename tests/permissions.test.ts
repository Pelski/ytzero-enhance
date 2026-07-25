import { expect, test } from "bun:test";
import { PAIRED_INSTANCE_CONTENT_SCRIPT_ID, pairedInstanceContentScriptMatches } from "../src/content-registration";
import type { PairedInstances } from "../src/instances";

const targets = ["chromium", "firefox", "safari"];

for (const target of targets) {
  test(`${target} manifest avoids static access to unrelated sites`, async () => {
    const manifest = await Bun.file(new URL(`../manifests/${target}.json`, import.meta.url)).json();
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.content_scripts.flatMap((script: any) => script.matches)).not.toContain("<all_urls>");
    expect(manifest.content_scripts[0].matches).toEqual([
      "https://www.youtube.com/*",
      "https://www.youtube-nocookie.com/*",
    ]);
  });
}

test("paired instances produce unique, exact-origin dynamic matches", () => {
  const configuration = {} as any;
  const instances: PairedInstances = {
    "https://video.example/app": { url: "https://video.example/app", name: "One", configuration, pairedAt: 1, lastSeenAt: 1 },
    "https://video.example/other": { url: "https://video.example/other", name: "Two", configuration, pairedAt: 2, lastSeenAt: 2 },
    "http://localhost:5173": { url: "http://localhost:5173", name: "Local", configuration, pairedAt: 3, lastSeenAt: 3 },
  };
  expect(PAIRED_INSTANCE_CONTENT_SCRIPT_ID).toBe("ytze-paired-instances");
  expect(pairedInstanceContentScriptMatches(instances)).toEqual([
    "http://localhost:5173/*",
    "https://video.example/*",
  ]);
});
