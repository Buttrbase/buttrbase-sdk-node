# Node.js / TypeScript SDK

> **v0.X breaking change — `appUuid: string` replaces the `app` slug.**
> Methods that used to take an app identifier (`app: "workahub"`, `appId: 2`,
> `appName: "..."`) now take an `appUuid: string` (UUID-formatted). Affected
> calls: `register`, `login`, `sendOtp`, `verifyOtp`,
> and the new `lookupOrganization`. The backend no longer
> accepts slug aliases — see [CHANGELOG.md](./CHANGELOG.md).
>
> **`sendMagicLink` signature change** — it is now `sendMagicLink(email, opts?)`
> with `appUuid` and `redirectTo` passed inside `opts`; the send/verify
> response shapes are now strongly typed (`access_token`, not `accessToken`).
> See the [Magic-link](#magic-link-passwordless-sign-in) section.

## Overview

The official Node.js SDK for ButtrBase. Fully typed, `fetch`-based client covering every API surface — auth, organizations, billing, RBAC, teams, credentials, search, AI gateway, webhooks, zero-trust, and more.

## Installation

```bash
npm install @buttrbase/sdk
```

## Quick Start

```typescript
import { ButtrbaseClient } from '@buttrbase/sdk';

// App-server auth uses OAuth2 client-credentials (the client_id / client_secret
// pair you create with `client.createCredential(...)`).
const client = new ButtrbaseClient({
  clientId: process.env.BUTTRBASE_CLIENT_ID!,
  clientSecret: process.env.BUTTRBASE_CLIENT_SECRET!,
});

const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// Login (app_uuid is required). The returned access_token becomes the bearer
// for subsequent authenticated calls.
const resp = await client.login('user@example.com', 'password', APP_UUID);
console.log(resp.access_token);

// Get profile
const profile = await client.getProfile();
```

> **App-server bearer tokens.** Construct the client with your
> `clientId` / `clientSecret` and authenticated calls just work — the SDK
> exchanges them for a bearer via the OAuth2 client-credentials grant
> (`POST /api/v1/auth/token`) on the first authenticated request, caches it,
> and refreshes it shortly before it expires. Call `authenticate()` explicitly
> to force a fresh token, or pass `accessToken` to the constructor to supply a
> bearer out-of-band (e.g. one obtained via `login` / `authStepUp`).

## Authentication

### Register

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const resp = await client.register('user@example.com', 'password', APP_UUID, {
  firstName: 'Jane', lastName: 'Doe'
});
```

### Login Options

```typescript
const options = await client.getLoginOptions('018f1234-5678-7000-8000-0000000000aa');
```

### Magic-link (passwordless sign-in)

Magic-link is the **only** browser sign-in flow that yields a JWKS-verifiable
**RS256** access token. The generic email-OTP endpoints issue **HS256** tokens
signed with Buttrbase's server secret, which the public JWKS cannot verify —
so any third-party app that needs to verify Buttrbase tokens itself (e.g. in
its own backend, against the published JWKS) must use magic-link.

It is a two-step flow:

1. **Send** — `sendMagicLink(email, opts?)` posts to
   `POST /api/auth/magic-link/send` and emails the user a one-time link.
   Returns `{ sent, dev_token, expires_in_seconds }`. `dev_token` is the raw
   one-time token, returned only in non-prod dev-echo mode (handy for tests);
   it is `null` in production.
2. **Verify** — `verifyMagicLink(token)` posts to
   `POST /api/auth/magic-link/verify`, exchanging the one-time token (from the
   emailed link, or `dev_token`) for an RS256 `access_token`. Returns
   `{ access_token, token_type, user: { user_uuid, email }, redirect_to }`.

#### Cross-app federation & the redirect allowlist

Pass `appUuid` together with a `redirectTo` whose **origin** is registered on
the Buttrbase application — i.e. it appears in the application's WebAuthn
`rp_origins` or its configured redirect URL. When the origin is allowlisted,
the emailed link points at the app's **own** callback
(`{redirect_to}?token=...`), so the app verifies the RS256 token itself.

Non-allowlisted or non-absolute `redirectTo` targets are ignored and the link
falls back to the Buttrbase-hosted sign-in page. For the first-party flow,
omit `redirectTo` entirely.

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// 1. Send the link. For cross-app federation, pass appUuid + an allowlisted
//    redirectTo (its origin must be registered on the application).
const { sent, expires_in_seconds } = await client.sendMagicLink(
  'user@example.com',
  { appUuid: APP_UUID, redirectTo: 'https://app.example.com/auth/callback' },
);

// 2. Verify the one-time token (from the emailed link's `?token=...`, or the
//    dev_token in non-prod) to get an RS256 access token.
const { access_token, token_type, user, redirect_to } =
  await client.verifyMagicLink('token-from-email');

console.log(access_token); // RS256 JWT — verifiable against the public JWKS
console.log(user.user_uuid, user.email);
```

### Token claims enrichment — roles and email (v0.5.0)

After verifying a buttrbase RS256 access token against the published JWKS, you
can decode its payload and surface the `data` envelope fields (`roles`, `email`)
as a typed `AuthContext`:

```typescript
import { decodeButtrbaseClaims, claimsToAuthContext, decodeJwtPayload } from '@buttrbase/client';

// -- Option A: one-shot convenience helper ----------------------------------
// Decodes the JWT payload (no signature check) and returns AuthContext.
// Always verify the token against the JWKS first.
const ctx = decodeButtrbaseClaims(accessToken);

console.log(ctx.userId);  // sub claim (string UUID)
console.log(ctx.orgId);   // org claim (string UUID)
console.log(ctx.scopes);  // string[] — e.g. ["read:messages"]
console.log(ctx.roles);   // string[] split from data.roles — e.g. ["owner"]
console.log(ctx.email);   // string | undefined — from data.email

if (ctx.roles.includes('owner')) {
  // ...
}

// -- Option B: bring-your-own JWKS verifier ---------------------------------
// Use your preferred RS256 library to verify the signature, then convert the
// already-decoded payload to an AuthContext.
const rawClaims = yourJwksVerifier.verify(accessToken); // { sub, org, data, ... }
const ctx2 = claimsToAuthContext(rawClaims);
```

The `data.roles` field is a comma/space-delimited string on the wire
(`"owner"`, `"org_admin,leadership"`, `"admin member"`); `decodeButtrbaseClaims`
and `claimsToAuthContext` split it into a `string[]` for you, matching the
behaviour of the Rust SDK's `AuthContext::from(Claims)` (added in Rust SDK
0.6.0).

