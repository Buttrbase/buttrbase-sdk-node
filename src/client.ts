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
}
