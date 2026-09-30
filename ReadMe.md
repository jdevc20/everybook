# EveryBook

**EveryBook** is an experimental interactive-book engine for the browser.

The project defines a portable `.ebk` package format and a TypeScript runtime that can load books, render HTML content, manage story state, enforce navigation rules, and support branching choices, variables, conditions, and endings.

The repository currently contains:

- **`@everybook/core`** — the TypeScript engine
- **React Reader** — a Vite/React example application

EveryBook is currently a prototype. It does **not** yet include a backend, cloud sync, marketplace, desktop writer, mobile application, or production-grade media asset resolver.

## Documentation

- [EBK format and complete two-page example](docs/EBK_FORMAT.md)
- [Core API, lifecycle and known limitations](docs/CORE_API.md)
- [React reader](examples/react-reader/README.md)
- [Whole-project overview](../../README.md), including the separate Windows Writer
- [Developer setup and architecture](../../docs/DEVELOPMENT.md)
- [AI contributor context](../../docs/AI_CONTEXT.md)

The last three links refer to the enclosing Project-Everybook workspace and are only available when that workspace is present. Format/API documentation lives inside this reader Git repository.

## Core Architecture

```text
.ebk package
    │
    ▼
EbkPackage
    │
    ├─ manifest.json
    ├─ optional story JSON
    ├─ HTML pages
    └─ CSS
    │
    ▼
EveryBookEngine
    │
    ├─ ManifestValidator
    ├─ StoryValidator
    ├─ StoryEngine
    ├─ PageAccessEngine
    └─ ConditionEngine
    │
    ▼
EveryBookRenderer
    │
    ├─ HTML sanitization
    ├─ action binding
    └─ Shadow DOM rendering
    │
    ▼
Browser reader
```

The engine is responsible for both package loading and interactive story behavior.

---

## Features

### Book loading

EveryBook can:

- open `.ebk` files from a `File`, `Blob`, or `ArrayBuffer`
- load and parse `manifest.json`
- load optional story definitions
- load page HTML and CSS
- validate declared package paths
- render pages into an isolated Shadow DOM

### Interactive stories

The engine supports:

- chapters and pages
- story variables
- choices
- choice effects
- multiple timelines
- conditional content
- multiple endings
- visited pages
- unlocked pages
- page access rules
- optional local progress persistence

### Navigation modes

EveryBook currently supports:

| Mode | Behavior |
|---|---|
| `free` | Allows flexible navigation and may apply default story assumptions when earlier story state is missing. |
| `guarded` | Allows navigation but enforces explicit page requirements. |
| `storyStrict` | Only allows pages that have already been visited or explicitly unlocked. |

---

## Repository Structure

```text
everybook/
├─ .github/
│  └─ workflows/
│     └─ core-ci.yml
├─ packages/
│  └─ core/
│     ├─ package.json
│     ├─ tests/
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
│           ├─ StoryValidator.ts
│           ├─ ConditionEngine.ts
│           └─ PageAccessEngine.ts
└─ examples/
   └─ react-reader/
```

---

## What is an `.ebk` file?

An `.ebk` file is currently a ZIP-based EveryBook package.

At minimum:

```text
my-book.ebk
├─ manifest.json
└─ pages/
   └─ start.html
```

A story-enabled package can look like:

```text
my-book.ebk
├─ manifest.json
├─ story/
│  └─ story.json
├─ pages/
│  ├─ start.html
│  └─ forest.html
└─ styles/
   └─ book.css
```

The ZIP root must contain `manifest.json` directly.

Correct:

```text
manifest.json
pages/start.html
```

Incorrect:

```text
my-book/manifest.json
my-book/pages/start.html
```

---

## Included Sample Story

The React reader includes a small built-in story called **The Last Lantern**.

It is designed as a reference book for the current EveryBook engine and demonstrates:

- `storyStrict` navigation
- page modes: `choice`, `mixed`, and `linear`
- story choices and branching paths
- `setVariable`
- `setVariable` and `incrementVariable` choice effects
- conditional HTML with `data-ebk-if`
- condition-based choices
- visited and unlocked pages
- multiple endings
- local progress persistence

