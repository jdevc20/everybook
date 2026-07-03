# EveryBook Core

`@everybook/core` is the rendering engine for the EveryBook project.

It opens `.ebk` files, reads their manifest, loads chapters and pages, applies styles, sanitizes HTML, manages interactive story state, and renders books into a Shadow DOM container.

EveryBook Core is the foundation for future EveryBook apps:

```text
EveryBook Core
├─ Web Reader (examples/react-reader — working demo)
├─ Android Reader
├─ Desktop Reader
├─ EveryBook Writer
└─ CLI Tools
```

---

## What is an `.ebk` File?

An `.ebk` file is a ZIP archive renamed to `.ebk`.

It contains:

- `manifest.json` — book metadata, chapter/page structure, entry point, navigation rules, permissions
- `story/story.json` (optional) — interactive story definition: choices, variables, timelines, endings
- HTML page files
- CSS stylesheets
- Images, audio, video

The ZIP root must contain `manifest.json` directly:

```text
hello-world.ebk/manifest.json   ✓ correct
hello-world.ebk/hello-world/manifest.json   ✗ wrong
```

---

## Monorepo Structure

```text
everybook/
├─ package.json
├─ pnpm-workspace.yaml
├─ packages/
│  └─ core/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts
│        ├─ types.ts
│        ├─ EveryBookRenderer.ts
│        ├─ manifest/
│        │  └─ ManifestValidator.ts
│        ├─ package/
│        │  └─ EbkPackage.ts
│        ├─ rendering/
│        │  └─ RenderSurface.ts
│        ├─ runtime/
│        │  └─ actions.ts
│        ├─ security/
│        │  ├─ sanitizeHtml.ts
│        │  └─ pathSecurity.ts
│        └─ story/
│           ├─ StoryEngine.ts
│           ├─ StoryState.ts
│           ├─ ConditionEngine.ts
│           └─ PageAccessEngine.ts
└─ examples/
   └─ react-reader/   ← working React + Vite demo
```

---

## Installation in Workspace

```bash
pnpm add @everybook/core@workspace:*
```

---

## Build Commands

```bash
# From root
pnpm --filter @everybook/core build
pnpm build:core

# From packages/core
pnpm build
```

Successful build output:

```text
packages/core/dist/
├─ index.js
├─ index.cjs
├─ index.d.ts
└─ index.d.cts
```

---

## Basic Usage

```ts
import { EveryBookRenderer } from "@everybook/core";

const renderer = new EveryBookRenderer({
  container: "#reader",
  storageKey: "everybook:my-book"   // optional: enables localStorage save/load
});

const fileInput = document.querySelector<HTMLInputElement>("#fileInput");

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await renderer.open(file);
});
```

---

## React Usage Example

```tsx
import { useRef, useState } from "react";
import { EveryBookRenderer } from "@everybook/core";
import type { EveryBookChapter, EveryBookPosition } from "@everybook/core";

export default function EveryBookReader() {
  const readerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EveryBookRenderer | null>(null);
  const [position, setPosition] = useState<EveryBookPosition | null>(null);
  const [toc, setToc] = useState<EveryBookChapter[]>([]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !readerRef.current) return;

    const renderer = new EveryBookRenderer({
      container: readerRef.current,
      storageKey: `everybook:${file.name}`,
    });

    rendererRef.current = renderer;
    await renderer.open(file);
    setToc(renderer.getTableOfContents());
    setPosition(renderer.getCurrentPosition());
  }

  async function handleNext() {
    await rendererRef.current?.nextPage();
    setPosition(rendererRef.current?.getCurrentPosition() ?? null);
  }

  async function handlePrevious() {
    await rendererRef.current?.previousPage();
    setPosition(rendererRef.current?.getCurrentPosition() ?? null);
  }

  return (
    <main>
      <input type="file" accept=".ebk" onChange={handleFileChange} />
      <button onClick={handlePrevious}>Previous</button>
      <button onClick={handleNext}>Next</button>
      <div ref={readerRef} id="reader" />
    </main>
  );
}
```

The working full-featured demo lives in `examples/react-reader/`.

---

## Manifest Format

`manifest.json`:

