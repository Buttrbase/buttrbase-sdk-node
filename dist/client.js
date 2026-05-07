import { ButtrbaseError } from './errors.js';
const DEFAULT_BASE_URL = 'https://stagingapi.buttrbase.com';
export class ButtrbaseClient {
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(opts) {
        if (!opts.apiKey)
            throw new Error('apiKey is required');
        this.apiKey = opts.apiKey;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        const f = opts.fetch ?? globalThis.fetch;
        if (!f)
            throw new Error('No fetch implementation available');
        this.fetchImpl = f.bind(globalThis);
    }
    async request(method, path, opts = {}) {
        const auth = opts.auth ?? true;
        let url = `${this.baseUrl}${path}`;
        if (opts.query) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(opts.query)) {
                if (v === undefined || v === null)
                    continue;
                if (Array.isArray(v))
                    for (const item of v)
                        qs.append(k, String(item));
                else
                    qs.append(k, String(v));
            }
            const s = qs.toString();
            if (s)
                url += `?${s}`;
        }
        const headers = { Accept: 'application/json' };
        if (auth)
            headers.Authorization = `Bearer ${this.apiKey}`;
        let body;
        if (opts.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(opts.body);
        }
        const res = await this.fetchImpl(url, { method, headers, body });
        const text = await res.text();
        let parsed = undefined;
        if (text) {
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = text;
            }
        }
        if (!res.ok) {
            let detail = res.statusText || 'request failed';
            if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
                const d = parsed.detail;
                if (typeof d === 'string')
                    detail = d;
                else
                    detail = JSON.stringify(d);
            }
            else if (typeof parsed === 'string' && parsed) {
                detail = parsed;
            }
            throw new ButtrbaseError(res.status, detail, parsed);
        }
        return parsed;
    }
    validateCoupon(code, opts = {}) {
        const body = { code };
        if (opts.cartLabels !== undefined)
            body.cart_labels = opts.cartLabels;
        if (opts.productId !== undefined)
            body.product_id = opts.productId;
        return this.request('POST', '/v1/coupons/validate', { body });
    }
    validateGiftCard(code) {
        return this.request('POST', '/v1/gift-cards/validate', { body: { code } });
    }
    redeemGiftCard(code, amountCents, userId) {
        const body = { code, amount_cents: amountCents };
        if (userId !== undefined)
            body.user_id = userId;
        return this.request('POST', '/v1/gift-cards/redeem', { body });
    }
    sendMagicLink(email, opts = {}) {
        const body = { email };
        if (opts.orgUuid !== undefined)
            body.org_uuid = opts.orgUuid;
        if (opts.redirectTo !== undefined)
            body.redirect_to = opts.redirectTo;
        return this.request('POST', '/v1/auth/magic-link/send', { body });
    }
    verifyMagicLink(token) {
        return this.request('POST', '/v1/auth/magic-link/verify', { body: { token } });
    }
    mfaStatus() {
        return this.request('GET', '/v1/auth/mfa/status');
    }
    mfaEnroll(label) {
        const body = {};
        if (label !== undefined)
            body.label = label;
        return this.request('POST', '/v1/auth/mfa/enroll', { body });
    }
    mfaActivate(code) {
        return this.request('POST', '/v1/auth/mfa/activate', { body: { code } });
    }
    orgSign(orgUuid, claims, opts = {}) {
        const body = { claims };
        if (opts.ttlSeconds !== undefined)
            body.ttl_seconds = opts.ttlSeconds;
        return this.request('POST', `/v1/orgs/${encodeURIComponent(orgUuid)}/sign`, {
            body,
        });
    }
    orgJwks(orgUuid) {
        return this.request('GET', `/v1/orgs/${encodeURIComponent(orgUuid)}/.well-known/jwks.json`, { auth: false });
    }
    getSecret(orgUuid, name) {
        return this.request('GET', `/v1/orgs/${encodeURIComponent(orgUuid)}/secrets/${encodeURIComponent(name)}`);
    }
    putSecret(orgUuid, name, value, description) {
        const body = { value };
        if (description !== undefined)
            body.description = description;
        return this.request('PUT', `/v1/orgs/${encodeURIComponent(orgUuid)}/secrets/${encodeURIComponent(name)}`, { body });
    }
}
