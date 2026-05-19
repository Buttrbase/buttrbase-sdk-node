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
