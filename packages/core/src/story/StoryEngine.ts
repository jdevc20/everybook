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
  private story: EveryBookStory;
  private state: StoryState;

  constructor(manifest: EveryBookManifest, story: EveryBookStory) {
    this.story = story;

    const start: EveryBookPosition = {
      chapterId: story.start.chapterId,
      pageId: story.start.pageId,
      timelineId: story.mainTimeline,
    };

    this.state = new StoryState(manifest.id, story, start);
  }

  getStory(): EveryBookStory {
    return this.story;
  }

  getState(): EveryBookStoryState {
    return this.state.getState();
  }

  restoreState(state: EveryBookStoryState): void {
    this.state.restore(state);
  }

  getCurrentPosition(): EveryBookPosition {
    return this.state.getCurrentPosition();
  }

  setCurrentPosition(position: EveryBookPosition): void {
    this.state.setCurrentPosition(position);
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.state.setVariable(key, value);
  }

  rememberChoice(choiceId: string): void {
    this.state.rememberChoice(choiceId);
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

    for (const effect of choice.effects ?? []) {
      if (effect.type === "setVariable") {
        this.state.setVariable(effect.key, effect.value);
      }

      if (effect.type === "incrementVariable") {
        this.state.incrementVariable(effect.key, effect.value);
      }

      if (effect.type === "setTimeline") {
        const current = this.state.getCurrentPosition();

        this.state.setCurrentPosition({
          ...current,
          timelineId: effect.timelineId,
        });
      }

      if (effect.type === "rememberChoice") {
        this.state.rememberChoice(effect.choiceId);
      }
    }

    return choice.goTo;
  }

  getAvailableEndings(): EveryBookEntry[] {
    const variables = this.state.getState().variables;

    return (
      this.story.endings
        ?.filter((ending) => ConditionEngine.evaluate(ending.condition, variables))
        .map((ending) => ending.page) ?? []
    );
  }

  saveToStorage(storageKey: string): void {
    localStorage.setItem(storageKey, JSON.stringify(this.state.getState()));
  }

  loadFromStorage(storageKey: string): boolean {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return false;
    }

    const state = JSON.parse(raw) as EveryBookStoryState;
    this.state.restore(state);

    return true;
  }

  clearStorage(storageKey: string): void {
    localStorage.removeItem(storageKey);
  }
}