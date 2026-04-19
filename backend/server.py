from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import asyncio
import resend
import base64
import csv
import io
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI from fastapi.staticfiles import StaticFiles from fastapi.responses import FileResponse
# Compatibility shim replacing emergentintegrations
_openai_client = None
def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=os.environ.get('EMERGENT_LLM_KEY', ''))
    return _openai_client
class ImageContent:
    def __init__(self, image_base64: str = None, url: str = None):
        self.image_base64 = image_base64
        self.url = url
class UserMessage:
    def __init__(self, text: str = '', file_contents: list = None):
        self.text = text
        self.file_contents = file_contents or []
class LlmChat:
    def __init__(self, api_key: str = '', session_id: str = '', system_message: str = ''):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model = 'gpt-4o'
        self.messages = []
    def with_model(self, provider: str, model: str):
        self.model = model
        return self
    async def send_message(self, user_msg: 'UserMessage') -> str:
        client = AsyncOpenAI(api_key=self.api_key or os.environ.get('EMERGENT_LLM_KEY', ''))
        msgs = [{'role': 'system', 'content': self.system_message}]
        for m in self.messages:
            if isinstance(m, dict):
                msgs.append(m)
        content = []
        if user_msg.text:
            content.append({'type': 'text', 'text': user_msg.text})
        for fc in user_msg.file_contents:
            if isinstance(fc, ImageContent) and fc.image_base64:
                content.append({'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{fc.image_base64}'}})
        msgs.append({'role': 'user', 'content': content if len(content) > 1 else user_msg.text})
        try:
            resp = await client.chat.completions.create(model='gpt-4o', messages=msgs)
            return resp.choices[0].message.content
        except Exception:
            resp = await client.chat.completions.create(model='gpt-4o-mini', messages=msgs)
            return resp.choices[0].message.content

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Resend setup
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ALERT_RECIPIENT_EMAIL = os.environ.get('ALERT_RECIPIENT_EMAIL', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ───

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class CompanyOut(BaseModel):
    company_id: str
    name: str
    short_name: str
    type: str
    currency: str = "USD"

class CustomerCreate(BaseModel):
    name: str
    company_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    tax_id: Optional[str] = ""
    notes: Optional[str] = ""

class VendorCreate(BaseModel):
    name: str
    company_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    tax_id: Optional[str] = ""
    default_expense_account: Optional[str] = ""
    notes: Optional[str] = ""

class InvoiceLineItem(BaseModel):
    product: str = ""
    description: str = ""
    quantity: float = 0
    unit: str = "pcs"
    rate: float = 0
    discount: float = 0
    tax: float = 0
    amount: float = 0

class InvoiceCreate(BaseModel):
    customer_id: str
    customer_name: str = ""
    invoice_date: str = ""
    due_date: str = ""
    sales_rep: str = ""
    warehouse: str = ""
    items: List[InvoiceLineItem] = []
    notes: str = ""
    terms: str = "Net 30"
    subtotal: float = 0
    tax_total: float = 0
    discount_total: float = 0
    total: float = 0
    status: str = "Draft"
    payment_status: str = "Unpaid"
    amount_paid: float = 0

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    amount_paid: Optional[float] = None
    notes: Optional[str] = None

class PaymentRecord(BaseModel):
    amount: float
    payment_date: str = ""
    payment_method: str = "Bank Transfer"
    reference: str = ""
    memo: str = ""

class ExpenseCreate(BaseModel):
    vendor_id: Optional[str] = ""
    vendor_name: Optional[str] = ""
    category: str = ""
    payment_account: str = "Operating Account"
    payment_method: str = "Bank Transfer"
    reference_number: Optional[str] = ""
    expense_date: str = ""
    memo: Optional[str] = ""
    amount: float = 0
    status: str = "Recorded"

class InventoryItemCreate(BaseModel):
    sku: str = ""
    product_name: str = ""
    category: str = ""
    warehouse: str = "Main Warehouse"
    stock_on_hand: float = 0
    reserved_stock: float = 0
    unit_cost: float = 0
    sales_price: float = 0
    unit: str = "pcs"
    reorder_point: float = 10
    status: str = "Active"

class StockAdjustment(BaseModel):
    adjustment_type: str = "receive"
    quantity: float = 0
    reason: str = ""
    reference: str = ""

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = ""
    unit: str = "pcs"
    cost_price: float = 0
    selling_price: float = 0
    case_price: Optional[float] = 0
    case_quantity: Optional[int] = 1
    weight_info: Optional[str] = ""
    sku: Optional[str] = ""
    status: str = "Active"

class EmailRequest(BaseModel):
    recipient_email: str
    subject: str
    html_content: str

class EstimateCreate(BaseModel):
    customer_id: str
    customer_name: str = ""
    estimate_date: str = ""
    expiry_date: str = ""
    items: List[InvoiceLineItem] = []
    notes: str = ""
    terms: str = "Valid for 30 days"
    subtotal: float = 0
    tax_total: float = 0
    discount_total: float = 0
    total: float = 0
    status: str = "Draft"

class BillCreate(BaseModel):
    vendor_id: str
    vendor_name: str = ""
    bill_number: str = ""
    bill_date: str = ""
    due_date: str = ""
    items: list = []
    notes: str = ""
    total: float = 0
    status: str = "Open"
    amount_paid: float = 0

class JournalEntryLine(BaseModel):
    account_code: str = ""
    account_name: str = ""
    description: str = ""
    debit: float = 0
    credit: float = 0

class JournalEntryCreate(BaseModel):
    entry_date: str = ""
    description: str = ""
    lines: List[JournalEntryLine] = []
    status: str = "Draft"

class ReceiveStockCreate(BaseModel):
    vendor_id: str = ""
    vendor_name: str = ""
    reference: str = ""
    receive_date: str = ""
    items: list = []
    notes: str = ""
    total_cost: float = 0

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    sub_type: str = ""
    description: str = ""
    opening_balance: float = 0
    status: str = "Active"

# ─── Auth Helpers ───

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ─── Auth Routes ───

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()
    email = data["email"]
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7*24*60*60
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}

# ─── Companies Routes ───

COMPANIES = [
    {"company_id": "ckfrozen", "name": "CK Frozen Fish & Food Inc.", "short_name": "CK Frozen", "type": "Wholesale Import & Distribution", "currency": "USD"},
    {"company_id": "haor", "name": "Haor Heritage Inc.", "short_name": "Haor Heritage", "type": "Wholesale & Retail", "currency": "USD"},
    {"company_id": "deshi", "name": "Deshi Distributors LLC", "short_name": "Deshi Dist.", "type": "Distribution", "currency": "USD"},
    {"company_id": "ckcanada", "name": "CK Frozen Fish & Food Canada Inc.", "short_name": "CK Canada", "type": "Import & Distribution", "currency": "CAD"},
]

@api_router.get("/companies")
async def get_companies():
    return COMPANIES

@api_router.get("/companies/{company_id}")
async def get_company(company_id: str):
    for c in COMPANIES:
        if c["company_id"] == company_id:
            return c
    raise HTTPException(status_code=404, detail="Company not found")

# ─── Customers Routes ───

@api_router.get("/companies/{company_id}/customers")
async def get_customers(company_id: str, user: dict = Depends(get_current_user)):
    customers = await db.customers.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    return customers

