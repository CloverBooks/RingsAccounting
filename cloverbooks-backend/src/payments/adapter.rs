use async_trait::async_trait;
use rust_decimal::Decimal;
use serde_json::Value;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub enum BankAccount {
    Canada {
        fin: String,
        transit: String,
        account: String,
    },
    UnitedStates {
        aba_routing: String,
        account: String,
    },
}

#[derive(Debug, Clone)]
pub struct VendorPaymentRequest {
    pub vendor_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub account: BankAccount,
}

#[derive(Debug, Clone)]
pub struct CustomerChargeRequest {
    pub customer_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub account: BankAccount,
}

#[derive(Debug, Clone, Copy)]
pub enum PaymentStatus {
    Succeeded,
    Failed,
}

impl PaymentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentStatus::Succeeded => "succeeded",
            PaymentStatus::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TransactionResult {
    pub status: PaymentStatus,
    pub gateway_transaction_id: String,
    pub raw_response: Value,
}

#[derive(Debug, Error)]
pub enum PaymentError {
    #[error("payment gateway error: {0}")]
    Gateway(String),
}

#[async_trait]
pub trait PaymentProcessor: Send + Sync {
    async fn pay_vendor(
        &self,
        request: VendorPaymentRequest,
    ) -> Result<TransactionResult, PaymentError>;

    async fn charge_customer(
        &self,
        request: CustomerChargeRequest,
    ) -> Result<TransactionResult, PaymentError>;
}
