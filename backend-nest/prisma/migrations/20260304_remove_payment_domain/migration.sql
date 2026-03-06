-- Drop payment and webhook domain tables.
DROP TABLE IF EXISTS "LedgerLine" CASCADE;
DROP TABLE IF EXISTS "LedgerEntry" CASCADE;
DROP TABLE IF EXISTS "PaymentReceipt" CASCADE;
DROP TABLE IF EXISTS "ProcessedEvent" CASCADE;
DROP TABLE IF EXISTS "WebhookEvent" CASCADE;
DROP TABLE IF EXISTS "PaymentIntent" CASCADE;

-- Drop enum types used only by the retired domain.
DROP TYPE IF EXISTS "LedgerEntryStatus";
DROP TYPE IF EXISTS "PaymentIntentStatus";
DROP TYPE IF EXISTS "PaymentProvider";
DROP TYPE IF EXISTS "ProcessedEventStatus";

-- Create a minimal runtime marker table to keep Prisma operational.
CREATE TABLE IF NOT EXISTS "RuntimeMarker" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
