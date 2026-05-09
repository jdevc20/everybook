# EveryBook Core

`@everybook/core` is the main rendering engine package for the EveryBook project.

It is responsible for opening an `.ebk` file, reading its manifest, loading chapters, applying styles, sanitizing content, and rendering the book into a web container.

EveryBook Core is the foundation that future EveryBook apps will use:

```text
EveryBook Core
├─ Web Reader
├─ Android Reader
├─ Desktop Reader
├─ EveryBook Writer
└─ CLI Tools
```

---

## What is EveryBook Core?

EveryBook Core is a TypeScript library that acts as the first version of the EveryBook renderer.

Its main purpose is to read and render `.ebk` files.

An `.ebk` file is a packaged interactive book file. It can contain:

- `manifest.json`
- HTML chapters
- CSS styles
- Images
- Audio
- Video
- Future scripts
- Book metadata
- Permission rules

The core renderer does not act like a normal website. It controls what the book is allowed to do.

This makes EveryBook safer, more portable, and easier to support across platforms.

---

## Main Goal

The first goal of `@everybook/core` is simple:

```text
Open .ebk
Read manifest.json
Load first chapter
Render HTML
Apply CSS
Handle chapter navigation
```

Example flow:

```text
hello-world.ebk
   ↓
EveryBook Core
   ↓
Read manifest.json
   ↓
Load chapters/start.html
   ↓
Render into #reader
   ↓
Click "Enter the forest"
   ↓
Load chapters/forest.html
```

---

## Package Name

```text
@everybook/core
```

---

## Project Location

Recommended monorepo structure:

```text
everybook/
├─ package.json
├─ pnpm-workspace.yaml
├─ packages/
│  └─ core/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ index.ts
│     │  ├─ EveryBookRenderer.ts
│     │  ├─ EbkPackage.ts
│     │  ├─ ManifestValidator.ts
│     │  ├─ actions.ts
│     │  └─ types.ts
│     └─ dist/
└─ examples/
   └─ react-reader/
```

---

## What EveryBook Core Does

Current responsibilities:

- Load `.ebk` files
- Read ZIP package contents
- Find `manifest.json`
- Parse the manifest
- Validate required manifest fields
- Load the entry chapter
- Load CSS files
- Sanitize HTML
- Render the chapter into a DOM container
- Bind EveryBook actions
- Navigate between chapters using `data-ebk-action`

---

## What EveryBook Core Does Not Do Yet

Do not expect the core to support everything immediately.

Not yet included in early versions:

- Full JavaScript runtime
- Full browser APIs
- Network access
- EPUB compatibility
- Full pagination engine
- Native Android rendering
- DRM
- Cloud sync
- Accounts
- Marketplace
- Visual Writer app

These can come later after the core renderer becomes stable.

---

## Installation in Workspace

Inside another package in the same monorepo, install the core package using workspace linking:

```bash
pnpm add @everybook/core@workspace:*
```

Example package:

```json
{
  "dependencies": {
    "@everybook/core": "workspace:*"
  }
}
```

---

## Build Command

From the root folder:

```bash
pnpm --filter @everybook/core build
```

Or using a root script:

```bash
pnpm build:core
```

From inside the core package:

```bash
cd packages/core
pnpm build
```

Successful build output should create:

```text
packages/core/dist/
├─ index.js
├─ index.cjs
├─ index.d.ts
└─ index.d.cts
```

---

## Basic Usage

In a web or React project:

```ts
import { EveryBookRenderer } from "@everybook/core";

const renderer = new EveryBookRenderer({
  container: "#reader"
});

await renderer.open(file);
```

Where `file` is a selected `.ebk` file from an input:

```html
<input id="fileInput" type="file" accept=".ebk,.zip" />
<div id="reader"></div>
```

Example:

```ts
import { EveryBookRenderer } from "@everybook/core";

const renderer = new EveryBookRenderer({
  container: "#reader"
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

Example component:

```tsx
import { useEffect, useRef } from "react";
import { EveryBookRenderer } from "@everybook/core";

export default function EveryBookReader() {
  const readerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<EveryBookRenderer | null>(null);

  useEffect(() => {
    if (!readerRef.current) return;

    rendererRef.current = new EveryBookRenderer({
      container: readerRef.current
    });
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !rendererRef.current) return;

    await rendererRef.current.open(file);
  }

  return (
    <main>
      <input type="file" accept=".ebk,.zip" onChange={handleFileChange} />

      <div
        ref={readerRef}
        style={{
          marginTop: "24px",
          padding: "32px",
          border: "1px solid #ddd",
          borderRadius: "16px",
          minHeight: "500px"
        }}
      />
    </main>
  );
}
```

---

## `.ebk` File Structure

A basic `.ebk` file is a ZIP archive renamed to `.ebk`.

Example:

```text
hello-world.ebk
├─ manifest.json
├─ chapters/
│  ├─ start.html
│  └─ forest.html
└─ styles/
   └─ book.css
