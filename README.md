# Clover Books Financial OS - API

## Quickstart

1. Start dependencies:

```bash
docker compose up -d
```

2. Install dependencies and run migrations:

```bash
cd apps/api
npm install
npx prisma migrate dev
```

3. Start the API:

```bash
npm run start:dev
```

OpenAPI docs are available at `http://localhost:3000/docs`.

## Webhook Local Testing

- Stripe CLI can forward events to `POST /webhooks/stripe`.
- For Flutterwave, use a tunneling tool (ngrok) and send webhook payloads to `POST /webhooks/flutterwave`.
- Raw body verification is enabled only for webhook routes.

## Direct Charges vs Destination Charges

For merchant invoice collections we use **Stripe Connect Direct Charges**. Direct charges keep the merchant as the Merchant of Record and allow the platform to collect fees using `application_fee_amount`. We do **not** use destination charges in this flow because destination charges would make the platform the MoR and mix custody patterns. Direct charges avoid pooling customer funds and keep the platform non-custodial.

## Canada PAD Policy

When a variable PAD amount is initiated in Canada, the default pre-notification period is **10 calendar days** unless the organization has a PAD waiver enabled. This notice period is configurable via `CA_PAD_NOTICE_DAYS`.

## Rwanda MoMo Human-in-Loop Retries

Rwanda MoMo collection attempts must use a human-in-loop retry process. The system should not automatically spam repeated pushes; instead, use queued notifications to request a new user-triggered attempt.
