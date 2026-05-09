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
    element.addEventListener("click", async () => {
      const action = element.dataset.ebkAction;

      if (action === "nextPage") {
        await handlers.nextPage();
        return;
      }

      if (action === "previousPage") {
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
    });
  });
}

function parseDataValue(value: string | undefined): unknown {
  if (value === undefined) return true;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;

  if (!Number.isNaN(Number(value))) {
    return Number(value);
  }

  return value;
}