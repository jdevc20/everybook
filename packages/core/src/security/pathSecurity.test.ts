import { describe, expect, it } from "vitest";
import { assertSafeEbkPath, sanitizeEbkPath } from "./pathSecurity";

describe("EBK path security", () => {
  it.each([
    "https://example.com/a.png",
    "javascript:alert(1)",
    "data:text/html,hello",
    "../secret.txt",
    "pages/%2e%2e/secret.txt",
    "/absolute/file.txt",
    "C:\\secret.txt",
  ])("rejects unsafe path %s", (path) => {
    expect(() => assertSafeEbkPath(path)).toThrow();
  });

  it("normalizes package paths", () => {
    expect(sanitizeEbkPath("pages\\chapter-1\\start.html"))
      .toBe("pages/chapter-1/start.html");
  });
});
