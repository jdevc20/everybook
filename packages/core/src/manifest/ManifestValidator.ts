import type {
  EveryBookEntry,
  EveryBookManifest,
} from "../types";

export function validateManifest(manifest: EveryBookManifest): void {
  if (manifest.format !== "everybook") {
    throw new Error("Invalid manifest: format must be 'everybook'.");
  }

  if (!manifest.id) {
    throw new Error("Invalid manifest: id is required.");
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

  const chapterIds = new Set<string>();

  for (const chapter of manifest.chapters) {
    if (!chapter.id) {
      throw new Error("Invalid manifest: chapter id is required.");
    }

    if (chapterIds.has(chapter.id)) {
      throw new Error(`Invalid manifest: duplicate chapter id: ${chapter.id}`);
    }

    chapterIds.add(chapter.id);

    if (!chapter.title) {
      throw new Error(
        `Invalid manifest: chapter title is required for ${chapter.id}.`
      );
    }

    if (!Array.isArray(chapter.pages) || chapter.pages.length === 0) {
      throw new Error(`Invalid manifest: chapter ${chapter.id} must have pages.`);
    }

    const pageIds = new Set<string>();

    for (const page of chapter.pages) {
      if (!page.id) {
        throw new Error(
          `Invalid manifest: page id is required in chapter ${chapter.id}.`
        );
      }

      if (pageIds.has(page.id)) {
        throw new Error(
          `Invalid manifest: duplicate page id '${page.id}' in chapter '${chapter.id}'.`
        );
      }

      pageIds.add(page.id);

      if (!page.src) {
        throw new Error(
          `Invalid manifest: page src is required for ${chapter.id}/${page.id}.`
        );
      }
    }
  }

  assertEntryExists(manifest, manifest.entry, "entry");

  if (manifest.navigation?.defaultEntry) {
    assertEntryExists(
      manifest,
      manifest.navigation.defaultEntry,
      "navigation.defaultEntry"
    );
  }

  for (const chapter of manifest.chapters) {
    for (const page of chapter.pages) {
      const fallback = page.access?.fallback;

      if (fallback) {
        assertEntryExists(
          manifest,
          fallback,
          `fallback for ${chapter.id}/${page.id}`
        );
      }

      for (const requirement of page.access?.requirements ?? []) {
        if (requirement.type === "visitedPage") {
          assertEntryExists(
            manifest,
            {
              chapterId: requirement.chapterId,
              pageId: requirement.pageId,
            },
            `visitedPage requirement for ${chapter.id}/${page.id}`
          );
        }
      }
    }
  }

  if (manifest.permissions?.network) {
    throw new Error("Network permission is not supported in EveryBook v0.1.");
  }
}

function assertEntryExists(
  manifest: EveryBookManifest,
  entry: EveryBookEntry,
  label: string
): void {
  const chapter = manifest.chapters.find((item) => item.id === entry.chapterId);

  if (!chapter) {
    throw new Error(
      `Invalid manifest: ${label} chapter not found: ${entry.chapterId}.`
    );
  }

  const page = chapter.pages.find((item) => item.id === entry.pageId);

  if (!page) {
    throw new Error(
      `Invalid manifest: ${label} page not found: ${entry.chapterId}/${entry.pageId}.`
    );
  }
}
