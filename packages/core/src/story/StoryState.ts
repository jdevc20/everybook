import type {
  EveryBookEntry,
  EveryBookPosition,
  EveryBookStory,
  EveryBookStoryState,
  RememberedChoice,
} from "../types";

/**
 * StoryState
 *
 * Stores and manages the reader's current progress inside an EveryBook story.
 *
 * This class is responsible for:
 * - Current chapter/page/timeline position
 * - Story variables
 * - Remembered choices
 * - Visited pages
 * - Unlocked pages
 * - Default storyline tracking
 * - Restoring saved progress
 *
 * StoryState is used internally by StoryEngine.
 */
export class StoryState {
  /**
   * Internal story state object.
   *
   * This should not be exposed directly because external code
   * could accidentally mutate the reader's progress.
   */
  private state: EveryBookStoryState;

  /**
   * Creates a new story state for a book.
   *
   * The constructor initializes:
   * - book id
   * - current starting position
   * - default story variables
   * - empty choice history
   * - empty visited page list
   * - empty unlocked page list
   * - default storyline flag
   *
   * The start page is automatically marked as visited and unlocked.
   *
   * @param bookId - The unique id of the EveryBook.
   * @param story - The story definition containing default variables.
   * @param start - The reader's starting position.
   */
  constructor(bookId: string, story: EveryBookStory, start: EveryBookPosition) {
    this.state = {
      bookId,
      current: start,
      variables: {
        ...(story.variables ?? {}),
      },
      choices: [],
      visitedPages: [],
      unlockedPages: [],
      usedDefaultStoryline: false,
    };

    // The starting page should always be accessible.
    this.markVisited(start);
    this.unlockPage(start);
  }

  /**
   * Gets a safe copy of the full story state.
   *
   * structuredClone is used so external code cannot directly mutate
   * the internal state object.
   *
   * @returns A cloned snapshot of the current story state.
   */
  getState(): EveryBookStoryState {
    return structuredClone(this.state);
  }

  /**
   * Gets the reader's current position.
   *
   * @returns A cloned copy of the current chapter/page/timeline position.
   */
  getCurrentPosition(): EveryBookPosition {
    return structuredClone(this.state.current);
  }

  /**
   * Updates the reader's current story position.
   *
   * After moving, the target page is automatically:
   * - marked as visited
   * - marked as unlocked
   *
   * @param position - The new story position.
   */
  setCurrentPosition(position: EveryBookPosition): void {
    this.state.current = structuredClone(position);
    this.markVisited(position);
    this.unlockPage(position);
  }

