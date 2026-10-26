# Usage Guide

This guide covers everything you need to get the most out of the Linkding Browser Extension day-to-day.

---

## Contents

- [Opening the popup](#opening-the-popup)
- [Searching bookmarks](#searching-bookmarks)
- [Saving the current page](#saving-the-current-page)
- [Editing a bookmark](#editing-a-bookmark)
- [Deleting a bookmark](#deleting-a-bookmark)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Cache and sync](#cache-and-sync)
- [Troubleshooting](#troubleshooting)

---

## Opening the popup

Click the **Linkding icon** in your browser toolbar. If the icon isn't visible, it may be in the browser's extension overflow menu (the puzzle-piece icon in Chrome/Edge).

The popup opens instantly and shows your most recently synced bookmarks. No network call is needed to display the list — it renders from a local cache.

---

## Searching bookmarks

Start typing in the search bar at the top of the popup. Results filter in real time across:

- **Title**
- **URL**
- **Description / notes**
- **Tags**

Matching is case-insensitive. The search runs entirely against the local cache — there is no delay waiting for a server response.

**Filtering by an exact tag:** type `#` followed by a tag name (e.g. `#docker`) to show only bookmarks carrying that exact tag, instead of a fuzzy match across title/URL/notes. Clicking a tag chip on any bookmark does this automatically.

**Other filters** (matching Linkding's own search syntax):

| Type this | Shows |
|---|---|
| `!unread` | Only unread bookmarks |
| `!shared` | Only shared bookmarks |
| `!archived` | Only archived bookmarks |
| `!untagged` | Only bookmarks with no tags |

Archived bookmarks are excluded from every other view (search, tag filters, and the default "Recent bookmarks" list) — `!archived` is the only way to see them, same as Linkding's own default list.

**To clear the search:** press `Esc` or click the ✕ button in the search bar.

**To focus the search bar from anywhere in the popup:** press `/`.

---

## Saving the current page

1. Navigate to the page you want to bookmark
2. Open the popup
3. Click **+ Save current page** at the bottom of the popup
4. An edit form opens, pre-filled with the page title and URL
5. Optionally add or edit:
   - **Title** — defaults to the page's `<title>`
   - **Tags** — space-separated, e.g. `dev tools reference`
   - **Notes** — free-text description
6. Click **Save**

The bookmark is sent to your Linkding server immediately and added to the local cache.

---

## Editing a bookmark

1. Hover over any bookmark row in the popup
2. Click the **✏ (edit) icon** that appears on the right
3. Modify title, URL, tags, or notes in the form that opens
4. Click **Save** to confirm, or **Cancel** to discard

Changes are pushed to your Linkding server and reflected in the cache immediately.

---

## Deleting a bookmark

1. Hover over any bookmark row
2. Click the **✏ (edit) icon** that appears on the right
3. Click **Delete** in the edit form
4. A confirmation dialog appears — click **Delete** to confirm

Deletion is sent to your Linkding server and the bookmark is removed from the local cache.

---

## Keyboard shortcuts

### In the popup

| Key | Action |
|---|---|
| `/` | Focus the search bar |
| `↑` / `↓` | Move between bookmark results |
| `Enter` | Open the focused bookmark |
| `Esc` | Clear search / close any open form |

### Navigating bookmarks

Bookmarks open in the **current tab** by default. To open in a new tab, use `Ctrl+Enter` (`Cmd+Enter` on Mac) when a bookmark is focused, or middle-click the bookmark row.

---

## Settings

Access settings by clicking the **⚙ icon** in the popup header, or by right-clicking the toolbar icon and selecting **Options** (browser-dependent).

### Server URL

The full URL of your Linkding instance, including the scheme. Examples:

```
https://bookmarks.example.com
http://localhost:9090
http://192.168.1.100:9090
```

Do not include a trailing slash or path segments.

### API Token

Your personal Linkding API token. To find it:

1. Log in to your Linkding instance
2. Go to **Settings → Integrations**
3. Copy the token from the **REST API** section

The token is stored only in your local browser storage (`browser.storage.local`) and is never transmitted anywhere except to your own Linkding server.

### Test Connection

Clicking **Test Connection** sends a single authenticated request to your server to verify the URL and token are correct. You'll see:

- ✅ **Connected** — credentials are valid, you're good to go
- ❌ **Failed** — check the URL and token, and that your server is reachable from the browser

### Save

Saves your settings and triggers an immediate sync of all your bookmarks.

---

## Cache and sync

The extension maintains a local cache of your Linkding bookmarks in `browser.storage.local`. This is what the popup searches and displays.

### When does the cache update?

| Trigger | Behaviour |
|---|---|
| Saving settings | Full sync immediately on first setup, or when the server URL or API token changes |
| Clicking ↻ in the popup | Full sync immediately |
| Background alarm | Periodic sync every 5 minutes by default while the browser is open (adjustable from 1 to 60 minutes, or turned off, under **Settings → Sync**). Fetches only changed bookmarks, with a full sync at least once a day to pick up deletions |
| Creating a bookmark | New bookmark added to cache immediately |
| Editing a bookmark | Cache updated immediately |
| Deleting a bookmark | Removed from cache immediately |

### Offline mode

If your Linkding server is unreachable, the popup still loads from the local cache. Searches work normally. Any create, edit, or delete actions will fail with an error message — those require a live server connection.

### Clearing the cache

Go to **Settings** and click **Clear cache**. This removes all locally stored bookmarks. The cache is repopulated the next time a sync runs.

---

## Troubleshooting

### The popup shows "No bookmarks" or an empty list

- Open **Settings** and click **Test Connection** — confirm the server URL and token are correct
- Click **↻** to force a manual sync
- Check that your Linkding server is reachable from your browser (try opening the server URL directly)

### "Test Connection" fails with a network error

- Verify the server URL is correct and includes the scheme (`https://` or `http://`)
- If your server uses a self-signed certificate, your browser may be blocking the request — visit the server URL directly in a tab and accept the certificate warning first
- Check that the extension has host permissions for your server (this should be automatic for `https://` and `http://localhost`)

### Changes I made on the Linkding web app aren't showing in the extension

The cache syncs automatically every 5 minutes by default (you can change the interval under **Settings → Sync**), or immediately when you trigger a manual sync (↻ button). If you need the latest state right away, click ↻.

### The extension was working, then stopped connecting after a server change

If you changed your server URL, token, or SSL certificate, go to **Settings**, update the details, click **Test Connection**, then **Save**.

### Firefox: extension disappears after browser restart

You installed it as a temporary add-on from `about:debugging`, which Firefox removes on every restart. For a permanent install that also updates automatically, install it from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/linkding-toolbar-companion/) instead.

---

For installation and setup instructions, see the [README](README.md).  
For building from source or contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).
