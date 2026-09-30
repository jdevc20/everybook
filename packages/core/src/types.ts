export type EveryBookJumpMode = "free" | "guarded" | "storyStrict";

export type EveryBookEntry = {
  chapterId: string;
  pageId: string;
};

export type EveryBookPosition = {
  chapterId: string;
  pageId: string;
  timelineId?: string;
};

export type EveryBookPageMode = "linear" | "choice" | "mixed";

export type EveryBookPageRequirement =
  | {
      type: "choiceMade";
      choiceId: string;
    }
  | {
      type: "variableExists";
      key: string;
    }
  | {
      type: "variableEquals";
      key: string;
      value: unknown;
    }
  | {
      type: "visitedPage";
      chapterId: string;
      pageId: string;
    };

export type EveryBookPageAccess = {
  requirements?: EveryBookPageRequirement[];

  /**
   * Page to send the reader to when requirements are missing.
   * Used mainly in guarded mode.
   */
  fallback?: EveryBookEntry;

  /**
   * Friendly message shown when the page is blocked.
   */
  lockedMessage?: string;
};

export type EveryBookPage = {
  id: string;
  title?: string;
  src: string;
  timeline?: string;

  /**
   * linear = normal reading page
   * choice = reader should pick a choice
   * mixed = choices exist but next/previous can still be used
   */
  mode?: EveryBookPageMode;

  /**
   * Access rules for guarded and storyStrict navigation.
   */
  access?: EveryBookPageAccess;
};

export type EveryBookChapter = {
  id: string;
  title: string;
  pages: EveryBookPage[];
};

export type EveryBookManifest = {
  id: string;
  format: "everybook";
  version: string;
  title: string;
  author?: string;
  language?: string;
  description?: string;
  cover?: string;

  /**
   * First page of the book.
   */
  entry: EveryBookEntry;

  /**
   * Optional story JSON file inside the .ebk package.
   * Example: "story/story.json"
   */
  story?: string;

  styles?: string[];
  chapters: EveryBookChapter[];

  /**
   * Navigation behavior:
   *
   * free:
   * Reader can jump anywhere. If story state is missing,
   * the engine may use default story variables/default storyline.
   *
   * guarded:
   * Reader can jump to normal pages, but pages with requirements
   * are protected.
   *
   * storyStrict:
   * Reader cannot jump to pages that are not unlocked/visited.
   */
  navigation?: {
    jumpMode?: EveryBookJumpMode;
    defaultEntry?: EveryBookEntry;
    allowBacktracking?: boolean;
  };

  permissions?: {
    audio?: boolean;
    video?: boolean;
    network?: boolean;
    storage?: boolean;
  };
};

export type EveryBookRendererOptions = {
  container: HTMLElement | string;
  storageKey?: string;
};

export type EveryBookEngineOptions = {
  storageKey?: string;
};

export type LoadedPage = {
  chapterId: string;
  pageId: string;
  path: string;
  html: string;
  timelineId?: string;
};

export type EveryBookChoiceEffect =
  | {
      type: "setVariable";
      key: string;
      value: unknown;
    }
  | {
      type: "incrementVariable";
      key: string;
      value: number;
    }
  | {
      type: "setTimeline";
      timelineId: string;
    }
  | {
      type: "rememberChoice";
      choiceId: string;
    };

export type EveryBookChoice = {
  id: string;
  label: string;
  /** Allow the same choice effects to be applied more than once. Defaults to false. */
  repeatable?: boolean;
  from?: EveryBookPosition;
  condition?: string;
  effects?: EveryBookChoiceEffect[];
  goTo: EveryBookEntry;
};

export type EveryBookTimeline = {
  id: string;
  title: string;
  description?: string;
};

export type EveryBookEnding = {
  id: string;
  title: string;
  condition?: string;
  page: EveryBookEntry;
};

export type EveryBookStory = {
  version: string;
  start: EveryBookEntry;
  mainTimeline: string;
  timelines: EveryBookTimeline[];

  /**
   * Default values used when the reader jumps freely
   * without making earlier choices.
   */
  variables?: Record<string, unknown>;

  /**
   * Default story route.
   * Useful in free mode when the reader jumps ahead.
   */
  defaultPath?: EveryBookEntry[];

  choices?: EveryBookChoice[];
  endings?: EveryBookEnding[];
};

export type RememberedChoice = {
  choiceId: string;
  chapterId: string;
  pageId: string;
  timestamp: string;
};

export type EveryBookStoryState = {
  bookId: string;
  current: EveryBookPosition;
  variables: Record<string, unknown>;
  choices: RememberedChoice[];
  visitedPages: string[];

  /**
   * Used by storyStrict mode.
   * Reader can only jump to pages that are already unlocked.
   */
  unlockedPages?: string[];

  /**
   * True if the engine used default variables/default storyline
   * because the reader jumped ahead.
   */
  usedDefaultStoryline?: boolean;
};