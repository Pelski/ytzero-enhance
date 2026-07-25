import { expect, test } from "bun:test";
import { t, uiLanguage } from "../src/i18n";

const loadMessages = async (locale: string) => JSON.parse(await Bun.file(new URL(`../_locales/${locale}/messages.json`, import.meta.url)).text());

test("English, Polish and German catalogs contain the same messages", async () => {
  const catalogs = await Promise.all(["en", "pl", "de"].map(loadMessages));
  const expected = Object.keys(catalogs[0]).sort();
  for (const catalog of catalogs) {
    expect(Object.keys(catalog).sort()).toEqual(expected);
    expect(Object.values(catalog).every((entry: any) => typeof entry.message === "string" && entry.message.length > 0)).toBe(true);
  }
});

test("English is the safe fallback outside an extension runtime", () => {
  expect(uiLanguage()).toBe("en");
  expect(t("saveFrame")).toBe("Save frame");
});

test("every localized HTML key exists in the catalogs", async () => {
  const english = await loadMessages("en");
  for (const file of ["popup.html", "options.html"]) {
    const html = await Bun.file(new URL(`../static/${file}`, import.meta.url)).text();
    const keys = [...html.matchAll(/data-i18n(?:-aria|-title)?="([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
    for (const key of keys) expect(english[key]?.message, `${file}: ${key}`).toBeTruthy();
  }
  for (const file of ["popup.ts", "options.ts", "content.ts", "background.ts", "contract.ts", "instances.ts"]) {
    const source = await Bun.file(new URL(`../src/${file}`, import.meta.url)).text();
    const keys = [...source.matchAll(/\bt\("([A-Za-z0-9_]+)"\)/g)].map((match) => match[1]);
    for (const key of keys) expect(english[key]?.message, `${file}: ${key}`).toBeTruthy();
  }
});

test("public-facing copy avoids the upstream brand name", async () => {
  const forbidden = ["You", "Tube"].join("");
  for (const locale of ["en", "pl", "de"]) {
    const catalog = await loadMessages(locale);
    for (const entry of Object.values(catalog) as Array<{ message: string }>) expect(entry.message).not.toContain(forbidden);
  }
  for (const file of [
    "README.md",
    "PRIVACY.md",
    "package.json",
    "static/popup.html",
    "static/options.html",
    "docs/privacy.md",
    "docs/store-release.md",
    "docs/embedded-player-compatibility.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
  ]) {
    const copy = await Bun.file(new URL(`../${file}`, import.meta.url)).text();
    expect(copy, file).not.toContain(forbidden);
  }
  const fallbackSource = await Bun.file(new URL("../src/i18n.ts", import.meta.url)).text();
  const fallbackMessages = [...fallbackSource.matchAll(/^\s+[A-Za-z][A-Za-z0-9]+:\s*"([^"]*)"/gm)].map((match) => match[1]);
  for (const message of fallbackMessages) expect(message).not.toContain(forbidden);
});
