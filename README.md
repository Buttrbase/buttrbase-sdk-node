# @buttrbase/client

Zero-dependency TypeScript SDK for the buttrbase API. Works in Node 18+ and modern browsers.

## Install

```bash
npm install @buttrbase/client
```

## Usage

```ts
import { ButtrbaseClient } from '@buttrbase/client';

const client = new ButtrbaseClient({ apiKey: process.env.BUTTRBASE_API_KEY! });

const coupon = await client.validateCoupon('SUMMER10');
const gc = await client.validateGiftCard('GC-ABCD-1234');
```

## Webhooks

```ts
import { verifyButtrbaseSignature } from '@buttrbase/client';

const ok = await verifyButtrbaseSignature({
  body: rawBody,
  signatureHeader: req.headers['buttrbase-signature'],
  timestampHeader: req.headers['buttrbase-timestamp'],
  secret: process.env.BUTTRBASE_WEBHOOK_SECRET!,
});
```

## Errors

Non-2xx responses throw `ButtrbaseError` with `statusCode`, `detail`, and the parsed `payload`.

## Releasing (maintainers)

Tagged pushes (`v*`) trigger `.github/workflows/release.yml`, which runs `npm publish --access public`.

One-time setup: in the npm dashboard create an **Automation** access token, then in this repo go to Settings → Secrets and variables → Actions and add it as `NPM_TOKEN`.
