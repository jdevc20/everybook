export class RenderSurface {
  readonly host: HTMLElement;
  readonly shadowRoot: ShadowRoot;
  readonly contentRoot: HTMLElement;
  readonly footerRoot: HTMLElement;

  constructor(container: HTMLElement | string) {
    const host =
      typeof container === "string"
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!host) {
      throw new Error("EveryBook container not found.");
    }

    this.host = host;

    if (this.host.shadowRoot) {
      this.shadowRoot = this.host.shadowRoot;
      this.shadowRoot.innerHTML = "";
    } else {
      this.shadowRoot = this.host.attachShadow({ mode: "open" });
    }

    const baseStyle = document.createElement("style");
    baseStyle.textContent = `
      :host {
        all: initial;
        display: block;
        width: 100%;
        min-height: 100%;
        contain: content;
        font-family: system-ui, sans-serif;
        color: #111827;
        background: transparent;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      [data-ebk-shell] {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
      }

      [data-ebk-root] {
        display: block;
        width: 100%;
        min-height: 360px;
      }

      [data-ebk-footer] {
        display: block;
        width: 100%;
        margin-top: 24px;
        border-top: 1px solid #e5e7eb;
        padding-top: 16px;
      }

      img,
      video {
        max-width: 100%;
        height: auto;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      .ebk-story-docs {
        font-family: system-ui, sans-serif;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 16px;
        color: #111827;
      }

      .ebk-story-docs__summary {
        cursor: pointer;
        list-style: none;
      }

      .ebk-story-docs__summary::-webkit-details-marker {
        display: none;
      }

      .ebk-story-docs__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .ebk-story-docs__title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }

      .ebk-story-docs__meta {
        margin: 4px 0 0;
        font-size: 12px;
        color: #6b7280;
      }

      .ebk-story-docs__toggle {
        border: 1px solid #d1d5db;
        background: #ffffff;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        color: #374151;
      }

      details[open] .ebk-story-docs__toggle::after {
        content: "Hide";
      }

      details:not([open]) .ebk-story-docs__toggle::after {
        content: "Show";
      }

      .ebk-story-docs__body {
        margin-top: 12px;
      }

      .ebk-story-docs__section {
        margin-top: 12px;
      }

      .ebk-story-docs__section-title {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        color: #374151;
      }

      .ebk-story-docs__list {
        margin: 0;
        padding-left: 18px;
      }

      .ebk-story-docs__item {
        margin: 6px 0;
        font-size: 13px;
        line-height: 1.45;
      }

      .ebk-story-docs__empty {
        margin: 0;
        font-size: 13px;
        color: #6b7280;
      }

      .ebk-story-docs__variables {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ebk-story-docs__chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        padding: 4px 8px;
        font-size: 12px;
        color: #374151;
      }
    `;

    const shell = document.createElement("div");
    shell.setAttribute("data-ebk-shell", "true");

    this.contentRoot = document.createElement("div");
    this.contentRoot.setAttribute("data-ebk-root", "true");

    this.footerRoot = document.createElement("div");
    this.footerRoot.setAttribute("data-ebk-footer", "true");

    shell.appendChild(this.contentRoot);
    shell.appendChild(this.footerRoot);

    this.shadowRoot.appendChild(baseStyle);
    this.shadowRoot.appendChild(shell);
  }

  setBookStyles(css: string): void {
    this.shadowRoot
      .querySelectorAll("[data-ebk-book-style]")
      .forEach((node) => node.remove());

    if (!css.trim()) {
      return;
    }

    const style = document.createElement("style");
    style.setAttribute("data-ebk-book-style", "true");
    style.textContent = css;

    this.shadowRoot.appendChild(style);
  }

  setContent(html: string): void {
    this.contentRoot.innerHTML = html;
  }

  setFooter(html: string): void {
    this.footerRoot.innerHTML = html;
  }

  clearFooter(): void {
    this.footerRoot.innerHTML = "";
  }

  clear(): void {
    this.contentRoot.innerHTML = "";
    this.footerRoot.innerHTML = "";

    this.shadowRoot
      .querySelectorAll("[data-ebk-book-style]")
      .forEach((node) => node.remove());
  }
}
