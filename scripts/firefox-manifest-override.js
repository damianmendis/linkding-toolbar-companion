#!/usr/bin/env node
// Applies Firefox-specific manifest fixups to dist-firefox/manifest.json.
// Shared by scripts/package-firefox.sh (before zipping) and
// `npm run lint:firefox` (before linting), so the two never drift apart.
//
// - Firefox ignores background.service_worker entirely, so replace it with
//   background.scripts (the only mechanism Firefox actually runs).
// - browser_specific_settings.gecko.data_collection_permissions needs the
//   {required: [...]} shape (a bare {none: true} fails validation), and is
//   only supported from Firefox 140 / Firefox for Android 142, so
//   strict_min_version must be at least 142.
// - gecko.id looks like a placeholder but is permanent: the published AMO
//   listing is bound to it, and changing it would make Firefox treat new
//   builds as a different add-on (no automatic updates for existing users).
const fs = require('fs');

const manifestPath = 'dist-firefox/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.background.scripts = [manifest.background.service_worker];
delete manifest.background.service_worker;

manifest.browser_specific_settings = {
  gecko: {
    id: 'linkding-toolbar-companion@example.com',
    strict_min_version: '142.0',
    data_collection_permissions: { required: ['none'] },
  },
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
