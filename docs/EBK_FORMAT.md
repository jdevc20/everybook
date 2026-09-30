# EBK format and authoring guide

This documents the current TypeScript reader contract, based on `packages/core/src/types.ts` and runtime source. It is not a versioned interoperability standard. The current package version is `0.1.0`; the validator checks that the manifest version is present but does not negotiate versions.

## Container

An `.ebk` is a ZIP archive with `manifest.json` directly at its root:

```text
demo.ebk
  manifest.json
  pages/start.html
  pages/finish.html
  story/story.json
  styles/book.css
```

Paths identify files inside the ZIP. Use forward-slash relative paths. Do not wrap these files in an extra parent directory. HTML and CSS load as text; packaged image/audio/video paths are not currently rewritten into usable browser URLs.

## Complete two-page example

Create the five files below. This example follows the inspected data contract; browser execution was not verified during the documentation task.

`manifest.json`:

```json
{
  "id": "first-door-demo",
  "format": "everybook",
  "version": "0.1.0",
  "title": "The First Door",
  "entry": { "chapterId": "chapter-1", "pageId": "start" },
  "story": "story/story.json",
  "styles": ["styles/book.css"],
  "navigation": { "jumpMode": "guarded", "allowBacktracking": true },
  "chapters": [
    {
      "id": "chapter-1",
      "title": "The Door",
      "pages": [
        { "id": "start", "title": "Arrival", "src": "pages/start.html", "timeline": "main" },
        {
          "id": "finish",
          "title": "Beyond the Door",
          "src": "pages/finish.html",
          "timeline": "main",
          "access": {
            "requirements": [{ "type": "variableEquals", "key": "hasKey", "value": true }],
            "fallback": { "chapterId": "chapter-1", "pageId": "start" },
            "lockedMessage": "Take the key before opening the door."
          }
        }
      ]
    }
  ]
}
```

`story/story.json`:

```json
{
  "version": "0.1.0",
  "start": { "chapterId": "chapter-1", "pageId": "start" },
  "mainTimeline": "main",
  "timelines": [{ "id": "main", "title": "Main Story" }],
  "variables": { "hasKey": false },
  "choices": [
    {
      "id": "take-key",
      "label": "Take the key and open the door",
      "from": { "chapterId": "chapter-1", "pageId": "start" },
      "effects": [{ "type": "setVariable", "key": "hasKey", "value": true }],
      "goTo": { "chapterId": "chapter-1", "pageId": "finish" }
    }
  ]
}
```

`pages/start.html`:

```html
<section class="page">
  <h1>The First Door</h1>
  <p>A key lies beside a locked door.</p>
  <button data-ebk-action="choice" data-choice-id="take-key">
    Take the key and open the door
  </button>
</section>
```

`pages/finish.html`:

```html
<section class="page">
  <h1>Beyond the Door</h1>
  <p data-ebk-if="hasKey">The key fits. Your journey continues.</p>
  <button data-ebk-action="previousPage">Return to the start</button>
</section>
```

`styles/book.css`:

```css
.page { padding: 24px; font-family: Georgia, serif; line-height: 1.7; }
.page button { padding: 10px 16px; cursor: pointer; }
```

From the directory containing those files, using fresh output filenames:

```powershell
Compress-Archive -Path manifest.json,pages,story,styles -DestinationPath ../first-door-demo.zip
Rename-Item -LiteralPath ../first-door-demo.zip -NewName first-door-demo.ebk
```

Open the resulting file in the React reader. In guarded mode, jumping to “Beyond the Door” before taking the key should show the locked-page message. Choosing the key should set the variable and navigate there.

## Manifest reference

| Field | Contract |
| --- | --- |
| `id` | Required by TypeScript; stable book identity and storage namespace. Current validator does not check it. |
| `format` | Must be `"everybook"`. |
| `version`, `title` | Required, nonempty values checked by validator. |
| `entry` | `{ chapterId, pageId }` referencing a declared page; required even with a story. |
| `chapters` | Nonempty array of `{ id, title, pages }`. Each page requires `id` and `src`. |
| `author`, `language`, `description`, `cover` | Optional metadata. Cover is path-checked but not rendered by the demo. |
| `story` | Optional path to story JSON. Without it, no story state or saved progress is created. |
| `styles` | Optional array of CSS paths, concatenated in order. |
| `navigation.jumpMode` | `free`, `guarded` (default), or `storyStrict`. |
| `navigation.defaultEntry` | Overrides `story.start` for a fresh story session. |
| `navigation.allowBacktracking` | `false` blocks `previousPage`; it does not block all direct jumps to earlier pages. |
| `permissions` | Optional audio/video/network/storage booleans. `network: true` is rejected; other flags are not enforced as runtime permission gates. |

