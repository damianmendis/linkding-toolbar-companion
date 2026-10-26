/**
 * True if `hostname` (as returned by URL#hostname) is a loopback, private-
 * network, link-local, or mDNS (.local) address -- the kind of host a
 * self-hosted Linkding instance on a home/office LAN is typically reached
 * at, where plain HTTP doesn't cross the open internet and a TLS
 * certificate usually isn't available.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (host.endsWith('.local')) return true;

  // IPv6 unique local addresses (fc00::/7, i.e. fc.. or fd.. prefixes)
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true; // loopback (127.0.0.0/8)
    if (a === 10) return true; // private (10.0.0.0/8)
    if (a === 172 && b >= 16 && b <= 31) return true; // private (172.16.0.0/12)
    if (a === 192 && b === 168) return true; // private (192.168.0.0/16)
    if (a === 169 && b === 254) return true; // link-local (169.254.0.0/16)
    return false;
  }

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
      'Server URL must use HTTPS, unless it points to a local network address (localhost, a private IP, or a .local hostname).'
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
