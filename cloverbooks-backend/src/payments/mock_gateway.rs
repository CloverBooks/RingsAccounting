use async_trait::async_trait;
use rust_decimal::Decimal;
use serde_json::json;
use uuid::Uuid;

use super::adapter::{
    CustomerChargeRequest, PaymentError, PaymentProcessor, PaymentStatus, TransactionResult,
    VendorPaymentRequest,
};

#[derive(Debug, Default)]
pub struct MockGateway;

impl MockGateway {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl PaymentProcessor for MockGateway {
    async fn pay_vendor(
        &self,
        request: VendorPaymentRequest,
    ) -> Result<TransactionResult, PaymentError> {
        Ok(mock_result(
            "vendor_payment",
            request.amount,
            request.currency,
        ))
    }

    async fn charge_customer(
        &self,
        request: CustomerChargeRequest,
    ) -> Result<TransactionResult, PaymentError> {
        Ok(mock_result(
            "customer_charge",
            request.amount,
            request.currency,
        ))
    }
}

fn mock_result(flow: &str, amount: Decimal, currency: String) -> TransactionResult {
    let status = if amount > Decimal::ZERO {
        PaymentStatus::Succeeded
    } else {
        PaymentStatus::Failed
    };

    let gateway_transaction_id = Uuid::new_v4().to_string();
    let raw_response = json!({
        "mock": true,
        "flow": flow,
        "amount": amount.to_string(),
        "currency": currency,
        "transaction_id": gateway_transaction_id,
        "status": status.as_str(),
    });

    TransactionResult {
        status,
        gateway_transaction_id,
        raw_response,
    }
}