```

Important:

The ZIP root must contain `manifest.json` directly.

Correct:

```text
hello-world.ebk/manifest.json
```

Wrong:

```text
hello-world.ebk/hello-world/manifest.json
```

---

## Manifest Format

Example `manifest.json`:

```json
{
  "format": "everybook",
  "version": "0.1.0",
  "title": "Hello EveryBook",
  "entry": "chapters/start.html",
  "styles": ["styles/book.css"],
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
|---|---:|---|
| `format` | Yes | Must be `"everybook"` |
| `version` | Yes | EveryBook format version |
| `title` | Yes | Book title |
| `entry` | Yes | First chapter to open |
| `styles` | No | CSS files to load |
| `permissions` | No | Book permission rules |

---

## Example Chapter

`chapters/start.html`

```html
<section class="page">
  <h1>The First Door</h1>

  <p>You wake up in front of two paths.</p>

  <button data-ebk-action="goTo" data-target="chapters/forest.html">
    Enter the forest
  </button>
</section>
```

`chapters/forest.html`

```html
<section class="page">
  <h1>The Forest</h1>

  <p>The trees whisper around you.</p>

  <button data-ebk-action="goTo" data-target="chapters/start.html">
    Go back
  </button>
</section>
```

---

## EveryBook Actions

EveryBook Core uses controlled actions instead of unrestricted JavaScript.

Current supported action:

```text
goTo
```

Example:

```html
<button data-ebk-action="goTo" data-target="chapters/forest.html">
  Enter the forest
</button>
```

The renderer sees:

```text
data-ebk-action="goTo"
data-target="chapters/forest.html"
```

Then it loads the target chapter.

This is safer than allowing raw JavaScript like this:

```html
<script>
  window.location = "chapters/forest.html";
</script>
```

---

## Why Controlled Actions?

Controlled actions make EveryBook safer and more portable.

Benefits:

- Easier to sandbox
- Easier to support on Android
- Easier to support on old PCs
- Easier to validate
- Easier to document
- Less security risk
- More consistent rendering

EveryBook should behave like a book format, not like a random website.

---

## CSS Support

EveryBook Core can load CSS files listed in the manifest.

Example:

```json
{
  "styles": ["styles/book.css"]
}
```

Example CSS:

```css
.page {
  max-width: 680px;
  margin: 0 auto;
  padding: 48px;
  font-family: Georgia, serif;
  line-height: 1.7;
}

.page h1 {
  font-size: 40px;
}

.page button {
  margin-top: 24px;
  padding: 12px 18px;
  border: 1px solid #111827;
  border-radius: 12px;
  background: white;
  cursor: pointer;
}
```

---

## HTML Sanitization

EveryBook Core sanitizes HTML before rendering.

This helps prevent unsafe content from running inside the reader.

Allowed early tags may include:

```text
h1
h2
h3
p
span
strong
em
section
article
div
img
audio
video
button
ul
ol
li
br
```

Allowed early attributes may include:

```text
src
alt
controls
class
id
data-ebk-action
data-target
```

Blocked or avoided in early versions:

```text
script
iframe
external scripts
onclick
localStorage
cookies
network requests
file system access
```

---

## Core Source Files

Recommended source files:

```text
src/
├─ index.ts
├─ EveryBookRenderer.ts
├─ EbkPackage.ts
├─ ManifestValidator.ts
├─ actions.ts
└─ types.ts
```

### `index.ts`

Exports the public API.

```ts
export { EveryBookRenderer } from "./EveryBookRenderer";

export type {
  EveryBookManifest,
  EveryBookRendererOptions,
  LoadedChapter
} from "./types";
```

### `EveryBookRenderer.ts`

Main renderer class.

Responsible for:

- Opening EBK files
- Loading styles
- Rendering chapters
- Navigating chapters
- Binding actions

### `EbkPackage.ts`

Responsible for:

- Reading ZIP file
- Loading `manifest.json`
- Loading text files
- Loading entry chapter
- Loading CSS files

### `ManifestValidator.ts`

Responsible for validating:

- `format`
- `version`
- `title`
- `entry`
- unsupported permissions

### `actions.ts`

Responsible for binding controlled EveryBook actions.

Example:

```text
data-ebk-action="goTo"
```

### `types.ts`

Contains shared TypeScript types.

---

## TypeScript Types

Example:

```ts
export type EveryBookManifest = {
  format: "everybook";
  version: string;
  title: string;
  entry: string;
  styles?: string[];
  permissions?: {
    audio?: boolean;
    video?: boolean;
    network?: boolean;
    storage?: boolean;
  };
};

export type EveryBookRendererOptions = {
  container: HTMLElement | string;
};

export type LoadedChapter = {
  path: string;
  html: string;
};
```

---

## Root Workspace Setup

Root `package.json`:

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

Root `pnpm-workspace.yaml`:

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

`packages/core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

---

## Creating a Sample `.ebk`

Create this folder:

```text
examples/sample-books/hello-world/
```

Structure:

```text
hello-world/
├─ manifest.json
├─ chapters/
│  ├─ start.html
│  └─ forest.html
└─ styles/
   └─ book.css
```

Then compress it.

PowerShell:

```powershell
cd C:\Dev\Projects\EveryBook\everybook\examples\sample-books\hello-world

Compress-Archive -Path manifest.json,chapters,styles -DestinationPath ..\hello-world.zip -Force

Rename-Item ..\hello-world.zip hello-world.ebk
```

The final file should be:

```text
examples/sample-books/hello-world.ebk
```

---

## Common Errors

### Import is red

Problem:

```ts
import { EveryBookRenderer } from "@everybook/core";
```

Possible fixes:

1. Make sure the example app has:

```json
"@everybook/core": "workspace:*"
```

2. Make sure `pnpm-workspace.yaml` includes:

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

3. Run from root:

```bash
pnpm install
pnpm --filter @everybook/core build
```

4. Restart TypeScript server in VS Code.

---

### No projects matched the filters

Example error:

```text
No projects matched the filters
```

This means the package name in the command does not match the package name in `package.json`.

If your example package is:

```json
"name": "react-reader"
```

Run:

```bash
pnpm --filter react-reader dev
```

Not:

```bash
pnpm --filter react-render dev
```

---

### Cannot find `src/index.ts`

This usually means the script is running from the wrong folder or the package is incorrectly named.

Make sure:

```text
packages/core/package.json
packages/core/src/index.ts
```

exist.

Also make sure root `package.json` is not named `@everybook/core`.

Root should be:

```json
{
  "name": "everybook",
  "private": true
}
```

Only the core package should be:

```json
{
  "name": "@everybook/core"
}
```

---

### DTS Build Error

If JavaScript builds but DTS fails, check `tsconfig.json`.

Make sure it includes:

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

Then run:

```bash
pnpm --filter @everybook/core build
```

---

## Roadmap

### Version 0.1.0

- Open `.ebk`
- Read manifest
- Load entry chapter
- Render HTML
- Load CSS
- Handle `goTo`

### Version 0.2.0

- Image asset support
- Audio support
- Video support
- Better errors
- Reader progress
- Previous/next chapter history

### Version 0.3.0

- Book variables
- `setVariable`
- `getVariable`
- Conditional content
- Simple dialogs

### Version 0.4.0

- CLI validator
- `everybook validate`
- `everybook build`
- `everybook create`

### Version 0.5.0

- Android reader proof of concept
- WebView-based reader
- Local `.ebk` opening
- Local progress saving

---

## Future API Ideas

Possible future API:

```ts
const renderer = new EveryBookRenderer({
  container: "#reader",
  storage: "local",
  mode: "standard"
});

await renderer.open(file);

renderer.on("chapterChange", (chapter) => {
  console.log("Current chapter:", chapter.path);
});
```

Possible future actions:

```html
<button data-ebk-action="setVariable" data-key="hasKey" data-value="true">
  Pick up key
</button>

<button data-ebk-action="goTo" data-target="chapters/locked-door.html">
  Go to locked door
</button>
```

---

## Development Priority

Build in this order:

```text
1. Core rendering
2. Chapter navigation
3. Asset loading
4. Reader progress
5. CLI validation
6. Web reader UI
7. Android reader
8. Writer app
```

---

## Design Principle

EveryBook should be:

```text
A programmable book format.
```

Not:

```text
A website inside a ZIP.
```

The renderer should control the book experience.

The `.ebk` file should be portable.

The core should be reusable across platforms.

---

## Summary

`@everybook/core` is the heart of the EveryBook project.

It should remain focused, reusable, and platform-friendly.

Its first job is not to do everything.

Its first job is to prove that this works:

```text
Open .ebk
Render chapter
Click choice
Navigate chapter
```

Once that is stable, EveryBook can grow into a full open-source interactive book ecosystem.
