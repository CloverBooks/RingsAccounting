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

## Rust API (primary backend)

The Rust API is the authoritative backend for products, inventory, tax, and companion features. It runs on port 3001 and uses SQLite by default at `legacy/db/db.sqlite3` (override with `DATABASE_URL`).

### Migrations

PowerShell:

```powershell
cd rust-api
$env:DATABASE_URL = "sqlite:../legacy/db/db.sqlite3"
sqlx migrate run
```

bash:

```bash
cd rust-api
export DATABASE_URL="sqlite:../legacy/db/db.sqlite3"
sqlx migrate run
```

If `sqlx` is missing, install it once:

```bash
cargo install sqlx-cli --no-default-features --features sqlite
```

### Run the API

PowerShell:

```powershell
cd rust-api
cargo run
```

bash:

```bash
cd rust-api
cargo run
```

### Verification curl examples (port 3001)

```bash
curl http://localhost:3001/api/products/list/
```

```bash
curl -X POST http://localhost:3001/api/products/create/ \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Monthly bookkeeping\",\"kind\":\"service\"}"
```

```bash
curl -X POST http://localhost:3001/api/products/create/ \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Hoodie\",\"kind\":\"product\",\"track_inventory\":true}"
```

```bash
curl "http://localhost:3001/api/inventory/items/?workspace_id=1"
```

```bash
curl -X POST http://localhost:3001/api/inventory/receive/ \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":1,\"item_id\":1,\"quantity\":\"5\",\"unit_cost\":\"2.50\",\"po_reference\":\"PO-123\"}"
```

```bash
curl -X POST http://localhost:3001/api/inventory/ship/ \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":1,\"item_id\":1,\"quantity\":\"2\",\"so_reference\":\"SO-55\"}"
```

```bash
curl "http://localhost:3001/api/inventory/balances/?workspace_id=1&item_id=1"
```

```bash
curl "http://localhost:3001/api/inventory/events/?workspace_id=1&item_id=1&limit=50"
```

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
