export const SHORTCUT_ACTIONS = [
  "togglePlay", "temporaryBoost", "seekBack10", "seekForward10", "previousVideo", "nextVideo",
  "previousFrame", "nextFrame", "speedDown", "speedUp", "seekPercent", "previousChapter",
  "nextChapter", "seekBack", "seekForward", "volumeUp", "volumeDown", "toggleCaptions",
  "subtitleLarger", "subtitleSmaller", "toggleFullscreen", "toggleTheater", "togglePictureInPicture",
  "close", "toggleMute", "screenshot",
] as const;

export type ShortcutAction = typeof SHORTCUT_ACTIONS[number];
export type ShortcutBindings = Record<ShortcutAction, string | null>;

export const DEFAULT_SHORTCUT_BINDINGS: Readonly<ShortcutBindings> = {
  togglePlay: "KeyK",
  temporaryBoost: "Space",
  seekBack10: "KeyJ",
  seekForward10: "KeyL",
  previousVideo: "Shift+KeyP",
  nextVideo: "Shift+KeyN",
  previousFrame: "Comma",
  nextFrame: "Period",
  speedDown: "Shift+Comma",
  speedUp: "Shift+Period",
  seekPercent: "Digit0-9",
  previousChapter: "Alt+ArrowLeft",
  nextChapter: "Alt+ArrowRight",
  seekBack: "ArrowLeft",
  seekForward: "ArrowRight",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  toggleCaptions: "KeyC",
  subtitleLarger: "Shift+Equal",
  subtitleSmaller: "Minus",
  toggleFullscreen: "KeyF",
  toggleTheater: "KeyT",
  togglePictureInPicture: "KeyI",
  close: "Escape",
  toggleMute: "KeyM",
  screenshot: "KeyS",
};

const ACTION_IDS = new Set<string>(SHORTCUT_ACTIONS);
const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift", "Meta"] as const;
const MODIFIERS = new Set<string>(MODIFIER_ORDER);
const CODE = /^(?:Key[A-Z]|Digit[0-9]|Digit0-9|F(?:[1-9]|1[0-2])|Numpad(?:Add|Subtract)|Arrow(?:Left|Right|Up|Down)|Space|Escape|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Comma|Period|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Backslash|Slash|Backquote)$/;

type ShortcutEventLike = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "code">;

export function normalizeShortcutChord(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 80) return undefined;
  const parts = value.split("+");
  const code = parts.pop();
  if (!code || !CODE.test(code) || parts.some((part, index) => !MODIFIERS.has(part) || parts.indexOf(part) !== index)) return undefined;
  return [...MODIFIER_ORDER.filter((modifier) => parts.includes(modifier)), code].join("+");
}

export function resolveShortcutBindings(
  value: unknown,
  diagnostic: (message: string) => void = (message) => console.warn(message),
): ShortcutBindings {
  if (value === undefined) return { ...DEFAULT_SHORTCUT_BINDINGS };
  const bindings = Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action, null])) as ShortcutBindings;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostic("YT Zero Enhance ignored a malformed keyboard shortcut map");
    return bindings;
  }
  const input = value as Record<string, unknown>;
  for (const [action, rawChord] of Object.entries(input)) {
    if (!ACTION_IDS.has(action)) continue;
    const chord = normalizeShortcutChord(rawChord);
    if (chord === undefined) {
      diagnostic(`YT Zero Enhance disabled malformed keyboard shortcut: ${action}`);
      continue;
    }
    bindings[action as ShortcutAction] = chord;
  }
  return bindings;
}

export function shortcutChordFromEvent(event: ShortcutEventLike): string | null {
  if (!CODE.test(event.code) || event.code === "Digit0-9") return null;
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", event.code]
    .filter(Boolean)
    .join("+");
}

export function shortcutMatches(event: ShortcutEventLike, chord: string | null): boolean {
  if (!chord) return false;
  const eventChord = shortcutChordFromEvent(event);
  if (chord.endsWith("Digit0-9")) {
    const prefix = chord.slice(0, -"Digit0-9".length);
    return /^Digit[0-9]$/.test(event.code) && eventChord === `${prefix}${event.code}`;
  }
  return eventChord === chord;
}

export function matchingShortcutAction(event: ShortcutEventLike, bindings: ShortcutBindings): ShortcutAction | null {
  for (const action of SHORTCUT_ACTIONS) if (shortcutMatches(event, bindings[action])) return action;
  return null;
}

export class ShortcutRegistry {
  #bindings: ShortcutBindings = { ...DEFAULT_SHORTCUT_BINDINGS };

  constructor(value: unknown = undefined, diagnostic?: (message: string) => void) {
    this.replace(value, diagnostic);
  }

  replace(value: unknown, diagnostic?: (message: string) => void): void {
    this.#bindings = resolveShortcutBindings(value, diagnostic);
  }

