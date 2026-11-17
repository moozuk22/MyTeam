import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { hasTrustedOrigin } from './requestOrigin';
afterEach(() => vi.unstubAllEnvs());
function request(origin?: string) {
  return new NextRequest('http://localhost/api/test', { headers: origin ? { origin, 'x-forwarded-host': 'evil.example' } : {} });
}
it.each(['https://evil.example', 'https://myteam7.com.evil.example', 'http://myteam7.com', 'null'])('rejects untrusted origin %s', origin => {
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com/');
  expect(hasTrustedOrigin(request(origin))).toBe(false);
});
it.each(['not-a-url', 'file:///tmp/site'])('fails closed for invalid base URL %s', base => {
  vi.stubEnv('APP_BASE_URL', base);
  expect(hasTrustedOrigin(request('http://localhost'))).toBe(false);
});
it('uses the request origin without a configured public URL', () => {
  vi.stubEnv('APP_BASE_URL', '');
  expect(hasTrustedOrigin(request('http://localhost'))).toBe(true);
  expect(hasTrustedOrigin(request('https://evil.example'))).toBe(false);
});
it('allows absent origins only when the endpoint permits them', () => {
  expect(hasTrustedOrigin(request())).toBe(true);
  expect(hasTrustedOrigin(request(), true)).toBe(false);
});
it('accepts a matching development origin when the configured URL points to production', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com');
  expect(hasTrustedOrigin(request('http://localhost'))).toBe(true);
  expect(hasTrustedOrigin(request('https://evil.example'))).toBe(false);
});
it('keeps the configured public origin authoritative in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com');
  expect(hasTrustedOrigin(request('http://localhost'))).toBe(false);
  expect(hasTrustedOrigin(request('https://myteam7.com'))).toBe(true);
});
it('still fails closed for invalid configuration in development', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_BASE_URL', 'not-a-url');
  expect(hasTrustedOrigin(request('http://localhost'))).toBe(false);
});
it('accepts the browser host in development when Next.js uses an internal URL', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com');
  const req = new NextRequest('http://localhost:3000/api/test', {
    headers: { origin: 'http://172.18.0.2:3000', host: '172.18.0.2:3000' },
  });
  expect(hasTrustedOrigin(req)).toBe(true);
});
it.each(['development', 'production'])('rejects a mismatched origin even with a forwarded host in %s', mode => {
  vi.stubEnv('NODE_ENV', mode);
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com');
  const req = new NextRequest('http://localhost:3000/api/test', {
    headers: { origin: 'https://evil.example', host: '172.18.0.2:3000', 'x-forwarded-host': 'evil.example' },
  });
  expect(hasTrustedOrigin(req)).toBe(false);
});
it('does not trust the browser host in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_BASE_URL', 'https://myteam7.com');
  const req = new NextRequest('http://localhost:3000/api/test', {
    headers: { origin: 'http://172.18.0.2:3000', host: '172.18.0.2:3000' },
  });
  expect(hasTrustedOrigin(req)).toBe(false);
});
