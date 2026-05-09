import type {
  EveryBookEntry,
  EveryBookPosition,
  EveryBookStory,
  EveryBookStoryState,
  RememberedChoice,
} from "../types";

export class StoryState {
  private state: EveryBookStoryState;

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

    this.markVisited(start);
    this.unlockPage(start);
  }

  getState(): EveryBookStoryState {
    return structuredClone(this.state);
  }

  getCurrentPosition(): EveryBookPosition {
    return structuredClone(this.state.current);
  }

  setCurrentPosition(position: EveryBookPosition): void {
    this.state.current = structuredClone(position);
    this.markVisited(position);
    this.unlockPage(position);
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.variables[key] as T | undefined;
  }

  setVariable(key: string, value: unknown): void {
    this.state.variables[key] = value;
  }

  incrementVariable(key: string, value: number): void {
    const current = Number(this.state.variables[key] ?? 0);

    if (Number.isNaN(current)) {
      this.state.variables[key] = value;
      return;
    }

    this.state.variables[key] = current + value;
  }

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

  hasChoice(choiceId: string): boolean {
    return this.state.choices.some((choice) => choice.choiceId === choiceId);
  }

  hasVisited(entry: EveryBookEntry): boolean {
    return this.state.visitedPages.includes(this.entryKey(entry));
  }

  markVisited(entry: EveryBookEntry): void {
    const key = this.entryKey(entry);

    if (!this.state.visitedPages.includes(key)) {
      this.state.visitedPages.push(key);
    }
  }

  isUnlocked(entry: EveryBookEntry): boolean {
    const key = this.entryKey(entry);

    return this.state.unlockedPages?.includes(key) ?? false;
  }

  unlockPage(entry: EveryBookEntry): void {
    const key = this.entryKey(entry);

    if (!this.state.unlockedPages) {
      this.state.unlockedPages = [];
    }

    if (!this.state.unlockedPages.includes(key)) {
      this.state.unlockedPages.push(key);
    }
  }

  markUsedDefaultStoryline(): void {
    this.state.usedDefaultStoryline = true;
  }

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

    this.markVisited(this.state.current);
    this.unlockPage(this.state.current);
  }

  private entryKey(entry: EveryBookEntry): string {
    return `${entry.chapterId}:${entry.pageId}`;
  }
}