Run the reader and select **Read “The Last Lantern”** to package the sample source into an `.ebk` in the browser and open it through the normal `EveryBookRenderer.open()` flow.

Sample source:

```text
examples/react-reader/public/sample-books/last-lantern/
├─ manifest.json
├─ story/story.json
├─ pages/
└─ styles/book.css
```

The reader also adapts its controls to the current page mode. Choice pages prioritize in-story buttons, mixed pages allow story actions plus sequential navigation only when the target is accessible, and locked `storyStrict` pages are disabled in the table of contents.

---

## Setup

Requirements:

- Node.js
- pnpm

From the repository root:

```bash
pnpm install
pnpm --filter @everybook/core build
pnpm --filter react-reader dev
```

Build Core only:

```bash
pnpm build:core
```

Run Core regression tests:

```bash
pnpm --filter @everybook/core test
```

Core CI also runs automatically for relevant pull requests and pushes to `main`.

---

## Basic Usage

```ts
import { EveryBookRenderer } from "@everybook/core";

const renderer = new EveryBookRenderer({
  container: "#reader",
  storageKey: "everybook"
});

await renderer.open(file);
```

Navigation:

```ts
await renderer.nextPage();
await renderer.previousPage();

await renderer.goToPage(
  "chapter-1",
  "page-2"
);
```

Story access:

```ts
const position = renderer.getCurrentPosition();
const state = renderer.getStoryState();

const coins = renderer.getVariable<number>("coins");

renderer.setVariable("hasKey", true);
```

Progress:

```ts
renderer.saveProgress();
renderer.clearProgress();
```

---

## Manifest Format

Example `manifest.json`:

```json
{
  "id": "hello-world",
  "format": "everybook",
  "version": "0.1.0",
  "title": "Hello EveryBook",
  "author": "Example Author",
  "entry": {
    "chapterId": "chapter-1",
    "pageId": "start"
  },
  "story": "story/story.json",
  "styles": [
    "styles/book.css"
  ],
  "chapters": [
    {
      "id": "chapter-1",
      "title": "The First Door",
      "pages": [
        {
          "id": "start",
          "title": "Start",
          "src": "pages/start.html"
        },
        {
          "id": "forest",
          "title": "The Forest",
          "src": "pages/forest.html"
        }
      ]
    }
  ],
  "navigation": {
    "jumpMode": "guarded",
    "allowBacktracking": true
  },
  "permissions": {
    "network": false,
    "storage": true
  }
}
```

### Manifest validation

The engine validates:

- required manifest fields
- book ID
- unique chapter IDs
- unique page IDs within each chapter
- entry targets
- `navigation.defaultEntry`
- page fallback targets
- `visitedPage` requirement targets
- unsupported network permission
- declared package paths

Invalid references fail when the book is opened instead of failing later during navigation.

---

## Story Format

Example `story/story.json`:

```json
{
  "version": "0.1.0",
  "start": {
    "chapterId": "chapter-1",
    "pageId": "start"
  },
  "mainTimeline": "main",
  "timelines": [
    {
      "id": "main",
      "title": "Main Story"
    }
  ],
  "variables": {
    "coins": 0,
    "hasKey": false
  },
  "choices": [
    {
      "id": "enter-forest",
      "label": "Enter the forest",
      "from": {
        "chapterId": "chapter-1",
        "pageId": "start"
      },
      "effects": [
        {
          "type": "setVariable",
          "key": "hasKey",
          "value": true
        }
      ],
      "goTo": {
        "chapterId": "chapter-1",
        "pageId": "forest"
      }
    }
  ]
}
```

### Story validation

`StoryValidator` checks:

- story version
- story start target
- timeline IDs
- `mainTimeline`
- duplicate choice IDs
- choice source pages
- choice destinations
- timeline-changing effects
- ending IDs and pages
- `defaultPath` entries
- page timeline references

---

## Choices

A choice can:

