import JSZip from "jszip";
import type {
  EveryBookChapter,
  EveryBookEntry,
  EveryBookManifest,
  EveryBookPage,
  EveryBookStory,
  LoadedPage,
} from "../types";
import { sanitizeEbkPath } from "../security/pathSecurity";

export class EbkPackage {
  private zip: JSZip | null = null;
  private manifest: EveryBookManifest | null = null;
  private story: EveryBookStory | null = null;

  async load(file: File | Blob | ArrayBuffer): Promise<void> {
    const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

    this.zip = await JSZip.loadAsync(data);

    await this.loadManifest();
    await this.validateDeclaredPaths();
    await this.loadStoryIfAvailable();
  }

  getManifest(): EveryBookManifest {
    if (!this.manifest) {
      throw new Error("EBK package is not loaded.");
    }

    return this.manifest;
  }

  getChapters(): EveryBookChapter[] {
    return this.getManifest().chapters;
  }

  getStory(): EveryBookStory | null {
    return this.story;
  }

  getChapter(chapterId: string): EveryBookChapter {
    const chapter = this.getManifest().chapters.find(
      (item) => item.id === chapterId
    );

    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    return chapter;
  }

  findPage(entry: EveryBookEntry): EveryBookPage {
    const chapter = this.getChapter(entry.chapterId);

    const page = chapter.pages.find((item) => item.id === entry.pageId);

    if (!page) {
      throw new Error(
        `Page not found: ${entry.pageId} in chapter ${entry.chapterId}`
      );
    }

    return page;
  }

  hasPage(entry: EveryBookEntry): boolean {
    try {
      this.findPage(entry);
      return true;
    } catch {
      return false;
    }
  }

  getPageTitle(entry: EveryBookEntry): string {
    const page = this.findPage(entry);

    return page.title ?? page.id;
  }

  findEntryForPage(page: EveryBookPage): EveryBookEntry | null {
    const manifest = this.getManifest();

    for (const chapter of manifest.chapters) {
      const foundPage = chapter.pages.find((item) => item.id === page.id);

      if (foundPage) {
        return {
          chapterId: chapter.id,
          pageId: foundPage.id,
        };
      }
    }

    return null;
  }

  async loadText(path: string): Promise<string> {
    if (!this.zip) {
      throw new Error("EBK package is not loaded.");
    }

    const safePath = sanitizeEbkPath(path);
    const file = this.zip.file(safePath);

    if (!file) {
      throw new Error(`File not found inside EBK package: ${safePath}`);
    }

    return file.async("string");
  }

  async loadEntryPage(): Promise<LoadedPage> {
    const manifest = this.getManifest();

    return this.loadPage(manifest.entry);
  }

  async loadPage(entry: EveryBookEntry): Promise<LoadedPage> {
    const page = this.findPage(entry);

    const safePath = sanitizeEbkPath(page.src);
    const html = await this.loadText(safePath);

    return {
      chapterId: entry.chapterId,
      pageId: entry.pageId,
      path: safePath,
      html,
      timelineId: page.timeline,
    };
  }

  async loadStyles(): Promise<string> {
    const manifest = this.getManifest();

    if (!manifest.styles?.length) {
      return "";
    }

    const styles = await Promise.all(
      manifest.styles.map(async (stylePath) => {
        const safePath = sanitizeEbkPath(stylePath);
        return this.loadText(safePath);
      })
    );

    return styles.join("\n");
  }

  private async loadManifest(): Promise<void> {
    if (!this.zip) {
      throw new Error("EBK package is not loaded.");
    }

    const manifestFile = this.zip.file("manifest.json");

    if (!manifestFile) {
      throw new Error("Invalid EBK file: manifest.json not found.");
    }

    const manifestText = await manifestFile.async("string");

    try {
      this.manifest = JSON.parse(manifestText) as EveryBookManifest;
    } catch {
      throw new Error("Invalid EBK file: manifest.json is not valid JSON.");
    }
  }

  private async loadStoryIfAvailable(): Promise<void> {
    const manifest = this.getManifest();

    if (!manifest.story) {
      this.story = null;
      return;
    }

    const storyPath = sanitizeEbkPath(manifest.story);
    const storyText = await this.loadText(storyPath);

    try {
      this.story = JSON.parse(storyText) as EveryBookStory;
    } catch {
      throw new Error(`Invalid EBK story file: ${storyPath} is not valid JSON.`);
    }
  }

  private async validateDeclaredPaths(): Promise<void> {
    const manifest = this.getManifest();

    if (manifest.cover) {
      sanitizeEbkPath(manifest.cover);
    }

    if (manifest.story) {
      sanitizeEbkPath(manifest.story);
    }

    manifest.styles?.forEach((stylePath) => {
      sanitizeEbkPath(stylePath);
    });

    for (const chapter of manifest.chapters) {
      for (const page of chapter.pages) {
        sanitizeEbkPath(page.src);
      }
    }
  }
}