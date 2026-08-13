import { describe, expect, test } from "bun:test";
import { validateEnhanceContext, validatePlayerEvent } from "../src/contract";
import {
  advanceOwnedPlaybackRate,
  chapterShortcutTarget,
  DEFAULT_SHORTCUT_BINDINGS,
  isEditableShortcutEvent,
  matchingShortcutAction,
  OwnedPlaybackRate,
  PARENT_OWNED_SHORTCUT_ACTIONS,
  resolveShortcutBindings,
  shortcutAllowsRepeat,
  shortcutChordFromEvent,
  shortcutEventPayload,
  shortcutMatches,
  shortcutOperationBlocked,
  SHORTCUT_ACTIONS,
  ShortcutRegistry,
  stepShortcutPlaybackRate,
  TemporaryBoostController,
  type ShortcutBindings,
} from "../src/shortcuts";

const keyEvent = (code: string, patch: Record<string, unknown> = {}) => {
  const target = patch.target ?? { tagName: "DIV", closest: () => null };
  return {
    key: code,
    code,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target,
    composedPath: () => [target],
    ...patch,
  } as unknown as KeyboardEvent;
};

const completeBindings = (patch: Partial<ShortcutBindings> = {}): ShortcutBindings => ({
  ...DEFAULT_SHORTCUT_BINDINGS,
  ...patch,
});

describe("shortcut chord contract", () => {
  test("matches physical code and the exact modifier set", () => {
    expect(shortcutMatches(keyEvent("Comma", { key: ";", shiftKey: true }), "Shift+Comma")).toBe(true);
    expect(shortcutMatches(keyEvent("Comma", { shiftKey: true }), "Comma")).toBe(false);
    expect(shortcutMatches(keyEvent("Comma", { shiftKey: true, altKey: true }), "Shift+Comma")).toBe(false);
    expect(shortcutMatches(keyEvent("KeyX", { key: "ź" }), "KeyX")).toBe(true);
  });

  test("honors null, ignores unknown actions and expands only Digit0-9", () => {
    const diagnostics: string[] = [];
    const bindings = resolveShortcutBindings({
      ...completeBindings(),
      toggleMute: null,
      futureAction: "KeyQ",
    }, (message) => diagnostics.push(message));
    expect(matchingShortcutAction(keyEvent("KeyM"), bindings)).toBeNull();
    expect(matchingShortcutAction(keyEvent("Digit0"), bindings)).toBe("seekPercent");
    expect(matchingShortcutAction(keyEvent("Digit9"), bindings)).toBe("seekPercent");
    expect(matchingShortcutAction(keyEvent("Numpad9"), bindings)).toBeNull();
    expect((bindings as Record<string, unknown>).futureAction).toBeUndefined();
    expect(diagnostics).toEqual([]);
  });

  test("ignores editable composed paths and modifier-only events", () => {
    const editable = { tagName: "DIV", isContentEditable: true, closest: () => null };
    const event = keyEvent("KeyK", { target: { tagName: "SPAN" }, composedPath: () => [{ tagName: "SPAN" }, editable] });
    expect(isEditableShortcutEvent(event)).toBe(true);
    expect(isEditableShortcutEvent(keyEvent("KeyK", { target: { tagName: "TEXTAREA" } }))).toBe(true);
    expect(isEditableShortcutEvent(keyEvent("KeyK"))).toBe(false);
    expect(shortcutChordFromEvent(keyEvent("ShiftLeft", { shiftKey: true }))).toBeNull();
  });
});