- navigate to another page
- set a variable
- increment a numeric variable
- change timeline
- remember another choice

Example:

```json
{
  "id": "take-coins",
  "label": "Take the coins",
  "from": {
    "chapterId": "chapter-1",
    "pageId": "treasure-room"
  },
  "effects": [
    {
      "type": "incrementVariable",
      "key": "coins",
      "value": 10
    }
  ],
  "goTo": {
    "chapterId": "chapter-1",
    "pageId": "exit"
  }
}
```

### Choice replay behavior

Choices are **non-repeatable by default**.

Once a choice has been applied, its effects cannot be applied again unless the choice explicitly declares:

```json
{
  "repeatable": true
}
```

This prevents accidental repeated effects such as adding coins multiple times from the same one-time choice.

If `from` is defined, the choice can only be applied from that story position.

---

## Choice Effects

| Effect | Description |
|---|---|
| `setVariable` | Assigns a value to a story variable. |
| `incrementVariable` | Adds a number to a numeric variable. |
| `setTimeline` | Changes the active story timeline. |
| `rememberChoice` | Records another choice ID as part of story state. |

---

## Page Access Rules

Pages can define requirements in the manifest.

```json
{
  "id": "secret-room",
  "src": "pages/secret-room.html",
  "access": {
    "requirements": [
      {
        "type": "choiceMade",
        "choiceId": "find-key"
      },
      {
        "type": "variableEquals",
        "key": "hasKey",
        "value": true
      }
    ],
    "fallback": {
      "chapterId": "chapter-1",
      "pageId": "locked-door"
    },
    "lockedMessage": "You need the key to enter this room."
  }
}
```

Supported requirements:

| Type | Meaning |
|---|---|
| `choiceMade` | A specific choice must already exist in story state. |
| `variableExists` | A variable must exist. |
| `variableEquals` | A variable must strictly equal the configured value. |
| `visitedPage` | A specific page must already have been visited. |

---

## EveryBook Page Actions

EveryBook page HTML uses controlled `data-ebk-action` attributes rather than arbitrary JavaScript.

```html
<button data-ebk-action="nextPage">
  Continue
</button>

<button
  data-ebk-action="choice"
  data-choice-id="take-sword"
>
  Take the sword
</button>

<button
  data-ebk-action="goToPage"
  data-chapter-id="chapter-2"
  data-page-id="bridge"
>
  Cross the bridge
</button>
```

Supported actions:

| Action | Purpose |
|---|---|
| `nextPage` | Open the next page. |
| `previousPage` / `back` | Open the previous page. |
| `goToPage` | Navigate to a specific chapter/page. |
| `choice` | Apply a story choice. |
| `setVariable` | Change a story variable. |

---

## Conditions

Current condition syntax is intentionally small.

Supported examples:

```text
hasKey
!hasKey
coins >= 10
health < 50
ending == 'good'
status != 'dead'
```

Malformed or unsupported conditions fail safely.

Invalid numeric comparisons also fail safely instead of silently coercing invalid values to zero.

More expressive structured conditions are a future improvement.

---

## Conditional HTML

Book pages can conditionally display content using `data-ebk-if`.

```html
<p data-ebk-if="hasKey">
  You have the key.
</p>

<p data-ebk-if="coins >= 10">
  You can afford the item.
</p>
```

Conditional elements that fail their condition are currently removed from the rendered DOM.

Because of that, changing a variable later does not restore a previously removed element without rendering the page again.

---

## HTML Security

Page HTML is sanitized using DOMPurify.

Examples of allowed elements include:

```text
h1 h2 h3 h4 h5 h6
p span strong em
section article div
img audio video
button
ul ol li
br blockquote hr
```

Dangerous elements such as these are blocked:

```text
script
iframe
object
embed
form
input
textarea
select
link
meta
base
```

Inline event handlers and inline `style` attributes are also blocked.

The Shadow DOM provides style isolation, but it should **not** be treated as a complete security sandbox.

---

## Package Path Security

Paths inside an `.ebk` are validated before use.

The current validator rejects:

