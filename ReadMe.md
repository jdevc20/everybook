# EveryBook Core and example reader

EveryBook is an interactive-book prototype. `@everybook/core` reads ZIP-based `.ebk` files and renders chapters/pages in a browser. The React application demonstrates local file opening and navigation.

## Implemented features

- ZIP loading with JSZip and manifest/page lookup.
- Sanitized page HTML with DOMPurify and book CSS in a Shadow DOM.
- Next/previous and direct chapter/page navigation.
- Choices, variable effects, simple conditions and conditional endings.
- Free, guarded and story-strict page access.
- Story progress in localStorage when configured.
- Story notes showing choices, variables and visited pages.
- React contents list, navigation controls and position display.

This is an early implementation. The current security controls are not a full sandbox, and a successful build was not established during the documentation review. See the implementation notes below.

## Documentation

- [EBK format and complete two-page example](docs/EBK_FORMAT.md)
- [Core API, lifecycle and known limitations](docs/CORE_API.md)
- [React reader](examples/react-reader/README.md)
- [Whole-project overview](../../README.md), including the separate Windows Writer
- [Developer setup and architecture](../../docs/DEVELOPMENT.md)
- [AI contributor context](../../docs/AI_CONTEXT.md)

The last three links refer to the enclosing Project-Everybook workspace and are only available when that workspace is present. Format/API documentation lives inside this reader Git repository.

## Setup

Run these commands from this directory, which contains the actual pnpm workspace:

```powershell
pnpm install
pnpm --filter @everybook/core build
pnpm --filter react-reader dev
```

Other scripts: `pnpm build`, `pnpm dev:core`, `pnpm --filter react-reader build`, and `pnpm --filter react-reader lint`.

Core uses TypeScript and tsup; the example uses React 19 and Vite 8. Use a compatible Node.js/pnpm installation. The repository does not pin their versions. The current manifest validator has an incorrect relative types import, and the reviewed installation encountered a pnpm dependency-reconciliation blocker; see the API notes before diagnosing setup failures.

## Source layout

```text
packages/core/src/
  index.ts                 Public exports
  types.ts                 Book, story and state contracts
  EveryBookRenderer.ts     Orchestration and navigation
  package/                 ZIP/text loading
  manifest/                Manifest validation
  rendering/               Shadow DOM and styles
  runtime/                 HTML action bindings
  security/                HTML sanitization and path helpers
  story/                   Conditions, access, choices and state
examples/react-reader/     React + Vite reader
```

## Format compatibility

The current manifest uses an `entry` object with `chapterId` and `pageId`, plus a `chapters` array. HTML navigation uses `goToPage` with `data-chapter-id` and `data-page-id`. Older path-string entry and `goTo` examples are obsolete.

The sibling Windows Writer currently saves plain project JSON even through its “Export .ebk” command. That output is not compatible with this reader's ZIP format. Android apps, CLI tools, EPUB import, automatic pagination and cloud services are not implemented here.

Reviewed against source on 2026-09-17.
