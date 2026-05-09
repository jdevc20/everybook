export type EveryBookActionHandler = {
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  goToPage: (chapterId: string, pageId: string) => Promise<void>;
  choice: (choiceId: string) => Promise<void>;
  setVariable: (key: string, value: unknown) => Promise<void>;
};

export function bindEveryBookActions(
  root: HTMLElement,
  handlers: EveryBookActionHandler
): void {
  const elements = root.querySelectorAll<HTMLElement>("[data-ebk-action]");

  elements.forEach((element) => {
    if (element.dataset.ebkBound === "true") {
      return;
    }

    element.dataset.ebkBound = "true";

    element.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const action = element.dataset.ebkAction;

      try {
        if (action === "nextPage") {
          await handlers.nextPage();
          return;
        }

        if (action === "previousPage" || action === "back") {
          await handlers.previousPage();
          return;
        }

        if (action === "goToPage") {
          const chapterId = element.dataset.chapterId;
          const pageId = element.dataset.pageId;

          if (!chapterId || !pageId) {
            throw new Error(
              "goToPage requires data-chapter-id and data-page-id."
            );
          }

          await handlers.goToPage(chapterId, pageId);
          return;
        }

        if (action === "choice") {
          const choiceId = element.dataset.choiceId;

          if (!choiceId) {
            throw new Error("choice action requires data-choice-id.");
          }

          await handlers.choice(choiceId);
          return;
        }

        if (action === "setVariable") {
          const key = element.dataset.key;
          const value = parseDataValue(element.dataset.value);

          if (!key) {
            throw new Error("setVariable requires data-key.");
          }

          await handlers.setVariable(key, value);
          return;
        }

        throw new Error(`Unsupported EveryBook action: ${action}`);
      } catch (error) {
        console.error("[EveryBook Action Error]", error);
        throw error;
      }
    });
  });
}

function parseDataValue(value: string | undefined): unknown {
  if (value === undefined) return true;

  const trimmed = value.trim();

  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  if (isJsonLike(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (isNumeric(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

function isJsonLike(value: string): boolean {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  );
}

function isNumeric(value: string): boolean {
  return value !== "" && !Number.isNaN(Number(value));
}