**No signature verification is performed by these helpers.** Use
`client.orgJwks(orgUuid)` to fetch the public JWKS and verify the token before
calling `decodeButtrbaseClaims`.

### OTP (Passwordless Phone)

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

await client.sendOtp('+15551234567', APP_UUID);
const resp = await client.verifyOtp('+15551234567', '123456', APP_UUID);
```

### Passkey support (WebAuthn)

The SDK exposes the four WebAuthn ceremony endpoints as thin HTTP wrappers.
The challenge / credential blobs are pass-through `unknown` JSON — the
browser's `navigator.credentials.create` / `.get` APIs produce and consume
them directly, so no WebAuthn helper library is required.

```typescript
// Registration (requires an authenticated user — add a passkey to an existing
// account):
const { challenge, registration_state } = await client.passkeyRegisterBegin();
const credential = await navigator.credentials.create({ publicKey: (challenge as any).publicKey });
const result = await client.passkeyRegisterComplete({ registration_state, credential });
console.log(result.credential_id);

// Authentication (anonymous):
const { challenge: ac, auth_state } = await client.passkeyAuthenticateBegin();
const assertion = await navigator.credentials.get({ publicKey: (ac as any).publicKey });
const session = await client.passkeyAuthenticateComplete({ auth_state, credential: assertion });

// List the signed-in user's enrolled passkeys (descending by created_at):
const passkeys = await client.listMyPasskeys();
for (const p of passkeys) {
  console.log(p.nickname ?? p.credential_id_prefix, p.credential_uuid);
}

