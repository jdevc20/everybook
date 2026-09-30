# Core API and implementation notes

The package root exports `EveryBookRenderer`, `StoryEngine`, `StoryState`, `ConditionEngine` and the types listed in `src/index.ts`. `EbkPackage`, `PageAccessEngine` and `RenderSurface` are internal modules, not root exports. Some types in `types.ts`, including access-rule and jump-mode aliases, are also not root-exported.

## Integration

Run in a browser with a DOM, Shadow DOM, `structuredClone`, and localStorage if persistence is enabled. This is not a server-side HTML renderer.

```ts
import { EveryBookRenderer } from "@everybook/core";

const renderer = new EveryBookRenderer({
  container: "#reader", // An existing HTMLElement also works.
  storageKey: "my-reader",
});

async function openBook(file: File) {
  renderer.clear(); // Clear previous book state before reusing this instance.
  await renderer.open(file);
}
```

Bind your file input to `openBook` and handle rejected promises in your UI. The constructor throws if the container cannot be found. A container must support attaching a shadow root.

## Renderer methods

| Method | Behavior |
| --- | --- |
| `open(file: File \| Blob \| ArrayBuffer): Promise<void>` | Load package, optional saved story state, CSS and initial page. |
| `goToPage(chapterId, pageId): Promise<void>` | Check access and render the page, or show a locked-page message. A blocked page does not update current position. |
| `nextPage(): Promise<void>` | Next page in manifest order, then next chapter; at the end, try the first available ending. |
| `previousPage(): Promise<void>` | Previous page in manifest order; checks `allowBacktracking`. |
| `applyChoice(choiceId): Promise<void>` | Check choice condition, record choice, apply effects, unlock destination, save, navigate. Effects occur before destination access/load succeeds. |
| `getCurrentPosition()` | Current chapter/page/timeline, or null. |
| `getTableOfContents()` | Manifest chapters, or an empty array. |
| `getStoryState()` | Cloned story snapshot, or null. |
| `getVariable<T>(key)` | Typed variable value, or undefined; the generic does not validate its runtime type. |
| `setVariable(key, value)` | Update story state, save and refresh notes; does not itself re-render conditional content. |
| `saveProgress()` | Save only when a story and storage key exist. |
| `clearProgress()` | Delete the stored save; live state remains and later actions can save it again. Reopen immediately to start fresh. |
| `clear()` | Clear content, footer, book styles and loaded state; saved progress remains. |

There is no public renderer event subscription, `destroy`, `goToChapter`, `getManifest`, or general script runtime API. Do not assume illustrative APIs from old design notes exist.

## Progress and reader UI

Storage uses `<storageKey>:<manifest.id>:state`. The React example passes `everybook:<filename>`, so changing the filename changes the save namespace. Persistence covers current position, variables, remembered choices/timestamps, visited/unlocked pages and the default-storyline flag. Storyless books have no persisted position in this implementation.

Restore checks book identity and fills some missing fields; there is no comprehensive save schema migration. Browser storage access/quota errors are not comprehensively handled. Use JSON-compatible variables for persistence; values must also support `structuredClone` for snapshots.

The React app displays a title derived from the filename, rather than manifest title. Its labels and highlighted contents entry update after toolbar/contents navigation, but not automatically after actions clicked inside the book. “Your Story Notes” is rendered by Core and includes all variables, choices and up to ten recent unique visited-page entries; it can reveal story state to the reader.

## Current limitations

These findings are from source inspection, not a full security audit or exhaustive runtime test.

| Area | Observed limitation |
| --- | --- |
| Build | `manifest/ManifestValidator.ts` imports `./types`; the actual file is `../types`. |
| Validation | Manifest chapters are traversed before structural validation. Story JSON is cast to a type without full validation. IDs, references and supported enum values are not comprehensively checked. |
| Book lifecycle | Opening a storyless book on an instance that previously held a story does not reset `storyEngine` in `open`; clear first or create a new instance. |
| Branching | `choice.from`, page mode and `defaultPath` are not enforced. Remembered history deduplication does not make effects idempotent. |
| Conditional DOM | False elements are removed rather than hidden/restored. |
| Timeline | Page rendering replaces timeline state with page metadata, including undefined. |
| Backtracking | The flag is checked by `previousPage`, not all direct navigation. |
| Media | Allowed media tags do not imply ZIP asset extraction or permission enforcement. No archive asset URL resolver is implemented. |
| Writer compatibility | Writer output is plain JSON and uses a different data model; no conversion pipeline exists. |

## Security boundary

DOMPurify applies an HTML allowlist and strips scripts and common unsafe markup. RenderSurface puts content and CSS in an open Shadow DOM for presentation isolation. **This is not a complete sandbox for untrusted books.**

- Book CSS is inserted without a CSS sanitizer; resource URLs and imports are not comprehensively restricted.
- HTML media `src` values are not connected to `assertSafeAssetSrc`. Rejecting `permissions.network: true` is not network blocking.
- `assertSafeEbkPath` attempts protocol rejection inside a `try` whose `catch` also swallows its rejection error. Backslash replacement only replaces the first occurrence. These checks should not be described as comprehensive URL/path protection.
- Generated story notes use an escaping helper whose string replacements escape only the first occurrence of each character; those generated fragments are assigned as HTML without the page sanitizer.
- There are no explicit archive size/decompression limits in the loader.

Before accepting arbitrary third-party books, address these gaps and add focused regression tests. Do not add unrestricted script execution as a substitute for controlled actions.

## Verification baseline

The documentation review on 2026-09-17 inspected the implementation and package scripts. The Core build attempt stopped during pnpm dependency reconciliation with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; successful compilation and browser behavior were not established. No automated test suite is configured in the inspected workspace packages. The sibling Writer solution compiled with duplicate-model warnings.
