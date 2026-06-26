# Changelog

## Unreleased — cryptographic RS256 verifier (`Verifier`)

### Added (strictly additive, no breaking changes)

- **`Verifier` class** (`src/verify.ts`) — cryptographic JWT verifier with
  JWKS fetch and caching (backed by `jose`). Mirrors `Verifier` /
  `VerifierConfig` / `verify` / `verify_bearer` from the Rust SDK
  (buttrbase-sdk-rust `src/verify/verifier.rs`).
  - **`new Verifier(config: VerifierConfig)`** — construct once at startup;
    reuse across requests. `config` has `jwksUrl`, `issuer`, and optional
    `audience`.
  - **`verifyToken(token): Promise<Claims>`** — validates RS256 signature
    against the remote JWKS, enforces `iss` and expiry. Enforces `aud` only
    when `audience` is configured (mirrors Rust `validate_aud = false` when
    `audience: None`). Returns the typed `Claims` on success.
  - **`verifyBearer(authHeader): Promise<AuthContext>`** — strips `Bearer `
    from an `Authorization` header value, calls `verifyToken`, and returns
    `AuthContext` via the existing `claimsToAuthContext` helper.
  - **`issuer`** / **`audience`** — read-only accessors (useful for
    diagnostics).
- **`VerifierConfig` interface** — exported from `@buttrbase/client`.
- `jose` added as a production dependency (JWKS fetch/cache + RS256
  verification).

### Dependency added

- `jose` (ESM-first JOSE library by panva; widely used, zero transitive
  dependencies). Added as a `dependency` (not `devDependency`) since the
  `Verifier` class is part of the public runtime API.

---

## 0.5.0 — data envelope: roles / email (mirrors Rust SDK 0.6.0)

### Added (strictly additive)

- **`ClaimsData` interface** — typed shape of the buttrbase `data` JWT claim
  envelope (`roles?`, `email?`, `org_uuid?`, `user_uuid?`, plus an index
  signature for forward-compatible fields).
- **`Claims` interface** — full decoded JWT payload (`sub`, `org`, `exp`,
  `iat`, `scope?`, `data?`).
- **`AuthContext` interface** — the principal callers actually want:
  `userId`, `orgId`, `scopes`, `roles` (split from `data.roles` on
  commas/spaces → `string[]`), and `email` (from `data.email`).
- **`decodeJwtPayload(token)`** — decodes the base64url payload of a JWT
  string and returns the raw `Claims` object. **No signature verification.**
- **`decodeButtrbaseClaims(token)`** — convenience wrapper: decodes the JWT
  payload and converts it to an `AuthContext` via `claimsToAuthContext`.
  **No signature verification** — always verify against the JWKS first.
- **`claimsToAuthContext(claims)`** — converts a `Claims` object (e.g. from
  your own JWKS verification library) to a typed `AuthContext`.
- All three functions are exported from the package root (`@buttrbase/client`).

> **Why no signature verification here?** The SDK already exposes
> `orgJwks(orgUuid)` to fetch the public JWKS. Integrating a full RS256
> verifier would require adding a crypto dependency and entangle Node vs.
> browser APIs. The split — verify externally, decode here — keeps the SDK
> zero-dependency. This mirrors the approach taken in the Rust SDK, where
> `Claims` / `ClaimsData` / `AuthContext` are also separate from the
> `Verifier`.

## Unreleased — magic-link contract aligned with backend

### Breaking
- **`sendMagicLink` signature.** Now `sendMagicLink(email, opts?)` where `opts`
  is `{ appUuid?, redirectTo?, orgUuid? }` (matching the backend's optional
  `app_uuid` / `redirect_to` / `org_uuid` body fields). The previously
  documented positional `sendMagicLink(email, appUuid, opts)` form is removed;
  `appUuid` now lives in `opts`. The endpoint stays `POST /api/auth/magic-link/send`.
- **Magic-link response types.** `MagicLinkSend` is now
  `{ sent: boolean; dev_token: string | null; expires_in_seconds: number }` and
  `MagicLinkVerify` is `{ access_token: string; token_type: string; user: { user_uuid; email }; redirect_to: string | null }`.
  The verify response field is `access_token` (was incorrectly documented as
  `accessToken`).

### Added
- `MagicLinkSendOptions` and `MagicLinkUser` types.
- Cross-app federation support: passing `appUuid` + an allowlisted-origin
  `redirectTo` makes the emailed link target the app's own callback
  (`{redirect_to}?token=...`) so the app verifies the RS256 token itself.
- Expanded README "Magic-link (passwordless sign-in)" section and method
  TSDoc covering RS256-vs-HS256, the send→verify flow, and the redirect
  allowlist.

## Unreleased — static API keys removed; OAuth2 client-credentials only

### Breaking
- **Static API-key auth removed.** The `wb_live_*` / `wb_test_*` keys, the
  `X-API-Key` header, and the api-key→token exchange are no longer supported.
  OAuth2 client-credentials (`client_id` + `client_secret`) is now the single
  app-server credential.
