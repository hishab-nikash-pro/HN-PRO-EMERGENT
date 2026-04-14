from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