- absolute paths
- Windows drive paths
- parent traversal such as `../`
- encoded parent traversal such as `%2e%2e`
- URL schemes
- `http:`
- `https:`
- `javascript:`
- `data:`
- `blob:`
- `file:`
- `ftp:`
- `mailto:`
- malformed percent encoding
- null-byte paths

Windows-style backslashes are normalized before validation.

---

## Progress Storage

When a `storageKey` is configured, story state is stored in browser `localStorage`.

```ts
const renderer = new EveryBookRenderer({
  container: "#reader",
  storageKey: "everybook"
});
```

The internal key is namespaced by book ID:

```text
everybook:<bookId>:state
```

Stored story state currently includes:

- current page
- current timeline
- variables
- remembered choices
- visited pages
- unlocked pages
- default-storyline usage

Opening another book now resets the active story engine so state cannot leak from the previously opened book.

---

## Public API

Main exports include:

```ts
EveryBookRenderer
StoryEngine
StoryState
ConditionEngine

validateManifest
validateStory
assertSafeEbkPath
sanitizeEbkPath
```

Primary renderer methods:

```ts
await renderer.open(file);

await renderer.nextPage();
await renderer.previousPage();
await renderer.goToPage(chapterId, pageId);

await renderer.applyChoice(choiceId);

renderer.getCurrentPosition();
renderer.getTableOfContents();
renderer.getStoryState();

renderer.getVariable(key);
renderer.setVariable(key, value);

renderer.saveProgress();
renderer.clearProgress();

renderer.clear();
```

---

## Testing

The Core package contains regression coverage for the engine hardening work.

Tests cover areas including:

- unsafe package paths
- traversal attempts
- duplicate page IDs
- invalid manifest references
- invalid story destinations
- duplicate story references
- repeated choices
- `choice.from` enforcement
- malformed numeric conditions

Run:

```bash
pnpm --filter @everybook/core test
```

GitHub Actions runs the Core build and tests for relevant changes.

---

## Current Limitations

EveryBook is still under active development.

Important limitations include:

- package media files do not yet have a full object-URL asset resolver
- CSS resource URLs are not yet comprehensively rewritten or sandboxed
- conditions use a limited string expression syntax
- conditional DOM nodes are removed rather than reactively hidden/restored
- save data does not yet have an explicit migration/version schema
- the renderer is now a DOM presentation adapter over a headless `EveryBookEngine`, but event subscriptions and richer renderer adapters are still future work
- there is no backend or cloud synchronization
- there is no authoring application
- there is no EPUB/PDF importer
- there is no CLI
- there is no marketplace
- there is no native mobile reader

---

## Next Engine Priorities

### Engine events

Add subscriptions such as:

```ts
engine.on("pageChanged", handler);
engine.on("choiceMade", handler);
engine.on("variableChanged", handler);
```

This will make React and other clients easier to synchronize with engine state.

### Structured conditions

Move toward machine-readable conditions instead of increasingly complex expression strings.

Example direction:

```json
{
  "all": [
    {
      "variable": "hasKey",
      "equals": true
    },
    {
      "variable": "coins",
      "gte": 10
    }
  ]
}
```

### Asset resolver

Add safe package asset loading for:

- images
- audio
- video
- fonts

with object URL lifecycle management.

### Additional renderer adapters

The engine / renderer separation is now in place:

```text
               .ebk
                │
                ▼
        EveryBookEngine
        ├─ Package
        ├─ Navigation
        ├─ Story
        ├─ State
        └─ Conditions
                │
                ▼
      EveryBookRenderer
        ├─ HTML sanitization
        ├─ DOM action binding
        └─ Shadow DOM presentation
```

The next step is to build additional adapters on top of the same headless engine, such as React-specific bindings, CLI/story simulation, and future Electron or mobile integrations.

---

## Design Principle

> **EveryBook is a programmable book format, not a website inside a ZIP.**

The package should remain portable, deterministic, and controlled by the engine.

The long-term goal is a reusable interactive publishing runtime that can support different readers and platforms without changing the book format.
