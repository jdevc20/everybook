import { useRef, useState } from "react";
import { EveryBookRenderer } from "@everybook/core";
import "./App.css";

function App() {
  const readerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EveryBookRenderer | null>(null);
  const [bookTitle, setBookTitle] = useState<string>("No book loaded");

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

    setBookTitle(file.name);
  }

  async function handleNextPage() {
    await rendererRef.current?.nextPage();
  }

  async function handlePreviousPage() {
    await rendererRef.current?.previousPage();
  }

  function handleClearProgress() {
    rendererRef.current?.clearProgress();
    alert("Progress cleared.");
  }

  return (
    <main className="app">
      <header className="toolbar">
        <div>
          <h1>EveryBook React Reader</h1>
          <p>{bookTitle}</p>
        </div>

        <input type="file" accept=".ebk" onChange={handleOpenBook} />
      </header>

      <section className="controls">
        <button onClick={handlePreviousPage}>Previous</button>
        <button onClick={handleNextPage}>Next</button>
        <button onClick={handleClearProgress}>Clear Progress</button>
      </section>

      <section className="reader-shell">
        <div ref={readerRef} id="reader" />
      </section>
    </main>
  );
}

export default App;