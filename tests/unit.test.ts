import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ButtrbaseClient, ButtrbaseError } from '../src/index.js';
import { verifyButtrbaseSignature, signButtrbasePayload } from '../src/webhooks.js';
import { decodeButtrbaseClaims, decodeJwtPayload, claimsToAuthContext } from '../src/verify.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Test helper: build a fake (unsigned) JWT from a JSON payload
// ---------------------------------------------------------------------------
function fakeJwt(payload: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fakesig').toString('base64url');
  return `${header}.${body}.${sig}`;
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(
  status: number,
  body: unknown,
  statusText = '',
  headers: Record<string, string> = {},
) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: () => Promise.resolve(text),
  });
}

function mockNetworkError(message = 'Network error') {
  mockFetch.mockRejectedValueOnce(new Error(message));
}

// ---------------------------------------------------------------------------
// ButtrbaseError
// ---------------------------------------------------------------------------

describe('ButtrbaseError', () => {
  it('sets message, name, statusCode, and detail', () => {
    const err = new ButtrbaseError(404, 'not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ButtrbaseError);
    expect(err.name).toBe('ButtrbaseError');
    expect(err.message).toBe('[404] not found');
    expect(err.statusCode).toBe(404);
    expect(err.detail).toBe('not found');
    expect(err.payload).toBeUndefined();
  });

  it('stores optional payload', () => {
    const payload = { foo: 'bar' };
    const err = new ButtrbaseError(422, 'validation error', payload);
    expect(err.payload).toEqual(payload);
  });

  it('works with status 0', () => {
    const err = new ButtrbaseError(0, 'unknown');
    expect(err.statusCode).toBe(0);
    expect(err.message).toBe('[0] unknown');
  });
});

// ---------------------------------------------------------------------------
// ButtrbaseClient — constructor guards
// ---------------------------------------------------------------------------

describe('ButtrbaseClient constructor', () => {
  it('throws if clientId is empty', () => {
    expect(() => new ButtrbaseClient({ clientId: '', clientSecret: 'sec' })).toThrow('clientId is required');
  });

  it('throws if clientSecret is empty', () => {
    expect(() => new ButtrbaseClient({ clientId: 'cid', clientSecret: '' })).toThrow('clientSecret is required');
  });

  it('constructs with minimal options', () => {
    const client = new ButtrbaseClient({ clientId: 'cid', clientSecret: 'sec', fetch: mockFetch });
    expect(client).toBeDefined();
  });

  it('accepts a custom baseUrl', () => {
    const client = new ButtrbaseClient({ clientId: 'cid', clientSecret: 'sec', baseUrl: 'https://example.com/', fetch: mockFetch });
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Shared client fixture
// ---------------------------------------------------------------------------

let client: ButtrbaseClient;

beforeEach(() => {
  client = new ButtrbaseClient({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    accessToken: 'test-token',
    baseUrl: 'https://api.test',
    fetch: mockFetch,
  });
  mockFetch.mockReset();
});

afterEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helper: assert ButtrbaseError thrown for 4xx
// ---------------------------------------------------------------------------

async function expectButtrbaseError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
) {
  await expect(fn()).rejects.toBeInstanceOf(ButtrbaseError);
  try {
    await fn();
  } catch (e) {
    expect((e as ButtrbaseError).statusCode).toBe(expectedStatus);
  }
}

// ---------------------------------------------------------------------------
// request() internals — error handling branches
// ---------------------------------------------------------------------------

describe('ButtrbaseClient request internals', () => {
  it('throws ButtrbaseError with detail from response .detail string', async () => {
    mockResponse(400, { detail: 'bad input' });
    await expect(client.validateCoupon('x')).rejects.toMatchObject({
      statusCode: 400,
      detail: 'bad input',
    });
  });

  it('throws ButtrbaseError with detail from response .detail object', async () => {
    mockResponse(422, { detail: [{ loc: ['body'], msg: 'required' }] });
    await expect(client.validateCoupon('x')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('throws ButtrbaseError with plain string body as detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('plain error text'),
    });
    await expect(client.mfaStatus()).rejects.toMatchObject({
      statusCode: 500,
      detail: 'plain error text',
    });
  });

  it('falls back to statusText when body is empty', async () => {
    // 503 is retryable; use a no-retry client to assert the error-formatting path.
    const noRetry = new ButtrbaseClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-token',
      baseUrl: 'https://api.test',
      fetch: mockFetch,
      maxRetries: 0,
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: () => Promise.resolve(''),
    });
    await expect(noRetry.mfaStatus()).rejects.toMatchObject({
      statusCode: 503,
      detail: 'Service Unavailable',
    });
  });

  it('propagates network errors', async () => {
    // Network errors are retryable; use a no-retry client to assert propagation.
    const noRetry = new ButtrbaseClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-token',
      baseUrl: 'https://api.test',
      fetch: mockFetch,
      maxRetries: 0,
    });
    mockNetworkError('fetch failed');
    await expect(noRetry.mfaStatus()).rejects.toThrow('fetch failed');
  });

  it('handles non-JSON text response on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('just text'),
    });
    const result = await client.mfaStatus();
    expect(result).toBe('just text');
  });

  it('handles empty body response on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: () => Promise.resolve(''),
    });
    const result = await client.deleteCredential('cred-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// request() retry strategy — exponential backoff for transient failures
// ---------------------------------------------------------------------------

describe('ButtrbaseClient retry strategy', () => {
  // Zero base delay keeps retry tests fast (jitter * 0 === 0).
  function retryClient(maxRetries = 3) {
    return new ButtrbaseClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-token',
      baseUrl: 'https://api.test',
      fetch: mockFetch,
      maxRetries,
      retryBaseDelayMs: 0,
    });
  }

  it('retries a 503 then succeeds on 200', async () => {
    const rc = retryClient();
    mockResponse(503, { detail: 'cold start' });
    mockResponse(200, { valid: true });
    const result = await rc.validateCoupon('SAVE10');
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a non-retryable 400', async () => {
    const rc = retryClient();
    mockResponse(400, { detail: 'bad input' });
    await expect(rc.validateCoupon('x')).rejects.toMatchObject({
      statusCode: 400,
      detail: 'bad input',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries 502/504/429 statuses', async () => {
    for (const status of [502, 504, 429]) {
      mockFetch.mockReset();
      const rc = retryClient();
      mockResponse(status, { detail: 'transient' });
      mockResponse(200, { valid: true });
      const result = await rc.validateCoupon('X');
      expect(result).toEqual({ valid: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }
  });

  it('retries network errors then succeeds', async () => {
    const rc = retryClient();
    mockNetworkError('ECONNRESET');
    mockResponse(200, { valid: true });
    const result = await rc.validateCoupon('X');
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const rc = retryClient(2);
    mockResponse(503, { detail: 'down' });
    mockResponse(503, { detail: 'down' });
    mockResponse(503, { detail: 'down' });
    await expect(rc.validateCoupon('X')).rejects.toMatchObject({ statusCode: 503 });
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry when maxRetries is 0', async () => {
    const rc = retryClient(0);
    mockResponse(503, { detail: 'down' });
    await expect(rc.validateCoupon('X')).rejects.toMatchObject({ statusCode: 503 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('honors a numeric Retry-After header', async () => {
    const rc = retryClient();
    mockResponse(429, { detail: 'slow down' }, '', { 'Retry-After': '0' });
    mockResponse(200, { valid: true });
    const result = await rc.validateCoupon('X');
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 200 success', async () => {
    const rc = retryClient();
    mockResponse(200, { valid: true });
    const result = await rc.validateCoupon('X');
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the AbortSignal is already aborted', async () => {
    const rc = retryClient();
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockImplementationOnce(() => Promise.reject(new DOMException('Aborted', 'AbortError')));
    await expect((rc as any).request('GET', '/v1/auth/mfa/status', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('builds query string with array values', async () => {
    mockResponse(200, []);
    await client.elevationList('org-1');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/elevation');
  });

  it('skips null and undefined query params', async () => {
    // listAuthEvents passes limit and optionally user_uuid; if userUuid is absent, it is not in query
    mockResponse(200, []);
    await client.listAuthEvents('org-1', { userUuid: undefined });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('user_uuid');
    expect(url).toContain('limit=50');
  });

  it('skips Authorization header when auth: false', async () => {
    mockResponse(200, { keys: [] });
    await client.orgJwks('org-1');
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sets Authorization header when auth is default (true)', async () => {
    mockResponse(200, { valid: true });
    await client.validateCoupon('code');
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});

// ---------------------------------------------------------------------------
// Client-credentials token grant
// ---------------------------------------------------------------------------

describe('client-credentials token grant', () => {
  // A client WITHOUT a pre-supplied accessToken, so the grant kicks in lazily.
  function ccClient() {
    return new ButtrbaseClient({
      clientId: 'cid',
      clientSecret: 'csec',
      baseUrl: 'https://api.test',
      fetch: mockFetch,
      maxRetries: 0,
    });
  }

  function tokenBody(reqBodyJson: string) {
    return JSON.parse(reqBodyJson) as Record<string, unknown>;
  }

  it('authenticate() posts the grant and stores the bearer', async () => {
    const cc = ccClient();
    mockResponse(200, { access_token: 'jwt-1', token_type: 'Bearer', expires_in: 3600 });
    const res = await cc.authenticate();
    expect(res.access_token).toBe('jwt-1');

    // Right endpoint + grant body, no Authorization on the token call itself.
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/auth/token');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(tokenBody(init?.body as string)).toEqual({
      grant_type: 'client_credentials',
      client_id: 'cid',
      client_secret: 'csec',
    });

    // The minted bearer is used on the next authed request.
    mockResponse(200, { valid: true });
    await cc.validateCoupon('X');
    const headers = mockFetch.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-1');
  });

  it('lazily fetches a bearer before the first authed request, then reuses it', async () => {
    const cc = ccClient();
    mockResponse(200, { access_token: 'jwt-lazy', token_type: 'Bearer', expires_in: 3600 });
    mockResponse(200, { valid: true });
    await cc.validateCoupon('A');

    // call 0 = token grant, call 1 = the actual request
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.test/api/v1/auth/token');
    expect((mockFetch.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-lazy');

    // Second authed call reuses the cached bearer — no new token grant.
    mockResponse(200, { valid: true });
    await cc.validateCoupon('B');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect((mockFetch.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-lazy');
    // No further token grant was issued.
    const tokenCalls = mockFetch.mock.calls.filter((c) => c[0] === 'https://api.test/api/v1/auth/token');
    expect(tokenCalls).toHaveLength(1);
  });

  it('refreshes the bearer once the cached one expires', async () => {
    vi.useFakeTimers();
    try {
      const cc = ccClient();
      // expires_in 60s → refresh skew 30s → stale after ~30s.
      mockResponse(200, { access_token: 'jwt-old', token_type: 'Bearer', expires_in: 60 });
      mockResponse(200, { valid: true });
      await cc.validateCoupon('A');
      expect((mockFetch.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-old');

      // Advance past the refresh deadline (30s ttl).
      vi.advanceTimersByTime(31_000);

      mockResponse(200, { access_token: 'jwt-new', token_type: 'Bearer', expires_in: 3600 });
      mockResponse(200, { valid: true });
      await cc.validateCoupon('B');

      // A second token grant happened, and the new bearer is used.
      const tokenCalls = mockFetch.mock.calls.filter((c) => c[0] === 'https://api.test/api/v1/auth/token');
      expect(tokenCalls).toHaveLength(2);
      const lastHeaders = mockFetch.mock.calls.at(-1)?.[1]?.headers as Record<string, string>;
      expect(lastHeaders.Authorization).toBe('Bearer jwt-new');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does NOT refresh before the expiry deadline', async () => {
    vi.useFakeTimers();
    try {
      const cc = ccClient();
      mockResponse(200, { access_token: 'jwt-1', token_type: 'Bearer', expires_in: 3600 });
      mockResponse(200, { valid: true });
      await cc.validateCoupon('A');

      vi.advanceTimersByTime(1000); // well within the token lifetime

      mockResponse(200, { valid: true });
      await cc.validateCoupon('B');

      const tokenCalls = mockFetch.mock.calls.filter((c) => c[0] === 'https://api.test/api/v1/auth/token');
      expect(tokenCalls).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('de-dupes concurrent lazy grants into a single token request', async () => {
    const cc = ccClient();
    mockResponse(200, { access_token: 'jwt-1', token_type: 'Bearer', expires_in: 3600 });
    mockResponse(200, { valid: true });
    mockResponse(200, { valid: true });
    await Promise.all([cc.validateCoupon('A'), cc.validateCoupon('B')]);
    const tokenCalls = mockFetch.mock.calls.filter((c) => c[0] === 'https://api.test/api/v1/auth/token');
    expect(tokenCalls).toHaveLength(1);
  });

  it('surfaces bad credentials as a 401 ButtrbaseError', async () => {
    const cc = ccClient();
    mockResponse(401, { error: 'invalid client credentials' });
    await expect(cc.authenticate()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('does not auto-refresh a constructor-supplied accessToken', async () => {
    const supplied = new ButtrbaseClient({
      clientId: 'cid',
      clientSecret: 'csec',
      accessToken: 'supplied-bearer',
      baseUrl: 'https://api.test',
      fetch: mockFetch,
      maxRetries: 0,
    });
    mockResponse(200, { valid: true });
    await supplied.validateCoupon('A');
    // Only the actual request — no token grant.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer supplied-bearer');
  });
});

// ---------------------------------------------------------------------------
// Coupons & Gift Cards
// ---------------------------------------------------------------------------

describe('validateCoupon', () => {
  it('happy path', async () => {
    const body = { valid: true, discount_percent: 10 };
    mockResponse(200, body);
    const res = await client.validateCoupon('SAVE10');
    expect(res).toEqual(body);
  });

  it('with cartLabels and productId', async () => {
    mockResponse(200, { valid: true });
    await client.validateCoupon('CODE', { cartLabels: ['a', 'b'], productId: 42 });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.cart_labels).toEqual(['a', 'b']);
    expect(reqBody.product_id).toBe(42);
  });

  it('4xx throws ButtrbaseError', async () => {
    mockResponse(404, { detail: 'not found' });
    mockResponse(404, { detail: 'not found' });
    await expectButtrbaseError(() => client.validateCoupon('BAD'), 404);
  });
});

describe('validateGiftCard', () => {
  it('happy path', async () => {
    mockResponse(200, { valid: true, balance_cents: 5000 });
    const res = await client.validateGiftCard('GC123');
    expect(res).toMatchObject({ valid: true });
  });

  it('4xx throws ButtrbaseError', async () => {
    mockResponse(400, { detail: 'invalid' });
    mockResponse(400, { detail: 'invalid' });
    await expectButtrbaseError(() => client.validateGiftCard('BAD'), 400);
  });
});

describe('redeemGiftCard', () => {
  it('happy path without userId', async () => {
    const body = { success: true, remaining_cents: 0 };
    mockResponse(200, body);
    const res = await client.redeemGiftCard('GC1', 1000);
    expect(res).toEqual(body);
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.user_id).toBeUndefined();
  });

  it('happy path with userId', async () => {
    mockResponse(200, { success: true });
    await client.redeemGiftCard('GC1', 500, 99);
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.user_id).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Magic Links
// ---------------------------------------------------------------------------

describe('sendMagicLink', () => {
  it('happy path minimal', async () => {
    mockResponse(200, { sent: true });
    const res = await client.sendMagicLink('a@b.com');
    expect(res).toMatchObject({ sent: true });
  });

  it('happy path with orgUuid and redirectTo', async () => {
    mockResponse(200, { sent: true });
    await client.sendMagicLink('a@b.com', { orgUuid: 'org-1', redirectTo: 'https://app.test' });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.org_uuid).toBe('org-1');
    expect(reqBody.redirect_to).toBe('https://app.test');
  });

  it('cross-app federation sends app_uuid + redirect_to', async () => {
    mockResponse(200, { sent: true, dev_token: null, expires_in_seconds: 900 });
    const res = await client.sendMagicLink('a@b.com', {
      appUuid: 'app-uuid-1',
      redirectTo: 'https://app.example.com/auth/callback',
    });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.app_uuid).toBe('app-uuid-1');
    expect(reqBody.redirect_to).toBe('https://app.example.com/auth/callback');
    expect(res.expires_in_seconds).toBe(900);
  });
});

describe('verifyMagicLink', () => {
  it('happy path', async () => {
    mockResponse(200, { access_token: 'tok' });
    const res = await client.verifyMagicLink('mytoken');
    expect(res).toMatchObject({ access_token: 'tok' });
  });

  it('4xx throws ButtrbaseError', async () => {
    mockResponse(401, { detail: 'invalid token' });
    mockResponse(401, { detail: 'invalid token' });
    await expectButtrbaseError(() => client.verifyMagicLink('bad'), 401);
  });
});

// ---------------------------------------------------------------------------
// MFA
// ---------------------------------------------------------------------------

describe('mfaStatus', () => {
  it('happy path', async () => {
    mockResponse(200, { enabled: false });
    const res = await client.mfaStatus();
    expect(res).toMatchObject({ enabled: false });
  });

  it('4xx throws ButtrbaseError', async () => {
    mockResponse(401, { detail: 'unauthenticated' });
    mockResponse(401, { detail: 'unauthenticated' });
    await expectButtrbaseError(() => client.mfaStatus(), 401);
  });
});

describe('mfaEnroll', () => {
  it('without label', async () => {
    mockResponse(200, { qr_code: 'data:...' });
    await client.mfaEnroll();
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.label).toBeUndefined();
  });

  it('with label', async () => {
    mockResponse(200, { qr_code: 'data:...' });
    await client.mfaEnroll('My Device');
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.label).toBe('My Device');
  });
});

describe('mfaActivate', () => {
  it('happy path', async () => {
    mockResponse(200, { status: 'activated' });
    const res = await client.mfaActivate('123456');
    expect(res).toMatchObject({ status: 'activated' });
  });
});

// ---------------------------------------------------------------------------
// Org endpoints
// ---------------------------------------------------------------------------

describe('orgSign', () => {
  it('happy path without ttl', async () => {
    mockResponse(200, { token: 'signed-token' });
    const res = await client.orgSign('org-1', { role: 'admin' });
    expect(res).toMatchObject({ token: 'signed-token' });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBeUndefined();
  });

  it('with ttlSeconds', async () => {
    mockResponse(200, { token: 'tok' });
    await client.orgSign('org-1', { role: 'viewer' }, { ttlSeconds: 3600 });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBe(3600);
  });
});

describe('orgJwks', () => {
  it('happy path', async () => {
    mockResponse(200, { keys: [{ kty: 'EC' }] });
    const res = await client.orgJwks('org-1');
    expect(res.keys).toHaveLength(1);
  });
});

describe('getSecret', () => {
  it('happy path', async () => {
    mockResponse(200, { name: 'DB_PASS', value: 'secret' });
    const res = await client.getSecret('org-1', 'DB_PASS');
    expect(res).toMatchObject({ name: 'DB_PASS' });
  });
});

describe('putSecret', () => {
  it('without description', async () => {
    mockResponse(200, { name: 'DB_PASS' });
    await client.putSecret('org-1', 'DB_PASS', 'new-val');
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.description).toBeUndefined();
    expect(reqBody.value).toBe('new-val');
  });

  it('with description', async () => {
    mockResponse(200, { name: 'DB_PASS' });
    await client.putSecret('org-1', 'DB_PASS', 'val', 'desc');
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.description).toBe('desc');
  });
});

// ---------------------------------------------------------------------------
// Zero-trust endpoints
// ---------------------------------------------------------------------------

describe('authStepUp', () => {
  it('happy path replaces the bearer access token', async () => {
    mockResponse(200, { access_token: 'elevated-tok', expires_in: 300 });
    const res = await client.authStepUp('123456');
    expect(res.access_token).toBe('elevated-tok');
    // verify next request uses elevated token
    mockResponse(200, []);
    await client.elevationList('org-1');
    const headers = mockFetch.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer elevated-tok');
  });

  it('happy path with recovery=true', async () => {
    mockResponse(200, { access_token: 'tok' });
    await client.authStepUp('backup-code', true);
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.recovery).toBe(true);
  });

  it('happy path with no access_token in response', async () => {
    mockResponse(200, {});
    const res = await client.authStepUp('123456');
    expect(res).toEqual({});
  });
});

describe('elevationRequest', () => {
  it('minimal', async () => {
    mockResponse(200, { grant_uuid: 'g-1', status: 'pending' });
    const res = await client.elevationRequest('org-1', 'write');
    expect(res).toMatchObject({ grant_uuid: 'g-1' });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.reason).toBeUndefined();
  });

  it('with reason and ttl', async () => {
    mockResponse(200, { grant_uuid: 'g-1', status: 'pending' });
    await client.elevationRequest('org-1', 'write', { reason: 'hotfix', ttlSeconds: 600 });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.reason).toBe('hotfix');
    expect(reqBody.ttl_seconds).toBe(600);
  });
});

describe('elevationApprove', () => {
  it('happy path', async () => {
    mockResponse(200, { grant_uuid: 'g-1', status: 'approved' });
    const res = await client.elevationApprove('org-1', 'g-1');
    expect(res).toMatchObject({ status: 'approved' });
  });
});

describe('elevationList', () => {
  it('without status', async () => {
    mockResponse(200, []);
    const res = await client.elevationList('org-1');
    expect(Array.isArray(res)).toBe(true);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain('status=');
  });

  it('with status', async () => {
    mockResponse(200, [{ grant_uuid: 'g-1' }]);
    await client.elevationList('org-1', 'pending');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('status=pending');
  });
});

describe('spiffeIssueSvid', () => {
  it('without ttl', async () => {
    mockResponse(200, { svid: 'x509cert' });
    const res = await client.spiffeIssueSvid('org-1', 'spiffe://example/workload');
    expect(res).toMatchObject({ svid: 'x509cert' });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBeUndefined();
  });

  it('with ttl', async () => {
    mockResponse(200, { svid: 'cert' });
    await client.spiffeIssueSvid('org-1', 'path', { ttlSeconds: 3600 });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBe(3600);
  });
});

describe('listAuthEvents', () => {
  it('default limit', async () => {
    mockResponse(200, []);
    await client.listAuthEvents('org-1');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('limit=50');
    expect(url).not.toContain('user_uuid');
  });

  it('with userUuid and limit', async () => {
    mockResponse(200, [{ event_id: 'e1' }]);
    await client.listAuthEvents('org-1', { userUuid: 'u-1', limit: 10 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('user_uuid=u-1');
    expect(url).toContain('limit=10');
  });
});

describe('reencryptSecrets', () => {
  it('happy path', async () => {
    mockResponse(200, { status: 'ok' });
    const res = await client.reencryptSecrets('org-1');
    expect(res).toMatchObject({ status: 'ok' });
  });
});

describe('reencryptSigningKeys', () => {
  it('happy path', async () => {
    mockResponse(200, { status: 'ok' });
    const res = await client.reencryptSigningKeys('org-1');
    expect(res).toMatchObject({ status: 'ok' });
  });
});

describe('reencryptMtlsCa', () => {
  it('happy path', async () => {
    mockResponse(200, { status: 'ok' });
    const res = await client.reencryptMtlsCa('org-1');
    expect(res).toMatchObject({ status: 'ok' });
  });
});

describe('revokeSession', () => {
  it('without ttl', async () => {
    mockResponse(200, { revoked: true });
    const res = await client.revokeSession('jti-abc');
    expect(res).toMatchObject({ revoked: true });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBeUndefined();
  });

  it('with ttl', async () => {
    mockResponse(200, { revoked: true });
    await client.revokeSession('jti-abc', 86400);
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.ttl_seconds).toBe(86400);
  });
});

describe('getOrgMetrics', () => {
  it('happy path', async () => {
    mockResponse(200, { users: 42, orgs: 1 });
    const res = await client.getOrgMetrics('org-1');
    expect(res).toMatchObject({ users: 42 });
  });
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

describe('listCredentials', () => {
  it('happy path', async () => {
    mockResponse(200, { credentials: [] });
    const res = await client.listCredentials();
    expect(res).toMatchObject({ credentials: [] });
  });
});

describe('createCredential', () => {
  it('without description', async () => {
    const body = { id: 'c-1', name: 'MyKey', client_id: 'cid', client_secret: 'sec' };
    mockResponse(201, body);
    const res = await client.createCredential('MyKey');
    expect(res).toMatchObject({ name: 'MyKey' });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.description).toBeUndefined();
  });

  it('with description', async () => {
    mockResponse(201, { id: 'c-2', name: 'Key' });
    await client.createCredential('Key', 'my desc');
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.description).toBe('my desc');
  });
});

describe('getCredential', () => {
  it('happy path', async () => {
    mockResponse(200, { id: 'c-1', name: 'Key' });
    const res = await client.getCredential('c-1');
    expect(res).toMatchObject({ id: 'c-1' });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/credentials/c-1');
  });
});

describe('deleteCredential', () => {
  it('happy path (204)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: () => Promise.resolve(''),
    });
    await expect(client.deleteCredential('c-1')).resolves.toBeUndefined();
  });

  it('4xx throws ButtrbaseError', async () => {
    mockResponse(404, { detail: 'not found' });
    await expect(client.deleteCredential('bad-id')).rejects.toBeInstanceOf(ButtrbaseError);
  });
});

describe('rotateCredentialSecret', () => {
  it('happy path', async () => {
    mockResponse(200, { client_id: 'cid', client_secret: 'new-sec' });
    const res = await client.rotateCredentialSecret('c-1');
    expect(res).toMatchObject({ client_id: 'cid' });
  });
});

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

describe('resetSandbox', () => {
  it('without orgUuid', async () => {
    mockResponse(200, { reset: true });
    const res = await client.resetSandbox();
    expect(res).toMatchObject({ reset: true });
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.org_uuid).toBeUndefined();
  });

  it('with orgUuid', async () => {
    mockResponse(200, { reset: true });
    await client.resetSandbox('org-uuid-123');
    const reqBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(reqBody.org_uuid).toBe('org-uuid-123');
  });
});

// ---------------------------------------------------------------------------
// Invite / Auth
// ---------------------------------------------------------------------------

describe('inviteAccept', () => {
  it('happy path (no auth header)', async () => {
    mockResponse(200, { user_id: 1, access_token: 'tok' });
    const res = await client.inviteAccept({ token: 'inv-tok', email: 'a@b.com', password: 'pw' });
    expect(res).toMatchObject({ user_id: 1 });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('checkOrgName', () => {
  it('happy path', async () => {
    mockResponse(200, { available: true });
    const res = await client.checkOrgName('MyOrg');
    expect(res).toMatchObject({ available: true });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('name=MyOrg');
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('getSuperuserFlag', () => {
  it('happy path', async () => {
    mockResponse(200, { is_superuser: false });
    const res = await client.getSuperuserFlag('admin@example.com');
    expect(res).toMatchObject({ is_superuser: false });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('email=admin%40example.com');
  });
});

// ---------------------------------------------------------------------------
// Contact forms
// ---------------------------------------------------------------------------

describe('postContact', () => {
  it('happy path (no auth header)', async () => {
    mockResponse(200, { submitted: true });
    const res = await client.postContact({ name: 'Alice', email: 'a@b.com', message: 'hi' });
    expect(res).toMatchObject({ submitted: true });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('postContactUs', () => {
  it('happy path (no auth header)', async () => {
    mockResponse(200, { submitted: true });
    const res = await client.postContactUs({ email: 'a@b.com', message: 'hello' });
    expect(res).toMatchObject({ submitted: true });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

describe('getClientIp', () => {
  it('happy path (no auth header)', async () => {
    mockResponse(200, { ip: '1.2.3.4', country: 'US' });
    const res = await client.getClientIp();
    expect(res).toMatchObject({ ip: '1.2.3.4' });
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Webhooks — gap coverage (lines 21-22, 88-89)
// ---------------------------------------------------------------------------

describe('verifyButtrbaseSignature — missing fields', () => {
  it('returns false when signatureHeader is null', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: null,
      timestampHeader: String(Math.floor(Date.now() / 1000)),
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when signatureHeader is empty string', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: '',
      timestampHeader: String(Math.floor(Date.now() / 1000)),
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestampHeader is null', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=1,v1=abc',
      timestampHeader: null,
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestampHeader is undefined', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=1,v1=abc',
      timestampHeader: undefined,
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when secret is empty', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=1,v1=abc',
      timestampHeader: String(Math.floor(Date.now() / 1000)),
      secret: '',
    });
    expect(ok).toBe(false);
  });
});

describe('verifyButtrbaseSignature — header without v1 key', () => {
  it('returns false when signatureHeader has no v1= part', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: `t=${ts},v2=somethingelse`,
      timestampHeader: String(ts),
      secret: 'mysecret',
    });
    expect(ok).toBe(false);
  });

  it('returns false for header with only t= part', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const ok = await verifyButtrbaseSignature({
      body: 'data',
      signatureHeader: `t=${ts}`,
      timestampHeader: String(ts),
      secret: 'mysecret',
    });
    expect(ok).toBe(false);
  });

  it('returns false when header part has no = sign (parseV1 eq<0 branch)', async () => {
    const ts = Math.floor(Date.now() / 1000);
    // "noequals" has no '=' so eq === -1, should be skipped; no v1 found => false
    const ok = await verifyButtrbaseSignature({
      body: 'data',
      signatureHeader: `noequals,t=${ts}`,
      timestampHeader: String(ts),
      secret: 'mysecret',
    });
    expect(ok).toBe(false);
  });
});

describe('verifyButtrbaseSignature — invalid timestamp', () => {
  it('returns false when timestamp is NaN', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=abc,v1=deadbeef',
      timestampHeader: 'not-a-number',
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestamp is 0', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=0,v1=deadbeef',
      timestampHeader: '0',
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });

  it('returns false when timestamp is negative', async () => {
    const ok = await verifyButtrbaseSignature({
      body: 'hello',
      signatureHeader: 't=-1,v1=deadbeef',
      timestampHeader: '-1',
      secret: 'sec',
    });
    expect(ok).toBe(false);
  });
});

describe('signButtrbasePayload — Uint8Array body', () => {
  it('produces a verifiable signature from Uint8Array input', async () => {
    const secret = 'whsec_test';
    const body = new TextEncoder().encode('{"event":"test"}');
    const { signatureHeader, timestampHeader } = await signButtrbasePayload(body, secret);
    const ok = await verifyButtrbaseSignature({
      body,
      signatureHeader,
      timestampHeader,
      secret,
    });
    expect(ok).toBe(true);
  });
});

describe('verifyButtrbaseSignature — Uint8Array body', () => {
  it('verifies using Uint8Array body', async () => {
    const secret = 'sec';
    const bodyStr = 'payload';
    const bodyBytes = new TextEncoder().encode(bodyStr);
    const { signatureHeader, timestampHeader } = await signButtrbasePayload(bodyStr, secret);
    const ok = await verifyButtrbaseSignature({
      body: bodyBytes,
      signatureHeader,
      timestampHeader,
      secret,
    });
    expect(ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Token claims enrichment — data envelope: roles + email (0.5.0 / Rust 0.6.0)
// ---------------------------------------------------------------------------

describe('decodeJwtPayload', () => {
  it('decodes a well-formed fake JWT and returns the claims object', () => {
    const payload = {
      sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      org: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      exp: 9999999999,
      iat: 0,
    };
    const claims = decodeJwtPayload(fakeJwt(payload));
    expect(claims.sub).toBe(payload.sub);
    expect(claims.org).toBe(payload.org);
  });

  it('throws TypeError for a non-JWT string', () => {
    expect(() => decodeJwtPayload('not.a.jwt.at.all.extra')).toThrow(TypeError);
    expect(() => decodeJwtPayload('onlytwoparts.x')).toThrow(TypeError);
  });

  it('throws TypeError when payload is not valid JSON', () => {
    const bad = 'eyJhbGciOiJSUzI1NiJ9.!!!.fakesig';
    expect(() => decodeJwtPayload(bad)).toThrow(TypeError);
  });
});

describe('claimsToAuthContext', () => {
  it('returns empty roles and undefined email when data is absent', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 9999999999,
      iat: 0,
    });
    expect(ctx.roles).toEqual([]);
    expect(ctx.email).toBeUndefined();
    expect(ctx.scopes).toEqual([]);
    expect(ctx.userId).toBe('u-1');
    expect(ctx.orgId).toBe('o-1');
  });

  it('splits a comma-delimited roles string into an array', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 0,
      iat: 0,
      data: { roles: 'org_admin,leadership' },
    });
    expect(ctx.roles).toEqual(['org_admin', 'leadership']);
  });

  it('splits a space-delimited roles string into an array', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 0,
      iat: 0,
      data: { roles: 'admin member' },
    });
    expect(ctx.roles).toEqual(['admin', 'member']);
  });

  it('handles a single role with no delimiter', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 0,
      iat: 0,
      data: { roles: 'owner' },
    });
    expect(ctx.roles).toEqual(['owner']);
  });

  it('surfaces email from data envelope', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 0,
      iat: 0,
      data: { email: 'test@example.com' },
    });
    expect(ctx.email).toBe('test@example.com');
  });

  it('passes through scopes array', () => {
    const ctx = claimsToAuthContext({
      sub: 'u-1',
      org: 'o-1',
      exp: 0,
      iat: 0,
      scope: ['read:messages', 'write:messages'],
    });
    expect(ctx.scopes).toEqual(['read:messages', 'write:messages']);
  });
});

// ---------------------------------------------------------------------------
// Parity additions (0.6.0) — canonical Rust SDK parity tests
// ---------------------------------------------------------------------------

describe('sendOtpV1', () => {
  it('POSTs to /api/v1/auth/otp/send with email + app_uuid, no auth header', async () => {
    mockResponse(200, null);
    await client.sendOtpV1('alice@example.com', 'app-uuid-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/auth/otp/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'alice@example.com', app_uuid: 'app-uuid-1' });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('throws ButtrbaseError on 400', async () => {
    mockResponse(400, { detail: 'invalid email' });
    await expect(client.sendOtpV1('bad', 'app-uuid-1')).rejects.toBeInstanceOf(ButtrbaseError);
  });
});

describe('verifyOtpV1', () => {
  it('POSTs to /api/v1/auth/otp/verify with email + otp + app_uuid and returns TokenPair', async () => {
    const tokenPair = { token: 'signup_token_jwt', refresh_token: null, user_uuid: null };
    mockResponse(200, tokenPair);
    const result = await client.verifyOtpV1('alice@example.com', '123456', 'app-uuid-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/auth/otp/verify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'alice@example.com',
      otp: '123456',
      app_uuid: 'app-uuid-1',
    });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(result.token).toBe('signup_token_jwt');
  });
});

describe('refreshToken', () => {
  it('POSTs to /api/app/auth/refresh with { refresh } body and returns AccessToken', async () => {
    const accessToken = { token: 'new_access_token', refresh_token: 'new_refresh_token' };
    mockResponse(200, accessToken);
    const result = await client.refreshToken('old_refresh_token');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/app/auth/refresh');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refresh: 'old_refresh_token' });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(result.token).toBe('new_access_token');
    expect(result.refresh_token).toBe('new_refresh_token');
  });
});

describe('checkEntitlement', () => {
  it('POSTs to /api/entitlements/check with feature_key body and returns EntitlementResult', async () => {
    mockResponse(200, { data: { granted: true, reason: null } });
    const result = await client.checkEntitlement('advanced_analytics');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/entitlements/check');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ feature_key: 'advanced_analytics' });
    expect(result.granted).toBe(true);
  });
});

describe('checkEntitlements', () => {
  it('POSTs to /api/entitlements/check/batch with feature_keys array', async () => {
    const batchResp = {
      data: {
        advanced_analytics: { granted: true, reason: null },
        export_data: { granted: false, reason: 'plan_limit' },
      },
    };
    mockResponse(200, batchResp);
    const result = await client.checkEntitlements(['advanced_analytics', 'export_data']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/entitlements/check/batch');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ feature_keys: ['advanced_analytics', 'export_data'] });
    expect(result['advanced_analytics'].granted).toBe(true);
    expect(result['export_data'].granted).toBe(false);
  });
});

describe('effectiveEntitlements', () => {
  it('GETs /api/entitlements/effective and returns EffectiveEntitlement[]', async () => {
    const resp = {
      data: [
        { feature_key: 'advanced_analytics', granted: true, reason: null },
        { feature_key: 'export_data', granted: false, reason: 'plan_limit' },
      ],
    };
    mockResponse(200, resp);
    const result = await client.effectiveEntitlements();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/entitlements/effective');
    expect(init.method).toBe('GET');
    expect(result).toHaveLength(2);
    expect(result[0].feature_key).toBe('advanced_analytics');
    expect(result[1].granted).toBe(false);
  });
});

describe('pricingPreviewTyped', () => {
  it('POSTs to /api/pricing/preview with typed request and returns PricingPreview', async () => {
    const previewResp = {
      data: {
        amount_cents: 2000,
        currency: 'USD',
        discount_cents: 200,
        tax_cents: 100,
        final_cents: 1900,
        region_resolved: 'US',
      },
    };
    mockResponse(200, previewResp);
    const result = await client.pricingPreviewTyped({ price_id: 42, country: 'US' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/pricing/preview');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ price_id: 42, country: 'US' });
    expect(result.final_cents).toBe(1900);
    expect(result.currency).toBe('USD');
  });
});

describe('pricingQuoteTyped', () => {
  it('POSTs to /api/pricing/quote with typed request', async () => {
    mockResponse(200, { data: { quote_id: 'q-abc', expires_at: '2026-06-30T00:00:00Z' } });
    const result = await client.pricingQuoteTyped({ price_id: 42 });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/pricing/quote');
    expect(result).toMatchObject({ quote_id: 'q-abc' });
  });
});

describe('checkoutSessionTyped', () => {
  it('POSTs to /api/pricing/checkout-session with typed request', async () => {
    const sessionResp = {
      data: { payment_url: 'https://pay.example.com/session-1', session_id: 'sess-1', provider: 'stripe' },
    };
    mockResponse(200, sessionResp);
    const result = await client.checkoutSessionTyped({ price_id: 42, quote_id: 'q-abc' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/pricing/checkout-session');
    expect(JSON.parse(init.body as string)).toEqual({ price_id: 42, quote_id: 'q-abc' });
    expect(result.payment_url).toBe('https://pay.example.com/session-1');
    expect(result.provider).toBe('stripe');
  });
});

describe('walletSummary', () => {
  it('GETs /api/wallet and returns WalletSummary', async () => {
    const walletResp = { data: { balance_cents: 5000, budget_limit_cents: 10000, budget_period: 'monthly' } };
    mockResponse(200, walletResp);
    const result = await client.walletSummary();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/wallet');
    expect(result.balance_cents).toBe(5000);
    expect(result.budget_period).toBe('monthly');
  });
});

describe('walletTransactions', () => {
  it('GETs /api/wallet/transactions with limit and offset query params', async () => {
    const txResp = {
      data: [
        { id: 1, kind: 'deposit', amount_cents: 1000, description: 'Top-up', created_at: '2026-01-01T00:00:00Z' },
      ],
    };
    mockResponse(200, txResp);
    const result = await client.walletTransactions(10, 5);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/wallet/transactions');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=5');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('deposit');
  });

  it('uses defaults of limit=20 offset=0', async () => {
    mockResponse(200, { data: [] });
    await client.walletTransactions();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');
  });
});

describe('listSubscriptions', () => {
  it('GETs /api/subscriptions and returns SubscriptionItem[]', async () => {
    const subResp = {
      data: [
        {
          id: 1,
          user_uuid: 'user-uuid-1',
          price_id: 10,
          provider: 'stripe',
          provider_subscription_id: 'sub_abc',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    mockResponse(200, subResp);
    const result = await client.listSubscriptions();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/subscriptions');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
    expect(result[0].provider).toBe('stripe');
  });
});

describe('createSubscription', () => {
  it('POSTs to /api/subscriptions and returns SubscriptionItem', async () => {
    const subResp = {
      data: {
        id: 2,
        user_uuid: 'user-uuid-1',
        price_id: 20,
        provider: 'stripe',
        provider_subscription_id: 'sub_xyz',
        status: 'active',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-01T00:00:00Z',
      },
    };
    mockResponse(200, subResp);
    const result = await client.createSubscription({ price_id: 20 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/subscriptions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ price_id: 20 });
    expect(result.id).toBe(2);
    expect(result.provider_subscription_id).toBe('sub_xyz');
  });
});

describe('cancelSubscription', () => {
  it('DELETEs /api/subscriptions/{id}', async () => {
    mockResponse(204, null);
    await client.cancelSubscription(42);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/subscriptions/42');
    expect(init.method).toBe('DELETE');
  });
});

describe('billingHistory', () => {
  it('GETs /api/billing/history and returns Invoice[]', async () => {
    const histResp = {
      data: [
        {
          id: 1,
          user_id: 100,
          subscription_id: 2,
          provider: 'stripe',
          provider_invoice_id: 'inv_abc',
          amount: 2000,
          status: 'paid',
          invoice_pdf_url: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    mockResponse(200, histResp);
    const result = await client.billingHistory();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/billing/history');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('paid');
    expect(result[0].amount).toBe(2000);
  });
});

describe('reportUsage', () => {
  it('POSTs to /api/usage/report with typed UsageEvent body', async () => {
    mockResponse(200, null);
    const event = { metric: 'api_calls', quantity: 5, org_uuid: 'org-uuid-1' };
    await client.reportUsage(event);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/usage/report');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.metric).toBe('api_calls');
    expect(body.quantity).toBe(5);
    expect(body.org_uuid).toBe('org-uuid-1');
  });
});

describe('ingestEvent', () => {
  it('POSTs to /api/analytics/events with typed AnalyticsEvent body', async () => {
    mockResponse(200, null);
    const event = { event_type: 'page_view', properties: { page: '/home' } };
    await client.ingestEvent(event);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/analytics/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.event_type).toBe('page_view');
    expect(body.properties).toEqual({ page: '/home' });
  });
});

describe('appAnalyticsOverview', () => {
  it('GETs /api/analytics/apps/{appUuid}/overview?period={period}', async () => {
    mockResponse(200, { users: 100 });
    await client.appAnalyticsOverview('app-uuid-1', '30d');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/analytics/apps/app-uuid-1/overview');
    expect(url).toContain('period=30d');
  });
});

describe('orgAnalyticsOverview', () => {
  it('GETs /api/analytics/organizations/{orgUuid}/overview?period={period}', async () => {
    mockResponse(200, { users: 50 });
    await client.orgAnalyticsOverview('org-uuid-1', '7d');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/analytics/organizations/org-uuid-1/overview');
    expect(url).toContain('period=7d');
  });
});

describe('orgTeams', () => {
  it('GETs /api/organizations/{orgUuid}/teams and returns TeamItem[]', async () => {
    const teamsResp = {
      data: [
        { id: 1, team_uuid: 'team-uuid-1', org_uuid: 'org-uuid-1', name: 'Engineering', description: null },
      ],
    };
    mockResponse(200, teamsResp);
    const result = await client.orgTeams('org-uuid-1');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/organizations/org-uuid-1/teams');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Engineering');
  });
});

describe('userTeams', () => {
  it('GETs /api/users/{userUuid}/teams and returns TeamItem[]', async () => {
    const teamsResp = {
      data: [
        { id: 2, team_uuid: 'team-uuid-2', org_uuid: 'org-uuid-1', name: 'Product', description: 'Product team' },
      ],
    };
    mockResponse(200, teamsResp);
    const result = await client.userTeams('user-uuid-1');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/users/user-uuid-1/teams');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Product');
  });
});

describe('myApps', () => {
  it('GETs /api/me/apps and returns AppEntry[]', async () => {
    const appsResp = {
      data: [
        { app_uuid: 'app-uuid-1', app_name: 'MyApp', role: 'admin' },
        { app_uuid: 'app-uuid-2', app_name: 'SideProject', role: 'member' },
      ],
    };
    mockResponse(200, appsResp);
    const result = await client.myApps();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/me/apps');
    expect(result).toHaveLength(2);
    expect(result[0].app_name).toBe('MyApp');
    expect(result[0].role).toBe('admin');
  });
});

describe('appOrgs', () => {
  it('GETs /api/apps/{appUuid}/organizations and returns OrgEntry[]', async () => {
    const orgsResp = {
      data: [
        { org_uuid: 'org-uuid-1', org_name: 'Acme Inc', role: 'admin' },
      ],
    };
    mockResponse(200, orgsResp);
    const result = await client.appOrgs('app-uuid-1');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/apps/app-uuid-1/organizations');
    expect(result).toHaveLength(1);
    expect(result[0].org_name).toBe('Acme Inc');
  });
});

describe('appCredentials', () => {
  it('GETs /api/apps/{appUuid}/credentials and returns AppCredentialsResponse', async () => {
    const credsResp = {
      data: {
        app_name: 'MyApp',
        sandbox_enabled: true,
        live: {
          environment: 'live',
          client_id: 'bb_live_cid_abc',
          client_secret_prefix: 'bb_live_sk_',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          rotated_at: null,
        },
        sandbox: null,
      },
    };
    mockResponse(200, credsResp);
    const result = await client.appCredentials('app-uuid-1');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/apps/app-uuid-1/credentials');
    expect(result.app_name).toBe('MyApp');
    expect(result.sandbox_enabled).toBe(true);
    expect(result.live?.client_id).toBe('bb_live_cid_abc');
    expect(result.sandbox).toBeNull();
  });
});

describe('enableSandbox', () => {
  it('PATCHes /api/apps/{appUuid} with { sandbox_enabled: true }', async () => {
    mockResponse(200, null);
    await client.enableSandbox('app-uuid-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/apps/app-uuid-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ sandbox_enabled: true });
  });
});

describe('rotateCredentials', () => {
  it('POSTs to /api/apps/{appUuid}/credentials/{env}/rotate and returns data', async () => {
    const rotateResp = {
      data: { client_id: 'bb_live_cid_new', client_secret: 'bb_live_sk_new' },
    };
    mockResponse(200, rotateResp);
    const result = await client.rotateCredentials('app-uuid-1', 'live');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/apps/app-uuid-1/credentials/live/rotate');
    expect(init.method).toBe('POST');
    expect(result).toMatchObject({ client_id: 'bb_live_cid_new' });
  });
});

describe('decodeButtrbaseClaims — fixture: access_token_claims.json', () => {
  // Load the shared fixture (same file used by the Rust SDK tests).
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const fixture = JSON.parse(readFileSync(join(fixtureDir, 'access_token_claims.json'), 'utf-8'));

  it('parses the fixture payload and surfaces roles + email from the data envelope', () => {
    const token = fakeJwt(fixture);
    const ctx = decodeButtrbaseClaims(token);

    // roles: fixture has data.roles = "owner"
    expect(ctx.roles).toContain('owner');
    expect(ctx.roles).toHaveLength(1);

    // email: fixture has data.email = "test@example.com"
    expect(ctx.email).toBe('test@example.com');

    // core identity fields
    expect(ctx.userId).toBe(fixture.sub);
    expect(ctx.orgId).toBe(fixture.org);
    expect(ctx.scopes).toEqual(fixture.scope);
  });

  it('raw decodeJwtPayload round-trips the fixture data envelope intact', () => {
    const token = fakeJwt(fixture);
    const claims = decodeJwtPayload(token);
    expect(claims.data?.roles).toBe('owner');
    expect(claims.data?.email).toBe('test@example.com');
    expect(claims.data?.org_uuid).toBe('22222222-2222-2222-2222-222222222222');
    expect(claims.data?.user_uuid).toBe('11111111-1111-1111-1111-111111111111');
  });
});
