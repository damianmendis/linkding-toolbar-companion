/**
 * End-to-end tests against the real built extension (dist-chrome), loaded
 * into a real Chromium instance via Playwright, talking to an in-memory
 * mock Linkding server (tests/e2e/fixtures/mock-server.ts). See
 * tests/e2e/fixtures/extension.ts for the two structural workarounds this
 * suite relies on (headed mode, and navigating to the popup page directly
 * instead of clicking a real toolbar icon).
 *
 * Run: npm run build:chrome && npm run test:e2e
 */
import { test, expect, makeApiBookmark } from './fixtures/extension';

test.describe('Unconfigured state', () => {
  test('shows the connect-your-server screen when no settings exist', async ({ openPopup }) => {
    const popup = await openPopup();
    await expect(popup.getByRole('heading', { name: 'Welcome to Linkding' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Open settings' })).toBeVisible();
  });
});

test.describe('Main view', () => {
  test.beforeEach(async ({ mockServer, seedSettings }) => {
    mockServer.setBookmarks([
      makeApiBookmark({ id: 1, url: 'https://a.example.com', title: 'Alpha Article', tag_names: ['news'], date_added: '2026-01-03T00:00:00Z' }),
      makeApiBookmark({ id: 2, url: `${mockServer.origin}/bravo-page`, title: 'Bravo Post', tag_names: ['docker'], unread: true, date_added: '2026-01-02T00:00:00Z' }),
      makeApiBookmark({ id: 3, url: 'https://c.example.com', title: 'Charlie Notes', tag_names: ['docker'], shared: true, date_added: '2026-01-01T00:00:00Z' }),
      makeApiBookmark({ id: 4, url: 'https://d.example.com', title: 'Delta Archived', is_archived: true, date_added: '2026-01-04T00:00:00Z' }),
    ]);
    await seedSettings();
  });

  test('shows recent, non-archived bookmarks in most-recent-first order', async ({ openPopup }) => {
    const popup = await openPopup();
    const list = popup.getByRole('listbox', { name: 'Bookmarks' });
    await expect(list.getByRole('option')).toHaveCount(3);
    const titles = await list.getByRole('option').allTextContents();
    expect(titles[0]).toContain('Alpha Article');
    expect(titles.join('')).not.toContain('Delta Archived');
  });

  test('free-text search narrows the list', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.getByRole('combobox', { name: 'Search bookmarks' }).fill('Bravo');
    const list = popup.getByRole('listbox', { name: 'Bookmarks' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await expect(list.getByText('Bravo Post')).toBeVisible();
  });

  test('clicking a tag chip filters to an exact tag match', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: 'Filter by tag docker' }).first().click();
    await expect(popup.getByRole('combobox', { name: 'Search bookmarks' })).toHaveValue('#docker');
    const list = popup.getByRole('listbox', { name: 'Bookmarks' });
    await expect(list.getByRole('option')).toHaveCount(2);
  });

  test('!unread modifier filters to unread bookmarks only', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.getByRole('combobox', { name: 'Search bookmarks' }).fill('!unread');
    const list = popup.getByRole('listbox', { name: 'Bookmarks' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await expect(list.getByText('Bravo Post')).toBeVisible();
  });

  test('!archived modifier is the only mode that surfaces archived bookmarks', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.getByRole('combobox', { name: 'Search bookmarks' }).fill('!archived');
    const list = popup.getByRole('listbox', { name: 'Bookmarks' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await expect(list.getByText('Delta Archived')).toBeVisible();
  });

  test('keyboard navigation moves selection and Enter opens the selected row in a new tab', async ({ openPopup, context, mockServer }) => {
    const popup = await openPopup();
    const searchbox = popup.getByRole('combobox', { name: 'Search bookmarks' });
    // Row 0 (Alpha) is selected by default; move down to row 1 (Bravo).
    await searchbox.press('ArrowDown');
    // Opening a bookmark also calls window.close() on the popup. Because
    // this popup page was opened by navigating directly to its URL (see
    // fixtures/extension.ts) rather than via window.open(), it has a
    // single-entry history, which Chrome treats as script-closable -- so
    // the close can race Playwright's own `press()` round-trip and make it
    // reject even though the underlying action (opening the new tab)
    // already succeeded.
    const newTabPromise = context.waitForEvent('page');
    await searchbox.press('Enter').catch(() => {});
    const newTab = await newTabPromise;
    await newTab.waitForLoadState('domcontentloaded').catch(() => {});
    expect(newTab.url()).toContain('/bravo-page');
  });
});

test.describe('Add bookmark view', () => {
  test.beforeEach(async ({ mockServer, seedSettings }) => {
    mockServer.setBookmarks([]);
    await seedSettings();
  });

  test('saving a new bookmark sends it to the server and returns to the list', async ({ openPopup, mockServer }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: 'Save current page to Linkding' }).click();

    await expect(popup.getByText('Save bookmark', { exact: true })).toBeVisible();
    await popup.getByLabel('URL').fill('https://new.example.com/page');
    await popup.getByLabel('Title').fill('A New Bookmark');
    await popup.getByLabel('Tags').fill('reading');
    await popup.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(popup.getByRole('listbox', { name: 'Bookmarks' }).getByText('A New Bookmark')).toBeVisible();
    expect(mockServer.getBookmarks().some((b) => b.url === 'https://new.example.com/page')).toBe(true);
  });

  test('the top-bar add button opens the add view', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: 'Add bookmark', exact: true }).click();
    await expect(popup.getByText('Save bookmark', { exact: true })).toBeVisible();
  });

  test('Escape cancels back to the main view without saving', async ({ openPopup, mockServer }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: 'Save current page to Linkding' }).click();
    await popup.getByLabel('URL').fill('https://should-not-save.example.com');
    await popup.keyboard.press('Escape');
    await expect(popup.getByRole('button', { name: 'Save current page to Linkding' })).toBeVisible();
    expect(mockServer.getBookmarks()).toHaveLength(0);
  });
});

