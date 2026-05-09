import type {
  EveryBookEntry,
  EveryBookJumpMode,
  EveryBookPage,
  EveryBookStory,
  EveryBookStoryState,
} from "../types";

export type PageAccessContext = {
  mode: EveryBookJumpMode;
  page: EveryBookPage;
  state: EveryBookStoryState | null;
  story: EveryBookStory | null;
  target: EveryBookEntry;
};

export type PageAccessResult =
  | {
      allowed: true;
      usedDefaultStoryline?: boolean;
    }
  | {
      allowed: false;
      reason: string;
      fallback?: EveryBookEntry;
      readerMessage: string;
      canUseFallback: boolean;
    };

export class PageAccessEngine {
  static canOpenPage(context: PageAccessContext): PageAccessResult {
    const { mode, page, state, story, target } = context;

    if (mode === "free") {
      return this.handleFreeMode(page, state, story);
    }

    if (mode === "guarded") {
      return this.handleGuardedMode(page, state);
    }

    if (mode === "storyStrict") {
      return this.handleStoryStrictMode(page, state, target);
    }

    return { allowed: true };
  }

  private static handleFreeMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null,
    story: EveryBookStory | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    if (!requirements.length) {
      return { allowed: true };
    }

    const result = this.checkRequirements(page, state);

    if (result.allowed) {
      return result;
    }

    if (story?.variables && state) {
      for (const [key, value] of Object.entries(story.variables)) {
        if (!(key in state.variables)) {
          state.variables[key] = value;
        }
      }

      state.usedDefaultStoryline = true;
    }

    return {
      allowed: true,
      usedDefaultStoryline: true,
    };
  }

  private static handleGuardedMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    if (!requirements.length) {
      return { allowed: true };
    }

    const result = this.checkRequirements(page, state);

    if (result.allowed) {
      return result;
    }

    return {
      allowed: false,
      reason: result.reason,
      fallback: page.access?.fallback,
      readerMessage:
        page.access?.lockedMessage ??
        "This page depends on earlier story progress.",
      canUseFallback: Boolean(page.access?.fallback),
    };
  }

  private static handleStoryStrictMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null,
    target: EveryBookEntry
  ): PageAccessResult {
    if (!state) {
      return {
        allowed: false,
        reason: "Story state is required.",
        fallback: page.access?.fallback,
        readerMessage: "Start the story first before jumping to this page.",
        canUseFallback: Boolean(page.access?.fallback),
      };
    }

    const targetKey = this.entryKey(target);
    const isVisited = state.visitedPages.includes(targetKey);
    const isUnlocked = state.unlockedPages?.includes(targetKey) ?? false;

    if (!isVisited && !isUnlocked) {
      return {
        allowed: false,
        reason: `Page is locked in storyStrict mode: ${targetKey}`,
        fallback: page.access?.fallback,
        readerMessage:
          page.access?.lockedMessage ??
          "This page is locked. Continue the story to unlock it.",
        canUseFallback: Boolean(page.access?.fallback),
      };
    }

    const requirements = page.access?.requirements ?? [];

    if (!requirements.length) {
      return { allowed: true };
    }

    const result = this.checkRequirements(page, state);

    if (result.allowed) {
      return result;
    }

    return {
      allowed: false,
      reason: result.reason,
      fallback: page.access?.fallback,
      readerMessage:
        page.access?.lockedMessage ??
        "This page is locked because required story choices are missing.",
      canUseFallback: Boolean(page.access?.fallback),
    };
  }

  private static checkRequirements(
    page: EveryBookPage,
    state: EveryBookStoryState | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    if (!requirements.length) {
      return { allowed: true };
    }

    if (!state) {
      return {
        allowed: false,
        reason: "Page requires story state.",
        fallback: page.access?.fallback,
        readerMessage: "This page depends on story progress.",
        canUseFallback: Boolean(page.access?.fallback),
      };
    }

    for (const requirement of requirements) {
      if (requirement.type === "choiceMade") {
        const hasChoice = state.choices.some(
          (choice) => choice.choiceId === requirement.choiceId
        );

        if (!hasChoice) {
          return {
            allowed: false,
            reason: `Missing required choice: ${requirement.choiceId}`,
            fallback: page.access?.fallback,
            readerMessage:
              page.access?.lockedMessage ??
              "This page depends on a choice you have not made yet.",
            canUseFallback: Boolean(page.access?.fallback),
          };
        }
      }

      if (requirement.type === "variableExists") {
        if (!(requirement.key in state.variables)) {
          return {
            allowed: false,
            reason: `Missing required variable: ${requirement.key}`,
            fallback: page.access?.fallback,
            readerMessage:
              page.access?.lockedMessage ??
              "This page depends on missing story information.",
            canUseFallback: Boolean(page.access?.fallback),
          };
        }
      }

      if (requirement.type === "variableEquals") {
        if (state.variables[requirement.key] !== requirement.value) {
          return {
            allowed: false,
            reason: `Variable requirement failed: ${requirement.key}`,
            fallback: page.access?.fallback,
            readerMessage:
              page.access?.lockedMessage ??
              "This page is not available for your current story path.",
            canUseFallback: Boolean(page.access?.fallback),
          };
        }
      }

      if (requirement.type === "visitedPage") {
        const key = `${requirement.chapterId}:${requirement.pageId}`;

        if (!state.visitedPages.includes(key)) {
          return {
            allowed: false,
            reason: `Required page was not visited: ${key}`,
            fallback: page.access?.fallback,
            readerMessage:
              page.access?.lockedMessage ??
              "This page depends on a previous page you have not visited yet.",
            canUseFallback: Boolean(page.access?.fallback),
          };
        }
      }
    }

    return { allowed: true };
  }

  private static entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}