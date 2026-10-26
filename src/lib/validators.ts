// Names that only resolve inside a local network (RFC 6762 .local, RFC 8375
// .home.arpa, ICANN-reserved .internal, and the common router default .lan).
const LOCAL_SUFFIXES = ['.local', '.lan', '.home.arpa', '.internal'];

/**
 * True if `hostname` (as returned by URL#hostname) is a loopback, private-
 * network, shared-address (CGNAT/Tailscale), link-local, or local-only name
 * -- the kind of host a self-hosted Linkding instance on a home/office LAN
 * or tailnet is typically reached at, where plain HTTP doesn't cross the
 * open internet and a TLS certificate usually isn't available.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  // IPv6 unique local addresses (fc00::/7, i.e. fc.. or fd.. prefixes)
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true;
  // IPv6 link-local (fe80::/10)
  if (/^\[?fe[89ab][0-9a-f]:/i.test(host)) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true; // loopback (127.0.0.0/8)
    if (a === 10) return true; // private (10.0.0.0/8)
    if (a === 172 && b >= 16 && b <= 31) return true; // private (172.16.0.0/12)
    if (a === 192 && b === 168) return true; // private (192.168.0.0/16)
    if (a === 169 && b === 254) return true; // link-local (169.254.0.0/16)
    if (a === 100 && b >= 64 && b <= 127) return true; // shared/CGNAT, Tailscale (100.64.0.0/10)
    return false;
  }

  // A single-label name ("nas", "linkding") can only resolve through local
  // DNS or the hosts file. IPv6 literals contain ':' and are handled above.
  if (!host.includes('.') && !host.includes(':')) return true;

  return false;
}

/**
 * Validates and normalizes a Linkding server URL.
 * Returns normalized URL (trailing slash removed) or throws descriptive error.
 */
export function validateServerUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Server URL is required.');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Server URL is not a valid URL. Example: https://links.example.com');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Server URL must use http or https.');
  }

  // Require HTTPS unless we're in dev mode, or the host is on a local/
  // private network (LAN self-hosting is the common case here, and those
  // servers are rarely fronted by a TLS certificate).
  if (url.protocol === 'http:' && !isDev() && !isPrivateOrLocalHost(url.hostname)) {
    throw new Error(
      'Server URL must use HTTPS, unless it points to a local network address (localhost, a private or Tailscale IP, a single-word hostname, or a .local, .lan, .home.arpa or .internal name).'
    );
  }

  // Normalize: remove trailing slash
  return trimmed.replace(/\/$/, '');
}

/**
 * True for http(s) URLs -- the only kind the popup opens. Browsers already
 * refuse javascript: URLs in tabs.create/update, but a bookmark's URL comes
 * from the server, so check explicitly rather than rely on that.
 */
export function isWebUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parses a whole-number settings field, keeping the raw text until save so
 * the input can be cleared and retyped without snapping back to a default.
 */
export function validateWholeNumber(raw: string, label: string, min: number, max: number): number {
  const trimmed = raw.trim();
  const n = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!(n >= min && n <= max)) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

export function validateApiToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('API token is required.');
  return trimmed;
}

export function isDev(): boolean {
  // Vite replaces import.meta.env.DEV at build time
  try {
    return (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  } catch {
    return false;
  }
}
