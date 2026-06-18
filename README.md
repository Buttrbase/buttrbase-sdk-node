# Node.js / TypeScript SDK

> **v0.X breaking change — `appUuid: string` replaces the `app` slug.**
> Methods that used to take an app identifier (`app: "workahub"`, `appId: 2`,
> `appName: "..."`) now take an `appUuid: string` (UUID-formatted). Affected
> calls: `register`, `login`, `sendOtp`, `verifyOtp`,
> `sendMagicLink`, and the new `lookupOrganization`. The backend no longer
> accepts slug aliases — see [CHANGELOG.md](./CHANGELOG.md).

## Overview

The official Node.js SDK for ButtrBase. Fully typed, `fetch`-based client covering every API surface — auth, organizations, billing, RBAC, teams, credentials, search, AI gateway, webhooks, zero-trust, and more.

## Installation

```bash
npm install @buttrbase/sdk
```

## Quick Start

```typescript
import { ButtrbaseClient } from '@buttrbase/sdk';

const client = new ButtrbaseClient({ apiKey: 'bb_live_...' });

const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// Login (app_uuid is required)
const resp = await client.login('user@example.com', 'password', APP_UUID);
console.log(resp.access_token);

// Get profile
const profile = await client.getProfile();
```

## Backend Authentication (Client Credentials)

For backend services that need to authenticate without a user session, use the
OAuth2 client-credentials flow. Credentials (client ID + secret) can be created
via the dashboard or the `createCredential` SDK method.

```typescript
// Option A: auto-managed token (recommended for long-running servers)
// The SDK fetches a token on the first request and refreshes it automatically
// when it is within 60 seconds of expiry.
const client = new ButtrbaseClient({
  clientId: process.env.BUTTRBASE_CLIENT_ID!,
  clientSecret: process.env.BUTTRBASE_CLIENT_SECRET!,
});

// Option B: fetch token once and manage it yourself
const { accessToken } = await ButtrbaseClient.getAppToken(clientId, clientSecret);
const client = new ButtrbaseClient({ apiKey: accessToken });
```

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

### Magic Link

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

await client.sendMagicLink('user@example.com', APP_UUID, {
  redirectTo: 'https://app.example.com',
});
const resp = await client.verifyMagicLink('token-from-email');
console.log(resp.accessToken);  // JWT with sub, org, aud claims
```

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

### API Key Exchange

```typescript
// Initial exchange — trade a raw key for short-lived access + refresh tokens.
const tokens = await client.exchangeApiKey('bb_live_...');
// The SDK's bearer is now set to tokens.access_token.

// Rotate when the access token is close to expiry.
const refreshed = await client.exchangeRefreshToken(tokens.refresh_token);
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
// apiKey is auto-replaced with the elevated token
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

## API Keys (org-level, v2)

```typescript
const keys = await client.listApiKeysV2('org-uuid');
const newKey = await client.createApiKeyV2('org-uuid', 'my-api-key');
await client.deleteApiKeyV2('org-uuid', 'key-uuid');
```

## API Keys (app-level)

A parallel surface to the org-level keys above, scoped to a single app.

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

// List
const keys = await client.listAppApiKeys(APP_UUID);

// Create — `raw_key` is shown ONCE. Save it now or lose it.
const created = await client.createAppApiKey(APP_UUID, {
  name: 'CI runner',
  env: 'live',
  key_type: 'expiring',
  expiry: { in_days: 30 },
});
console.log('save this:', created.raw_key);

// Rotate — invalidates the previous raw_key immediately
const rotated = await client.rotateAppApiKey(APP_UUID, created.key_uuid);

// Revoke
await client.revokeAppApiKey(APP_UUID, created.key_uuid);
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

const client = new ButtrbaseClient({ apiKey: 'bb_live_...' });
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

### API Key Exchange (initial + refresh rotation)

```typescript
const client = new ButtrbaseClient({ apiKey: 'unused' });

// 1. Trade the raw key for tokens. The SDK now uses the access_token.
const tokens = await client.exchangeApiKey('bb_live_...');

// 2. When close to access_expires_at, rotate using the refresh token.
const refreshed = await client.exchangeRefreshToken(tokens.refresh_token);
// Persist refreshed.refresh_token — the previous one is rotated and unusable.
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

### Mint an App-level API Key (raw_key shown once)

```typescript
const APP_UUID = '018f1234-5678-7000-8000-000000000001';

const created = await client.createAppApiKey(APP_UUID, {
  name: 'GitHub Actions',
  env: 'live',
  key_type: 'expiring',
  expiry: { in_days: 90 },
});

// WARNING: created.raw_key is shown ONCE. Save it to your secret store now.
process.env.BUTTRBASE_CI_KEY = created.raw_key;
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
  action_prefix: 'api_key.', // e.g. api_key.created, api_key.rotated, api_key.revoked
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
