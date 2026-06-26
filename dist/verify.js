/**
 * JWT helpers for buttrbase-issued tokens.
 *
 * Two tiers:
 *
 * 1. **Decode-only** (`decodeJwtPayload`, `decodeButtrbaseClaims`,
 *    `claimsToAuthContext`) — no crypto dependency, no network. Parse the
 *    payload after you have already verified the signature externally.
 *
 * 2. **Cryptographic verifier** (`Verifier`) — fetches the org's JWKS,
 *    validates the RS256 signature, issuer, expiry, and optionally audience.
 *    Mirrors `Verifier` / `VerifierConfig` / `verify` / `verify_bearer` from
 *    the Rust SDK (buttrbase-sdk-rust src/verify/verifier.rs).
 *
 * Mirrors the Rust SDK's `ClaimsData` / `Claims` / `AuthContext` additions
 * (Rust SDK 0.6.0).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
/**
 * Decode the base64url payload of a JWT string and return the raw
 * {@link Claims} object.  Throws a `TypeError` if the token is not a
 * three-part JWT or the payload is not valid JSON.
 *
 * **No signature verification is performed.** Always verify the token with
 * the JWKS before trusting the returned claims.
 */
export function decodeJwtPayload(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new TypeError('Invalid JWT: expected three dot-separated parts');
    }
    const payloadB64 = parts[1];
    // base64url → base64 → binary → UTF-8
    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const b64 = padded + '='.repeat(padLength);
    let jsonStr;
    try {
        if (typeof atob !== 'undefined') {
            // Browser / modern Node (≥ 16 with the global)
            jsonStr = atob(b64);
        }
        else {
            // Older Node (Buffer is always available here)
            jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
        }
    }
    catch {
        throw new TypeError('Invalid JWT: payload base64url is malformed');
    }
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    }
    catch {
        throw new TypeError('Invalid JWT: payload is not valid JSON');
    }
    return parsed;
}
/**
 * Decode a buttrbase JWT string and return a typed {@link AuthContext} that
 * surfaces `roles` (split from `data.roles`) and `email` from the `data`
 * envelope.
 *
 * **No signature verification is performed.** Always verify the token with
 * the JWKS before trusting the returned principal.
 *
 * ```ts
 * // After verifying the JWT signature against the JWKS:
 * const ctx = decodeButtrbaseClaims(accessToken);
 * if (ctx.roles.includes('owner')) { ... }
 * console.log(ctx.email);
 * ```
 *
 * Mirrors `AuthContext::from(Claims)` in the Rust SDK (added in 0.6.0).
 */
export function decodeButtrbaseClaims(token) {
    const claims = decodeJwtPayload(token);
    return claimsToAuthContext(claims);
}
/**
 * Convert a {@link Claims} object (e.g. from your own JWKS verification
 * library) into a typed {@link AuthContext} with `roles` and `email` surfaced
 * from the `data` envelope.
 *
 * Mirrors `AuthContext::from(Claims)` in the Rust SDK.
 */
export function claimsToAuthContext(claims) {
    const data = claims.data;
    // Split "owner" or "org_admin,leadership" or "admin member" on comma/space.
    const roles = data?.roles
        ? data.roles.split(/[, ]+/).filter((p) => p.length > 0)
        : [];
    const email = data?.email;
    return {
        userId: claims.sub,
        orgId: claims.org,
        scopes: Array.isArray(claims.scope) ? claims.scope : [],
        roles,
        email,
    };
}
/**
 * Cryptographic JWT verifier. Fetches the remote JWKS (with built-in caching
 * via `jose`), validates the RS256 signature, issuer, and expiry; optionally
 * enforces the audience claim.
 *
 * Construct once at startup and share across requests (the JWKS cache is
 * internal to the instance).
 *
 * Mirrors `Verifier` in the Rust SDK (src/verify/verifier.rs).
 *
 * ```ts
 * const verifier = new Verifier({
 *   jwksUrl: 'https://api.buttrbase.com/jwks.json',
 *   issuer: 'https://api.buttrbase.com',
 * });
 *
 * // In an HTTP handler:
 * const ctx = await verifier.verifyBearer(req.headers.authorization ?? '');
 * if (ctx.roles.includes('owner')) { ... }
 * ```
 */
export class Verifier {
    config;
    /** `jose` remote JWKS set — handles fetch, caching, and key-id lookup. */
    jwks;
    constructor(config) {
        this.config = { ...config };
        this.jwks = createRemoteJWKSet(new URL(config.jwksUrl));
    }
    /**
     * Verify a bare RS256 token string against the remote JWKS.
     *
     * - Validates the RS256 signature using the `kid`-matched key from the JWKS.
     * - Enforces `iss` and token expiry.
     * - Enforces `aud` only when {@link VerifierConfig.audience} is set (mirrors
     *   the Rust SDK's `validate_aud = false` when `audience: None`).
     *
     * Returns the typed {@link Claims} on success; throws on any failure.
     */
    async verifyToken(token) {
        const verifyOptions = {
            algorithms: ['RS256'],
            issuer: this.config.issuer,
        };
        if (this.config.audience !== undefined) {
            verifyOptions.audience = this.config.audience;
        }
        const { payload } = await jwtVerify(token, this.jwks, verifyOptions);
        // Cast: the payload matches our Claims shape (sub, org, exp, iat, scope?, data?).
        // `jose` has already validated exp/nbf/iss/(aud), so we can trust the fields.
        return payload;
    }
    /**
     * Extract a `Bearer <token>` from an `Authorization` header value, verify it,
     * and return the caller's {@link AuthContext}.
     *
     * Throws if the header is missing, malformed, or the token is invalid.
     *
     * Mirrors `verify_bearer(headers) -> AuthContext` in the Rust SDK.
     */
    async verifyBearer(authHeader) {
        const prefix = 'Bearer ';
        if (!authHeader.startsWith(prefix)) {
            throw new Error('Missing or malformed Authorization header: expected "Bearer <token>"');
        }
        const token = authHeader.slice(prefix.length).trim();
        if (!token) {
            throw new Error('Authorization header contained an empty Bearer token');
        }
        const claims = await this.verifyToken(token);
        return claimsToAuthContext(claims);
    }
    /** Read-only accessor for the configured issuer. Useful for diagnostics. */
    get issuer() {
        return this.config.issuer;
    }
    /**
     * Read-only accessor for the configured audience, if any.
     * `undefined` means `aud` is not validated.
     */
    get audience() {
        return this.config.audience;
    }
}