Pages may also contain `title`, `timeline`, `mode` (`linear`, `choice`, `mixed`) and `access`. Page mode currently describes intent but is not used to restrict navigation. Prefer stable chapter IDs and page IDs unique within each chapter; use globally unique choice IDs. Avoid `:` in IDs because state uses colon-delimited page keys. Duplicate IDs and many field types are not comprehensively validated.

## Access rules

`access.requirements` is an array; all recognized requirements must pass:

| Requirement | Fields and meaning |
| --- | --- |
| `choiceMade` | `choiceId`: choice is in remembered history. |
| `variableExists` | `key`: property exists, even if false or null. |
| `variableEquals` | `key`, `value`: strict equality against state. Prefer primitive values. |
| `visitedPage` | `chapterId`, `pageId`: page has been visited. |

`free` allows access even when requirements fail and marks default-storyline use. It adds missing defaults; it does not replay earlier choices or traverse `defaultPath`. `guarded` checks requirements. `storyStrict` additionally requires the destination to have been visited or unlocked; applying a choice unlocks its target. A storyless book in strict mode has no state and is blocked.

Blocked access renders a message with an optional button to `access.fallback`; fallback is not an automatic redirect. Unknown requirement types and unknown jump modes are not comprehensively rejected, so malformed content must not be treated as validated.

## Story and effects

A story declares `version`, `start`, `mainTimeline` and `timelines`; optional fields are `variables`, `defaultPath`, `choices` and `endings`. It is JSON-parsed without comprehensive schema validation.

Each choice has `id`, `label`, optional `from`, `condition` and `effects`, plus a `goTo` entry. `from` is not checked when applying the choice. Choice buttons must be authored in HTML; the engine does not generate them from story JSON.

| Effect | Fields |
| --- | --- |
| `setVariable` | `key`, `value` |
| `incrementVariable` | `key`, numeric `value` |
| `setTimeline` | `timelineId` |
| `rememberChoice` | `choiceId` |

The destination page's `timeline` becomes the current timeline when rendered, potentially replacing a `setTimeline` effect. Repeated selections can reapply effects even though history deduplicates the same choice on the same page.

An ending has `id`, `title`, optional `condition`, and `page`. `nextPage()` considers the first available ending only after reaching the end of manifest page order. This is not an automatic terminal-story detector.

## HTML actions and conditions

| `data-ebk-action` | Additional attributes |
| --- | --- |
| `nextPage` | None |
| `previousPage` or `back` | None; both move backward in manifest order, not visit history. |
| `goToPage` | `data-chapter-id`, `data-page-id` |
| `choice` | `data-choice-id` |
| `setVariable` | `data-key`, optional `data-value` |

`data-value` supports numbers, booleans, null, undefined, JSON objects/arrays and strings. Omitting it produces boolean true. Old `goTo` with `data-target` is unsupported despite `data-target` remaining in the sanitizer allowlist.

Use `data-ebk-if="hasKey"`, `data-ebk-if="!hasKey"`, or comparisons such as `coins >= 10` and `route == 'forest'`. Supported comparison operators are `==`, `!=`, `>`, `<`, `>=`, `<=`; equality is strict. Missing/empty conditions pass. Numeric comparison converts values with `Number`, falling back to zero for NaN. There is no general `&&`, `||`, arithmetic or JavaScript execution.

Conditional content only runs with story state. False elements are removed, so later variable changes cannot bring them back without re-rendering the page. Direct API `setVariable` does not re-evaluate page content; the HTML action invokes that evaluation separately.

HTML allows headings, paragraphs, text emphasis, sections, lists, buttons, images, audio and video, among other listed tags. Scripts, iframes, forms and inline styles are forbidden. CSS is loaded separately. These restrictions do not provide complete resource isolation; read [security limitations](CORE_API.md).
