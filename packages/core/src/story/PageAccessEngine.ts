import type {
  EveryBookEntry,
  EveryBookJumpMode,
  EveryBookPage,
  EveryBookStory,
  EveryBookStoryState,
} from "../types";

/**
 * PageAccessContext
 *
 * Contains all information needed to decide if a reader
 * is allowed to open a target page.
 */
export type PageAccessContext = {
  /**
   * The current page opening mode.
   *
   * Supported examples:
   * - "free"        Allows pages freely, but may apply default story variables.
   * - "guarded"     Checks page requirements before opening.
   * - "storyStrict" Only allows pages already visited or unlocked.
   */
  mode: EveryBookJumpMode;

  /**
   * The page being opened.
   */
  page: EveryBookPage;

  /**
   * The current story state of the reader.
   *
   * Can be null if the reader has not started a story session yet.
   */
  state: EveryBookStoryState | null;

  /**
   * The current story definition.
   *
   * Used mainly for default story variables in free mode.
   */
  story: EveryBookStory | null;

  /**
   * The target chapter/page entry being opened.
   */
  target: EveryBookEntry;
};

/**
 * PageAccessResult
 *
 * Represents the result of a page access check.
 *
 * If allowed is true, the reader can open the page.
 * If allowed is false, the renderer can show a locked message
 * or redirect to a fallback page.
 */
export type PageAccessResult =
  | {
      /**
       * The page can be opened.
       */
      allowed: true;

      /**
       * Indicates that default story variables were applied
       * to allow the page to open.
       */
      usedDefaultStoryline?: boolean;
    }
  | {
      /**
       * The page cannot be opened.
       */
      allowed: false;

      /**
       * Developer-facing reason why the page was blocked.
       */
      reason: string;

      /**
       * Optional fallback page to open instead.
       */
      fallback?: EveryBookEntry;

      /**
       * Reader-friendly message explaining why the page is locked.
       */
      readerMessage: string;

      /**
       * Whether a fallback page is available.
       */
      canUseFallback: boolean;
    };

/**
 * PageAccessEngine
 *
 * Controls whether a reader can open a specific EveryBook page.
 *
 * This engine is useful for:
 * - Preventing readers from skipping locked story paths
 * - Supporting story progress requirements
 * - Checking choices, variables, and visited pages
 * - Handling fallback pages when access is denied
 * - Supporting different reading modes
 *
 * Supported access modes:
 *
 * 1. free
 *    Allows page opening freely.
 *    If requirements fail, it can apply default story variables
 *    from the story configuration.
 *
 * 2. guarded
 *    Allows the page only if all requirements pass.
 *    If requirements fail, the page is blocked.
 *
 * 3. storyStrict
 *    Allows the page only if it was already visited or unlocked.
 *    Also checks page requirements.
 */
export class PageAccessEngine {
  /**
   * Checks if the reader can open a page based on the current access mode.
   *
   * @param context - The full page access context.
   * @returns A PageAccessResult describing whether access is allowed or blocked.
   *
   * @example
   * const result = PageAccessEngine.canOpenPage({
   *   mode: "guarded",
   *   page,
   *   state,
   *   story,
   *   target,
   * });
   *
   * if (result.allowed) {
   *   // Open page
   * } else {
   *   // Show result.readerMessage
   * }
   */
  static canOpenPage(context: PageAccessContext): PageAccessResult {
    const { mode, page, state, story, target } = context;

    // Free mode allows flexible page access.
    if (mode === "free") {
      return this.handleFreeMode(page, state, story);
    }

    // Guarded mode blocks pages when requirements fail.
    if (mode === "guarded") {
      return this.handleGuardedMode(page, state);
    }

    // Story strict mode prevents jumping to pages not yet reached or unlocked.
    if (mode === "storyStrict") {
      return this.handleStoryStrictMode(page, state, target);
    }

    // Safe fallback for unknown modes.
    return { allowed: true };
  }