describe("context installation", () => {
  test("replaces the complete map atomically and removes the old chord", () => {
    const registry = new ShortcutRegistry(completeBindings());
    expect(registry.match(keyEvent("KeyK"))).toBe("togglePlay");
    registry.replace(completeBindings({ togglePlay: "KeyX" }));
    expect(registry.match(keyEvent("KeyK"))).toBeNull();
    expect(registry.match(keyEvent("KeyX"))).toBe("togglePlay");
  });

  test("missing map uses defaults while malformed entries disable only themselves", () => {
    const base = {
      version: 1,
      active: true,
      video: { id: "dQw4w9WgXcQ", title: "Film", channelId: "UC1", channelTitle: "Channel", duration: 100 },
      playback: {
        rate: 1,
        keyboardSeekSeconds: 5,
        frameStepFps: 30,
        captions: { enabledByDefault: false, language: "en", style: {} },
        chapters: [],
        sponsorBlockSegments: [],
      },
      screenshot: { format: "png", quality: .9, filenameTemplate: "{title}" },
    };
    expect(validateEnhanceContext(base)?.playback.keyboardShortcuts.togglePlay).toBe("KeyK");
    const diagnostics: string[] = [];
    const bindings = resolveShortcutBindings(completeBindings({ togglePlay: "not a chord", toggleMute: null }), (message) => diagnostics.push(message));
    expect(bindings.togglePlay).toBeNull();
    expect(bindings.toggleMute).toBeNull();
    expect(bindings.screenshot).toBe("KeyS");
    expect(diagnostics).toHaveLength(1);
  });

  test("context carries transport lock and a complete validated map", () => {
    const context = validateEnhanceContext({
      version: 1,
      active: true,
      video: { id: "dQw4w9WgXcQ", title: "Film", channelId: "UC1", channelTitle: "Channel", duration: 100 },
      playback: {
        rate: 1.25,
        keyboardSeekSeconds: 8,
        frameStepFps: 24,
        keyboardShortcuts: completeBindings({ togglePlay: "KeyX" }),
        transportLocked: true,
        captions: { enabledByDefault: false, language: "en", style: {} },
        chapters: [],
        sponsorBlockSegments: [],
      },
      screenshot: { format: "png", quality: .9, filenameTemplate: "{title}" },
    });
    expect(context?.playback.transportLocked).toBe(true);
    expect(context?.playback.keyboardShortcuts.togglePlay).toBe("KeyX");
  });
});

describe("shortcut execution policy", () => {
  test("allows repeats only for continuous seek and volume actions", () => {
    for (const action of ["seekBack10", "seekForward10", "seekBack", "seekForward", "volumeUp", "volumeDown"] as const) {
      expect(shortcutAllowsRepeat(action)).toBe(true);
    }
    for (const action of ["togglePlay", "temporaryBoost", "toggleMute", "toggleFullscreen", "togglePictureInPicture", "previousVideo", "speedUp"] as const) {
      expect(shortcutAllowsRepeat(action)).toBe(false);
    }
  });

  test("delegates every parent-owned action as one camelCase shortcut payload", () => {
    expect([...PARENT_OWNED_SHORTCUT_ACTIONS]).toEqual(["previousVideo", "nextVideo", "toggleTheater", "close"]);
    for (const action of PARENT_OWNED_SHORTCUT_ACTIONS) {
      const payload = shortcutEventPayload(action, keyEvent("KeyX"));
      expect(payload.action).toBe(action);
      expect(payload).not.toHaveProperty("value");
    }
  });

  test("keeps native PiP in the action registry and excludes miniplayer and spherical actions", () => {
    expect(DEFAULT_SHORTCUT_BINDINGS.togglePictureInPicture).toBe("KeyI");
    expect(SHORTCUT_ACTIONS).toContain("togglePictureInPicture");
    expect(SHORTCUT_ACTIONS).not.toContain("toggleMiniplayer" as any);
    expect(SHORTCUT_ACTIONS.some((action) => /spher|360/i.test(action))).toBe(false);
  });

  test("blocks livestream-only operations and Watch Together transport", () => {
    for (const action of ["temporaryBoost", "previousFrame", "nextFrame", "speedDown", "speedUp", "seekPercent"] as const) {
      expect(shortcutOperationBlocked(action, true, false)).toBe(true);
    }
    expect(shortcutOperationBlocked("togglePlay", true, false)).toBe(false);
    expect(shortcutOperationBlocked("seekForward", true, false)).toBe(false);
    for (const action of ["togglePlay", "seekBack10", "previousChapter", "speedUp", "previousVideo", "nextVideo"] as const) {
      expect(shortcutOperationBlocked(action, false, true)).toBe(true);
    }
    expect(shortcutOperationBlocked("toggleTheater", false, true)).toBe(false);
    expect(shortcutOperationBlocked("toggleMute", false, true)).toBe(false);
  });

  test("steps speed, clamps it, and applies chapter hysteresis", () => {
    expect(stepShortcutPlaybackRate(1, 1)).toBe(1.25);
    expect(stepShortcutPlaybackRate(1, -1)).toBe(.75);
    expect(stepShortcutPlaybackRate(.25, -1)).toBe(.25);
    expect(stepShortcutPlaybackRate(2, 1)).toBe(2);
    const chapters = [{ start: 0 }, { start: 30 }, { start: 60 }];
    expect(chapterShortcutTarget("previousChapter", 30.5, chapters)).toBe(0);
    expect(chapterShortcutTarget("previousChapter", 32, chapters)).toBe(30);
    expect(chapterShortcutTarget("nextChapter", 30, chapters)).toBe(60);
    expect(chapterShortcutTarget("nextChapter", 60, chapters)).toBeNull();
  });

  test("rapid speed presses accumulate from owned state while the player getter stays stale", () => {
    const ownedRate = new OwnedPlaybackRate(1);
    let reportedPlayerRate = 1;
    const delayedResponses: Array<() => void> = [];
    const applied: number[] = [];
    const payloadValues: number[] = [];

    for (let press = 0; press < 3; press++) {
      const nextRate = advanceOwnedPlaybackRate(ownedRate, 1, (rate) => {
        expect(reportedPlayerRate).toBe(1);
        applied.push(rate);
        return new Promise<void>((resolve) => delayedResponses.push(() => {
          reportedPlayerRate = rate;
          resolve();
        }));
      });
      payloadValues.push(shortcutEventPayload("speedUp", keyEvent("Period", { shiftKey: true }), nextRate).value!);
    }

    expect(applied).toEqual([1.25, 1.5, 1.75]);
    expect(payloadValues).toEqual([1.25, 1.5, 1.75]);
    expect(ownedRate.value).toBe(1.75);
    for (const respond of delayedResponses.reverse()) respond();
    expect(reportedPlayerRate).toBe(1.25);
    expect(ownedRate.value).toBe(1.75);
  });

  test("external rate changes reset owned state and livestream pins it to 1x", () => {
    const ownedRate = new OwnedPlaybackRate(1);
    ownedRate.reset(1.5);
    expect(ownedRate.step(1)).toBe(1.75);
    expect(ownedRate.reset(2, true)).toBe(1);
    expect(ownedRate.value).toBe(1);
  });
});

