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
