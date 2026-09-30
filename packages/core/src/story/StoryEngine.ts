import type {
  EveryBookChoice,
  EveryBookEntry,
  EveryBookManifest,
  EveryBookPosition,
  EveryBookStory,
  EveryBookStoryState,
} from "../types";
import { ConditionEngine } from "./ConditionEngine";
import { StoryState } from "./StoryState";

/**
 * StoryEngine
 *
 * The main controller for EveryBook interactive story logic.
 *
 * This class connects:
 * - The book manifest
 * - The story definition
 * - The reader's current story state
 * - Choices and choice effects
 * - Variables
 * - Timelines
 * - Visited and unlocked pages
 * - Save/load behavior
 *
 * It is responsible for deciding what happens when a reader
 * makes choices, moves between pages, or restores progress.
 */
export class StoryEngine {
  /**
   * The full EveryBook manifest.
   *
   * This contains book-level information such as:
   * - book id
   * - navigation
   * - default entry
   * - chapters/pages metadata
   */
  private manifest: EveryBookManifest;

  /**
   * The interactive story definition.
   *
   * This contains:
   * - start page
   * - main timeline
   * - choices
   * - endings
   * - default variables
   */
  private story: EveryBookStory;

  /**
   * Internal state manager for the reader's current story progress.
   */
  private state: StoryState;

  /**
   * Creates a new StoryEngine instance.
   *
   * The engine decides the starting page using:
   * 1. manifest.navigation.defaultEntry, if available
   * 2. story.start, as fallback
   *
   * It also applies the story's default variables immediately.
   *
   * @param manifest - The EveryBook manifest.
   * @param story - The EveryBook story definition.
   */
  constructor(manifest: EveryBookManifest, story: EveryBookStory) {
    this.manifest = manifest;
    this.story = story;

    // Prefer the manifest default entry, otherwise use the story start entry.
    const startEntry = manifest.navigation?.defaultEntry ?? story.start;

    // Build the initial reader position.
    const start: EveryBookPosition = {
      chapterId: startEntry.chapterId,
      pageId: startEntry.pageId,
      timelineId: story.mainTimeline,
    };

    // Create a fresh story state for this book and starting position.
    this.state = new StoryState(manifest.id, story, start);

    // Apply default variables defined in the story.
    this.applyDefaultVariables();
  }

  /**
   * Gets the story definition used by this engine.
   *
   * @returns The current EveryBook story.
   */
  getStory(): EveryBookStory {
    return this.story;
  }

  /**
   * Gets the current reader story state.
   *
   * This includes:
   * - current position
   * - variables
   * - choices made
   * - visited pages
   * - unlocked pages
   *
   * @returns The current story state snapshot.
   */
  getState(): EveryBookStoryState {
    return this.state.getState();
  }

  /**
   * Restores a previously saved story state.
   *
   * The saved state must belong to the same book.
   * If the book id does not match, an error is thrown.
   *
   * After restoring, default variables are applied again.
   * This ensures newly added story variables are available
   * even when loading an older save file.
   *
   * @param state - The saved story state to restore.
   *
   * @throws Error if the saved state belongs to a different book.
   */
  restoreState(state: EveryBookStoryState): void {
    if (state.bookId !== this.manifest.id) {
      throw new Error(
        `Cannot restore story state. Expected book '${this.manifest.id}', got '${state.bookId}'.`
      );
    }

    this.state.restore(state);

    // Re-apply default variables after restore for compatibility.
    this.applyDefaultVariables();
  }

  /**
   * Gets the reader's current position in the story.
   *
   * @returns The current chapter, page, and timeline.
   */
  getCurrentPosition(): EveryBookPosition {
    return this.state.getCurrentPosition();
  }

  /**
   * Updates the reader's current position.
   *
   * This also:
   * - Marks the page as visited
   * - Unlocks the page
   *
   * @param position - The new story position.
   */
  setCurrentPosition(position: EveryBookPosition): void {
    this.state.setCurrentPosition(position);
    this.markVisited(position);
    this.unlockPage(position);
  }

