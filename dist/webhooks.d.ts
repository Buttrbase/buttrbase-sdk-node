export type VerifyOptions = {
    /** Raw request body bytes — DO NOT pass a parsed JSON object. */
    body: string | Uint8Array;
    /** Value of the `ButtrBase-Signature` request header. */
    signatureHeader: string | null | undefined;
    /** Value of the `ButtrBase-Timestamp` request header. */
    timestampHeader: string | null | undefined;
    /** Webhook signing secret — what buttrbase returned at endpoint creation. */
    secret: string;
    /** Reject if `now - timestamp` exceeds this. Default 300s (5min). */
    toleranceSeconds?: number;
};
export declare function verifyButtrbaseSignature(opts: VerifyOptions): Promise<boolean>;
/** Test/dev helper: produce the headers buttrbase would send. */
export declare function signButtrbasePayload(body: string | Uint8Array, secret: string, timestampSeconds?: number): Promise<{
    signatureHeader: string;
    timestampHeader: string;
}>;
