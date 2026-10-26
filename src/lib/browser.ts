/**
 * Browser abstraction layer.
 *
 * All extension API calls go through this module so browser-specific
 * differences are isolated here and React components stay clean.
 */
import browser from 'webextension-polyfill';
import type { Settings, CacheState, BgRequest, BgResponse } from './types';
import { STORAGE_KEYS } from './types';
import { isWebUrl } from './validators';

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<Settings | null> {
  const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
  return (result[STORAGE_KEYS.SETTINGS] as Settings) ?? null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

export async function loadCache(): Promise<CacheState | null> {
  const result = await browser.storage.local.get(STORAGE_KEYS.CACHE);
  return (result[STORAGE_KEYS.CACHE] as CacheState) ?? null;
}

export async function saveCache(cache: CacheState): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEYS.CACHE]: cache });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/quota/i.test(raw)) {
      throw new Error(
        'Bookmark cache is too large for the browser\'s local storage limit (about 10MB). ' +
        'This usually means a very large bookmark library, possibly with long notes or ' +
        'descriptions. The extension currently caches every bookmark in full; trimming ' +
        'notes/descriptions on the largest bookmarks in Linkding may help.'
      );
    }
    throw err;
  }
}

export async function clearCache(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.CACHE);
}

// ─── Background messaging ─────────────────────────────────────────────────────
//
// All Linkding API calls are routed through the service worker to avoid CORS.

export async function sendToBackground<T>(
  request: BgRequest
): Promise<BgResponse<T>> {
  const response = await browser.runtime.sendMessage(request);
  return response as BgResponse<T>;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export interface ActiveTabInfo {
  url: string;
  title: string;
}

// No `tabs` permission: the current tab's url/title are readable only
// through activeTab, which the browser grants when the user opens the popup.
// Opening and updating tabs needs no permission at all.
export async function getActiveTab(): Promise<ActiveTabInfo | null> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    const url = tab.url;
    if (url.startsWith('chrome://') || url.startsWith('about:') ||
        url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      return null;
    }
    return { url, title: tab.title ?? '' };
  } catch {
    return null;
  }
}

export async function openUrl(url: string, mode: 'new-tab' | 'current-tab'): Promise<void> {
  if (!isWebUrl(url)) throw new Error('Only http and https bookmarks can be opened.');
  if (mode === 'new-tab') {
    await browser.tabs.create({ url });
  } else {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await browser.tabs.update(tab.id, { url });
    } else {
      await browser.tabs.create({ url });
    }
  }
}

// ─── Alarms ──────────────────────────────────────────────────────────────────

export async function scheduleRefreshAlarm(periodMinutes: number): Promise<void> {
  await browser.alarms.clear('auto-refresh');
  await browser.alarms.create('auto-refresh', {
    delayInMinutes: periodMinutes,
    periodInMinutes: periodMinutes,
  });
}

export async function clearRefreshAlarm(): Promise<void> {
  await browser.alarms.clear('auto-refresh');
}

// ─── Options page ─────────────────────────────────────────────────────────────

export function openOptionsPage(): void {
  browser.runtime.openOptionsPage();
}

// ─── Host permissions ──────────────────────────────────────────────────────────
//
// The Linkding server URL is user-configured and can be any origin, so we
// request host access for just that origin at runtime (see
// optional_host_permissions in manifest.json) instead of declaring a
// blanket host_permissions entry that would grant access to every site.

function originPattern(serverUrl: string): string {
  const { protocol, host } = new URL(serverUrl);
  return `${protocol}//${host}/*`;
}

export async function hasServerPermission(serverUrl: string): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [originPattern(serverUrl)] });
  } catch {
    return false;
  }
}

export async function requestServerPermission(serverUrl: string): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: [originPattern(serverUrl)] });
  } catch {
    return false;
  }
}
