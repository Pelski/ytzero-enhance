export const ext: any = (globalThis as any).browser ?? (globalThis as any).chrome;
const firefox = typeof (globalThis as any).browser !== "undefined";
const INVALIDATED_MESSAGE = "Extension context invalidated";

export function extensionContextAvailable() {
  try { return Boolean(ext?.runtime?.id); }
  catch { return false; }
}

export function callApi<T>(owner: any, method: string, ...args: any[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      if (!extensionContextAvailable() || !owner || typeof owner[method] !== "function") {
        reject(new Error(INVALIDATED_MESSAGE));
        return;
      }
      if (firefox) {
        Promise.resolve(owner[method](...args)).then(resolve, reject);
        return;
      }
      owner[method](...args, (result: T) => {
        try {
          const error = ext?.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve(result);
        } catch (error) { reject(error); }
      });
    } catch (error) { reject(error); }
  });
}

export function addApiListener(event: any, listener: (...args: any[]) => void) {
  try {
    if (!extensionContextAvailable() || typeof event?.addListener !== "function") return false;
    event.addListener(listener);
    return true;
  } catch { return false; }
}