```json
{
  "id": "hello-world",
  "format": "everybook",
  "version": "0.1.0",
  "title": "Hello EveryBook",
  "author": "Your Name",
  "entry": {
    "chapterId": "chapter-1",
    "pageId": "start"
  },
  "story": "story/story.json",
  "styles": ["styles/book.css"],
  "chapters": [
    {
      "id": "chapter-1",
      "title": "The First Door",
      "pages": [
        { "id": "start", "title": "Start", "src": "pages/start.html" },
        { "id": "forest", "title": "The Forest", "src": "pages/forest.html" }
      ]
    }
  ],
  "navigation": {
    "jumpMode": "guarded",
    "allowBacktracking": true
  },
  "permissions": {
    "audio": false,
    "video": false,
    "network": false,
    "storage": true
  }
}
```

### Manifest Fields

| Field | Required | Description |
|---|:---:|---|
| `id` | Yes | Unique book identifier |
| `format` | Yes | Must be `"everybook"` |
| `version` | Yes | EveryBook format version |
| `title` | Yes | Book title |
| `entry` | Yes | Starting `{ chapterId, pageId }` |
| `chapters` | Yes | Array of chapters, each with `id`, `title`, and `pages` |
| `author` | No | Book author name |
| `language` | No | Language code (e.g. `"en"`) |
| `description` | No | Short book description |
| `cover` | No | Path to cover image inside the package |
| `story` | No | Path to `story.json` inside the package |
| `styles` | No | CSS files to load |
| `navigation` | No | Navigation rules (`jumpMode`, `allowBacktracking`, `defaultEntry`) |
| `permissions` | No | Permission flags (`audio`, `video`, `network`, `storage`) |

### Navigation Modes (`jumpMode`)

| Mode | Behavior |
|---|---|
| `free` | Reader can jump anywhere. If page requirements fail, default story variables are applied. |
| `guarded` | Reader can jump to most pages, but pages with `access.requirements` are protected. |
| `storyStrict` | Reader can only open pages they have already visited or that were explicitly unlocked. |

---

## Story Format

When `manifest.story` points to a JSON file inside the package, the story engine is activated.

`story/story.json`:

```json
{
  "version": "0.1.0",
  "start": { "chapterId": "chapter-1", "pageId": "start" },
  "mainTimeline": "main",
  "timelines": [
    { "id": "main", "title": "Main Story" },
    { "id": "dark-route", "title": "The Dark Path" }
  ],
  "variables": {
    "coins": 0,
    "hasKey": false
  },
  "choices": [
    {
      "id": "enter-forest",
      "label": "Enter the forest",
      "goTo": { "chapterId": "chapter-1", "pageId": "forest" },
      "effects": [
        { "type": "setVariable", "key": "hasKey", "value": true },
        { "type": "incrementVariable", "key": "coins", "value": 5 }
      ]
    }
  ],
  "endings": [
    {
      "id": "good-ending",
      "title": "The Good Ending",
      "condition": "hasKey",
      "page": { "chapterId": "chapter-2", "pageId": "victory" }
    }
  ]
}
```

### Choice Effects

| Effect type | Description |
|---|---|
| `setVariable` | Sets a story variable to a value |
| `incrementVariable` | Adds a number to a numeric variable |
| `setTimeline` | Switches the active story timeline |
| `rememberChoice` | Records an additional choice ID alongside the current one |

---

## Page Access Rules

Pages can define `access` rules in the manifest to control when they can be opened:

```json
{
  "id": "secret-room",
  "src": "pages/secret-room.html",
  "access": {
    "requirements": [
      { "type": "choiceMade", "choiceId": "find-key" },
      { "type": "variableEquals", "key": "hasKey", "value": true }
    ],
    "fallback": { "chapterId": "chapter-1", "pageId": "locked-door" },
    "lockedMessage": "You need the key to enter this room."
  }
}
```

### Requirement Types

| Type | Description |
|---|---|
| `choiceMade` | Reader must have made a specific choice |
| `variableExists` | A story variable must be present |
| `variableEquals` | A story variable must equal a specific value |
| `visitedPage` | A specific chapter/page must already have been visited |

---

