# Contributing & Development

This document covers how to build the extension from source, run tests, and contribute changes.

---

## Contents

- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Development workflow](#development-workflow)
- [Building for production](#building-for-production)
- [Packaging for distribution](#packaging-for-distribution)
- [Running tests](#running-tests)
- [Architecture notes](#architecture-notes)
- [Design decisions](#design-decisions)
- [v1 scope and what's deferred](#v1-scope-and-whats-deferred)
- [Submitting changes](#submitting-changes)

---

## Prerequisites

- **Node.js** 22.22+ (or 24.15+) -- required by the test tooling (Vitest 5, jsdom 30); CI and the `node:22` image both meet it
- **npm** 9+
- A running [Linkding](https://github.com/sissbruecker/linkding) instance for manual testing

---

## Project structure

```
linkding-toolbar-companion/
├── public/
│   └── manifest.json          # MV3 manifest (source — do not edit dist directly)
├── src/
│   ├── background/
│   │   └── service-worker.ts  # All network calls, alarm management, message handling
│   ├── popup/
│   │   ├── Popup.tsx          # Container: app-wide state, service-worker messaging, view routing
│   │   ├── views/
│   │   │   ├── MainView.tsx         # Search, keyboard nav, bookmark list
│   │   │   ├── AddBookmarkView.tsx  # "Save current page" form
│   │   │   └── UnconfiguredView.tsx # First-run "connect your server" screen
│   │   └── popup.css
│   ├── options/
│   │   ├── Options.tsx        # Settings page
│   │   └── options.css
│   ├── components/            # Shared React components
│   │   ├── BookmarkRow.tsx
│   │   ├── Button.tsx
│   │   ├── EditModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── StatusBar.tsx
│   │   └── TagChip.tsx
│   └── lib/
│       ├── api.ts             # Linkding REST API client
│       ├── browser.ts         # Browser abstraction (webextension-polyfill wrapper)
│       ├── cache.ts           # Local cache management
│       ├── search.ts          # Client-side search with deterministic scorer
│       ├── validators.ts      # URL/token validation
│       └── types.ts           # Shared TypeScript types + message protocol
├── tests/
│   ├── unit/                  # Vitest unit tests
│   └── e2e/                   # Playwright tests against the built extension
│       └── fixtures/          # Persistent-context launcher + mock Linkding server
├── scripts/
│   ├── package-chrome.sh      # Produces linkding-toolbar-companion-chrome.zip
│   └── package-firefox.sh     # Produces linkding-toolbar-companion-firefox.zip
├── vite.config.ts             # Single config, Chrome/Firefox selected via --mode
├── tsconfig.json
└── package.json
```

---

## Getting started

```bash
# Clone the repository
git clone https://github.com/damianmendis/linkding-toolbar-companion.git
cd linkding-toolbar-companion

# Install dependencies
npm install
```

---

## Development workflow

### Build for Chrome (watch mode)

```bash
npm run dev
```

Vite watches for file changes and rebuilds into `dist-chrome/` automatically.

**Load in Chrome:**
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `dist-chrome/`
4. After each rebuild, click the ↻ icon on the extension card to reload it

### Build for Firefox (watch mode)

There's no dedicated `npm` script for this yet — pass `--watch` through to Vite directly:

```bash
npx vite build --watch --mode firefox
```

Rebuilds into `dist-firefox/` on file changes.

**Load in Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select any file inside `dist-firefox/`
4. Firefox reloads the extension automatically on rebuild (in most cases)

---

## Building for production

```bash
# Chrome / Edge
npm run build:chrome   # outputs to dist-chrome/

# Firefox
npm run build:firefox  # outputs to dist-firefox/
```

Both targets use tree-shaking and minification. The output is ready to load unpacked or package for distribution.

---

## Packaging for distribution

```bash
# Produces linkding-toolbar-companion-chrome.zip (from dist-chrome/)
bash scripts/package-chrome.sh

# Produces linkding-toolbar-companion-firefox.zip (from dist-firefox/)
bash scripts/package-firefox.sh
```

Or manually:

```bash
# Chrome
cd dist-chrome && zip -r ../linkding-toolbar-companion-chrome.zip . -x '*.DS_Store'

# Firefox
cd dist-firefox && zip -r ../linkding-toolbar-companion-firefox.zip . -x '*.DS_Store'
```

---

## Linting and type checking

```bash
npm run lint        # TypeScript typecheck, then ESLint
npm run typecheck   # typecheck only
```

ESLint (`eslint.config.mjs`) uses the recommended JavaScript and
typescript-eslint rules everywhere, plus `react-hooks` (including the React
Compiler checks) and `jsx-a11y` on the extension's own `.tsx` files. Where a
rule is deliberately switched off for one line, an
`eslint-disable-next-line` comment says why. CI runs `npm run lint` on every
pull request and push to `main`.

---

## Firefox add-on validation (web-ext)

[`web-ext`](https://github.com/mozilla/web-ext) is Mozilla's official add-on
development CLI. Its `lint` command runs `addons-linter` -- the same engine
AMO's upload page validates against -- so issues show up locally instead of
after an upload attempt.

`lint:firefox` builds the Firefox bundle, applies the same
`scripts/firefox-manifest-override.js` fixup `package-firefox.sh` uses
(`background.scripts`, `browser_specific_settings`, etc. -- see that file for
why each one is there), then lints the result -- it's self-contained, no
need to run anything else first:

```bash
npm run lint:firefox
```

Run it inside the project's `node:22` container per this repo's environment
policy:

```bash
docker run --rm -v "$PWD":/app -w /app node:22 bash -c "npm ci && npm run lint:firefox"
```

`web-ext` can also load the built extension into a real Firefox for manual
testing (`npm run start:firefox`), but that requires a Firefox binary on
whatever machine runs it -- it's not something this containerized flow covers.

CI runs it on every pull request and push to `main`, failing on errors (warnings are reported but don't fail the build).

---

## Running tests

```bash
# Run all unit tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

The test suite uses **Vitest** and covers:

| Module | What's tested |
|---|---|
| `src/lib/search.ts` | Search scoring, ranking, edge cases |
| `src/lib/validators.ts` | URL validation, token format checks |
| `src/lib/api.ts` | API response mapping, pagination, error handling |
| `src/lib/cache.ts` | Incremental merge, storage-quota warning, upsert/remove |

There are **63 unit tests** in the current suite. All must pass before submitting a PR.

### End-to-end tests

```bash
# One-time: build the extension and fetch a Chromium build for Playwright
npm run build:chrome
npx playwright install chromium

# Run the suite (needs a display -- xvfb-run in CI/headless environments)
npm run test:e2e
# or, without a display:
xvfb-run --auto-servernum npm run test:e2e
```

These load `dist-chrome/` into a real Chromium instance (`chromium.launchPersistentContext` with `--load-extension`) and talk to an in-memory mock Linkding server (`tests/e2e/fixtures/mock-server.ts`) instead of a real instance. Two environment-driven workarounds worth knowing about, both documented at the top of `tests/e2e/fixtures/extension.ts`:

- **Headed only.** Headless Chromium doesn't fully expose `chrome.*` extension APIs in every environment; the fixture always launches headed, which is why CI and Docker runs need `xvfb-run`.
- **Popups are opened as a normal tab**, not via a real toolbar-icon click (Playwright has no supported way to drive that for MV3 and capture the resulting popup). This is faithful for everything except `getActiveTab()`-based prefill on the "save current page" form, which will see the popup's own tab rather than a preceding page -- tests don't assert on prefilled values for that reason.

Tests run with a single Playwright worker (`playwright.config.ts`): each test launches its own persistent browser context, and running several of those concurrently is unstable in constrained environments (this project's Docker-based dev flow included).

---

## Architecture notes

### Popup: container vs. views

`Popup.tsx` is a container: it owns app-wide state (settings, cache, current view, offline flag) and every handler that talks to the background service worker. It renders one of `views/UnconfiguredView.tsx`, `views/AddBookmarkView.tsx`, `views/MainView.tsx`, or `EditModal` based on the current view. Each view owns only its own UI-local state (search query, form fields, keyboard nav, refs) and receives data/callbacks as props -- it never calls `sendToBackground()` itself. When adding a new view, follow this split rather than growing `Popup.tsx`.

### All network calls live in the service worker

Every fetch to the Linkding API goes through `src/background/service-worker.ts`. The popup and options page never call `fetch()` directly — they send messages to the background and await a response.

This is required for Manifest V3 correctness and is what resolves the CORS issue that affects direct extension-page fetches.

### Message protocol

Messages between the popup/options and the service worker use a typed protocol defined in `src/lib/types.ts`:

| Message type | Direction | Purpose |
|---|---|---|
| `TEST_CONNECTION` | popup/options → SW | Verify server URL and token |
| `SYNC_BOOKMARKS` | popup/options → SW | Trigger a full cache refresh (always full; the periodic background alarm uses a separate incremental path -- see below) |
| `GET_CACHE` | popup → SW | Retrieve cached bookmarks for display |
| `CREATE_BOOKMARK` | popup → SW | Add a new bookmark to Linkding |
| `UPDATE_BOOKMARK` | popup → SW | Edit an existing bookmark |
| `DELETE_BOOKMARK` | popup → SW | Remove a bookmark |

Use `sendToBackground()` from `src/lib/browser.ts` to send messages — it wraps the polyfill and handles response typing.

### Local cache

Bookmarks are stored in `browser.storage.local` under a single key. The cache is populated on sync and updated optimistically on create/edit/delete. It is the sole source of truth for popup rendering — the popup never waits for a network call to display content.

`browser.storage.local` has a ~10MB quota without the (more invasive) `unlimitedStorage` permission. Every cache write estimates its own serialized size and sets `storageWarning` once it crosses 80% of that quota (surfaced in the popup's status bar); a write that actually exceeds the quota fails with a descriptive error instead of an opaque one (see `saveCache()` in `src/lib/browser.ts`).

### Sync: full vs. incremental

The initial sync and any user-triggered refresh (`SYNC_BOOKMARKS`) always do a **full** sync (`runFullSync()` in `service-worker.ts`) — fetch every bookmark and tag, replace the cache. The periodic background alarm instead runs `runIncrementalSync()`, which fetches only bookmarks changed since the last sync via Linkding's `modified_since` query parameter and merges them into the existing cache by id.

Linkding's API has no way to list bookmarks *deleted* since a given time, so the incremental path alone can never learn about a deletion — it would linger in the cache forever. `runIncrementalSync()` tracks `lastFullSyncAt` and automatically falls back to a full sync at least once every 24h to reconcile that, bounding how stale a deletion can get without requiring a full refetch on every automatic cycle.

Archived bookmarks live in a separate collection (`GET /api/bookmarks/archived/`, excluded from the main `/api/bookmarks/` list) that takes the same parameters, including `modified_since` -- both sync paths fetch it alongside the main collection and merge the results by id, same as everything else.

### Search query syntax

`searchBookmarks()` (`src/lib/search.ts`) recognizes a handful of Linkding-style modifiers ahead of the free-text scorer: `#tag` (exact tag match, used by tag-chip clicks), `!unread`, `!shared`, `!archived`, `!untagged`. `parseQuery()` is the single place that decides which mode a query string is in; `describeQuery()` turns that into the label shown above the result list. Archived bookmarks are excluded from every mode except `!archived` itself, matching Linkding's own default list.

### Browser abstraction

`src/lib/browser.ts` wraps `webextension-polyfill` to provide a consistent API surface. Import from here rather than using `chrome.*` or `browser.*` directly — this is what keeps the codebase single-source for both targets.

---

## Design decisions

| Area | Decision | Reason |
|---|---|---|
| Manifest | V3 | Required for Chrome/Edge; supported in Firefox 109+ |
| UI framework | React 18 + TypeScript | Type safety, component reuse, familiar ecosystem |
| Styling | Plain CSS Modules | Minimal footprint; no utility framework needed at v1 scale |
| Search | Client-side, cache-only | Instant response with no keystroke-level API calls |
| Storage | `browser.storage.local` | Extension-scoped; never accessible to page context |
| Browser adapter | `webextension-polyfill` | Single API surface across Firefox and Chromium targets |
| Build tool | Vite 5 | Fast HMR, first-class MV3 support, easy multi-target config |

---

## v1 scope and what's deferred

**Included in v1:**
Settings, connection test, cache sync, toolbar popup, instant search, recent bookmarks, save current page, edit, delete, offline read, keyboard navigation, auto-refresh, Chrome + Firefox packaging.

**Deliberately excluded (planned for later iterations):**

| Feature | Notes |
|---|---|
| Tag tree / hierarchy | Complex UI, deferred |
| Fuzzy / ranked search | Current scorer is deterministic and exact-match weighted |
| Command palette | Nice-to-have; out of v1 scope |
| Theme customisation | Light/dark toggle deferred |
| Multiple Linkding accounts | Single-account only in v1 |
| Browser bookmark sync | Bidirectional sync with native bookmarks |
| AI-assisted search | Deferred |
| Import / export | Deferred |

---

## Submitting changes

1. Fork the repository and create a branch from `main`
2. Make your changes — keep PRs focused on a single concern
3. Run `npm test` and ensure all tests pass; run `npm run test:e2e` if you touched the popup UI or background sync logic
4. Build for both targets (`npm run build:chrome && npm run build:firefox`) and test manually
5. Open a pull request with a clear description of what changed and why

Please do not add dependencies, new permissions, or features outside the v1 scope without opening an issue for discussion first.
