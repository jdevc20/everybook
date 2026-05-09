import JSZip from "jszip";
import type {
  EveryBookChapter,
  EveryBookManifest,
  EveryBookPage,
  EveryBookStory,
  LoadedPage,
} from "./types";

export class EbkPackage {
  private zip!: JSZip;
  private manifest!: EveryBookManifest;
  private story: EveryBookStory | null = null;

  async load(file: File | Blob | ArrayBuffer): Promise<void> {
    const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    this.zip = await JSZip.loadAsync(data);

    const manifestFile = this.zip.file("manifest.json");

    if (!manifestFile) {
      throw new Error("Invalid EBK file: manifest.json not found.");
    }

    const manifestText = await manifestFile.async("string");
    this.manifest = JSON.parse(manifestText);

    if (this.manifest.story) {
      const storyFile = this.zip.file(this.manifest.story);

      if (!storyFile) {
        throw new Error(`Story file not found: ${this.manifest.story}`);
      }

      const storyText = await storyFile.async("string");
      this.story = JSON.parse(storyText);
    }
  }

  getManifest(): EveryBookManifest {
    if (!this.manifest) {
      throw new Error("EBK package not loaded.");
    }

    return this.manifest;
  }

  getStory(): EveryBookStory | null {
    return this.story;
  }

  getChapters(): EveryBookChapter[] {
    return this.getManifest().chapters;
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

  getPage(chapterId: string, pageId: string): EveryBookPage {
    const chapter = this.getChapter(chapterId);

    const page = chapter.pages.find((item) => item.id === pageId);

    if (!page) {
      throw new Error(`Page not found: ${chapterId}/${pageId}`);
    }

    return page;
  }

  async loadText(path: string): Promise<string> {
    const file = this.zip.file(path);

    if (!file) {
      throw new Error(`File not found in EBK package: ${path}`);
    }

    return file.async("string");
  }

  async loadEntryPage(): Promise<LoadedPage> {
    const manifest = this.getManifest();
    const page = this.getPage(manifest.entry.chapterId, manifest.entry.pageId);
    const html = await this.loadText(page.src);

    return {
      chapterId: manifest.entry.chapterId,
      pageId: manifest.entry.pageId,
      timelineId: page.timeline,
      path: page.src,
      html,
    };
  }

  async loadPage(chapterId: string, pageId: string): Promise<LoadedPage> {
    const page = this.getPage(chapterId, pageId);
    const html = await this.loadText(page.src);

    return {
      chapterId,
      pageId,
      timelineId: page.timeline,
      path: page.src,
      html,
    };
  }

  async loadStyles(): Promise<string> {
    const manifest = this.getManifest();

    if (!manifest.styles?.length) {
      return "";
    }

    const styles = await Promise.all(
      manifest.styles.map((stylePath) => this.loadText(stylePath))
    );

    return styles.join("\n");
  }
}