export interface CouponValidation {
    valid: boolean;
    code?: string;
    discount_type?: string;
    discount_value?: number;
    [k: string]: unknown;
}
export interface GiftCardValidation {
    valid: boolean;
    code?: string;
    balance_cents?: number;
    [k: string]: unknown;
}
export interface GiftCardRedemption {
    code?: string;
    amount_cents?: number;
    remaining_balance_cents?: number;
    [k: string]: unknown;
}
/**
 * Options for {@link ButtrbaseClient.sendMagicLink}.
 *
 * Pass `appUuid` + `redirectTo` to drive the cross-app federation flow: when
 * the origin of `redirectTo` is allowlisted on the Buttrbase application (its
 * WebAuthn `rp_origins` or configured redirect URL), the emailed link points at
 * the app's own callback (`{redirect_to}?token=...`) so the app verifies the
 * RS256 token itself. Omit `redirectTo` for the first-party (Buttrbase-hosted
 * sign-in page) flow.
 */
export interface MagicLinkSendOptions {
    /** UUID of the Buttrbase application initiating the flow. */
    appUuid?: string;
    /**
     * Absolute URL to redirect to after the link is followed. Only honored when
     * its origin is registered on the application; non-allowlisted or relative
     * targets fall back to the Buttrbase-hosted sign-in page.
     */
    redirectTo?: string;
    /** UUID of the organization to scope the magic-link to. */
    orgUuid?: string;
}
/** Response from `POST /api/auth/magic-link/send`. */
export interface MagicLinkSend {
    /** Whether the magic-link email was dispatched. */
    sent: boolean;
    /**
     * Raw one-time token, returned only in non-prod dev-echo mode; `null` in
     * production. Useful for tests/local development.
     */
    dev_token: string | null;
    /** Seconds until the issued token expires. */
    expires_in_seconds: number;
    [k: string]: unknown;
}
/** Authenticated user returned by `POST /api/auth/magic-link/verify`. */
export interface MagicLinkUser {
    user_uuid: string;
    email: string;
    [k: string]: unknown;
}
/** Response from `POST /api/auth/magic-link/verify`. */
export interface MagicLinkVerify {
    /** JWKS-verifiable RS256 access token. */
    access_token: string;
    /** Token type, e.g. `"Bearer"`. */
    token_type: string;
    /** The signed-in user. */
    user: MagicLinkUser;
    /** Where the caller should redirect post-verify, or `null`. */
    redirect_to: string | null;
    [k: string]: unknown;
}
export interface MfaStatus {
    enrolled?: boolean;
    factors?: unknown[];
    [k: string]: unknown;
}
export interface MfaEnrollment {
    factor_id?: string;
    secret?: string;
    qr_code?: string;
    [k: string]: unknown;
}
export interface OrgSignResponse {
    token: string;
    [k: string]: unknown;
}
export interface Jwk {
    kty: string;
    kid?: string;
    use?: string;
    alg?: string;
    [k: string]: unknown;
}
export interface SecretGet {
    name: string;
    value: string;
    description?: string;
    [k: string]: unknown;
}
export interface SecretSummary {
    name: string;
    description?: string;
    [k: string]: unknown;
}
export interface StepUpResponse {
    access_token: string;
    token_type: string;
    expires_in_seconds: number;
    [k: string]: unknown;
}
export interface ElevationGrant {
    grant_uuid: string;
    org_uuid: string;
    requester_uuid: string;
    approver_uuid?: string | null;
    scope: string;
    reason?: string | null;
    status: string;
    ttl_seconds?: number;
    created_at: string;
    approved_at?: string | null;
    expires_at?: string | null;
    [k: string]: unknown;
}
export interface SpiffeSvidResponse {
    spiffe_id: string;
    svid_pem: string;
    private_key_pem: string;
    issued_at: string;
    expires_at: string;
    [k: string]: unknown;
}
export interface AuthEvent {
    event_uuid?: string;
    org_uuid?: string;
    user_uuid?: string;
    kind: string;
    ip?: string;
    user_agent?: string;
    risk_score?: number;
    occurred_at: string;
    [k: string]: unknown;
}
export interface ReencryptResponse {
    rotated: number;
    failed?: number;
    new_kek_id?: string;
    [k: string]: unknown;
}
export interface RevokeSessionResponse {
    jti: string;
    revoked: boolean;
    expires_at?: string;
    [k: string]: unknown;
}
export interface OrgMetrics {
    active_users?: number;
    active_sessions?: number;
    pending_elevations?: number;
    secrets_count?: number;
    signing_keys_count?: number;
    [k: string]: unknown;
}
/**
 * Response from `POST /api/v1/auth/token` (the OAuth2 client-credentials
 * grant). `expires_in` is the access token lifetime in seconds.
 */