test.describe('Edit bookmark view', () => {
  test.beforeEach(async ({ mockServer, seedSettings }) => {
    mockServer.setBookmarks([
      makeApiBookmark({ id: 1, url: 'https://a.example.com', title: 'Alpha Article', tag_names: ['news'] }),
    ]);
    await seedSettings();
  });

  test('all fields and action buttons are reachable at the popup\'s minimum height', async ({ openPopup }) => {
    // Regression test for the bug this project's E2E work started from:
    // the edit modal used to render with position:fixed content that the
    // popup's auto-sizing (driven by in-flow layout height) ignored
    // entirely, collapsing the whole popup to ~200px with nothing usable.
    const popup = await openPopup();
    await popup.setViewportSize({ width: 400, height: 200 }); // html/body min-height
    await popup.getByRole('button', { name: /^Edit bookmark:/ }).click();

    const dialog = popup.getByRole('dialog', { name: 'Edit bookmark' });
    await expect(dialog).toBeVisible();
    await expect(popup.getByRole('heading', { name: 'Edit bookmark' })).toBeVisible();

    const saveBtn = popup.getByRole('button', { name: 'Save', exact: true });
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Delete', exact: true })).toBeAttached();
  });

  test('editing and saving updates the bookmark on the server', async ({ openPopup, mockServer }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: /^Edit bookmark:/ }).click();
    await popup.getByLabel('Title').fill('Alpha Article (edited)');
    await popup.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(popup.getByRole('listbox', { name: 'Bookmarks' }).getByText('Alpha Article (edited)')).toBeVisible();
    expect(mockServer.getBookmarks()[0].title).toBe('Alpha Article (edited)');
  });

  test('deleting removes the bookmark after confirmation', async ({ openPopup, mockServer }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: /^Edit bookmark:/ }).click();
    await popup.getByRole('button', { name: 'Delete', exact: true }).click();
    await popup.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(popup.getByText('No bookmarks yet.')).toBeVisible();
    expect(mockServer.getBookmarks()).toHaveLength(0);
  });

  test('Cancel closes the modal without saving changes', async ({ openPopup, mockServer }) => {
    const popup = await openPopup();
    await popup.getByRole('button', { name: /^Edit bookmark:/ }).click();
    await popup.getByLabel('Title').fill('Should not persist');
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(popup.getByRole('listbox', { name: 'Bookmarks' }).getByText('Alpha Article')).toBeVisible();
    expect(mockServer.getBookmarks()[0].title).toBe('Alpha Article');
  });

  test('F2 opens the edit modal for the active row without touching a mouse', async ({ openPopup }) => {
    // Regression test: editing/deleting used to be reachable only by
    // clicking the row's pencil button (tabIndex=-1, deliberately out of
    // tab order) -- a pure-keyboard user had no way to trigger it at all.
    const popup = await openPopup();
    await popup.getByRole('combobox', { name: 'Search bookmarks' }).press('F2');

    await expect(popup.getByRole('dialog', { name: 'Edit bookmark' })).toBeVisible();
  });

  test('the active row is exposed to assistive tech via aria-activedescendant', async ({ openPopup }) => {
    const popup = await openPopup();
    const box = popup.getByRole('combobox', { name: 'Search bookmarks' });
    const activeId = await box.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    await expect(popup.locator(`#${activeId}`)).toHaveAttribute('aria-selected', 'true');
  });
});
