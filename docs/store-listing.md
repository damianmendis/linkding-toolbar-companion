# Web store listing content

Source copy for the Chrome Web Store and Firefox Add-ons (AMO) submission
forms. Paste directly into the relevant fields; character limits are called
out where the store enforces one. Update the repo URLs throughout if/when
the repo is renamed.

**Status:**

- **Firefox Add-ons (AMO):** live at https://addons.mozilla.org/en-US/firefox/addon/linkding-toolbar-companion/
  (add-on ID `linkding-toolbar-companion@example.com`).
- **Chrome Web Store:** to do (see Still needed before submission below).

---

## Shared identity

- **Name:** Linkding Toolbar Companion
- **Short summary** (Chrome: ≤132 characters):

  > Search, save, and manage your self-hosted Linkding bookmarks from the toolbar. Unofficial, not affiliated with Linkding.

  (120 characters)

- **Homepage / website URL:** https://github.com/damianmendis/linkding-toolbar-companion
- **Support URL:** https://github.com/damianmendis/linkding-toolbar-companion/issues
- **Privacy policy URL:** https://github.com/damianmendis/linkding-toolbar-companion/blob/main/PRIVACY.md
- **License:** MIT

## Full description (both stores)

```
Linkding Toolbar Companion is an unofficial browser extension for Linkding
(https://github.com/sissbruecker/linkding), the popular self-hosted bookmark
manager. It puts your bookmark library one click away from any tab — no need
to open the Linkding web app to find, save, or edit a bookmark.

FEATURES

• Instant search — filter your entire bookmark library as you type, served
  from a local cache so results appear immediately, even before the
  extension finishes syncing with your server.
• Save the current page in one click — title and URL are pre-filled; add
  tags and notes before saving.
• Edit and delete bookmarks inline, without leaving the popup.
• Works offline — your most recent sync stays cached, so you can browse and
  search even if your Linkding server is temporarily unreachable.
• Full keyboard navigation — search, move through results, open, edit, and
  save without touching the mouse.
• Light and dark themes that follow your system setting.
• Available for Chrome, Edge, and Firefox from a single codebase.

REQUIREMENTS

This extension is a client for your own Linkding server — it does not
include or provide bookmark storage of its own. You'll need:

• A running Linkding instance you control (self-hosted or otherwise)
• Your Linkding API token (found under Settings → Integrations → REST API
  in your Linkding instance)

PRIVACY

Your bookmarks, server URL, and API token are stored locally in your browser
and sent only to the Linkding server you configure. This extension uses no
analytics or telemetry, contacts no third-party service, and sends nothing
to the developer. Full privacy policy:
https://github.com/damianmendis/linkding-toolbar-companion/blob/main/PRIVACY.md

Not affiliated with, endorsed by, or sponsored by the Linkding project.
"Linkding" refers to the open-source bookmark manager this extension
connects to.

Source code and issue tracker:
https://github.com/damianmendis/linkding-toolbar-companion
```

## Single purpose description (Chrome — required field)

> Provides toolbar access to search, save, and manage bookmarks stored on
> the user's own self-hosted Linkding server.

## Permission justifications (Chrome — required per permission)

| Permission | Justification text |
|---|---|
| `storage` | Used to store the user's Linkding server URL, API token, extension settings, and a local cache of bookmarks, entirely on-device, so the popup can load instantly and work offline. |
| `activeTab` | Used only when the user clicks "Save current page," to read the URL and title of the active tab so they can be pre-filled into the save form. Not used for any other purpose. |
| `tabs` | Used to open a bookmark in a new tab, or switch to it if it's already open, when the user clicks a search result. |
| `alarms` | Used to schedule a periodic background refresh of the local bookmark cache from the user's configured Linkding server, so the cache stays current between manual syncs. |
| Host permission (`https://*/*`, `http://*/*`, optional/runtime-granted) | Requested at runtime and granted only for the single origin of the Linkding server the user enters in Settings, via the browser's native permission prompt. Needed so the extension can call that server's REST API to sync, save, edit, and delete bookmarks. No other origin is ever requested. |

## Chrome data-usage disclosure (Privacy practices tab)

Chrome's dashboard asks you to declare what user data categories the item
"collects" (their term for *transmitted off the user's device to you or a
third party*) and to certify compliance. Recommended answers based on actual
behavior — **re-check against the current Chrome Web Store policy at
submission time, since this form changes periodically**:

- Data categories collected by the developer: **None.** The extension reads
  and stores an API token and bookmark data, but only to relay it to the
  server the user themselves specified — nothing is transmitted to the
  developer or any third party.
- "Is this data sold to third parties?" **No.**
- "Is this data used for purposes unrelated to the item's core functionality?" **No.**
- "Is this data used to determine creditworthiness or for lending?" **No.**
- Certifications: all should be checkable as-is given the above.

If the Chrome review team pushes back on the "None collected" framing
because the extension does handle an API token, the fallback answer is to
declare **Authentication information** as handled, scoped to "used strictly
for the extension's functionality" and "not sold, not shared" — the
justification text above already supports that framing.

## Categories

- **Chrome Web Store:** Productivity
- **Firefox Add-ons (AMO):** Bookmarks

## Keywords / tags (AMO tags field; also informs Chrome's organic search copy)

linkding, bookmarks, bookmark manager, self-hosted, self hosted, toolbar,
tab search, read later, open source bookmarks, bookmark sync

## Screenshots

Five 1280×800 screenshots in `docs/screenshots/`, ready to upload as-is to
both stores:

| File | Shows |
|---|---|
| `01-list.png` | Recent bookmarks list on popup open |
| `02-search.png` | Instant local search, filtered to one result |
| `03-save.png` | "Save current page" form, pre-filled |
| `04-edit.png` | Inline edit modal |
| `05-options.png` | Settings page, server connected |

Generated against the E2E mock-server harness with a seeded, realistic-
looking bookmark set (not a real user's data), then composited into a
lightweight browser-chrome mockup with a caption, reusing the extension's
own color and type tokens. The one cosmetic liberty: the settings screenshot
shows `https://links.example.com` in place of the mock server's actual
`127.0.0.1:<port>` — the "✓ Connected" badge is real, from an actual
successful test-connection call against the mock server.

## Promo tiles (optional, Chrome only)

Two tiles in `docs/promo/`, ready to upload to the Store Listing tab's
"Promotional images" section:

| File | Size | Use |
|---|---|---|
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee (only shown if Chrome features the listing) |

Same brand system as the screenshots (accent blue, product mark, Archivo
Black / Acumin Pro type pairing). Also exported as an editable 2-slide Adobe
Express document: https://new.express.adobe.com/id/urn:aaid:sc:AP:603f0202-799e-4517-a2e0-b25af3e060f0
— note the marquee slide's decorative search-card mockup lost its small
placeholder bars/chips in that import (plain empty `<div>`s with only a
background color didn't convert to shapes); the PNG above is unaffected and
is the one to actually upload.

## Still needed before submission

- **Chrome:** a Chrome Web Store developer account ($5 one-time
  registration fee) -- needs to be created by you; not something that can
  be done on your behalf.
- **Firefox:** done (see Status at the top). New versions are uploaded to
  the existing AMO listing, with a fresh `npm run package:source` archive
  each time, since the build bundles/minifies.
