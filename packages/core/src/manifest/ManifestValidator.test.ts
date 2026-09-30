import { describe, expect, it } from "vitest";
import { validateManifest } from "./ManifestValidator";
import type { EveryBookManifest } from "../types";

function manifest(): EveryBookManifest {
  return {
    id: "book",
    format: "everybook",
    version: "0.1",
    title: "Book",
    entry: { chapterId: "c1", pageId: "p1" },
    chapters: [{
      id: "c1",
      title: "Chapter",
      pages: [
        { id: "p1", src: "pages/p1.html" },
        { id: "p2", src: "pages/p2.html" },
      ],
    }],
  };
}

describe("manifest validation", () => {
  it("accepts a valid manifest", () => {
    expect(() => validateManifest(manifest())).not.toThrow();
  });

  it("rejects duplicate page ids", () => {
    const value = manifest();
    value.chapters[0].pages.push({ id: "p1", src: "pages/duplicate.html" });
    expect(() => validateManifest(value)).toThrow(/duplicate page id/);
  });

  it("rejects missing fallback targets", () => {
    const value = manifest();
    value.chapters[0].pages[0].access = {
      fallback: { chapterId: "c1", pageId: "missing" },
    };
    expect(() => validateManifest(value)).toThrow(/fallback/);
  });
});