- `ButtrbaseClient` constructor no longer accepts `apiKey`. It now requires
  `clientId` and `clientSecret`, and accepts an optional `accessToken` (a
  pre-obtained bearer). Token-issuing flows (`login`, `authStepUp`, ...)
  replace the bearer on success.
- Removed `exchangeApiKey(apiKey)` and `exchangeRefreshToken(refreshToken)`
  (wrapped `POST /api/v1/auth/api-key/exchange`).
- Removed app-level API-key admin: `listAppApiKeys`, `createAppApiKey`,
  `revokeAppApiKey`, `rotateAppApiKey`.
- Removed org-level API-key admin: `listApiKeysV2`, `createApiKeyV2`,
  `deleteApiKeyV2`.
- Removed types: `ExchangeResponse`, `ApiKeySummary`, `CreatedKeyResponse`,
  `CreateApiKeyInput`, `ApiKeyType`, `ApiKeyEnv`, `ExpiryInput`.

### Added
- **Client-credentials token grant.** New `authenticate()` method wraps
  `POST /api/v1/auth/token` (`grant_type=client_credentials`), exchanging the
  configured `clientId` / `clientSecret` for an app-server bearer and storing
  it for subsequent requests. Authenticated calls now work end-to-end with just
  `clientId` / `clientSecret`: the SDK fetches a bearer lazily before the first
  authed request, caches it, and refreshes it ~30s before `expires_in` lapses.
  A constructor-supplied `accessToken` (or a `login` / `authStepUp` bearer) is
  used as-is and is never auto-refreshed by the grant.

## Unreleased — app_uuid migration

### Breaking
- Methods taking an `app` slug now take `appUuid: string` (UUID):
  `register`, `login`, `sendOtp`, `verifyOtp`, `sendMagicLink`. The backend
  no longer accepts slug aliases (`app`, `appId`, `appName`); requests
  without a valid `app_uuid` are rejected.
- `sendMagicLink` is now `sendMagicLink(email, appUuid, opts)` and posts to
  `/api/auth/magic-link/send` (the `orgUuid` option was removed; supply
  `appUuid` instead).
- `sendOtp(phone, appUuid)` is the canonical name and posts to
  `/api/auth/otp` (previously `/api/auth/otp/send`). `otpSend` is kept as a
  deprecated alias for one release; it will be removed in v1.0.
- `verifyOtp(phone, code, appUuid)` is the canonical name. `otpVerify` is
  kept as a deprecated alias for one release; removed in v1.0.
- `register` is now `register(email, password, appUuid, opts)`; the previous
  `orgName` slug parameter was removed.
- `login` is now `login(email, password, appUuid)`; the previous `orgName`
  slug parameter was removed. The access token is still cached on success.

### Added
- `lookupOrganization(appUuid, { domain?, slug? })` — wraps
  `POST /api/auth/organizations/lookup`.
- `oauthStartUrl(provider, appUuid, returnTo)` — pure URL builder for
  `GET /api/v1/auth/oauth/{provider}/start`. The caller must navigate the
  browser to the returned URL (the backend issues a 302).
- OAuth config admin: `listOAuthConfigs`, `createOAuthConfig`,
  `updateOAuthConfig`, `deleteOAuthConfig`
  (`/api/v1/apps/{app_uuid}/oauth-configs[/...]`).
- `readAuditLog(appUuid, { limit?, action_prefix? })` — wraps
  `GET /api/v1/apps/{app_uuid}/audit-log`.
- Types: `OAuthConfigSummary`, `CreateOAuthConfigInput`,
  `UpdateOAuthConfigInput`, `AuditLogQuery`, `AuditRow`, `OAuthProvider`.

### Passkey support
- `passkeyRegisterBegin()` / `passkeyRegisterComplete(body)` /
  `passkeyAuthenticateBegin()` / `passkeyAuthenticateComplete(body)` — thin
  wrappers over `POST /api/passkeys/{register,authenticate}/{begin,complete}`.
  The WebAuthn challenge / credential blobs are typed as `unknown` and passed
  through unchanged so the browser's `navigator.credentials.create/get` APIs
  can consume / produce them directly. Begin endpoints unwrap the backend's
  `{data: ...}` envelope for ergonomics.
- `listMyPasskeys()` — `GET /api/v1/me/passkeys`. Returns
  `PasskeyListItem[]` in descending `created_at` order.
- `deleteMyPasskey(credentialUuid)` — `DELETE /api/v1/me/passkeys/{uuid}`.
  Owner check is enforced on the backend.
- Types: `PasskeyRegistrationChallenge`, `PasskeyRegistrationComplete`,
  `PasskeyRegistrationResult`, `PasskeyAuthChallenge`, `PasskeyAuthComplete`,
  `PasskeyListItem`.