  /**
   * Gets a story variable by key.
   *
   * The generic type T lets callers define the expected return type.
   *
   * @param key - The variable name.
   * @returns The variable value, or undefined if it does not exist.
   *
   * @example
   * const hasKey = state.getVariable<boolean>("hasKey");
   */
  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.variables[key] as T | undefined;
  }

  /**
   * Sets or updates a story variable.
   *
   * Variables are used for conditions, branching,
   * unlock rules, and ending requirements.
   *
   * @param key - The variable name.
   * @param value - The value to store.
   *
   * @example
   * state.setVariable("coins", 10);
   * state.setVariable("hasSword", true);
   */
  setVariable(key: string, value: unknown): void {
    this.state.variables[key] = value;
  }

  /**
   * Increments a numeric story variable.
   *
   * If the variable does not exist, it starts from 0.
   * If the current value cannot be converted to a number,
   * it is replaced with the increment value.
   *
   * @param key - The variable name.
   * @param value - The amount to add.
   *
   * @example
   * state.incrementVariable("coins", 5);
   */
  incrementVariable(key: string, value: number): void {
    const current = Number(this.state.variables[key] ?? 0);

    // If the existing value is not numeric, reset it to the given value.
    if (Number.isNaN(current)) {
      this.state.variables[key] = value;
      return;
    }

    this.state.variables[key] = current + value;
  }

  /**
   * Records that a reader selected a choice.
   *
   * Each remembered choice stores:
   * - choice id
   * - chapter id where the choice was made
   * - page id where the choice was made
   * - timestamp
   *
   * If no position is provided, the current position is used.
   *
   * Duplicate choices from the same page are not added again.
   *
   * @param choiceId - The id of the selected choice.
   * @param position - Optional source position where the choice happened.
   *
   * @example
   * state.rememberChoice("help-villager");
   *
   * @example
   * state.rememberChoice("take-sword", {
   *   chapterId: "chapter-1",
   *   pageId: "page-3"
   * });
   */
  rememberChoice(
    choiceId: string,
    position?: {
      chapterId: string;
      pageId: string;
    }
  ): void {
    const source = position ?? this.state.current;

    const rememberedChoice: RememberedChoice = {
      choiceId,
      chapterId: source.chapterId,
      pageId: source.pageId,
      timestamp: new Date().toISOString(),
    };

    // Prevent duplicate records for the same choice on the same page.
    const alreadyRemembered = this.state.choices.some(
      (choice) =>
        choice.choiceId === rememberedChoice.choiceId &&
        choice.chapterId === rememberedChoice.chapterId &&
        choice.pageId === rememberedChoice.pageId
    );

    if (!alreadyRemembered) {
      this.state.choices.push(rememberedChoice);
    }
  }

  /**
   * Checks if a choice has already been remembered.
   *
   * This checks by choice id only, regardless of the page where it happened.
   *
   * @param choiceId - The choice id to check.
   * @returns true if the choice exists in the remembered choices list.
   */
  hasChoice(choiceId: string): boolean {
    return this.state.choices.some((choice) => choice.choiceId === choiceId);
  }

  /**
   * Checks if a page has already been visited.
   *
   * @param entry - The chapter/page entry to check.
   * @returns true if the page exists in visitedPages.
   */
  hasVisited(entry: EveryBookEntry): boolean {
    return this.state.visitedPages.includes(this.entryKey(entry));
  }

  /**
   * Marks a page as visited.
   *
   * Visited pages are stored using the format:
   * chapterId:pageId
   *
   * Duplicate visited page keys are ignored.
   *
   * @param entry - The chapter/page entry to mark.
   */
  markVisited(entry: EveryBookEntry): void {
    const key = this.entryKey(entry);

    if (!this.state.visitedPages.includes(key)) {
      this.state.visitedPages.push(key);
    }
  }

  /**
   * Checks if a page is unlocked.
   *
   * @param entry - The chapter/page entry to check.
   * @returns true if the page exists in unlockedPages.
   */
  isUnlocked(entry: EveryBookEntry): boolean {
    const key = this.entryKey(entry);

    return this.state.unlockedPages?.includes(key) ?? false;
  }

  /**
   * Unlocks a page for future access.
   *
   * This is used by StoryEngine and PageAccessEngine
   * to allow readers to return to pages or open newly reached pages.
   *
   * If unlockedPages is missing from an older restored state,
   * it is initialized safely.
   *
   * @param entry - The chapter/page entry to unlock.
   */
  unlockPage(entry: EveryBookEntry): void {
    const key = this.entryKey(entry);

    // Backward compatibility for older saved states.
    if (!this.state.unlockedPages) {
      this.state.unlockedPages = [];
    }

    if (!this.state.unlockedPages.includes(key)) {
      this.state.unlockedPages.push(key);
    }
  }

  /**
   * Marks that the reader used the default storyline.
   *
   * This flag is useful when the renderer allows page access
   * by applying default story values instead of requiring
   * the reader to follow the full intended path.
   */
  markUsedDefaultStoryline(): void {
    this.state.usedDefaultStoryline = true;
  }

  /**
   * Restores the story state from a saved snapshot.
   *
   * This method safely rebuilds the internal state and provides
   * default fallback values for missing fields.
   *
   * This helps support older saved states that may not contain
   * newer fields like unlockedPages or usedDefaultStoryline.
   *
   * After restoring, the current page is automatically marked
   * as visited and unlocked.
   *
   * @param state - The saved EveryBook story state.
   */
  restore(state: EveryBookStoryState): void {
    this.state = {
      bookId: state.bookId,
      current: structuredClone(state.current),
      variables: structuredClone(state.variables ?? {}),
      choices: structuredClone(state.choices ?? []),
      visitedPages: structuredClone(state.visitedPages ?? []),
      unlockedPages: structuredClone(state.unlockedPages ?? []),
      usedDefaultStoryline: state.usedDefaultStoryline ?? false,
    };

    // Ensure the restored current page remains accessible.
    this.markVisited(this.state.current);
    this.unlockPage(this.state.current);
  }

  /**
   * Creates a unique page key from a chapter/page entry.
   *
   * This format is used in:
   * - visitedPages
   * - unlockedPages
   *
   * @param entry - The chapter/page entry.
   * @returns A key in the format "chapterId:pageId".
   *
   * @example
   * entryKey({ chapterId: "chapter-1", pageId: "page-2" });
   * // "chapter-1:page-2"
   */
  private entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}
