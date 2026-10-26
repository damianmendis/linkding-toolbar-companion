import { describe, it, expect } from 'vitest';
import { validateServerUrl, validateApiToken, isPrivateOrLocalHost, isWebUrl, validateWholeNumber } from '../../src/lib/validators';

describe('validateServerUrl', () => {
  it('accepts valid https URL', () => {
    expect(validateServerUrl('https://links.example.com')).toBe('https://links.example.com');
  });

  it('strips trailing slash', () => {
    expect(validateServerUrl('https://links.example.com/')).toBe('https://links.example.com');
    expect(validateServerUrl('https://links.example.com/path/')).toBe('https://links.example.com/path');
  });

  it('trims whitespace', () => {
    expect(validateServerUrl('  https://links.example.com  ')).toBe('https://links.example.com');
  });

  it('rejects empty string', () => {
    expect(() => validateServerUrl('')).toThrow(/required/i);
  });

  it('rejects invalid URL', () => {
    expect(() => validateServerUrl('not a url')).toThrow(/valid URL/i);
  });

  it('rejects ftp protocol', () => {
    expect(() => validateServerUrl('ftp://example.com')).toThrow(/http/i);
  });

  it('accepts http on local/private hosts', () => {
    expect(validateServerUrl('http://192.168.1.50:9090')).toBe('http://192.168.1.50:9090');
    expect(validateServerUrl('http://localhost:9090')).toBe('http://localhost:9090');
    expect(validateServerUrl('http://linkding.local')).toBe('http://linkding.local');
  });
});

describe('isPrivateOrLocalHost', () => {
  it('accepts localhost and loopback', () => {
    expect(isPrivateOrLocalHost('localhost')).toBe(true);
    expect(isPrivateOrLocalHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('127.5.5.5')).toBe(true);
    expect(isPrivateOrLocalHost('::1')).toBe(true);
  });

  it('accepts private IPv4 ranges', () => {
    expect(isPrivateOrLocalHost('10.1.2.3')).toBe(true);
    expect(isPrivateOrLocalHost('172.16.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('172.31.255.255')).toBe(true);
    expect(isPrivateOrLocalHost('192.168.1.50')).toBe(true);
    expect(isPrivateOrLocalHost('169.254.1.1')).toBe(true);
  });

  it('rejects public IPv4 addresses', () => {
    expect(isPrivateOrLocalHost('8.8.8.8')).toBe(false);
    expect(isPrivateOrLocalHost('172.32.0.1')).toBe(false); // just outside 172.16.0.0/12
    expect(isPrivateOrLocalHost('1.1.1.1')).toBe(false);
  });

  it('accepts .local mDNS hostnames', () => {
    expect(isPrivateOrLocalHost('linkding.local')).toBe(true);
    expect(isPrivateOrLocalHost('homelab.local')).toBe(true);
  });

  it('rejects public hostnames', () => {
    expect(isPrivateOrLocalHost('links.example.com')).toBe(false);
  });
});

describe('validateApiToken', () => {
  it('accepts non-empty token', () => {
    expect(validateApiToken('mytoken123')).toBe('mytoken123');
  });

  it('trims whitespace', () => {
    expect(validateApiToken('  tok  ')).toBe('tok');
  });

  it('rejects empty string', () => {
    expect(() => validateApiToken('')).toThrow(/required/i);
  });
});

describe('isWebUrl', () => {
  it('accepts http and https', () => {
    expect(isWebUrl('https://example.com/a?b=c')).toBe(true);
    expect(isWebUrl('http://192.168.1.5:9090/')).toBe(true);
  });

  it('rejects script, data, file and unparseable URLs', () => {
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('JavaScript:alert(1)')).toBe(false);
    expect(isWebUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isWebUrl('file:///etc/passwd')).toBe(false);
    expect(isWebUrl('not a url')).toBe(false);
  });
});

describe('isPrivateOrLocalHost -- home-network and tailnet addresses', () => {
  it('accepts shared-address space used by Tailscale and CGNAT (100.64.0.0/10)', () => {
    expect(isPrivateOrLocalHost('100.64.0.1')).toBe(true);
    expect(isPrivateOrLocalHost('100.101.102.103')).toBe(true);
    expect(isPrivateOrLocalHost('100.127.255.255')).toBe(true);
    expect(isPrivateOrLocalHost('100.63.255.255')).toBe(false); // just below the range
    expect(isPrivateOrLocalHost('100.128.0.1')).toBe(false); // just above it
  });

  it('accepts IPv6 link-local and unique local addresses', () => {
    expect(isPrivateOrLocalHost('[fe80::1]')).toBe(true);
    expect(isPrivateOrLocalHost('[febf::1]')).toBe(true);
    expect(isPrivateOrLocalHost('[fd12:3456::1]')).toBe(true);
    expect(isPrivateOrLocalHost('[2001:db8::1]')).toBe(false);
  });

  it('accepts local-only names and single-label hostnames', () => {
    for (const host of ['nas.lan', 'links.home.arpa', 'linkding.internal', 'nas', 'linkding']) {
      expect(isPrivateOrLocalHost(host)).toBe(true);
    }
  });

  it('still rejects public names that only contain a local word', () => {
    for (const host of ['lan.example.com', 'internal.example.com', 'example.local.com', 'mylan.com']) {
      expect(isPrivateOrLocalHost(host)).toBe(false);
    }
  });

  // validateServerUrl isn't tested here for these: Vitest builds with
  // import.meta.env.DEV = true, compiled in as a constant, which skips its
  // HTTPS check entirely (see isDev). isPrivateOrLocalHost is the decision
  // that check delegates to, so it carries the coverage.
});

describe('validateWholeNumber', () => {
  it('accepts whole numbers within range', () => {
    expect(validateWholeNumber('1', 'Count', 1, 200)).toBe(1);
    expect(validateWholeNumber(' 200 ', 'Count', 1, 200)).toBe(200);
  });

  it('rejects empty, out-of-range, fractional and non-numeric input', () => {
    for (const raw of ['', '0', '201', '-5', '2.5', '1e2', 'abc']) {
      expect(() => validateWholeNumber(raw, 'Count', 1, 200)).toThrow('Count must be a whole number from 1 to 200.');
    }
  });
});