// Revoke one by its credential_uuid (owner check enforced server-side):
await client.deleteMyPasskey(passkeys[0].credential_uuid);
```

### Organization Lookup

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const org = await client.lookupOrganization(APP_UUID, { domain: 'acme.com' });
// or by slug
const org2 = await client.lookupOrganization(APP_UUID, { slug: 'acme' });
```

### SSO (OIDC / SAML)

```typescript
const oidcUrl = await client.oidcAuthorizeUrl('connection-uuid');
const samlUrl = await client.samlAuthorizeUrl('connection-uuid');
```

### OAuth (Google / Microsoft / GitHub / Apple)

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const url = client.oauthStartUrl('google', APP_UUID, 'https://app.example.com/auth/callback');
// Redirect the browser to `url`; the backend will 302 to Google.
```

## MFA / TOTP

```typescript
const status = await client.mfaStatus();
const enrollment = await client.mfaEnroll();
await client.mfaActivate('123456');
await client.mfaVerify('123456');
await client.mfaChallenge();
const codes = await client.mfaGenerateRecoveryCodes();
await client.mfaRedeemRecoveryCode('recovery-code');
await client.mfaDisable();
```

## Step-Up Auth

```typescript
const resp = await client.authStepUp('totp-code');
// the SDK's bearer access token is auto-replaced with the elevated token
```

## Organization Security

```typescript
const settings = await client.getSecuritySettings('org-uuid');
await client.updateSecuritySettings('org-uuid', { mfa_required: true });

const connections = await client.listSsoConnections('org-uuid');
await client.createSsoConnection('org-uuid', { provider: 'okta', name: 'Okta SSO' });

const events = await client.listAuditEvents('org-uuid');
```

## Sessions & Devices

```typescript
const sessions = await client.orgSessionInventory('org-uuid');
await client.orgRevokeAllSessions('org-uuid');

const accounts = await client.listDeviceAccounts('device-uuid');
await client.addDeviceAccount('device-uuid', { email: 'user@example.com' });
await client.switchDeviceActiveAccount('device-uuid', 'account-uuid');
```

### End-user device keys (self-service)

```typescript
// Authenticated end user; lists the caller's own active device keys.
const devices = await client.listDevices();
await client.revokeDevice(devices[0].device_uuid);
```

### Windowed scope re-mint (JIT)

```typescript
// Re-mint an access token windowed to a least-privilege scope subset.
const { token, scopes } = await client.scopeContext({
  requested_scopes: ['billing:read'],
});
```

## Tenant Home (discovery)

```typescript
// Public — no auth required. 404 if no active tenant home for this org/app.
const home = await client.getTenantHome('org-uuid', 42);
// { tenancy_mode, home_region, home_base_url }
```

## Client Credentials (app-server auth)

The single app-server credential is an OAuth2 `client_id` / `client_secret`
pair.

```typescript
// List existing credentials (no secrets returned)
const { data } = await client.listCredentials();

// Create — `client_secret` is shown ONCE. Save it now or rotate later.
const created = await client.createCredential('CI runner', 'GitHub Actions');
console.log('save these:', created.client_id, created.client_secret);

// Rotate the secret (invalidates the previous one)
const rotated = await client.rotateCredentialSecret(created.credentials_id);

// Delete
await client.deleteCredential(created.credentials_id);

// Construct a client with the pair — authenticated calls just work. The SDK
// runs the client-credentials grant lazily on the first authed request,
// caches the bearer, and refreshes it before it expires.
const appClient = new ButtrbaseClient({
  clientId: created.client_id,
  clientSecret: created.client_secret,
});
await appClient.getProfile(); // bearer fetched + attached automatically