  match(event: ShortcutEventLike): ShortcutAction | null {
    return matchingShortcutAction(event, this.#bindings);
  }

  binding(action: ShortcutAction): string | null {
    return this.#bindings[action];
  }
}

export function isEditableShortcutEvent(event: Pick<KeyboardEvent, "target" | "composedPath">): boolean {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  return path.some((target) => {
    const element = target as Element | null;
    const tag = String((element as any)?.tagName ?? "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select"
      || Boolean((element as any)?.isContentEditable)
      || Boolean((element as any)?.closest?.("[contenteditable]"));
  });
}

const REPEATABLE_ACTIONS = new Set<ShortcutAction>([
  "seekBack10", "seekForward10", "seekBack", "seekForward", "volumeUp", "volumeDown",
]);

export function shortcutAllowsRepeat(action: ShortcutAction): boolean {
  return REPEATABLE_ACTIONS.has(action);
}

export const PARENT_OWNED_SHORTCUT_ACTIONS = new Set<ShortcutAction>([
  "previousVideo", "nextVideo", "toggleTheater", "close",
]);

const TRANSPORT_ACTIONS = new Set<ShortcutAction>([
  "togglePlay", "temporaryBoost", "seekBack10", "seekForward10", "previousVideo", "nextVideo",
  "previousFrame", "nextFrame", "speedDown", "speedUp", "seekPercent", "previousChapter",
  "nextChapter", "seekBack", "seekForward",
]);

const LIVESTREAM_BLOCKED_ACTIONS = new Set<ShortcutAction>([
  "temporaryBoost", "previousFrame", "nextFrame", "speedDown", "speedUp", "seekPercent",
]);

export function shortcutOperationBlocked(action: ShortcutAction, livestream: boolean, transportLocked: boolean): boolean {
  return (transportLocked && TRANSPORT_ACTIONS.has(action)) || (livestream && LIVESTREAM_BLOCKED_ACTIONS.has(action));
}

export function stepShortcutPlaybackRate(current: number, direction: -1 | 1): number {
  const safeCurrent = Number.isFinite(current) ? current : 1;
  const stepped = Math.round((safeCurrent + direction * .25) / .25) * .25;
  return Math.min(2, Math.max(.25, stepped));
}

export class OwnedPlaybackRate {
  #value = 1;

  constructor(rate: number = 1, livestream = false) {
    this.reset(rate, livestream);
  }

  get value(): number { return this.#value; }

  reset(rate: number, livestream = false): number {
    const safeRate = Number.isFinite(rate) ? rate : 1;
    this.#value = livestream ? 1 : Math.min(4, Math.max(.25, safeRate));
    return this.#value;
  }

  step(direction: -1 | 1): number {
    this.#value = stepShortcutPlaybackRate(this.#value, direction);
    return this.#value;
  }
}

export function advanceOwnedPlaybackRate(
  ownedRate: OwnedPlaybackRate,
  direction: -1 | 1,
  applyPlaybackRate: (rate: number) => void | Promise<unknown>,
): number {
  const nextRate = ownedRate.step(direction);
  void Promise.resolve(applyPlaybackRate(nextRate)).catch(() => {});
  return nextRate;
}

export function chapterShortcutTarget(action: "previousChapter" | "nextChapter", currentTime: number, chapters: Array<{ start: number }>): number | null {
  if (!Number.isFinite(currentTime) || !chapters.length) return null;
  const starts = chapters.map((chapter) => chapter.start).filter(Number.isFinite).sort((a, b) => a - b);
  if (!starts.length) return null;
  if (action === "previousChapter") return [...starts].reverse().find((start) => start < currentTime - 1) ?? 0;
  return starts.find((start) => start > currentTime + 1) ?? null;
}

export function shortcutEventPayload(action: ShortcutAction, event: Pick<KeyboardEvent, "key" | "code" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">, value?: number) {
  return {
    action,
    key: event.key,
    code: event.code,
    repeat: event.repeat,
    ...(typeof value === "number" ? { value } : {}),
    modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey },
  };
}

type TemporaryBoostEvent = Pick<KeyboardEvent, "key" | "code" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

export interface TemporaryBoostDependencies {
  schedule(callback: () => void, delay: number): number;
  cancel(timer: number): void;
  isBlocked(): boolean;
  togglePlay(): void | Promise<void>;
  setRate(rate: number): void;
  effectiveRate(): number;
  applied(event: TemporaryBoostEvent, value?: number): void;
}

export class TemporaryBoostController {
  #timer = 0;
  #active = false;
  #chord: string | null = null;
  #event: TemporaryBoostEvent | null = null;

  constructor(private readonly dependencies: TemporaryBoostDependencies) {}

  get active(): boolean { return this.#active; }
  get pending(): boolean { return this.#timer !== 0; }
  get chord(): string | null { return this.#chord; }

  keydown(event: TemporaryBoostEvent): void {
    if (event.repeat || this.#timer || this.#active || this.dependencies.isBlocked()) return;
    this.#chord = shortcutChordFromEvent(event);
    this.#event = event;
    this.#timer = this.dependencies.schedule(() => {
      this.#timer = 0;
      if (this.dependencies.isBlocked()) {
        this.#chord = null;
        this.#event = null;
        return;
      }
      this.#active = true;
      this.dependencies.setRate(2);
      if (this.#event) this.dependencies.applied(this.#event, 2);
    }, 220);
  }

  keyup(event: TemporaryBoostEvent): boolean {
    if (!this.#chord || shortcutChordFromEvent(event) !== this.#chord) return false;
    const pressedEvent = this.#event;
    this.#chord = null;
    this.#event = null;
    if (this.#timer) {
      this.dependencies.cancel(this.#timer);
      this.#timer = 0;
      void this.dependencies.togglePlay();
      if (pressedEvent) this.dependencies.applied(pressedEvent);
    } else if (this.#active) {
      this.#active = false;
      this.dependencies.setRate(this.dependencies.effectiveRate());
    }
    return true;
  }

  reset(): void {
    if (this.#timer) this.dependencies.cancel(this.#timer);
    if (this.#active) this.dependencies.setRate(this.dependencies.effectiveRate());
    this.#timer = 0;
    this.#active = false;
    this.#chord = null;
    this.#event = null;
  }
}
