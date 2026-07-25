export const ext: any = (globalThis as any).browser ?? (globalThis as any).chrome;
const firefox = typeof (globalThis as any).browser !== "undefined";
const INVALIDATED_MESSAGE = "Extension context invalidated";
const invalidationListeners = new Set<() => void>();
let contextInvalidated = false;

function isInvalidation(error: unknown) {
  return String((error as any)?.message ?? error).toLowerCase().includes("extension context invalidated");
}

function markContextInvalidated() {
  if (contextInvalidated) return;
  contextInvalidated = true;
  for (const listener of invalidationListeners) { try { listener(); } catch {} }
  invalidationListeners.clear();
}

export function onExtensionContextInvalidated(listener: () => void) {
  if (contextInvalidated) { queueMicrotask(listener); return () => {}; }
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export function extensionContextAvailable() {
  try { return Boolean(ext?.runtime?.id); }
  catch { return false; }
}

export function callApi<T>(owner: any, method: string, ...args: any[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      if (!extensionContextAvailable() || !owner || typeof owner[method] !== "function") {
        markContextInvalidated();
        reject(new Error(INVALIDATED_MESSAGE));
        return;
      }
      if (firefox) {
        Promise.resolve(owner[method](...args)).then(resolve, (error) => { if (isInvalidation(error)) markContextInvalidated(); reject(error); });
        return;
      }
      owner[method](...args, (result: T) => {
        try {
          const error = ext?.runtime?.lastError;
          if (error) {
            const runtimeError = new Error(error.message);
            if (isInvalidation(runtimeError)) markContextInvalidated();
            reject(runtimeError);
          }
          else resolve(result);
        } catch (error) { if (isInvalidation(error)) markContextInvalidated(); reject(error); }
      });
    } catch (error) { if (isInvalidation(error)) markContextInvalidated(); reject(error); }
  });
}

export function addApiListener(event: any, listener: (...args: any[]) => void) {
  try {
    if (!extensionContextAvailable() || typeof event?.addListener !== "function") return false;
    event.addListener(listener);
    return true;
  } catch { return false; }
}