// Or force a token exchange up front (e.g. to fail fast on bad credentials):
const { access_token, expires_in } = await appClient.authenticate();
```

## OAuth Provider Admin

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// Register a provider
const config = await client.createOAuthConfig(APP_UUID, {
  provider: 'google',
  client_id: 'GOOGLE_CLIENT_ID',
  client_secret: 'GOOGLE_CLIENT_SECRET',
  redirect_uris: ['https://app.example.com/auth/callback'],
  scopes: ['openid', 'email', 'profile'],
  enabled: true,
});

// List (secrets are never returned)
const configs = await client.listOAuthConfigs(APP_UUID);

// Update — partial; client_secret only rotates when present
await client.updateOAuthConfig(APP_UUID, 'google', {
  scopes: ['openid', 'email', 'profile', 'offline_access'],
});

// Delete
await client.deleteOAuthConfig(APP_UUID, 'google');
```

## App-level Audit Log

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const rows = await client.readAuditLog(APP_UUID, {
  limit: 100,
  action_prefix: 'oauth.',
});
```

## Entitlements

```typescript
const check = await client.entitlementsCheck('advanced-analytics', 'org-uuid');
const batch = await client.entitlementsCheckBatch([{ feature: 'sso' }]);
const effective = await client.entitlementsEffective();
```

## Pricing

```typescript
const preview = await client.pricingPreview({ plan: 'pro' });
const quote = await client.pricingQuote({ plan: 'pro', seats: 10 });
const session = await client.pricingCheckoutSession({ plan: 'pro' });
```

## Coupons & Gift Cards

```typescript
// Admin
const coupons = await client.adminListProductCoupons('product-id');
await client.adminCreateProductCoupon('product-id', { code: 'SAVE20', discount_type: 'percent' });

// Public
const result = await client.validateCoupon('SAVE20');
const gc = await client.validateGiftCard('GC-123');
```

## Teams

```typescript
const team = await client.createTeam({ name: 'Engineering', org_uuid: '...' });
const teams = await client.listOrgTeams('org-uuid');
const members = await client.listTeamMembers('team-uuid');
await client.addTeamMember('team-uuid', 'user-uuid');
await client.removeTeamMember('team-uuid', 'user-uuid');

const observers = await client.listTeamObservers('team-uuid');
await client.addTeamObserver('team-uuid', 'user-uuid');
```

## Admin: Signing Keys

```typescript
const keys = await client.listSigningKeys('org-uuid');
await client.rotateSigningKeys('org-uuid');
const audit = await client.listSigningAudit('org-uuid');
```

## Admin: mTLS CA

```typescript
const ca = await client.getCa('org-uuid');
await client.initCa('org-uuid', { common_name: 'My CA' });
const certs = await client.listCertificates('org-uuid');
const cert = await client.issueCertificate('org-uuid', '...');
await client.revokeCertificate('org-uuid', 'serial');
```

## Admin: Secrets Vault

```typescript
const secrets = await client.listSecrets('org-uuid');
await client.putSecret('org-uuid', 'DB_URL', 'postgres://...');
const secret = await client.getSecret('org-uuid', 'DB_URL');
await client.deleteSecret('org-uuid', 'DB_URL');
```

## Admin: Domains & Webhooks

```typescript
const domains = await client.listDomains('org-uuid');
const domain = await client.createDomain('org-uuid', 'example.com');
await client.verifyDomain('org-uuid', '1');

