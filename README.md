# Linkding Toolbar Companion

An unofficial, lightweight browser extension for [Linkding](https://github.com/sissbruecker/linkding) — the self-hosted bookmark manager. Search, open, and save bookmarks directly from your toolbar without leaving the page you're on.

> Not affiliated with or endorsed by the Linkding project.

![Version](https://img.shields.io/github/v/release/damianmendis/linkding-toolbar-companion?label=version) ![License](https://img.shields.io/badge/license-MIT-green) ![MV3](https://img.shields.io/badge/manifest-v3-orange) [![Firefox Add-on](https://img.shields.io/amo/v/linkding-toolbar-companion?label=firefox%20add-on&logo=firefoxbrowser)](https://addons.mozilla.org/en-US/firefox/addon/linkding-toolbar-companion/)

---

## What it does

- **Instant search** — filter your bookmarks as you type, from a local cache (no round-trip to your server)
- **Save the current page** — one click to bookmark the tab you're on, with title, URL, tags, and notes pre-filled
- **Edit and delete** — manage bookmarks inline without opening the Linkding web app
- **Works offline** — browse and search your cached bookmarks even when your server is unreachable
- **Keyboard-first** — full keyboard navigation so you rarely need to reach for the mouse
- **Chrome, Edge, and Firefox** — single codebase, packaged separately for each browser

---

## Requirements

- A running [Linkding](https://github.com/sissbruecker/linkding) instance (self-hosted)
- Your Linkding API token (found under **Settings → Integrations → REST API**)
- Chrome 109+, Edge 109+, or Firefox 142+

---

## Installation

### Chrome / Edge

1. Download **[linkding-toolbar-companion-chrome.zip](https://github.com/damianmendis/linkding-toolbar-companion/releases/latest/download/linkding-toolbar-companion-chrome.zip)** (always the latest release)
2. Unzip the file
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder

### Firefox

Install from **[Firefox Add-ons (addons.mozilla.org)](https://addons.mozilla.org/en-US/firefox/addon/linkding-toolbar-companion/)** and click **Add to Firefox**. Updates are installed automatically.

<details>
<summary>Manual install (testing a build from GitHub Releases)</summary>

1. Download **[linkding-toolbar-companion-firefox.zip](https://github.com/damianmendis/linkding-toolbar-companion/releases/latest/download/linkding-toolbar-companion-firefox.zip)** (always the latest release)
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the zip file directly

Temporary add-ons are removed when Firefox restarts.

</details>

---

## Setup

1. Click the Linkding toolbar icon after installing
2. You'll be taken to the **Settings** page on first run
3. Enter your **Server URL** (e.g. `https://bookmarks.example.com`)
4. Enter your **API token**
5. Click **Test Connection** to verify — you should see a green confirmation
6. Click **Save** — the extension syncs your bookmarks immediately

Your settings and bookmark cache are stored locally in your browser. Nothing is sent anywhere except to your own Linkding server.

---

## Quick reference

| Action | How |
|---|---|
| Open popup | Click the toolbar icon |
| Search bookmarks | Type in the search bar |
| Open a bookmark | Click it, or press `Enter` |
| Save current page | Click **+ Save current page** |
| Edit a bookmark | Click the ✏ icon on any row |
| Delete a bookmark | Click the ✏ icon, then **Delete**, and confirm |
| Refresh from server | Click ↻ in the popup header or go to Settings |
| Open settings | Click the ⚙ icon in the popup header |

For the full keyboard shortcut reference and detailed usage guide, see [USAGE.md](USAGE.md).

---

## Permissions

The extension requests only what it needs:

| Permission | Purpose |
|---|---|
| `storage` | Store your settings and bookmark cache locally |
| `activeTab` | Read the URL and title of the current tab when you open the popup, to pre-fill **Save current page** |
| `alarms` | Schedule periodic background cache refresh |
| Host permissions | Requested at runtime, scoped only to the exact origin of your configured Linkding server — granted when you click **Test Connection** or **Save** in Settings |

No telemetry. No analytics. No third-party connections.

---

## Privacy

All data stays between your browser and your Linkding server. The extension does not connect to any external service, does not collect usage data, and does not transmit anything to the extension developer.

---

## Releases

See the [Releases page](https://github.com/damianmendis/linkding-toolbar-companion/releases) for packaged downloads and changelogs.

Current release: **[latest](https://github.com/damianmendis/linkding-toolbar-companion/releases/latest)**

---

## Contributing & development

If you'd like to build from source, run tests, or contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE) for details.
