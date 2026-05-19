# Node.js / TypeScript SDK

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

// Login
const resp = await client.login('user@example.com', 'password', 'acme');
console.log(resp.access_token);

// Get profile
const profile = await client.getProfile();
```

## Authentication

### Register

```typescript
const resp = await client.register('user@example.com', 'password', 'acme', {
  firstName: 'Jane', lastName: 'Doe'
});
```

### Login Options

```typescript
const options = await client.getLoginOptions('org-uuid');
```

### Magic Link

```typescript
await client.sendMagicLink('user@example.com', { redirectTo: 'https://app.example.com' });
const resp = await client.verifyMagicLink('token-from-email');
console.log(resp.accessToken);  // JWT with sub, org, aud claims
```

### OTP (Passwordless Phone)

```typescript
await client.otpSend('+15551234567');
const resp = await client.otpVerify('+15551234567', '123456');
```

### SSO (OIDC / SAML)

```typescript
const oidcUrl = await client.oidcAuthorizeUrl('connection-uuid');
const samlUrl = await client.samlAuthorizeUrl('connection-uuid');
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

## API Keys v2

```typescript
const keys = await client.listApiKeysV2('org-uuid');
const newKey = await client.createApiKeyV2('org-uuid', 'my-api-key');
await client.deleteApiKeyV2('org-uuid', 'key-uuid');
```

## Entitlements

```typescript
const check = await client.entitlementsCheck({ feature: 'advanced-analytics', org_uuid: '...' });
const batch = await client.entitlementsCheckBatch({ checks: [...] });
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
const cert = await client.issueCertificate('org-uuid', { csr: '...' });
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
await client.verifyDomain('org-uuid', 1);

const endpoints = await client.listWebhookEndpoints('org-uuid');
await client.createWebhookEndpoint('org-uuid', 'https://hook.example.com', ['user.created']);
```

## Payments

```typescript
const session = await client.createPaymentCheckout({ amount: 5000, currency: 'usd' });
const invoice = await client.sendInvoice({ amount: 5000, customer_email: 'buyer@example.com' });
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
await client.verifyEmailIdentity('user@example.com');
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

// 1. Register and login
await client.register('admin@acme.com', 's3cur3!', 'Acme Corp', { firstName: 'Alice' });
const login = await client.login('admin@acme.com', 's3cur3!', 'Acme Corp');

// 2. Get profile
const profile = await client.getProfile();

// 3. Create a team and add a member
const team = await client.createTeam({ name: 'Engineering', org_uuid: profile.org.uuid });
await client.addTeamMember(team.uuid, 'colleague-user-uuid');
```

### MFA Enrollment

```typescript
// 1. Check MFA status
const status = await client.mfaStatus();

// 2. Enroll in TOTP — returns secret + QR URL
const enrollment = await client.mfaEnroll();
console.log(`Scan this QR: ${enrollment.qr_code_url}`);

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
const conn = await client.createSsoConnection('org-uuid', {
  provider: 'okta', name: 'Okta SSO',
  config: { domain: 'myorg.okta.com', client_id: '...', client_secret: '...' },
});

// 2. Get the authorize URL
const url = await client.oidcAuthorizeUrl(conn.connection_uuid);

// 3. Handle callback (on your server)
const resp = await client.oidcCallback(conn.connection_uuid, { code: 'auth-code' });
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
