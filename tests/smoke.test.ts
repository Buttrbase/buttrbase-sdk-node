import { describe, it, expect } from 'vitest';
import { ButtrbaseClient, ButtrbaseError, verifyButtrbaseSignature, signButtrbasePayload } from '../src/index.js';

const SMOKE = process.env.BUTTRBASE_SMOKE_API;
const CLIENT_ID = process.env.BUTTRBASE_CLIENT_ID ?? 'test-client-id';
const CLIENT_SECRET = process.env.BUTTRBASE_CLIENT_SECRET ?? 'test-client-secret';
const ACCESS_TOKEN = process.env.BUTTRBASE_ACCESS_TOKEN;
const ORG_UUID = process.env.BUTTRBASE_ORG_UUID ?? '00000000-0000-0000-0000-000000000000';

const d = SMOKE ? describe : describe.skip;

d('buttrbase smoke', () => {
  const client = new ButtrbaseClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    accessToken: ACCESS_TOKEN,
    baseUrl: SMOKE,
  });

  it('validateCoupon unknown returns invalid or 404', async () => {
    try {
      const res = await client.validateCoupon('definitely-not-a-real-code-xyz');
      expect(res).toBeDefined();
      if ('valid' in res) expect(res.valid).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect([400, 404, 422]).toContain((e as ButtrbaseError).statusCode);
    }
  });

  it('validateGiftCard unknown returns invalid or 404', async () => {
    try {
      const res = await client.validateGiftCard('definitely-not-a-real-code-xyz');
      expect(res).toBeDefined();
      if ('valid' in res) expect(res.valid).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect([400, 404, 422]).toContain((e as ButtrbaseError).statusCode);
    }
  });

  it('orgJwks returns 404 or empty keys', async () => {
    try {
      const res = await client.orgJwks(ORG_UUID);
      expect(Array.isArray(res.keys)).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect((e as ButtrbaseError).statusCode).toBe(404);
    }
  });

  it('getTenantHome unknown org returns 404', async () => {
    try {
      const res = await client.getTenantHome(ORG_UUID);
      expect(res).toBeDefined();
      expect(typeof res.tenancy_mode).toBe('string');
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect((e as ButtrbaseError).statusCode).toBe(404);
    }
  });

  it('listDevices requires auth (returns array or auth error)', async () => {
    try {
      const res = await client.listDevices();
      expect(Array.isArray(res)).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect([401, 403]).toContain((e as ButtrbaseError).statusCode);
    }
  });

  it('scopeContext rejects an un-held scope (403) or requires auth (401)', async () => {
    try {
      const res = await client.scopeContext({ requested_scopes: ['definitely:not-held'] });
      expect(Array.isArray(res.scopes)).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(ButtrbaseError);
      expect([401, 403]).toContain((e as ButtrbaseError).statusCode);
    }
  });
});

describe('webhook signature round-trip', () => {
  it('verifies a freshly signed payload', async () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ event: 'ping', id: 'evt_1' });
    const { signatureHeader, timestampHeader } = await signButtrbasePayload(body, secret);
    const ok = await verifyButtrbaseSignature({
      body,
      signatureHeader,
      timestampHeader,
      secret,
    });
    expect(ok).toBe(true);
  });

  it('rejects bad signature', async () => {
    const secret = 'whsec_test_secret';
    const body = 'hello';
    const { timestampHeader } = await signButtrbasePayload(body, secret);
    const ok = await verifyButtrbaseSignature({
      body,
      signatureHeader: `t=${timestampHeader},v1=deadbeef`,
      timestampHeader,
      secret,
    });
    expect(ok).toBe(false);
  });

  it('rejects stale timestamp', async () => {
    const secret = 'whsec_test_secret';
    const body = 'hello';
    const stale = Math.floor(Date.now() / 1000) - 10000;
    const { signatureHeader, timestampHeader } = await signButtrbasePayload(body, secret, stale);
    const ok = await verifyButtrbaseSignature({
      body,
      signatureHeader,
      timestampHeader,
      secret,
      toleranceSeconds: 300,
    });
    expect(ok).toBe(false);
  });
});
