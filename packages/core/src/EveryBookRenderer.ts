import DOMPurify from "dompurify";
import { EbkPackage } from "./EbkPackage";
import { validateManifest } from "./ManifestValidator";
import { bindEveryBookActions } from "./actions";
import { StoryEngine } from "./story/StoryEngine";
import { ConditionEngine } from "./story/ConditionEngine";
import type {
  EveryBookChapter,
  EveryBookPosition,
  EveryBookRendererOptions,
  LoadedPage,
} from "./types";

export class EveryBookRenderer {
  private container: HTMLElement;
  private ebkPackage: EbkPackage | null = null;
  private storyEngine: StoryEngine | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private currentPosition: EveryBookPosition | null = null;
  private storageKey: string | null = null;

  constructor(options: EveryBookRendererOptions) {
    const element =
      typeof options.container === "string"
        ? document.querySelector(options.container)
        : options.container;

    if (!element) {
      throw new Error("EveryBook container not found.");
    }

    this.container = element as HTMLElement;
    this.storageKey = options.storageKey ?? null;
  }

  async open(file: File | Blob | ArrayBuffer): Promise<void> {
    const ebk = new EbkPackage();

    await ebk.load(file);

    const manifest = ebk.getManifest();
    validateManifest(manifest);

    this.ebkPackage = ebk;

    const story = ebk.getStory();

    if (story) {
      this.storyEngine = new StoryEngine(manifest, story);

      if (this.storageKey) {
        this.storyEngine.loadFromStorage(this.storageKey);
      }
    }

    await this.injectStyles();

    const position =
      this.storyEngine?.getCurrentPosition() ?? manifest.entry;

    await this.goToPage(position.chapterId, position.pageId);
  }

  async goToPage(chapterId: string, pageId: string): Promise<void> {
    if (!this.ebkPackage) {
      throw new Error("No EBK package loaded.");
    }

    const page = await this.ebkPackage.loadPage(chapterId, pageId);

    await this.renderPage(page);
  }

  async nextPage(): Promise<void> {
    if (!this.ebkPackage || !this.currentPosition) {
      throw new Error("No EBK page is currently loaded.");
    }

    const manifest = this.ebkPackage.getManifest();

    const chapterIndex = manifest.chapters.findIndex(
      (chapter) => chapter.id === this.currentPosition?.chapterId
    );

    if (chapterIndex === -1) {
      throw new Error("Current chapter not found.");
    }

    const currentChapter = manifest.chapters[chapterIndex];

    const pageIndex = currentChapter.pages.findIndex(
      (page) => page.id === this.currentPosition?.pageId
    );

    if (pageIndex === -1) {
      throw new Error("Current page not found.");
    }

    const nextPageInChapter = currentChapter.pages[pageIndex + 1];

    if (nextPageInChapter) {
      await this.goToPage(currentChapter.id, nextPageInChapter.id);
      return;
    }

    const nextChapter = manifest.chapters[chapterIndex + 1];

    if (nextChapter?.pages[0]) {
      await this.goToPage(nextChapter.id, nextChapter.pages[0].id);
      return;
    }

    const endings = this.storyEngine?.getAvailableEndings() ?? [];

    if (endings[0]) {
      await this.goToPage(endings[0].chapterId, endings[0].pageId);
      return;
    }

    console.info("Already at the last page.");
  }

