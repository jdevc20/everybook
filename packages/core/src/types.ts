export type EveryBookPage = {
  id: string;
  title?: string;
  src: string;
  timeline?: string;
};

export type EveryBookChapter = {
  id: string;
  title: string;
  pages: EveryBookPage[];
};

export type EveryBookEntry = {
  chapterId: string;
  pageId: string;
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
  entry: EveryBookEntry;
  story?: string;
  styles?: string[];
  chapters: EveryBookChapter[];
  permissions?: {
    audio?: boolean;
    video?: boolean;
    network?: boolean;
    storage?: boolean;
  };
};

export type EveryBookPosition = {
  chapterId: string;
  pageId: string;
  timelineId?: string;
};

export type EveryBookRendererOptions = {
  container: HTMLElement | string;
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
  variables?: Record<string, unknown>;
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
};