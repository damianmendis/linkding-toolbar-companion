# Store screenshots

Regenerates the five 1280×800 store screenshots in `docs/screenshots/`.

- `capture-raw.mjs` loads the built Chrome extension against an in-memory
  mock Linkding server with a seeded, made-up bookmark set and captures the
  popup and settings page at native size.
- `compose-final.mjs` frames each capture in a simple browser mockup with a
  caption.

Run from the repo root (no host Node needed):

```sh
docker run --rm --init --ipc=host -v "$PWD":/app -w /app \
  -v "$PWD/.shots":/out mcr.microsoft.com/playwright:v1.64.1-noble bash -c '
    npm ci && npm run build:chrome &&
    xvfb-run -a node scripts/store-screenshots/capture-raw.mjs &&
    node scripts/store-screenshots/compose-final.mjs'
cp .shots/final/*.png docs/screenshots/ && rm -rf .shots
```

Match the image tag to the `@playwright/test` version in `package.json`.
