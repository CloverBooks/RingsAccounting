use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Vendor {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub country: String,
    pub fin: Option<String>,
    pub transit: Option<String>,
    pub account: String,
    pub aba_routing: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVendorRequest {
    pub name: String,
    pub email: String,
    pub country: String,
    pub fin: Option<String>,
    pub transit: Option<String>,
    pub account: String,
    pub aba_routing: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Bill {
    pub id: Uuid,
    pub vendor_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub due_date: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBillRequest {
    pub vendor_id: Uuid,
    pub amount: String,
    pub currency: String,
    pub due_date: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Customer {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub country: String,
    pub fin: Option<String>,
    pub transit: Option<String>,
    pub account: String,
    pub aba_routing: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCustomerRequest {
    pub name: String,
    pub email: String,
    pub country: String,
    pub fin: Option<String>,
    pub transit: Option<String>,
    pub account: String,
    pub aba_routing: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Invoice {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub frequency: String,
    pub next_due: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub customer_id: Uuid,
    pub amount: String,
    pub currency: String,
    pub frequency: String,
    pub next_due: String,
}