  /**
   * Handles page opening in free mode.
   *
   * Free mode is permissive. If a page has no requirements,
   * it opens immediately.
   *
   * If requirements exist and fail, the engine attempts to apply
   * default story variables from the story configuration.
   *
   * @param page - The page being opened.
   * @param state - The current story state.
   * @param story - The story configuration.
   * @returns Page access result.
   */
  private static handleFreeMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null,
    story: EveryBookStory | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    // Pages without requirements are always open in free mode.
    if (!requirements.length) {
      return { allowed: true };
    }

    // First try to pass requirements normally.
    const result = this.checkRequirements(page, state);

    if (result.allowed) {
      return result;
    }

    /**
     * If requirements failed, free mode can apply default story variables.
     *
     * This helps readers open pages even if they did not follow
     * the exact story path, while still giving the page expected variables.
     */
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

  /**
   * Handles page opening in guarded mode.
   *
   * Guarded mode requires all page access requirements to pass.
   * If requirements fail, the page is blocked.
   *
   * @param page - The page being opened.
   * @param state - The current story state.
   * @returns Page access result.
   */
  private static handleGuardedMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    // No requirements means the page can be opened.
    if (!requirements.length) {
      return { allowed: true };
    }

    const result = this.checkRequirements(page, state);

    if (result.allowed) {
      return result;
    }

    // Requirement failed, so return a blocked result with fallback info.
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

  /**
   * Handles page opening in storyStrict mode.
   *
   * storyStrict mode prevents readers from jumping freely.
   * The target page must already be visited or explicitly unlocked.
   *
   * After that, normal requirements are also checked.
   *
   * @param page - The page being opened.
   * @param state - The current story state.
   * @param target - The target chapter/page entry.
   * @returns Page access result.
   */
  private static handleStoryStrictMode(
    page: EveryBookPage,
    state: EveryBookStoryState | null,
    target: EveryBookEntry
  ): PageAccessResult {
    // storyStrict mode requires a story state.
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

    // A page is accessible if the reader already visited it.
    const isVisited = state.visitedPages.includes(targetKey);

    // A page is also accessible if it was explicitly unlocked.
    const isUnlocked = state.unlockedPages?.includes(targetKey) ?? false;

    // Block direct jumps to pages that are neither visited nor unlocked.
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

    // If the page has no extra requirements, it can be opened.
    if (!requirements.length) {
      return { allowed: true };
    }

    // Check additional requirements after visit/unlock validation.
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

  /**
   * Checks all access requirements defined on a page.
   *
   * Supported requirement types:
   *
   * 1. choiceMade
   *    Requires a specific choice to exist in state.choices.
   *
   * 2. variableExists
   *    Requires a specific variable key to exist in state.variables.
   *
   * 3. variableEquals
   *    Requires a specific variable value to match exactly.
   *
   * 4. visitedPage
   *    Requires a specific chapter/page to already be visited.
   *
   * @param page - The page containing access requirements.
   * @param state - The current story state.
   * @returns Page access result.
   */
  private static checkRequirements(
    page: EveryBookPage,
    state: EveryBookStoryState | null
  ): PageAccessResult {
    const requirements = page.access?.requirements ?? [];

    // If there are no requirements, access is allowed.
    if (!requirements.length) {
      return { allowed: true };
    }

    // Requirements cannot be checked without story state.
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
      /**
       * choiceMade
       *
       * Requires the reader to have selected a specific choice earlier.
       */
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

      /**
       * variableExists
       *
       * Requires a variable to be present in the story state.
       */
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

      /**
       * variableEquals
       *
       * Requires a variable to match a specific value.
       *
       * This uses strict equality:
       * state.variables[key] !== requirement.value
       */
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

      /**
       * visitedPage
       *
       * Requires a specific page to already be visited.
       *
       * The stored visited page format is:
       * chapterId:pageId
       */
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

    // All requirements passed.
    return { allowed: true };
  }

  /**
   * Creates a unique key for a chapter/page entry.
   *
   * This format is used by visitedPages and unlockedPages.
   *
   * @param entry - The EveryBook chapter/page entry.
   * @returns A string in the format "chapterId:pageId".
   *
   * @example
   * entryKey({ chapterId: "chapter-1", pageId: "page-2" });
   * // "chapter-1:page-2"
   */
  private static entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}