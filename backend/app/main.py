from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    LoginRequest,
    TokenSubject,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from .config import settings
from .db import Base, SessionLocal, engine, get_db
from .models import User
from .security import hash_password, verify_password

app = FastAPI(title="Clover Books API", version="0.2.0")

# NOTE: Legacy mock API for demos/local dev. Production paths should use the Rust API in /rust-api.

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class UserOut(BaseModel):
    id: int
    email: str
    name: str | None = None
    is_admin: bool = False
    role: str | None = None


class AuthResponse(BaseModel):
    authenticated: bool
    user: UserOut


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _user_to_subject(user: User) -> TokenSubject:
    return TokenSubject(
        email=user.email,
        name=user.name,
        role=user.role,
        is_admin=user.is_admin,
    )


def _user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        is_admin=user.is_admin,
        role=user.role,
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_ttl_days * 86400,
        domain=settings.cookie_domain,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        domain=settings.cookie_domain,
        path="/",
    )


def _get_access_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return request.cookies.get(ACCESS_COOKIE_NAME)


def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def _ensure_dev_user() -> None:
    if not settings.seed_dev_user:
        return

    with SessionLocal() as db:
        existing = _get_user_by_email(db, settings.seed_dev_email)
        if existing:
            return
        user = User(
            email=settings.seed_dev_email,
            name=settings.seed_dev_name,
            password_hash=hash_password(settings.seed_dev_password),
            is_admin=settings.seed_dev_is_admin,
            role="superadmin" if settings.seed_dev_is_admin else "user",
        )
        db.add(user)
        db.commit()


@app.on_event("startup")
def startup() -> None:
    if settings.app_env != "production":
        Base.metadata.create_all(bind=engine)
    _ensure_dev_user()


@app.get("/healthz")
@app.get("/api/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/login", response_model=TokenResponse)
@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    user = _get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    subject = _user_to_subject(user)
    access_token = create_access_token(subject)
    refresh_token = create_refresh_token(subject)
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=_user_to_out(user))


@app.post("/auth/refresh", response_model=TokenResponse)
@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    subject = decode_token(token, expected_type="refresh")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = _get_user_by_email(db, subject.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_subject = _user_to_subject(user)
    access_token = create_access_token(new_subject)
    refresh_token = create_refresh_token(new_subject)
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token, user=_user_to_out(user))


@app.post("/auth/logout")
@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    _clear_refresh_cookie(response)
    return {"ok": True}


