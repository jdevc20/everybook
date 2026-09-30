import { EveryBookEngine } from "./EveryBookEngine";
import type { EveryBookNavigationResult } from "./EveryBookEngine";
import { bindEveryBookActions } from "./runtime/actions";
import { ConditionEngine } from "./story/ConditionEngine";
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
  private readonly surface: RenderSurface;
  private readonly engine: EveryBookEngine;

  constructor(options: EveryBookRendererOptions) {
    this.surface = new RenderSurface(options.container);
    this.engine = new EveryBookEngine({
      storageKey: options.storageKey,
    });
  }

  async open(file: File | Blob | ArrayBuffer): Promise<void> {
    const result = await this.engine.open(file);
    this.surface.setBookStyles(await this.engine.getBookStyles());
    await this.presentNavigationResult(result);
  }

  async goToPage(chapterId: string, pageId: string): Promise<void> {
    await this.presentNavigationResult(
      await this.engine.goToPage(chapterId, pageId)
    );
  }

  async nextPage(): Promise<void> {
    await this.presentNavigationResult(await this.engine.nextPage());
  }

  async previousPage(): Promise<void> {
    await this.presentNavigationResult(await this.engine.previousPage());
  }

  async applyChoice(choiceId: string): Promise<void> {
    await this.presentNavigationResult(
      await this.engine.applyChoice(choiceId)
    );
  }

  getCurrentPosition(): EveryBookPosition | null {
    return this.engine.getCurrentPosition();
  }

  getTableOfContents(): EveryBookChapter[] {
    return this.engine.getTableOfContents();
  }

  getStoryState(): EveryBookStoryState | null {
    return this.engine.getStoryState();
  }

  getVariable<T = unknown>(key: string): T | undefined {
    return this.engine.getVariable<T>(key);
  }

  setVariable(key: string, value: unknown): void {
    this.engine.setVariable(key, value);
    this.applyConditionalContent();
    this.renderStoryDocumentation();
  }

  saveProgress(): void {
    this.engine.saveProgress();
  }

  clearProgress(): void {
    this.engine.clearProgress();
    this.renderStoryDocumentation();
  }

  clear(): void {
    this.engine.clear();
    this.surface.clear();
  }

  getEngine(): EveryBookEngine {
    return this.engine;
  }

  private async presentNavigationResult(
    result: EveryBookNavigationResult
  ): Promise<void> {
    if (result.status === "page") {
      this.renderPage(result.page);
      return;
    }

    if (result.status === "blocked") {
      this.showBlockedPage(result.message, result.fallback);
      return;
    }

    console.info("No further EveryBook page is available.");
  }

  private renderPage(page: LoadedPage): void {
    const cleanHtml = sanitizeEveryBookHtml(page.html);

    this.surface.setContent(cleanHtml);
    this.applyConditionalContent();
    this.bindCurrentPageActions();
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
    const state = this.engine.getStoryState();

    if (!state) {
      return;
    }

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
    const state = this.engine.getStoryState();

    if (!state) {
      this.surface.clearFooter();
      return;
    }

    const currentPosition = this.engine.getCurrentPosition();
    const currentTitle = currentPosition
      ? this.getReadablePosition(currentPosition)
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
    const choice = this.engine
      .getStory()
      ?.choices?.find((item) => item.id === choiceId);

    return choice?.label ?? choiceId;
  }

  private getReadablePosition(position: {
    chapterId: string;
    pageId: string;
  }): string {
    const manifest = this.engine.getManifest();

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
