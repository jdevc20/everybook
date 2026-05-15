import { EbkPackage } from "./package/EbkPackage";
import { validateManifest } from "./manifest/ManifestValidator";
import { bindEveryBookActions } from "./runtime/actions";
import { StoryEngine } from "./story/StoryEngine";
import { ConditionEngine } from "./story/ConditionEngine";
import { PageAccessEngine } from "./story/PageAccessEngine";
import { RenderSurface } from "./rendering/RenderSurface";
import { sanitizeEveryBookHtml } from "./security/sanitizeHtml";
import type {
  EveryBookChapter,
  EveryBookEntry,
  EveryBookPosition,
  EveryBookRendererOptions,
  EveryBookStoryState,
  LoadedPage,
  RememberedChoice,
} from "./types";

export class EveryBookRenderer {
  private surface: RenderSurface;
  private ebkPackage: EbkPackage | null = null;
  private storyEngine: StoryEngine | null = null;
  private currentPosition: EveryBookPosition | null = null;
  private storageKey: string | null = null;

  constructor(options: EveryBookRendererOptions) {
    this.surface = new RenderSurface(options.container);
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

    const position = this.storyEngine?.getCurrentPosition() ?? manifest.entry;

    await this.goToPage(position.chapterId, position.pageId);
  }

  async goToPage(chapterId: string, pageId: string): Promise<void> {
    if (!this.ebkPackage) {
      throw new Error("No EBK package loaded.");
    }

    const manifest = this.ebkPackage.getManifest();
    const target: EveryBookEntry = { chapterId, pageId };
    const targetPage = this.ebkPackage.findPage(target);
    const jumpMode = manifest.navigation?.jumpMode ?? "guarded";

    const access = PageAccessEngine.canOpenPage({
      mode: jumpMode,
      page: targetPage,
      state: this.storyEngine?.getState() ?? null,
      story: this.ebkPackage.getStory(),
      target,
    });

    if (!access.allowed) {
      this.showBlockedPage(access.readerMessage, access.fallback);
      return;
    }

    if (access.usedDefaultStoryline && this.storyEngine) {
      this.storyEngine.markUsedDefaultStoryline();
      this.storyEngine.applyDefaultVariables();
    }

    const page = await this.ebkPackage.loadPage(target);

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

    if (manifest.navigation?.allowBacktracking === false) {
      this.showBlockedPage("Backtracking is disabled for this EveryBook.");
      return;
    }

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

    this.saveProgress();
    this.renderStoryDocumentation();

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

  getStoryState(): EveryBookStoryState | null {
    return this.storyEngine?.getState() ?? null;
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.storyEngine?.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.storyEngine?.setVariable(key, value);
    this.saveProgress();
    this.renderStoryDocumentation();
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
    this.renderStoryDocumentation();
  }

  clear(): void {
    this.surface.clear();
    this.ebkPackage = null;
    this.storyEngine = null;
    this.currentPosition = null;
  }

  private async injectStyles(): Promise<void> {
    if (!this.ebkPackage) return;

    const css = await this.ebkPackage.loadStyles();

    this.surface.setBookStyles(css);
  }

  private async renderPage(page: LoadedPage): Promise<void> {
    const cleanHtml = sanitizeEveryBookHtml(page.html);

    this.surface.setContent(cleanHtml);

    this.currentPosition = {
      chapterId: page.chapterId,
      pageId: page.pageId,
      timelineId: page.timelineId,
    };

    if (this.storyEngine) {
      this.storyEngine.setCurrentPosition(this.currentPosition);
    }

    this.applyConditionalContent();
    this.bindCurrentPageActions();

    this.saveProgress();
    this.renderStoryDocumentation();
  }

  private bindCurrentPageActions(): void {
    bindEveryBookActions(this.surface.contentRoot, {
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
  }

  private showBlockedPage(
    message: string,
    fallback?: EveryBookEntry
  ): void {
    const fallbackButton = fallback
      ? `
        <button
          data-ebk-action="goToPage"
          data-chapter-id="${escapeHtml(fallback.chapterId)}"
          data-page-id="${escapeHtml(fallback.pageId)}"
        >
          Go to required story page
        </button>
      `
      : "";

    this.surface.setContent(`
      <section class="ebk-blocked-page">
        <h1>Page Locked</h1>
        <p>${escapeHtml(message)}</p>

        <div>
          ${fallbackButton}
          <button data-ebk-action="previousPage">
            Go Back
          </button>
        </div>
      </section>
    `);

    this.bindCurrentPageActions();
    this.renderStoryDocumentation();
  }

  private applyConditionalContent(): void {
    if (!this.storyEngine) {
      return;
    }

    const state = this.storyEngine.getState();

    const conditionalElements =
      this.surface.contentRoot.querySelectorAll<HTMLElement>("[data-ebk-if]");

    conditionalElements.forEach((element) => {
      const condition = element.dataset.ebkIf;
      const visible = ConditionEngine.evaluate(condition, state.variables);

      if (!visible) {
        element.remove();
      }
    });
  }

  private renderStoryDocumentation(): void {
    if (!this.storyEngine || !this.ebkPackage) {
      this.surface.clearFooter();
      return;
    }

    const state = this.storyEngine.getState();

    const currentTitle = this.currentPosition
      ? this.getReadablePosition(this.currentPosition)
      : "No page loaded";

    const choicesHtml = this.renderChoiceDocumentation(state.choices);
    const variablesHtml = this.renderVariablesDocumentation(state.variables);
    const visitedHtml = this.renderVisitedPagesDocumentation(state.visitedPages);

    const defaultStorylineNote = state.usedDefaultStoryline
      ? `
        <p class="ebk-story-docs__meta">
          Note: This session used default story assumptions because some pages were opened without earlier choices.
        </p>
      `
      : "";

    this.surface.setFooter(`
      <details class="ebk-story-docs" open>
        <summary class="ebk-story-docs__summary">
          <div class="ebk-story-docs__header">
            <div>
              <h2 class="ebk-story-docs__title">Your Story Notes</h2>
              <p class="ebk-story-docs__meta">Current page: ${escapeHtml(currentTitle)}</p>
              ${defaultStorylineNote}
            </div>

            <span class="ebk-story-docs__toggle"></span>
          </div>
        </summary>

        <div class="ebk-story-docs__body">
          <section class="ebk-story-docs__section">
            <h3 class="ebk-story-docs__section-title">Choices Made</h3>
            ${choicesHtml}
          </section>

          <section class="ebk-story-docs__section">
            <h3 class="ebk-story-docs__section-title">Story Variables</h3>
            ${variablesHtml}
          </section>

          <section class="ebk-story-docs__section">
            <h3 class="ebk-story-docs__section-title">Visited Pages</h3>
            ${visitedHtml}
          </section>
        </div>
      </details>
    `);
  }

  private renderChoiceDocumentation(choices: RememberedChoice[]): string {
    if (!choices.length) {
      return `<p class="ebk-story-docs__empty">No choices made yet.</p>`;
    }

    const items = choices
      .map((choice) => {
        const choiceLabel = this.getChoiceLabel(choice.choiceId);
        const source = this.getReadablePosition({
          chapterId: choice.chapterId,
          pageId: choice.pageId,
        });

        return `
          <li class="ebk-story-docs__item">
            <strong>${escapeHtml(choiceLabel)}</strong>
            <br />
            <span>Made at ${escapeHtml(source)}</span>
          </li>
        `;
      })
      .join("");

    return `<ol class="ebk-story-docs__list">${items}</ol>`;
  }

  private renderVariablesDocumentation(
    variables: Record<string, unknown>
  ): string {
    const entries = Object.entries(variables);

    if (!entries.length) {
      return `<p class="ebk-story-docs__empty">No story variables yet.</p>`;
    }

    const chips = entries
      .map(([key, value]) => {
        return `
          <span class="ebk-story-docs__chip">
            ${escapeHtml(key)} = ${escapeHtml(formatValue(value))}
          </span>
        `;
      })
      .join("");

    return `<div class="ebk-story-docs__variables">${chips}</div>`;
  }

  private renderVisitedPagesDocumentation(visitedPages: string[]): string {
    if (!visitedPages.length) {
      return `<p class="ebk-story-docs__empty">No visited pages yet.</p>`;
    }

    const items = visitedPages
      .slice(-10)
      .map((pageKey) => {
        const [chapterId, pageId] = pageKey.includes(":")
          ? pageKey.split(":")
          : pageKey.split("/");

        const title = this.getReadablePosition({
          chapterId,
          pageId,
        });

        return `
          <li class="ebk-story-docs__item">
            ${escapeHtml(title)}
          </li>
        `;
      })
      .join("");

    return `<ol class="ebk-story-docs__list">${items}</ol>`;
  }

  private getChoiceLabel(choiceId: string): string {
    const story = this.storyEngine?.getStory();
    const choice = story?.choices?.find((item) => item.id === choiceId);

    return choice?.label ?? choiceId;
  }

  private getReadablePosition(position: {
    chapterId: string;
    pageId: string;
  }): string {
    const manifest = this.ebkPackage?.getManifest();

    if (!manifest) {
      return `${position.chapterId} / ${position.pageId}`;
    }

    const chapter = manifest.chapters.find(
      (item) => item.id === position.chapterId
    );

    const page = chapter?.pages.find((item) => item.id === position.pageId);

    const chapterTitle = chapter?.title ?? position.chapterId;
    const pageTitle = page?.title ?? position.pageId;

    return `${chapterTitle} / ${pageTitle}`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace('"', "&quot;")
    .replace("'", "&#039;");
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}