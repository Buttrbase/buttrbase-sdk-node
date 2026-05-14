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
}
