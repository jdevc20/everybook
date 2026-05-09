import { useRef, useState } from "react";
import { EveryBookRenderer } from "@everybook/core";
import type { EveryBookChapter, EveryBookPosition } from "@everybook/core";
import "./App.css";

function App() {
  const readerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EveryBookRenderer | null>(null);

  const [bookTitle, setBookTitle] = useState<string>("No book loaded");
  const [fileName, setFileName] = useState<string>("");
  const [position, setPosition] = useState<EveryBookPosition | null>(null);
  const [toc, setToc] = useState<EveryBookChapter[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  async function handleOpenBook(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !readerRef.current) {
      return;
    }

    const renderer = new EveryBookRenderer({
      container: readerRef.current,
      storageKey: `everybook:${file.name}`,
    });

    rendererRef.current = renderer;

    await renderer.open(file);

    setBookTitle(file.name.replace(".ebk", ""));
    setFileName(file.name);
    setToc(renderer.getTableOfContents());
    setPosition(renderer.getCurrentPosition());
    setIsLoaded(true);
  }

  function syncReaderState() {
    const renderer = rendererRef.current;

    if (!renderer) return;

    setPosition(renderer.getCurrentPosition());
    setToc(renderer.getTableOfContents());
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
    await rendererRef.current?.goToPage(chapterId, pageId);
    syncReaderState();
  }

  function handleClearProgress() {
    rendererRef.current?.clearProgress();
    alert("Progress cleared. Reopen the book to start fresh.");
  }

  function handleShowPosition() {
    const current = rendererRef.current?.getCurrentPosition();

    if (!current) {
      alert("No page loaded.");
      return;
    }

    alert(
      `Current Position:\nChapter: ${current.chapterId}\nPage: ${current.pageId}\nTimeline: ${
        current.timelineId ?? "none"
      }`
    );
  }

  function getCurrentChapterTitle() {
    if (!position) return "No chapter";

    const chapter = toc.find((item) => item.id === position.chapterId);

    return chapter?.title ?? position.chapterId;
  }

  function getCurrentPageTitle() {
    if (!position) return "No page";

    const chapter = toc.find((item) => item.id === position.chapterId);
    const page = chapter?.pages.find((item) => item.id === position.pageId);

    return page?.title ?? position.pageId;
  }

  return (
    <main className="reader-app">
      <aside className="library-panel">
        <div className="brand">
          <div className="brand-mark">EB</div>
          <div>
            <h1>EveryBook</h1>
            <p>Interactive Reader</p>
          </div>
        </div>

        <label className="upload-card">
          <span className="upload-title">Open .ebk file</span>
          <span className="upload-subtitle">
            Load an EveryBook package from your computer.
          </span>
          <input type="file" accept=".ebk" onChange={handleOpenBook} />
        </label>

        <section className="book-info-card">
          <p className="eyebrow">Current Book</p>
          <h2>{bookTitle}</h2>
          <p>{fileName || "Select an .ebk file to begin reading."}</p>
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

                      return (
                        <button
                          key={page.id}
                          className={isActive ? "toc-page active" : "toc-page"}
                          onClick={() => handleGoToPage(chapter.id, page.id)}
                        >
                          {page.title ?? page.id}
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
            <button onClick={handlePreviousPage} disabled={!isLoaded}>
              Previous
            </button>
            <button onClick={handleNextPage} disabled={!isLoaded}>
              Next
            </button>
          </div>
        </div>

        <div className="book-frame">
          <div className="book-spine" />

          <article className="book-page">
            {!isLoaded && (
              <div className="empty-book">
                <div className="empty-icon">📖</div>
                <h2>Open an EveryBook file</h2>
                <p>
                  Your interactive story will appear here in a portrait book
                  layout.
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
            <span>Timeline</span>
            <strong>{position?.timelineId ?? "main"}</strong>
          </div>

          <button onClick={handleShowPosition} disabled={!isLoaded}>
            Show State
          </button>

          <button onClick={handleClearProgress} disabled={!isLoaded}>
            Clear Progress
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;