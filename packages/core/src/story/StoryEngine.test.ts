import { describe, expect, it } from "vitest";
import { StoryEngine } from "./StoryEngine";
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
      { id: "p1", src: "p1.html" },
      { id: "p2", src: "p2.html" },
    ],
  }],
};

function story(repeatable = false): EveryBookStory {
  return {
    version: "0.1",
    start: { chapterId: "c1", pageId: "p1" },
    mainTimeline: "main",
    timelines: [{ id: "main", title: "Main" }],
    variables: { coins: 0 },
    choices: [{
      id: "take-coins",
      label: "Take coins",
      from: { chapterId: "c1", pageId: "p1" },
      repeatable,
      effects: [{ type: "incrementVariable", key: "coins", value: 10 }],
      goTo: { chapterId: "c1", pageId: "p2" },
    }],
  };
}

describe("StoryEngine choices", () => {
  it("prevents non-repeatable effects from being applied twice", () => {
    const engine = new StoryEngine(manifest, story());
    engine.applyChoice("take-coins");
    expect(() => engine.applyChoice("take-coins")).toThrow(/already been applied/);
    expect(engine.getVariable("coins")).toBe(10);
  });

  it("enforces choice.from", () => {
    const engine = new StoryEngine(manifest, story());
    engine.setCurrentPosition({ chapterId: "c1", pageId: "p2", timelineId: "main" });
    expect(() => engine.applyChoice("take-coins")).toThrow(/current story position/);
  });
});
