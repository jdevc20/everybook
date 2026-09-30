import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import { EveryBookEngine } from "../dist/index.js";

async function createBook() {
  const zip = new JSZip();

  zip.file(
    "manifest.json",
    JSON.stringify({
      id: "headless-book",
      format: "everybook",
      version: "0.1.0",
      title: "Headless Test",
      entry: { chapterId: "chapter-1", pageId: "page-1" },
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter 1",
          pages: [
            { id: "page-1", src: "pages/page-1.html" },
            { id: "page-2", src: "pages/page-2.html" }
          ]
        }
      ]
    })
  );

  zip.file("pages/page-1.html", "<h1>Page One</h1>");
  zip.file("pages/page-2.html", "<h1>Page Two</h1>");

  return zip.generateAsync({ type: "arraybuffer" });
}

test("EveryBookEngine loads and navigates without a DOM renderer", async () => {
  const engine = new EveryBookEngine();
  const book = await createBook();

  const opened = await engine.open(book);

  assert.equal(opened.status, "page");
  assert.equal(opened.page.pageId, "page-1");
  assert.deepEqual(engine.getCurrentPosition(), {
    chapterId: "chapter-1",
    pageId: "page-1",
    timelineId: undefined
  });

  const next = await engine.nextPage();

  assert.equal(next.status, "page");
  assert.equal(next.page.pageId, "page-2");
  assert.equal(engine.getCurrentPosition()?.pageId, "page-2");
});
