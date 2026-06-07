import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ButtrbaseClient, ButtrbaseError } from '../src/index.js';
import { verifyButtrbaseSignature, signButtrbasePayload } from '../src/webhooks.js';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(status: number, body: unknown, statusText = '') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText,
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
  it('throws if apiKey is empty', () => {
    expect(() => new ButtrbaseClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('constructs with minimal options', () => {
    const client = new ButtrbaseClient({ apiKey: 'key', fetch: mockFetch });
    expect(client).toBeDefined();
  });

  it('accepts a custom baseUrl', () => {
    const client = new ButtrbaseClient({ apiKey: 'key', baseUrl: 'https://example.com/', fetch: mockFetch });
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Shared client fixture
// ---------------------------------------------------------------------------

let client: ButtrbaseClient;

beforeEach(() => {
  client = new ButtrbaseClient({ apiKey: 'test-api-key', baseUrl: 'https://api.test', fetch: mockFetch });
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
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: () => Promise.resolve(''),
    });
    await expect(client.mfaStatus()).rejects.toMatchObject({
      statusCode: 503,
      detail: 'Service Unavailable',
    });
  });

  it('propagates network errors', async () => {
    mockNetworkError('fetch failed');
    await expect(client.mfaStatus()).rejects.toThrow('fetch failed');
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
    expect(headers.Authorization).toBe('Bearer test-api-key');
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
  it('happy path replaces apiKey', async () => {
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
