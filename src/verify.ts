/**
 * Lightweight, additive JWT claims decoder for buttrbase-issued tokens.
 *
 * This module does NOT perform signature verification — callers that need
 * cryptographic verification must validate the token against the org's JWKS
 * endpoint (e.g. via `orgJwks`) before passing it here. The purpose of
 * `decodeButtrbaseClaims` is to parse the already-verified payload and surface
 * the `data` envelope fields (`roles`, `email`) as a typed {@link AuthContext}.
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
export function decodeJwtPayload(token: string): Claims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TypeError('Invalid JWT: expected three dot-separated parts');
  }
  const payloadB64 = parts[1];
  // base64url → base64 → binary → UTF-8
  const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLength);

  let jsonStr: string;
  try {
    if (typeof atob !== 'undefined') {
      // Browser / modern Node (≥ 16 with the global)
      jsonStr = atob(b64);
    } else {
      // Older Node (Buffer is always available here)
      jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
    }
  } catch {
    throw new TypeError('Invalid JWT: payload base64url is malformed');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new TypeError('Invalid JWT: payload is not valid JSON');
  }
  return parsed as Claims;
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
export function decodeButtrbaseClaims(token: string): AuthContext {
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
export function claimsToAuthContext(claims: Claims): AuthContext {
  const data = claims.data;
  // Split "owner" or "org_admin,leadership" or "admin member" on comma/space.
  const roles: string[] =
    data?.roles
      ? data.roles.split(/[, ]+/).filter((p) => p.length > 0)
      : [];
  const email: string | undefined = data?.email;
  return {
    userId: claims.sub,
    orgId: claims.org,
    scopes: Array.isArray(claims.scope) ? claims.scope : [],
    roles,
    email,
  };
}