@app.get("/me", response_model=AuthResponse)
@app.get("/auth/me", response_model=AuthResponse)
@app.get("/api/auth/me", response_model=AuthResponse)
def me(request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    token = _get_access_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")

    subject = decode_token(token, expected_type="access")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user = _get_user_by_email(db, subject.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return AuthResponse(authenticated=True, user=_user_to_out(user))


# -----------------------------------------------------------------------------
# Customers API
# -----------------------------------------------------------------------------

MOCK_CUSTOMERS = [
    {
        "id": 1,
        "name": "Acme Corporation",
        "company": "Acme Corporation",
        "email": "billing@acme.com",
        "phone": "+1 555-0100",
        "open_balance": "12500.00",
        "ytd_revenue": "87500.00",
        "mtd_revenue": "8500.00",
        "is_active": True,
        "last_invoice_date": "2026-01-15",
        "location": "New York, NY",
        "tags": ["Enterprise", "Priority"],
    },
    {
        "id": 2,
        "name": "TechStart Inc",
        "company": "TechStart Inc",
        "email": "accounts@techstart.io",
        "phone": "+1 555-0200",
        "open_balance": "3200.00",
        "ytd_revenue": "45000.00",
        "mtd_revenue": "4200.00",
        "is_active": True,
        "last_invoice_date": "2026-01-20",
        "location": "San Francisco, CA",
        "tags": ["Startup"],
    },
    {
        "id": 3,
        "name": "Global Retail Ltd",
        "company": "Global Retail Ltd",
        "email": "finance@globalretail.com",
        "phone": "+1 555-0300",
        "open_balance": "8750.00",
        "ytd_revenue": "125000.00",
        "mtd_revenue": "12000.00",
        "is_active": True,
        "last_invoice_date": "2026-01-18",
        "location": "Toronto, ON",
        "tags": ["Enterprise", "Retail"],
    },
    {
        "id": 4,
        "name": "Smith Consulting",
        "company": "Smith Consulting LLC",
        "email": "john@smithconsulting.com",
        "phone": "+1 555-0400",
        "open_balance": "0.00",
        "ytd_revenue": "22000.00",
        "mtd_revenue": "0.00",
        "is_active": False,
        "last_invoice_date": "2025-11-05",
        "location": "Chicago, IL",
        "tags": ["SMB"],
    },
    {
        "id": 5,
        "name": "Creative Studio",
        "company": "Creative Studio Co",
        "email": "hello@creativestudio.design",
        "phone": "+1 555-0500",
        "open_balance": "1500.00",
        "ytd_revenue": "35000.00",
        "mtd_revenue": "3500.00",
        "is_active": True,
        "last_invoice_date": "2026-01-22",
        "location": "Los Angeles, CA",
        "tags": ["Creative", "Agency"],
    },
]


@app.get("/api/customers/list/")
def list_customers() -> dict:
    total_ytd = sum(float(c["ytd_revenue"]) for c in MOCK_CUSTOMERS)
    total_mtd = sum(float(c["mtd_revenue"]) for c in MOCK_CUSTOMERS)
    total_open = sum(float(c["open_balance"]) for c in MOCK_CUSTOMERS)
    
    return {
        "customers": MOCK_CUSTOMERS,
        "stats": {
            "total_customers": len(MOCK_CUSTOMERS),
            "total_ytd": f"{total_ytd:.2f}",
            "total_mtd": f"{total_mtd:.2f}",
            "total_open_balance": f"{total_open:.2f}",
        },
        "currency": "CAD",
    }


# -----------------------------------------------------------------------------
# Products & Services API
# -----------------------------------------------------------------------------

MOCK_PRODUCTS = [
    {
        "id": 1,
        "name": "Website Development",
        "code": "WEB-DEV",
        "sku": "SVC-001",
        "kind": "service",
        "type": "SERVICE",
        "status": "active",
        "price": "5000.00",
        "currency": "CAD",
        "income_category_name": "Professional Services",
        "income_account_label": "4100 - Service Revenue",
        "expense_account_label": None,
        "description": "Full website development and design services",
        "usage_count": 12,
        "last_sold_on": "2026-01-25",
    },
    {
        "id": 2,
        "name": "Monthly Retainer",
        "code": "RETAINER",
        "sku": "SVC-002",
        "kind": "service",
        "type": "SERVICE",
        "status": "active",
        "price": "2500.00",
        "currency": "CAD",
        "income_category_name": "Consulting",
        "income_account_label": "4100 - Service Revenue",
        "expense_account_label": None,
        "description": "Monthly consulting and support retainer",
        "usage_count": 24,
        "last_sold_on": "2026-01-20",
    },
    {
        "id": 3,
        "name": "Premium Widget",
        "code": "WIDGET-PRO",
        "sku": "PRD-001",
        "kind": "product",
        "type": "PRODUCT",
        "status": "active",
        "price": "299.99",
        "currency": "CAD",
        "income_category_name": "Hardware Sales",
        "income_account_label": "4200 - Product Revenue",
        "expense_account_label": "5100 - Cost of Goods Sold",
        "description": "Premium quality widget with extended warranty",
        "usage_count": 45,
        "last_sold_on": "2026-01-28",
    },
    {
        "id": 4,
        "name": "Basic Widget",
        "code": "WIDGET-BASIC",
        "sku": "PRD-002",
        "kind": "product",
        "type": "PRODUCT",
        "status": "active",
        "price": "99.99",
        "currency": "CAD",
        "income_category_name": "Hardware Sales",
        "income_account_label": "4200 - Product Revenue",
        "expense_account_label": "5100 - Cost of Goods Sold",
        "description": "Entry-level widget for budget-conscious customers",
        "usage_count": 128,
        "last_sold_on": "2026-01-29",
    },
    {
        "id": 5,
        "name": "Training Session",
        "code": "TRAINING",
        "sku": "SVC-003",
        "kind": "service",
        "type": "SERVICE",
        "status": "active",
        "price": "750.00",
        "currency": "CAD",
        "income_category_name": "Training & Education",
        "income_account_label": "4100 - Service Revenue",
        "expense_account_label": None,
        "description": "Full-day on-site training session",
        "usage_count": 8,
        "last_sold_on": "2026-01-15",
    },
    {
        "id": 6,
        "name": "Legacy Product",
        "code": "LEGACY-001",
        "sku": "PRD-OLD",
        "kind": "product",
        "type": "PRODUCT",
        "status": "archived",
        "price": "199.99",
        "currency": "CAD",
        "income_category_name": "Hardware Sales",
        "income_account_label": "4200 - Product Revenue",
        "expense_account_label": "5100 - Cost of Goods Sold",
        "description": "Discontinued product - replaced by Premium Widget",
        "usage_count": 0,
        "last_sold_on": "2025-06-01",
    },
]


@app.get("/api/products/list/")
def list_products(kind: str | None = None, status: str | None = None, q: str | None = None) -> dict:
    items = MOCK_PRODUCTS.copy()
    
    # Filter by kind
    if kind and kind != "all":
        items = [i for i in items if i["kind"] == kind]
    
    # Filter by status
    if status and status != "all":
        items = [i for i in items if i["status"] == status]
    
    # Filter by search query
    if q:
        q_lower = q.lower()
        items = [i for i in items if 
                 q_lower in i["name"].lower() or 
                 q_lower in i["code"].lower() or 
                 q_lower in (i.get("sku") or "").lower()]
    
    # Calculate stats from ALL products (not filtered)
    all_active = [p for p in MOCK_PRODUCTS if p["status"] == "active"]
    active_count = len(all_active)
    product_count = len([p for p in all_active if p["kind"] == "product"])
    service_count = len([p for p in all_active if p["kind"] == "service"])
    avg_price = sum(float(p["price"]) for p in all_active) / len(all_active) if all_active else 0
    
    return {
        "items": items,
        "stats": {
            "active_count": active_count,
            "product_count": product_count,
            "service_count": service_count,
            "avg_price": f"{avg_price:.2f}",
        },
        "currency": "CAD",
    }


# -----------------------------------------------------------------------------
# Invoices API
# -----------------------------------------------------------------------------

MOCK_INVOICES = [
    {
        "id": 1,
        "invoice_number": "INV-2026-001",
        "customer_id": 1,
        "customer_name": "Acme Corporation",
        "customer_email": "billing@acme.com",
        "status": "SENT",
        "issue_date": "2026-01-15",
        "due_date": "2026-02-14",
        "net_total": "10000.00",
        "tax_total": "1300.00",
        "grand_total": "11300.00",
        "amount_paid": "0.00",
        "currency": "CAD",
        "memo": "Website development phase 1",
    },
    {
        "id": 2,
        "invoice_number": "INV-2026-002",
        "customer_id": 2,
        "customer_name": "TechStart Inc",
        "customer_email": "accounts@techstart.io",
        "status": "PAID",
        "issue_date": "2026-01-10",
        "due_date": "2026-01-25",
        "net_total": "2500.00",
        "tax_total": "325.00",
        "grand_total": "2825.00",
        "amount_paid": "2825.00",
        "currency": "CAD",
        "memo": "Monthly retainer - January",
    },
    {
        "id": 3,
        "invoice_number": "INV-2026-003",
        "customer_id": 3,
        "customer_name": "Global Retail Ltd",
        "customer_email": "finance@globalretail.com",
        "status": "PARTIAL",
        "issue_date": "2026-01-05",
        "due_date": "2026-01-20",
        "net_total": "15000.00",
        "tax_total": "1950.00",
        "grand_total": "16950.00",
        "amount_paid": "8000.00",
        "currency": "CAD",
        "memo": "Enterprise software license",
    },
    {
        "id": 4,
        "invoice_number": "INV-2026-004",
        "customer_id": 5,
        "customer_name": "Creative Studio",
        "customer_email": "hello@creativestudio.design",
        "status": "DRAFT",
        "issue_date": "2026-01-28",
        "due_date": "2026-02-27",
        "net_total": "3500.00",
        "tax_total": "455.00",
        "grand_total": "3955.00",
        "amount_paid": "0.00",
        "currency": "CAD",
        "memo": "Logo design and branding package",
    },
    {
        "id": 5,
        "invoice_number": "INV-2025-089",
        "customer_id": 3,
        "customer_name": "Global Retail Ltd",
        "customer_email": "finance@globalretail.com",
        "status": "SENT",
        "issue_date": "2025-12-15",
        "due_date": "2026-01-14",
        "net_total": "8750.00",
        "tax_total": "1137.50",
        "grand_total": "9887.50",
        "amount_paid": "0.00",
        "currency": "CAD",
        "memo": "Q4 consulting services",
    },
]

STATUS_CHOICES = [
    {"value": "DRAFT", "label": "Draft"},
    {"value": "SENT", "label": "Sent"},
    {"value": "PARTIAL", "label": "Partial"},
    {"value": "PAID", "label": "Paid"},
    {"value": "VOID", "label": "Void"},
]


@app.get("/api/invoices/list/")
def list_invoices(status: str | None = None, start: str | None = None, end: str | None = None) -> dict:
    from datetime import datetime
    
    invoices = MOCK_INVOICES.copy()
    
    # Filter by status
    if status and status != "all":
        if status == "overdue":
            today = datetime.now().date()
            invoices = [
                inv for inv in invoices 
                if inv["due_date"] and datetime.strptime(inv["due_date"], "%Y-%m-%d").date() < today
                and inv["status"] not in ("PAID", "VOID", "DRAFT")
            ]
        else:
            invoices = [inv for inv in invoices if inv["status"].lower() == status.lower()]
    
    # Filter by date range
    if start:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        invoices = [inv for inv in invoices if inv["issue_date"] and datetime.strptime(inv["issue_date"], "%Y-%m-%d").date() >= start_date]
    if end:
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
        invoices = [inv for inv in invoices if inv["issue_date"] and datetime.strptime(inv["issue_date"], "%Y-%m-%d").date() <= end_date]
    
    # Calculate stats from ALL invoices (not filtered)
    open_balance = sum(
        float(inv["grand_total"]) - float(inv["amount_paid"])
        for inv in MOCK_INVOICES
        if inv["status"] not in ("PAID", "VOID")
    )
    revenue_ytd = sum(float(inv["amount_paid"]) for inv in MOCK_INVOICES)
    total_invoices = len(MOCK_INVOICES)
    avg_value = sum(float(inv["grand_total"]) for inv in MOCK_INVOICES) / total_invoices if total_invoices else 0
    
    return {
        "invoices": invoices,
        "stats": {
            "open_balance_total": f"{open_balance:.2f}",
            "revenue_ytd": f"{revenue_ytd:.2f}",
            "total_invoices": total_invoices,
            "avg_invoice_value": f"{avg_value:.2f}",
        },
        "status_filter": status or "all",
        "selected_invoice": None,
        "currency": "CAD",
        "status_choices": STATUS_CHOICES,
    }


# -----------------------------------------------------------------------------
# Suppliers API
# -----------------------------------------------------------------------------

MOCK_SUPPLIERS = [
    {
        "id": 1,
        "name": "Office Depot",
        "email": "accounts@officedepot.com",
        "phone": "+1 555-1001",
        "address": "123 Supply Chain Blvd, Toronto, ON M5V 2K1",
        "total_spend": "15420.00",
        "ytd_spend": "4250.00",
        "expense_count": 18,
        "is_active": True,
        "last_expense_date": "2026-01-25",
    },
    {
        "id": 2,
        "name": "AWS Cloud Services",
        "email": "billing@aws.amazon.com",
        "phone": "",
        "address": "410 Terry Avenue N, Seattle, WA 98109",
        "total_spend": "28500.00",
        "ytd_spend": "12800.00",
        "expense_count": 24,
        "is_active": True,
        "last_expense_date": "2026-01-28",
    },
    {
        "id": 3,
        "name": "Google Workspace",
        "email": "payments@google.com",
        "phone": "",
        "address": "1600 Amphitheatre Parkway, Mountain View, CA",
        "total_spend": "4800.00",
        "ytd_spend": "400.00",
        "expense_count": 12,
        "is_active": True,
        "last_expense_date": "2026-01-01",
    },
    {
        "id": 4,
        "name": "Swift Couriers",
        "email": "dispatch@swiftcouriers.ca",
        "phone": "+1 555-2002",
        "address": "456 Logistics Way, Vancouver, BC V6B 4N9",
        "total_spend": "8750.00",
        "ytd_spend": "2100.00",
        "expense_count": 32,
        "is_active": True,
        "last_expense_date": "2026-01-20",
    },
    {
        "id": 5,
        "name": "Metro Insurance",
        "email": "claims@metroinsurance.ca",
        "phone": "+1 555-3003",
        "address": "789 Financial District, Calgary, AB T2P 3C4",
        "total_spend": "12000.00",
        "ytd_spend": "3000.00",
        "expense_count": 4,
        "is_active": True,
        "last_expense_date": "2026-01-15",
    },
    {
        "id": 6,
        "name": "Old Vendor Corp",
        "email": "support@oldvendor.com",
        "phone": "+1 555-0000",
        "address": "999 Legacy Lane, Montreal, QC H3B 2T7",
        "total_spend": "5500.00",
        "ytd_spend": "0.00",
        "expense_count": 8,
        "is_active": False,
        "last_expense_date": "2025-06-30",
    },
]


@app.get("/api/suppliers/list/")
def list_suppliers() -> dict:
    total_spend = sum(float(s["total_spend"]) for s in MOCK_SUPPLIERS)
    ytd_spend = sum(float(s["ytd_spend"]) for s in MOCK_SUPPLIERS)
    total_suppliers = len(MOCK_SUPPLIERS)
    
    return {
        "suppliers": MOCK_SUPPLIERS,
        "stats": {
            "total_suppliers": total_suppliers,
            "total_spend": f"{total_spend:.2f}",
            "ytd_spend": f"{ytd_spend:.2f}",
        },
        "currency": "CAD",
    }


# -----------------------------------------------------------------------------
# Expenses API
# -----------------------------------------------------------------------------

EXPENSE_CATEGORIES = [
    {"id": 1, "name": "Office Supplies"},
    {"id": 2, "name": "Software & Subscriptions"},
    {"id": 3, "name": "Travel & Transportation"},
    {"id": 4, "name": "Utilities"},
    {"id": 5, "name": "Professional Services"},
    {"id": 6, "name": "Insurance"},
]

MOCK_EXPENSES = [
    {
        "id": 1,
        "description": "AWS Monthly Hosting",
        "supplier_id": 2,
        "supplier_name": "AWS Cloud Services",
        "category_id": 2,
        "category_name": "Software & Subscriptions",
        "status": "PAID",
        "date": "2026-01-28",
        "amount": "1280.00",
        "amount_paid": "1280.00",
        "currency": "CAD",
        "memo": "January hosting costs",
        "receipt_url": None,
    },
    {
        "id": 2,
        "description": "Office Printer Paper & Toner",
        "supplier_id": 1,
        "supplier_name": "Office Depot",
        "category_id": 1,
        "category_name": "Office Supplies",
        "status": "PAID",
        "date": "2026-01-25",
        "amount": "245.00",
        "amount_paid": "245.00",
        "currency": "CAD",
        "memo": None,
        "receipt_url": None,
    },
    {
        "id": 3,
        "description": "Google Workspace Annual",
        "supplier_id": 3,
        "supplier_name": "Google Workspace",
        "category_id": 2,
        "category_name": "Software & Subscriptions",
        "status": "PAID",
        "date": "2026-01-01",
        "amount": "400.00",
        "amount_paid": "400.00",
        "currency": "CAD",
        "memo": "Annual subscription",
        "receipt_url": None,
    },
    {
        "id": 4,
        "description": "Courier Services - Client Deliveries",
        "supplier_id": 4,
        "supplier_name": "Swift Couriers",
        "category_id": 3,
        "category_name": "Travel & Transportation",
        "status": "UNPAID",
        "date": "2026-01-20",
        "amount": "350.00",
        "amount_paid": "0.00",
        "currency": "CAD",
        "memo": "Weekly delivery run",
        "receipt_url": None,
    },
    {
        "id": 5,
        "description": "Q1 Business Insurance",
        "supplier_id": 5,
        "supplier_name": "Metro Insurance",
        "category_id": 6,
        "category_name": "Insurance",
        "status": "PARTIAL",
        "date": "2026-01-15",
        "amount": "3000.00",
        "amount_paid": "1500.00",
        "currency": "CAD",
        "memo": "Quarterly premium - 2 payments",
        "receipt_url": None,
    },
    {
        "id": 6,
        "description": "Electricity Bill - January",
        "supplier_id": None,
        "supplier_name": None,
        "category_id": 4,
        "category_name": "Utilities",
        "status": "UNPAID",
        "date": "2026-01-22",
        "amount": "185.00",
        "amount_paid": "0.00",
        "currency": "CAD",
        "memo": "Office electricity",
        "receipt_url": None,
    },
    {
        "id": 7,
        "description": "Legal Consultation",
        "supplier_id": None,
        "supplier_name": "Smith & Associates",
        "category_id": 5,
        "category_name": "Professional Services",
        "status": "PAID",
        "date": "2026-01-18",
        "amount": "750.00",
        "amount_paid": "750.00",
        "currency": "CAD",
        "memo": "Contract review services",
        "receipt_url": None,
    },
]

EXPENSE_STATUS_CHOICES = [
    {"value": "UNPAID", "label": "Unpaid"},
    {"value": "PARTIAL", "label": "Partial"},
    {"value": "PAID", "label": "Paid"},
]


@app.get("/api/expenses/list/")
def list_expenses(
    status: str | None = None,
    period: str | None = None,
    category: int | None = None,
    supplier: int | None = None,
    start: str | None = None,
    end: str | None = None
) -> dict:
    from datetime import datetime, timedelta
    
    expenses = MOCK_EXPENSES.copy()
    
    # Filter by supplier (for supplier detail page)
    if supplier:
        expenses = [e for e in expenses if e["supplier_id"] == supplier]
    
    # Filter by status
    if status and status not in ("all", ""):
        expenses = [e for e in expenses if e["status"].lower() == status.lower()]
    
    # Filter by category
    if category:
        expenses = [e for e in expenses if e["category_id"] == category]
    
    # Filter by period
    today = datetime.now().date()
    if period == "this_month":
        month_start = today.replace(day=1)
        expenses = [
            e for e in expenses 
            if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() >= month_start
        ]
    elif period == "this_year":
        year_start = today.replace(month=1, day=1)
        expenses = [
            e for e in expenses 
            if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() >= year_start
        ]
    
    # Filter by date range
    if start:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        expenses = [
            e for e in expenses 
            if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() >= start_date
        ]
    if end:
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
        expenses = [
            e for e in expenses 
            if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() <= end_date
        ]
    
    # Calculate stats from ALL expenses
    all_total = sum(float(e["amount"]) for e in MOCK_EXPENSES)
    month_total = sum(
        float(e["amount"]) for e in MOCK_EXPENSES 
        if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() >= today.replace(day=1)
    )
    year_total = sum(
        float(e["amount"]) for e in MOCK_EXPENSES 
        if e["date"] and datetime.strptime(e["date"], "%Y-%m-%d").date() >= today.replace(month=1, day=1)
    )
    filtered_total = sum(float(e["amount"]) for e in expenses)
    avg_expense = all_total / len(MOCK_EXPENSES) if MOCK_EXPENSES else 0
    
    return {
        "expenses": expenses,
        "stats": {
            "expenses_ytd": f"{year_total:.2f}",
            "expenses_month": f"{month_total:.2f}",
            "total_all": f"{all_total:.2f}",
            "avg_expense": f"{avg_expense:.2f}",
            "total_filtered": f"{filtered_total:.2f}",
        },
        "period": period or "all",
        "status_filter": status or "all",
        "category_filter": category,
        "categories": EXPENSE_CATEGORIES,
        "selected_expense": None,
        "currency": "CAD",
        "status_choices": EXPENSE_STATUS_CHOICES,
    }


# -----------------------------------------------------------------------------
# Categories API (Chart of Accounts style)
# -----------------------------------------------------------------------------

MOCK_CATEGORIES = [
    {
        "id": 1,
        "name": "Professional Services",
        "code": "4100",
        "type": "INCOME",
        "description": "Consulting, development, and advisory services",
        "is_archived": False,
        "account_label": "4100 - Service Revenue",
        "account_id": 4100,
        "transaction_count": 45,
        "current_month_total": "28500.00",
        "ytd_total": "187500.00",
        "last_used_at": "2026-01-28",
    },
    {
        "id": 2,
        "name": "Product Sales",
        "code": "4200",
        "type": "INCOME",
        "description": "Revenue from product sales and licensing",
        "is_archived": False,
        "account_label": "4200 - Product Revenue",
        "account_id": 4200,
        "transaction_count": 23,
        "current_month_total": "12000.00",
        "ytd_total": "95000.00",
        "last_used_at": "2026-01-25",
    },
    {
        "id": 3,
        "name": "Interest Income",
        "code": "4300",
        "type": "INCOME",
        "description": "Bank interest and investment returns",
        "is_archived": False,
        "account_label": "4300 - Other Income",
        "account_id": 4300,
        "transaction_count": 4,
        "current_month_total": "125.00",
        "ytd_total": "1450.00",
        "last_used_at": "2026-01-15",
    },
    {
        "id": 4,
        "name": "Office Supplies",
        "code": "5100",
        "type": "EXPENSE",
        "description": "Paper, toner, stationery, and general office supplies",
        "is_archived": False,
        "account_label": "5100 - Office Supplies",
        "account_id": 5100,
        "transaction_count": 18,
        "current_month_total": "245.00",
        "ytd_total": "2800.00",
        "last_used_at": "2026-01-25",
    },
    {
        "id": 5,
        "name": "Software & Subscriptions",
        "code": "5200",
        "type": "EXPENSE",
        "description": "SaaS subscriptions, software licenses, cloud services",
        "is_archived": False,
        "account_label": "5200 - Software Expense",
        "account_id": 5200,
        "transaction_count": 36,
        "current_month_total": "1680.00",
        "ytd_total": "18500.00",
        "last_used_at": "2026-01-28",
    },
    {
        "id": 6,
        "name": "Travel & Transportation",
        "code": "5300",
        "type": "EXPENSE",
        "description": "Flights, hotels, mileage, taxis, and courier services",
        "is_archived": False,
        "account_label": "5300 - Travel Expense",
        "account_id": 5300,
        "transaction_count": 32,
        "current_month_total": "350.00",
        "ytd_total": "8900.00",
        "last_used_at": "2026-01-20",
    },
    {
        "id": 7,
        "name": "Professional Services (Expense)",
        "code": "5400",
        "type": "EXPENSE",
        "description": "Legal, accounting, and consulting fees paid",
        "is_archived": False,
        "account_label": "5400 - Professional Fees",
        "account_id": 5400,
        "transaction_count": 8,
        "current_month_total": "750.00",
        "ytd_total": "6200.00",
        "last_used_at": "2026-01-18",
    },
    {
        "id": 8,
        "name": "Insurance",
        "code": "5500",
        "type": "EXPENSE",
        "description": "Business insurance, liability, and professional indemnity",
        "is_archived": False,
        "account_label": "5500 - Insurance Expense",
        "account_id": 5500,
        "transaction_count": 4,
        "current_month_total": "1500.00",
        "ytd_total": "12000.00",
        "last_used_at": "2026-01-15",
    },
    {
        "id": 9,
        "name": "Utilities",
        "code": "5600",
        "type": "EXPENSE",
        "description": "Electricity, internet, phone, and water",
        "is_archived": False,
        "account_label": "5600 - Utilities",
        "account_id": 5600,
        "transaction_count": 12,
        "current_month_total": "185.00",
        "ytd_total": "2200.00",
        "last_used_at": "2026-01-22",
    },
    {
        "id": 10,
        "name": "Advertising & Marketing",
        "code": "5700",
        "type": "EXPENSE",
        "description": "Ads, promotions, and marketing campaigns",
        "is_archived": True,
        "account_label": "5700 - Marketing Expense",
        "account_id": 5700,
        "transaction_count": 0,
        "current_month_total": "0.00",
        "ytd_total": "0.00",
        "last_used_at": "2025-09-15",
    },
]


@app.get("/api/categories/list/")
def list_categories(
    type: str | None = None,
    archived: str | None = None,
    q: str | None = None
) -> dict:
    categories = MOCK_CATEGORIES.copy()
    
    # Filter by type
    if type and type.lower() in ("income", "expense"):
        categories = [c for c in categories if c["type"].lower() == type.lower()]
    
    # Filter by archived status
    if archived == "true":
        categories = [c for c in categories if c["is_archived"]]
    else:
        # By default show non-archived
        categories = [c for c in categories if not c["is_archived"]]
    
    # Filter by search query
    if q:
        q_lower = q.lower()
        categories = [
            c for c in categories 
            if q_lower in c["name"].lower() 
            or q_lower in c["code"].lower() 
            or q_lower in (c["description"] or "").lower()
        ]
    
    # Calculate stats from ALL non-archived categories
    all_active = [c for c in MOCK_CATEGORIES if not c["is_archived"]]
    income_cats = [c for c in all_active if c["type"] == "INCOME"]
    expense_cats = [c for c in all_active if c["type"] == "EXPENSE"]
    
    return {
        "categories": categories,
        "stats": {
            "active_count": len(all_active),
            "income_categories": len(income_cats),
            "expense_categories": len(expense_cats),
            "uncategorized_count": 3,  # Mock value
            "uncategorized_ytd": "1250.00",  # Mock value
        },
        "currency": "CAD",
    }


# -----------------------------------------------------------------------------
# Banking API
# -----------------------------------------------------------------------------

MOCK_BANK_ACCOUNTS = [
    {
        "id": 1,
        "name": "Business Checking",
        "bank": "RBC",
        "currency": "CAD",
        "last4": "4521",
        "ledger_balance": "45230.00",
        "cleared_balance": "44890.00",
        "balance_masked": False,
        "last_import_at": "2026-01-30T10:30:00Z",
        "new_count": 3,
        "review_url": "/banking/feed/",
        "import_url": "/banking/import/",
    },
    {
        "id": 2,
        "name": "Savings Account",
        "bank": "RBC",
        "currency": "CAD",
        "last4": "8912",
        "ledger_balance": "125000.00",
        "cleared_balance": "125000.00",
        "balance_masked": False,
        "last_import_at": "2026-01-28T15:45:00Z",
        "new_count": 0,
        "review_url": "/banking/feed/",
        "import_url": "/banking/import/",
    },
    {
        "id": 3,
        "name": "Business Credit Card",
        "bank": "AMEX",
        "currency": "CAD",
        "last4": "1003",
        "ledger_balance": "-3245.00",
        "cleared_balance": "-3245.00",
        "balance_masked": False,
        "last_import_at": "2026-01-30T09:15:00Z",
        "new_count": 8,
        "review_url": "/banking/feed/",
        "import_url": "/banking/import/",
    },
]

MOCK_BANK_TRANSACTIONS = [
    {
        "id": 101,
        "account_id": 1,
        "date": "2026-01-30",
        "description": "TRANSFER FROM CLIENT - ACME CORP",
        "amount": "11300.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": "Matches INV-2026-001",
    },
    {
        "id": 102,
        "account_id": 1,
        "date": "2026-01-29",
        "description": "AWS SERVICES - MONTHLY",
        "amount": "-1280.00",
        "status": "MATCHED_SINGLE",
        "category_name": "Software & Subscriptions",
        "match_suggestion": None,
    },
    {
        "id": 103,
        "account_id": 1,
        "date": "2026-01-28",
        "description": "STRIPE DEPOSIT",
        "amount": "2825.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": "Matches INV-2026-002",
    },
    {
        "id": 104,
        "account_id": 1,
        "date": "2026-01-25",
        "description": "OFFICE DEPOT #2341",
        "amount": "-245.00",
        "status": "MATCHED_SINGLE",
        "category_name": "Office Supplies",
        "match_suggestion": None,
    },
    {
        "id": 105,
        "account_id": 1,
        "date": "2026-01-22",
        "description": "HYDRO ONE ELECTRICITY",
        "amount": "-185.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 201,
        "account_id": 3,
        "date": "2026-01-30",
        "description": "UBER TRIP - CLIENT MEETING",
        "amount": "-45.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 202,
        "account_id": 3,
        "date": "2026-01-29",
        "description": "ZOOM PRO - MONTHLY",
        "amount": "-21.99",
        "status": "MATCHED_SINGLE",
        "category_name": "Software & Subscriptions",
        "match_suggestion": None,
    },
    {
        "id": 203,
        "account_id": 3,
        "date": "2026-01-28",
        "description": "GOOGLE CLOUD PLATFORM",
        "amount": "-156.00",
        "status": "PARTIAL",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 204,
        "account_id": 3,
        "date": "2026-01-26",
        "description": "SLACK TECHNOLOGIES",
        "amount": "-89.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 205,
        "account_id": 3,
        "date": "2026-01-25",
        "description": "RESTAURANT - CLIENT LUNCH",
        "amount": "-125.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 206,
        "account_id": 3,
        "date": "2026-01-24",
        "description": "FIGMA INC",
        "amount": "-15.00",
        "status": "MATCHED_SINGLE",
        "category_name": "Software & Subscriptions",
        "match_suggestion": None,
    },
    {
        "id": 207,
        "account_id": 3,
        "date": "2026-01-23",
        "description": "GITHUB INC",
        "amount": "-44.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
    {
        "id": 208,
        "account_id": 3,
        "date": "2026-01-22",
        "description": "NOTION LABS",
        "amount": "-96.00",
        "status": "NEW",
        "category_name": None,
        "match_suggestion": None,
    },
]


@app.get("/api/banking/overview/")
def banking_overview() -> dict:
    new_to_review = sum(acc["new_count"] for acc in MOCK_BANK_ACCOUNTS)
    return {
        "accounts": MOCK_BANK_ACCOUNTS,
        "summary": {
            "new_to_review": new_to_review,
            "created_from_feed": 45,
            "matched_to_invoices": 12,
            "reconciled_percent": 87,
        },
    }


@app.get("/api/banking/feed/transactions/")
def banking_transactions(account_id: int | None = None, status: str | None = None) -> dict:
    txs = MOCK_BANK_TRANSACTIONS.copy()
    
    # Filter by account
    if account_id:
        txs = [t for t in txs if t["account_id"] == account_id]
    
    # Filter by status
    if status and status.upper() != "ALL":
        txs = [t for t in txs if t["status"] == status.upper()]
    
    return {
        "transactions": txs,
        "total": len(txs),
    }


# -----------------------------------------------------------------------------
# Reconciliation API
# -----------------------------------------------------------------------------

MOCK_RECO_ACCOUNTS = [
    {
        "id": "1",
        "name": "1000 · Cash (Main)",
        "bankLabel": "RBC Business #1",
        "currency": "CAD",
        "isDefault": True,
    },
    {
        "id": "2",
        "name": "1010 · Business Savings",
        "bankLabel": "RBC Savings #2",
        "currency": "CAD",
        "isDefault": False,
    },
    {
        "id": "3",
        "name": "2000 · AMEX Corporate",
        "bankLabel": "AMEX Corporate Gold",
        "currency": "CAD",
        "isDefault": False,
    },
]

MOCK_RECO_PERIODS = {
    "1": [
        {"id": "p1", "label": "January 2026", "startDate": "2026-01-01", "endDate": "2026-01-31", "isCurrent": True, "isLocked": False},
        {"id": "p2", "label": "December 2025", "startDate": "2025-12-01", "endDate": "2025-12-31", "isCurrent": False, "isLocked": True},
    ],
    "2": [
        {"id": "p3", "label": "Q4 2025", "startDate": "2025-10-01", "endDate": "2025-12-31", "isCurrent": True, "isLocked": False},
    ],
    "3": [
        {"id": "p4", "label": "January 2026", "startDate": "2026-01-01", "endDate": "2026-01-31", "isCurrent": True, "isLocked": False},
    ],
}

MOCK_RECO_SESSIONS = {
    "1_p1": {
        "id": "s1",
        "status": "DRAFT",
        "opening_balance": 45000.00,
        "statement_ending_balance": 52000.00,
        "cleared_balance": 45000.00,
        "difference": 7000.00,
        "total_transactions": 5,
        "reconciled_count": 0,
        "excluded_count": 0,
        "unreconciled_count": 5,
        "reconciled_percent": 0.0,
    }
}

MOCK_RECO_TRANSACTIONS = {
    "1_p1": [
        {"id": 1001, "date": "2026-01-15", "description": "Client Payment - Acme Corp", "amount": 5000.00, "status": "new", "ui_status": "NEW", "is_cleared": False},
        {"id": 1002, "date": "2026-01-16", "description": "Starbucks Coffee", "amount": -15.50, "status": "new", "ui_status": "NEW", "is_cleared": False},
        {"id": 1003, "date": "2026-01-18", "description": "AWS Hosting Plans", "amount": -240.00, "status": "new", "ui_status": "NEW", "is_cleared": False},
        {"id": 1004, "date": "2026-01-20", "description": "Office Rent - Downtown", "amount": -2500.00, "status": "new", "ui_status": "NEW", "is_cleared": False},
        {"id": 1005, "date": "2026-01-22", "description": "Apple Store - Laptop", "amount": -1800.00, "status": "new", "ui_status": "NEW", "is_cleared": False},
    ]
}

@app.get("/api/reconciliation/accounts/")
def list_reco_accounts() -> list:
    return MOCK_RECO_ACCOUNTS

@app.get("/api/reconciliation/accounts/{bank_id}/periods/")
def list_reco_periods(bank_id: str) -> dict:
    return {"periods": MOCK_RECO_PERIODS.get(bank_id, [])}

@app.get("/api/reconciliation/session/")
def get_reco_session(account: str, start: str, end: str) -> dict:
    # Find period id
    periods = MOCK_RECO_PERIODS.get(account, [])
    period = next((p for p in periods if p["startDate"] == start and p["endDate"] == end), None)
    if not period:
        # Create a default mock period if not found
        period = {"id": "p_temp", "label": "Custom Period", "startDate": start, "endDate": end, "isCurrent": True, "isLocked": False}
    
    key = f"{account}_{period['id']}"
    session = MOCK_RECO_SESSIONS.get(key, {
        "id": "s_new",
        "status": "DRAFT",
        "opening_balance": 0.0,
        "statement_ending_balance": 0.0,
        "cleared_balance": 0.0,
        "difference": 0.0,
        "total_transactions": 0,
        "reconciled_count": 0,
        "reconciled_percent": 0.0,
    })
    
    # Get txs
    txs = MOCK_RECO_TRANSACTIONS.get(key, [])
    
    # Mock bank account info
    bank_acc = next((a for a in MOCK_RECO_ACCOUNTS if a["id"] == account), {"id": account, "name": "Unknown", "currency": "CAD"})
    
    return {
        "session": session,
        "period": period,
        "bank_account": bank_acc,
        "feed": {
            "new": [t for t in txs if t["status"] == "new"],
            "matched": [t for t in txs if t["status"] == "matched"],
            "partial": [t for t in txs if t["status"] == "partial"],
            "excluded": [t for t in txs if t["status"] == "excluded"],
        }
    }

@app.get("/api/reconciliation/matches/")
def list_match_candidates(transaction_id: int) -> list:
    # Return 1 mock candidate for any transaction to show functionality
    return [
        {
            "journal_entry_id": 9991, 
            "confidence": 0.95, 
            "reason": "Exact amount and date match on ledger"
        }
    ]

@app.post("/api/reconciliation/confirm-match/")
def confirm_match(payload: dict) -> dict:
    return {"status": "ok"}

@app.post("/api/reconciliation/add-as-new/")
def add_as_new(payload: dict) -> dict:
    return {"status": "ok"}

@app.post("/api/reconciliation/session/{session_id}/exclude/")
def exclude_tx(session_id: str, payload: dict) -> dict:
    return {"status": "ok"}

@app.post("/api/reconciliation/session/{session_id}/set_statement_balance/")
def set_statement_balance(session_id: str, payload: dict) -> dict:
    return {"status": "ok"}

@app.post("/api/reconciliation/sessions/{session_id}/complete/")
def complete_session(session_id: str) -> dict:
    return {"status": "ok"}


# -----------------------------------------------------------------------------
# Tax Guardian API
# -----------------------------------------------------------------------------

MOCK_TAX_PERIODS = [
    {
        "period_key": "2026-01",
        "status": "DRAFT",
        "net_tax": 4250.00,
        "anomaly_counts": {"low": 5, "medium": 2, "high": 0},
        "due_date": "2026-02-28",
        "is_due_soon": True,
        "is_overdue": False,
        "payment_status": "UNPAID",
    },
    {
        "period_key": "2025-12",
        "status": "FILED",
        "net_tax": 3800.00,
        "anomaly_counts": {"low": 2, "medium": 0, "high": 0},
        "due_date": "2026-01-31",
        "is_due_soon": False,
        "is_overdue": False,
        "payment_status": "PAID",
    },
]

MOCK_TAX_ANOMALIES = [
    {
        "id": "tax-1",
        "code": "HIGH_VALUE_WITHOUT_TAX",
        "severity": "high",
        "status": "OPEN",
        "description": "Subscription payment to 'Cloud Provider' ($1,280) has no tax assigned but usually does.",
        "task_code": "REVIEW_TX",
        "created_at": "2026-01-30T10:00:00Z",
    },
    {
        "id": "tax-2",
        "code": "MISSING_JURISDICTION",
        "severity": "medium",
        "status": "OPEN",
        "description": "Sale to 'Client X' in Ontario has no HST recorded.",
        "task_code": "ASSIGN_TAX",
        "created_at": "2026-01-29T15:00:00Z",
    },
    {
        "id": "tax-3",
        "code": "RATE_MISMATCH",
        "severity": "low",
        "status": "RESOLVED",
        "description": "Tax rate 12.5% differs from standard 13% for HST.",
        "task_code": "CONFIRM_RATE",
        "created_at": "2026-01-28T09:00:00Z",
        "resolved_at": "2026-01-28T14:00:00Z",
    }
]

@app.get("/api/tax/periods/")
def list_tax_periods() -> dict:
    return {"periods": MOCK_TAX_PERIODS}

@app.get("/api/tax/periods/{period_key}/")
def get_tax_snapshot(period_key: str) -> dict:
    period = next((p for p in MOCK_TAX_PERIODS if p["period_key"] == period_key), MOCK_TAX_PERIODS[0])
    return {
        "period_key": period_key,
        "country": "CA",
        "status": period["status"],
        "due_date": period["due_date"],
        "is_due_soon": period["is_due_soon"],
        "is_overdue": period["is_overdue"],
        "llm_summary": "Your GST/HST position for January is mostly clear. I found 2 medium anomalies related to missing jurisdiction markers on Ontario sales. Filing is due in 28 days.",
        "summary_by_jurisdiction": {
            "CA-ON": {"name": "Ontario (HST)", "net_tax": 4250.00, "sales_total": 32692.30}
        },
        "net_tax": period["net_tax"],
        "payment_status": period["payment_status"],
        "payments": [],
        "payments_total": 0.0,
        "balance": period["net_tax"],
        "remaining_balance": period["net_tax"],
        "anomaly_counts": period["anomaly_counts"],
        "has_high_severity_blockers": period["anomaly_counts"]["high"] > 0,
    }

@app.get("/api/tax/periods/{period_key}/anomalies/")
def list_tax_anomalies(period_key: str, severity: str | None = None, status: str | None = None) -> dict:
    anomalies = MOCK_TAX_ANOMALIES
    if severity and severity != "all":
        anomalies = [a for a in anomalies if a["severity"] == severity]
    if status and status != "all":
        anomalies = [a for a in anomalies if a["status"] == status]
    return {"anomalies": anomalies}

@app.post("/api/tax/periods/{period_key}/refresh/")
def refresh_tax_data(period_key: str) -> dict:
    return {"status": "ok"}

@app.post("/api/tax/periods/{period_key}/llm-enrich/")
def enrich_tax_data(period_key: str) -> dict:
    return {"status": "ok"}