describe("temporary boost", () => {
  test("short press toggles once; hold enters 2x once and restores the latest effective rate", () => {
    let scheduled: (() => void) | null = null;
    let toggles = 0;
    const ownedRate = new OwnedPlaybackRate(1);
    const rates: number[] = [];
    const applied: Array<number | undefined> = [];
    const controller = new TemporaryBoostController({
      schedule: (callback) => { scheduled = callback; return 1; },
      cancel: () => { scheduled = null; },
      isBlocked: () => false,
      togglePlay: () => { toggles++; },
      setRate: (rate) => rates.push(rate),
      effectiveRate: () => ownedRate.value,
      applied: (_event, value) => applied.push(value),
    });

    controller.keydown(keyEvent("Space"));
    expect(controller.keyup(keyEvent("Space"))).toBe(true);
    expect(toggles).toBe(1);
    expect(applied).toEqual([undefined]);

    controller.keydown(keyEvent("Space"));
    controller.keydown(keyEvent("Space", { repeat: true }));
    const fireHold = scheduled as unknown as (() => void);
    fireHold();
    expect(rates).toEqual([2]);
    expect(ownedRate.value).toBe(1);
    expect(applied).toEqual([undefined, 2]);
    ownedRate.reset(1.5);
    expect(controller.keyup(keyEvent("Space"))).toBe(true);
    expect(rates).toEqual([2, 1.5]);
    expect(toggles).toBe(1);
  });
});

describe("isolated-world shortcut transport", () => {
  for (const browser of ["Chrome", "Firefox"]) {
    test(`${browser} keeps bridge v1 and JSON-string detail`, () => {
      const detail = JSON.stringify({
        version: 1,
        videoId: "dQw4w9WgXcQ",
        type: "shortcut",
        timestamp: 1,
        payload: shortcutEventPayload("speedUp", keyEvent("Period", { key: ">", shiftKey: true }), 1.25),
      });
      expect(typeof detail).toBe("string");
      const event = validatePlayerEvent(JSON.parse(detail));
      expect(event?.version).toBe(1);
      expect(event?.payload.action).toBe("speedUp");
      expect(event?.payload.value).toBe(1.25);
      expect(event?.payload.modifiers).toEqual({ alt: false, ctrl: false, meta: false, shift: true });
    });
  }
});
