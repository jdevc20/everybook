import { describe, expect, it } from "vitest";
import { validateStory } from "./StoryValidator";
import type { EveryBookManifest, EveryBookStory } from "../types";

const manifest: EveryBookManifest = {
  id: "book",
  format: "everybook",
  version: "0.1",
  title: "Book",
  entry: { chapterId: "c1", pageId: "p1" },
  chapters: [{
    id: "c1",
    title: "Chapter",
    pages: [
      { id: "p1", src: "p1.html", timeline: "main" },
      { id: "p2", src: "p2.html", timeline: "main" },
    ],
  }],
};

function story(): EveryBookStory {
  return {
    version: "0.1",
    start: { chapterId: "c1", pageId: "p1" },
    mainTimeline: "main",
    timelines: [{ id: "main", title: "Main" }],
    choices: [{
      id: "continue",
      label: "Continue",
      from: { chapterId: "c1", pageId: "p1" },
      goTo: { chapterId: "c1", pageId: "p2" },
    }],
  };
}

describe("story validation", () => {
  it("accepts valid story references", () => {
    expect(() => validateStory(manifest, story())).not.toThrow();
  });

  it("rejects a missing choice destination", () => {
    const value = story();
    value.choices![0].goTo.pageId = "missing";
    expect(() => validateStory(manifest, value)).toThrow(/destination/);
  });

  it("rejects duplicate choice ids", () => {
    const value = story();
    value.choices!.push({ ...value.choices![0] });
    expect(() => validateStory(manifest, value)).toThrow(/duplicate choice id/);
  });
});