@api_router.post("/companies/{company_id}/customers", status_code=201)
async def create_customer(company_id: str, data: CustomerCreate, user: dict = Depends(get_current_user)):
    cust = {
        "customer_id": f"cust_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "open_balance": 0,
        "total_invoiced": 0,
        "last_invoice_date": None,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.customers.insert_one(cust)
    cust.pop("_id", None)
    return cust

@api_router.get("/companies/{company_id}/customers/{customer_id}")
async def get_customer(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    c = await db.customers.find_one({"company_id": company_id, "customer_id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@api_router.put("/companies/{company_id}/customers/{customer_id}")
async def update_customer(company_id: str, customer_id: str, data: CustomerCreate, user: dict = Depends(get_current_user)):
    result = await db.customers.update_one(
        {"company_id": company_id, "customer_id": customer_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    updated = await db.customers.find_one({"company_id": company_id, "customer_id": customer_id}, {"_id": 0})
    return updated

# ─── Vendors Routes ───

@api_router.get("/companies/{company_id}/vendors")
async def get_vendors(company_id: str, user: dict = Depends(get_current_user)):
    vendors = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    return vendors

@api_router.post("/companies/{company_id}/vendors", status_code=201)
async def create_vendor(company_id: str, data: VendorCreate, user: dict = Depends(get_current_user)):
    vendor = {
        "vendor_id": f"vnd_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "payable_balance": 0,
        "total_billed": 0,
        "bill_count": 0,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.vendors.insert_one(vendor)
    vendor.pop("_id", None)
    return vendor

@api_router.get("/companies/{company_id}/vendors/{vendor_id}")
async def get_vendor(company_id: str, vendor_id: str, user: dict = Depends(get_current_user)):
    v = await db.vendors.find_one({"company_id": company_id, "vendor_id": vendor_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v

@api_router.put("/companies/{company_id}/vendors/{vendor_id}")
async def update_vendor(company_id: str, vendor_id: str, data: VendorCreate, user: dict = Depends(get_current_user)):
    result = await db.vendors.update_one(
        {"company_id": company_id, "vendor_id": vendor_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    updated = await db.vendors.find_one({"company_id": company_id, "vendor_id": vendor_id}, {"_id": 0})
    return updated

# ─── Invoices Routes ───

@api_router.get("/companies/{company_id}/invoices")
async def get_invoices(company_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return invoices

@api_router.post("/companies/{company_id}/invoices", status_code=201)
async def create_invoice(company_id: str, data: InvoiceCreate, user: dict = Depends(get_current_user)):
    count = await db.invoices.count_documents({"company_id": company_id})
    inv_number = f"INV-{str(count + 1001).zfill(5)}"
    items_list = [item.model_dump() for item in data.items]
    invoice = {
        "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "invoice_number": inv_number,
        "customer_id": data.customer_id,
        "customer_name": data.customer_name,
        "invoice_date": data.invoice_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": data.due_date or (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d"),
        "sales_rep": data.sales_rep,
        "warehouse": data.warehouse,
        "items": items_list,
        "notes": data.notes,
        "terms": data.terms,
        "subtotal": data.subtotal,
        "tax_total": data.tax_total,
        "discount_total": data.discount_total,
        "total": data.total,
        "status": data.status,
        "payment_status": data.payment_status,
        "amount_paid": data.amount_paid,
        "balance_due": data.total - data.amount_paid,
        "payments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.invoices.insert_one(invoice)
    invoice.pop("_id", None)
    # Update customer balance
    if data.customer_id:
        await db.customers.update_one(
            {"customer_id": data.customer_id},
            {"$inc": {"open_balance": data.total - data.amount_paid, "total_invoiced": data.total},
             "$set": {"last_invoice_date": invoice["invoice_date"]}}
        )
    return invoice

@api_router.get("/companies/{company_id}/invoices/{invoice_id}")
async def get_invoice(company_id: str, invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"company_id": company_id, "invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

@api_router.put("/companies/{company_id}/invoices/{invoice_id}")
async def update_invoice(company_id: str, invoice_id: str, data: InvoiceUpdate, user: dict = Depends(get_current_user)):
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.invoices.update_one(
        {"company_id": company_id, "invoice_id": invoice_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updated = await db.invoices.find_one({"company_id": company_id, "invoice_id": invoice_id}, {"_id": 0})
    return updated

@api_router.post("/companies/{company_id}/invoices/{invoice_id}/payments")
async def record_payment(company_id: str, invoice_id: str, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"company_id": company_id, "invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    new_paid = inv.get("amount_paid", 0) + payment.amount
    new_balance = inv["total"] - new_paid
    new_status = "Paid" if new_balance <= 0 else "Sent"
    new_payment_status = "Paid" if new_balance <= 0 else "Partial"
    payment_entry = {
        "payment_id": f"pmt_{uuid.uuid4().hex[:8]}",
        **payment.model_dump(),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user["user_id"]
    }
    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"amount_paid": new_paid, "balance_due": new_balance, "status": new_status, "payment_status": new_payment_status},
         "$push": {"payments": payment_entry}}
    )
    # Update customer balance
    if inv.get("customer_id"):
        await db.customers.update_one(
            {"customer_id": inv["customer_id"]},
            {"$inc": {"open_balance": -payment.amount}}
        )
    updated = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    return updated

# ─── Dashboard Routes ───

@api_router.get("/companies/{company_id}/dashboard")
async def get_dashboard(company_id: str, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    customers = await db.customers.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    vendors = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(500)

    total_sales = sum(i.get("total", 0) for i in invoices)
    total_collected = sum(i.get("amount_paid", 0) for i in invoices)
    outstanding_receivables = sum(i.get("balance_due", 0) for i in invoices if i.get("balance_due", 0) > 0)
    total_payables = sum(v.get("payable_balance", 0) for v in vendors)
    invoice_count = len(invoices)

    # Top customers by open balance
    top_customers = sorted(customers, key=lambda c: c.get("open_balance", 0), reverse=True)[:5]
    top_vendors = sorted(vendors, key=lambda v: v.get("payable_balance", 0), reverse=True)[:5]

    # Recent invoices
    recent_invoices = sorted(invoices, key=lambda i: i.get("created_at", ""), reverse=True)[:10]

    # Monthly sales (simple aggregation)
    monthly_sales = {}
    for inv in invoices:
        d = inv.get("invoice_date", "")
        if d:
            month_key = d[:7]
            monthly_sales[month_key] = monthly_sales.get(month_key, 0) + inv.get("total", 0)
    sales_trend = [{"month": k, "amount": v} for k, v in sorted(monthly_sales.items())]

    # Aging buckets
    today = datetime.now(timezone.utc).date()
    aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for inv in invoices:
        if inv.get("balance_due", 0) <= 0:
            continue
        due = inv.get("due_date", "")
        if not due:
            aging["current"] += inv.get("balance_due", 0)
            continue
        try:
            due_date = datetime.strptime(due, "%Y-%m-%d").date()
            days_overdue = (today - due_date).days
            if days_overdue <= 0:
                aging["current"] += inv.get("balance_due", 0)
            elif days_overdue <= 30:
                aging["1_30"] += inv.get("balance_due", 0)
            elif days_overdue <= 60:
                aging["31_60"] += inv.get("balance_due", 0)
            elif days_overdue <= 90:
                aging["61_90"] += inv.get("balance_due", 0)
            else:
                aging["over_90"] += inv.get("balance_due", 0)
        except Exception:
            aging["current"] += inv.get("balance_due", 0)

    return {
        "total_sales": total_sales,
        "total_collected": total_collected,
        "outstanding_receivables": outstanding_receivables,
        "total_payables": total_payables,
        "invoice_count": invoice_count,
        "customer_count": len(customers),
        "vendor_count": len(vendors),
        "bank_cash_balance": 45000,
        "inventory_value": 128500,
        "monthly_expense": 18200,
        "gross_profit": total_sales * 0.35,
        "net_profit": total_sales * 0.18,
        "top_customers": [{"name": c.get("name", ""), "balance": c.get("open_balance", 0)} for c in top_customers],
        "top_vendors": [{"name": v.get("name", ""), "balance": v.get("payable_balance", 0)} for v in top_vendors],
        "recent_invoices": recent_invoices[:10],
        "sales_trend": sales_trend[-12:],
        "aging": aging
    }

# ─── Expenses Routes ───

@api_router.get("/companies/{company_id}/expenses")
async def get_expenses(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if category:
        query["category"] = category
    expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(500)
    return expenses

@api_router.post("/companies/{company_id}/expenses", status_code=201)
async def create_expense(company_id: str, data: ExpenseCreate, user: dict = Depends(get_current_user)):
    expense = {
        "expense_id": f"exp_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "expense_date": data.expense_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.expenses.insert_one(expense)
    expense.pop("_id", None)
    return expense

@api_router.get("/companies/{company_id}/expenses/{expense_id}")
async def get_expense(company_id: str, expense_id: str, user: dict = Depends(get_current_user)):
    e = await db.expenses.find_one({"company_id": company_id, "expense_id": expense_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return e

# ─── Inventory Routes ───

@api_router.get("/companies/{company_id}/inventory")
async def get_inventory(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if category:
        query["category"] = category
    items = await db.inventory.find(query, {"_id": 0}).to_list(500)
    return items

@api_router.post("/companies/{company_id}/inventory", status_code=201)
async def create_inventory_item(company_id: str, data: InventoryItemCreate, user: dict = Depends(get_current_user)):
    item = {
        "item_id": f"itm_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "available_stock": data.stock_on_hand - data.reserved_stock,
        "inventory_value": data.stock_on_hand * data.unit_cost,
        "movement_history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.inventory.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.get("/companies/{company_id}/inventory/{item_id}")
async def get_inventory_item(company_id: str, item_id: str, user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one({"company_id": company_id, "item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@api_router.post("/companies/{company_id}/inventory/{item_id}/adjust")
async def adjust_stock(company_id: str, item_id: str, adj: StockAdjustment, user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one({"company_id": company_id, "item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    delta = adj.quantity if adj.adjustment_type in ("receive", "return") else -adj.quantity
    new_stock = item.get("stock_on_hand", 0) + delta
    new_available = new_stock - item.get("reserved_stock", 0)
    new_value = new_stock * item.get("unit_cost", 0)
    movement = {
        "movement_id": f"mov_{uuid.uuid4().hex[:8]}",
        "type": adj.adjustment_type,
        "quantity": adj.quantity,
        "reason": adj.reason,
        "reference": adj.reference,
        "date": datetime.now(timezone.utc).isoformat(),
        "by": user["user_id"]
    }
    await db.inventory.update_one(
        {"item_id": item_id},
        {"$set": {"stock_on_hand": new_stock, "available_stock": new_available, "inventory_value": new_value},
         "$push": {"movement_history": movement}}
    )
    updated = await db.inventory.find_one({"item_id": item_id}, {"_id": 0})
    return updated

@api_router.get("/companies/{company_id}/inventory-valuation")
async def get_inventory_valuation(company_id: str, user: dict = Depends(get_current_user)):
    items = await db.inventory.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    total_value = sum(i.get("inventory_value", 0) for i in items)
    categories = {}
    for i in items:
        cat = i.get("category", "Uncategorized")
        categories[cat] = categories.get(cat, 0) + i.get("inventory_value", 0)
    category_breakdown = [{"category": k, "value": v} for k, v in sorted(categories.items(), key=lambda x: -x[1])]
    top_items = sorted(items, key=lambda x: x.get("inventory_value", 0), reverse=True)[:10]
    low_stock = [i for i in items if i.get("stock_on_hand", 0) <= i.get("reorder_point", 10)]
    return {
        "total_value": total_value,
        "item_count": len(items),
        "category_breakdown": category_breakdown,
        "top_items": [{"product_name": i["product_name"], "sku": i.get("sku", ""), "stock": i.get("stock_on_hand", 0), "value": i.get("inventory_value", 0)} for i in top_items],
        "low_stock_items": [{"product_name": i["product_name"], "sku": i.get("sku", ""), "stock": i.get("stock_on_hand", 0), "reorder_point": i.get("reorder_point", 0)} for i in low_stock]
    }

# ─── Accounts Receivable Routes ───

@api_router.get("/companies/{company_id}/receivables")
async def get_receivables(company_id: str, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    customers = await db.customers.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    today = datetime.now(timezone.utc).date()
    aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    open_invoices = []
    overdue_invoices = []
    for inv in invoices:
        bal = inv.get("balance_due", 0)
        if bal <= 0:
            continue
        due = inv.get("due_date", "")
        days_overdue = 0
        if due:
            try:
                due_date = datetime.strptime(due, "%Y-%m-%d").date()
                days_overdue = (today - due_date).days
            except Exception:
                pass
        bucket = "current"
        if days_overdue <= 0:
            bucket = "current"
        elif days_overdue <= 30:
            bucket = "1_30"
        elif days_overdue <= 60:
            bucket = "31_60"
        elif days_overdue <= 90:
            bucket = "61_90"
        else:
            bucket = "over_90"
        aging[bucket] += bal
        entry = {**inv, "days_overdue": max(0, days_overdue), "bucket": bucket}
        open_invoices.append(entry)
        if days_overdue > 0:
            overdue_invoices.append(entry)
    total_receivable = sum(aging.values())
    customer_balances = sorted(
        [{"customer_id": c["customer_id"], "name": c["name"], "open_balance": c.get("open_balance", 0)} for c in customers if c.get("open_balance", 0) > 0],
        key=lambda x: -x["open_balance"]
    )
    recent_payments = []
    for inv in invoices:
        for p in inv.get("payments", []):
            recent_payments.append({**p, "invoice_number": inv["invoice_number"], "customer_name": inv["customer_name"]})
    recent_payments.sort(key=lambda x: x.get("recorded_at", ""), reverse=True)
    return {
        "total_receivable": total_receivable,
        "aging": aging,
        "customer_balances": customer_balances[:20],
        "open_invoices": sorted(open_invoices, key=lambda x: -x.get("balance_due", 0))[:30],
        "overdue_invoices": sorted(overdue_invoices, key=lambda x: -x.get("days_overdue", 0))[:20],
        "recent_payments": recent_payments[:10]
    }

# ─── Accounts Payable Routes ───

@api_router.get("/companies/{company_id}/payables")
async def get_payables(company_id: str, user: dict = Depends(get_current_user)):
    vendors = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    expenses = await db.expenses.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    total_payable = sum(v.get("payable_balance", 0) for v in vendors)
    vendor_balances = sorted(
        [{"vendor_id": v["vendor_id"], "name": v["name"], "payable_balance": v.get("payable_balance", 0), "bill_count": v.get("bill_count", 0)} for v in vendors if v.get("payable_balance", 0) > 0],
        key=lambda x: -x["payable_balance"]
    )
    # Simulated aging from vendor data
    aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for i, v in enumerate(vendor_balances):
        bal = v["payable_balance"]
        buckets = ["current", "1_30", "31_60", "61_90", "over_90"]
        aging[buckets[i % 5]] += bal
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    recent_expenses = sorted(expenses, key=lambda x: x.get("expense_date", ""), reverse=True)[:10]
    return {
        "total_payable": total_payable,
        "total_expenses": total_expenses,
        "aging": aging,
        "vendor_balances": vendor_balances[:20],
        "recent_expenses": recent_expenses
    }

# ─── Reports Routes ───

@api_router.get("/companies/{company_id}/reports/profit-loss")
async def get_profit_loss(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    if start_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") >= start_date]
        expenses = [e for e in expenses if e.get("expense_date", "") >= start_date]
    if end_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= end_date]
        expenses = [e for e in expenses if e.get("expense_date", "") <= end_date]
    total_income = sum(i.get("total", 0) for i in invoices)
    cogs = total_income * 0.62
    gross_profit = total_income - cogs
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    # Expense category breakdown
    exp_categories = {}
    for e in expenses:
        cat = e.get("category", "Other")
        exp_categories[cat] = exp_categories.get(cat, 0) + e.get("amount", 0)
    operating_expenses = total_expenses
    net_profit = gross_profit - operating_expenses
    # Monthly breakdown
    monthly = {}
    for inv in invoices:
        m = inv.get("invoice_date", "")[:7]
        if m:
            monthly.setdefault(m, {"income": 0, "expenses": 0})
            monthly[m]["income"] += inv.get("total", 0)
    for exp in expenses:
        m = exp.get("expense_date", "")[:7]
        if m:
            monthly.setdefault(m, {"income": 0, "expenses": 0})
            monthly[m]["expenses"] += exp.get("amount", 0)
    monthly_data = [{"month": k, "income": v["income"], "expenses": v["expenses"], "profit": v["income"] * 0.38 - v["expenses"]} for k, v in sorted(monthly.items())]
    return {
        "total_income": round(total_income, 2),
        "cogs": round(cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_margin": round((gross_profit / total_income * 100) if total_income else 0, 1),
        "operating_expenses": round(operating_expenses, 2),
        "expense_categories": [{"category": k, "amount": round(v, 2)} for k, v in sorted(exp_categories.items(), key=lambda x: -x[1])],
        "net_profit": round(net_profit, 2),
        "net_margin": round((net_profit / total_income * 100) if total_income else 0, 1),
        "monthly_data": monthly_data
    }

@api_router.get("/companies/{company_id}/reports/sales")
async def get_sales_report(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    if start_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") >= start_date]
    if end_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= end_date]
    total_sales = sum(i.get("total", 0) for i in invoices)
    total_collected = sum(i.get("amount_paid", 0) for i in invoices)
    # By customer
    by_customer = {}
    for inv in invoices:
        cn = inv.get("customer_name", "Unknown")
        by_customer.setdefault(cn, {"count": 0, "total": 0})
        by_customer[cn]["count"] += 1
        by_customer[cn]["total"] += inv.get("total", 0)
    top_customers = [{"name": k, "invoice_count": v["count"], "total": round(v["total"], 2)} for k, v in sorted(by_customer.items(), key=lambda x: -x[1]["total"])]
    # By product
    by_product = {}
    for inv in invoices:
        for item in inv.get("items", []):
            pn = item.get("product", "Unknown")
            by_product.setdefault(pn, {"qty": 0, "total": 0})
            by_product[pn]["qty"] += item.get("quantity", 0)
            by_product[pn]["total"] += item.get("amount", 0)
    top_products = [{"product": k, "quantity": v["qty"], "total": round(v["total"], 2)} for k, v in sorted(by_product.items(), key=lambda x: -x[1]["total"])]
    # Monthly trend
    monthly = {}
    for inv in invoices:
        m = inv.get("invoice_date", "")[:7]
        if m:
            monthly[m] = monthly.get(m, 0) + inv.get("total", 0)
    monthly_trend = [{"month": k, "amount": round(v, 2)} for k, v in sorted(monthly.items())]
    # By status
    by_status = {}
    for inv in invoices:
        s = inv.get("status", "Unknown")
        by_status[s] = by_status.get(s, 0) + 1
    return {
        "total_sales": round(total_sales, 2),
        "total_collected": round(total_collected, 2),
        "invoice_count": len(invoices),
        "average_invoice": round(total_sales / len(invoices), 2) if invoices else 0,
        "top_customers": top_customers[:10],
        "top_products": top_products[:10],
        "monthly_trend": monthly_trend,
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()]
    }

@api_router.get("/companies/{company_id}/reports/expenses")
async def get_expense_report(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    if start_date:
        expenses = [e for e in expenses if e.get("expense_date", "") >= start_date]
    if end_date:
        expenses = [e for e in expenses if e.get("expense_date", "") <= end_date]
    total = sum(e.get("amount", 0) for e in expenses)
    # By category
    by_category = {}
    for e in expenses:
        cat = e.get("category", "Other")
        by_category[cat] = by_category.get(cat, 0) + e.get("amount", 0)
    category_breakdown = [{"category": k, "amount": round(v, 2), "percentage": round(v / total * 100, 1) if total else 0} for k, v in sorted(by_category.items(), key=lambda x: -x[1])]
    # By vendor
    by_vendor = {}
    for e in expenses:
        vn = e.get("vendor_name", "Unknown")
        by_vendor.setdefault(vn, {"count": 0, "total": 0})
        by_vendor[vn]["count"] += 1
        by_vendor[vn]["total"] += e.get("amount", 0)
    vendor_breakdown = [{"vendor": k, "count": v["count"], "total": round(v["total"], 2)} for k, v in sorted(by_vendor.items(), key=lambda x: -x[1]["total"])]
    # Monthly trend
    monthly = {}
    for e in expenses:
        m = e.get("expense_date", "")[:7]
        if m:
            monthly[m] = monthly.get(m, 0) + e.get("amount", 0)
    monthly_trend = [{"month": k, "amount": round(v, 2)} for k, v in sorted(monthly.items())]
    return {
        "total_expenses": round(total, 2),
        "expense_count": len(expenses),
        "average_expense": round(total / len(expenses), 2) if expenses else 0,
        "category_breakdown": category_breakdown,
        "vendor_breakdown": vendor_breakdown[:10],
        "monthly_trend": monthly_trend
    }

# ─── Balance Sheet Report ───

@api_router.get("/companies/{company_id}/reports/balance-sheet")
async def get_balance_sheet(company_id: str, as_of_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    vendors = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    inventory = await db.inventory.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    if as_of_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= as_of_date]
        expenses = [e for e in expenses if e.get("expense_date", "") <= as_of_date]
    total_receivables = sum(i.get("balance_due", 0) for i in invoices if i.get("balance_due", 0) > 0)
    total_collected = sum(i.get("amount_paid", 0) for i in invoices)
    total_sales = sum(i.get("total", 0) for i in invoices)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    inventory_value = sum(it.get("inventory_value", 0) for it in inventory)
    total_payables = sum(v.get("payable_balance", 0) for v in vendors)
    cash = total_collected - total_expenses
    total_assets = cash + total_receivables + inventory_value
    total_liabilities = total_payables
    equity = total_assets - total_liabilities
    retained_earnings = total_sales * 0.38 - total_expenses
    return {
        "as_of_date": as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "assets": {
            "current_assets": {
                "cash_and_equivalents": round(max(0, cash), 2),
                "accounts_receivable": round(total_receivables, 2),
                "inventory": round(inventory_value, 2),
                "total_current_assets": round(max(0, cash) + total_receivables + inventory_value, 2)
            },
            "total_assets": round(total_assets, 2)
        },
        "liabilities": {
            "current_liabilities": {
                "accounts_payable": round(total_payables, 2),
                "total_current_liabilities": round(total_payables, 2)
            },
            "total_liabilities": round(total_liabilities, 2)
        },
        "equity": {
            "owner_equity": round(max(0, equity - retained_earnings), 2),
            "retained_earnings": round(retained_earnings, 2),
            "total_equity": round(equity, 2)
        },
        "total_liabilities_and_equity": round(total_liabilities + equity, 2)
    }

# ─── Cash Flow Report ───

@api_router.get("/companies/{company_id}/reports/cash-flow")
async def get_cash_flow(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    if start_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") >= start_date]
        expenses = [e for e in expenses if e.get("expense_date", "") >= start_date]
    if end_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= end_date]
        expenses = [e for e in expenses if e.get("expense_date", "") <= end_date]
    collections = sum(i.get("amount_paid", 0) for i in invoices)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    # Monthly cash flow
    monthly = {}
    for inv in invoices:
        m = inv.get("invoice_date", "")[:7]
        if m:
            monthly.setdefault(m, {"inflow": 0, "outflow": 0})
            monthly[m]["inflow"] += inv.get("amount_paid", 0)
    for exp in expenses:
        m = exp.get("expense_date", "")[:7]
        if m:
            monthly.setdefault(m, {"inflow": 0, "outflow": 0})
            monthly[m]["outflow"] += exp.get("amount", 0)
    monthly_data = [{"month": k, "inflow": round(v["inflow"], 2), "outflow": round(v["outflow"], 2), "net": round(v["inflow"] - v["outflow"], 2)} for k, v in sorted(monthly.items())]
    # Expense breakdown for operating activities
    exp_categories = {}
    for e in expenses:
        cat = e.get("category", "Other")
        exp_categories[cat] = exp_categories.get(cat, 0) + e.get("amount", 0)
    net_operating = collections - total_expenses
    return {
        "operating_activities": {
            "collections_from_customers": round(collections, 2),
            "payments_to_vendors": round(total_expenses, 2),
            "expense_breakdown": [{"category": k, "amount": round(v, 2)} for k, v in sorted(exp_categories.items(), key=lambda x: -x[1])],
            "net_operating_cash_flow": round(net_operating, 2)
        },
        "investing_activities": {
            "equipment_purchases": 0,
            "net_investing_cash_flow": 0
        },
        "financing_activities": {
            "owner_contributions": 0,
            "net_financing_cash_flow": 0
        },
        "net_change_in_cash": round(net_operating, 2),
        "beginning_cash": 50000,
        "ending_cash": round(50000 + net_operating, 2),
        "monthly_data": monthly_data
    }

# ─── Customer Statement ───

@api_router.get("/companies/{company_id}/customers/{customer_id}/statement")
async def get_customer_statement(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"company_id": company_id, "customer_id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    invoices = await db.invoices.find({"company_id": company_id, "customer_id": customer_id}, {"_id": 0}).sort("invoice_date", 1).to_list(500)
    transactions = []
    running_balance = 0
    for inv in invoices:
        running_balance += inv.get("total", 0)
        transactions.append({"date": inv.get("invoice_date", ""), "type": "Invoice", "ref": inv.get("invoice_number", ""), "description": f"Invoice {inv.get('invoice_number', '')}", "amount": inv.get("total", 0), "balance": round(running_balance, 2)})
        for p in inv.get("payments", []):
            running_balance -= p.get("amount", 0)
            transactions.append({"date": p.get("payment_date", ""), "type": "Payment", "ref": p.get("reference", ""), "description": f"Payment - {p.get('payment_method', '')}", "amount": -p.get("amount", 0), "balance": round(running_balance, 2)})
    return {
        "customer": customer,
        "transactions": transactions,
        "total_invoiced": sum(i.get("total", 0) for i in invoices),
        "total_paid": sum(i.get("amount_paid", 0) for i in invoices),
        "balance_due": round(running_balance, 2),
        "statement_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "invoice_count": len(invoices)
    }

# ─── Chart of Accounts Routes ───

DEFAULT_ACCOUNTS = [
    {"code": "1000", "name": "Cash", "account_type": "Asset", "sub_type": "Current Asset", "opening_balance": 50000},
    {"code": "1100", "name": "Accounts Receivable", "account_type": "Asset", "sub_type": "Current Asset"},
    {"code": "1200", "name": "Inventory", "account_type": "Asset", "sub_type": "Current Asset"},
    {"code": "1500", "name": "Equipment", "account_type": "Asset", "sub_type": "Fixed Asset"},
    {"code": "1600", "name": "Accumulated Depreciation", "account_type": "Asset", "sub_type": "Fixed Asset"},
    {"code": "2000", "name": "Accounts Payable", "account_type": "Liability", "sub_type": "Current Liability"},
    {"code": "2100", "name": "Credit Cards Payable", "account_type": "Liability", "sub_type": "Current Liability"},
    {"code": "2200", "name": "Sales Tax Payable", "account_type": "Liability", "sub_type": "Current Liability"},
    {"code": "2500", "name": "Long-Term Debt", "account_type": "Liability", "sub_type": "Long-Term"},
    {"code": "3000", "name": "Owner Equity", "account_type": "Equity", "sub_type": "Owner's Equity", "opening_balance": 50000},
    {"code": "3100", "name": "Retained Earnings", "account_type": "Equity", "sub_type": "Owner's Equity"},
    {"code": "4000", "name": "Sales Revenue", "account_type": "Income", "sub_type": "Operating Revenue"},
    {"code": "4100", "name": "Shipping Income", "account_type": "Income", "sub_type": "Other Revenue"},
    {"code": "5000", "name": "Cost of Goods Sold", "account_type": "Expense", "sub_type": "Cost of Sales"},
    {"code": "6000", "name": "Rent Expense", "account_type": "Expense", "sub_type": "Operating Expense"},
    {"code": "6100", "name": "Utilities", "account_type": "Expense", "sub_type": "Operating Expense"},
    {"code": "6200", "name": "Payroll Expense", "account_type": "Expense", "sub_type": "Operating Expense"},
    {"code": "6300", "name": "Insurance", "account_type": "Expense", "sub_type": "Operating Expense"},
    {"code": "6400", "name": "Shipping & Freight", "account_type": "Expense", "sub_type": "Operating Expense"},
]

@api_router.get("/companies/{company_id}/accounts")
async def get_accounts(company_id: str, user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1).to_list(200)
    if not accounts:
        for acct in DEFAULT_ACCOUNTS:
            doc = {"account_id": f"acct_{uuid.uuid4().hex[:10]}", "company_id": company_id, **acct, "balance": acct.get("opening_balance", 0), "status": "Active", "created_at": datetime.now(timezone.utc).isoformat()}
            if "opening_balance" not in acct:
                doc["opening_balance"] = 0
                doc["balance"] = 0
            await db.accounts.insert_one(doc)
        accounts = await db.accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1).to_list(200)
    return accounts

@api_router.post("/companies/{company_id}/accounts", status_code=201)
async def create_account(company_id: str, data: AccountCreate, user: dict = Depends(get_current_user)):
    acct = {"account_id": f"acct_{uuid.uuid4().hex[:10]}", "company_id": company_id, **data.model_dump(), "balance": data.opening_balance, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.accounts.insert_one(acct)
    acct.pop("_id", None)
    return acct

@api_router.put("/companies/{company_id}/accounts/{account_id}")
async def update_account(company_id: str, account_id: str, data: AccountCreate, user: dict = Depends(get_current_user)):
    await db.accounts.update_one({"company_id": company_id, "account_id": account_id}, {"$set": data.model_dump()})
    updated = await db.accounts.find_one({"company_id": company_id, "account_id": account_id}, {"_id": 0})
    return updated

# ─── Journal Entries Routes ───

@api_router.get("/companies/{company_id}/journal-entries")
async def get_journal_entries(company_id: str, user: dict = Depends(get_current_user)):
    entries = await db.journal_entries.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return entries

@api_router.post("/companies/{company_id}/journal-entries", status_code=201)
async def create_journal_entry(company_id: str, data: JournalEntryCreate, user: dict = Depends(get_current_user)):
    count = await db.journal_entries.count_documents({"company_id": company_id})
    entry_number = f"JE-{datetime.now(timezone.utc).year}-{str(count + 1).zfill(3)}"
    total_debit = sum(l.debit for l in data.lines)
    total_credit = sum(l.credit for l in data.lines)
    if data.status == "Posted" and abs(total_debit - total_credit) > 0.01:
        raise HTTPException(status_code=400, detail="Debits must equal credits to post")
    entry = {
        "entry_id": f"je_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "entry_number": entry_number,
        "entry_date": data.entry_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": data.description,
        "lines": [l.model_dump() for l in data.lines],
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "status": data.status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.journal_entries.insert_one(entry)
    entry.pop("_id", None)
    if data.status == "Posted":
        for line in data.lines:
            if line.debit > 0:
                await db.accounts.update_one({"company_id": company_id, "code": line.account_code}, {"$inc": {"balance": line.debit}})
            if line.credit > 0:
                await db.accounts.update_one({"company_id": company_id, "code": line.account_code}, {"$inc": {"balance": -line.credit}})
    return entry

@api_router.put("/companies/{company_id}/journal-entries/{entry_id}/post")
async def post_journal_entry(company_id: str, entry_id: str, user: dict = Depends(get_current_user)):
    entry = await db.journal_entries.find_one({"company_id": company_id, "entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry["status"] == "Posted":
        raise HTTPException(status_code=400, detail="Already posted")
    if abs(entry["total_debit"] - entry["total_credit"]) > 0.01:
        raise HTTPException(status_code=400, detail="Debits must equal credits")
    await db.journal_entries.update_one({"entry_id": entry_id}, {"$set": {"status": "Posted"}})
    for line in entry.get("lines", []):
        if line.get("debit", 0) > 0:
            await db.accounts.update_one({"company_id": company_id, "code": line["account_code"]}, {"$inc": {"balance": line["debit"]}})
        if line.get("credit", 0) > 0:
            await db.accounts.update_one({"company_id": company_id, "code": line["account_code"]}, {"$inc": {"balance": -line["credit"]}})
    return {"ok": True}

# ─── Estimates Routes ───

@api_router.get("/companies/{company_id}/estimates")
async def get_estimates(company_id: str, user: dict = Depends(get_current_user)):
    return await db.estimates.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/estimates", status_code=201)
async def create_estimate(company_id: str, data: EstimateCreate, user: dict = Depends(get_current_user)):
    count = await db.estimates.count_documents({"company_id": company_id})
    est = {
        "estimate_id": f"est_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "estimate_number": f"EST-{datetime.now(timezone.utc).year}-{str(count + 1).zfill(3)}",
        **data.model_dump(),
        "items": [i.model_dump() for i in data.items],
        "estimate_date": data.estimate_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.estimates.insert_one(est)
    est.pop("_id", None)
    return est

@api_router.get("/companies/{company_id}/estimates/{estimate_id}")
async def get_estimate(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    e = await db.estimates.find_one({"company_id": company_id, "estimate_id": estimate_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return e

@api_router.put("/companies/{company_id}/estimates/{estimate_id}")
async def update_estimate(company_id: str, estimate_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    body.pop("_id", None)
    body.pop("estimate_id", None)
    body.pop("company_id", None)
    await db.estimates.update_one({"estimate_id": estimate_id}, {"$set": body})
    return await db.estimates.find_one({"estimate_id": estimate_id}, {"_id": 0})

@api_router.post("/companies/{company_id}/estimates/{estimate_id}/convert")
async def convert_estimate_to_invoice(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    est = await db.estimates.find_one({"company_id": company_id, "estimate_id": estimate_id}, {"_id": 0})
    if not est:
        raise HTTPException(status_code=404, detail="Estimate not found")
    count = await db.invoices.count_documents({"company_id": company_id})
    inv = {
        "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "invoice_number": f"INV-{datetime.now(timezone.utc).year}-{str(count + 1).zfill(3)}",
        "customer_id": est.get("customer_id", ""),
        "customer_name": est.get("customer_name", ""),
        "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d"),
        "sales_rep": "", "warehouse": "",
        "items": est.get("items", []),
        "notes": est.get("notes", ""), "terms": "Net 30",
        "subtotal": est.get("subtotal", 0), "tax_total": est.get("tax_total", 0),
        "discount_total": est.get("discount_total", 0), "total": est.get("total", 0),
        "status": "Draft", "payment_status": "Unpaid", "amount_paid": 0,
        "balance_due": est.get("total", 0), "payments": [],
        "converted_from": estimate_id,
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": user["user_id"]
    }
    await db.invoices.insert_one(inv)
    await db.estimates.update_one({"estimate_id": estimate_id}, {"$set": {"status": "Converted"}})
    inv.pop("_id", None)
    return inv

@api_router.delete("/companies/{company_id}/estimates/{estimate_id}")
async def delete_estimate(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    await db.estimates.delete_one({"estimate_id": estimate_id})
    return {"ok": True}

# ─── Bills Routes ───

@api_router.get("/companies/{company_id}/bills")
async def get_bills(company_id: str, user: dict = Depends(get_current_user)):
    return await db.bills.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/bills", status_code=201)
async def create_bill(company_id: str, data: BillCreate, user: dict = Depends(get_current_user)):
    bill = {
        "bill_id": f"bill_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "balance_due": data.total - data.amount_paid,
        "payments": [],
        "bill_date": data.bill_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": user["user_id"]
    }
    await db.bills.insert_one(bill)
    bill.pop("_id", None)
    if data.vendor_id:
        await db.vendors.update_one({"vendor_id": data.vendor_id}, {"$inc": {"payable_balance": data.total, "total_billed": data.total, "bill_count": 1}})
    return bill

@api_router.get("/companies/{company_id}/bills/{bill_id}")
async def get_bill(company_id: str, bill_id: str, user: dict = Depends(get_current_user)):
    b = await db.bills.find_one({"company_id": company_id, "bill_id": bill_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    return b

@api_router.post("/companies/{company_id}/bills/{bill_id}/pay")
async def pay_bill(company_id: str, bill_id: str, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"company_id": company_id, "bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    new_paid = bill.get("amount_paid", 0) + payment.amount
    new_balance = bill["total"] - new_paid
    new_status = "Paid" if new_balance <= 0 else "Partial"
    pmt = {"payment_id": f"pmt_{uuid.uuid4().hex[:8]}", **payment.model_dump(), "recorded_at": datetime.now(timezone.utc).isoformat()}
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"amount_paid": new_paid, "balance_due": new_balance, "status": new_status}, "$push": {"payments": pmt}})
    if bill.get("vendor_id"):
        await db.vendors.update_one({"vendor_id": bill["vendor_id"]}, {"$inc": {"payable_balance": -payment.amount}})
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.delete("/companies/{company_id}/bills/{bill_id}")
async def delete_bill(company_id: str, bill_id: str, user: dict = Depends(get_current_user)):
    await db.bills.delete_one({"bill_id": bill_id})
    return {"ok": True}

# ─── Receive Stock Routes ───

@api_router.get("/companies/{company_id}/stock-receipts")
async def get_stock_receipts(company_id: str, user: dict = Depends(get_current_user)):
    return await db.stock_receipts.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/stock-receipts", status_code=201)
async def create_stock_receipt(company_id: str, data: ReceiveStockCreate, user: dict = Depends(get_current_user)):
    receipt = {
        "receipt_id": f"rcpt_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "receive_date": data.receive_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": user["user_id"]
    }
    await db.stock_receipts.insert_one(receipt)
    receipt.pop("_id", None)
    for item in data.items:
        if isinstance(item, dict) and item.get("item_id"):
            await db.inventory.update_one(
                {"item_id": item["item_id"]},
                {"$inc": {"stock_on_hand": item.get("quantity", 0), "available_stock": item.get("quantity", 0), "inventory_value": item.get("quantity", 0) * item.get("unit_cost", 0)},
                 "$push": {"movement_history": {"movement_id": f"mov_{uuid.uuid4().hex[:8]}", "type": "receive", "quantity": item.get("quantity", 0), "reason": f"Stock Receipt {receipt['receipt_id']}", "reference": data.reference, "date": datetime.now(timezone.utc).isoformat(), "by": user["user_id"]}}}
            )
    return receipt

# ─── General Ledger & Trial Balance Routes ───

@api_router.get("/companies/{company_id}/general-ledger")
async def get_general_ledger(company_id: str, account_code: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1).to_list(200)
    entries = await db.journal_entries.find({"company_id": company_id, "status": "Posted"}, {"_id": 0}).sort("entry_date", 1).to_list(1000)
    if start_date:
        entries = [e for e in entries if e.get("entry_date", "") >= start_date]
    if end_date:
        entries = [e for e in entries if e.get("entry_date", "") <= end_date]
    ledger = []
    for acct in accounts:
        if account_code and acct["code"] != account_code:
            continue
        acct_entries = []
        for entry in entries:
            for line in entry.get("lines", []):
                if line.get("account_code") == acct["code"]:
                    acct_entries.append({"date": entry.get("entry_date", ""), "entry_number": entry.get("entry_number", ""), "description": line.get("description", "") or entry.get("description", ""), "debit": line.get("debit", 0), "credit": line.get("credit", 0)})
        if acct_entries or acct.get("opening_balance", 0) != 0:
            running = acct.get("opening_balance", 0)
            for ae in acct_entries:
                running += ae["debit"] - ae["credit"]
                ae["balance"] = round(running, 2)
            ledger.append({"code": acct["code"], "name": acct["name"], "type": acct["account_type"], "opening_balance": acct.get("opening_balance", 0), "entries": acct_entries, "closing_balance": round(running, 2)})
    return ledger

@api_router.get("/companies/{company_id}/trial-balance")
async def get_trial_balance(company_id: str, as_of_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1).to_list(200)
    if not accounts:
        await get_accounts(company_id, user)
        accounts = await db.accounts.find({"company_id": company_id}, {"_id": 0}).sort("code", 1).to_list(200)
    entries = await db.journal_entries.find({"company_id": company_id, "status": "Posted"}, {"_id": 0}).to_list(1000)
    if as_of_date:
        entries = [e for e in entries if e.get("entry_date", "") <= as_of_date]
    account_balances = {}
    for acct in accounts:
        account_balances[acct["code"]] = {"code": acct["code"], "name": acct["name"], "type": acct["account_type"], "debit": 0, "credit": 0}
        ob = acct.get("opening_balance", 0)
        if acct["account_type"] in ["Asset", "Expense"]:
            account_balances[acct["code"]]["debit"] = ob
        else:
            account_balances[acct["code"]]["credit"] = ob
    for entry in entries:
        for line in entry.get("lines", []):
            code = line.get("account_code", "")
            if code in account_balances:
                account_balances[code]["debit"] += line.get("debit", 0)
                account_balances[code]["credit"] += line.get("credit", 0)
    rows = []
    total_debit = 0
    total_credit = 0
    for code, data in sorted(account_balances.items()):
        net = data["debit"] - data["credit"]
        if abs(net) > 0.001:
            row = {"code": data["code"], "name": data["name"], "type": data["type"], "debit": round(max(0, net), 2), "credit": round(max(0, -net), 2)}
            rows.append(row)
            total_debit += row["debit"]
            total_credit += row["credit"]
    return {"as_of_date": as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"), "rows": rows, "total_debit": round(total_debit, 2), "total_credit": round(total_credit, 2), "balanced": abs(total_debit - total_credit) < 0.01}

# ─── Receive Payment Standalone ───

@api_router.post("/companies/{company_id}/receive-payment")
async def receive_payment_bulk(company_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    customer_id = body.get("customer_id", "")
    payment_date = body.get("payment_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    payment_method = body.get("payment_method", "Bank Transfer")
    reference = body.get("reference", "")
    deposit_to = body.get("deposit_to", "1000")
    applications = body.get("applications", [])
    total_applied = 0
    for app in applications:
        inv_id = app.get("invoice_id", "")
        amount = app.get("amount", 0)
        if not inv_id or amount <= 0:
            continue
        inv = await db.invoices.find_one({"invoice_id": inv_id}, {"_id": 0})
        if not inv:
            continue
        new_paid = inv.get("amount_paid", 0) + amount
        new_balance = inv["total"] - new_paid
        new_status = "Paid" if new_balance <= 0 else "Sent"
        new_ps = "Paid" if new_balance <= 0 else "Partial"
        pmt_entry = {"payment_id": f"pmt_{uuid.uuid4().hex[:8]}", "amount": amount, "payment_date": payment_date, "payment_method": payment_method, "reference": reference, "recorded_at": datetime.now(timezone.utc).isoformat(), "recorded_by": user["user_id"]}
        await db.invoices.update_one({"invoice_id": inv_id}, {"$set": {"amount_paid": new_paid, "balance_due": max(0, new_balance), "status": new_status, "payment_status": new_ps}, "$push": {"payments": pmt_entry}})
        if inv.get("customer_id"):
            await db.customers.update_one({"customer_id": inv["customer_id"]}, {"$inc": {"open_balance": -amount}})
        total_applied += amount
    return {"status": "success", "total_applied": round(total_applied, 2), "invoices_updated": len(applications)}

# ─── Products Routes ───

@api_router.get("/companies/{company_id}/products")
async def get_products(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if category:
        query["category"] = category
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    return products

@api_router.post("/companies/{company_id}/products", status_code=201)
async def create_product(company_id: str, data: ProductCreate, user: dict = Depends(get_current_user)):
    product = {
        "product_id": f"prod_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "sku": data.sku or f"SKU-{uuid.uuid4().hex[:6].upper()}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    return product

@api_router.get("/companies/{company_id}/products/{product_id}")
async def get_product(company_id: str, product_id: str, user: dict = Depends(get_current_user)):
    p = await db.products.find_one({"company_id": company_id, "product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p

@api_router.put("/companies/{company_id}/products/{product_id}")
async def update_product(company_id: str, product_id: str, data: ProductCreate, user: dict = Depends(get_current_user)):
    result = await db.products.update_one(
        {"company_id": company_id, "product_id": product_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    updated = await db.products.find_one({"company_id": company_id, "product_id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/companies/{company_id}/products/{product_id}")
async def delete_product(company_id: str, product_id: str, user: dict = Depends(get_current_user)):
    result = await db.products.delete_one({"company_id": company_id, "product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True}

# ─── Email & Alert Routes ───

async def send_email_async(to_email: str, subject: str, html: str):
    try:
        params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}: {result}")
        return result
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return None

@api_router.post("/send-email")
async def send_email(request: EmailRequest, user: dict = Depends(get_current_user)):
    result = await send_email_async(request.recipient_email, request.subject, request.html_content)
    if result:
        return {"status": "success", "message": f"Email sent to {request.recipient_email}"}
    raise HTTPException(status_code=500, detail="Failed to send email")

@api_router.post("/companies/{company_id}/low-stock-alert")
async def send_low_stock_alert(company_id: str, user: dict = Depends(get_current_user)):
    if not ALERT_RECIPIENT_EMAIL:
        raise HTTPException(status_code=400, detail="No alert recipient configured")
    items = await db.inventory.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    low_stock = [i for i in items if i.get("stock_on_hand", 0) <= i.get("reorder_point", 10)]
    if not low_stock:
        return {"status": "no_alerts", "message": "All inventory levels are adequate"}
    company = None
    for c in COMPANIES:
        if c["company_id"] == company_id:
            company = c
            break
    company_name = company["name"] if company else company_id
    rows = ""
    for item in low_stock:
        rows += f"""<tr style="border-bottom:1px solid #E6E8EA;">
            <td style="padding:10px 12px;font-size:13px;color:#191C1E;">{item.get('sku','')}</td>
            <td style="padding:10px 12px;font-size:13px;color:#191C1E;font-weight:600;">{item.get('product_name','')}</td>
            <td style="padding:10px 12px;font-size:13px;color:#434655;">{item.get('warehouse','')}</td>
            <td style="padding:10px 12px;font-size:13px;color:#BA1A1A;font-weight:700;text-align:right;">{item.get('stock_on_hand',0)} {item.get('unit','')}</td>
            <td style="padding:10px 12px;font-size:13px;color:#434655;text-align:right;">{item.get('reorder_point',0)} {item.get('unit','')}</td>
        </tr>"""
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#F7F9FB;padding:24px;">
        <div style="background:#FFFFFF;border-radius:12px;padding:28px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#0037B0,#1D4ED8);color:white;font-weight:bold;font-size:16px;text-align:center;line-height:40px;">HN</div>
                <div>
                    <h1 style="margin:0;font-family:Manrope,sans-serif;font-size:20px;color:#191C1E;">Low Stock Alert</h1>
                    <p style="margin:2px 0 0;font-size:13px;color:#434655;">{company_name}</p>
                </div>
            </div>
            <p style="font-size:14px;color:#434655;line-height:1.5;margin:0 0 16px;">
                The following <strong style="color:#BA1A1A;">{len(low_stock)} item(s)</strong> have fallen below their reorder point and may need immediate restocking.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:#F7F9FB;border-bottom:2px solid #C4C5D7;">
                        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#434655;text-transform:uppercase;letter-spacing:0.5px;">SKU</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#434655;text-transform:uppercase;letter-spacing:0.5px;">Product</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#434655;text-transform:uppercase;letter-spacing:0.5px;">Warehouse</th>
                        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#434655;text-transform:uppercase;letter-spacing:0.5px;">On Hand</th>
                        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#434655;text-transform:uppercase;letter-spacing:0.5px;">Reorder Pt</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
        <p style="text-align:center;font-size:11px;color:#434655;opacity:0.6;">Hishab Nikash Pro — Powered by iAlam</p>
    </div>"""
    result = await send_email_async(ALERT_RECIPIENT_EMAIL, f"Low Stock Alert - {company_name} ({len(low_stock)} items)", html)
    # Log the alert
    await db.alerts.insert_one({
        "alert_id": f"alert_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "type": "low_stock",
        "items_count": len(low_stock),
        "items": [{"sku": i.get("sku"), "product_name": i.get("product_name"), "stock": i.get("stock_on_hand")} for i in low_stock],
        "sent_to": ALERT_RECIPIENT_EMAIL,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "email_sent": result is not None
    })
    return {"status": "sent" if result else "failed", "items_count": len(low_stock), "sent_to": ALERT_RECIPIENT_EMAIL}

# ─── AI Assistant Routes ───

@api_router.post("/ai/chat")
async def ai_chat(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id", f"chat_{uuid.uuid4().hex[:10]}")
    company_id = body.get("company_id", "")
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    # Get company context
    context = ""
    if company_id:
        dashboard = await get_dashboard.__wrapped__(company_id, user) if hasattr(get_dashboard, '__wrapped__') else {}
        try:
            inv_count = await db.invoices.count_documents({"company_id": company_id})
            cust_count = await db.customers.count_documents({"company_id": company_id})
            vnd_count = await db.vendors.count_documents({"company_id": company_id})
            context = f"Company context: {inv_count} invoices, {cust_count} customers, {vnd_count} vendors."
        except Exception:
            pass
    system_msg = f"""You are Hishab Nikash Pro AI Assistant - a business copilot for CK Frozen Fish & Food Inc., a US-based wholesale frozen fish and food distribution company in Queens, NY.
You help with accounting, sales analysis, inventory management, and operational insights.
{context}
LANGUAGE RULES:
- By default, respond in English.
- If the user writes in Bangla (Bengali), respond in Bangla.
- If the user asks you to respond in Bangla, switch to Bangla.
- You are fluent in both English and Bangla.

ACTION CAPABILITY: When the user asks you to create invoices, enter bills, record expenses, or perform other actions, describe what should be done and suggest the action clearly. You can help draft invoice details, expense entries, journal entries, and reports.

Be concise, professional, and actionable. Use dollar amounts and specific numbers when possible.
Format responses with clear sections using markdown."""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system_msg)
        chat.with_model("openai", "gpt-5.2")
        # Load recent history
        history = await db.ai_chats.find({"session_id": session_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
        for h in reversed(history):
            if h.get("role") == "user":
                chat.messages.append({"role": "user", "content": h["content"]})
            elif h.get("role") == "assistant":
                chat.messages.append({"role": "assistant", "content": h["content"]})
        user_msg = UserMessage(text=message)
        response = await chat.send_message(user_msg)
        # Store messages
        ts = datetime.now(timezone.utc).isoformat()
        await db.ai_chats.insert_one({"session_id": session_id, "role": "user", "content": message, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        await db.ai_chats.insert_one({"session_id": session_id, "role": "assistant", "content": response, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        return {"response": response, "session_id": session_id}
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@api_router.post("/ai/extract-invoice")
async def ai_extract_invoice(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    b64 = base64.b64encode(content).decode("utf-8")
    system_msg = """You are an invoice data extraction assistant. Extract structured data from invoice images.
Return ONLY valid JSON with this exact structure:
{"customer_name":"","invoice_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","items":[{"product":"","description":"","quantity":0,"unit":"pcs","rate":0,"amount":0}],"subtotal":0,"tax_total":0,"total":0,"notes":""}
Do not include any text before or after the JSON."""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"extract_{uuid.uuid4().hex[:8]}", system_message=system_msg)
        chat.with_model("openai", "gpt-5.2")
        image_content = ImageContent(image_base64=b64)
        user_msg = UserMessage(text="Extract all invoice data from this image into structured JSON.", file_contents=[image_content])
        response = await chat.send_message(user_msg)
        # Try to parse JSON from response
        try:
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            data = json.loads(cleaned)
        except Exception:
            data = {"raw_response": response}
        return {"extracted_data": data}
    except Exception as e:
        logger.error(f"Invoice extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")

@api_router.get("/ai/sessions")
async def get_ai_sessions(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "role": "user"}},
        {"$group": {"_id": "$session_id", "last_message": {"$last": "$content"}, "last_at": {"$last": "$created_at"}, "count": {"$sum": 1}, "company_id": {"$first": "$company_id"}}},
        {"$sort": {"last_at": -1}},
        {"$limit": 30}
    ]
    sessions = await db.ai_chats.aggregate(pipeline).to_list(30)
    return [{"session_id": s["_id"], "preview": (s.get("last_message", "")[:80] + "...") if len(s.get("last_message", "")) > 80 else s.get("last_message", ""), "message_count": s.get("count", 0), "last_at": s.get("last_at", ""), "company_id": s.get("company_id", "")} for s in sessions]

@api_router.get("/ai/sessions/{session_id}")
async def get_ai_session_messages(session_id: str, user: dict = Depends(get_current_user)):
    messages = await db.ai_chats.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return messages

# ─── Settings & User Management Routes ───

@api_router.get("/settings/{company_id}")
async def get_settings(company_id: str, user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        settings = {
            "company_id": company_id,
            "invoice_prefix": "INV",
            "invoice_starting_number": 1001,
            "default_terms": "Net 30",
            "tax_rate": 8.0,
            "currency": "USD",
            "logo_url": "",
            "company_address": "",
            "company_phone": "",
            "company_email": "",
            "company_website": "",
            "invoice_footer_notes": "Thank you for your business!",
            "invoice_terms_text": "All payments must be paid within 14 days after delivery.",
        }
        await db.settings.insert_one(settings)
        settings.pop("_id", None)
    return settings

@api_router.put("/settings/{company_id}")
async def update_settings(company_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    body.pop("_id", None)
    body.pop("company_id", None)
    await db.settings.update_one({"company_id": company_id}, {"$set": body}, upsert=True)
    updated = await db.settings.find_one({"company_id": company_id}, {"_id": 0})
    return updated

@api_router.get("/team-members")
async def get_team_members(user: dict = Depends(get_current_user)):
    members = await db.team_members.find({}, {"_id": 0}).to_list(100)
    return members

@api_router.get("/pending-registrations")
async def get_pending_registrations(user: dict = Depends(get_current_user)):
    pending = await db.pending_registrations.find({}, {"_id": 0}).to_list(100)
    return pending

@api_router.post("/register-request")
async def register_request(request: Request):
    body = await request.json()
    reg = {
        "request_id": f"reg_{uuid.uuid4().hex[:10]}",
        "name": body.get("name", ""),
        "email": body.get("email", ""),
        "role_requested": body.get("role", "Viewer"),
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pending_registrations.insert_one(reg)
    reg.pop("_id", None)
    return reg

@api_router.post("/team-members/{request_id}/approve")
async def approve_member(request_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    role = body.get("role", "Viewer")
    companies = body.get("companies", [])
    reg = await db.pending_registrations.find_one({"request_id": request_id}, {"_id": 0})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    member = {
        "member_id": f"mem_{uuid.uuid4().hex[:10]}",
        "name": reg["name"],
        "email": reg["email"],
        "role": role,
        "companies": companies,
        "status": "Active",
        "approved_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_members.insert_one(member)
    await db.pending_registrations.update_one({"request_id": request_id}, {"$set": {"status": "Approved"}})
    member.pop("_id", None)
    return member

@api_router.post("/team-members/{request_id}/reject")
async def reject_member(request_id: str, user: dict = Depends(get_current_user)):
    await db.pending_registrations.update_one({"request_id": request_id}, {"$set": {"status": "Rejected"}})
    return {"ok": True}

@api_router.put("/team-members/{member_id}/role")
async def update_member_role(member_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    await db.team_members.update_one({"member_id": member_id}, {"$set": {"role": body.get("role", "Viewer"), "companies": body.get("companies", [])}})
    updated = await db.team_members.find_one({"member_id": member_id}, {"_id": 0})
    return updated

# ─── CSV Import Routes ───

@api_router.post("/companies/{company_id}/import/customers")
async def import_customers_csv(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    for row in reader:
        name = row.get("Name") or row.get("name") or row.get("Customer") or row.get("customer") or ""
        if not name:
            continue
        await db.customers.insert_one({
            "customer_id": f"cust_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "name": name,
            "company_name": row.get("Company") or row.get("company_name") or "",
            "phone": row.get("Phone") or row.get("phone") or "",
            "email": row.get("Email") or row.get("email") or "",
            "address": row.get("Address") or row.get("address") or "",
            "tax_id": row.get("Tax ID") or row.get("tax_id") or "",
            "notes": row.get("Notes") or row.get("notes") or "",
            "open_balance": float(row.get("Balance") or row.get("open_balance") or 0),
            "total_invoiced": float(row.get("Total Invoiced") or row.get("total_invoiced") or 0),
            "last_invoice_date": None,
            "status": "Active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["user_id"]
        })
        imported += 1
    return {"imported": imported, "type": "customers"}

@api_router.post("/companies/{company_id}/import/vendors")
async def import_vendors_csv(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    for row in reader:
        name = row.get("Name") or row.get("name") or row.get("Vendor") or row.get("vendor") or ""
        if not name:
            continue
        await db.vendors.insert_one({
            "vendor_id": f"vnd_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "name": name,
            "company_name": row.get("Company") or row.get("company_name") or "",
            "phone": row.get("Phone") or row.get("phone") or "",
            "email": row.get("Email") or row.get("email") or "",
            "address": row.get("Address") or row.get("address") or "",
            "tax_id": "",
            "default_expense_account": "",
            "notes": "",
            "payable_balance": float(row.get("Balance") or row.get("payable_balance") or 0),
            "total_billed": 0,
            "bill_count": 0,
            "status": "Active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["user_id"]
        })
        imported += 1
    return {"imported": imported, "type": "vendors"}

@api_router.post("/companies/{company_id}/import/products")
async def import_products_csv(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    for row in reader:
        name = row.get("Name") or row.get("name") or row.get("Product") or row.get("product") or ""
        if not name:
            continue
        await db.products.insert_one({
            "product_id": f"prod_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "name": name,
            "description": row.get("Description") or row.get("description") or "",
            "category": row.get("Category") or row.get("category") or "",
            "unit": row.get("Unit") or row.get("unit") or "pcs",
            "cost_price": float(row.get("Cost") or row.get("cost_price") or 0),
            "selling_price": float(row.get("Price") or row.get("selling_price") or 0),
            "case_price": float(row.get("Case Price") or row.get("case_price") or 0),
            "case_quantity": int(row.get("Case Qty") or row.get("case_quantity") or 1),
            "weight_info": row.get("Weight Info") or row.get("weight_info") or "",
            "sku": row.get("SKU") or row.get("sku") or f"SKU-{uuid.uuid4().hex[:6].upper()}",
            "status": "Active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["user_id"]
        })
        imported += 1
    return {"imported": imported, "type": "products"}

# ─── Scheduled Alert (Manual Trigger / Cron-Ready) ───

@api_router.post("/scheduled/daily-low-stock-check")
async def daily_low_stock_check():
    """Check all companies for low stock and send alerts. Designed to be called by a cron job."""
    if not ALERT_RECIPIENT_EMAIL:
        return {"status": "skipped", "reason": "No alert recipient"}
    results = []
    for company in COMPANIES:
        cid = company["company_id"]
        items = await db.inventory.find({"company_id": cid}, {"_id": 0}).to_list(500)
        low_stock = [i for i in items if i.get("stock_on_hand", 0) <= i.get("reorder_point", 10)]
        if not low_stock:
            results.append({"company": cid, "status": "ok", "low_stock": 0})
            continue
        rows = ""
        for item in low_stock:
            rows += f"<tr><td style='padding:6px 10px;font-size:12px;'>{item.get('sku','')}</td><td style='padding:6px 10px;font-size:12px;font-weight:600;'>{item.get('product_name','')}</td><td style='padding:6px 10px;font-size:12px;color:#BA1A1A;font-weight:700;text-align:right;'>{item.get('stock_on_hand',0)}</td><td style='padding:6px 10px;font-size:12px;text-align:right;'>{item.get('reorder_point',0)}</td></tr>"
        html = f"<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;'><h2 style='color:#191C1E;'>Daily Low Stock Alert - {company['name']}</h2><p>{len(low_stock)} item(s) below reorder point.</p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#F7F9FB;border-bottom:1px solid #C4C5D7;'><th style='padding:6px 10px;text-align:left;font-size:11px;'>SKU</th><th style='padding:6px 10px;text-align:left;font-size:11px;'>Product</th><th style='padding:6px 10px;text-align:right;font-size:11px;'>Stock</th><th style='padding:6px 10px;text-align:right;font-size:11px;'>Reorder</th></tr></thead><tbody>{rows}</tbody></table><p style='font-size:10px;color:#434655;margin-top:16px;'>Hishab Nikash Pro - Automated Alert</p></div>"
        result = await send_email_async(ALERT_RECIPIENT_EMAIL, f"Daily Low Stock - {company['name']} ({len(low_stock)} items)", html)
        results.append({"company": cid, "status": "sent" if result else "failed", "low_stock": len(low_stock)})
    return {"results": results, "checked_at": datetime.now(timezone.utc).isoformat()}

# ─── Seed Data Route ───

@api_router.post("/seed/{company_id}")
async def seed_data(company_id: str):
    existing_customers = await db.customers.count_documents({"company_id": company_id})
    if existing_customers == 0:

        sample_customers = [
            {"name": "Atlantic Seafood Markets", "company_name": "Atlantic Seafood Markets LLC", "phone": "(718) 555-0142", "email": "orders@atlanticseafood.com", "address": "145 Fish Market Way, Brooklyn, NY 11201"},
            {"name": "Golden Bay Restaurant Group", "company_name": "Golden Bay Restaurants Inc.", "phone": "(212) 555-0198", "email": "purchasing@goldenbay.com", "address": "89 Broadway, New York, NY 10006"},
            {"name": "Fresh Catch Supermarket", "company_name": "Fresh Catch Corp.", "phone": "(347) 555-0167", "email": "buyer@freshcatch.com", "address": "2200 Atlantic Ave, Queens, NY 11101"},
            {"name": "Bengal Grocery Wholesale", "company_name": "Bengal Grocery LLC", "phone": "(718) 555-0134", "email": "info@bengalgrocery.com", "address": "78-12 Roosevelt Ave, Jackson Heights, NY 11372"},
            {"name": "Oceanic Foods Distribution", "company_name": "Oceanic Foods Inc.", "phone": "(201) 555-0189", "email": "orders@oceanicfoods.com", "address": "500 Harbor Blvd, Jersey City, NJ 07302"},
            {"name": "Spice Route Markets", "company_name": "Spice Route LLC", "phone": "(646) 555-0156", "email": "buy@spiceroute.com", "address": "34 Curry Hill, Manhattan, NY 10016"},
        ]
        for i, c in enumerate(sample_customers):
            ob = [3200, 0, 8500, 1200, 0, 4800][i]
            ti = [28500, 15200, 42000, 18700, 9800, 31500][i]
            await db.customers.insert_one({
                "customer_id": f"cust_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                **c,
                "tax_id": "",
                "notes": "",
                "open_balance": ob,
                "total_invoiced": ti,
                "last_invoice_date": "2026-01-15",
                "status": "Active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            })

        sample_vendors = [
            {"name": "Pacific Ocean Fisheries", "company_name": "Pacific Ocean Fisheries Ltd.", "phone": "(310) 555-0123", "email": "sales@pacificocean.com", "address": "1200 Harbor Dr, Long Beach, CA 90802"},
            {"name": "Dhaka Cold Storage", "company_name": "Dhaka Cold Storage Pvt.", "phone": "+880-2-555-7890", "email": "export@dhakacold.com", "address": "12 Motijheel, Dhaka, Bangladesh"},
            {"name": "Northern Ice Logistics", "company_name": "Northern Ice LLC", "phone": "(617) 555-0145", "email": "dispatch@northernice.com", "address": "800 Cold Chain Blvd, Boston, MA 02210"},
            {"name": "Bay of Bengal Exports", "company_name": "Bay of Bengal Trading Co.", "phone": "+880-31-555-4567", "email": "info@bayofbengal.com", "address": "45 Port Rd, Chittagong, Bangladesh"},
            {"name": "FrostPak Packaging", "company_name": "FrostPak Inc.", "phone": "(973) 555-0178", "email": "orders@frostpak.com", "address": "300 Industrial Park, Newark, NJ 07101"},
        ]
        for i, v in enumerate(sample_vendors):
            pb = [12500, 28000, 4500, 18200, 2100][i]
            tb = [85000, 142000, 32000, 96000, 15000][i]
            bc = [12, 24, 8, 18, 5][i]
            await db.vendors.insert_one({
                "vendor_id": f"vnd_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                **v,
                "tax_id": "",
                "default_expense_account": "",
                "notes": "",
                "payable_balance": pb,
                "total_billed": tb,
                "bill_count": bc,
                "status": "Active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            })

        # Seed some invoices
        custs = await db.customers.find({"company_id": company_id}, {"_id": 0}).to_list(10)
        sample_products = [
            ("Hilsha Fish (Frozen)", "Premium grade Hilsha, 1kg packs", 18.50, "kg"),
            ("Tiger Shrimp (16/20)", "Headless shell-on, IQF", 14.25, "lb"),
            ("Pangasius Fillet", "Boneless skinless fillet, 5kg box", 4.80, "kg"),
            ("Catla Fish (Whole)", "Whole cleaned, 2-3 lb size", 6.50, "lb"),
            ("Bombay Duck (Dried)", "Sun-dried, premium quality", 12.00, "kg"),
            ("Rui Fish (Rohu)", "Whole cleaned, 3-4 lb", 5.75, "lb"),
        ]
        statuses = ["Paid", "Sent", "Sent", "Paid", "Draft", "Overdue", "Paid", "Partial Paid"]
        for idx in range(min(8, len(custs) * 2)):
            cust = custs[idx % len(custs)]
            prods = sample_products[idx % len(sample_products)]
            qty = [50, 100, 200, 75, 30, 150, 80, 120][idx]
            total = round(prods[2] * qty, 2)
            st = statuses[idx % len(statuses)]
            paid = total if st == "Paid" else (total * 0.5 if st == "Partial Paid" else 0)
            ps = "Paid" if st == "Paid" else ("Partial" if st == "Partial Paid" else "Unpaid")
            inv_date = f"2026-0{1 + (idx % 2)}-{10 + idx}"
            due_date = f"2026-0{2 + (idx % 2)}-{10 + idx}"
            inv = {
                "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "invoice_number": f"INV-{str(1001 + idx).zfill(5)}",
                "customer_id": cust["customer_id"],
                "customer_name": cust["name"],
                "invoice_date": inv_date,
                "due_date": due_date,
                "sales_rep": ["Ahmed Khan", "Sarah Chen", "Rafiq Islam"][idx % 3],
                "warehouse": ["Main Warehouse", "Cold Storage A", "Distribution Center"][idx % 3],
                "items": [{
                    "product": prods[0], "description": prods[1],
                    "quantity": qty, "unit": prods[3], "rate": prods[2],
                    "discount": 0, "tax": round(total * 0.08, 2),
                    "amount": total
                }],
                "notes": "", "terms": "Net 30",
                "subtotal": total, "tax_total": round(total * 0.08, 2),
                "discount_total": 0, "total": round(total * 1.08, 2),
                "status": st, "payment_status": ps,
                "amount_paid": round(paid * 1.08, 2),
                "balance_due": round((total - paid) * 1.08, 2),
                "payments": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            }
            await db.invoices.insert_one(inv)

    # Seed Expenses
    existing_expenses = await db.expenses.count_documents({"company_id": company_id})
    if existing_expenses == 0:
        expense_categories = ["Shipping & Freight", "Warehouse Rent", "Utilities", "Equipment Maintenance",
                              "Insurance", "Packaging Supplies", "Cold Storage", "Transportation", "Office Supplies", "Marketing"]
        vendors_list = await db.vendors.find({"company_id": company_id}, {"_id": 0}).to_list(10)
        for idx in range(15):
            vnd = vendors_list[idx % len(vendors_list)] if vendors_list else {"vendor_id": "", "name": ""}
            amounts = [1250, 3500, 890, 2100, 1800, 650, 4200, 1450, 320, 950, 2800, 1100, 3200, 780, 1600]
            await db.expenses.insert_one({
                "expense_id": f"exp_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "vendor_id": vnd.get("vendor_id", ""),
                "vendor_name": vnd.get("name", ""),
                "category": expense_categories[idx % len(expense_categories)],
                "payment_account": ["Operating Account", "Business Checking", "Petty Cash"][idx % 3],
                "payment_method": ["Bank Transfer", "Check", "Cash", "Credit Card"][idx % 4],
                "reference_number": f"REF-{2000 + idx}",
                "expense_date": f"2026-0{1 + (idx % 2)}-{5 + idx}",
                "memo": f"Monthly {expense_categories[idx % len(expense_categories)].lower()} payment",
                "amount": amounts[idx],
                "status": "Recorded",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            })

    # Seed Inventory
    existing_inventory = await db.inventory.count_documents({"company_id": company_id})
    if existing_inventory == 0:
        inventory_items = [
            ("SKU-HF001", "Hilsha Fish (Frozen)", "Frozen Fish", 250, 18.50, 24.00, "kg"),
            ("SKU-TS002", "Tiger Shrimp (16/20)", "Frozen Shrimp", 180, 14.25, 19.50, "lb"),
            ("SKU-PF003", "Pangasius Fillet", "Frozen Fish", 400, 4.80, 7.50, "kg"),
            ("SKU-CF004", "Catla Fish (Whole)", "Frozen Fish", 120, 6.50, 9.00, "lb"),
            ("SKU-BD005", "Bombay Duck (Dried)", "Dried Fish", 85, 12.00, 16.50, "kg"),
            ("SKU-RF006", "Rui Fish (Rohu)", "Frozen Fish", 200, 5.75, 8.25, "lb"),
            ("SKU-BS007", "Black Tiger Shrimp (21/25)", "Frozen Shrimp", 150, 11.50, 15.75, "lb"),
            ("SKU-KP008", "Koi Fish (Climbing Perch)", "Frozen Fish", 60, 8.00, 11.50, "lb"),
            ("SKU-PM009", "Pabda Fish (Butter Catfish)", "Frozen Fish", 45, 15.00, 20.00, "lb"),
            ("SKU-SC010", "Sea Crab (Whole)", "Frozen Shellfish", 30, 9.50, 14.00, "lb"),
            ("SKU-SQ011", "Squid (Cleaned)", "Frozen Seafood", 100, 7.25, 10.50, "lb"),
            ("SKU-CT012", "Chitol Fish", "Frozen Fish", 8, 22.00, 30.00, "lb"),
            ("SKU-TP013", "Tilapia Fillet", "Frozen Fish", 500, 3.50, 5.50, "kg"),
            ("SKU-SR014", "Shrimp Ring (Cooked)", "Value Added", 75, 18.00, 25.00, "pcs"),
            ("SKU-FP015", "Fish Fingers (Breaded)", "Value Added", 200, 6.00, 9.50, "box"),
        ]
        warehouses = ["Main Warehouse", "Cold Storage A", "Distribution Center"]
        for idx, (sku, name, cat, stock, cost, price, unit) in enumerate(inventory_items):
            reserved = int(stock * 0.1)
            await db.inventory.insert_one({
                "item_id": f"itm_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "sku": sku,
                "product_name": name,
                "category": cat,
                "warehouse": warehouses[idx % 3],
                "stock_on_hand": stock,
                "reserved_stock": reserved,
                "available_stock": stock - reserved,
                "unit_cost": cost,
                "sales_price": price,
                "unit": unit,
                "reorder_point": max(10, int(stock * 0.15)),
                "inventory_value": round(stock * cost, 2),
                "status": "Low Stock" if stock <= 10 else "Active",
                "movement_history": [
                    {"movement_id": f"mov_{uuid.uuid4().hex[:8]}", "type": "receive", "quantity": stock,
                     "reason": "Initial stock", "reference": "INIT", "date": datetime.now(timezone.utc).isoformat(), "by": "system"}
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            })

    # Seed Products
    existing_products = await db.products.count_documents({"company_id": company_id})
    if existing_products == 0:
        product_items = [
            ("Hilsha 5/8 UP", "Premium Hilsha fish, 5/8 size, whole frozen", "Frozen Fish", "kg", 3.99, 175.96, 8797.95, 50, "(20KG X 1) 44.09 LBS @ 3.99 LB"),
            ("Hilsha 5/8 (2in1)", "Hilsha fish 5/8 size, 2-in-1 pack", "Frozen Fish", "pack", 9.99, 179.82, 8991.00, 50, "(2 IN 1) X 18PACK @9.99 PACK"),
            ("Hilsha 800 GM UP", "Hilsha fish 800gm and up, whole frozen", "Frozen Fish", "kg", 5.50, 242.55, 24255.00, 100, "20KGS/44.09 LBS @ 5.50"),
            ("Hilsha 1000 GM UP", "Hilsha fish 1kg and up, premium grade", "Frozen Fish", "kg", 6.50, 286.65, 28665.00, 100, "20KG/44.10LB@6.50"),
            ("Hilsha 1200 GM UP", "Hilsha fish 1.2kg+, extra large premium", "Frozen Fish", "kg", 7.99, 352.36, 35235.90, 100, "20KG/44.10LB@7.99"),
            ("Swei / Pangash (W) 2 KG UP", "Pangash fish whole, 2kg and up", "Frozen Fish", "kg", 2.50, 110.25, 11025.00, 100, "20KGS/44.10 LBS @2.50"),
            ("Rohu 1 KG UP (2 IN 1) Pack", "Rohu fish 1kg up, 2-in-1 pack", "Frozen Fish", "pack", 6.99, 55.92, 5592.00, 100, "(2 IN 1) X 8 PACK @6.99 PACK"),
            ("Rohu 3 KG UP", "Rohu fish 3kg and up, whole cleaned", "Frozen Fish", "pcs", 11.99, 71.94, 7194.00, 100, "3KG UP X 6 PC @ 11.99 EACH"),
            ("Mrigal 1 KG UP (2 IN 1)", "Mrigal fish 1kg up, 2-in-1 pack", "Frozen Fish", "pack", 9.99, 79.92, 7192.80, 90, "(2 IN 1) X 8 PACK @9.99 PACK"),
            ("Puti (W) 1 KG UP", "Puti fish whole, 1kg and up", "Frozen Fish", "kg", 1.59, 70.12, 2103.57, 30, "(20KG X 1) 44.09 LBS @ 1.59 LB"),
            ("Tiger Shrimp 16/20", "Headless shell-on tiger shrimp, IQF", "Frozen Shrimp", "lb", 14.25, 14.25, 712.50, 50, "IQF 2LB BAG X 25"),
            ("Black Tiger Shrimp 21/25", "Black tiger shrimp 21/25 count", "Frozen Shrimp", "lb", 11.50, 11.50, 575.00, 50, "IQF 2LB BAG X 25"),
            ("Catla Fish (Whole)", "Catla fish whole cleaned", "Frozen Fish", "lb", 6.50, 6.50, 325.00, 50, "2-3 LB SIZE WHOLE"),
            ("Bombay Duck (Dried)", "Sun-dried Bombay duck, premium", "Dried Fish", "kg", 12.00, 12.00, 360.00, 30, "1KG PACK X 30"),
            ("Tilapia Fillet", "Boneless skinless tilapia fillet", "Frozen Fish", "kg", 3.50, 3.50, 875.00, 250, "5KG BOX X 50"),
        ]
        for idx, (name, desc, cat, unit, cost, sell, case_p, case_qty, weight) in enumerate(product_items):
            await db.products.insert_one({
                "product_id": f"prod_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "name": name,
                "description": desc,
                "category": cat,
                "unit": unit,
                "cost_price": cost,
                "selling_price": sell,
                "case_price": case_p,
                "case_quantity": case_qty,
                "weight_info": weight,
                "sku": f"SKU-{str(idx + 1).zfill(3)}",
                "status": "Active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "system"
            })

    return {"message": "Seed data created", "company_id": company_id}

# ─── Root ───

@api_router.get("/")
async def root():
    return {"message": "Hishab Nikash Pro API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_scheduler():
    """Start background scheduler for daily low-stock checks."""
    async def daily_check_loop():
        while True:
            try:
                now = datetime.now(timezone.utc)
                # Run at 8 AM UTC daily
                next_run = now.replace(hour=8, minute=0, second=0, microsecond=0)
                if now >= next_run:
                    next_run += timedelta(days=1)
                wait_seconds = (next_run - now).total_seconds()
                logger.info(f"Next daily low-stock check in {wait_seconds/3600:.1f} hours")
                await asyncio.sleep(wait_seconds)
                logger.info("Running scheduled daily low-stock check...")
                if ALERT_RECIPIENT_EMAIL:
                    for company in COMPANIES:
                        cid = company["company_id"]
                        items = await db.inventory.find({"company_id": cid}, {"_id": 0}).to_list(500)
                        low_stock = [i for i in items if i.get("stock_on_hand", 0) <= i.get("reorder_point", 10)]
                        if low_stock:
                            rows = "".join([f"<tr><td style='padding:6px 10px;font-size:12px;'>{i.get('sku','')}</td><td style='padding:6px 10px;font-size:12px;font-weight:600;'>{i.get('product_name','')}</td><td style='padding:6px 10px;font-size:12px;color:#BA1A1A;text-align:right;'>{i.get('stock_on_hand',0)}</td></tr>" for i in low_stock])
                            html = f"<div style='font-family:Inter,sans-serif;'><h2>Daily Low Stock - {company['name']}</h2><p>{len(low_stock)} items below reorder point.</p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#F7F9FB;'><th style='padding:6px;text-align:left;'>SKU</th><th style='padding:6px;text-align:left;'>Product</th><th style='padding:6px;text-align:right;'>Stock</th></tr></thead><tbody>{rows}</tbody></table></div>"
                            await send_email_async(ALERT_RECIPIENT_EMAIL, f"Daily Low Stock - {company['name']}", html)
                            logger.info(f"Daily alert sent for {cid}: {len(low_stock)} items")
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(3600)
    asyncio.create_task(daily_check_loop())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
