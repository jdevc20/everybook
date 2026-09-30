import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeEbkPath,
  validateManifest,
  validateStory,
  StoryEngine,
  ConditionEngine,
} from "../dist/index.js";

function manifest() {
  return {
    id: "book-1",
    format: "everybook",
    version: "0.1",
    title: "Test Book",
    entry: { chapterId: "chapter-1", pageId: "page-1" },
    chapters: [
      {
        id: "chapter-1",
        title: "Chapter 1",
        pages: [
          { id: "page-1", src: "pages/1.html" },
          { id: "page-2", src: "pages/2.html" },
        ],
      },
    ],
  };
}

function story() {
  return {
    version: "0.1",
    start: { chapterId: "chapter-1", pageId: "page-1" },
    mainTimeline: "main",
    timelines: [{ id: "main", title: "Main" }],
    variables: { coins: 0 },
    choices: [
      {
        id: "take-coin",
        label: "Take coin",
        from: { chapterId: "chapter-1", pageId: "page-1" },
        effects: [{ type: "incrementVariable", key: "coins", value: 1 }],
        goTo: { chapterId: "chapter-1", pageId: "page-2" },
      },
    ],
  };
}

test("rejects URL and traversal paths", () => {
  assert.throws(() => assertSafeEbkPath("https://example.com/x"));
  assert.throws(() => assertSafeEbkPath("../secret.txt"));
  assert.throws(() => assertSafeEbkPath("%2e%2e/secret.txt"));
  assert.doesNotThrow(() => assertSafeEbkPath("pages/chapter-1.html"));
});

test("manifest rejects duplicate page ids", () => {
  const value = manifest();
  value.chapters[0].pages.push({ id: "page-1", src: "pages/duplicate.html" });
  assert.throws(() => validateManifest(value), /duplicate page id/);
});

test("manifest rejects broken fallbacks", () => {
  const value = manifest();
  value.chapters[0].pages[0].access = {
    fallback: { chapterId: "chapter-1", pageId: "missing" },
  };
  assert.throws(() => validateManifest(value), /fallback/);
});

test("story rejects broken destination references", () => {
  const value = story();
  value.choices[0].goTo = { chapterId: "chapter-1", pageId: "missing" };
  assert.throws(() => validateStory(manifest(), value), /destination not found/);
});

test("non-repeatable choices cannot apply effects twice", () => {
  const engine = new StoryEngine(manifest(), story());
  engine.applyChoice("take-coin");
  assert.equal(engine.getVariable("coins"), 1);
  assert.throws(() => engine.applyChoice("take-coin"), /already been applied/);
  assert.equal(engine.getVariable("coins"), 1);
});

test("choice.from must match current story position", () => {
  const value = story();
  value.choices[0].from = { chapterId: "chapter-1", pageId: "page-2" };
  const engine = new StoryEngine(manifest(), value);
  assert.throws(() => engine.applyChoice("take-coin"), /not available/);
});

test("invalid numeric conditions fail safely", () => {
  assert.equal(ConditionEngine.evaluate("coins > nope", { coins: 1 }), false);
});
