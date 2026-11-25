import { afterEach, expect, it, vi } from "vitest";
import { browserUuid } from "../../src/browser/uuid.js";

afterEach(() => vi.unstubAllGlobals());

it("uses native randomUUID when available", () => {
  const uuid = "18570acd-e1c1-4dd3-9586-4f68fa516de2";
  const randomUUID = vi.fn(() => uuid);
  const getRandomValues = vi.fn();
  vi.stubGlobal("crypto", { randomUUID, getRandomValues });

  expect(browserUuid()).toBe(uuid);
  expect(randomUUID).toHaveBeenCalledOnce();
  expect(getRandomValues).not.toHaveBeenCalled();
});

it("sets the UUID v4 version and variant bits when randomUUID is missing", () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(0xff));
  vi.stubGlobal("crypto", { getRandomValues });

  expect(browserUuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
});
