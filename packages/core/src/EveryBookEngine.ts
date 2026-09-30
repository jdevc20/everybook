import { EbkPackage } from "./package/EbkPackage";
import { validateManifest } from "./manifest/ManifestValidator";
import { validateStory } from "./story/StoryValidator";
import { StoryEngine } from "./story/StoryEngine";
import { PageAccessEngine } from "./story/PageAccessEngine";
import type {
  EveryBookChapter,
  EveryBookEngineOptions,
  EveryBookEntry,
  EveryBookManifest,
  EveryBookPosition,
  EveryBookStory,
  EveryBookStoryState,
  LoadedPage,
} from "./types";

export type EveryBookNavigationResult =
  | {
      status: "page";
      page: LoadedPage;
    }
  | {
      status: "blocked";
      message: string;
      reason: string;
      fallback?: EveryBookEntry;
    }
  | {
      status: "end";
    };

export class EveryBookEngine {
  private ebkPackage: EbkPackage | null = null;
  private storyEngine: StoryEngine | null = null;
  private currentPosition: EveryBookPosition | null = null;
  private readonly storageKey: string | null;

  constructor(options: EveryBookEngineOptions = {}) {
    this.storageKey = options.storageKey ?? null;
  }

  async open(file: File | Blob | ArrayBuffer): Promise<EveryBookNavigationResult> {
    const ebk = new EbkPackage();
    await ebk.load(file);

    const manifest = ebk.getManifest();
    validateManifest(manifest);

    const story = ebk.getStory();
    let storyEngine: StoryEngine | null = null;

    if (story) {
      validateStory(manifest, story);
      storyEngine = new StoryEngine(manifest, story);

      if (this.storageKey) {
        storyEngine.loadFromStorage(this.storageKey);
      }
    }

    this.ebkPackage = ebk;
    this.storyEngine = storyEngine;
    this.currentPosition = null;

    const position = storyEngine?.getCurrentPosition() ?? manifest.entry;
    return this.goToPage(position.chapterId, position.pageId);
  }

  async goToPage(
    chapterId: string,
    pageId: string
  ): Promise<EveryBookNavigationResult> {
    const ebk = this.requirePackage();
    const manifest = ebk.getManifest();
    const target: EveryBookEntry = { chapterId, pageId };
    const targetPage = ebk.findPage(target);
    const jumpMode = manifest.navigation?.jumpMode ?? "guarded";

    const access = PageAccessEngine.canOpenPage({
      mode: jumpMode,
      page: targetPage,
      state: this.storyEngine?.getState() ?? null,
      story: ebk.getStory(),
      target,
    });

    if (!access.allowed) {
      return {
        status: "blocked",
        message: access.readerMessage,
        reason: access.reason,
        fallback: access.fallback,
      };
    }

    if (access.usedDefaultStoryline && this.storyEngine) {
      this.storyEngine.markUsedDefaultStoryline();
      this.storyEngine.applyDefaultVariables();
    }

    const page = await ebk.loadPage(target);

    this.currentPosition = {
      chapterId: page.chapterId,
      pageId: page.pageId,
      timelineId: page.timelineId,
    };

    this.storyEngine?.setCurrentPosition(this.currentPosition);
    this.saveProgress();

    return { status: "page", page };
  }

  async nextPage(): Promise<EveryBookNavigationResult> {
    const ebk = this.requirePackage();
    const current = this.requireCurrentPosition();
    const manifest = ebk.getManifest();

    const chapterIndex = manifest.chapters.findIndex(
      (chapter) => chapter.id === current.chapterId
    );

    if (chapterIndex === -1) {
      throw new Error("Current chapter not found.");
    }

    const currentChapter = manifest.chapters[chapterIndex];
    const pageIndex = currentChapter.pages.findIndex(
      (page) => page.id === current.pageId
    );

    if (pageIndex === -1) {
      throw new Error("Current page not found.");
    }

    const nextPageInChapter = currentChapter.pages[pageIndex + 1];

    if (nextPageInChapter) {
      return this.goToPage(currentChapter.id, nextPageInChapter.id);
    }

    const nextChapter = manifest.chapters[chapterIndex + 1];

    if (nextChapter?.pages[0]) {
      return this.goToPage(nextChapter.id, nextChapter.pages[0].id);
    }

    const ending = this.storyEngine?.getAvailableEndings()[0];

    if (ending) {
      return this.goToPage(ending.chapterId, ending.pageId);
    }

    return { status: "end" };
  }

  async previousPage(): Promise<EveryBookNavigationResult> {
    const ebk = this.requirePackage();
    const current = this.requireCurrentPosition();
    const manifest = ebk.getManifest();

    if (manifest.navigation?.allowBacktracking === false) {
      return {
        status: "blocked",
        reason: "Backtracking is disabled.",
        message: "Backtracking is disabled for this EveryBook.",
      };
    }

    const chapterIndex = manifest.chapters.findIndex(
      (chapter) => chapter.id === current.chapterId
    );

    if (chapterIndex === -1) {
      throw new Error("Current chapter not found.");
    }

    const currentChapter = manifest.chapters[chapterIndex];
    const pageIndex = currentChapter.pages.findIndex(
      (page) => page.id === current.pageId
    );

    if (pageIndex === -1) {
      throw new Error("Current page not found.");
    }

    const previousPageInChapter = currentChapter.pages[pageIndex - 1];

    if (previousPageInChapter) {
      return this.goToPage(currentChapter.id, previousPageInChapter.id);
    }

    const previousChapter = manifest.chapters[chapterIndex - 1];

    if (previousChapter?.pages.length) {
      const lastPage = previousChapter.pages[previousChapter.pages.length - 1];
      return this.goToPage(previousChapter.id, lastPage.id);
    }

    return { status: "end" };
  }

  async applyChoice(choiceId: string): Promise<EveryBookNavigationResult> {
    if (!this.storyEngine) {
      throw new Error("No story engine loaded.");
    }

    const target = this.storyEngine.applyChoice(choiceId);
    this.saveProgress();

    return this.goToPage(target.chapterId, target.pageId);
  }

  getCurrentPosition(): EveryBookPosition | null {
    return this.currentPosition ? structuredClone(this.currentPosition) : null;
  }

  getTableOfContents(): EveryBookChapter[] {
    return this.ebkPackage?.getChapters() ?? [];
  }

  getManifest(): EveryBookManifest | null {
    return this.ebkPackage?.getManifest() ?? null;
  }

  getStory(): EveryBookStory | null {
    return this.ebkPackage?.getStory() ?? null;
  }

  getStoryState(): EveryBookStoryState | null {
    return this.storyEngine?.getState() ?? null;
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.storyEngine?.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.storyEngine?.setVariable(key, value);
    this.saveProgress();
  }

  async getBookStyles(): Promise<string> {
    return this.ebkPackage?.loadStyles() ?? "";
  }

  saveProgress(): void {
    if (this.storageKey && this.storyEngine) {
      this.storyEngine.saveToStorage(this.storageKey);
    }
  }

  clearProgress(): void {
    if (this.storageKey && this.storyEngine) {
      this.storyEngine.clearStorage(this.storageKey);
    }
  }

  clear(): void {
    this.ebkPackage = null;
    this.storyEngine = null;
    this.currentPosition = null;
  }

  private requirePackage(): EbkPackage {
    if (!this.ebkPackage) {
      throw new Error("No EBK package loaded.");
    }

    return this.ebkPackage;
  }

  private requireCurrentPosition(): EveryBookPosition {
    if (!this.currentPosition) {
      throw new Error("No EBK page is currently loaded.");
    }

    return this.currentPosition;
  }
}
