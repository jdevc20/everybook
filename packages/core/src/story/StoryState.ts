import type {
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
    };

    this.markVisited(start);
  }

  getState(): EveryBookStoryState {
    return structuredClone(this.state);
  }

  getCurrentPosition(): EveryBookPosition {
    return this.state.current;
  }

  setCurrentPosition(position: EveryBookPosition): void {
    this.state.current = position;
    this.markVisited(position);
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.state.variables[key] as T | undefined;
  }

  setVariable(key: string, value: unknown): void {
    this.state.variables[key] = value;
  }

  incrementVariable(key: string, value: number): void {
    const current = Number(this.state.variables[key] ?? 0);
    this.state.variables[key] = current + value;
  }

  rememberChoice(choiceId: string): void {
    const current = this.state.current;

    const rememberedChoice: RememberedChoice = {
      choiceId,
      chapterId: current.chapterId,
      pageId: current.pageId,
      timestamp: new Date().toISOString(),
    };

    this.state.choices.push(rememberedChoice);
  }

  hasChoice(choiceId: string): boolean {
    return this.state.choices.some((choice) => choice.choiceId === choiceId);
  }

  hasVisited(chapterId: string, pageId: string): boolean {
    return this.state.visitedPages.includes(`${chapterId}/${pageId}`);
  }

  private markVisited(position: EveryBookPosition): void {
    const key = `${position.chapterId}/${position.pageId}`;

    if (!this.state.visitedPages.includes(key)) {
      this.state.visitedPages.push(key);
    }
  }

  restore(state: EveryBookStoryState): void {
    this.state = structuredClone(state);
  }
}