import { useRef, useState } from "react";
import { EveryBookRenderer } from "@everybook/core";
import type {
  EveryBookChapter,
  EveryBookPage,
  EveryBookPosition,
  EveryBookStoryState,
} from "@everybook/core";
import { createSampleEveryBookFile } from "./sampleBook";
import "./App.css";

function App() {
  const readerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EveryBookRenderer | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  const [bookTitle, setBookTitle] = useState("No book loaded");
  const [fileName, setFileName] = useState("");
  const [position, setPosition] = useState<EveryBookPosition | null>(null);
  const [storyState, setStoryState] = useState<EveryBookStoryState | null>(null);
  const [toc, setToc] = useState<EveryBookChapter[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpeningSample, setIsOpeningSample] = useState(false);
  const [error, setError] = useState("");

  function syncReaderState() {
    const renderer = rendererRef.current;

    if (!renderer) return;

    setPosition(renderer.getCurrentPosition());
    setStoryState(renderer.getStoryState());
    setToc(renderer.getTableOfContents());

    const manifest = renderer.getEngine().getManifest();
    if (manifest) {
      setBookTitle(manifest.title);
    }
  }

  function observeRenderer(renderer: EveryBookRenderer) {
    observerRef.current?.disconnect();

    const shadowRoot = readerRef.current?.shadowRoot;
    if (!shadowRoot) return;

    const observer = new MutationObserver(() => {
      syncReaderState();
    });

    observer.observe(shadowRoot, {
      childList: true,
      subtree: true,
    });

    observerRef.current = observer;
    rendererRef.current = renderer;
  }

  async function loadBook(file: File) {
    if (!readerRef.current) return;

    setError("");

    try {
      const renderer = new EveryBookRenderer({
        container: readerRef.current,
        storageKey: `everybook:${file.name}`,
      });

      rendererRef.current = renderer;
      await renderer.open(file);

      setFileName(file.name);
      setIsLoaded(true);
      syncReaderState();
      observeRenderer(renderer);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to open this EveryBook.";
      setError(message);
      setIsLoaded(false);
    }
  }

  async function handleOpenBook(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      await loadBook(file);
    }
  }

  async function handleOpenSample() {
    setIsOpeningSample(true);

    try {
      await loadBook(await createSampleEveryBookFile());
    } finally {
      setIsOpeningSample(false);
    }
  }

  async function handleNextPage() {
    await rendererRef.current?.nextPage();
    syncReaderState();
  }

  async function handlePreviousPage() {
    await rendererRef.current?.previousPage();
    syncReaderState();
  }

  async function handleGoToPage(chapterId: string, pageId: string) {
    if (!isPageAccessible(chapterId, pageId)) return;

    await rendererRef.current?.goToPage(chapterId, pageId);
    syncReaderState();
  }

  function handleClearProgress() {
    rendererRef.current?.clearProgress();
    alert("Saved progress cleared. Reopen the book to begin a new run.");
  }

  function handleShowState() {
    if (!storyState) {
      alert("This book has no active story state.");
      return;
    }

    alert(JSON.stringify(storyState, null, 2));
  }

  function getCurrentPage(): EveryBookPage | null {
    if (!position) return null;

    const chapter = toc.find((item) => item.id === position.chapterId);
    return chapter?.pages.find((item) => item.id === position.pageId) ?? null;
  }

  function getCurrentChapterTitle() {
    if (!position) return "No chapter";
    return toc.find((item) => item.id === position.chapterId)?.title ?? position.chapterId;
  }

  function getCurrentPageTitle() {
    const page = getCurrentPage();
    return page?.title ?? position?.pageId ?? "No page";
  }

  function isStoryStrict() {
    return (
      rendererRef.current?.getEngine().getManifest()?.navigation?.jumpMode ===
      "storyStrict"
    );
  }

  function pageKey(chapterId: string, pageId: string) {
    return `${chapterId}:${pageId}`;
  }

  function isPageAccessible(chapterId: string, pageId: string) {
    if (!isStoryStrict() || !storyState) return true;

    const key = pageKey(chapterId, pageId);

    return (
      storyState.visitedPages.includes(key) ||
      storyState.unlockedPages?.includes(key) === true ||
      (position?.chapterId === chapterId && position?.pageId === pageId)
    );
  }

  function getSequentialTarget(direction: "next" | "previous") {
    if (!position) return null;

    const chapterIndex = toc.findIndex((chapter) => chapter.id === position.chapterId);
    if (chapterIndex < 0) return null;

    const chapter = toc[chapterIndex];
    const pageIndex = chapter.pages.findIndex((page) => page.id === position.pageId);
    if (pageIndex < 0) return null;

    if (direction === "next") {
      const nextPage = chapter.pages[pageIndex + 1];
      if (nextPage) return { chapterId: chapter.id, pageId: nextPage.id };

      const nextChapter = toc[chapterIndex + 1];
      if (nextChapter?.pages[0]) {
        return { chapterId: nextChapter.id, pageId: nextChapter.pages[0].id };
      }

      return null;
    }

    const previousPage = chapter.pages[pageIndex - 1];
    if (previousPage) return { chapterId: chapter.id, pageId: previousPage.id };

    const previousChapter = toc[chapterIndex - 1];
    const lastPage = previousChapter?.pages.at(-1);

    return lastPage
      ? { chapterId: previousChapter.id, pageId: lastPage.id }
      : null;
  }

  const currentPage = getCurrentPage();
  const pageMode = currentPage?.mode ?? "linear";
  const nextTarget = getSequentialTarget("next");
  const previousTarget = getSequentialTarget("previous");

  const showNext =
    isLoaded &&
    pageMode !== "choice" &&
    Boolean(nextTarget) &&
    Boolean(nextTarget && isPageAccessible(nextTarget.chapterId, nextTarget.pageId));

  const showPrevious =
    isLoaded &&
    Boolean(previousTarget) &&
    Boolean(
      previousTarget &&
        isPageAccessible(previousTarget.chapterId, previousTarget.pageId)
    );

  return (
    <main className="reader-app">
      <aside className="library-panel">
        <div className="brand">
          <div className="brand-mark">EB</div>
          <div>
            <h1>EveryBook</h1>
            <p>Simple Interactive Reader</p>
          </div>
        </div>

        <button
          className="sample-button"
          onClick={handleOpenSample}
          disabled={isOpeningSample}
        >
          {isOpeningSample ? "Opening sample…" : "Read “The Last Lantern”"}
        </button>

        <label className="upload-card">
          <span className="upload-title">Or open an .ebk file</span>
          <span className="upload-subtitle">
            Load a local EveryBook package from your computer.
          </span>
          <input type="file" accept=".ebk" onChange={handleOpenBook} />
        </label>

        {error && <p className="error-card">{error}</p>}

        <section className="book-info-card">
          <p className="eyebrow">Current Book</p>
          <h2>{bookTitle}</h2>
          <p>{fileName || "Choose the sample or open your own book."}</p>

          {isLoaded && (
            <div className="book-badges">
              <span>{isStoryStrict() ? "storyStrict" : "open navigation"}</span>
              <span>{pageMode} page</span>
            </div>
          )}
        </section>

        <section className="toc-card">
          <div className="section-heading">
            <p className="eyebrow">Contents</p>
            <span>{toc.length} chapters</span>
          </div>

          {toc.length === 0 ? (
            <p className="empty-text">No table of contents loaded.</p>
          ) : (
            <div className="toc-list">
              {toc.map((chapter) => (
                <details key={chapter.id} open={chapter.id === position?.chapterId}>
                  <summary>{chapter.title}</summary>

                  <div className="toc-pages">
                    {chapter.pages.map((page) => {
                      const isActive =
                        position?.chapterId === chapter.id &&
                        position?.pageId === page.id;
                      const accessible = isPageAccessible(chapter.id, page.id);

                      return (
                        <button
                          key={page.id}
                          className={[
                            "toc-page",
                            isActive ? "active" : "",
                            !accessible ? "locked" : "",
                          ].join(" ")}
                          disabled={!accessible}
                          onClick={() => handleGoToPage(chapter.id, page.id)}
                        >
                          <span>{page.title ?? page.id}</span>
                          <small>
                            {isActive
                              ? "Now reading"
                              : accessible
                                ? page.mode ?? "linear"
                                : "Locked"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </aside>

      <section className="reading-stage">
        <div className="top-reader-bar">
          <div>
            <p className="eyebrow">Now Reading</p>
            <h2>{getCurrentChapterTitle()}</h2>
            <p>{getCurrentPageTitle()}</p>
          </div>

          <div className="reader-actions">
            {showPrevious && (
              <button onClick={handlePreviousPage}>Previous</button>
            )}

            {showNext && <button onClick={handleNextPage}>Next</button>}

            {isLoaded && pageMode === "choice" && (
              <span className="choice-hint">Choose an option on the page</span>
            )}

            {isLoaded && pageMode === "mixed" && !showNext && (
              <span className="choice-hint">Continue using a story action</span>
            )}
          </div>
        </div>

        <div className="book-frame">
          <div className="book-spine" />

          <article className="book-page">
            {!isLoaded && (
              <div className="empty-book">
                <div className="empty-icon">📖</div>
                <h2>Start with the sample story</h2>
                <p>
                  It demonstrates storyStrict navigation, choices, variables,
                  conditions, locked pages, and multiple endings.
                </p>
              </div>
            )}

            <div ref={readerRef} id="reader" />
          </article>
        </div>

        <div className="bottom-reader-bar">
          <div className="position-pill">
            <span>Chapter</span>
            <strong>{position?.chapterId ?? "—"}</strong>
          </div>

          <div className="position-pill">
            <span>Page</span>
            <strong>{position?.pageId ?? "—"}</strong>
          </div>

          <div className="position-pill">
            <span>Mode</span>
            <strong>{pageMode}</strong>
          </div>

          <button onClick={handleShowState} disabled={!storyState}>
            Story State
          </button>

          <button onClick={handleClearProgress} disabled={!isLoaded}>
            Clear Saved Progress
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
