import type { CouponValidation, GiftCardValidation, GiftCardRedemption, MagicLinkSend, MagicLinkVerify, MfaStatus, MfaEnrollment, OrgSignResponse, Jwk, SecretGet, SecretSummary } from './types.js';
export interface ButtrbaseClientOptions {
    apiKey: string;
    baseUrl?: string;
    fetch?: typeof fetch;
}
export declare class ButtrbaseClient {
    private apiKey;
    private baseUrl;
    private fetchImpl;
    constructor(opts: ButtrbaseClientOptions);
    private request;
    validateCoupon(code: string, opts?: {
        cartLabels?: string[];
        productId?: number;
    }): Promise<CouponValidation>;
    validateGiftCard(code: string): Promise<GiftCardValidation>;
    redeemGiftCard(code: string, amountCents: number, userId?: number): Promise<GiftCardRedemption>;
    sendMagicLink(email: string, opts?: {
        orgUuid?: string;
        redirectTo?: string;
    }): Promise<MagicLinkSend>;
    verifyMagicLink(token: string): Promise<MagicLinkVerify>;
    mfaStatus(): Promise<MfaStatus>;
    mfaEnroll(label?: string): Promise<MfaEnrollment>;
    mfaActivate(code: string): Promise<{
        status: string;
    }>;
    orgSign(orgUuid: string, claims: Record<string, unknown>, opts?: {
        ttlSeconds?: number;
    }): Promise<OrgSignResponse>;
    orgJwks(orgUuid: string): Promise<{
        keys: Jwk[];
    }>;
    getSecret(orgUuid: string, name: string): Promise<SecretGet>;
    putSecret(orgUuid: string, name: string, value: string, description?: string): Promise<SecretSummary>;
}
