# React EveryBook reader

A React 19 + TypeScript + Vite 8 example that embeds the local `@everybook/core` package.

## Run

From the `EveryBook/everybook` workspace root:

```powershell
pnpm install
pnpm --filter @everybook/core build
pnpm --filter react-reader dev
```

Open the URL printed by Vite and choose a ZIP-based `.ebk` file. See the [format guide](../../docs/EBK_FORMAT.md) for a complete example. Core build prerequisites and known issues are in the [API notes](../../docs/CORE_API.md).

## Features

- Local `.ebk` selection.
- Chapter/page contents navigation with active-page highlighting.
- Previous/next controls and current-position display.
- Progress restoration through Core and a clear-progress control.
- Book content and story notes rendered by Core inside a Shadow DOM.

`src/App.tsx` owns the renderer instance and React UI state. `src/App.css` and `src/index.css` provide app styling. There is no backend or upload endpoint.

## Behavior to know

The display title comes from the filename. Progress is keyed by filename and manifest book ID. The UI synchronizes position after toolbar/contents navigation, but does not subscribe to in-book actions, so its labels can lag behind the actual page. Clear Progress removes the saved state; reopen immediately before taking further actions to start fresh. File-opening errors have no dedicated error UI.

The Windows Writer's current `.ebk` export is plain JSON and cannot be loaded by this reader.

## Checks

From the workspace root:

```powershell
pnpm --filter react-reader build
pnpm --filter react-reader lint
```

No reader test script is configured. Browser behavior was not smoke-tested during the 2026-09-17 documentation review.
