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

export interface MagicLinkSend {
  status?: string;
  [k: string]: unknown;
}

export interface MagicLinkVerify {
  token?: string;
  user?: Record<string, unknown>;
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

// ----- Zero-trust endpoints -----

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

// ----- Credentials -----

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

// ----- Sandbox -----

export interface SandboxResetRequest {
  org_uuid?: string;
}

export interface SandboxResetResponse {
  status?: string;
  reset_at?: string;
  [k: string]: unknown;
}

// ----- Invite-based registration -----

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

// ── Registration 0.3.0+ ─────────────────────────────────────────────────────

export type OrgChoiceCreate = { type: 'create'; name: string };
export type OrgChoiceAcceptInvite = { type: 'accept_invite'; invitation_token: string };
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

// ── Invitations ──────────────────────────────────────────────────────────────

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

// ----- Contact forms -----

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

// ----- Geo / IP -----

export interface GeoResponse {
  ip: string;
  country: string;
  timezone: string;
  [k: string]: unknown;
}

// ----- App-level API keys & OAuth (app_uuid migration) -----

export type OAuthProvider = 'google' | 'microsoft' | 'github' | 'apple';
export type ApiKeyType = 'short_lived' | 'permanent' | 'expiring';
export type ApiKeyEnv = 'live' | 'test';
export type ExpiryInput = { absolute: string } | { in_days: number };

export interface ExchangeResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  access_expires_at: string;
  refresh_expires_at: string;
}

export interface ApiKeySummary {
  key_uuid: string;
  app_uuid: string;
  key_prefix: string;
  name: string;
  key_type: ApiKeyType;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedKeyResponse {
  key_uuid: string;
  /** Raw API key — shown ONCE on creation/rotation. Caller must save it immediately. */
  raw_key: string;
  key_prefix: string;
  key_type: ApiKeyType;
  expires_at: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  env: ApiKeyEnv;
  key_type: ApiKeyType;
  expiry?: ExpiryInput;
}

export interface OAuthConfigSummary {
  provider: OAuthProvider;
  client_id: string;
  redirect_uris: string[];
  scopes: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ----- Webhooks -----

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

// ----- Passkeys (WebAuthn) -----

/**
 * Begin-registration response. `challenge` is a WebAuthn
 * `CreationChallengeResponse` that can be passed directly to
 * `navigator.credentials.create({publicKey: challenge.publicKey})`.
 * `registration_state` is an opaque server-signed blob that must be sent back
 * unchanged in the matching complete call (stateless flow).
 */
export interface PasskeyRegistrationChallenge {
  challenge: unknown; // WebAuthn CreationChallengeResponse — browser handles it
  registration_state: string;
}

/**
 * Body for `passkeyRegisterComplete`. `credential` is the WebAuthn
 * `RegisterPublicKeyCredential` returned by the browser.
 */
export interface PasskeyRegistrationComplete {
  registration_state: string;
  credential: unknown; // WebAuthn RegisterPublicKeyCredential
}

export interface PasskeyRegistrationResult {
  credential_id: string;
  message: string;
}

export interface PasskeyAuthChallenge {
  challenge: unknown; // WebAuthn RequestChallengeResponse
  auth_state: string;
}

export interface PasskeyAuthComplete {
  auth_state: string;
  credential: unknown; // WebAuthn PublicKeyCredential
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

// ----- OAuth2 client-credentials token grant -----

export interface AppTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
