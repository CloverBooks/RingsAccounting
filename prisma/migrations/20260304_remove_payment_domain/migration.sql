-- Remove payment and webhook domain tables.
DROP TABLE IF EXISTS "PaymentReceipt" CASCADE;
DROP TABLE IF EXISTS "ProcessedEvent" CASCADE;
DROP TABLE IF EXISTS "WebhookEvent" CASCADE;
DROP TABLE IF EXISTS "PaymentIntent" CASCADE;

-- Remove provider ownership columns from organization.
ALTER TABLE "Organization"
  DROP COLUMN IF EXISTS "stripe_account_id",
  DROP COLUMN IF EXISTS "flutterwave_merchant_id";

-- Drop no-longer-used enum types.
DROP TYPE IF EXISTS "PaymentDirection";
DROP TYPE IF EXISTS "PaymentIntentType";
DROP TYPE IF EXISTS "PaymentProvider";
DROP TYPE IF EXISTS "PaymentRail";
DROP TYPE IF EXISTS "PaymentIntentStatus";
DROP TYPE IF EXISTS "PaymentReceiptType";
DROP TYPE IF EXISTS "WebhookProvider";
DROP TYPE IF EXISTS "ProcessedEventStatus";
