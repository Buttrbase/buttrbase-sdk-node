# Changelog

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
