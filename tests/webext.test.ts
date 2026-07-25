import { expect, test } from "bun:test";
import { callApi, extensionContextAvailable, onExtensionContextInvalidated } from "../src/webext";

test("an invalidated extension context becomes a rejected promise, not an uncaught throw", async () => {
  expect(extensionContextAvailable()).toBe(false);
  let retired = false;
  onExtensionContextInvalidated(() => { retired = true; });
  let request!: Promise<unknown>;
  expect(() => { request = callApi({ broken() { throw new Error("must not escape"); } }, "broken"); }).not.toThrow();
  await expect(request).rejects.toThrow("Extension context invalidated");
  expect(retired).toBe(true);
});