const endpoints = await client.listWebhookEndpoints('org-uuid');
await client.createWebhookEndpoint('org-uuid', 'https://hook.example.com', ['user.created']);
```

## Payments

```typescript
const session = await client.createPaymentCheckout(5000, 'usd', 'US');
const invoice = await client.sendInvoice(5000, 'usd', '018f1234-5678-7000-8000-000000000001');
```

## AI Gateway

```typescript
const resp = await client.aiChatCompletions('org-uuid', 'openai', {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## SMS & Email

```typescript
await client.sendSms('+15551234567', 'Hello from ButtrBase!');
await client.verifyEmailIdentity('user@example.com', 'AKIA...', 'secret', 'us-east-1');
```

## Errors

Non-2xx responses throw `ButtrbaseError` with `statusCode`, `detail`, and the parsed `payload`.

## Docs

See https://buttrbase.com/docs for the full API reference.

## Recipes

### Complete Onboarding

```typescript
import { ButtrbaseClient } from '@buttrbase/sdk';

const client = new ButtrbaseClient({
  clientId: process.env.BUTTRBASE_CLIENT_ID!,
  clientSecret: process.env.BUTTRBASE_CLIENT_SECRET!,
});
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// 1. Register and login
await client.register('admin@acme.com', 's3cur3!', APP_UUID, { firstName: 'Alice' });
const login = await client.login('admin@acme.com', 's3cur3!', APP_UUID);

// 2. Get profile
const profile = await client.getProfile();

// 3. Create a team and add a member
const orgUuid = (profile.org as { uuid: string }).uuid;
const team = await client.createTeam({ name: 'Engineering', org_uuid: orgUuid });
await client.addTeamMember((team as { uuid: string }).uuid, 'colleague-user-uuid');
```

### OAuth Start URL

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// Build the URL; do NOT fetch it from this SDK — the backend 302s to the
// upstream IdP and your client must follow that in a browser context.
const url = client.oauthStartUrl(
  'google',
  APP_UUID,
  'https://app.example.com/auth/callback',
);
// Redirect the user's browser to `url`.
```

### Create a Client Credential (client_secret shown once)

```typescript
const created = await client.createCredential('GitHub Actions');

// WARNING: created.client_secret is shown ONCE. Save it to your secret store now.
process.env.BUTTRBASE_CLIENT_ID = created.client_id;
process.env.BUTTRBASE_CLIENT_SECRET = created.client_secret;
```

### Register an OAuth Provider

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

await client.createOAuthConfig(APP_UUID, {
  provider: 'google',
  client_id: process.env.GOOGLE_CLIENT_ID!,
  client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  redirect_uris: ['https://app.example.com/auth/callback'],
  scopes: ['openid', 'email', 'profile'],
  enabled: true,
});
```

### Read the Audit Log

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const rows = await client.readAuditLog(APP_UUID, {
  limit: 50,
  action_prefix: 'oauth.', // e.g. oauth.config.created, oauth.config.updated
});
for (const row of rows) {
  console.log(`${row.created_at} ${row.action} by ${row.actor_user_uuid ?? '<system>'}`);
}
```

### MFA Enrollment

```typescript
// 1. Check MFA status
const status = await client.mfaStatus();

// 2. Enroll in TOTP — returns secret + QR URL
const enrollment = await client.mfaEnroll();
console.log(`Scan this QR: ${enrollment.qr_code}`);

// 3. Activate with code from authenticator app
await client.mfaActivate('123456');

// 4. Generate recovery codes
const codes = await client.mfaGenerateRecoveryCodes();
console.log('Save these recovery codes:', codes);
```

### Checkout Flow

```typescript
// 1. Preview pricing
const preview = await client.pricingPreview({ plan: 'pro', seats: 10 });

// 2. Check entitlement
const check = await client.entitlementsCheck('advanced-analytics', 'org-uuid');

// 3. Create checkout session
const session = await client.pricingCheckoutSession({ plan: 'pro', seats: 10 });
console.log(`Redirect to: ${session.url}`);
```

### SSO Setup

```typescript
// 1. Create an OIDC connection
const conn = await client.createSsoConnection('org-uuid', 'okta', 'Okta SSO', {
  domain: 'myorg.okta.com',
  client_id: '...',
  client_secret: '...',
});

// 2. Get the authorize URL
const url = await client.oidcAuthorizeUrl((conn as { connection_uuid: string }).connection_uuid);
```

### Secrets & Key Management

```typescript
// 1. Store a secret
await client.putSecret('org-uuid', 'DATABASE_URL', 'postgres://...');

// 2. List and retrieve secrets
const secrets = await client.listSecrets('org-uuid');
const secret = await client.getSecret('org-uuid', 'DATABASE_URL');

// 3. Rotate signing keys
await client.rotateSigningKeys('org-uuid');
const audit = await client.listSigningAudit('org-uuid');
```

## Releasing (maintainers)

Tagged pushes (`v*`) trigger `.github/workflows/release.yml`, which runs `npm publish --access public`.
