/**
 * Cryptographic verifier tests — RS256 + JWKS.
 *
 * All tests run offline: we generate a local RS256 keypair, build an in-memory
 * JWKS, sign tokens with `SignJWT`, and verify using `createLocalJWKSet` (no
 * network). The production `Verifier` uses `createRemoteJWKSet`; tests stub it
 * by monkey-patching the internal `jwks` field with a local JWKS set that
 * accepts the same key.
 *
 * Covers:
 *  - verifyToken returns enriched Claims (sub, org, data envelope with roles/email)
 *  - verifyBearer strips "Bearer " and returns AuthContext
 *  - Negative: tampered signature → rejects
 *  - Negative: wrong issuer → rejects
 *  - Negative: expired token → rejects
 *  - Negative: wrong audience → rejects (when audience is configured)
 *  - No-audience mode: token without aud claim accepted (mirrors Rust SDK)
 *  - verifyBearer with missing/non-Bearer header → rejects
 *  - Accessors: issuer, audience
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  SignJWT,
  type GenerateKeyPairResult,
  type KeyLike,
} from 'jose';
import { Verifier } from '../src/verify.js';
import type { VerifierConfig } from '../src/verify.js';

// ---------------------------------------------------------------------------
// Test keypair + JWKS fixture (generated once for the whole suite)
// ---------------------------------------------------------------------------

const KID = 'test-key-1';
const ISSUER = 'https://api.buttrbase.test';

let privateKey: KeyLike;
let publicKey: KeyLike;
let localJwks: ReturnType<typeof createLocalJWKSet>;

// A second keypair for tamper tests.
let altPrivateKey: KeyLike;

beforeAll(async () => {
  const pair: GenerateKeyPairResult = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  const pubJwk = await exportJWK(publicKey);
  pubJwk.kid = KID;
  pubJwk.use = 'sig';
  pubJwk.alg = 'RS256';

  localJwks = createLocalJWKSet({ keys: [pubJwk] });

  // Second keypair — different key, used to sign "tampered" tokens.
  const altPair: GenerateKeyPairResult = await generateKeyPair('RS256');
  altPrivateKey = altPair.privateKey;
});

// ---------------------------------------------------------------------------
// Helper: build a Verifier whose JWKS points at our local in-memory set.
// ---------------------------------------------------------------------------

function makeVerifier(opts: Partial<VerifierConfig> = {}): Verifier {
  const config: VerifierConfig = {
    jwksUrl: 'https://api.buttrbase.test/jwks.json', // not actually fetched
    issuer: ISSUER,
    ...opts,
  };
  const v = new Verifier(config);
  // Replace the remote JWKS set with the local one (same interface).
  (v as unknown as { jwks: typeof localJwks }).jwks = localJwks;
  return v;
}

// ---------------------------------------------------------------------------
// Helper: sign a token with the test private key.
// ---------------------------------------------------------------------------

const FIXTURE_SUB = '11111111-1111-1111-1111-111111111111';
const FIXTURE_ORG = '22222222-2222-2222-2222-222222222222';

async function signToken(
  payload: Record<string, unknown>,
  overrideKey?: KeyLike,
  expiresIn = '1h',
): Promise<string> {
  const key = overrideKey ?? privateKey;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(expiresIn)
    .sign(key);
}

// ---------------------------------------------------------------------------
// Happy-path: verifyToken returns enriched Claims
// ---------------------------------------------------------------------------

describe('Verifier.verifyToken — happy path', () => {
  it('returns Claims with sub, org and data envelope (roles + email)', async () => {
    const v = makeVerifier();
    const token = await signToken({
      sub: FIXTURE_SUB,
      org: FIXTURE_ORG,
      scope: ['read:messages', 'write:messages'],
      data: {
        roles: 'owner',
        email: 'test@example.com',
        org_uuid: FIXTURE_ORG,
        user_uuid: FIXTURE_SUB,
      },
    });

    const claims = await v.verifyToken(token);

    expect(claims.sub).toBe(FIXTURE_SUB);
    expect(claims.org).toBe(FIXTURE_ORG);
    expect(claims.scope).toEqual(['read:messages', 'write:messages']);
    expect(claims.data?.roles).toBe('owner');
    expect(claims.data?.email).toBe('test@example.com');
    expect(claims.data?.org_uuid).toBe(FIXTURE_ORG);
    expect(claims.data?.user_uuid).toBe(FIXTURE_SUB);
    // exp + iat are set by SignJWT.
    expect(typeof claims.exp).toBe('number');
    expect(typeof claims.iat).toBe('number');
  });

  it('accepts tokens without a data envelope', async () => {
    const v = makeVerifier();
    const token = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG });
    const claims = await v.verifyToken(token);
    expect(claims.sub).toBe(FIXTURE_SUB);
    expect(claims.data).toBeUndefined();
  });

  it('accepts tokens without an aud claim when audience is not configured', async () => {
    const v = makeVerifier(); // no audience
    const token = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG });
    // Should NOT throw even though no aud is present.
    await expect(v.verifyToken(token)).resolves.toBeDefined();
  });

  it('accepts tokens with the correct audience when audience is configured', async () => {
    const v = makeVerifier({ audience: 'my-app' });
    const token = await new SignJWT({ sub: FIXTURE_SUB, org: FIXTURE_ORG })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience('my-app')
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(v.verifyToken(token)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Happy-path: verifyBearer returns AuthContext with roles + email
// ---------------------------------------------------------------------------

describe('Verifier.verifyBearer — happy path', () => {
  it('strips Bearer prefix, verifies, and returns AuthContext', async () => {
    const v = makeVerifier();
    const token = await signToken({
      sub: FIXTURE_SUB,
      org: FIXTURE_ORG,
      scope: ['read:messages'],
      data: { roles: 'owner,org_admin', email: 'test@example.com' },
    });

    const ctx = await v.verifyBearer(`Bearer ${token}`);

    expect(ctx.userId).toBe(FIXTURE_SUB);
    expect(ctx.orgId).toBe(FIXTURE_ORG);
    expect(ctx.scopes).toEqual(['read:messages']);
    expect(ctx.roles).toContain('owner');
    expect(ctx.roles).toContain('org_admin');
    expect(ctx.email).toBe('test@example.com');
  });

  it('returns empty roles when data envelope has no roles', async () => {
    const v = makeVerifier();
    const token = await signToken({
      sub: FIXTURE_SUB,
      org: FIXTURE_ORG,
      data: { email: 'other@example.com' },
    });
    const ctx = await v.verifyBearer(`Bearer ${token}`);
    expect(ctx.roles).toEqual([]);
    expect(ctx.email).toBe('other@example.com');
  });

  it('returns empty scopes when scope claim is absent', async () => {
    const v = makeVerifier();
    const token = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG });
    const ctx = await v.verifyBearer(`Bearer ${token}`);
    expect(ctx.scopes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Negative: tampered signature
// ---------------------------------------------------------------------------

describe('Verifier.verifyToken — tampered signature', () => {
  it('rejects a token signed with a different private key', async () => {
    const v = makeVerifier();
    // Sign with altPrivateKey — JWKS only has publicKey, so verification fails.
    const tampered = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG }, altPrivateKey);
    await expect(v.verifyToken(tampered)).rejects.toThrow();
  });

  it('rejects a token with a manually corrupted signature segment', async () => {
    const v = makeVerifier();
    const token = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG });
    const parts = token.split('.');
    // Flip one character in the signature.
    const sig = parts[2];
    const corrupted = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
    const bad = `${parts[0]}.${parts[1]}.${corrupted}`;
    await expect(v.verifyToken(bad)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative: wrong issuer
// ---------------------------------------------------------------------------

describe('Verifier.verifyToken — wrong issuer', () => {
  it('rejects a token issued by a different issuer', async () => {
    const v = makeVerifier(); // expects ISSUER
    // Build a token with a different issuer.
    const token = await new SignJWT({ sub: FIXTURE_SUB, org: FIXTURE_ORG })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuedAt()
      .setIssuer('https://evil.example.com')
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(v.verifyToken(token)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative: expired token
// ---------------------------------------------------------------------------

describe('Verifier.verifyToken — expired token', () => {
  it('rejects a token whose exp is in the past', async () => {
    const v = makeVerifier();
    // Sign with expiresIn of 1 second in the past (negative offset string not
    // supported by jose, so use a numeric iat/exp directly).
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      sub: FIXTURE_SUB,
      org: FIXTURE_ORG,
      iat: now - 3600,
      exp: now - 1800, // expired 30 minutes ago
    })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISSUER)
      .sign(privateKey);
    await expect(v.verifyToken(token)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative: wrong audience
// ---------------------------------------------------------------------------

describe('Verifier.verifyToken — wrong audience', () => {
  it('rejects when token aud does not match the configured audience', async () => {
    const v = makeVerifier({ audience: 'expected-app' });
    const token = await new SignJWT({ sub: FIXTURE_SUB, org: FIXTURE_ORG })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience('wrong-app')
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(v.verifyToken(token)).rejects.toThrow();
  });

  it('rejects when aud claim is absent but audience is configured', async () => {
    const v = makeVerifier({ audience: 'required-app' });
    const token = await signToken({ sub: FIXTURE_SUB, org: FIXTURE_ORG }); // no aud
    await expect(v.verifyToken(token)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative: verifyBearer header problems
// ---------------------------------------------------------------------------

describe('Verifier.verifyBearer — bad header', () => {
  it('rejects when header does not start with "Bearer "', async () => {
    const v = makeVerifier();
    await expect(v.verifyBearer('Basic dXNlcjpwYXNz')).rejects.toThrow(
      /Authorization/i,
    );
  });

  it('rejects an empty string', async () => {
    const v = makeVerifier();
    await expect(v.verifyBearer('')).rejects.toThrow(/Authorization/i);
  });

  it('rejects "Bearer " with no token', async () => {
    const v = makeVerifier();
    await expect(v.verifyBearer('Bearer ')).rejects.toThrow(/empty/i);
  });

  it('rejects a Bearer header with a garbage token', async () => {
    const v = makeVerifier();
    await expect(v.verifyBearer('Bearer not.a.real.jwt')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

describe('Verifier accessors', () => {
  it('exposes the configured issuer', () => {
    const v = makeVerifier({ issuer: 'https://custom.example.com' });
    expect(v.issuer).toBe('https://custom.example.com');
  });

  it('exposes the configured audience when set', () => {
    const v = makeVerifier({ audience: 'my-audience' });
    expect(v.audience).toBe('my-audience');
  });

  it('audience is undefined when not configured', () => {
    const v = makeVerifier();
    expect(v.audience).toBeUndefined();
  });
});
