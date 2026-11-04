// Captures raw (native-size) screenshots of the built extension against an
// in-memory mock Linkding server, seeded with a realistic bookmark set.
// Run inside the Playwright container; see README.md in this folder.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DIST_CHROME = '/app/dist-chrome';
const OUT_RAW = path.join(process.env.SHOTS_OUT ?? '/out', 'raw');

const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

const BOOKMARKS = [
  {
    id: 1, url: 'https://react.dev/reference/rsc/server-components', title: 'Understanding React Server Components',
    description: '', notes: '', tag_names: ['react', 'frontend'], is_archived: false, unread: true, shared: false,
    is_owner: true, date_added: hoursAgo(1), date_modified: hoursAgo(1),
  },
  {
    id: 2, url: 'https://docs.docker.com/compose/networking/', title: 'Docker Compose networking, explained',
    description: '', notes: 'Good diagram of network modes near the end.', tag_names: ['docker', 'devops'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(5), date_modified: hoursAgo(5),
  },
  {
    id: 3, url: 'https://www.typescriptlang.org/docs/handbook/intro.html', title: 'The TypeScript Handbook',
    description: '', notes: '', tag_names: ['typescript', 'reference'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(9), date_modified: hoursAgo(9),
  },
  {
    id: 4, url: 'https://www.postgresql.org/docs/current/using-explain.html', title: 'Postgres EXPLAIN ANALYZE cheat sheet',
    description: '', notes: '', tag_names: ['postgres', 'sql', 'performance'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(14), date_modified: hoursAgo(14),
  },
  {
    id: 5, url: 'https://developer.okta.com/blog/2019/05/01/is-the-oauth-implicit-flow-dead', title: 'A practical guide to OAuth2 flows',
    description: '', notes: '', tag_names: ['security', 'oauth'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(20), date_modified: hoursAgo(20),
  },
  {
    id: 6, url: 'https://cssgridgarden.com/', title: 'CSS Grid Garden',
    description: '', notes: '', tag_names: ['css', 'learning'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(30), date_modified: hoursAgo(30),
  },
  {
    id: 7, url: 'https://github.com/sissbruecker/linkding', title: 'Linkding — self-hosted bookmark manager',
    description: '', notes: '', tag_names: ['self-hosted', 'bookmarks'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(40), date_modified: hoursAgo(40),
  },
  {
    id: 8, url: 'https://fly.io/blog/all-in-on-sqlite-litestream/', title: 'Why we went all-in on SQLite',
    description: '', notes: '', tag_names: ['databases', 'architecture'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(50), date_modified: hoursAgo(50),
  },
  {
    id: 9, url: 'https://docs.docker.com/build/building/multi-stage/', title: 'Multi-stage Docker builds',
    description: '', notes: '', tag_names: ['docker', 'devops'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(60), date_modified: hoursAgo(60),
  },
  {
    id: 10, url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html', title: 'nginx proxy_pass and forwarded headers',
    description: '', notes: '', tag_names: ['nginx', 'self-hosted'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(72), date_modified: hoursAgo(72),
  },
  {
    id: 11, url: 'https://docs.docker.com/engine/security/rootless/', title: 'Run the Docker daemon as a non-root user',
    description: '', notes: '', tag_names: ['docker', 'security'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(80), date_modified: hoursAgo(80),
  },
  {
    id: 12, url: 'https://web.dev/articles/vitals', title: 'Web Vitals: the metrics that matter',
    description: '', notes: '', tag_names: ['performance', 'frontend'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(96), date_modified: hoursAgo(96),
  },
  {
    id: 13, url: 'https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/', title: 'An interactive guide to Flexbox',
    description: '', notes: '', tag_names: ['css', 'learning'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(110), date_modified: hoursAgo(110),
  },
  {
    id: 14, url: 'https://github.com/docker/awesome-compose', title: 'Awesome Compose: sample Docker Compose apps',
    description: '', notes: '', tag_names: ['docker', 'examples'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(130), date_modified: hoursAgo(130),
  },
  {
    id: 15, url: 'https://tailscale.com/kb/1019/subnets', title: 'Tailscale subnet routers',
    description: '', notes: '', tag_names: ['networking', 'tailscale'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(150), date_modified: hoursAgo(150),
  },
  {
    id: 16, url: 'https://jvns.ca/blog/2025/02/13/how-to-add-a-directory-to-your-path/', title: 'How to add a directory to your PATH',
    description: '', notes: '', tag_names: ['linux', 'shell'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(170), date_modified: hoursAgo(170),
  },
  {
    id: 17, url: 'https://www.sqlite.org/wal.html', title: 'SQLite write-ahead logging',
    description: '', notes: '', tag_names: ['databases', 'sqlite'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(190), date_modified: hoursAgo(190),
  },
  {
    id: 18, url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS', title: 'Cross-Origin Resource Sharing (CORS)',
    description: '', notes: '', tag_names: ['http', 'security'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(210), date_modified: hoursAgo(210),
  },
  {
    id: 19, url: 'https://kubernetes.io/docs/concepts/services-networking/service/', title: 'Kubernetes Services, explained',
    description: '', notes: '', tag_names: ['kubernetes', 'devops'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(240), date_modified: hoursAgo(240),
  },
  {
    id: 20, url: 'https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu', title: 'Install and use Docker Compose on Ubuntu',
    description: '', notes: '', tag_names: ['docker', 'linux'], is_archived: false, unread: false, shared: false,
    is_owner: true, date_added: hoursAgo(260), date_modified: hoursAgo(260),
  },
];

function paginated(results) {
  return { count: results.length, next: null, previous: null, results };
}

function startMockServer(bookmarks) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://mock-linkding');
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.method === 'GET' && url.pathname === '/api/bookmarks/') {
        return send(200, paginated(bookmarks.filter((b) => !b.is_archived)));
      }
      if (req.method === 'GET' && url.pathname === '/api/bookmarks/archived/') {
        return send(200, paginated([]));
      }
      if (req.method === 'GET' && url.pathname === '/api/tags/') {
        const names = [...new Set(bookmarks.flatMap((b) => b.tag_names))];
        return send(200, paginated(names.map((name, i) => ({ id: i + 1, name, date_added: new Date().toISOString() }))));
      }
      send(404, { detail: 'Not found.' });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}`, server });
    });
  });
}

function prepareExtensionDir(mockOrigin) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkding-shot-'));
  fs.cpSync(DIST_CHROME, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.host_permissions = [...(manifest.host_permissions ?? []), `${mockOrigin}/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

async function main() {
  fs.mkdirSync(OUT_RAW, { recursive: true });

  const { origin: mockOrigin, server } = await startMockServer(BOOKMARKS);
  const extDir = prepareExtensionDir(mockOrigin);

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extensionId = new URL(sw.url()).host;

  const settings = {
    serverUrl: mockOrigin,
    apiToken: 'demo-token',
    openMode: 'new-tab',
    recentCount: 20,
    autoRefreshEnabled: true,
    autoRefreshMinutes: 15,
  };

  const seedPage = await context.newPage();
  await seedPage.goto(`chrome-extension://${extensionId}/options/index.html`);
  await seedPage.evaluate((s) => chrome.storage.local.set({ settings: s }), settings);
  await seedPage.evaluate(() => chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' }));
  await seedPage.waitForTimeout(500);
  await seedPage.close();

  // ── 1: main list view ────────────────────────────────────────────────────
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.waitForTimeout(400);
  await popup.screenshot({ path: `${OUT_RAW}/01-list.png` });

  // ── 2: instant search ────────────────────────────────────────────────────
  const searchBox = popup.getByPlaceholder('Search bookmarks…');
  await searchBox.fill('docker');
  await popup.waitForTimeout(200);
  await popup.screenshot({ path: `${OUT_RAW}/02-search.png` });
  await searchBox.fill('');
  await popup.waitForTimeout(150);

  // ── 3: save current page (the top-bar + button) ─────────────────────────
  // The popup runs here as a normal tab, so there's no active page to
  // pre-fill from; fill in what activeTab would provide in real use.
  await popup.getByRole('button', { name: 'Add bookmark' }).click();
  await popup.waitForTimeout(200);
  await popup.fill('#add-url', 'https://tailscale.com/blog/how-nat-traversal-works');
  await popup.fill('#add-title', 'How NAT traversal works');
  await popup.fill('#add-tags', 'networking, tailscale');
  await popup.waitForTimeout(100);
  await popup.screenshot({ path: `${OUT_RAW}/03-save.png` });
  await popup.getByRole('button', { name: 'Back' }).click();
  await popup.waitForTimeout(200);

  // ── 4: edit bookmark ─────────────────────────────────────────────────────
  await popup.getByRole('button', { name: 'Edit bookmark: Docker Compose networking, explained' }).click({ force: true });
  await popup.waitForTimeout(200);
  await popup.screenshot({ path: `${OUT_RAW}/04-edit.png` });
  await popup.close();

  // ── 5: settings / connected ──────────────────────────────────────────────
  const options = await context.newPage();
  await options.setViewportSize({ width: 760, height: 760 });
  await options.goto(`chrome-extension://${extensionId}/options/index.html`);
  await options.waitForTimeout(300);
  await options.getByRole('button', { name: 'Test connection' }).click();
  await options.waitForTimeout(400);
  // Cosmetic only: swap the mock server's 127.0.0.1:<port> for a realistic-
  // looking domain in the screenshot, after the (real) connection test has
  // already succeeded against the mock server.
  await options.fill('#server-url', 'https://links.example.com');
  await options.locator('#server-url').blur();
  await options.screenshot({ path: `${OUT_RAW}/05-options.png` });
  await options.close();

  await context.close();
  fs.rmSync(extDir, { recursive: true, force: true });
  server.close();

  console.log('Raw screenshots written to', OUT_RAW);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
