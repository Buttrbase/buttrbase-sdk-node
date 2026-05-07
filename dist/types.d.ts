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
