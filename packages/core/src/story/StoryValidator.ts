import type {
  EveryBookEntry,
  EveryBookManifest,
  EveryBookStory,
} from "../types";

export function validateStory(
  manifest: EveryBookManifest,
  story: EveryBookStory
): void {
  if (!story.version) {
    throw new Error("Invalid story: version is required.");
  }

  if (!story.mainTimeline) {
    throw new Error("Invalid story: mainTimeline is required.");
  }

  if (!Array.isArray(story.timelines) || story.timelines.length === 0) {
    throw new Error("Invalid story: at least one timeline is required.");
  }

  assertUnique(
    story.timelines.map((timeline) => timeline.id),
    "timeline id"
  );

  const timelineIds = new Set(story.timelines.map((timeline) => timeline.id));

  if (!timelineIds.has(story.mainTimeline)) {
    throw new Error(
      `Invalid story: mainTimeline not found: ${story.mainTimeline}`
    );
  }

  assertEntryExists(manifest, story.start, "story start");

  for (const entry of story.defaultPath ?? []) {
    assertEntryExists(manifest, entry, "defaultPath entry");
  }

  const choices = story.choices ?? [];

  assertUnique(
    choices.map((choice) => choice.id),
    "choice id"
  );

  for (const choice of choices) {
    if (!choice.id) {
      throw new Error("Invalid story: choice id is required.");
    }

    if (!choice.label) {
      throw new Error(`Invalid story: choice label is required for ${choice.id}.`);
    }

    assertEntryExists(manifest, choice.goTo, `choice '${choice.id}' destination`);

    if (choice.from) {
      assertEntryExists(manifest, choice.from, `choice '${choice.id}' source`);

      if (
        choice.from.timelineId &&
        !timelineIds.has(choice.from.timelineId)
      ) {
        throw new Error(
          `Invalid story: choice '${choice.id}' references missing timeline '${choice.from.timelineId}'.`
        );
      }
    }

    for (const effect of choice.effects ?? []) {
      if (effect.type === "setTimeline" && !timelineIds.has(effect.timelineId)) {
        throw new Error(
          `Invalid story: choice '${choice.id}' references missing timeline '${effect.timelineId}'.`
        );
      }
    }
  }

  const endings = story.endings ?? [];

  assertUnique(
    endings.map((ending) => ending.id),
    "ending id"
  );

  for (const ending of endings) {
    if (!ending.id) {
      throw new Error("Invalid story: ending id is required.");
    }

    assertEntryExists(manifest, ending.page, `ending '${ending.id}' page`);
  }

  for (const chapter of manifest.chapters) {
    for (const page of chapter.pages) {
      if (page.timeline && !timelineIds.has(page.timeline)) {
        throw new Error(
          `Invalid story: page '${chapter.id}/${page.id}' references missing timeline '${page.timeline}'.`
        );
      }
    }
  }
}

function assertEntryExists(
  manifest: EveryBookManifest,
  entry: EveryBookEntry,
  label: string
): void {
  const chapter = manifest.chapters.find((item) => item.id === entry.chapterId);
  const page = chapter?.pages.find((item) => item.id === entry.pageId);

  if (!chapter || !page) {
    throw new Error(
      `Invalid story: ${label} not found: ${entry.chapterId}/${entry.pageId}`
    );
  }
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) {
      throw new Error(`Invalid story: ${label} is required.`);
    }

    if (seen.has(value)) {
      throw new Error(`Invalid story: duplicate ${label}: ${value}`);
    }

    seen.add(value);
  }
}
