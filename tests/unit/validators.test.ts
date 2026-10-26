import { describe, it, expect } from 'vitest';
import { validateServerUrl, validateApiToken, isPrivateOrLocalHost, isWebUrl } from '../../src/lib/validators';

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
