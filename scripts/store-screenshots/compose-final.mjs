// Composites the raw popup/options screenshots into 1280x800 store-ready
// marketing screenshots: a lightweight browser-chrome mockup + caption,
// using the extension's own color/type tokens for brand consistency.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = process.env.SHOTS_OUT ?? '/out';
const RAW = path.join(OUT, 'raw');
const FINAL = path.join(OUT, 'final');
const ICON = '/app/public/assets/icon-48.png';

fs.mkdirSync(FINAL, { recursive: true });

const TOKENS = {
  accent: '#2563eb',
  text: '#1a1d23',
  textSecondary: '#6b7280',
  border: '#e4e6eb',
  bg: '#f7f8fa',
  font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
};

function popupFrameHtml({ eyebrow, headline, subtext, tabTitle, url, rawImage, popupWidth = 400, popupHeight = 600, scale = 0.82 }) {
  const w = Math.round(popupWidth * scale);
  const h = Math.round(popupHeight * scale);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html,body { margin:0; width:1280px; height:800px; font-family:${TOKENS.font}; background:
      radial-gradient(1100px 500px at 15% -10%, rgba(37,99,235,0.06), transparent 60%), ${TOKENS.bg}; }
    .wrap { padding: 72px 96px 0; }
    .eyebrow { font-size:13px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:${TOKENS.accent}; }
    .headline { font-size:38px; font-weight:800; color:${TOKENS.text}; margin:10px 0 0; max-width:760px; line-height:1.15; }
    .subtext { font-size:17px; color:${TOKENS.textSecondary}; margin:12px 0 0; max-width:600px; line-height:1.5; }
    .stage { margin: 44px auto 0; width: 940px; position: relative; }
    .browser { width: 940px; border-radius: 12px; overflow: hidden; background:#fff;
      box-shadow: 0 40px 70px -30px rgba(26,29,35,0.28), 0 0 0 1px rgba(15,17,21,0.06); }
    .tabbar { height:34px; background:#e7e9ee; display:flex; align-items:flex-end; padding:0 10px; gap:4px; }
    .tab { background:#fff; border-radius:8px 8px 0 0; padding:7px 16px 7px 10px; font-size:12px; color:#3c4043;
      display:flex; align-items:center; gap:7px; max-width:260px; }
    .tab .favicon { width:11px; height:11px; border-radius:3px; background:#9ca3af; flex-shrink:0; }
    .toolbar { height:50px; background:#fff; border-bottom:1px solid ${TOKENS.border}; display:flex; align-items:center; padding:0 14px; gap:10px; }
    .navdots { display:flex; gap:6px; padding-right:6px; }
    .navdots span { width:7px; height:7px; border-radius:50%; background:#d5d8dd; display:block; }
    .address { flex:1; height:30px; background:#f1f3f4; border-radius:15px; display:flex; align-items:center;
      padding:0 14px; font-size:13px; color:#3c4043; gap:7px; }
    .address .lock { opacity:0.55; font-size:11px; }
    .exticons { display:flex; align-items:center; gap:5px; margin-left:8px; }
    .slot { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; }
    .slot .dot { width:15px; height:15px; border-radius:4px; background:#d7dae0; }
    .slot.active { background:#e8f0fe; }
    .slot.active img { width:20px; height:20px; display:block; }
    .page { position:relative; height: 540px; background:#fbfbfc; padding:38px 44px; }
    .ph { height:12px; background:#eaecf0; border-radius:4px; margin-bottom:15px; }
    .popup-shell { position:absolute; top:58px; right:26px; z-index:5; }
    .pointer { position:absolute; top:-7px; right:20px; width:14px; height:14px; background:#fff;
      transform:rotate(45deg); box-shadow:-2px -2px 4px rgba(15,17,21,0.04); border-radius:2px; }
    .popup-img { position:relative; width:${w}px; height:${h}px; border-radius:9px; overflow:hidden;
      box-shadow: 0 18px 38px -12px rgba(15,17,21,0.35), 0 0 0 1px rgba(15,17,21,0.08); background:#fff; }
    .popup-img img { width:100%; height:100%; display:block; }
  </style></head><body>
    <div class="wrap">
      <div class="eyebrow">${eyebrow}</div>
      <div class="headline">${headline}</div>
      <div class="subtext">${subtext}</div>
      <div class="stage">
        <div class="browser">
          <div class="tabbar"><div class="tab"><span class="favicon"></span>${tabTitle}</div></div>
          <div class="toolbar">
            <div class="navdots"><span></span><span></span><span></span></div>
            <div class="address"><span class="lock">🔒</span>${url}</div>
            <div class="exticons">
              <div class="slot"><span class="dot"></span></div>
              <div class="slot"><span class="dot"></span></div>
              <div class="slot active"><img src="${ICON}"></div>
            </div>
          </div>
          <div class="page">
            <div class="ph" style="width:62%"></div>
            <div class="ph" style="width:88%"></div>
            <div class="ph" style="width:74%"></div>
            <div class="ph" style="width:81%"></div>
            <div class="ph" style="width:45%"></div>
          </div>
        </div>
        <div class="popup-shell">
          <div class="popup-img"><div class="pointer"></div><img src="${rawImage}"></div>
        </div>
      </div>
    </div>
  </body></html>`;
}

function optionsFrameHtml({ eyebrow, headline, subtext, rawImage }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html,body { margin:0; width:1280px; height:800px; font-family:${TOKENS.font}; background:
      radial-gradient(1100px 500px at 85% -10%, rgba(37,99,235,0.06), transparent 60%), ${TOKENS.bg}; }
    .wrap { padding: 72px 96px 0; }
    .eyebrow { font-size:13px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:${TOKENS.accent}; }
    .headline { font-size:38px; font-weight:800; color:${TOKENS.text}; margin:10px 0 0; max-width:760px; line-height:1.15; }
    .subtext { font-size:17px; color:${TOKENS.textSecondary}; margin:12px 0 0; max-width:600px; line-height:1.5; }
    .stage { margin: 40px auto 0; width: 760px; }
    .browser { width: 760px; border-radius: 12px; overflow: hidden; background:#fff;
      box-shadow: 0 40px 70px -30px rgba(26,29,35,0.28), 0 0 0 1px rgba(15,17,21,0.06); }
    .toolbar { height:50px; background:#fff; border-bottom:1px solid ${TOKENS.border}; display:flex; align-items:center; padding:0 16px; gap:10px; }
    .navdots { display:flex; gap:6px; padding-right:6px; }
    .navdots span { width:7px; height:7px; border-radius:50%; background:#d5d8dd; display:block; }
    .address { flex:1; height:30px; background:#f1f3f4; border-radius:15px; display:flex; align-items:center;
      padding:0 14px; font-size:13px; color:#3c4043; gap:7px; }
    .page img { width:760px; display:block; }
  </style></head><body>
    <div class="wrap">
      <div class="eyebrow">${eyebrow}</div>
      <div class="headline">${headline}</div>
      <div class="subtext">${subtext}</div>
      <div class="stage">
        <div class="browser">
          <div class="toolbar">
            <div class="navdots"><span></span><span></span><span></span></div>
            <div class="address">Linkding Toolbar Companion — Settings</div>
          </div>
          <div class="page"><img src="${rawImage}"></div>
        </div>
      </div>
    </div>
  </body></html>`;
}

const SHOTS = [
  {
    file: '01-list.png', type: 'popup',
    eyebrow: 'YOUR BOOKMARKS', headline: 'All your bookmarks, one shortcut away',
    subtext: "Open the toolbar icon and your recent saves are already there — no need to open the Linkding web app.",
    tabTitle: 'Hacker News', url: 'news.ycombinator.com',
    rawImage: `${RAW}/01-list.png`,
  },
  {
    file: '02-search.png', type: 'popup',
    eyebrow: 'SEARCH', headline: 'Instant search, straight from your cache',
    subtext: 'Every keystroke filters your whole library from a local cache — results appear before a network request could even finish.',
    tabTitle: 'Hacker News', url: 'news.ycombinator.com',
    rawImage: `${RAW}/02-search.png`,
  },
  {
    file: '03-save.png', type: 'popup',
    eyebrow: 'SAVE', headline: 'Save the page you’re on, in one click',
    subtext: 'Click + and the title and URL are already filled in — add tags and notes, and it’s in your Linkding library.',
    tabTitle: 'How NAT traversal works', url: 'tailscale.com/blog/how-nat-traversal-works',
    rawImage: `${RAW}/03-save.png`,
  },
  {
    file: '04-edit.png', type: 'popup',
    eyebrow: 'EDIT', headline: 'Edit without leaving your tab',
    subtext: 'Fix a title, retag, or add a note — right from the popup, without opening the full Linkding app.',
    tabTitle: 'Hacker News', url: 'news.ycombinator.com',
    rawImage: `${RAW}/04-edit.png`,
  },
  {
    file: '05-options.png', type: 'options',
    eyebrow: 'YOUR SERVER, YOUR DATA', headline: 'Point it at your own server. Nothing else.',
    subtext: 'No accounts, no telemetry, no third-party sync — just your self-hosted Linkding instance and your browser.',
    rawImage: `${RAW}/05-options.png`,
  },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  for (const shot of SHOTS) {
    const html = shot.type === 'popup' ? popupFrameHtml(shot) : optionsFrameHtml(shot);
    // setContent() documents have no file:// origin, so local <img> paths
    // silently fail to load (blocked as cross-origin file access). Writing
    // to a real .html file and navigating to it via file:// gives the
    // document its own file:// origin, so local image references resolve.
    const tmpHtml = path.join(FINAL, `.tmp-${shot.file}.html`);
    fs.writeFileSync(tmpHtml, html);
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'load' });
    await page.waitForFunction(() =>
      Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
    );
    const outPath = path.join(FINAL, shot.file);
    await page.screenshot({ path: outPath });
    fs.rmSync(tmpHtml);
    console.log('wrote', outPath);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
