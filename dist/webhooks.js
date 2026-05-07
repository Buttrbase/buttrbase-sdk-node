// Verifier SDK for outbound buttrbase webhooks.
//
// Buttrbase signs every outbound delivery with HMAC-SHA256(secret, "<ts>.<body>").
// Browser + Node: uses Web Crypto API (subtle.importKey + subtle.sign).
export async function verifyButtrbaseSignature(opts) {
    if (!opts.signatureHeader || !opts.timestampHeader || !opts.secret) {
        return false;
    }
    const ts = parseInt(opts.timestampHeader, 10);
    if (!Number.isFinite(ts) || ts <= 0)
        return false;
    const tolerance = opts.toleranceSeconds ?? 300;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - ts) > tolerance)
        return false;
    const v1 = parseV1(opts.signatureHeader);
    if (!v1)
        return false;
    const bodyBytes = typeof opts.body === 'string' ? new TextEncoder().encode(opts.body) : opts.body;
    const tsBytes = new TextEncoder().encode(`${opts.timestampHeader.trim()}.`);
    const payload = new Uint8Array(tsBytes.length + bodyBytes.length);
    payload.set(tsBytes, 0);
    payload.set(bodyBytes, tsBytes.length);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(opts.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = await crypto.subtle.sign('HMAC', key, payload);
    const expectedHex = bufToHex(expected);
    return constantTimeEqual(expectedHex, v1.toLowerCase());
}
/** Test/dev helper: produce the headers buttrbase would send. */
export async function signButtrbasePayload(body, secret, timestampSeconds) {
    const ts = timestampSeconds ?? Math.floor(Date.now() / 1000);
    const bodyBytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    const tsBytes = new TextEncoder().encode(`${ts}.`);
    const payload = new Uint8Array(tsBytes.length + bodyBytes.length);
    payload.set(tsBytes, 0);
    payload.set(bodyBytes, tsBytes.length);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, payload);
    return {
        timestampHeader: String(ts),
        signatureHeader: `t=${ts},v1=${bufToHex(sig)}`,
    };
}
function parseV1(header) {
    for (const part of header.split(',')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k === 'v1')
            return v;
    }
    return null;
}
function bufToHex(buf) {
    const bytes = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