## Example Page HTML

`pages/start.html`:

```html
<section class="page">
  <h1>The First Door</h1>
  <p>You wake up in front of two paths.</p>

  <button data-ebk-action="choice" data-choice-id="enter-forest">
    Enter the forest
  </button>

  <button data-ebk-action="nextPage">
    Continue reading
  </button>

  <p data-ebk-if="hasKey">You have the key.</p>
</section>
```

---

## EveryBook Actions

Actions are triggered by `data-ebk-action` on any HTML element.
No raw JavaScript is needed or allowed inside page HTML.

| Action | Required attributes | Description |
|---|---|---|
| `nextPage` | — | Go to the next page in sequence |
| `previousPage` or `back` | — | Go to the previous page |
| `goToPage` | `data-chapter-id`, `data-page-id` | Jump to a specific chapter/page |
| `choice` | `data-choice-id` | Apply a story choice and navigate to its target |
| `setVariable` | `data-key`, `data-value` | Set a story variable directly |

Examples:

```html
<button data-ebk-action="nextPage">Next</button>

<button data-ebk-action="previousPage">Back</button>

<button data-ebk-action="goToPage" data-chapter-id="chapter-2" data-page-id="bridge">
  Cross the bridge
</button>

<button data-ebk-action="choice" data-choice-id="take-sword">
  Take the sword
</button>

<button data-ebk-action="setVariable" data-key="doorOpen" data-value="true">
  Open the door
</button>
```

---

## Conditional Content

Elements with `data-ebk-if` are shown or hidden based on story variables.
The expression is evaluated by `ConditionEngine` against the current story state.

```html
<p data-ebk-if="hasKey">You have the key.</p>
<p data-ebk-if="!hasKey">The door is locked.</p>
<p data-ebk-if="coins >= 10">You can afford the item.</p>
<p data-ebk-if="ending == 'good'">You chose wisely.</p>
```

### Condition Syntax

| Format | Example | Description |
|---|---|---|
| Variable truthy | `hasKey` | True when variable is truthy |
| Variable falsy | `!hasKey` | True when variable is falsy |
| Equality | `ending == 'good'` | Strict equality |
| Inequality | `status != 'dead'` | Strict inequality |
| Numeric comparison | `coins >= 10` | Greater than or equal |
| Numeric comparison | `health < 50` | Less than |

---

## HTML Sanitization

All page HTML is sanitized with DOMPurify before rendering.

Allowed tags:

```text
h1 h2 h3 h4 h5 h6
p span strong em
section article div
img audio video
button
ul ol li
br blockquote hr
```

Allowed attributes:

```text
src alt controls class id title
data-ebk-action data-target data-chapter-id data-page-id
data-choice-id data-key data-value data-ebk-if
```

Blocked:

```text
script iframe object embed form
input textarea select link meta base
onclick onload onerror onmouseover onfocus onblur style
```

---

## Shadow DOM Rendering

The renderer mounts all book content inside a Shadow DOM attached to the container element.

This means:

- Book styles are scoped and cannot leak into the host page
- Host page styles cannot accidentally affect the book
- The renderer is self-contained and safe to embed anywhere

---

## Path Security

All file paths referenced inside `.ebk` files are validated before use.

Blocked paths:

- Absolute paths starting with `/`
- Path traversal using `../`
- URLs with blocked protocols: `http:`, `https:`, `javascript:`, `data:`, `blob:`, `file:`, `ftp:`, `mailto:`

---

## Progress Save and Load

When `storageKey` is set, the renderer automatically saves story state to `localStorage` after each page navigation or choice.

```ts
const renderer = new EveryBookRenderer({
  container: "#reader",
  storageKey: "everybook"
});
```

The storage key is namespaced internally as `storageKey:bookId:state`.

Progress can be cleared with:

```ts
renderer.clearProgress();
```

---

## Renderer API