  async previousPage(): Promise<void> {
    if (!this.ebkPackage || !this.currentPosition) {
      throw new Error("No EBK page is currently loaded.");
    }

    const manifest = this.ebkPackage.getManifest();

    const chapterIndex = manifest.chapters.findIndex(
      (chapter) => chapter.id === this.currentPosition?.chapterId
    );

    if (chapterIndex === -1) {
      throw new Error("Current chapter not found.");
    }

    const currentChapter = manifest.chapters[chapterIndex];

    const pageIndex = currentChapter.pages.findIndex(
      (page) => page.id === this.currentPosition?.pageId
    );

    if (pageIndex === -1) {
      throw new Error("Current page not found.");
    }

    const previousPageInChapter = currentChapter.pages[pageIndex - 1];

    if (previousPageInChapter) {
      await this.goToPage(currentChapter.id, previousPageInChapter.id);
      return;
    }

    const previousChapter = manifest.chapters[chapterIndex - 1];

    if (previousChapter?.pages.length) {
      const lastPage = previousChapter.pages[previousChapter.pages.length - 1];
      await this.goToPage(previousChapter.id, lastPage.id);
      return;
    }

    console.info("Already at the first page.");
  }

  async applyChoice(choiceId: string): Promise<void> {
    if (!this.storyEngine) {
      throw new Error("No story engine loaded.");
    }

    const target = this.storyEngine.applyChoice(choiceId);

    await this.goToPage(target.chapterId, target.pageId);
  }

  getCurrentPosition(): EveryBookPosition | null {
    return this.currentPosition;
  }

  getTableOfContents(): EveryBookChapter[] {
    if (!this.ebkPackage) {
      return [];
    }

    return this.ebkPackage.getChapters();
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.storyEngine?.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.storyEngine?.setVariable(key, value);
    this.saveProgress();
  }

  saveProgress(): void {
    if (!this.storageKey || !this.storyEngine) {
      return;
    }

    this.storyEngine.saveToStorage(this.storageKey);
  }

  clearProgress(): void {
    if (!this.storageKey || !this.storyEngine) {
      return;
    }

    this.storyEngine.clearStorage(this.storageKey);
  }

  private async injectStyles(): Promise<void> {
    if (!this.ebkPackage) return;

    const css = await this.ebkPackage.loadStyles();

    if (this.styleElement) {
      this.styleElement.remove();
    }

    this.styleElement = document.createElement("style");
    this.styleElement.setAttribute("data-everybook-style", "true");
    this.styleElement.textContent = css;

    document.head.appendChild(this.styleElement);
  }

  private async renderPage(page: LoadedPage): Promise<void> {
    const cleanHtml = DOMPurify.sanitize(page.html, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "p",
        "span",
        "strong",
        "em",
        "section",
        "article",
        "div",
        "img",
        "audio",
        "video",
        "button",
        "ul",
        "ol",
        "li",
        "br",
      ],
      ALLOWED_ATTR: [
        "src",
        "alt",
        "controls",
        "class",
        "id",
        "data-ebk-action",
        "data-target",
        "data-chapter-id",
        "data-page-id",
        "data-choice-id",
        "data-key",
        "data-value",
        "data-ebk-if",
      ],
    });

    this.container.innerHTML = cleanHtml;

    this.currentPosition = {
      chapterId: page.chapterId,
      pageId: page.pageId,
      timelineId: page.timelineId,
    };

    if (this.storyEngine) {
      this.storyEngine.setCurrentPosition(this.currentPosition);
    }

    this.applyConditionalContent();

    bindEveryBookActions(this.container, {
      nextPage: async () => {
        await this.nextPage();
      },

      previousPage: async () => {
        await this.previousPage();
      },

      goToPage: async (chapterId, pageId) => {
        await this.goToPage(chapterId, pageId);
      },

      choice: async (choiceId) => {
        await this.applyChoice(choiceId);
      },

      setVariable: async (key, value) => {
        this.setVariable(key, value);
        this.applyConditionalContent();
      },
    });

    this.saveProgress();
  }

  private applyConditionalContent(): void {
    if (!this.storyEngine) {
      return;
    }

    const state = this.storyEngine.getState();
    const conditionalElements =
      this.container.querySelectorAll<HTMLElement>("[data-ebk-if]");

    conditionalElements.forEach((element) => {
      const condition = element.dataset.ebkIf;
      const visible = ConditionEngine.evaluate(condition, state.variables);

      if (!visible) {
        element.remove();
      }
    });
  }
}