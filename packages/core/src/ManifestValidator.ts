import type { EveryBookManifest } from "./types";

export function validateManifest(manifest: EveryBookManifest): void {
  if (manifest.format !== "everybook") {
    throw new Error("Invalid manifest: format must be 'everybook'.");
  }

  if (!manifest.version) {
    throw new Error("Invalid manifest: version is required.");
  }

  if (!manifest.title) {
    throw new Error("Invalid manifest: title is required.");
  }

  if (!manifest.entry?.chapterId || !manifest.entry?.pageId) {
    throw new Error("Invalid manifest: entry chapterId and pageId are required.");
  }

  if (!Array.isArray(manifest.chapters) || manifest.chapters.length === 0) {
    throw new Error("Invalid manifest: chapters are required.");
  }

  for (const chapter of manifest.chapters) {
    if (!chapter.id) {
      throw new Error("Invalid manifest: chapter id is required.");
    }

    if (!chapter.title) {
      throw new Error(`Invalid manifest: chapter title is required for ${chapter.id}.`);
    }

    if (!Array.isArray(chapter.pages) || chapter.pages.length === 0) {
      throw new Error(`Invalid manifest: chapter ${chapter.id} must have pages.`);
    }

    for (const page of chapter.pages) {
      if (!page.id) {
        throw new Error(`Invalid manifest: page id is required in chapter ${chapter.id}.`);
      }

      if (!page.src) {
        throw new Error(`Invalid manifest: page src is required for ${chapter.id}/${page.id}.`);
      }
    }
  }

  const entryChapter = manifest.chapters.find(
    (chapter) => chapter.id === manifest.entry.chapterId
  );

  if (!entryChapter) {
    throw new Error(`Invalid manifest: entry chapter not found: ${manifest.entry.chapterId}.`);
  }

  const entryPage = entryChapter.pages.find(
    (page) => page.id === manifest.entry.pageId
  );

  if (!entryPage) {
    throw new Error(
      `Invalid manifest: entry page not found: ${manifest.entry.chapterId}/${manifest.entry.pageId}.`
    );
  }

  if (manifest.permissions?.network) {
    throw new Error("Network permission is not supported in EveryBook v0.1.");
  }
}