```ts
// Open an .ebk file (File, Blob, or ArrayBuffer)
await renderer.open(file);

// Navigate pages
await renderer.nextPage();
await renderer.previousPage();
await renderer.goToPage(chapterId, pageId);

// Apply a story choice
await renderer.applyChoice(choiceId);

// Read state
renderer.getCurrentPosition();     // EveryBookPosition | null
renderer.getTableOfContents();     // EveryBookChapter[]
renderer.getStoryState();          // EveryBookStoryState | null
renderer.getVariable<T>(key);      // T | undefined

// Set a variable (also saves progress and re-evaluates conditional content)
renderer.setVariable(key, value);

// Save / clear progress
renderer.saveProgress();
renderer.clearProgress();

// Clear the renderer
renderer.clear();
```

---

## Source Files

| File | Responsibility |
|---|---|
| `index.ts` | Public API exports |
| `types.ts` | All shared TypeScript types |
| `EveryBookRenderer.ts` | Main orchestration class |
| `manifest/ManifestValidator.ts` | Validates manifest structure and required fields |
| `package/EbkPackage.ts` | Reads the ZIP, loads manifest, pages, styles, story |
| `rendering/RenderSurface.ts` | Manages Shadow DOM, content, footer, and book styles |
| `runtime/actions.ts` | Binds `data-ebk-action` elements to renderer handlers |
| `security/sanitizeHtml.ts` | DOMPurify-based HTML sanitizer |
| `security/pathSecurity.ts` | Validates and sanitizes file paths |
| `story/StoryEngine.ts` | Controls choices, variables, timelines, save/load |
| `story/StoryState.ts` | Stores and manages the reader's mutable story progress |
| `story/ConditionEngine.ts` | Evaluates condition expressions against story variables |
| `story/PageAccessEngine.ts` | Enforces page access rules across all navigation modes |

---

## Root Workspace Setup

`package.json`:

```json
{
  "name": "everybook",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "build:core": "pnpm --filter @everybook/core build",
    "dev:core": "pnpm --filter @everybook/core dev"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsup": "^8.0.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

---

## Core Package Setup

`packages/core/package.json`:

```json
{
  "name": "@everybook/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup ./src/index.ts --format esm,cjs --dts --tsconfig tsconfig.json",
    "dev": "tsup ./src/index.ts --format esm,cjs --dts --watch --tsconfig tsconfig.json"
  },
  "dependencies": {
    "dompurify": "^3.0.0",
    "jszip": "^3.10.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Common Errors

### Import is red in the editor

1. Make sure the consuming package has `"@everybook/core": "workspace:*"` in its dependencies.
2. Make sure `pnpm-workspace.yaml` includes both `packages/*` and `examples/*`.
3. Run `pnpm install` and `pnpm --filter @everybook/core build` from the root.
4. Restart the TypeScript server in VS Code.

### No projects matched the filters

The package name in the filter must exactly match the `"name"` field in `package.json`.

```bash
pnpm --filter react-reader dev   # correct if name is "react-reader"
```

### DTS build error

Ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true
  }
}
```

---

## Roadmap

### Version 0.1.0 — Core Renderer ✓

- Open `.ebk` ZIP files
- Read and validate `manifest.json`
- Chapter and page structure
- Entry page rendering
- CSS loading and scoped Shadow DOM injection
- HTML sanitization with DOMPurify
- Path security validation
- Controlled `data-ebk-action` system
- `nextPage`, `previousPage`, `goToPage`, `choice`, `setVariable` actions
- Story engine: choices, variables, timelines, endings
- `free`, `guarded`, and `storyStrict` navigation modes
- Page access requirements: `choiceMade`, `variableExists`, `variableEquals`, `visitedPage`
- Conditional content with `data-ebk-if`
- `ConditionEngine` for expression evaluation
- localStorage save/load/clear
- Story notes footer (choices, variables, visited pages)
- React reader demo

### Version 0.2.0

- Image, audio, video asset support within the package
- Better error messages
- Chapter history and backtracking improvements

### Version 0.3.0

- Simple dialogs
- More condition operators

### Version 0.4.0

- CLI tools: `everybook validate`, `everybook build`, `everybook create`

### Version 0.5.0

- Android reader proof of concept
- WebView-based reader
- Local `.ebk` opening on device

---

## Design Principle

EveryBook is a programmable book format, not a website inside a ZIP.

The renderer controls the book experience. The `.ebk` file is portable. The core is reusable across platforms.