export interface ClientCredentialsTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    [k: string]: unknown;
}
export interface Credential {
    credentials_id: string;
    client_id: string;
    name: string;
    description?: string | null;
    created_at: string;
    [k: string]: unknown;
}
export interface CredentialListResponse {
    data: Credential[];
    [k: string]: unknown;
}
export interface CreateCredentialRequest {
    name: string;
    description?: string;
}
export interface CreateCredentialResponse {
    credentials_id: string;
    client_id: string;
    client_secret: string;
    name: string;
    description?: string | null;
    created_at: string;
    [k: string]: unknown;
}
export interface RotateSecretResponse {
    credentials_id: string;
    client_id: string;
    client_secret: string;
    [k: string]: unknown;
}
export interface SandboxResetRequest {
    org_uuid?: string;
}
export interface SandboxResetResponse {
    status?: string;
    reset_at?: string;
    [k: string]: unknown;
}
export interface InviteAcceptRequest {
    token: string;
    first_name: string;
    last_name: string;
    username: string;
    password: string;
    phone?: string;
}
export interface InviteAcceptResponse {
    user_uuid: string;
    org_uuid: string;
    role: string;
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    message: string;
    [k: string]: unknown;
}
export interface OrgCheckResponse {
    name: string;
    available: boolean;
    [k: string]: unknown;
}
export type OrgChoiceCreate = {
    type: 'create';
    name: string;
};
export type OrgChoiceAcceptInvite = {
    type: 'accept_invite';
    invitation_token: string;
};
export type OrgChoice = OrgChoiceCreate | OrgChoiceAcceptInvite;
export interface FinalizeRegistrationRequest {
    email: string;
    password: string;
    app_uuid: string;
    signup_token: string;
    org_choice: OrgChoice;
    first_name?: string;
    last_name?: string;
}
export interface CheckOrgNameResponse {
    available: boolean;
    reason?: string;
    normalized: string;
}
export interface TokenPair {
    token: string;
    refresh_token?: string;
    user_uuid?: string;
}
/** Full response from finalizeRegistration and register. */
export interface RegistrationResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in?: number;
    user_uuid: string;
    /** UUID of the org that was created or joined. */
    org_uuid: string;
    /** Role the user holds in that org ("admin" for new orgs, or whatever the invitation granted). */
    role: string;
    message?: string;
}
export interface CreateInvitationRequest {
    email?: string;
    role?: string;
    expires_in_hours?: number;
}
export interface InvitationResponse {
    id: number;
    org_uuid: string;
    email?: string;
    role: string;
    expires_at: string;
    token: string;
    signup_url: string;
}
export interface InvitationPreview {
    org_uuid: string;
    org_name: string;
    email?: string;
    role: string;
    expires_at: string;
    valid: boolean;
    invalid_reason?: string;
}
export interface AcceptInvitationResponse {
    org_uuid: string;
    org_name: string;
    role: string;
}
export interface InvitationListItem {
    id: number;
    email?: string;
    role: string;
    expires_at: string;
    accepted_at?: string;
    revoked_at?: string;
}
export interface SuperuserResponse {
    email: string;
    is_superuser: boolean;
    [k: string]: unknown;
}
export interface ContactRequest {
    name: string;
    email: string;
    message: string;
    company?: string;
    app_id?: string;
}
export interface ContactUsRequest {
    name: string;
    email: string;
    subject: string;
    message: string;
}
export interface ContactSubmitResponse {
    message: string;
    reference_id: string;
    [k: string]: unknown;
}
export interface GeoResponse {
    ip: string;
    country: string;
    timezone: string;
    [k: string]: unknown;
}
export type OAuthProvider = 'google' | 'microsoft' | 'github' | 'apple';
export interface OAuthConfigSummary {
    provider: OAuthProvider;
    client_id: string;
    redirect_uris: string[];
    scopes: string[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface WebhookEndpoint {
    id: number;
    url: string;
    event_types: string[];
    is_active: boolean;
    description?: string;
    secret_present: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateOAuthConfigInput {
    provider: OAuthProvider;
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    scopes: string[];
    enabled?: boolean;
    /**
     * Provider-specific extras as a JSON object. Required for Apple sign-in
     * (`{team_id, key_id, private_key}` — `private_key` is the .p8 PEM body);
     * the backend strips the `private_key` field and re-stores it as
     * `private_key_encrypted` under the app's DEK. Optional for providers
     * that don't need extras (Google, Microsoft, GitHub).
     */
    provider_extras?: Record<string, unknown>;
}
export interface UpdateOAuthConfigInput {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
    scopes?: string[];
    enabled?: boolean;
    /**
     * Replace `provider_extras` entirely. For Apple, a fresh `private_key`
     * triggers re-encryption under the app's DEK and rotates the stored
     * ciphertext. Omit to leave existing extras alone.
     */
    provider_extras?: Record<string, unknown>;
}
export interface AppRpConfig {
    app_uuid: string;
    /** `null` means the app falls back to the deployment-wide `BUTTRBASE_WEBAUTHN_RP_ID` env var. */
    rp_id: string | null;
    rp_origins: string[];
}
export interface UpdateAppRpConfigInput {
    rp_id?: string;
    rp_origins?: string[];
}
export interface AuditLogQuery {
    limit?: number;
    action_prefix?: string;
}
export interface AuditRow {
    id: number;
    app_uuid: string;
    actor_user_uuid: string | null;
    action: string;
    target_id: string | null;
    details: unknown;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
}
/**
 * Request body for `scopeContext`. `requested_scopes` is the explicit scope
 * list the caller wants windowed into a fresh access token (v1; a
 * named-context→scopes mapping may come later). Each requested scope must be a
 * subset of the caller's effective scopes and pass the scope-gate (step-up)
 * machinery — otherwise the backend returns 403 (forbidden) or 401
 * (step_up_required) and mints nothing.
 */
export interface ScopeContextRequest {
    requested_scopes: string[];
}
/**
 * Response from `POST /api/app/auth/scope-context`. `token` is a freshly
 * re-minted access token whose claims carry ONLY the granted (windowed) scope
 * set; `scopes` is that granted set (de-duplicated and sorted). The refresh
 * token is unchanged — only the access token is re-minted.
 */
export interface ScopeContextResponse {
    token: string;
    scopes: string[];
    [k: string]: unknown;
}
/**
 * A single device row from `GET /api/app/devices`. Public-safe: `jkt` is the
 * device key's public JWK thumbprint — no private key material is ever
 * returned.
 */
export interface DeviceItem {
    device_uuid: string;
    jkt: string;
    label: string | null;
    created_at: string;
    last_seen_at: string | null;
}
export interface RevokeDeviceResponse {
    device_uuid: string;
    revoked: boolean;
    [k: string]: unknown;
}
/**
 * Public routing info from `GET /api/tenant/home`. Returned only for an ACTIVE
 * tenant; unknown or non-active tenants yield a 404 (`ButtrbaseError`).
 */
export interface TenantHome {
    tenancy_mode: string;
    home_region: string | null;
    home_base_url: string | null;
    [k: string]: unknown;
}
/**
 * Begin-registration response. `challenge` is a WebAuthn
 * `CreationChallengeResponse` that can be passed directly to
 * `navigator.credentials.create({publicKey: challenge.publicKey})`.
 * `registration_state` is an opaque server-signed blob that must be sent back
 * unchanged in the matching complete call (stateless flow).
 */
export interface PasskeyRegistrationChallenge {
    challenge: unknown;
    registration_state: string;
}
/**
 * Body for `passkeyRegisterComplete`. `credential` is the WebAuthn
 * `RegisterPublicKeyCredential` returned by the browser.
 */
export interface PasskeyRegistrationComplete {
    registration_state: string;
    credential: unknown;
}
export interface PasskeyRegistrationResult {
    credential_id: string;
    message: string;
}
export interface PasskeyAuthChallenge {
    challenge: unknown;
    auth_state: string;
}
export interface PasskeyAuthComplete {
    auth_state: string;
    credential: unknown;
}
/**
 * A single row returned by `GET /api/v1/me/passkeys`.
 *
 * `credentialIdPrefix` is the first 12 characters of the WebAuthn credential
 * ID — enough to disambiguate in a dashboard table without exposing the full
 * identifier. JSON fields stay snake_case to match the wire format.
 */
export interface PasskeyListItem {
    credential_uuid: string;
    credential_id_prefix: string;
    app_uuid: string | null;
    nickname: string | null;
    last_used_at: string | null;
    created_at: string;
}
export interface WebhookDelivery {
    id: number;
    endpoint_id: number;
    event_type: string;
    status: string;
    http_status?: number;
    response_body?: string;
    attempt_count: number;
    created_at: string;
    delivered_at?: string;
}
/**
 * Access token returned by refreshToken(). Mirrors Rust `AccessToken`.
 */
export interface AccessToken {
    /** The new access token. */
    token: string;
    /** New refresh token (may rotate). */
    refresh_token?: string | null;
}
/** Single entitlement check result. Mirrors Rust `EntitlementResult`. */
export interface EntitlementResult {
    granted: boolean;
    reason?: string | null;
}
/** Single effective entitlement row. Mirrors Rust `EffectiveEntitlement`. */
export interface EffectiveEntitlement {
    feature_key: string;
    granted: boolean;
    reason?: string | null;
}
/** Wallet balance summary. Mirrors Rust `WalletSummary`. */
export interface WalletSummary {
    balance_cents: number;
    budget_limit_cents?: number | null;
    budget_period?: string | null;
    [k: string]: unknown;
}
/** Single wallet transaction. Mirrors Rust `WalletTransaction`. */
export interface WalletTransaction {
    id: number;
    kind: string;
    amount_cents: number;
    description?: string | null;
    created_at: string;
    [k: string]: unknown;
}
/** Single subscription row. Mirrors Rust `SubscriptionItem`. */
export interface SubscriptionItem {
    id: number;
    user_uuid?: string | null;
    price_id?: number | null;
    provider: string;
    provider_subscription_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    [k: string]: unknown;
}
/** Typed request for pricingPreview / pricingQuote. Mirrors Rust `PricingPreviewRequest`. */
export interface PricingPreviewRequest {
    price_id: number;
    coupon_code?: string;
    seats?: number;
    country?: string;
}
/** Response from pricing preview. Mirrors Rust `PricingPreview`. */
export interface PricingPreview {
    amount_cents: number;
    currency: string;
    discount_cents?: number | null;
    tax_cents?: number | null;
    final_cents: number;
    region_resolved?: string | null;
    [k: string]: unknown;
}
/** Typed request for checkoutSession. Mirrors Rust `CheckoutSessionRequest`. */
export interface CheckoutSessionRequest {
    price_id: number;
    quote_id?: string;
}
/** Response from checkout session. Mirrors Rust `CheckoutSession`. */
export interface CheckoutSession {
    payment_url: string;
    session_id?: string | null;
    provider: string;
    [k: string]: unknown;
}
/** Typed usage event for reportUsage(). Mirrors Rust `UsageEvent`. */
export interface UsageEvent {
    metric: string;
    quantity: number;
    org_uuid?: string;
    app_uuid?: string;
    timestamp?: string;
}
/** Typed analytics event for ingestEvent(). Mirrors Rust `AnalyticsEvent`. */
export interface AnalyticsEvent {
    event_type: string;
    properties?: Record<string, unknown>;
    timestamp?: string;
}
/** App entry returned by myApps(). Mirrors Rust `AppEntry`. */
export interface AppEntry {
    app_uuid: string;
    app_name: string;
    role?: string | null;
    [k: string]: unknown;
}
/** Org entry returned by appOrgs(). Mirrors Rust `OrgEntry`. */
export interface OrgEntry {
    org_uuid: string;
    org_name: string;
    role?: string | null;
    [k: string]: unknown;
}
/** Individual credential info. Mirrors Rust `AppCredentialInfo`. */
export interface AppCredentialInfo {
    environment: string;
    client_id: string;
    client_secret_prefix?: string | null;
    is_active: boolean;
    created_at?: string | null;
    rotated_at?: string | null;
}
/** Response from appCredentials(). Mirrors Rust `AppCredentialsResponse`. */
export interface AppCredentialsResponse {
    app_name: string;
    sandbox_enabled: boolean;
    live?: AppCredentialInfo | null;
    sandbox?: AppCredentialInfo | null;
    [k: string]: unknown;
}
/** Invoice row. Mirrors Rust `Invoice`. */
export interface Invoice {
    id: number;
    user_id?: number;
    subscription_id?: number | null;
    provider: string;
    provider_invoice_id: string;
    amount: number;
    status: string;
    invoice_pdf_url?: string | null;
    created_at: string;
    updated_at: string;
    [k: string]: unknown;
}
/** Team row. Mirrors Rust `TeamItem`. */
export interface TeamItem {
    id: number;
    team_uuid: string;
    org_uuid: string;
    name: string;
    description?: string | null;
    [k: string]: unknown;
}
/**
 * Identity enrichment carried under the buttrbase `data` claim envelope.
 * All fields are optional — tokens without a `data` block parse fine with
 * every field absent.
 *
 * Mirrors the Rust SDK's `ClaimsData` (added in 0.6.0 of that crate).
 */
export interface ClaimsData {
    /** Comma/space-delimited role string, e.g. `"owner"` or `"org_admin,leadership"`. */
    roles?: string;
    email?: string;
    org_uuid?: string;
    user_uuid?: string;
    [k: string]: unknown;
}
/**
 * Decoded payload of a buttrbase-issued JWT. The `data` envelope is optional —
 * tokens minted without identity enrichment omit it entirely.
 *
 * Mirrors the Rust SDK's `Claims` struct.
 */
export interface Claims {
    sub: string;
    org: string;
    exp: number;
    iat: number;
    scope?: string[];
    data?: ClaimsData;
    [k: string]: unknown;
}
/**
 * What handlers usually want: the principal + grants, with JWT-infrastructure
 * fields stripped. `roles` is derived by splitting `data.roles` on commas and
 * spaces (matching the Rust SDK `AuthContext`).
 *
 * Returned by {@link decodeButtrbaseClaims}.
 */
export interface AuthContext {
    /** `sub` claim — the user's UUID. */
    userId: string;
    /** `org` claim — the organisation UUID. */
    orgId: string;
    /** Token scope list (empty when absent). */
    scopes: string[];
    /**
     * Roles derived from `data.roles` (comma/space-delimited → `string[]`).
     * Empty when the `data` envelope is absent or carries no `roles` field.
     */
    roles: string[];
    /** Caller email from `data.email`, or `undefined`. */
    email?: string;
}
