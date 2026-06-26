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
import type { Claims, AuthContext } from './types.js';
/**
 * Decode the base64url payload of a JWT string and return the raw
 * {@link Claims} object.  Throws a `TypeError` if the token is not a
 * three-part JWT or the payload is not valid JSON.
 *
 * **No signature verification is performed.** Always verify the token with
 * the JWKS before trusting the returned claims.
 */
export declare function decodeJwtPayload(token: string): Claims;
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
export declare function decodeButtrbaseClaims(token: string): AuthContext;
/**
 * Convert a {@link Claims} object (e.g. from your own JWKS verification
 * library) into a typed {@link AuthContext} with `roles` and `email` surfaced
 * from the `data` envelope.
 *
 * Mirrors `AuthContext::from(Claims)` in the Rust SDK.
 */
export declare function claimsToAuthContext(claims: Claims): AuthContext;
/**
 * Configuration for {@link Verifier}.
 *
 * `audience` is **optional**. buttrbase access tokens do not carry a stable,
 * per-application `aud` claim — magic-link tokens set `aud` to the org name
 * (or omit it), and client-credential tokens omit it entirely. So most
 * consumers should leave this `undefined` (no `aud` validation) and rely on
 * the `iss` + signature + `org`/`sub` claims. Set `audience` only if you
 * mint tokens with a known audience and want it enforced.
 *
 * Mirrors `VerifierConfig` in the Rust SDK.
 */
export interface VerifierConfig {
    /** Full URL to the JWKS endpoint, e.g. `https://api.buttrbase.com/jwks.json`. */
    jwksUrl: string;
    /** Expected `iss` claim value, e.g. `https://api.buttrbase.com`. */
    issuer: string;
    /**
     * Expected `aud` claim. When omitted (default) the `aud` claim is not
     * validated, matching the Rust SDK's `audience: None` behaviour.
     */
    audience?: string;
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
export declare class Verifier {
    private readonly config;
    /** `jose` remote JWKS set — handles fetch, caching, and key-id lookup. */
    private readonly jwks;
    constructor(config: VerifierConfig);
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
    verifyToken(token: string): Promise<Claims>;
    /**
     * Extract a `Bearer <token>` from an `Authorization` header value, verify it,
     * and return the caller's {@link AuthContext}.
     *
     * Throws if the header is missing, malformed, or the token is invalid.
     *
     * Mirrors `verify_bearer(headers) -> AuthContext` in the Rust SDK.
     */
    verifyBearer(authHeader: string): Promise<AuthContext>;
    /** Read-only accessor for the configured issuer. Useful for diagnostics. */
    get issuer(): string;
    /**
     * Read-only accessor for the configured audience, if any.
     * `undefined` means `aud` is not validated.
     */
    get audience(): string | undefined;
}
