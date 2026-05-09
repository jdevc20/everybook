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

export class StoryEngine {
  private manifest: EveryBookManifest;
  private story: EveryBookStory;
  private state: StoryState;

  constructor(manifest: EveryBookManifest, story: EveryBookStory) {
    this.manifest = manifest;
    this.story = story;

    const startEntry = manifest.navigation?.defaultEntry ?? story.start;

    const start: EveryBookPosition = {
      chapterId: startEntry.chapterId,
      pageId: startEntry.pageId,
      timelineId: story.mainTimeline,
    };

    this.state = new StoryState(manifest.id, story, start);
    this.applyDefaultVariables();
  }

  getStory(): EveryBookStory {
    return this.story;
  }

  getState(): EveryBookStoryState {
    return this.state.getState();
  }

  restoreState(state: EveryBookStoryState): void {
    if (state.bookId !== this.manifest.id) {
      throw new Error(
        `Cannot restore story state. Expected book '${this.manifest.id}', got '${state.bookId}'.`
      );
    }

    this.state.restore(state);
    this.applyDefaultVariables();
  }

  getCurrentPosition(): EveryBookPosition {
    return this.state.getCurrentPosition();
  }

  setCurrentPosition(position: EveryBookPosition): void {
    this.state.setCurrentPosition(position);
    this.markVisited(position);
    this.unlockPage(position);
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.state.setVariable(key, value);
  }

  incrementVariable(key: string, value: number): void {
    this.state.incrementVariable(key, value);
  }

  rememberChoice(choiceId: string): void {
    this.state.rememberChoice(choiceId);
  }

  hasChoice(choiceId: string): boolean {
    return this.state
      .getState()
      .choices.some((choice) => choice.choiceId === choiceId);
  }

  hasVisited(entry: EveryBookEntry): boolean {
    return this.state.getState().visitedPages.includes(this.entryKey(entry));
  }

  isUnlocked(entry: EveryBookEntry): boolean {
    const state = this.state.getState();

    return (
      state.unlockedPages?.includes(this.entryKey(entry)) ??
      this.hasVisited(entry)
    );
  }

  unlockPage(entry: EveryBookEntry): void {
    this.state.unlockPage(entry);
  }

  markVisited(entry: EveryBookEntry): void {
    this.state.markVisited(entry);
  }

  markUsedDefaultStoryline(): void {
    this.state.markUsedDefaultStoryline();
  }

  applyDefaultVariables(): void {
    const defaultVariables = this.story.variables ?? {};

    for (const [key, value] of Object.entries(defaultVariables)) {
      const current = this.state.getVariable(key);

      if (current === undefined) {
        this.state.setVariable(key, value);
      }
    }
  }

  getChoice(choiceId: string): EveryBookChoice {
    const choice = this.story.choices?.find((item) => item.id === choiceId);

    if (!choice) {
      throw new Error(`Choice not found: ${choiceId}`);
    }

    return choice;
  }

  canUseChoice(choice: EveryBookChoice): boolean {
    const variables = this.state.getState().variables;

    return ConditionEngine.evaluate(choice.condition, variables);
  }

  applyChoice(choiceId: string): EveryBookEntry {
    const choice = this.getChoice(choiceId);

    if (!this.canUseChoice(choice)) {
      throw new Error(`Choice condition failed: ${choiceId}`);
    }

    const current = this.state.getCurrentPosition();

    this.state.rememberChoice(choice.id, {
      chapterId: current.chapterId,
      pageId: current.pageId,
    });

    for (const effect of choice.effects ?? []) {
      if (effect.type === "setVariable") {
        this.state.setVariable(effect.key, effect.value);
      }

      if (effect.type === "incrementVariable") {
        this.state.incrementVariable(effect.key, effect.value);
      }

      if (effect.type === "setTimeline") {
        const currentPosition = this.state.getCurrentPosition();

        this.state.setCurrentPosition({
          ...currentPosition,
          timelineId: effect.timelineId,
        });
      }

      if (effect.type === "rememberChoice") {
        this.state.rememberChoice(effect.choiceId, {
          chapterId: current.chapterId,
          pageId: current.pageId,
        });
      }
    }

    this.state.unlockPage(choice.goTo);

    return choice.goTo;
  }

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

  saveToStorage(storageKey: string): void {
    const key = this.buildStorageKey(storageKey);

    localStorage.setItem(key, JSON.stringify(this.state.getState()));
  }

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
      localStorage.removeItem(key);
      return false;
    }
  }

  clearStorage(storageKey: string): void {
    const key = this.buildStorageKey(storageKey);

    localStorage.removeItem(key);
  }

  private buildStorageKey(storageKey: string): string {
    return `${storageKey}:${this.manifest.id}:state`;
  }

  private entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}