  /**
   * Gets a story variable by key.
   *
   * The generic type T allows callers to define the expected value type.
   *
   * @param key - The variable name.
   * @returns The variable value, or undefined if it does not exist.
   *
   * @example
   * const coins = engine.getVariable<number>("coins");
   */
  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.getVariable<T>(key);
  }

  /**
   * Sets or updates a story variable.
   *
   * @param key - The variable name.
   * @param value - The new variable value.
   *
   * @example
   * engine.setVariable("hasKey", true);
   */
  setVariable(key: string, value: unknown): void {
    this.state.setVariable(key, value);
  }

  /**
   * Increments a numeric story variable.
   *
   * If the variable does not exist or is not numeric,
   * StoryState should decide how to safely handle it.
   *
   * @param key - The variable name.
   * @param value - The amount to increment by.
   *
   * @example
   * engine.incrementVariable("coins", 5);
   */
  incrementVariable(key: string, value: number): void {
    this.state.incrementVariable(key, value);
  }

  /**
   * Remembers that a choice was made.
   *
   * This can be used manually when a choice should be tracked
   * without applying full choice effects.
   *
   * @param choiceId - The choice id to remember.
   */
  rememberChoice(choiceId: string): void {
    this.state.rememberChoice(choiceId);
  }

  /**
   * Checks if the reader has already made a specific choice.
   *
   * @param choiceId - The choice id to check.
   * @returns true if the choice exists in state.choices.
   */
  hasChoice(choiceId: string): boolean {
    return this.state
      .getState()
      .choices.some((choice) => choice.choiceId === choiceId);
  }

  /**
   * Checks if a page has already been visited.
   *
   * @param entry - The chapter/page entry to check.
   * @returns true if the page exists in visitedPages.
   */
  hasVisited(entry: EveryBookEntry): boolean {
    return this.state.getState().visitedPages.includes(this.entryKey(entry));
  }

  /**
   * Checks if a page is unlocked.
   *
   * If unlockedPages exists, the method checks that list.
   * If unlockedPages does not exist, it falls back to visited status.
   *
   * @param entry - The chapter/page entry to check.
   * @returns true if the page is unlocked or already visited.
   */
  isUnlocked(entry: EveryBookEntry): boolean {
    const state = this.state.getState();

    return (
      state.unlockedPages?.includes(this.entryKey(entry)) ??
      this.hasVisited(entry)
    );
  }

  /**
   * Unlocks a page for future access.
   *
   * @param entry - The chapter/page entry to unlock.
   */
  unlockPage(entry: EveryBookEntry): void {
    this.state.unlockPage(entry);
  }

  /**
   * Marks a page as visited.
   *
   * @param entry - The chapter/page entry to mark as visited.
   */
  markVisited(entry: EveryBookEntry): void {
    this.state.markVisited(entry);
  }

  /**
   * Marks that the reader used the default storyline.
   *
   * This is useful when the renderer allows access to a page
   * by applying default story variables instead of requiring
   * full previous story progress.
   */
  markUsedDefaultStoryline(): void {
    this.state.markUsedDefaultStoryline();
  }

  /**
   * Applies default story variables to the current state.
   *
   * Only variables that do not already exist are added.
   *
   * This prevents existing reader progress from being overwritten.
   *
   * @example
   * story.variables = {
   *   coins: 0,
   *   hasKey: false
   * };
   */
  applyDefaultVariables(): void {
    const defaultVariables = this.story.variables ?? {};

    for (const [key, value] of Object.entries(defaultVariables)) {
      const current = this.state.getVariable(key);

      // Only apply default value when the variable is missing.
      if (current === undefined) {
        this.state.setVariable(key, value);
      }
    }
  }

  /**
   * Finds a choice by id.
   *
   * @param choiceId - The choice id to find.
   * @returns The matching EveryBook choice.
   *
   * @throws Error if the choice does not exist.
   */
  getChoice(choiceId: string): EveryBookChoice {
    const choice = this.story.choices?.find((item) => item.id === choiceId);

    if (!choice) {
      throw new Error(`Choice not found: ${choiceId}`);
    }

    return choice;
  }

  /**
   * Checks if a choice is currently available.
   *
   * A choice is available when its condition passes.
   *
   * This uses ConditionEngine, which supports simple expressions like:
   * - "hasKey"
   * - "!isDead"
   * - "coins >= 10"
   * - "ending == 'good'"
   *
   * @param choice - The choice to check.
   * @returns true if the choice can be used.
   */
  canUseChoice(choice: EveryBookChoice): boolean {
    const variables = this.state.getState().variables;

    return ConditionEngine.evaluate(choice.condition, variables);
  }

  /**
   * Applies a choice and returns the next page entry.
   *
   * This method:
   * 1. Finds the choice by id
   * 2. Checks if the choice condition passes
   * 3. Remembers the choice
   * 4. Applies all choice effects
   * 5. Unlocks the target page
   * 6. Returns the target page
   *
   * Supported choice effects:
   * - setVariable
   * - incrementVariable
   * - setTimeline
   * - rememberChoice
   *
   * @param choiceId - The choice id to apply.
   * @returns The target page entry from choice.goTo.
   *
   * @throws Error if the choice does not exist.
   * @throws Error if the choice condition fails.
   */
  applyChoice(choiceId: string): EveryBookEntry {
    const choice = this.getChoice(choiceId);

    if (!this.canUseChoice(choice)) {
      throw new Error(`Choice condition failed: ${choiceId}`);
    }

    const current = this.state.getCurrentPosition();

    if (
      choice.from &&
      (choice.from.chapterId !== current.chapterId ||
        choice.from.pageId !== current.pageId ||
        (choice.from.timelineId !== undefined &&
          choice.from.timelineId !== current.timelineId))
    ) {
      throw new Error(
        `Choice '${choiceId}' is not available from the current story position.`
      );
    }

    if (choice.repeatable !== true && this.state.hasChoice(choice.id)) {
      throw new Error(`Choice has already been applied: ${choiceId}`);
    }

    // Store the selected choice and where it was made.
    this.state.rememberChoice(choice.id, {
      chapterId: current.chapterId,
      pageId: current.pageId,
    });

    // Apply all side effects attached to the choice.
    for (const effect of choice.effects ?? []) {
      /**
       * Sets a story variable to a specific value.
       *
       * Example:
       * { type: "setVariable", key: "hasKey", value: true }
       */
      if (effect.type === "setVariable") {
        this.state.setVariable(effect.key, effect.value);
      }

      /**
       * Increments a numeric story variable.
       *
       * Example:
       * { type: "incrementVariable", key: "coins", value: 5 }
       */
      if (effect.type === "incrementVariable") {
        this.state.incrementVariable(effect.key, effect.value);
      }

      /**
       * Changes the current story timeline.
       *
       * Example:
       * { type: "setTimeline", timelineId: "dark-route" }
       */
      if (effect.type === "setTimeline") {
        const currentPosition = this.state.getCurrentPosition();

        this.state.setCurrentPosition({
          ...currentPosition,
          timelineId: effect.timelineId,
        });
      }

      /**
       * Remembers another choice manually.
       *
       * This is useful when one choice should count as another
       * story flag or hidden branch marker.
       */
      if (effect.type === "rememberChoice") {
        this.state.rememberChoice(effect.choiceId, {
          chapterId: current.chapterId,
          pageId: current.pageId,
        });
      }
    }

    // Unlock the destination page after applying the choice.
    this.state.unlockPage(choice.goTo);

    return choice.goTo;
  }

  /**
   * Gets all ending pages currently available to the reader.
   *
   * Each ending can define a condition.
   * Only endings with passing conditions are returned.
   *
   * @returns A list of ending page entries available from current variables.
   */
  getAvailableEndings(): EveryBookEntry[] {
    const variables = this.state.getState().variables;

    return (
      this.story.endings
        ?.filter((ending) =>
          ConditionEngine.evaluate(ending.condition, variables)
        )
        .map((ending) => ending.page) ?? []
    );
  }

  /**
   * Saves the current story state to browser localStorage.
   *
   * The actual storage key is namespaced by:
   * - provided storageKey
   * - manifest id
   * - "state"
   *
   * @param storageKey - Base storage key namespace.
   *
   * @example
   * engine.saveToStorage("everybook");
   */
  saveToStorage(storageKey: string): void {
    const key = this.buildStorageKey(storageKey);

    localStorage.setItem(key, JSON.stringify(this.state.getState()));
  }

  /**
   * Loads a saved story state from browser localStorage.
   *
   * If no saved state exists, it returns false.
   * If parsing or restoring fails, the broken save is removed
   * and false is returned.
   *
   * @param storageKey - Base storage key namespace.
   * @returns true if loading succeeded, otherwise false.
   */
  loadFromStorage(storageKey: string): boolean {
    const key = this.buildStorageKey(storageKey);
    const raw = localStorage.getItem(key);

    if (!raw) {
      return false;
    }

    try {
      const state = JSON.parse(raw) as EveryBookStoryState;
      this.restoreState(state);
      return true;
    } catch {
      // Remove invalid or outdated saved state.
      localStorage.removeItem(key);
      return false;
    }
  }

  /**
   * Clears the saved story state from browser localStorage.
   *
   * @param storageKey - Base storage key namespace.
   */
  clearStorage(storageKey: string): void {
    const key = this.buildStorageKey(storageKey);

    localStorage.removeItem(key);
  }

  /**
   * Builds a unique localStorage key for this book's story state.
   *
   * @param storageKey - Base storage key namespace.
   * @returns A namespaced storage key.
   *
   * @example
   * buildStorageKey("everybook");
   * // "everybook:my-book-id:state"
   */
  private buildStorageKey(storageKey: string): string {
    return `${storageKey}:${this.manifest.id}:state`;
  }

  /**
   * Creates a unique key for a chapter/page entry.
   *
   * This format is used by:
   * - visitedPages
   * - unlockedPages
   *
   * @param entry - The chapter/page entry.
   * @returns A key in the format "chapterId:pageId".
   */
  private entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}