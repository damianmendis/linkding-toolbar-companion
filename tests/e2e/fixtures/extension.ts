/**
 * Playwright fixtures for loading the real built extension.
 *
 * Notes on why this looks the way it does:
 *
 * - Headless Chromium doesn't fully expose chrome.* APIs to extensions in
 *   this environment, so the context is launched headed (needs a display --
 *   `xvfb-run` in CI/Docker).
 * - Playwright has no supported way to click a real toolbar action icon
 *   and capture the resulting MV3 popup, so `openPopup()` below navigates
 *   directly to the popup's own page as a normal tab. This is faithful for
 *   almost everything the popup does, with one known gap: getActiveTab()
 *   (used to prefill the "save current page" form) will see the popup tab
 *   itself rather than a real preceding page, since opening the popup this
 *   way makes it "the active tab" -- which never happens for a real
 *   browser-action popup. Tests should not assert on prefilled values.
 * - The extension declares its Linkding server host as an *optional*
 *   permission normally (see manifest.json), granted at runtime through a
 *   native Chrome permission prompt that Playwright cannot drive. To seed
 *   settings without that prompt, the mock server's origin is added to a
 *   throwaway copy of the built manifest as a *mandatory* host permission
 *   before loading it -- this only affects the test copy, never the
 *   shipped manifest.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startMockServer, type MockServer } from './mock-server';
import type { Settings } from '../../../src/lib/types';

const DIST_CHROME = path.resolve(__dirname, '../../../dist-chrome');

const DEFAULT_SETTINGS: Settings = {
  serverUrl: '',
  apiToken: 'test-token',
  openMode: 'new-tab',
  recentCount: 20,
  autoRefreshEnabled: false,
  autoRefreshMinutes: 5,
};

function prepareExtensionDir(mockOrigin: string): string {
  if (!fs.existsSync(DIST_CHROME)) {
    throw new Error(`${DIST_CHROME} does not exist -- run "npm run build:chrome" before the E2E suite.`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkding-e2e-'));
  fs.cpSync(DIST_CHROME, dir, { recursive: true });

  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.host_permissions = [...(manifest.host_permissions ?? []), `${mockOrigin}/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return dir;
}

export interface Fixtures {
  mockServer: MockServer;
  context: BrowserContext;
  extensionId: string;
  seedSettings: (overrides?: Partial<Settings>) => Promise<void>;
  openPopup: () => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // Playwright requires the destructuring pattern even with no dependencies.
  // eslint-disable-next-line no-empty-pattern
  mockServer: async ({}, use) => {
    const server = await startMockServer();
    await use(server);
    await server.close();
  },

  context: async ({ mockServer }, use) => {
    const extDir = prepareExtensionDir(mockServer.origin);
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extDir}`,
        `--load-extension=${extDir}`,
      ],
    });
    await use(context);
    await context.close();
    fs.rmSync(extDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(new URL(sw.url()).host);
  },

  seedSettings: async ({ context, extensionId, mockServer }, use) => {
    await use(async (overrides = {}) => {
      const settings: Settings = { ...DEFAULT_SETTINGS, serverUrl: mockServer.origin, ...overrides };
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/index.html`);
      await page.evaluate((s) => chrome.storage.local.set({ settings: s }), settings);
      // The extension only syncs on install, on the periodic alarm, or when
      // a view explicitly asks for it -- none of which happen just from
      // writing settings directly to storage. Trigger a real sync through
      // the same message the options/popup UI sends, so the mock server's
      // seeded bookmarks are actually in the cache tests read from.
      await page.evaluate(() => chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' }));
      await page.close();
    });
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
      return page;
    });
  },
});

export { expect } from '@playwright/test';
export { makeApiBookmark } from './mock-server';
