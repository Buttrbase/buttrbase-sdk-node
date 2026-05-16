import { ButtrbaseError } from './errors.js';
import type {
  CouponValidation,
  GiftCardValidation,
  GiftCardRedemption,
  MagicLinkSend,
  MagicLinkVerify,
  MfaStatus,
  MfaEnrollment,
  OrgSignResponse,
  Jwk,
  SecretGet,
  SecretSummary,
  StepUpResponse,
  ElevationGrant,
  SpiffeSvidResponse,
  AuthEvent,
  ReencryptResponse,
  RevokeSessionResponse,
  OrgMetrics,
  Credential,
  CredentialListResponse,
  CreateCredentialResponse,
  RotateSecretResponse,
  SandboxResetResponse,
} from './types.js';

export interface ButtrbaseClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://stagingapi.buttrbase.com';

export class ButtrbaseClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(opts: ButtrbaseClientOptions) {
    if (!opts.apiKey) throw new Error('apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) throw new Error('No fetch implementation available');
    this.fetchImpl = f.bind(globalThis);
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; auth?: boolean; query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const auth = opts.auth ?? true;
    let url = `${this.baseUrl}${path}`;
    if (opts.query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) for (const item of v) qs.append(k, String(item));
        else qs.append(k, String(v));
      }
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers.Authorization = `Bearer ${this.apiKey}`;
    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await this.fetchImpl(url, { method, headers, body });
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      let detail = res.statusText || 'request failed';
      if (parsed && typeof parsed === 'object' && 'detail' in (parsed as Record<string, unknown>)) {
        const d = (parsed as Record<string, unknown>).detail;
        if (typeof d === 'string') detail = d;
        else detail = JSON.stringify(d);
      } else if (typeof parsed === 'string' && parsed) {
        detail = parsed;
      }
      throw new ButtrbaseError(res.status, detail, parsed);
    }
    return parsed as T;
  }

  validateCoupon(
    code: string,
    opts: { cartLabels?: string[]; productId?: number } = {},
  ): Promise<CouponValidation> {
    const body: Record<string, unknown> = { code };
    if (opts.cartLabels !== undefined) body.cart_labels = opts.cartLabels;
    if (opts.productId !== undefined) body.product_id = opts.productId;
    return this.request<CouponValidation>('POST', '/v1/coupons/validate', { body });
  }

  validateGiftCard(code: string): Promise<GiftCardValidation> {
    return this.request<GiftCardValidation>('POST', '/v1/gift-cards/validate', { body: { code } });
  }

  redeemGiftCard(
    code: string,
    amountCents: number,
    userId?: number,
  ): Promise<GiftCardRedemption> {
    const body: Record<string, unknown> = { code, amount_cents: amountCents };
    if (userId !== undefined) body.user_id = userId;
    return this.request<GiftCardRedemption>('POST', '/v1/gift-cards/redeem', { body });
  }

  sendMagicLink(
    email: string,
    opts: { orgUuid?: string; redirectTo?: string } = {},
  ): Promise<MagicLinkSend> {
    const body: Record<string, unknown> = { email };
    if (opts.orgUuid !== undefined) body.org_uuid = opts.orgUuid;
    if (opts.redirectTo !== undefined) body.redirect_to = opts.redirectTo;
    return this.request<MagicLinkSend>('POST', '/v1/auth/magic-link/send', { body });
  }

  verifyMagicLink(token: string): Promise<MagicLinkVerify> {
    return this.request<MagicLinkVerify>('POST', '/v1/auth/magic-link/verify', { body: { token } });
  }

  mfaStatus(): Promise<MfaStatus> {
    return this.request<MfaStatus>('GET', '/v1/auth/mfa/status');
  }

  mfaEnroll(label?: string): Promise<MfaEnrollment> {
    const body: Record<string, unknown> = {};
    if (label !== undefined) body.label = label;
    return this.request<MfaEnrollment>('POST', '/v1/auth/mfa/enroll', { body });
  }

  mfaActivate(code: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', '/v1/auth/mfa/activate', { body: { code } });
  }

  orgSign(
    orgUuid: string,
    claims: Record<string, unknown>,
    opts: { ttlSeconds?: number } = {},
  ): Promise<OrgSignResponse> {
    const body: Record<string, unknown> = { claims };
    if (opts.ttlSeconds !== undefined) body.ttl_seconds = opts.ttlSeconds;
    return this.request<OrgSignResponse>('POST', `/v1/orgs/${encodeURIComponent(orgUuid)}/sign`, {
      body,
    });
  }

  orgJwks(orgUuid: string): Promise<{ keys: Jwk[] }> {
    return this.request<{ keys: Jwk[] }>(
      'GET',
      `/v1/orgs/${encodeURIComponent(orgUuid)}/.well-known/jwks.json`,
      { auth: false },
    );
  }

  getSecret(orgUuid: string, name: string): Promise<SecretGet> {
    return this.request<SecretGet>(
      'GET',
      `/v1/orgs/${encodeURIComponent(orgUuid)}/secrets/${encodeURIComponent(name)}`,
    );
  }

  putSecret(
    orgUuid: string,
    name: string,
    value: string,
    description?: string,
  ): Promise<SecretSummary> {
    const body: Record<string, unknown> = { value };
    if (description !== undefined) body.description = description;
    return this.request<SecretSummary>(
      'PUT',
      `/v1/orgs/${encodeURIComponent(orgUuid)}/secrets/${encodeURIComponent(name)}`,
      { body },
    );
  }

  // ===== Zero-trust endpoints =====

  /**
   * POST /api/auth/step-up — exchange MFA code for a short-lived elevated
   * access token (~5 min). On success, the SDK's bearer is REPLACED with
   * the returned `access_token` so subsequent admin/JIT calls are elevated.
   */
  async authStepUp(code: string, recovery = false): Promise<StepUpResponse> {
    const body: Record<string, unknown> = { code, recovery };
    const res = await this.request<StepUpResponse>('POST', '/api/auth/step-up', { body });
    if (res && res.access_token) {
      this.apiKey = res.access_token;
    }
    return res;
  }

  // ----- JIT elevation (admin) — all require an active step-up session -----

  /** POST /api/admin/orgs/{org}/elevation/request */
  elevationRequest(
    orgUuid: string,
    scope: string,
    opts: { reason?: string; ttlSeconds?: number } = {},
  ): Promise<ElevationGrant> {
    const body: Record<string, unknown> = { scope };
    if (opts.reason !== undefined) body.reason = opts.reason;
    if (opts.ttlSeconds !== undefined) body.ttl_seconds = opts.ttlSeconds;
    return this.request<ElevationGrant>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/elevation/request`,
      { body },
    );
  }

  /**
   * POST /api/admin/orgs/{org}/elevation/{grant}/approve.
   * Server returns 403 if the approver is the same admin as the requester.
   */
  elevationApprove(orgUuid: string, grantUuid: string): Promise<ElevationGrant> {
    return this.request<ElevationGrant>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/elevation/${encodeURIComponent(grantUuid)}/approve`,
    );
  }

  /** GET /api/admin/orgs/{org}/elevation */
  elevationList(orgUuid: string, status?: string): Promise<ElevationGrant[]> {
    const query: Record<string, unknown> = {};
    if (status !== undefined) query.status = status;
    return this.request<ElevationGrant[]>(
      'GET',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/elevation`,
      { query },
    );
  }

  /** POST /api/admin/orgs/{org}/spiffe/svid — issue an X.509 SVID. */
  spiffeIssueSvid(
    orgUuid: string,
    workloadPath: string,
    opts: { ttlSeconds?: number } = {},
  ): Promise<SpiffeSvidResponse> {
    const body: Record<string, unknown> = { workload_path: workloadPath };
    if (opts.ttlSeconds !== undefined) body.ttl_seconds = opts.ttlSeconds;
    return this.request<SpiffeSvidResponse>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/spiffe/svid`,
      { body },
    );
  }

  /** GET /api/admin/orgs/{org}/auth-events — context-aware audit events. */
  listAuthEvents(
    orgUuid: string,
    opts: { userUuid?: string; limit?: number } = {},
  ): Promise<AuthEvent[]> {
    const query: Record<string, unknown> = { limit: opts.limit ?? 50 };
    if (opts.userUuid !== undefined) query.user_uuid = opts.userUuid;
    return this.request<AuthEvent[]>(
      'GET',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/auth-events`,
      { query },
    );
  }

  /** POST /api/admin/orgs/{org}/reencrypt/secrets */
  reencryptSecrets(orgUuid: string): Promise<ReencryptResponse> {
    return this.request<ReencryptResponse>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/reencrypt/secrets`,
    );
  }

  /** POST /api/admin/orgs/{org}/reencrypt/signing-keys */
  reencryptSigningKeys(orgUuid: string): Promise<ReencryptResponse> {
    return this.request<ReencryptResponse>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/reencrypt/signing-keys`,
    );
  }

  /** POST /api/admin/orgs/{org}/reencrypt/mtls-ca */
  reencryptMtlsCa(orgUuid: string): Promise<ReencryptResponse> {
    return this.request<ReencryptResponse>(
      'POST',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/reencrypt/mtls-ca`,
    );
  }

  /** POST /api/admin/sessions/revoke — add `jti` to the revocation list. */
  revokeSession(jti: string, ttlSeconds?: number): Promise<RevokeSessionResponse> {
    const body: Record<string, unknown> = { jti };
    if (ttlSeconds !== undefined) body.ttl_seconds = ttlSeconds;
    return this.request<RevokeSessionResponse>(
      'POST',
      '/api/admin/sessions/revoke',
      { body },
    );
  }

  /** GET /api/admin/orgs/{org}/metrics */
  getOrgMetrics(orgUuid: string): Promise<OrgMetrics> {
    return this.request<OrgMetrics>(
      'GET',
      `/api/admin/orgs/${encodeURIComponent(orgUuid)}/metrics`,
    );
  }

  // ===== Credentials =====

  /** GET /credentials — list all API credentials for the authenticated account. */
  listCredentials(): Promise<CredentialListResponse> {
    return this.request<CredentialListResponse>('GET', '/credentials');
  }

  /**
   * POST /credentials — create a new API credential.
   * Returns 201 with the full credential including `client_secret` (shown only once).
   */
  createCredential(name: string, description?: string): Promise<CreateCredentialResponse> {
    const body: Record<string, unknown> = { name };
    if (description !== undefined) body.description = description;
    return this.request<CreateCredentialResponse>('POST', '/credentials', { body });
  }

  /** GET /credentials/:id — fetch a credential by ID (no `client_secret`). */
  getCredential(id: string): Promise<Credential> {
    return this.request<Credential>('GET', `/credentials/${encodeURIComponent(id)}`);
  }

  /** DELETE /credentials/:id — permanently delete a credential (returns void on 204). */
  async deleteCredential(id: string): Promise<void> {
    await this.request<unknown>('DELETE', `/credentials/${encodeURIComponent(id)}`);
  }

  /**
   * POST /credentials/:id/rotate-secret — rotate the client secret for a credential.
   * Returns new `client_id` and `client_secret`.
   */
  rotateCredentialSecret(id: string): Promise<RotateSecretResponse> {
    return this.request<RotateSecretResponse>(
      'POST',
      `/credentials/${encodeURIComponent(id)}/rotate-secret`,
    );
  }

  // ===== Sandbox =====

  /**
   * POST /api/sandbox/reset — reset the sandbox environment.
   * Optionally scoped to a specific org via `orgUuid`.
   */
  resetSandbox(orgUuid?: string): Promise<SandboxResetResponse> {
    const body: Record<string, unknown> = {};
    if (orgUuid !== undefined) body.org_uuid = orgUuid;
    return this.request<SandboxResetResponse>('POST', '/api/sandbox/reset', { body });
  }

  // ===== Auth =====

  /** POST /api/auth/register */
  register(
    email: string,
    password: string,
    orgName: string,
    opts: { firstName?: string; lastName?: string } = {},
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { email, password, org_name: orgName };
    if (opts.firstName !== undefined) body.first_name = opts.firstName;
    if (opts.lastName !== undefined) body.last_name = opts.lastName;
    return this.request<Record<string, unknown>>('POST', '/api/auth/register', { body, auth: false });
  }

  /** POST /api/auth/login — stores access_token on success. */
  async login(email: string, password: string, orgName: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { email, password, org_name: orgName };
    const res = await this.request<Record<string, unknown>>('POST', '/api/auth/login', { body, auth: false });
    if (res && typeof res.access_token === 'string') {
      this.apiKey = res.access_token;
    }
    return res;
  }

  /** GET /api/auth/organizations/{org_uuid}/login-options */
  getLoginOptions(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/auth/organizations/${encodeURIComponent(orgUuid)}/login-options`,
      { auth: false },
    );
  }

  /** GET /api/auth/status */
  getStatus(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/auth/status');
  }

  /** GET /api/profile */
  getProfile(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/profile');
  }

  /** PUT /api/profile */
  updateProfile(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('PUT', '/api/profile', { body: data });
  }

  /** GET /api/auth/orgs-by-domain/{domain} */
  getOrgByDomain(domain: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/auth/orgs-by-domain/${encodeURIComponent(domain)}`,
      { auth: false },
    );
  }

  // ===== OTP =====

  /** POST /api/auth/otp/send */
  otpSend(phone: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/otp/send', { body: { phone } });
  }

  /** POST /api/auth/otp/verify */
  otpVerify(phone: string, code: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/otp/verify', { body: { phone, code } });
  }

  // ===== MFA (extended) =====

  /** POST /api/auth/mfa/totp/verify */
  mfaVerify(code: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/mfa/totp/verify', { body: { code } });
  }

  /** POST /api/auth/mfa/totp/challenge */
  mfaChallenge(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/mfa/totp/challenge');
  }

  /** DELETE /api/auth/mfa/totp */
  mfaDisable(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('DELETE', '/api/auth/mfa/totp');
  }

  /** POST /api/auth/mfa/recovery-codes */
  mfaGenerateRecoveryCodes(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/mfa/recovery-codes');
  }

  /** POST /api/auth/mfa/recovery-codes/redeem */
  mfaRedeemRecoveryCode(code: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/auth/mfa/recovery-codes/redeem', { body: { code } });
  }

  // ===== SSO =====

  /** GET /api/auth/oidc/{connection_uuid}/authorize */
  oidcAuthorizeUrl(connectionUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/auth/oidc/${encodeURIComponent(connectionUuid)}/authorize`,
      { auth: false },
    );
  }

  /** GET /api/auth/saml/{connection_uuid}/authorize */
  samlAuthorizeUrl(connectionUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/auth/saml/${encodeURIComponent(connectionUuid)}/authorize`,
      { auth: false },
    );
  }

  // ===== Users =====

  /** GET /api/users */
  listUsers(filters?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/users', { query: filters });
  }

  /** GET /api/users/{user_uuid}/level */
  getUserLevel(userUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/users/${encodeURIComponent(userUuid)}/level`,
    );
  }

  /** POST /api/users/{user_uuid}/level */
  setUserLevel(userUuid: string, userType: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/users/${encodeURIComponent(userUuid)}/level`,
      { body: { user_type: userType } },
    );
  }

  /** PUT /api/users/{user_uuid}/status */
  updateUserStatus(userUuid: string, active: boolean): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/users/${encodeURIComponent(userUuid)}/status`,
      { body: { active } },
    );
  }

  /** PUT /api/users/{user_uuid}/role */
  updateUserRole(userUuid: string, role: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/users/${encodeURIComponent(userUuid)}/role`,
      { body: { role } },
    );
  }

  // ===== Org Security =====

  /** GET /api/organizations/{org_uuid}/security-settings */
  getSecuritySettings(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/security-settings`,
    );
  }

  /** PUT /api/organizations/{org_uuid}/security-settings */
  updateSecuritySettings(orgUuid: string, settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/organizations/${encodeURIComponent(orgUuid)}/security-settings`,
      { body: settings },
    );
  }

  /** GET /api/organizations/{org_uuid}/sso-connections */
  listSsoConnections(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/sso-connections`,
    );
  }

  /** POST /api/organizations/{org_uuid}/sso-connections */
  createSsoConnection(
    orgUuid: string,
    provider: string,
    name: string,
    config: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/organizations/${encodeURIComponent(orgUuid)}/sso-connections`,
      { body: { provider, name, config } },
    );
  }

  /** PUT /api/organizations/{org_uuid}/sso-connections/{connection_uuid} */
  updateSsoConnection(
    orgUuid: string,
    connectionUuid: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/organizations/${encodeURIComponent(orgUuid)}/sso-connections/${encodeURIComponent(connectionUuid)}`,
      { body: data },
    );
  }

  /** DELETE /api/organizations/{org_uuid}/sso-connections/{connection_uuid} */
  async deleteSsoConnection(orgUuid: string, connectionUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/organizations/${encodeURIComponent(orgUuid)}/sso-connections/${encodeURIComponent(connectionUuid)}`,
    );
  }

  /** GET /api/organizations/{org_uuid}/audit-events */
  listAuditEvents(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/audit-events`,
    );
  }

  /** GET /api/organizations/{org_uuid}/audit-events/export */
  exportAuditEvents(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/audit-events/export`,
    );
  }

  // ===== Branding =====

  /** GET /api/organizations/{org_uuid}/branding */
  getBranding(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/branding`,
    );
  }

  /** PUT /api/organizations/{org_uuid}/branding */
  updateBranding(orgUuid: string, branding: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/organizations/${encodeURIComponent(orgUuid)}/branding`,
      { body: branding },
    );
  }

  // ===== Sessions =====

  /** GET /api/organizations/{org_uuid}/session-inventory */
  orgSessionInventory(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/session-inventory`,
    );
  }

  /** POST /api/organizations/{org_uuid}/revoke-all-sessions */
  orgRevokeAllSessions(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/organizations/${encodeURIComponent(orgUuid)}/revoke-all-sessions`,
    );
  }

  /** GET /api/devices/{device_uuid}/accounts */
  listDeviceAccounts(deviceUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/devices/${encodeURIComponent(deviceUuid)}/accounts`,
    );
  }

  /** POST /api/devices/{device_uuid}/accounts */
  addDeviceAccount(deviceUuid: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/devices/${encodeURIComponent(deviceUuid)}/accounts`,
      { body: data },
    );
  }

  /** DELETE /api/devices/{device_uuid}/accounts */
  async deleteDeviceAccounts(deviceUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/devices/${encodeURIComponent(deviceUuid)}/accounts`,
    );
  }

  /** DELETE /api/devices/{device_uuid}/accounts/{account_uuid} */
  async deleteDeviceAccount(deviceUuid: string, accountUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/devices/${encodeURIComponent(deviceUuid)}/accounts/${encodeURIComponent(accountUuid)}`,
    );
  }

  /** POST /api/devices/{device_uuid}/active-account */
  switchDeviceActiveAccount(deviceUuid: string, accountUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/devices/${encodeURIComponent(deviceUuid)}/active-account`,
      { body: { account_uuid: accountUuid } },
    );
  }

  /** GET /api/devices/{device_uuid}/session-inventory */
  deviceSessionInventory(deviceUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/devices/${encodeURIComponent(deviceUuid)}/session-inventory`,
    );
  }

  /** POST /api/devices/{device_uuid}/revoke-all */
  revokeAllDeviceSessions(deviceUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/devices/${encodeURIComponent(deviceUuid)}/revoke-all`,
    );
  }

  // ===== API Keys v2 =====

  /** GET /api/v2/organizations/{org_uuid}/api-keys */
  listApiKeysV2(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/v2/organizations/${encodeURIComponent(orgUuid)}/api-keys`,
    );
  }

  /** POST /api/v2/organizations/{org_uuid}/api-keys */
  createApiKeyV2(orgUuid: string, name: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/v2/organizations/${encodeURIComponent(orgUuid)}/api-keys`,
      { body: { name } },
    );
  }

  /** DELETE /api/v2/organizations/{org_uuid}/api-keys/{key_uuid} */
  async deleteApiKeyV2(orgUuid: string, keyUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/v2/organizations/${encodeURIComponent(orgUuid)}/api-keys/${encodeURIComponent(keyUuid)}`,
    );
  }

  // ===== Service Identities =====

  /** GET /api/organizations/{org_uuid}/service-identities */
  listServiceIdentities(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/service-identities`,
    );
  }

  /** POST /api/organizations/{org_uuid}/service-identities */
  createServiceIdentity(orgUuid: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/organizations/${encodeURIComponent(orgUuid)}/service-identities`,
      { body: payload },
    );
  }

  /** DELETE /api/organizations/{org_uuid}/service-identities/{key_uuid} */
  async deleteServiceIdentity(orgUuid: string, keyUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/organizations/${encodeURIComponent(orgUuid)}/service-identities/${encodeURIComponent(keyUuid)}`,
    );
  }

  /** POST /api/organizations/{org_uuid}/service-identities/automation-token */
  createServiceIdentityAutomationToken(orgUuid: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/organizations/${encodeURIComponent(orgUuid)}/service-identities/automation-token`,
      { body: payload },
    );
  }

  // ===== Entitlements =====

  /** POST /api/entitlements/check */
  entitlementsCheck(feature: string, orgUuid?: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { feature };
    if (orgUuid !== undefined) body.org_uuid = orgUuid;
    return this.request<Record<string, unknown>>('POST', '/api/entitlements/check', { body });
  }

  /** POST /api/entitlements/check/batch */
  entitlementsCheckBatch(checks: unknown[]): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/entitlements/check/batch', { body: { checks } });
  }

  /** GET /api/entitlements/effective */
  entitlementsEffective(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/entitlements/effective');
  }

  /** POST /api/admin/entitlements/explain */
  adminEntitlementsExplain(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/admin/entitlements/explain', { body: payload });
  }

  // ===== Pricing =====

  /** POST /api/pricing/preview */
  pricingPreview(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/pricing/preview', { body: payload });
  }

  /** POST /api/pricing/quote */
  pricingQuote(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/pricing/quote', { body: payload });
  }

  /** POST /api/pricing/checkout-session */
  pricingCheckoutSession(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/pricing/checkout-session', { body: payload });
  }

  /** POST /api/admin/pricing/explain */
  adminPricingExplain(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/admin/pricing/explain', { body: payload });
  }

  /** POST /api/catalog/pricing/preview */
  catalogPricingPreview(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/catalog/pricing/preview', { body: payload });
  }

  // ===== Coupons Admin =====

  /** GET /api/admin/products/{product_id}/coupons */
  adminListProductCoupons(productId: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/products/${encodeURIComponent(productId)}/coupons`,
    );
  }

  /** POST /api/admin/products/{product_id}/coupons */
  adminCreateProductCoupon(productId: string, coupon: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/products/${encodeURIComponent(productId)}/coupons`,
      { body: coupon },
    );
  }

  /** PUT /api/admin/products/{product_id}/coupons/{coupon_id} */
  adminUpdateProductCoupon(
    productId: string,
    couponId: string,
    coupon: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/admin/products/${encodeURIComponent(productId)}/coupons/${encodeURIComponent(couponId)}`,
      { body: coupon },
    );
  }

  /** DELETE /api/admin/products/{product_id}/coupons/{coupon_id} */
  async adminDeleteProductCoupon(productId: string, couponId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/products/${encodeURIComponent(productId)}/coupons/${encodeURIComponent(couponId)}`,
    );
  }

  // ===== Labels =====

  /** PUT /api/admin/coupons/{id}/labels */
  setCouponLabels(couponId: string, labels: string[]): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/admin/coupons/${encodeURIComponent(couponId)}/labels`,
      { body: { labels } },
    );
  }

  /** POST /api/admin/coupons/{id}/labels */
  addCouponLabel(couponId: string, label: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/coupons/${encodeURIComponent(couponId)}/labels`,
      { body: { label } },
    );
  }

  /** DELETE /api/admin/coupons/{id}/labels/{label} */
  async removeCouponLabel(couponId: string, label: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/coupons/${encodeURIComponent(couponId)}/labels/${encodeURIComponent(label)}`,
    );
  }

  /** PUT /api/admin/products/{id}/tags */
  setProductTags(productId: string, tags: string[]): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/admin/products/${encodeURIComponent(productId)}/tags`,
      { body: { tags } },
    );
  }

  /** POST /api/admin/products/{id}/tags */
  addProductTag(productId: string, tag: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/products/${encodeURIComponent(productId)}/tags`,
      { body: { tag } },
    );
  }

  /** DELETE /api/admin/products/{id}/tags/{tag} */
  async removeProductTag(productId: string, tag: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/products/${encodeURIComponent(productId)}/tags/${encodeURIComponent(tag)}`,
    );
  }

  // ===== Analytics =====

  /** POST /api/analytics/events */
  ingestAnalyticsEvent(event: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/analytics/events', { body: event });
  }

  /** GET /api/analytics/apps/{app_uuid}/overview */
  analyticsAppOverview(appUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/analytics/apps/${encodeURIComponent(appUuid)}/overview`,
    );
  }

  /** GET /api/analytics/organizations/{org_uuid}/overview */
  analyticsOrgOverview(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/analytics/organizations/${encodeURIComponent(orgUuid)}/overview`,
    );
  }

  // ===== Teams =====

  /** POST /api/teams */
  createTeam(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/teams', { body: payload });
  }

  /** GET /api/organizations/{org_uuid}/teams */
  listOrgTeams(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/teams`,
    );
  }

  /** GET /api/teams/org/{org_uuid}/inactive */
  listInactiveTeams(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/teams/org/${encodeURIComponent(orgUuid)}/inactive`,
    );
  }

  /** POST /api/teams/lifecycle/{team_uuid}/reactivate */
  reactivateTeam(teamUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/teams/lifecycle/${encodeURIComponent(teamUuid)}/reactivate`,
    );
  }

  /** DELETE /api/teams/lifecycle/{team_uuid} */
  async archiveTeam(teamUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/teams/lifecycle/${encodeURIComponent(teamUuid)}`,
    );
  }

  /** GET /api/teams/{team_uuid}/members */
  listTeamMembers(teamUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/teams/${encodeURIComponent(teamUuid)}/members`,
    );
  }

  /** POST /api/teams/{team_uuid}/members */
  addTeamMember(teamUuid: string, userUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/teams/${encodeURIComponent(teamUuid)}/members`,
      { body: { user_uuid: userUuid } },
    );
  }

  /** DELETE /api/teams/{team_uuid}/members/{user_uuid} */
  async removeTeamMember(teamUuid: string, userUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/teams/${encodeURIComponent(teamUuid)}/members/${encodeURIComponent(userUuid)}`,
    );
  }

  /** GET /api/teams/{team_uuid}/observers */
  listTeamObservers(teamUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/teams/${encodeURIComponent(teamUuid)}/observers`,
    );
  }

  /** POST /api/teams/{team_uuid}/observers */
  addTeamObserver(teamUuid: string, userUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/teams/${encodeURIComponent(teamUuid)}/observers`,
      { body: { user_uuid: userUuid } },
    );
  }

  /** DELETE /api/teams/{team_uuid}/observers/{user_uuid} */
  async removeTeamObserver(teamUuid: string, userUuid: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/teams/${encodeURIComponent(teamUuid)}/observers/${encodeURIComponent(userUuid)}`,
    );
  }

  /** GET /api/users/{user_uuid}/teams */
  getUserTeams(userUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/users/${encodeURIComponent(userUuid)}/teams`,
    );
  }

  /** GET /api/users/{user_uuid}/observed-teams */
  getUserObservedTeams(userUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/users/${encodeURIComponent(userUuid)}/observed-teams`,
    );
  }

  // ===== Org Features =====

  /** GET /api/organizations/{org_uuid}/features */
  listOrgFeatures(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/organizations/${encodeURIComponent(orgUuid)}/features`,
    );
  }

  /** POST /api/organizations/{org_uuid}/features */
  setOrgFeature(orgUuid: string, feature: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/organizations/${encodeURIComponent(orgUuid)}/features`,
      { body: feature },
    );
  }

  /** DELETE /api/organizations/{org_uuid}/features/{feature_id} */
  async removeOrgFeature(orgUuid: string, featureId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/organizations/${encodeURIComponent(orgUuid)}/features/${encodeURIComponent(featureId)}`,
    );
  }

  // ===== Roles =====

  /** GET /api/roles */
  listRoles(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/roles');
  }

  /** GET /api/roles/permissions */
  listAllPermissions(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/roles/permissions');
  }

  /** GET /api/roles/{role_id}/permissions */
  getRolePermissions(roleId: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/roles/${encodeURIComponent(roleId)}/permissions`,
    );
  }

  /** PUT /api/roles/{role_id}/permissions */
  updateRolePermissions(roleId: string, permissions: unknown[]): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/roles/${encodeURIComponent(roleId)}/permissions`,
      { body: { permissions } },
    );
  }

  // ===== RBAC =====

  /** GET /api/v2/products/{product_id}/permissions */
  getProductPermissions(productId: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/v2/products/${encodeURIComponent(productId)}/permissions`,
    );
  }

  /** POST /api/v2/products/{product_id}/roles */
  createProductRole(productId: string, roleData: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/v2/products/${encodeURIComponent(productId)}/roles`,
      { body: roleData },
    );
  }

  /** GET /api/v2/organizations/{org_uuid}/products/{product_id}/roles */
  getAssignableRoles(orgUuid: string, productId: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/v2/organizations/${encodeURIComponent(orgUuid)}/products/${encodeURIComponent(productId)}/roles`,
    );
  }

  /** PUT /api/v2/organizations/{org_uuid}/users/{user_uuid}/role */
  assignRoleToUser(orgUuid: string, userUuid: string, roleId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PUT',
      `/api/v2/organizations/${encodeURIComponent(orgUuid)}/users/${encodeURIComponent(userUuid)}/role`,
      { body: { role_id: roleId } },
    );
  }

  // ===== Billing =====

  /** POST /api/billing/checkout */
  checkout(priceId: string, couponCode?: string, addOns?: unknown[]): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { price_id: priceId };
    if (couponCode !== undefined) body.coupon_code = couponCode;
    if (addOns !== undefined) body.add_ons = addOns;
    return this.request<Record<string, unknown>>('POST', '/api/billing/checkout', { body });
  }

  /** GET /api/billing/history */
  getBillingHistory(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/billing/history');
  }

  /** GET /api/billing/invoices */
  listInvoices(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/billing/invoices');
  }

  /** GET /api/billing/config/{provider} */
  getProviderConfig(provider: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/billing/config/${encodeURIComponent(provider)}`,
    );
  }

  /** POST /api/billing/subscriptions/add-on */
  addAddOn(addOn: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/billing/subscriptions/add-on', { body: addOn });
  }

  /** GET /api/wallet */
  getWallet(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/wallet');
  }

  // ===== Environments =====

  /** GET /api/environments */
  listEnvironments(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/environments');
  }

  // ===== Plaid =====

  /** POST /api/plaid/create-link-token */
  plaidCreateLinkToken(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/plaid/create-link-token', { body: payload });
  }

  /** POST /api/plaid/exchange-public-token */
  plaidExchangePublicToken(publicToken: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/plaid/exchange-public-token', {
      body: { public_token: publicToken },
    });
  }

  /** GET /api/plaid/accounts */
  plaidAccounts(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/plaid/accounts');
  }

  // ===== Usage =====

  /** POST /api/usage/report */
  usageReport(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/usage/report', { body: payload });
  }

  // ===== Help =====

  /** GET /api/help */
  helpRoot(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/help', { auth: false });
  }

  /** GET /api/help/search?q={query} */
  helpSearch(query: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/help/search', { query: { q: query }, auth: false });
  }

  /** GET /api/help/categories/{slug} */
  helpCategory(slug: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/help/categories/${encodeURIComponent(slug)}`,
      { auth: false },
    );
  }

  /** GET /api/help/articles/{slug} */
  helpArticle(slug: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/help/articles/${encodeURIComponent(slug)}`,
      { auth: false },
    );
  }

  // ===== Search =====

  /** POST /api/v2/search/index */
  searchIndex(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/v2/search/index', { body: payload });
  }

  /** POST /api/v2/search/query */
  searchQuery(q: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { q };
    if (filters !== undefined) body.filters = filters;
    return this.request<Record<string, unknown>>('POST', '/api/v2/search/query', { body });
  }

  /** POST /api/v2/search/chat */
  searchChat(q: string, options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { q };
    if (options !== undefined) Object.assign(body, options);
    return this.request<Record<string, unknown>>('POST', '/api/v2/search/chat', { body });
  }

  // ===== AI Gateway =====

  /** POST to gateway.buttrbase.com — AI chat completions via org gateway. */
  async aiChatCompletions(
    orgUuid: string,
    provider: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `https://gateway.buttrbase.com/api/v1/organizations/${encodeURIComponent(orgUuid)}/providers/${encodeURIComponent(provider)}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      let detail = res.statusText || 'request failed';
      if (parsed && typeof parsed === 'object' && 'detail' in (parsed as Record<string, unknown>)) {
        const d = (parsed as Record<string, unknown>).detail;
        if (typeof d === 'string') detail = d;
        else detail = JSON.stringify(d);
      } else if (typeof parsed === 'string' && parsed) {
        detail = parsed;
      }
      throw new ButtrbaseError(res.status, detail, parsed);
    }
    return parsed as Record<string, unknown>;
  }

  // ===== Signing Keys (extended) =====

  /** GET /api/admin/organizations/{org_uuid}/signing-keys */
  listSigningKeys(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/signing-keys`,
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/signing-keys/rotate */
  rotateSigningKeys(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/signing-keys/rotate`,
    );
  }

  /** GET /api/admin/organizations/{org_uuid}/signing-audit */
  listSigningAudit(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/signing-audit`,
    );
  }

  /** POST /api/orgs/{org_uuid}/sign-document */
  signDocument(orgUuid: string, document: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/orgs/${encodeURIComponent(orgUuid)}/sign-document`,
      { body: document },
    );
  }

  // ===== mTLS CA =====

  /** GET /api/admin/organizations/{org_uuid}/certificate-authority */
  getCa(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/certificate-authority`,
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/certificate-authority/init */
  initCa(orgUuid: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/certificate-authority/init`,
      { body: config },
    );
  }

  /** GET /api/admin/organizations/{org_uuid}/certificates */
  listCertificates(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/certificates`,
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/certificates */
  issueCertificate(orgUuid: string, csr: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/certificates`,
      { body: { csr } },
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/certificates/{serial}/revoke */
  revokeCertificate(orgUuid: string, serial: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/certificates/${encodeURIComponent(serial)}/revoke`,
    );
  }

  // ===== Zero Trust (extended) =====

  /** POST /api/admin/organizations/{org_uuid}/auth-events/purge */
  purgeAuthEvents(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/auth-events/purge`,
    );
  }

  /** GET /api/admin/organizations/{org_uuid}/kms-status */
  kmsStatus(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/kms-status`,
    );
  }

  /** PATCH /api/admin/organizations/{org_uuid}/sso/{connection_uuid}/saml-cert */
  samlCertRollover(
    orgUuid: string,
    connectionUuid: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/sso/${encodeURIComponent(connectionUuid)}/saml-cert`,
      { body: payload },
    );
  }

  /** PATCH /api/admin/organizations/{org_uuid}/payment-settings */
  updatePaymentSettings(orgUuid: string, settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/payment-settings`,
      { body: settings },
    );
  }

  // ===== Secrets (extended) =====

  /** GET /api/admin/organizations/{org_uuid}/secrets */
  listSecrets(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/secrets`,
    );
  }

  /** DELETE /api/admin/organizations/{org_uuid}/secrets/{name} */
  async deleteSecret(orgUuid: string, name: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/secrets/${encodeURIComponent(name)}`,
    );
  }

  // ===== Admin Portal =====

  /** POST /api/admin/organizations/{org_uuid}/admin-portal/issue */
  adminPortalIssue(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/admin-portal/issue`,
    );
  }

  /** POST /api/admin-portal/exchange */
  adminPortalExchange(token: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/admin-portal/exchange', { body: { token } });
  }

  // ===== Domains =====

  /** GET /api/admin/organizations/{org_uuid}/domains */
  listDomains(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/domains`,
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/domains */
  createDomain(orgUuid: string, domain: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/domains`,
      { body: { domain } },
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/domains/{id}/verify */
  verifyDomain(orgUuid: string, domainId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/domains/${encodeURIComponent(domainId)}/verify`,
    );
  }

  /** DELETE /api/admin/organizations/{org_uuid}/domains/{id} */
  async deleteDomain(orgUuid: string, domainId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/domains/${encodeURIComponent(domainId)}`,
    );
  }

  // ===== Webhooks Admin =====

  /** GET /api/admin/organizations/{org_uuid}/webhook-endpoints */
  listWebhookEndpoints(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/webhook-endpoints`,
    );
  }

  /** POST /api/admin/organizations/{org_uuid}/webhook-endpoints */
  createWebhookEndpoint(orgUuid: string, url: string, events: string[]): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/webhook-endpoints`,
      { body: { url, events } },
    );
  }

  /** DELETE /api/admin/organizations/{org_uuid}/webhook-endpoints/{id} */
  async deleteWebhookEndpoint(orgUuid: string, endpointId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/webhook-endpoints/${encodeURIComponent(endpointId)}`,
    );
  }

  /** GET /api/admin/organizations/{org_uuid}/webhook-deliveries */
  listWebhookDeliveries(orgUuid: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      'GET',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/webhook-deliveries`,
    );
  }

  // ===== SCIM =====

  /** POST /api/admin/organizations/{org_uuid}/scim-tokens */
  issueScimToken(orgUuid: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/admin/organizations/${encodeURIComponent(orgUuid)}/scim-tokens`,
    );
  }

  // ===== Payments =====

  /** POST /api/payments/checkout */
  createPaymentCheckout(
    amount: number,
    currency: string,
    country: string,
    orgUuid?: string,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { amount, currency, country };
    if (orgUuid !== undefined) body.org_uuid = orgUuid;
    return this.request<Record<string, unknown>>('POST', '/api/payments/checkout', { body });
  }

  /** POST /api/payments/invoices/send */
  sendInvoice(
    amount: number,
    currency: string,
    appUuid: string,
    opts: { memo?: string; dueDate?: string } = {},
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { amount, currency, app_uuid: appUuid };
    if (opts.memo !== undefined) body.memo = opts.memo;
    if (opts.dueDate !== undefined) body.due_date = opts.dueDate;
    return this.request<Record<string, unknown>>('POST', '/api/payments/invoices/send', { body });
  }

  // ===== SMS =====

  /** POST /api/sms/send_sms */
  sendSms(
    phone: string,
    message: string,
    opts: { from?: string; orgUuid?: string } = {},
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { phone, message };
    if (opts.from !== undefined) body.from = opts.from;
    if (opts.orgUuid !== undefined) body.org_uuid = opts.orgUuid;
    return this.request<Record<string, unknown>>('POST', '/api/sms/send_sms', { body });
  }

  // ===== Email =====

  /** POST /api/email/verify-identity */
  verifyEmailIdentity(
    email: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsRegion?: string,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      email,
      aws_access_key_id: awsAccessKeyId,
      aws_secret_access_key: awsSecretAccessKey,
    };
    if (awsRegion !== undefined) body.aws_region = awsRegion;
    return this.request<Record<string, unknown>>('POST', '/api/email/verify-identity', { body });
  }

  // ===== Jobs & Notifications =====

  /** POST /api/v2/jobs/enqueue */
  enqueueJob(name: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/v2/jobs/enqueue', { body: { name, payload } });
  }

  /** POST /api/v2/notifications/send */
  sendNotification(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/api/v2/notifications/send', { body: payload });
  }

  /** GET /api/v2/notifications */
  listNotifications(): Promise<unknown[]> {
    return this.request<unknown[]>('GET', '/api/v2/notifications');
  }

  // ===== Custom Variables =====

  /** GET /api/v2/custom-variables/{key} */
  getCustomVariable(key: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/v2/custom-variables/${encodeURIComponent(key)}`,
    );
  }

  /** POST /api/v2/custom-variables */
  setCustomVariable(key: string, value: string, scope?: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { key, value };
    if (scope !== undefined) body.scope = scope;
    return this.request<Record<string, unknown>>('POST', '/api/v2/custom-variables', { body });
  }

  // ===== Webhooks (legacy) =====

  /** POST /api/v2/webhooks */
  registerWebhook(url: string, events: string[], orgUuid?: string): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { url, events };
    if (orgUuid !== undefined) body.org_uuid = orgUuid;
    return this.request<Record<string, unknown>>('POST', '/api/v2/webhooks', { body });
  }
}
