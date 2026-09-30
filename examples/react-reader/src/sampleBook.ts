import JSZip from "jszip";

const SAMPLE_ROOT = "/sample-books/last-lantern";

const SAMPLE_FILES = [
  "manifest.json",
  "story/story.json",
  "pages/awakening.html",
  "pages/crossroads.html",
  "pages/forest.html",
  "pages/bridge.html",
  "pages/tower.html",
  "pages/brave-ending.html",
  "pages/kind-ending.html",
  "styles/book.css",
];

export async function createSampleEveryBookFile(): Promise<File> {
  const zip = new JSZip();

  await Promise.all(
    SAMPLE_FILES.map(async (path) => {
      const response = await fetch(`${SAMPLE_ROOT}/${path}`);

      if (!response.ok) {
        throw new Error(`Failed to load sample book asset: ${path}`);
      }

      zip.file(path, await response.text());
    })
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new File([blob], "the-last-lantern.ebk", {
    type: "application/zip",
  });
}
