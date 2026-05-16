from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import asyncio
import secrets
import resend
import base64
import csv
import io
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional
import uuid
from calendar import monthrange
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI
import openpyxl
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from passlib.context import CryptContext
# LLM integration
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # type: ignore
    _USING_EMERGENT_LLM = True
except Exception:
    _USING_EMERGENT_LLM = False
    # Lightweight fallback shim (direct OpenAI) — used only if emergentintegrations is missing.
    _openai_client = None
    _default_llm_model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    def _resolve_openai_key():
        return os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY") or ""

    def _get_openai_client():
        global _openai_client
        if _openai_client is None:
            _openai_client = AsyncOpenAI(api_key=_resolve_openai_key())
        return _openai_client
    class ImageContent:
        def __init__(self, image_base64: str = None, url: str = None, mime_type: str = None):
            self.image_base64 = image_base64
            self.url = url
            self.mime_type = mime_type
    class UserMessage:
        def __init__(self, text: str = '', file_contents: list = None):
            self.text = text
            self.file_contents = file_contents or []
    class LlmChat:
        def __init__(self, api_key: str = '', session_id: str = '', system_message: str = ''):
            self.api_key = api_key
            self.session_id = session_id
            self.system_message = system_message
            self.model = _default_llm_model
            self.messages = []
        def with_model(self, provider: str, model: str):
            self.model = model
            return self
        async def send_message(self, user_msg: 'UserMessage') -> str:
            client = AsyncOpenAI(api_key=self.api_key or _resolve_openai_key())
            msgs = [{'role': 'system', 'content': self.system_message}]
            for m in self.messages:
                if isinstance(m, dict):
                    msgs.append(m)
            user_content = [{"type": "text", "text": user_msg.text or ""}]
            for file_content in user_msg.file_contents or []:
                image_base64 = getattr(file_content, "image_base64", None)
                image_url = getattr(file_content, "url", None)
                mime_type = getattr(file_content, "mime_type", None) or "image/png"
                if image_base64:
                    if image_base64.startswith("data:"):
                        image_url = image_base64
                    elif mime_type.startswith("image/"):
                        image_url = f"data:{mime_type};base64,{image_base64}"
                if image_url:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "high",
                        },
                    })
            msgs.append({'role': 'user', 'content': user_content})
            try:
                resp = await client.chat.completions.create(model=self.model, messages=msgs)
                return resp.choices[0].message.content
            except Exception:
                resp = await client.chat.completions.create(model='gpt-4o-mini', messages=msgs)
                return resp.choices[0].message.content

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

APP_ENV = os.environ.get("APP_ENV", "development").lower()
ALLOW_GOOGLE_OAUTH = os.environ.get("ALLOW_GOOGLE_OAUTH", "true").lower() == "true"
LOCAL_AUTH_ENABLED = os.environ.get("LOCAL_AUTH_ENABLED", "true").lower() == "true"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none" if COOKIE_SECURE else "lax").lower()
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "session_token")
APP_DISPLAY_NAME = os.environ.get("APP_DISPLAY_NAME", "Hishab Nikash Pro")
APP_POWERED_BY = os.environ.get("APP_POWERED_BY", "")

# Resend setup
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ALERT_RECIPIENT_EMAIL = os.environ.get('ALERT_RECIPIENT_EMAIL', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
AI_PROVIDER = os.environ.get('AI_PROVIDER', '').strip().lower()
AI_MODEL = os.environ.get('AI_MODEL', '').strip()
AI_BASE_URL = os.environ.get('AI_BASE_URL', '').strip()
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434/v1').strip()
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', '').strip()

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

AI_IMPORT_ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".csv", ".xlsx", ".xls"}
AI_IMPORT_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
AI_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def branded_footer_text(suffix: str = "") -> str:
    base = APP_DISPLAY_NAME if not APP_POWERED_BY else f"{APP_DISPLAY_NAME} - Powered by {APP_POWERED_BY}"
    return f"{base}{suffix}" if suffix else base


def llm_api_key() -> str:
    return EMERGENT_LLM_KEY or OPENAI_API_KEY


def normalize_ai_provider(value: str) -> str:
    provider = (value or "").strip().lower()
    aliases = {
        "local": "openai_compatible",
        "localai": "openai_compatible",
        "lmstudio": "openai_compatible",
        "lm-studio": "openai_compatible",
        "ollama": "ollama",
        "openai-compatible": "openai_compatible",
        "openai_compatible": "openai_compatible",
        "openai": "openai",
    }
    return aliases.get(provider, provider or "auto")


async def resolve_ai_runtime(company_id: str = "") -> Dict[str, Any]:
    settings = await get_company_settings_doc(company_id) if company_id else {}
    provider_setting = settings.get("ai_provider") or AI_PROVIDER
    model_setting = settings.get("ai_model") or AI_MODEL
    base_url_setting = settings.get("ai_base_url") or AI_BASE_URL
    provider = normalize_ai_provider(provider_setting)

    if provider in {"auto", ""}:
        if base_url_setting or OLLAMA_MODEL:
            provider = "openai_compatible" if base_url_setting else "ollama"
        elif llm_api_key():
            provider = "openai"
        else:
            provider = "unconfigured"

    if provider == "ollama":
        return {
            "provider": provider,
            "model": model_setting or OLLAMA_MODEL or "qwen2.5:7b-instruct",
            "base_url": base_url_setting or OLLAMA_BASE_URL,
            "api_key": "ollama-local",
            "voice_enabled": bool(settings.get("ai_voice_enabled", False)),
            "text_first_mode": bool(settings.get("ai_text_first_mode", True)),
            "enabled_tools": settings.get("ai_enabled_tools") or [],
        }

    if provider == "openai_compatible":
        return {
            "provider": provider,
            "model": model_setting or OPENAI_MODEL,
            "base_url": base_url_setting or OLLAMA_BASE_URL,
            "api_key": llm_api_key() or "local-ai",
            "voice_enabled": bool(settings.get("ai_voice_enabled", False)),
            "text_first_mode": bool(settings.get("ai_text_first_mode", True)),
            "enabled_tools": settings.get("ai_enabled_tools") or [],
        }

    if provider == "openai":
        key = llm_api_key()
        if not key:
            return {
                "provider": "unconfigured",
                "model": model_setting or OPENAI_MODEL,
                "base_url": "",
                "api_key": "",
                "voice_enabled": bool(settings.get("ai_voice_enabled", False)),
                "text_first_mode": bool(settings.get("ai_text_first_mode", True)),
                "enabled_tools": settings.get("ai_enabled_tools") or [],
            }
        return {
            "provider": provider,
            "model": model_setting or OPENAI_MODEL,
            "base_url": "",
            "api_key": key,
            "voice_enabled": bool(settings.get("ai_voice_enabled", False)),
            "text_first_mode": bool(settings.get("ai_text_first_mode", True)),
            "enabled_tools": settings.get("ai_enabled_tools") or [],
        }

    return {
        "provider": "unconfigured",
        "model": model_setting or OPENAI_MODEL,
        "base_url": base_url_setting,
        "api_key": llm_api_key(),
        "voice_enabled": bool(settings.get("ai_voice_enabled", False)),
        "text_first_mode": bool(settings.get("ai_text_first_mode", True)),
        "enabled_tools": settings.get("ai_enabled_tools") or [],
    }


def build_openai_client(runtime: Dict[str, Any]) -> AsyncOpenAI:
    kwargs: Dict[str, Any] = {
        "api_key": runtime.get("api_key") or llm_api_key() or "local-ai",
    }
    if runtime.get("base_url"):
        kwargs["base_url"] = runtime["base_url"]
    return AsyncOpenAI(**kwargs)


async def send_ai_chat_completion(
    runtime: Dict[str, Any],
    *,
    system_message: str,
    history: List[Dict[str, str]],
    user_message: str,
) -> str:
    client = build_openai_client(runtime)
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_message}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    response = await client.chat.completions.create(
        model=runtime.get("model") or OPENAI_MODEL,
        messages=messages,
    )
    return response.choices[0].message.content or ""


AUDIT_COLLECTION_MAP = {
    "invoice": ("invoices", "invoice_id"),
    "bill": ("bills", "bill_id"),
    "expense": ("expenses", "expense_id"),
    "journal_entry": ("journal_entries", "entry_id"),
    "sales_order": ("sales_orders", "sales_order_id"),
    "purchase_order": ("purchase_orders", "purchase_order_id"),
    "credit_memo": ("credit_memos", "credit_memo_id"),
    "stock_transfer": ("stock_transfers", "transfer_id"),
    "shipment": ("shipments", "shipment_id"),
}


def build_activity_entry(company_id: str, user_id: str, record_type: str, record_id: str, action: str, summary: str, changes: Optional[dict] = None) -> dict:
    return {
        "activity_id": f"act_{uuid.uuid4().hex[:12]}",
        "company_id": company_id,
        "record_type": record_type,
        "record_id": record_id,
        "action": action,
        "summary": summary,
        "changes": changes or {},
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def write_audit_entry(entry: dict):
    await db.audit_logs.insert_one(dict(entry))


async def append_record_activity(company_id: str, record_type: str, record_id: str, entry: dict):
    mapping = AUDIT_COLLECTION_MAP.get(record_type)
    if not mapping:
        return
    collection_name, id_field = mapping
    await db[collection_name].update_one(
        {"company_id": company_id, id_field: record_id},
        {"$push": {"activity_timeline": entry}}
    )


async def log_record_activity(company_id: str, user_id: str, record_type: str, record_id: str, action: str, summary: str, changes: Optional[dict] = None):
    entry = build_activity_entry(company_id, user_id, record_type, record_id, action, summary, changes)
    await append_record_activity(company_id, record_type, record_id, entry)
    await write_audit_entry(entry)


async def get_company_settings_doc(company_id: str) -> dict:
    settings = await db.settings.find_one({"company_id": company_id}, {"_id": 0})
    return settings or {}


async def next_document_number(company_id: str, collection_name: str, prefix_key: str, fallback_prefix: str) -> str:
    settings = await get_company_settings_doc(company_id)
    prefix = settings.get(prefix_key) or fallback_prefix
    start_number = int(settings.get(f"{prefix_key}_starting_number", 1001) or 1001)
    count = await db[collection_name].count_documents({"company_id": company_id})
    return f"{prefix}-{str(start_number + count).zfill(5)}"


async def create_bill_from_purchase_order_doc(company_id: str, po: dict, user_id: str, automation_source: str = "manual") -> dict:
    bill_id = f"bill_{uuid.uuid4().hex[:10]}"
    bill_number = await next_document_number(company_id, "bills", "bill_prefix", "BILL")
    activity = build_activity_entry(
        company_id,
        user_id,
        "bill",
        bill_id,
        "create",
        f"Converted purchase order {po.get('purchase_order_number', po.get('purchase_order_id', ''))} to bill {bill_number}",
        {"automation_source": automation_source},
    )
    bill = {
        "bill_id": bill_id,
        "company_id": company_id,
        "vendor_id": po.get("vendor_id", ""),
        "vendor_name": po.get("vendor_name", ""),
        "bill_number": bill_number,
        "bill_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": po.get("expected_date", ""),
        "items": po.get("items", []),
        "notes": po.get("notes", ""),
        "total": po.get("total", 0),
        "status": "Open",
        "amount_paid": 0,
        "balance_due": po.get("total", 0),
        "payments": [],
        "converted_from_purchase_order": po.get("purchase_order_id", ""),
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id,
    }
    await db.bills.insert_one(bill)
    await write_audit_entry(activity)
    return bill


async def create_manual_bank_transaction(company_id: str, bank_account_id: str, payload, user_id: str) -> dict:
    amount = float(payload.amount or 0)
    signed_amount = abs(amount) if payload.transaction_type.lower() in ("deposit", "credit") else -abs(amount)
    transaction = {
        "bank_transaction_id": f"btxn_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "bank_account_id": bank_account_id,
        **payload.model_dump(),
        "amount": abs(amount),
        "signed_amount": signed_amount,
        "txn_date": payload.txn_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id,
    }
    await db.bank_transactions.insert_one(transaction)
    await db.bank_accounts.update_one(
        {"company_id": company_id, "bank_account_id": bank_account_id},
        {"$inc": {"current_balance": signed_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await write_audit_entry(
        build_activity_entry(
            company_id,
            user_id,
            "bank_transaction",
            transaction["bank_transaction_id"],
            "create",
            f"Added manual bank transaction {payload.description or payload.transaction_type}",
            {"bank_account_id": bank_account_id, "signed_amount": signed_amount},
        )
    )
    transaction.pop("_id", None)
    return transaction


async def get_record_for_approval(company_id: str, record_type: str, record_id: str):
    mapping = AUDIT_COLLECTION_MAP.get(record_type)
    if not mapping:
        raise HTTPException(status_code=400, detail=f"Unsupported record type '{record_type}'.")
    collection_name, id_field = mapping
    doc = await db[collection_name].find_one({"company_id": company_id, id_field: record_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"{record_type.replace('_', ' ').title()} not found")
    return doc, collection_name, id_field


def parse_iso_date(value: str, fallback: Optional[datetime] = None) -> datetime:
    fallback_dt = fallback or datetime.now(timezone.utc)
    if not value:
        return fallback_dt
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return fallback_dt


def format_iso_date(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d")


def advance_schedule_date(current_date: str, frequency: str, interval: int = 1, day_of_month: Optional[int] = None, weekday: Optional[int] = None) -> str:
    interval = max(1, int(interval or 1))
    base = parse_iso_date(current_date)
    frequency = (frequency or "monthly").lower()
    if frequency == "weekly":
        next_dt = base + timedelta(days=7 * interval)
        if weekday is not None:
            delta = (int(weekday) - next_dt.weekday()) % 7
            next_dt = next_dt + timedelta(days=delta)
        return format_iso_date(next_dt)
    month_step = {
        "monthly": 1,
        "quarterly": 3,
        "yearly": 12,
    }.get(frequency, 1) * interval
    total_months = (base.year * 12 + (base.month - 1)) + month_step
    year = total_months // 12
    month = total_months % 12 + 1
    last_day = monthrange(year, month)[1]
    target_day = day_of_month or base.day
    target_day = max(1, min(target_day, last_day))
    return datetime(year, month, target_day, tzinfo=timezone.utc).strftime("%Y-%m-%d")


async def create_invoice_document(company_id: str, payload: dict, user_id: str, source: str = "manual", source_id: str = "", mark_created_action: str = "create"):
    inv_number = await next_document_number(company_id, "invoices", "invoice_prefix", "INV")
    invoice_id = f"inv_{uuid.uuid4().hex[:10]}"
    customer_name = payload.get("customer_name") or payload.get("customer_id", "")
    activity_action = "generate" if source == "recurring_template" else mark_created_action
    activity_summary = f"{'Generated' if source == 'recurring_template' else 'Created'} invoice {inv_number} for {customer_name}"
    activity = build_activity_entry(company_id, user_id, "invoice", invoice_id, activity_action, activity_summary, {"source": source, "source_id": source_id})
    total = float(payload.get("total", 0) or 0)
    amount_paid = float(payload.get("amount_paid", 0) or 0)
    invoice_date = payload.get("invoice_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    due_date = payload.get("due_date") or (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    normalized_items = []
    cogs_total = 0.0
    for item in payload.get("items", []) or []:
        if not item:
            continue
        validated = await validate_invoice_line_item(company_id, item)
        item_row = dict(item)
        item_row["product_id"] = validated["product"].get("product_id", item_row.get("product_id", ""))
        item_row["pricing_mode"] = validated["pricing_mode"]
        item_row["product_mode"] = validated["product_mode"]
        item_row["units_per_case"] = validated["units_per_case"]
        item_row["unit_price"] = float(item_row.get("unit_price", validated["unit_price"]) or validated["unit_price"])
        item_row["case_price"] = float(item_row.get("case_price", validated["case_price"]) or validated["case_price"])
        item_row["unit_cost"] = float(item_row.get("unit_cost", validated["product"].get("unit_cost", validated["product"].get("cost_price", 0))) or 0)
        item_row["cost_total"] = calculate_invoice_item_cost(item_row, validated["product"])
        cogs_total += item_row["cost_total"]
        normalized_items.append(item_row)

    invoice = {
        "invoice_id": invoice_id,
        "company_id": company_id,
        "invoice_number": inv_number,
        "customer_id": payload.get("customer_id", ""),
        "customer_name": payload.get("customer_name", ""),
        "invoice_date": invoice_date,
        "due_date": due_date,
        "sales_rep": payload.get("sales_rep", ""),
        "warehouse": payload.get("warehouse", ""),
        "items": normalized_items,
        "notes": payload.get("notes", ""),
        "terms": payload.get("terms", "Net 30"),
        "subtotal": float(payload.get("subtotal", 0) or 0),
        "tax_total": float(payload.get("tax_total", 0) or 0),
        "discount_total": float(payload.get("discount_total", 0) or 0),
        "total": total,
        "status": payload.get("status", "Draft"),
        "payment_status": payload.get("payment_status", "Unpaid"),
        "amount_paid": amount_paid,
        "balance_due": round(total - amount_paid, 2),
        "payments": payload.get("payments", []),
        "approval_status": payload.get("approval_status", "Draft"),
        "approval_history": payload.get("approval_history", []),
        "activity_timeline": [activity],
        "source": source,
        "source_id": source_id,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id,
        "cogs_total": round(cogs_total, 2),
        "gross_profit": round(total - cogs_total, 2),
        "inventory_posted": False,
        "inventory_movements": [],
    }
    await db.invoices.insert_one(invoice)
    await write_audit_entry(activity)
    if invoice.get("customer_id"):
        await db.customers.update_one(
            {"company_id": company_id, "customer_id": invoice["customer_id"]},
            {"$inc": {"open_balance": invoice["balance_due"], "total_invoiced": total}, "$set": {"last_invoice_date": invoice_date}}
        )
    invoice = await sync_invoice_inventory(company_id, invoice, user_id)
    invoice.pop("_id", None)
    return invoice


async def create_bill_document(company_id: str, payload: dict, user_id: str, source: str = "manual", source_id: str = "", mark_created_action: str = "create"):
    bill_number = payload.get("bill_number") or await next_document_number(company_id, "bills", "bill_prefix", "BILL")
    bill_id = f"bill_{uuid.uuid4().hex[:10]}"
    vendor_name = payload.get("vendor_name") or payload.get("vendor_id", "")
    activity_action = "generate" if source == "recurring_template" else mark_created_action
    activity_summary = f"{'Generated' if source == 'recurring_template' else 'Created'} bill {bill_number} for {vendor_name}"
    activity = build_activity_entry(company_id, user_id, "bill", bill_id, activity_action, activity_summary, {"source": source, "source_id": source_id})
    total = float(payload.get("total", 0) or 0)
    amount_paid = float(payload.get("amount_paid", 0) or 0)
    bill = {
        "bill_id": bill_id,
        "company_id": company_id,
        "vendor_id": payload.get("vendor_id", ""),
        "vendor_name": payload.get("vendor_name", ""),
        "bill_number": bill_number,
        "bill_date": payload.get("bill_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": payload.get("due_date", ""),
        "items": payload.get("items", []),
        "notes": payload.get("notes", ""),
        "total": total,
        "status": payload.get("status", "Open"),
        "amount_paid": amount_paid,
        "balance_due": round(total - amount_paid, 2),
        "payments": payload.get("payments", []),
        "approval_status": payload.get("approval_status", "Draft"),
        "approval_history": payload.get("approval_history", []),
        "activity_timeline": [activity],
        "source": source,
        "source_id": source_id,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id,
    }
    await db.bills.insert_one(bill)
    await write_audit_entry(activity)
    if bill.get("vendor_id"):
        await db.vendors.update_one(
            {"company_id": company_id, "vendor_id": bill["vendor_id"]},
            {"$inc": {"payable_balance": bill["balance_due"], "total_billed": total, "bill_count": 1}}
        )
    bill.pop("_id", None)
    return bill


async def sync_company_reminders(company_id: str):
    settings = await get_company_settings_doc(company_id)
    invoice_due_days = int(settings.get("invoice_due_reminder_days", 3) or 3)
    bill_due_days = int(settings.get("bill_due_reminder_days", 3) or 3)
    overdue_days = int(settings.get("overdue_reminder_days", 1) or 1)
    today = datetime.now(timezone.utc).date()

    async def upsert_reminder(record_type: str, record_id: str, reminder_kind: str, title: str, due_date: str, summary: str, days_delta: int, amount: float):
        doc = {
            "company_id": company_id,
            "record_type": record_type,
            "record_id": record_id,
            "reminder_kind": reminder_kind,
            "title": title,
            "due_date": due_date,
            "summary": summary,
            "days_delta": days_delta,
            "amount": round(amount, 2),
            "status": "Open",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.reminders.update_one(
            {"company_id": company_id, "record_type": record_type, "record_id": record_id, "reminder_kind": reminder_kind},
            {"$set": doc, "$setOnInsert": {"reminder_id": f"rem_{uuid.uuid4().hex[:10]}", "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )

    async def resolve_reminders(record_type: str, record_id: str):
        await db.reminders.update_many(
            {"company_id": company_id, "record_type": record_type, "record_id": record_id, "status": "Open"},
            {"$set": {"status": "Resolved", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    for invoice in invoices:
        balance = float(invoice.get("balance_due", 0) or 0)
        due_date_str = invoice.get("due_date", "")
        if balance <= 0 or not due_date_str:
            await resolve_reminders("invoice", invoice.get("invoice_id", ""))
            continue
        due_date = parse_iso_date(due_date_str).date()
        days_until_due = (due_date - today).days
        days_overdue = (today - due_date).days
        if 0 <= days_until_due <= invoice_due_days:
            await upsert_reminder("invoice", invoice["invoice_id"], "due_soon", f"Invoice {invoice.get('invoice_number', '')} due soon", due_date_str, f"{invoice.get('customer_name', 'Customer')} invoice is due in {days_until_due} day(s).", days_until_due, balance)
        if days_overdue >= overdue_days:
            await upsert_reminder("invoice", invoice["invoice_id"], "overdue", f"Invoice {invoice.get('invoice_number', '')} overdue", due_date_str, f"{invoice.get('customer_name', 'Customer')} invoice is overdue by {days_overdue} day(s).", -days_overdue, balance)

    bills = await db.bills.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    for bill in bills:
        balance = float(bill.get("balance_due", 0) or 0)
        due_date_str = bill.get("due_date", "")
        if balance <= 0 or not due_date_str:
            await resolve_reminders("bill", bill.get("bill_id", ""))
            continue
        due_date = parse_iso_date(due_date_str).date()
        days_until_due = (due_date - today).days
        days_overdue = (today - due_date).days
        if 0 <= days_until_due <= bill_due_days:
            await upsert_reminder("bill", bill["bill_id"], "due_soon", f"Bill {bill.get('bill_number', '')} due soon", due_date_str, f"{bill.get('vendor_name', 'Vendor')} bill is due in {days_until_due} day(s).", days_until_due, balance)
        if days_overdue >= overdue_days:
            await upsert_reminder("bill", bill["bill_id"], "overdue", f"Bill {bill.get('bill_number', '')} overdue", due_date_str, f"{bill.get('vendor_name', 'Vendor')} bill is overdue by {days_overdue} day(s).", -days_overdue, balance)

    reminders = await db.reminders.find({"company_id": company_id, "status": "Open"}, {"_id": 0}).sort("due_date", 1).to_list(500)
    return reminders


async def run_recurring_template(company_id: str, template: dict, user_id: str):
    payload = dict(template.get("template_payload") or {})
    template_type = template.get("template_type")
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payload["status"] = payload.get("status") or ("Draft" if template_type == "invoice" else "Open")
    if template_type == "invoice":
        payload["invoice_date"] = today_str
        if not payload.get("due_date"):
            payload["due_date"] = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        created = await create_invoice_document(company_id, payload, user_id, source="recurring_template", source_id=template["template_id"])
        created_type = "invoice"
        created_id = created["invoice_id"]
    elif template_type == "bill":
        payload["bill_date"] = today_str
        created = await create_bill_document(company_id, payload, user_id, source="recurring_template", source_id=template["template_id"])
        created_type = "bill"
        created_id = created["bill_id"]
    else:
        raise HTTPException(status_code=400, detail="Unsupported template type.")

    next_run_date = advance_schedule_date(
        template.get("next_run_date") or today_str,
        template.get("frequency", "monthly"),
        template.get("interval", 1),
        template.get("day_of_month"),
        template.get("weekday"),
    )
    update_fields = {
        "last_run_date": today_str,
        "next_run_date": next_run_date,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_generated_record_type": created_type,
        "last_generated_record_id": created_id,
    }
    await db.recurring_templates.update_one(
        {"company_id": company_id, "template_id": template["template_id"]},
        {"$set": update_fields, "$inc": {"generated_count": 1}},
    )
    await log_record_activity(company_id, user_id, created_type, created_id, "recurring_link", f"Generated from recurring template {template.get('name', template['template_id'])}")
    await write_audit_entry(build_activity_entry(company_id, user_id, "recurring_template", template["template_id"], "run", f"Ran recurring {template_type} template {template.get('name', template['template_id'])}", {"generated_record_type": created_type, "generated_record_id": created_id}))
    return created


async def run_due_recurring_templates(company_id: str, user_id: str):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    settings = await get_company_settings_doc(company_id)
    if settings.get("recurring_auto_run", True) is False:
        reminders = await sync_company_reminders(company_id)
        return {"generated": [], "reminders": reminders}
    templates = await db.recurring_templates.find(
        {"company_id": company_id, "status": "Active", "auto_run": True, "next_run_date": {"$lte": today_str}},
        {"_id": 0},
    ).to_list(200)
    generated = []
    for template in templates:
        if template.get("end_date") and template["end_date"] < today_str:
            await db.recurring_templates.update_one({"company_id": company_id, "template_id": template["template_id"]}, {"$set": {"status": "Completed", "updated_at": datetime.now(timezone.utc).isoformat()}})
            continue
        generated.append(await run_recurring_template(company_id, template, user_id))
    reminders = await sync_company_reminders(company_id)
    return {"generated": generated, "reminders": reminders}


def normalize_statement_amount(row: dict) -> float:
    credit = row.get("credit")
    debit = row.get("debit")
    amount = row.get("amount")
    if credit not in (None, "") or debit not in (None, ""):
        try:
            credit_value = float(credit or 0)
        except Exception:
            credit_value = 0
        try:
            debit_value = float(debit or 0)
        except Exception:
            debit_value = 0
        return round(credit_value - debit_value, 2)
    try:
        return round(float(amount or 0), 2)
    except Exception:
        return 0.0


async def collect_bank_match_candidates(company_id: str, amount: float):
    candidates = []
    target_amount = round(abs(float(amount or 0)), 2)
    is_credit = amount >= 0

    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(3000)
    for inv in invoices:
        for payment in inv.get("payments", []):
            payment_amount = round(float(payment.get("amount", 0) or 0), 2)
            if is_credit and abs(payment_amount - target_amount) <= 0.01:
                candidates.append({
                    "record_type": "customer_payment",
                    "record_id": payment.get("payment_id"),
                    "summary": f"Customer payment {inv.get('invoice_number', '')} - {inv.get('customer_name', '')}",
                    "amount": payment_amount,
                    "date": payment.get("payment_date", ""),
                    "reference": payment.get("reference", ""),
                })

    bills = await db.bills.find({"company_id": company_id}, {"_id": 0}).to_list(3000)
    for bill in bills:
        for payment in bill.get("payments", []):
            payment_amount = round(float(payment.get("amount", 0) or 0), 2)
            if (not is_credit) and abs(payment_amount - target_amount) <= 0.01:
                candidates.append({
                    "record_type": "vendor_payment",
                    "record_id": payment.get("payment_id"),
                    "summary": f"Vendor payment {bill.get('bill_number', '')} - {bill.get('vendor_name', '')}",
                    "amount": payment_amount,
                    "date": payment.get("payment_date", ""),
                    "reference": payment.get("reference", ""),
                })

    entries = await db.journal_entries.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    for entry in entries:
        entry_amount = round(max(float(entry.get("total_debit", 0) or 0), float(entry.get("total_credit", 0) or 0)), 2)
        if abs(entry_amount - target_amount) <= 0.01:
            candidates.append({
                "record_type": "journal_entry",
                "record_id": entry.get("entry_id"),
                "summary": f"Journal entry {entry.get('entry_number', '')} - {entry.get('description', '')}",
                "amount": entry_amount,
                "date": entry.get("entry_date", ""),
                "reference": "",
            })
    candidates.sort(key=lambda item: item.get("date", ""), reverse=True)
    return candidates[:20]

# ─── Pydantic Models ───

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: Optional[str] = "local"

class CompanyOut(BaseModel):
    company_id: str
    name: str
    short_name: str
    type: str
    currency: str = "USD"
    country: str = "US"
    logo_text: Optional[str] = None

class LocalRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    company_id: str
    role_requested: str = "STAFF"

class LocalLoginRequest(BaseModel):
    email: str
    password: str


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthSelectCompanyRequest(BaseModel):
    company_id: str


class ProfileUpdateRequest(BaseModel):
    name: str
    notifications_enabled: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TeamMemberCreateRequest(BaseModel):
    name: str
    email: str
    role: str = "STAFF"
    company_id: Optional[str] = None
    company_ids: Optional[List[str]] = None
    password: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str = ""
    store_name: Optional[str] = ""
    contact_person: Optional[str] = ""
    company_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    website: Optional[str] = ""
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
    product_id: str = ""
    product: str = ""
    description: str = ""
    quantity: float = 0
    unit: str = "pcs"
    pricing_mode: str = "case"
    unit_type: str = "PCS"
    units_per_case: float = 1
    unit_price: float = 0
    case_price: float = 0
    rate: float = 0
    discount: float = 0
    tax_rate: float = 0
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
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    sales_rep: Optional[str] = None
    warehouse: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[InvoiceLineItem]] = None
    customer_message: Optional[str] = None
    memo: Optional[str] = None
    subtotal: Optional[float] = None
    tax_total: Optional[float] = None
    discount_total: Optional[float] = None
    total: Optional[float] = None
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
    product_type: Optional[str] = "Inventory"
    category: Optional[str] = ""
    brand: Optional[str] = ""
    unit: str = "pcs"
    unit_type: Optional[str] = "PCS"
    product_mode: Optional[str] = "CASE"
    units_per_case: Optional[int] = None  # How many units in one case (e.g., 1 case = 12 units) - None means use case_quantity fallback
    unit_label: Optional[str] = "PCS"
    cost_type: Optional[str] = "UNIT"
    cost_price: float = 0
    unit_cost: Optional[float] = 0
    case_cost: Optional[float] = 0
    unit_price: Optional[float] = 0
    selling_price: float = 0
    case_price: Optional[float] = 0
    case_price_override: Optional[float] = None
    effective_case_price: Optional[float] = 0
    packing_text: Optional[str] = ""
    price_basis: Optional[str] = ""
    size_range: Optional[str] = ""
    default_box_weight_kg: Optional[float] = 0
    default_box_weight_lb: Optional[float] = 0
    default_box_price: Optional[float] = 0
    actual_dispatch_weight_lb: Optional[float] = 0
    actual_dispatch_unit_price: Optional[float] = 0
    final_dispatch_box_price: Optional[float] = 0
    cases_on_hand: float = 0  # Stock quantity in cases
    available_cases: float = 0  # Available stock in cases (not reserved/committed)
    stock_units_on_hand: Optional[float] = 0
    available_stock_units: Optional[float] = 0
    stock_cases: Optional[float] = 0
    in_stock: Optional[bool] = True
    weight_info: Optional[str] = ""
    sku: Optional[str] = ""
    barcode: Optional[str] = ""
    notes: Optional[str] = ""
    tax_code: Optional[str] = "STANDARD"
    tax_rate: Optional[float] = 0
    status: str = "Active"
    # Legacy fields for backward compatibility
    case_quantity: Optional[int] = 1  # Deprecated, use units_per_case
    stock_on_hand: Optional[float] = 0  # Deprecated, use cases_on_hand

class ProductBulkDeleteRequest(BaseModel):
    product_ids: List[str]

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

class OrderLineItem(BaseModel):
    product_id: Optional[str] = ""
    product_name: str = ""
    description: str = ""
    quantity: float = 0
    unit: str = "pcs"
    rate: float = 0
    tax_code: str = ""
    tax_rate: float = 0
    tax_amount: float = 0
    amount: float = 0

class SalesOrderCreate(BaseModel):
    customer_id: str
    customer_name: str = ""
    order_date: str = ""
    expected_date: str = ""
    reference: str = ""
    shipping_address: str = ""
    items: List[OrderLineItem] = []
    notes: str = ""
    subtotal: float = 0
    tax_total: float = 0
    discount_total: float = 0
    total: float = 0
    status: str = "Draft"

class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    vendor_name: str = ""
    order_date: str = ""
    expected_date: str = ""
    reference: str = ""
    delivery_address: str = ""
    items: List[OrderLineItem] = []
    notes: str = ""
    subtotal: float = 0
    tax_total: float = 0
    total: float = 0
    status: str = "Draft"

class ApprovalActionRequest(BaseModel):
    note: str = ""

class RecurringTemplateCreate(BaseModel):
    name: str
    template_type: str  # invoice or bill
    status: str = "Active"
    frequency: str = "monthly"
    interval: int = 1
    day_of_month: Optional[int] = None
    weekday: Optional[int] = None
    start_date: str = ""
    end_date: str = ""
    auto_run: bool = True
    reminder_days_before: int = 3
    overdue_days_after: int = 1
    template_payload: dict = Field(default_factory=dict)
    notes: str = ""

class BankAccountCreate(BaseModel):
    account_name: str
    account_type: str = "Checking"
    account_number_last4: str = ""
    currency: str = "USD"
    opening_balance: float = 0
    current_balance: float = 0
    ledger_account_code: str = "1000"
    notes: str = ""

class StatementMatchRequest(BaseModel):
    record_type: str
    record_id: str
    note: str = ""

class BankAdjustmentCreate(BaseModel):
    account_code: str = "6900"
    account_name: str = "Bank Reconciliation Adjustment"
    description: str = ""
    amount: float = 0

class CreditMemoCreate(BaseModel):
    customer_id: str
    customer_name: str = ""
    invoice_id: str = ""
    credit_date: str = ""
    reason: str = ""
    notes: str = ""
    total: float = 0
    status: str = "Open"

class StockTransferCreate(BaseModel):
    item_id: str = ""
    product_id: str = ""
    product_name: str = ""
    quantity: float = 0
    unit: str = "pcs"
    source_warehouse: str = ""
    destination_warehouse: str = ""
    transfer_date: str = ""
    notes: str = ""

class ShipmentCreate(BaseModel):
    shipment_name: str
    container_number: str = ""
    supplier_name: str = ""
    vendor_id: str = ""
    country: str = ""
    etd: str = ""
    eta: str = ""
    customs_status: str = "Pending"
    status: str = "In Transit"
    reference: str = ""
    notes: str = ""

class LinkedDocumentCreate(BaseModel):
    title: str
    document_type: str = "General"
    entity_type: str = "shipment"
    entity_id: str = ""
    vendor_id: str = ""
    product_id: str = ""
    file_name: str = ""
    file_type: str = ""
    file_base64: str = ""
    notes: str = ""

class BankTransactionCreate(BaseModel):
    txn_date: str = ""
    description: str = ""
    reference: str = ""
    transaction_type: str = "Deposit"
    amount: float = 0
    category: str = ""
    counterparty_name: str = ""
    notes: str = ""

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
    supplier_name: str = ""
    reference: str = ""
    invoice_number: str = ""
    container_number: str = ""
    shipment_date: str = ""
    eta: str = ""
    receive_date: str = ""
    items: list = []
    notes: str = ""
    total_cost: float = 0
    warehouse: str = "Main Warehouse"
    status: str = "Draft"
    source_upload_id: str = ""

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    sub_type: str = ""
    description: str = ""
    opening_balance: float = 0
    status: str = "Active"

# ─── Auth Helpers ───

def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


CANONICAL_ROLES = ("OWNER", "MANAGER", "STAFF")
ROLE_ALIASES = {
    "OWNER": "OWNER",
    "ADMIN": "OWNER",
    "MANAGER": "MANAGER",
    "STAFF": "STAFF",
    "STAFF_ACCOUNTANT": "STAFF",
    "STAFFACCOUNTANT": "STAFF",
    "ACCOUNTANT": "STAFF",
    "VIEWER": "STAFF",
}
ROLE_RANKS = {"OWNER": 3, "MANAGER": 2, "STAFF": 1}
ROLE_LABELS = {"OWNER": "OWNER", "MANAGER": "MANAGER", "STAFF": "STAFF"}

PERMISSION_TABLE = {
    "dashboard": ["view"],
    "companies": ["view", "switch"],
    "customers": ["view", "create", "edit", "delete"],
    "vendors": ["view", "create", "edit", "delete"],
    "products": ["view", "create", "edit", "delete"],
    "inventory": ["view", "create", "edit", "delete", "post"],
    "stock_receipts": ["view", "create", "edit", "delete", "post"],
    "stock_transfers": ["view", "create", "edit", "delete"],
    "shipments": ["view", "create", "edit", "delete"],
    "invoices": ["view", "create", "edit", "delete", "print", "pay"],
    "estimates": ["view", "create", "edit", "delete", "convert"],
    "sales_orders": ["view", "create", "edit", "delete", "convert"],
    "credit_memos": ["view", "create", "edit", "delete"],
    "payments": ["view", "create", "edit", "delete"],
    "bills": ["view", "create", "edit", "delete", "pay"],
    "purchase_orders": ["view", "create", "edit", "delete", "convert", "receive"],
    "expenses": ["view", "create", "edit", "delete"],
    "banking": ["view", "create", "edit", "delete", "reconcile"],
    "accounts": ["view", "create", "edit"],
    "journal_entries": ["view", "create", "edit", "post"],
    "reports": ["view", "export", "view_profit"],
    "settings": ["view", "edit"],
    "users": ["view", "manage"],
    "audit": ["view"],
    "deleted_records": ["view"],
    "ai_import": ["view", "create", "edit"],
    "recurring": ["view", "create", "edit", "delete", "run"],
}

STAFF_WRITE_MODULES = {
    "customers",
    "vendors",
    "products",
    "inventory",
    "stock_receipts",
    "stock_transfers",
    "shipments",
    "invoices",
    "estimates",
    "sales_orders",
    "credit_memos",
    "payments",
    "bills",
    "purchase_orders",
    "expenses",
    "ai_import",
    "recurring",
}


def normalize_role(role: Optional[str]) -> str:
    token = re.sub(r"[^A-Z]+", "_", (role or "").strip().upper()).strip("_")
    return ROLE_ALIASES.get(token, "STAFF")


def role_slug_set(role: Optional[str]) -> set[str]:
    canonical_role = normalize_role(role)
    all_slugs = {
        f"{module}.{action}"
        for module, actions in PERMISSION_TABLE.items()
        for action in actions
    }
    if canonical_role == "OWNER":
        return all_slugs
    if canonical_role == "MANAGER":
        return {
            slug for slug in all_slugs
            if not slug.startswith("settings.") and not slug.startswith("users.")
        }

    slugs = {
        "dashboard.view",
        "companies.view",
        "companies.switch",
        "reports.view",
        "customers.view",
        "vendors.view",
        "products.view",
        "inventory.view",
        "stock_receipts.view",
        "stock_transfers.view",
        "shipments.view",
        "invoices.view",
        "estimates.view",
        "sales_orders.view",
        "credit_memos.view",
        "payments.view",
        "bills.view",
        "purchase_orders.view",
        "expenses.view",
        "accounts.view",
        "journal_entries.view",
        "ai_import.view",
        "recurring.view",
    }
    for module in STAFF_WRITE_MODULES:
        if f"{module}.create" in all_slugs:
            slugs.add(f"{module}.create")
    return slugs


def permission_payload(role: Optional[str]) -> dict:
    if not role:
        grants = {
            "companies.view": True,
            "companies.switch": True,
        }
        return {
            "grants": sorted(grants.keys()),
            "map": grants,
            "can_edit_price": False,
            "can_delete_invoice": False,
            "can_export_data": False,
            "can_view_profit": False,
        }
    slugs = sorted(role_slug_set(role))
    grants = {slug: True for slug in slugs}
    return {
        "grants": slugs,
        "map": grants,
        "can_edit_price": normalize_role(role) in {"OWNER", "MANAGER"},
        "can_delete_invoice": grants.get("invoices.delete", False),
        "can_export_data": grants.get("reports.export", False),
        "can_view_profit": grants.get("reports.view_profit", False),
    }


def serialize_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture"),
        "auth_provider": user.get("auth_provider", "local"),
    }


def set_session_cookie(response: Response, session_token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        max_age=7 * 24 * 60 * 60,
    )


async def create_user_session(response: Response, user_id: str, active_company_id: Optional[str] = None) -> str:
    session_token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "active_company_id": active_company_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    set_session_cookie(response, session_token)
    return session_token


def serialize_company_access(company: dict, role: str) -> dict:
    return {
        "company_id": company.get("company_id", ""),
        "name": company.get("name", ""),
        "short_name": company.get("short_name", company.get("name", "")),
        "type": company.get("type", ""),
        "currency": company.get("currency", "USD"),
        "country": company.get("country", "US"),
        "logo_text": company.get("logo_text"),
        "role": normalize_role(role),
    }


async def get_user_company_memberships(user_id: str) -> List[dict]:
    membership_roles: Dict[str, str] = {}

    owner_companies = await db.companies.find({"owner_user_id": user_id}, {"_id": 0}).to_list(100)
    company_docs: Dict[str, dict] = {
        company.get("company_id", ""): company
        for company in owner_companies
        if company.get("company_id")
    }
    for company_id in company_docs:
        membership_roles[company_id] = "OWNER"

    team_memberships = await db.team_members.find({"user_id": user_id}, {"_id": 0, "companies": 1, "role": 1}).to_list(200)
    additional_company_ids = set()
    for membership in team_memberships:
        role = normalize_role(membership.get("role"))
        for company_id in membership.get("companies") or []:
            if not company_id:
                continue
            current_role = membership_roles.get(company_id)
            if not current_role or ROLE_RANKS[role] > ROLE_RANKS[current_role]:
                membership_roles[company_id] = role
            if company_id not in company_docs:
                additional_company_ids.add(company_id)

    if additional_company_ids:
        docs = await db.companies.find(
            {"company_id": {"$in": list(additional_company_ids)}},
            {"_id": 0}
        ).to_list(len(additional_company_ids))
        for company in docs:
            company_docs[company["company_id"]] = company

    memberships = [
        serialize_company_access(company_docs[company_id], role)
        for company_id, role in membership_roles.items()
        if company_id in company_docs
    ]
    memberships.sort(key=lambda item: item.get("name", ""))
    return memberships


async def set_active_company_for_session(session_token: str, company_id: Optional[str]):
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"active_company_id": company_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )


async def get_current_session(request: Request) -> dict:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ", 1)[1]
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
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    request.state.session = session
    return session


async def build_auth_payload(user: dict, session: Optional[dict] = None) -> dict:
    memberships = await get_user_company_memberships(user["user_id"])
    membership_map = {entry["company_id"]: entry for entry in memberships}
    active_company_id = (session or {}).get("active_company_id")

    if active_company_id not in membership_map:
        active_company_id = memberships[0]["company_id"] if len(memberships) == 1 else None
        if session and session.get("session_token"):
            await set_active_company_for_session(session["session_token"], active_company_id)

    active_membership = membership_map.get(active_company_id) if active_company_id else None
    role = active_membership.get("role") if active_membership else None
    permissions = permission_payload(role)

    return {
        "user": {**serialize_user(user), "notifications_enabled": bool(user.get("notifications_enabled", True))},
        "companies": memberships,
        "active_company_id": active_company_id,
        "active_company": active_membership,
        "role": role,
        "permissions": permissions,
    }


async def get_company_doc(company_id: str) -> Optional[dict]:
    if not company_id:
        return None
    return await db.companies.find_one({"company_id": company_id}, {"_id": 0})


async def get_companies_list() -> List[dict]:
    companies = await db.companies.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return companies or DEFAULT_COMPANIES


async def ensure_default_companies():
    for company in DEFAULT_COMPANIES:
        await db.companies.update_one(
            {"company_id": company["company_id"]},
            {"$setOnInsert": {
                **company,
                "country": company.get("country", "US"),
                "logo_text": company.get("short_name", company["name"])[:2].upper(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


async def get_current_user(request: Request) -> dict:
    cached_user = getattr(request.state, "current_user", None)
    if cached_user:
        return cached_user
    session = getattr(request.state, "session", None) or await get_current_session(request)
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    request.state.current_user = user
    return user


# ─── AI Import Models ───

class AIUploadCreate(BaseModel):
    file_name: str
    file_type: str  # mime type
    file_size: int
    file_base64: str  # base64 encoded file content

class AIExtractedData(BaseModel):
    detected_type: str  # "invoice", "bill", "expense", "stock_receipt", "quickbooks", "unknown"
    confidence: float  # 0.0 to 1.0
    extracted_fields: dict
    suggestions: Optional[List[str]] = []

class AIUploadConfirm(BaseModel):
    destination: str  # "invoice", "bill", "expense", "stock_receipt"
    data: dict  # The confirmed/edited data to save

# ─── Auth Routes ───

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    if not ALLOW_GOOGLE_OAUTH:
        raise HTTPException(status_code=403, detail="Google OAuth is disabled for this deployment.")
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            os.environ.get("GOOGLE_SESSION_EXCHANGE_URL", "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"),
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
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    set_session_cookie(response, session_token)
    return {
        "user": serialize_user({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
        }),
        "session_token": session_token,
    }


@api_router.post("/auth/register-local")
async def register_local_user(payload: LocalRegisterRequest, response: Response):
    if not LOCAL_AUTH_ENABLED:
        raise HTTPException(status_code=403, detail="Local auth is disabled for this deployment.")

    company_id = (payload.company_id or "").strip()
    company = await get_company_doc(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    email = normalize_email(payload.email)
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    password_hash = pwd_context.hash(payload.password)

    if existing and existing.get("password_hash"):
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": payload.name.strip(), "password_hash": password_hash, "auth_provider": "local"}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": payload.name.strip(),
            "picture": "",
            "password_hash": password_hash,
            "auth_provider": "local",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    existing_member = await db.team_members.find_one({"user_id": user_id, "companies": company_id}, {"_id": 0})
    company_owner_id = company.get("owner_user_id")
    team_member_count = await db.team_members.count_documents({"companies": company_id})

    if existing_member:
        session_token = await create_user_session(response, user_id, company_id)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        auth = await build_auth_payload(user, {"session_token": session_token, "active_company_id": company_id})
        return {
            "status": "approved",
            "role": normalize_role(existing_member.get("role", "STAFF")),
            **auth,
            "session_token": session_token,
        }

    if not company_owner_id and team_member_count == 0:
        member = {
            "member_id": f"member_{uuid.uuid4().hex[:10]}",
            "user_id": user_id,
            "name": payload.name.strip(),
            "email": email,
            "role": "OWNER",
            "companies": [company_id],
            "status": "Active",
            "approved_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.team_members.insert_one(member)
        await db.companies.update_one({"company_id": company_id}, {"$set": {"owner_user_id": user_id}})
        session_token = await create_user_session(response, user_id, company_id)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        auth = await build_auth_payload(user, {"session_token": session_token, "active_company_id": company_id})
        return {
            "status": "owner_bootstrap",
            "role": "OWNER",
            **auth,
            "session_token": session_token,
        }

    existing_pending = await db.pending_registrations.find_one(
        {"email": email, "company_id": company_id, "status": "Pending"},
        {"_id": 0}
    )
    if not existing_pending:
        await db.pending_registrations.insert_one({
            "request_id": f"req_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "name": payload.name.strip(),
            "email": email,
            "role_requested": normalize_role(payload.role_requested),
            "status": "Pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"status": "pending_approval", "message": "Your access request has been sent to the company owner/admin."}


@api_router.post("/auth/login")
async def login_user(payload: AuthLoginRequest, response: Response):
    if not LOCAL_AUTH_ENABLED:
        raise HTTPException(status_code=403, detail="Local auth is disabled for this deployment.")

    email = normalize_email(payload.email)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not pwd_context.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    memberships = await get_user_company_memberships(user["user_id"])
    if not memberships:
        raise HTTPException(status_code=403, detail="No company access has been assigned to this user.")

    active_company_id = memberships[0]["company_id"] if len(memberships) == 1 else None
    session_token = await create_user_session(response, user["user_id"], active_company_id)
    auth = await build_auth_payload(user, {"session_token": session_token, "active_company_id": active_company_id})
    return {"status": "authenticated", **auth, "session_token": session_token}


@api_router.post("/auth/login-local")
async def login_local_user(payload: LocalLoginRequest, response: Response):
    login_payload = AuthLoginRequest(email=payload.email, password=payload.password)
    result = await login_user(login_payload, response)
    requested_company_id = (payload.company_id or "").strip()
    if requested_company_id:
        memberships = {company["company_id"]: company for company in result.get("companies", [])}
        if requested_company_id not in memberships:
            pending = await db.pending_registrations.find_one(
                {"email": normalize_email(payload.email), "company_id": requested_company_id, "status": "Pending"},
                {"_id": 0}
            )
            if pending:
                raise HTTPException(status_code=403, detail="Your access is still pending approval for this company.")
            raise HTTPException(status_code=403, detail="You do not have access to this company yet.")
        await set_active_company_for_session(result["session_token"], requested_company_id)
        result = {**result, "active_company_id": requested_company_id, "active_company": memberships[requested_company_id], "role": memberships[requested_company_id]["role"], "permissions": permission_payload(memberships[requested_company_id]["role"])}
    return result


@api_router.post("/auth/select-company")
async def select_auth_company(payload: AuthSelectCompanyRequest, request: Request, user: dict = Depends(get_current_user)):
    session = getattr(request.state, "session", None) or await get_current_session(request)
    memberships = await get_user_company_memberships(user["user_id"])
    membership_map = {entry["company_id"]: entry for entry in memberships}
    if payload.company_id not in membership_map:
        raise HTTPException(status_code=403, detail="You do not have access to this company.")
    await set_active_company_for_session(session["session_token"], payload.company_id)
    updated_session = {**session, "active_company_id": payload.company_id}
    return await build_auth_payload(user, updated_session)


@api_router.get("/auth/me")
async def get_me(request: Request, user: dict = Depends(get_current_user)):
    session = getattr(request.state, "session", None) or await get_current_session(request)
    return await build_auth_payload(user, session)

@api_router.put("/auth/profile")
async def update_profile(payload: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    update = {
        "name": payload.name.strip(),
        "notifications_enabled": bool(payload.notifications_enabled),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {**UserOut(**updated_user).dict(), "notifications_enabled": bool(updated_user.get("notifications_enabled", True))}

@api_router.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if user.get("auth_provider") != "local" or not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Password change is only available for local login users.")
    if not pwd_context.verify(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len((payload.new_password or "").strip()) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": pwd_context.hash(payload.new_password), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ", 1)[1]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    return {"ok": True}

# ─── Role helpers ───

LEGACY_ROLE_LABELS = {
    "OWNER": "Owner",
    "MANAGER": "Manager",
    "STAFF": "Staff",
}


async def get_user_role_for_company(user_id: str, company_id: str) -> str:
    if not company_id:
        return "STAFF"
    memberships = await get_user_company_memberships(user_id)
    for membership in memberships:
        if membership.get("company_id") == company_id:
            return normalize_role(membership.get("role"))
    return "STAFF"


async def require_role(user: dict, company_id: str, allowed: list):
    role = await get_user_role_for_company(user["user_id"], company_id)
    normalized_allowed = {normalize_role(item) for item in allowed}
    if role not in normalized_allowed:
        readable = ", ".join(sorted(normalized_allowed))
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Role '{role}' cannot perform this action. Required: {readable}.",
        )
    return role


def can_write(role: str) -> bool:
    return normalize_role(role) in {"OWNER", "MANAGER", "STAFF"}


def can_admin(role: str) -> bool:
    return normalize_role(role) == "OWNER"


FEATURE_TOGGLES = {
    "can_edit_price": False,
    "can_delete_invoice": False,
    "can_export_data": False,
    "can_view_profit": False,
}


def default_permissions_config() -> dict:
    return {
        "permissions": [{"module": module, "action": action} for module, actions in PERMISSION_TABLE.items() for action in actions],
        "role_permissions": {
            role: sorted(role_slug_set(role))
            for role in CANONICAL_ROLES
        },
    }


def normalize_permissions_config(source: Optional[dict]) -> dict:
    if not source:
        return default_permissions_config()
    permissions = source.get("permissions") or []
    role_permissions = source.get("role_permissions") or {}
    normalized_role_permissions = {
        role: sorted(set(role_permissions.get(role) or role_slug_set(role)))
        for role in CANONICAL_ROLES
    }
    return {
        "permissions": permissions or [{"module": module, "action": action} for module, actions in PERMISSION_TABLE.items() for action in actions],
        "role_permissions": normalized_role_permissions,
    }


def compute_effective_permissions(role: str, user_id: str, settings_doc: Optional[dict]) -> dict:
    return permission_payload(role)


COMPANY_RESOURCE_MODULES = {
    "customers": "customers",
    "vendors": "vendors",
    "products": "products",
    "inventory": "inventory",
    "stock-receipts": "stock_receipts",
    "stock-transfers": "stock_transfers",
    "shipments": "shipments",
    "invoices": "invoices",
    "estimates": "estimates",
    "sales-orders": "sales_orders",
    "credit-memos": "credit_memos",
    "customer-payments": "payments",
    "vendor-payments": "payments",
    "receive-payment": "payments",
    "pay-vendor": "payments",
    "bills": "bills",
    "purchase-orders": "purchase_orders",
    "expenses": "expenses",
    "bank-accounts": "banking",
    "bank-transactions": "banking",
    "accounts": "accounts",
    "journal-entries": "journal_entries",
    "reports": "reports",
    "audit-logs": "audit",
    "deleted-records": "deleted_records",
    "workflow-alerts": "dashboard",
    "ai-uploads": "ai_import",
    "documents": "ai_import",
    "recurring-templates": "recurring",
    "reminders": "recurring",
    "global-search": "dashboard",
    "receivables": "reports",
    "payables": "reports",
    "general-ledger": "reports",
    "trial-balance": "reports",
    "inventory-valuation": "reports",
    "low-stock-alert": "reports",
}

ACTION_SUFFIX_MAP = {
    "payments": "pay",
    "pay": "pay",
    "post": "post",
    "convert": "convert",
    "convert-to-invoice": "convert",
    "convert-to-bill": "convert",
    "receive": "receive",
    "run-due": "run",
    "run": "run",
    "approve": "edit",
    "reject": "edit",
    "submit": "edit",
    "adjust": "edit",
    "match": "edit",
    "statement-import": "edit",
}


def request_permission_for_company_path(method: str, path_parts: List[str]) -> tuple[Optional[str], Optional[str]]:
    if len(path_parts) < 3 or path_parts[0] != "api" or path_parts[1] != "companies":
        return None, None

    company_id = path_parts[2]
    if len(path_parts) == 3:
        return company_id, "companies.view"

    resource = path_parts[3]
    module = COMPANY_RESOURCE_MODULES.get(resource)
    if not module:
        return company_id, None

    action = None
    if method == "GET":
        action = "view"
    elif method == "POST":
        action = "create"
    elif method in {"PUT", "PATCH"}:
        action = "edit"
    elif method == "DELETE":
        action = "delete"

    if len(path_parts) > 5:
        action = ACTION_SUFFIX_MAP.get(path_parts[5], action)
    elif len(path_parts) > 4:
        action = ACTION_SUFFIX_MAP.get(path_parts[4], action)

    if module == "reports":
        action = "view" if method == "GET" else action

    permission = f"{module}.{action}" if module and action else None
    return company_id, permission


async def ensure_company_request_access(request: Request, user: dict, session: dict):
    path_parts = [part for part in request.url.path.split("/") if part]
    company_id, permission = request_permission_for_company_path(request.method.upper(), path_parts)

    if path_parts[:2] == ["api", "settings"] and len(path_parts) >= 3:
        company_id = path_parts[2]
        permission = f"settings.{'view' if request.method.upper() == 'GET' else 'edit'}"

    if not company_id:
        return

    memberships = await get_user_company_memberships(user["user_id"])
    membership_map = {entry["company_id"]: entry for entry in memberships}
    if company_id not in membership_map:
        raise HTTPException(status_code=403, detail="You do not have access to this company.")

    active_company_id = session.get("active_company_id")
    if active_company_id and active_company_id != company_id:
        raise HTTPException(status_code=403, detail="Active company does not match this request. Switch company first.")

    role = membership_map[company_id]["role"]
    if permission and permission not in role_slug_set(role):
        raise HTTPException(status_code=403, detail=f"Permission denied for {permission}.")


async def ensure_rbac_seed():
    for module, actions in PERMISSION_TABLE.items():
        for action in actions:
            slug = f"{module}.{action}"
            await db.permissions.update_one(
                {"permission_id": slug},
                {"$setOnInsert": {"permission_id": slug, "module": module, "action": action}},
                upsert=True,
            )

    for role in CANONICAL_ROLES:
        await db.role_permissions.update_one(
            {"role": role},
            {"$set": {"role": role, "permissions": sorted(role_slug_set(role)), "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )


SOFT_DELETE_CONFIG = {
    "customers": {"collection": "customers", "id_field": "customer_id", "record_type": "customer", "title_field": "name", "subtitle_field": "company_name"},
    "vendors": {"collection": "vendors", "id_field": "vendor_id", "record_type": "vendor", "title_field": "name", "subtitle_field": "company_name"},
    "invoices": {"collection": "invoices", "id_field": "invoice_id", "record_type": "invoice", "title_field": "invoice_number", "subtitle_field": "customer_name"},
    "estimates": {"collection": "estimates", "id_field": "estimate_id", "record_type": "estimate", "title_field": "estimate_number", "subtitle_field": "customer_name"},
    "sales_orders": {"collection": "sales_orders", "id_field": "sales_order_id", "record_type": "sales_order", "title_field": "sales_order_number", "subtitle_field": "customer_name"},
    "bills": {"collection": "bills", "id_field": "bill_id", "record_type": "bill", "title_field": "bill_number", "subtitle_field": "vendor_name"},
    "expenses": {"collection": "expenses", "id_field": "expense_id", "record_type": "expense", "title_field": "reference_number", "subtitle_field": "vendor_name"},
    "products": {"collection": "products", "id_field": "product_id", "record_type": "product", "title_field": "name", "subtitle_field": "sku"},
    "inventory": {"collection": "inventory", "id_field": "item_id", "record_type": "inventory", "title_field": "product_name", "subtitle_field": "warehouse"},
    "purchase_orders": {"collection": "purchase_orders", "id_field": "purchase_order_id", "record_type": "purchase_order", "title_field": "purchase_order_number", "subtitle_field": "vendor_name"},
    "credit_memos": {"collection": "credit_memos", "id_field": "credit_memo_id", "record_type": "credit_memo", "title_field": "credit_memo_number", "subtitle_field": "customer_name"},
    "stock_transfers": {"collection": "stock_transfers", "id_field": "transfer_id", "record_type": "stock_transfer", "title_field": "product_name", "subtitle_field": "source_warehouse"},
}


def active_company_query(company_id: str, extra: Optional[dict] = None) -> dict:
    query = {"company_id": company_id, "is_deleted": {"$ne": True}}
    if extra:
        query.update(extra)
    return query


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).lower()


def build_customer_payload(data: CustomerCreate) -> dict:
    payload = data.model_dump()
    store_name = (payload.get("store_name") or payload.get("name") or "").strip()
    contact_person = (payload.get("contact_person") or payload.get("company_name") or "").strip()
    return {
        **payload,
        "name": store_name,
        "store_name": store_name,
        "company_name": contact_person,
        "contact_person": contact_person,
        "website": (payload.get("website") or "").strip(),
    }


def build_product_payload(data: ProductCreate) -> dict:
    payload = data.model_dump(exclude={"case_quantity", "stock_on_hand"})
    units_per_case = data.units_per_case if data.units_per_case is not None and data.units_per_case > 0 else (data.case_quantity or 1)
    unit_type = str(payload.get("unit_type") or payload.get("unit") or "PCS").strip().upper() or "PCS"
    if unit_type not in {"PCS", "KG", "BOX", "LB", "PACK", "PKT", "BLK", "EACH", "UNIT"}:
        unit_type = "PCS"
    product_mode = str(payload.get("product_mode") or "CASE").strip().upper() or "CASE"
    if product_mode not in {"CASE", "UNIT", "WEIGHT"}:
        product_mode = "CASE"
    cost_type = str(payload.get("cost_type") or "UNIT").strip().upper() or "UNIT"
    if cost_type not in {"UNIT", "CASE"}:
        cost_type = "UNIT"
    unit_label = str(payload.get("unit_label") or unit_type or "PCS").strip().upper() or "PCS"
    raw_unit_cost = float(
        payload.get("unit_cost")
        if payload.get("unit_cost") is not None
        else payload.get("cost_price", 0)
        or 0
    )
    raw_case_cost = float(payload.get("case_cost", 0) or 0)
    if cost_type == "CASE":
        case_cost = raw_case_cost or round(raw_unit_cost, 2)
        unit_cost = round(case_cost / units_per_case, 4) if units_per_case else 0
    else:
        unit_cost = raw_unit_cost
        case_cost = round(unit_cost * units_per_case, 2)
    unit_price = float(
        payload.get("unit_price")
        if payload.get("unit_price") is not None
        else payload.get("selling_price", 0)
        or 0
    )
    case_price_override = payload.get("case_price_override")
    case_price_override = None if case_price_override in ("", None) else float(case_price_override or 0)
    calculated_case_price = round(unit_price * units_per_case, 2)
    case_price = round(case_price_override, 2) if case_price_override is not None else calculated_case_price
    price_basis = str(payload.get("price_basis") or "").strip().upper()
    default_box_weight_kg = float(payload.get("default_box_weight_kg") or 0)
    default_box_weight_lb = float(payload.get("default_box_weight_lb") or 0)
    default_box_price = float(payload.get("default_box_price") or 0)
    actual_dispatch_weight_lb = float(payload.get("actual_dispatch_weight_lb") or 0)
    actual_dispatch_unit_price = float(payload.get("actual_dispatch_unit_price") or 0)
    final_dispatch_box_price = float(payload.get("final_dispatch_box_price") or 0)
    if product_mode == "WEIGHT":
        if not price_basis:
            price_basis = "LB"
        if default_box_weight_kg <= 0:
            default_box_weight_kg = 20
        if default_box_weight_lb <= 0:
            default_box_weight_lb = 44.10 if abs(default_box_weight_kg - 20) < 0.001 else round(default_box_weight_kg * 2.205, 2)
        default_box_price = round((unit_price or actual_dispatch_unit_price) * default_box_weight_lb, 2) if default_box_price <= 0 else round(default_box_price, 2)
        if actual_dispatch_weight_lb > 0 and actual_dispatch_unit_price > 0:
            final_dispatch_box_price = round(actual_dispatch_weight_lb * actual_dispatch_unit_price, 2)
        case_price = default_box_price
    effective_case_price = default_box_price if product_mode == "WEIGHT" else case_price
    payload["units_per_case"] = units_per_case
    payload["product_type"] = (payload.get("product_type") or "Inventory").strip() or "Inventory"
    payload["unit_type"] = unit_type
    payload["unit_label"] = unit_label
    payload["product_mode"] = product_mode
    payload["cost_type"] = cost_type
    payload["unit"] = unit_type.lower()
    payload["name"] = (payload.get("name") or "").strip()
    payload["description"] = (payload.get("description") or "").strip()
    payload["brand"] = (payload.get("brand") or "").strip()
    payload["packing_text"] = (payload.get("packing_text") or "").strip()
    payload["price_basis"] = price_basis
    payload["size_range"] = (payload.get("size_range") or "").strip().upper()
    payload["sku"] = (payload.get("sku") or "").strip()
    payload["barcode"] = (payload.get("barcode") or "").strip()
    payload["notes"] = (payload.get("notes") or "").strip()
    payload["available_cases"] = float(payload.get("available_cases", 0) or 0)
    payload["cases_on_hand"] = float(payload.get("cases_on_hand", 0) or 0)
    payload["stock_cases"] = float(payload.get("stock_cases", payload["cases_on_hand"]) or 0)
    payload["in_stock"] = bool(payload.get("in_stock", payload["cases_on_hand"] > 0))
    payload["stock_units_on_hand"] = float(payload.get("stock_units_on_hand", payload["cases_on_hand"] * units_per_case) or 0)
    payload["available_stock_units"] = float(payload.get("available_stock_units", payload["available_cases"] * units_per_case) or 0)
    payload["unit_cost"] = unit_cost
    payload["case_cost"] = case_cost
    payload["unit_price"] = unit_price
    payload["selling_price"] = unit_price
    payload["case_price_override"] = case_price_override
    payload["case_price"] = case_price
    payload["effective_case_price"] = effective_case_price
    payload["default_box_weight_kg"] = default_box_weight_kg
    payload["default_box_weight_lb"] = default_box_weight_lb
    payload["default_box_price"] = default_box_price
    payload["actual_dispatch_weight_lb"] = actual_dispatch_weight_lb
    payload["actual_dispatch_unit_price"] = actual_dispatch_unit_price
    payload["final_dispatch_box_price"] = final_dispatch_box_price
    payload["cost_price"] = unit_cost
    return payload


def normalize_pricing_mode(value: str) -> str:
    return "unit" if str(value or "").strip().lower() == "unit" else "case"


def normalize_product_mode(value: str) -> str:
    mode = str(value or "CASE").strip().upper() or "CASE"
    return mode if mode in {"CASE", "UNIT", "WEIGHT"} else "CASE"


async def resolve_product_from_line(company_id: str, item: dict) -> Optional[dict]:
    product_id = (item.get("product_id") or "").strip()
    if product_id:
        product = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})
        if product:
            return product
    product_name = normalize_text(item.get("product") or item.get("description") or "")
    sku = normalize_text(item.get("sku") or "")
    if not product_name and not sku:
        return None
    products = await db.products.find(active_company_query(company_id), {"_id": 0}).to_list(5000)
    return next((
        product for product in products
        if (product_name and normalize_text(product.get("name", "")) == product_name)
        or (sku and normalize_text(product.get("sku", "")) == sku)
        or (product_name and product_name in normalize_text(product.get("name", "")))
    ), None)


async def validate_invoice_line_item(company_id: str, item: dict) -> dict:
    product = await resolve_product_from_line(company_id, item)
    if not product:
        raise HTTPException(status_code=400, detail=f"Invoice item '{item.get('product') or item.get('description') or 'Unknown'}' could not be matched to a product.")

    units_per_case = int(float(item.get("units_per_case") or product.get("units_per_case") or 0))
    if units_per_case <= 0:
        raise HTTPException(status_code=400, detail=f"Product '{product.get('name', 'Unknown')}' must have units per case greater than zero.")

    product_mode = normalize_product_mode(item.get("product_mode") or product.get("product_mode"))
    if product_mode not in {"CASE", "UNIT", "WEIGHT"}:
        raise HTTPException(status_code=400, detail=f"Product '{product.get('name', 'Unknown')}' has an invalid product mode.")

    pricing_mode = normalize_pricing_mode(item.get("pricing_mode"))
    unit_price = float(item.get("unit_price", product.get("unit_price", product.get("selling_price", 0))) or 0)
    case_price = float(item.get("case_price", product.get("case_price", 0)) or 0)
    if pricing_mode == "case" and case_price <= 0:
        raise HTTPException(status_code=400, detail=f"Product '{product.get('name', 'Unknown')}' must have a case price before invoicing.")
    if pricing_mode == "unit" and unit_price <= 0:
        raise HTTPException(status_code=400, detail=f"Product '{product.get('name', 'Unknown')}' must have a unit price before invoicing.")

    return {
        "product": product,
        "units_per_case": units_per_case,
        "product_mode": product_mode,
        "pricing_mode": pricing_mode,
        "unit_price": unit_price,
        "case_price": case_price,
    }


def calculate_invoice_item_cost(item: dict, product: dict) -> float:
    pricing_mode = normalize_pricing_mode(item.get("pricing_mode"))
    qty = float(item.get("quantity", 0) or 0)
    unit_cost = float(item.get("unit_cost", product.get("unit_cost", product.get("cost_price", 0))) or 0)
    case_cost = float(item.get("case_cost_cost", item.get("case_cost", product.get("case_cost", 0))) or 0)
    if pricing_mode == "case":
        resolved_case_cost = case_cost or round(unit_cost * float(product.get("units_per_case", 1) or 1), 2)
        return round(qty * resolved_case_cost, 2)
    return round(qty * unit_cost, 2)


def calculate_invoice_stock_delta(item: dict, product: dict) -> tuple[float, float]:
    qty = float(item.get("quantity", 0) or 0)
    units_per_case = float(item.get("units_per_case", product.get("units_per_case", 1)) or 1)
    pricing_mode = normalize_pricing_mode(item.get("pricing_mode"))
    if pricing_mode == "case":
        stock_units = qty * units_per_case
        case_delta = qty
    else:
        stock_units = qty
        case_delta = qty / units_per_case if units_per_case else 0
    return round(stock_units, 4), round(case_delta, 4)


async def reverse_invoice_inventory(company_id: str, invoice: dict):
    for movement in invoice.get("inventory_movements", []) or []:
        product_id = movement.get("product_id")
        item_id = movement.get("item_id")
        stock_units = float(movement.get("stock_units", 0) or 0)
        case_delta = float(movement.get("case_delta", 0) or 0)
        cost_total = float(movement.get("cost_total", 0) or 0)
        if item_id:
            await db.inventory.update_one(
                active_company_query(company_id, {"item_id": item_id}),
                {"$inc": {
                    "stock_on_hand": stock_units,
                    "available_stock": stock_units,
                    "unit_stock_on_hand": stock_units,
                    "available_units": stock_units,
                    "inventory_value": cost_total,
                }}
            )
        if product_id:
            await db.products.update_one(
                active_company_query(company_id, {"product_id": product_id}),
                {"$inc": {
                    "cases_on_hand": case_delta,
                    "available_cases": case_delta,
                    "stock_units_on_hand": stock_units,
                    "available_stock_units": stock_units,
                }}
            )


async def sync_invoice_inventory(company_id: str, invoice: dict, user_id: str) -> dict:
    if invoice.get("inventory_posted") and invoice.get("inventory_movements"):
        await reverse_invoice_inventory(company_id, invoice)

    should_post = invoice.get("status") not in {"Draft", "Cancelled"}
    if not should_post:
        await db.invoices.update_one(
            active_company_query(company_id, {"invoice_id": invoice["invoice_id"]}),
            {"$set": {"inventory_posted": False, "inventory_movements": []}}
        )
        invoice["inventory_posted"] = False
        invoice["inventory_movements"] = []
        return invoice

    inventory_movements = []
    for item in invoice.get("items", []) or []:
        validated = await validate_invoice_line_item(company_id, item)
        product = validated["product"]
        stock_units, case_delta = calculate_invoice_stock_delta(item, product)
        if stock_units <= 0:
            continue
        inventory_item = await db.inventory.find_one(
            active_company_query(company_id, {"product_id": product["product_id"], "warehouse": invoice.get("warehouse") or "Main Warehouse"}),
            {"_id": 0},
        )
        if inventory_item:
            unit_cost = float(inventory_item.get("unit_cost", product.get("unit_cost", product.get("cost_price", 0))) or 0)
            cost_total = round(unit_cost * stock_units, 2)
            await db.inventory.update_one(
                active_company_query(company_id, {"item_id": inventory_item["item_id"]}),
                {"$inc": {
                    "stock_on_hand": -stock_units,
                    "available_stock": -stock_units,
                    "unit_stock_on_hand": -stock_units,
                    "available_units": -stock_units,
                    "inventory_value": -cost_total,
                },
                 "$push": {"movement_history": {
                    "movement_id": f"mov_{uuid.uuid4().hex[:8]}",
                    "type": "invoice_sale",
                    "quantity": -stock_units,
                    "reason": f"Invoice {invoice.get('invoice_number', invoice.get('invoice_id', ''))}",
                    "reference": invoice.get("invoice_id", ""),
                    "date": datetime.now(timezone.utc).isoformat(),
                    "by": user_id,
                 }}}
            )
        else:
            unit_cost = float(product.get("unit_cost", product.get("cost_price", 0)) or 0)
            cost_total = round(unit_cost * stock_units, 2)
        await db.products.update_one(
            active_company_query(company_id, {"product_id": product["product_id"]}),
            {"$inc": {
                "cases_on_hand": -case_delta,
                "available_cases": -case_delta,
                "stock_units_on_hand": -stock_units,
                "available_stock_units": -stock_units,
            }}
        )
        inventory_movements.append({
            "product_id": product["product_id"],
            "item_id": inventory_item.get("item_id") if inventory_item else "",
            "stock_units": stock_units,
            "case_delta": case_delta,
            "cost_total": cost_total,
            "pricing_mode": normalize_pricing_mode(item.get("pricing_mode")),
        })

    await db.invoices.update_one(
        active_company_query(company_id, {"invoice_id": invoice["invoice_id"]}),
        {"$set": {"inventory_posted": True, "inventory_movements": inventory_movements}}
    )
    invoice["inventory_posted"] = True
    invoice["inventory_movements"] = inventory_movements
    return invoice


async def ensure_receipt_shipment_record(company_id: str, receipt: dict, user_id: str) -> Optional[str]:
    container_number = (receipt.get("container_number") or "").strip()
    if not container_number:
        return None
    shipment = await db.shipments.find_one(
        active_company_query(company_id, {"container_number": container_number}),
        {"_id": 0},
    )
    payload = {
        "shipment_name": receipt.get("reference") or f"Container {container_number}",
        "container_number": container_number,
        "supplier_name": receipt.get("supplier_name") or receipt.get("vendor_name") or "",
        "vendor_id": receipt.get("vendor_id") or "",
        "country": receipt.get("country") or "",
        "etd": receipt.get("shipment_date") or "",
        "eta": receipt.get("eta") or "",
        "customs_status": receipt.get("customs_status") or "Pending",
        "status": "Completed" if receipt.get("status") == "Posted" else "Pending",
        "reference": receipt.get("invoice_number") or receipt.get("reference") or "",
        "notes": receipt.get("notes") or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user_id,
    }
    if shipment:
        await db.shipments.update_one(active_company_query(company_id, {"shipment_id": shipment["shipment_id"]}), {"$set": payload})
        return shipment["shipment_id"]
    shipment_id = f"shp_{uuid.uuid4().hex[:10]}"
    await db.shipments.insert_one({
        "shipment_id": shipment_id,
        "company_id": company_id,
        **payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id,
        "activity_timeline": [],
    })
    return shipment_id


async def link_receipt_documents(company_id: str, receipt: dict, posted_items: list, shipment_id: Optional[str], user_id: str):
    upload_id = receipt.get("source_upload_id")
    if not upload_id:
        return
    upload = await db.ai_uploads.find_one({"upload_id": upload_id, "company_id": company_id}, {"_id": 0})
    if not upload:
        return
    existing_doc = await db.linked_documents.find_one({"company_id": company_id, "entity_type": "shipment", "entity_id": shipment_id or "", "file_name": upload.get("file_name", "")}, {"_id": 0})
    if shipment_id and not existing_doc:
        await db.linked_documents.insert_one({
            "document_id": f"doc_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "title": upload.get("file_name", "Shipment document"),
            "document_type": "Packing List",
            "entity_type": "shipment",
            "entity_id": shipment_id,
            "vendor_id": receipt.get("vendor_id", ""),
            "product_id": "",
            "file_name": upload.get("file_name", ""),
            "file_type": upload.get("file_type", ""),
            "file_base64": upload.get("file_base64", ""),
            "notes": f"Linked from AI inventory receiving upload {upload_id}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user_id,
        })


async def resolve_receipt_item(company_id: str, item: dict, warehouse: str = "Main Warehouse") -> dict:
    resolved = {**item}
    candidate_inventory = None
    candidate_product = None

    item_id = (item.get("item_id") or "").strip()
    product_id = (item.get("product_id") or "").strip()
    product_name = (item.get("product_name") or item.get("description") or item.get("name") or "").strip()
    sku = (item.get("sku") or "").strip()

    if item_id:
        candidate_inventory = await db.inventory.find_one(active_company_query(company_id, {"item_id": item_id}), {"_id": 0})
        if candidate_inventory:
            product_id = candidate_inventory.get("product_id", product_id)

    if not candidate_inventory and product_id:
        candidate_inventory = await db.inventory.find_one(active_company_query(company_id, {"product_id": product_id, "warehouse": warehouse}), {"_id": 0})

    if product_id:
        candidate_product = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})

    if not candidate_product and sku:
        candidate_product = await db.products.find_one(active_company_query(company_id, {"sku": sku}), {"_id": 0})

    if not candidate_product and product_name:
        products = await db.products.find(active_company_query(company_id), {"_id": 0}).to_list(5000)
        needle = normalize_text(product_name)
        candidate_product = next(
            (
                product
                for product in products
                if needle and (
                    normalize_text(product.get("name", "")) == needle
                    or normalize_text(product.get("sku", "")) == needle
                    or needle in normalize_text(product.get("name", ""))
                )
            ),
            None,
        )

    if candidate_product and not candidate_inventory:
        candidate_inventory = await db.inventory.find_one(
            active_company_query(company_id, {"product_id": candidate_product["product_id"], "warehouse": warehouse}),
            {"_id": 0},
        )

    if candidate_product:
        resolved["product_id"] = candidate_product["product_id"]
        resolved["product_name"] = candidate_product.get("name") or product_name
        resolved["sku"] = candidate_product.get("sku", sku)

    if candidate_inventory:
        resolved["item_id"] = candidate_inventory["item_id"]
        resolved["product_name"] = candidate_inventory.get("product_name") or resolved.get("product_name") or product_name
        resolved["warehouse"] = candidate_inventory.get("warehouse", warehouse)

    if candidate_product or candidate_inventory:
        resolved["match_status"] = "matched"
    else:
        resolved["match_status"] = "draft_product"
        resolved["draft_product"] = {
            "name": product_name or "Draft Product",
            "description": (item.get("description") or "").strip(),
            "sku": sku,
            "product_type": "Inventory",
            "product_mode": "CASE",
            "cost_type": "CASE",
            "cost_price": float(item.get("unit_cost", item.get("cost", 0)) or 0),
            "unit_cost": 0,
            "case_cost": float(item.get("unit_cost", item.get("cost", 0)) or 0),
            "selling_price": 0,
            "cases_on_hand": 0,
            "available_cases": 0,
        }
        resolved["warehouse"] = warehouse

    units_per_case = int(float(
        resolved.get("units_per_case")
        or (candidate_product or {}).get("units_per_case", 1)
        or ((resolved.get("draft_product") or {}).get("units_per_case", 1))
        or 1
    ) or 1)
    cartons = float(item.get("cartons", item.get("ctns", item.get("cases", item.get("quantity", 0)))) or 0)
    net_weight = float(item.get("net_weight", item.get("kgs", item.get("weight", 0))) or 0)
    quantity = cartons if cartons > 0 else float(item.get("quantity", 0) or 0)
    product_mode = normalize_product_mode((candidate_product or {}).get("product_mode") or (resolved.get("draft_product") or {}).get("product_mode") or "CASE")
    if product_mode == "WEIGHT" and net_weight > 0:
        quantity = net_weight
    unit_cost = float(item.get("unit_cost", item.get("cost", item.get("case_cost", 0))) or 0)
    resolved["product_mode"] = product_mode
    resolved["units_per_case"] = units_per_case
    resolved["cartons"] = cartons
    resolved["net_weight"] = net_weight
    resolved["quantity"] = quantity
    resolved["unit_cost"] = unit_cost
    resolved["stock_qty"] = quantity
    resolved["line_total"] = round(quantity * unit_cost, 2)
    return resolved


async def prepare_receipt_items(company_id: str, items: list, warehouse: str = "Main Warehouse") -> list:
    prepared = []
    for item in items or []:
        if isinstance(item, BaseModel):
            row = item.model_dump()
        else:
            row = dict(item or {})
        prepared.append(await resolve_receipt_item(company_id, row, warehouse))
    return prepared


async def post_stock_receipt_to_inventory(company_id: str, receipt: dict, user_id: str) -> dict:
    if receipt.get("status") == "Posted":
        return receipt

    warehouse = receipt.get("warehouse") or "Main Warehouse"
    posted_items = []

    for item in receipt.get("items", []):
        resolved = await resolve_receipt_item(company_id, item, warehouse)
        quantity = float(resolved.get("quantity", 0) or 0)
        if quantity <= 0:
            posted_items.append(resolved)
            continue

        product = None
        if resolved.get("product_id"):
            product = await db.products.find_one(active_company_query(company_id, {"product_id": resolved["product_id"]}), {"_id": 0})

        if not product:
            draft_product = resolved.get("draft_product") or {}
            product = {
                "product_id": f"prod_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "name": draft_product.get("name") or resolved.get("product_name") or "Draft Product",
                "description": draft_product.get("description", ""),
                "product_type": draft_product.get("product_type", "Inventory"),
                "category": draft_product.get("category", ""),
                "unit": draft_product.get("unit", "case"),
                "unit_type": draft_product.get("unit_type", "PCS"),
                "product_mode": draft_product.get("product_mode", "CASE"),
                "cost_type": draft_product.get("cost_type", "CASE"),
                "units_per_case": int(draft_product.get("units_per_case", resolved.get("units_per_case", 1)) or 1),
                "cost_price": float(draft_product.get("cost_price", resolved.get("unit_cost", 0)) or 0),
                "unit_cost": float(draft_product.get("unit_cost", 0) or 0),
                "case_cost": float(draft_product.get("case_cost", resolved.get("unit_cost", 0)) or 0),
                "selling_price": float(draft_product.get("selling_price", 0) or 0),
                "case_price": float(draft_product.get("case_price", 0) or 0),
                "cases_on_hand": 0,
                "available_cases": 0,
                "stock_units_on_hand": 0,
                "available_stock_units": 0,
                "weight_info": draft_product.get("weight_info", ""),
                "sku": draft_product.get("sku", resolved.get("sku", "")) or f"SKU-{uuid.uuid4().hex[:6].upper()}",
                "tax_code": draft_product.get("tax_code", "STANDARD"),
                "tax_rate": float(draft_product.get("tax_rate", 0) or 0),
                "status": "Draft",
                "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user_id,
                "created_from_receipt_id": receipt.get("receipt_id", ""),
            }
            await db.products.insert_one(product)

        inventory_item = None
        if resolved.get("item_id"):
            inventory_item = await db.inventory.find_one(active_company_query(company_id, {"item_id": resolved["item_id"]}), {"_id": 0})

        if not inventory_item:
            inventory_item = await db.inventory.find_one(
                active_company_query(company_id, {"product_id": product["product_id"], "warehouse": warehouse}),
                {"_id": 0},
            )

        if not inventory_item:
            inventory_item = {
                "item_id": f"itm_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "product_id": product["product_id"],
                "sku": product.get("sku", ""),
                "product_name": product.get("name", ""),
                "category": product.get("category", ""),
                "warehouse": warehouse,
                "stock_on_hand": 0,
                "reserved_stock": 0,
                "available_stock": 0,
                "unit_stock_on_hand": 0,
                "available_units": 0,
                "unit_cost": float(resolved.get("unit_cost", product.get("cost_price", 0)) or 0),
                "sales_price": float(product.get("selling_price", 0) or 0),
                "unit": str(product.get("unit_type", product.get("unit", "pcs"))).lower(),
                "reorder_point": 10,
                "status": "Active",
                "movement_history": [],
                "inventory_value": 0,
                "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user_id,
            }
            await db.inventory.insert_one(inventory_item)

        units_per_case = float(product.get("units_per_case", resolved.get("units_per_case", 1)) or 1)
        stock_units = quantity * units_per_case if normalize_product_mode(product.get("product_mode")) == "CASE" else quantity
        movement = {
            "movement_id": f"mov_{uuid.uuid4().hex[:8]}",
            "type": "receive",
            "quantity": quantity,
            "stock_units": stock_units,
            "reason": f"Stock Receipt {receipt.get('receipt_id', '')}",
            "reference": receipt.get("reference", ""),
            "date": datetime.now(timezone.utc).isoformat(),
            "by": user_id,
        }

        await db.inventory.update_one(
            active_company_query(company_id, {"item_id": inventory_item["item_id"]}),
            {
                "$inc": {
                    "stock_on_hand": stock_units,
                    "available_stock": stock_units,
                    "unit_stock_on_hand": stock_units,
                    "available_units": stock_units,
                    "inventory_value": stock_units * float(resolved.get("unit_cost", inventory_item.get("unit_cost", 0)) or 0),
                },
                "$set": {
                    "product_name": product.get("name", inventory_item.get("product_name", "")),
                    "sku": product.get("sku", inventory_item.get("sku", "")),
                    "unit_cost": float(resolved.get("unit_cost", inventory_item.get("unit_cost", 0)) or 0),
                    "sales_price": float(product.get("selling_price", 0) or 0),
                },
                "$push": {"movement_history": movement},
            },
        )
        await db.products.update_one(
            active_company_query(company_id, {"product_id": product["product_id"]}),
            {
                "$inc": {
                    "cases_on_hand": quantity,
                    "available_cases": quantity,
                    "stock_units_on_hand": stock_units,
                    "available_stock_units": stock_units,
                },
                "$set": {
                    "cost_price": float(resolved.get("unit_cost", product.get("cost_price", 0)) or 0),
                    "unit_cost": float(resolved.get("unit_cost", product.get("unit_cost", 0)) or 0),
                    "case_cost": round(float(resolved.get("unit_cost", product.get("unit_cost", 0)) or 0) * units_per_case, 2),
                    "status": "Active" if product.get("status") == "Draft" else product.get("status", "Active"),
                },
            },
        )

        resolved["item_id"] = inventory_item["item_id"]
        resolved["product_id"] = product["product_id"]
        resolved["product_name"] = product.get("name", resolved.get("product_name"))
        resolved["sku"] = product.get("sku", resolved.get("sku", ""))
        resolved["posted_quantity"] = quantity
        resolved["posted_stock_units"] = stock_units
        posted_items.append(resolved)

    shipment_id = await ensure_receipt_shipment_record(company_id, receipt, user_id)
    await link_receipt_documents(company_id, receipt, posted_items, shipment_id, user_id)
    await db.stock_receipts.update_one(
        {"company_id": company_id, "receipt_id": receipt["receipt_id"]},
        {
            "$set": {
                "items": posted_items,
                "status": "Posted",
                "shipment_id": shipment_id or receipt.get("shipment_id", ""),
                "posted_at": datetime.now(timezone.utc).isoformat(),
                "posted_by": user_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user_id,
            }
        },
    )
    updated = await db.stock_receipts.find_one({"company_id": company_id, "receipt_id": receipt["receipt_id"]}, {"_id": 0})
    return updated or receipt


def product_line_matches(product: dict, item: dict) -> bool:
    product_id = (product.get("product_id") or "").strip()
    item_product_id = (item.get("product_id") or "").strip()
    if product_id and item_product_id and product_id == item_product_id:
        return True

    product_name = normalize_text(product.get("name", ""))
    product_sku = normalize_text(product.get("sku", ""))
    item_name = normalize_text(
        item.get("product")
        or item.get("product_name")
        or item.get("description")
        or item.get("name")
        or ""
    )
    item_sku = normalize_text(item.get("sku", ""))

    if product_sku and item_sku and product_sku == item_sku:
        return True
    if product_name and item_name and (product_name == item_name or product_name in item_name or item_name in product_name):
        return True
    return False


def sort_date_value(value: str) -> str:
    return str(value or "")


def round_report_quantity(value: float) -> float:
    return round(float(value or 0), 4)


async def build_product_quick_report(
    company_id: str,
    product: dict,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entry_type: str = "all",
) -> List[dict]:
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    bills = await db.bills.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    stock_receipts = await db.stock_receipts.find(active_company_query(company_id), {"_id": 0}).to_list(1000)

    report_rows = []

    for invoice in invoices:
        for item in invoice.get("items", []) or []:
            if not product_line_matches(product, item):
                continue
            _, case_delta = calculate_invoice_stock_delta(item, product)
            qty = -abs(round_report_quantity(case_delta))
            report_rows.append(
                {
                    "date": invoice.get("invoice_date") or "",
                    "type": "Invoice",
                    "entry_type": "sales",
                    "name": invoice.get("customer_name") or "",
                    "doc_no": invoice.get("invoice_number") or invoice.get("invoice_id") or "",
                    "qty": qty,
                    "link": f"/sales/{invoice.get('invoice_id', '')}",
                    "record_id": invoice.get("invoice_id", ""),
                }
            )

    for bill in bills:
        for item in bill.get("items", []) or []:
            if not isinstance(item, dict) or not product_line_matches(product, item):
                continue
            qty = round_report_quantity(item.get("quantity", 0))
            if qty <= 0:
                continue
            report_rows.append(
                {
                    "date": bill.get("bill_date") or "",
                    "type": "Bill",
                    "entry_type": "purchase",
                    "name": bill.get("vendor_name") or "",
                    "doc_no": bill.get("bill_number") or bill.get("bill_id") or "",
                    "qty": qty,
                    "link": f"/bills/{bill.get('bill_id', '')}",
                    "record_id": bill.get("bill_id", ""),
                }
            )

    for receipt in stock_receipts:
        if receipt.get("status") != "Posted":
            continue
        for item in receipt.get("items", []) or []:
            if not isinstance(item, dict) or not product_line_matches(product, item):
                continue
            qty = round_report_quantity(item.get("posted_quantity", item.get("quantity", 0)))
            if qty <= 0:
                continue
            report_rows.append(
                {
                    "date": receipt.get("receive_date") or "",
                    "type": "Receive Stock",
                    "entry_type": "purchase",
                    "name": receipt.get("vendor_name") or receipt.get("supplier_name") or "",
                    "doc_no": receipt.get("invoice_number") or receipt.get("reference") or receipt.get("receipt_id") or "",
                    "qty": qty,
                    "link": f"/receive-stock/{receipt.get('receipt_id', '')}",
                    "record_id": receipt.get("receipt_id", ""),
                }
            )

    report_rows.sort(key=lambda row: (sort_date_value(row.get("date")), row.get("record_id", ""), row.get("type", "")))

    running_balance = 0.0
    filtered_rows = []
    normalized_type = str(entry_type or "all").strip().lower()
    for row in report_rows:
        running_balance = round_report_quantity(running_balance + float(row.get("qty", 0) or 0))
        row["balance"] = running_balance
        row_date = row.get("date") or ""
        if start_date and row_date and row_date < start_date:
            continue
        if end_date and row_date and row_date > end_date:
            continue
        if normalized_type == "sales" and row.get("entry_type") != "sales":
            continue
        if normalized_type == "purchase" and row.get("entry_type") != "purchase":
            continue
        filtered_rows.append(row)
    return filtered_rows


async def build_live_product_balance_map(company_id: str, products: List[dict]) -> dict:
    balances = {
        product.get("product_id", ""): {
            "cases_on_hand": 0.0,
            "stock_units_on_hand": 0.0,
        }
        for product in products
        if product.get("product_id")
    }
    if not balances:
        return balances

    stock_receipts = await db.stock_receipts.find(
        active_company_query(company_id, {"status": "Posted"}),
        {"_id": 0, "items": 1},
    ).to_list(5000)
    invoices = await db.invoices.find(
        active_company_query(company_id, {"status": {"$nin": ["Cancelled", "Void", "Draft"]}}),
        {"_id": 0, "items": 1},
    ).to_list(5000)

    for receipt in stock_receipts:
        for item in receipt.get("items", []) or []:
            if not isinstance(item, dict):
                continue
            for product in products:
                product_id = product.get("product_id", "")
                if not product_id or not product_line_matches(product, item):
                    continue
                case_qty = round_report_quantity(item.get("posted_quantity", item.get("quantity", 0)))
                if case_qty <= 0:
                    continue
                units_per_case = float(item.get("units_per_case", product.get("units_per_case", 1)) or 1)
                balances[product_id]["cases_on_hand"] = round_report_quantity(balances[product_id]["cases_on_hand"] + case_qty)
                balances[product_id]["stock_units_on_hand"] = round_report_quantity(
                    balances[product_id]["stock_units_on_hand"] + (case_qty * units_per_case)
                )

    for invoice in invoices:
        for item in invoice.get("items", []) or []:
            if not isinstance(item, dict):
                continue
            for product in products:
                product_id = product.get("product_id", "")
                if not product_id or not product_line_matches(product, item):
                    continue
                stock_units, case_delta = calculate_invoice_stock_delta(item, product)
                balances[product_id]["cases_on_hand"] = round_report_quantity(balances[product_id]["cases_on_hand"] - case_delta)
                balances[product_id]["stock_units_on_hand"] = round_report_quantity(
                    balances[product_id]["stock_units_on_hand"] - stock_units
                )

    return balances


async def soft_delete_company_record(company_id: str, config_key: str, record_id: str, user: dict) -> dict:
    config = SOFT_DELETE_CONFIG[config_key]
    collection = getattr(db, config["collection"])
    query = active_company_query(company_id, {config["id_field"]: record_id})
    record = await collection.find_one(query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail=f"{config['record_type'].replace('_', ' ').title()} not found")

    title = record.get(config["title_field"]) or record.get(config["id_field"]) or record_id
    await collection.update_one(
        query,
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": user["user_id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user["user_id"],
            }
        },
    )
    await write_audit_entry(
        build_activity_entry(
            company_id,
            user["user_id"],
            config["record_type"],
            record_id,
            "delete",
            f"Soft deleted {config['record_type'].replace('_', ' ')} {title}",
            {"soft_delete": True},
        )
    )
    return {"ok": True}


async def soft_delete_company_records(company_id: str, config_key: str, record_ids: List[str], user: dict) -> dict:
    config = SOFT_DELETE_CONFIG[config_key]
    collection = getattr(db, config["collection"])
    clean_ids = [str(record_id).strip() for record_id in record_ids if str(record_id).strip()]
    unique_ids = list(dict.fromkeys(clean_ids))
    if not unique_ids:
        raise HTTPException(status_code=400, detail="No records selected")

    query = active_company_query(company_id, {config["id_field"]: {"$in": unique_ids}})
    records = await collection.find(query, {"_id": 0, config["id_field"]: 1, config["title_field"]: 1}).to_list(len(unique_ids))
    found_ids = {record.get(config["id_field"], "") for record in records}
    missing_ids = [record_id for record_id in unique_ids if record_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"{config['record_type'].replace('_', ' ').title()} not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    result = await collection.update_many(
        query,
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": now_iso,
                "deleted_by": user["user_id"],
                "updated_at": now_iso,
                "updated_by": user["user_id"],
            }
        },
    )
    await write_audit_entry(
        build_activity_entry(
            company_id,
            user["user_id"],
            config["record_type"],
            ",".join(unique_ids),
            "bulk_delete",
            f"Soft deleted {result.modified_count} {config['record_type'].replace('_', ' ')} records",
            {"soft_delete": True, "record_ids": unique_ids},
        )
    )
    return {"ok": True, "deleted_count": result.modified_count}


def default_invoice_layout() -> dict:
    return {
        "accentColor": "#b91c1c",
        "compactPrint": False,
        "showBrandLogos": True,
        "emphasizeTotals": True,
        "fontFamily": "Times New Roman",
        "bodyFontSize": 7,
        "lineCount": 34,
        "logoScale": 100,
        "sections": [
            {"id": "header", "visible": True},
            {"id": "meta", "visible": False},
            {"id": "address", "visible": True},
            {"id": "brands", "visible": True},
            {"id": "items", "visible": True},
            {"id": "terms", "visible": True},
            {"id": "totals", "visible": True},
            {"id": "signature", "visible": True},
        ],
    }


def build_default_settings(company_id: str) -> dict:
    default_ai_provider = AI_PROVIDER or ("ollama" if OLLAMA_MODEL or AI_BASE_URL else ("openai" if llm_api_key() else "openai_compatible"))
    default_ai_base_url = AI_BASE_URL or (OLLAMA_BASE_URL if default_ai_provider in {"ollama", "openai_compatible"} and (OLLAMA_MODEL or AI_BASE_URL) else "")
    return {
        "company_id": company_id,
        "invoice_prefix": "INV",
        "invoice_starting_number": 1001,
        "sales_order_prefix": "SO",
        "sales_order_prefix_starting_number": 1001,
        "purchase_order_prefix": "PO",
        "purchase_order_prefix_starting_number": 1001,
        "bill_prefix": "BILL",
        "bill_prefix_starting_number": 1001,
        "default_terms": "Net 30",
        "tax_rate": 8.0,
        "currency": "USD",
        "logo_url": "",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "company_website": "",
        "fiscal_year_start": "01-01",
        "notification_email": "",
        "invoice_due_reminder_days": 3,
        "bill_due_reminder_days": 3,
        "overdue_reminder_days": 1,
        "recurring_auto_run": True,
        "invoice_footer_notes": "Thank you for your business!",
        "invoice_terms_text": "All payments must be paid within 14 days after delivery.",
        "ai_provider": default_ai_provider,
        "ai_model": AI_MODEL or OLLAMA_MODEL or OPENAI_MODEL,
        "ai_base_url": default_ai_base_url,
        "ai_enabled_tools": ["invoices", "payments", "inventory", "customers", "vendors", "reports"],
        "ai_voice_enabled": False,
        "ai_text_first_mode": True,
        "invoice_layout": default_invoice_layout(),
        "permissions": default_permissions_config(),
    }


@api_router.get("/auth/me-with-role")
async def get_me_with_role(request: Request, company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    session = getattr(request.state, "session", None) or await get_current_session(request)
    payload = await build_auth_payload(user, session)
    target_company_id = company_id or payload.get("active_company_id")
    membership = next((entry for entry in payload.get("companies", []) if entry.get("company_id") == target_company_id), None)
    settings_doc = await get_company_settings_doc(target_company_id) if target_company_id else {}
    member = await db.team_members.find_one(
        {"user_id": user["user_id"], "companies": target_company_id},
        {"_id": 0, "member_id": 1}
    ) if target_company_id else None
    return {
        "user": payload["user"],
        "role": membership.get("role") if membership else payload.get("role"),
        "company_id": target_company_id,
        "company": ({**membership, "logo_url": settings_doc.get("logo_url", "")} if membership else None),
        "member_id": member.get("member_id") if member else None,
        "permissions": permission_payload(membership.get("role") if membership else payload.get("role")),
        "companies": payload.get("companies", []),
        "active_company_id": payload.get("active_company_id"),
    }



# ─── Companies Routes ───

DEFAULT_COMPANIES = [
    {"company_id": "ckfrozen", "name": "CK Frozen Fish & Food Inc.", "short_name": "CK Frozen", "type": "Wholesale Import & Distribution", "currency": "USD"},
    {"company_id": "haor", "name": "Haor Heritage Inc.", "short_name": "Haor Heritage", "type": "Wholesale & Retail", "currency": "USD"},
    {"company_id": "deshi", "name": "Deshi Distributors LLC", "short_name": "Deshi Dist.", "type": "Distribution", "currency": "USD"},
    {"company_id": "ckcanada", "name": "CK Frozen Fish & Food Canada Inc.", "short_name": "CK Canada", "type": "Import & Distribution", "currency": "CAD"},
]

@api_router.get("/companies")
async def get_companies():
    return await get_companies_list()

@api_router.get("/companies/{company_id}")
async def get_company(company_id: str):
    for c in await get_companies_list():
        if c["company_id"] == company_id:
            return c
    raise HTTPException(status_code=404, detail="Company not found")

# ─── Customers Routes ───

@api_router.get("/companies/{company_id}/customers")
async def get_customers(company_id: str, user: dict = Depends(get_current_user)):
    customers = await db.customers.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    return customers

@api_router.post("/companies/{company_id}/customers", status_code=201)
async def create_customer(company_id: str, data: CustomerCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    cust = {
        "customer_id": f"cust_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **build_customer_payload(data),
        "open_balance": 0,
        "total_invoiced": 0,
        "last_invoice_date": None,
        "status": "Active",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.customers.insert_one(cust)
    cust.pop("_id", None)
    return cust

@api_router.get("/companies/{company_id}/customers/{customer_id}")
async def get_customer(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    c = await db.customers.find_one(active_company_query(company_id, {"customer_id": customer_id}), {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@api_router.put("/companies/{company_id}/customers/{customer_id}")
async def update_customer(company_id: str, customer_id: str, data: CustomerCreate, user: dict = Depends(get_current_user)):
    result = await db.customers.update_one(
        active_company_query(company_id, {"customer_id": customer_id}),
        {"$set": build_customer_payload(data)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    updated = await db.customers.find_one(active_company_query(company_id, {"customer_id": customer_id}), {"_id": 0})
    return updated

@api_router.delete("/companies/{company_id}/customers/{customer_id}")
async def delete_customer(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "customers", customer_id, user)

# ─── Vendors Routes ───

@api_router.get("/companies/{company_id}/vendors")
async def get_vendors(company_id: str, user: dict = Depends(get_current_user)):
    vendors = await db.vendors.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    return vendors

@api_router.post("/companies/{company_id}/vendors", status_code=201)
async def create_vendor(company_id: str, data: VendorCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    vendor = {
        "vendor_id": f"vnd_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "payable_balance": 0,
        "total_billed": 0,
        "bill_count": 0,
        "status": "Active",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.vendors.insert_one(vendor)
    vendor.pop("_id", None)
    return vendor

@api_router.get("/companies/{company_id}/vendors/{vendor_id}")
async def get_vendor(company_id: str, vendor_id: str, user: dict = Depends(get_current_user)):
    v = await db.vendors.find_one(active_company_query(company_id, {"vendor_id": vendor_id}), {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v

@api_router.put("/companies/{company_id}/vendors/{vendor_id}")
async def update_vendor(company_id: str, vendor_id: str, data: VendorCreate, user: dict = Depends(get_current_user)):
    result = await db.vendors.update_one(
        active_company_query(company_id, {"vendor_id": vendor_id}),
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    updated = await db.vendors.find_one(active_company_query(company_id, {"vendor_id": vendor_id}), {"_id": 0})
    return updated

@api_router.delete("/companies/{company_id}/vendors/{vendor_id}")
async def delete_vendor(company_id: str, vendor_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "vendors", vendor_id, user)

# ─── Invoices Routes ───

@api_router.get("/companies/{company_id}/invoices")
async def get_invoices(company_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if status:
        query["status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return invoices

@api_router.post("/companies/{company_id}/invoices", status_code=201)
async def create_invoice(company_id: str, data: InvoiceCreate, user: dict = Depends(get_current_user)):
    return await create_invoice_document(
        company_id,
        {
            **data.model_dump(),
            "items": [item.model_dump() for item in data.items],
        },
        user["user_id"],
    )

@api_router.get("/companies/{company_id}/invoices/{invoice_id}")
async def get_invoice(company_id: str, invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": invoice_id}), {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

@api_router.put("/companies/{company_id}/invoices/{invoice_id}")
async def update_invoice(company_id: str, invoice_id: str, data: InvoiceUpdate, user: dict = Depends(get_current_user)):
    existing = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": invoice_id}), {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "items" in update_fields:
        normalized_items = []
        subtotal = 0.0
        tax_total = 0.0
        cogs_total = 0.0
        for item in update_fields.get("items") or []:
            validated = await validate_invoice_line_item(company_id, item)
            qty = float(item.get("quantity") or 0)
            rate = float(item.get("rate") or 0)
            discount = float(item.get("discount") or 0)
            amount = round(max(qty * rate - discount, 0), 2)
            tax_rate = float(item.get("tax_rate") or 0)
            tax = round(amount * (tax_rate / 100), 2) if tax_rate else round(float(item.get("tax") or 0), 2)
            item_row = {
                **item,
                "product_id": validated["product"].get("product_id", item.get("product_id", "")),
                "pricing_mode": validated["pricing_mode"],
                "product_mode": validated["product_mode"],
                "units_per_case": validated["units_per_case"],
                "unit_price": float(item.get("unit_price", validated["unit_price"]) or validated["unit_price"]),
                "case_price": float(item.get("case_price", validated["case_price"]) or validated["case_price"]),
                "unit_cost": float(item.get("unit_cost", validated["product"].get("unit_cost", validated["product"].get("cost_price", 0))) or 0),
            }
            item_row["cost_total"] = calculate_invoice_item_cost(item_row, validated["product"])
            normalized_items.append({
                **item_row,
                "quantity": qty,
                "rate": rate,
                "discount": discount,
                "amount": amount,
                "tax_rate": tax_rate,
                "tax": tax,
            })
            subtotal += amount
            tax_total += tax
            cogs_total += item_row["cost_total"]
        update_fields["items"] = normalized_items
        update_fields["subtotal"] = round(subtotal, 2)
        update_fields["tax_total"] = round(tax_total, 2)
        update_fields["discount_total"] = round(float(update_fields.get("discount_total") or 0), 2)
        update_fields["total"] = round(update_fields["subtotal"] + update_fields["tax_total"] - update_fields["discount_total"], 2)
        update_fields["cogs_total"] = round(cogs_total, 2)
        update_fields["gross_profit"] = round(update_fields["total"] - cogs_total, 2)

    amount_paid = float(update_fields.get("amount_paid", existing.get("amount_paid", 0)) or 0)
    total = float(update_fields.get("total", existing.get("total", 0)) or 0)
    balance_due = round(max(total - amount_paid, 0), 2)
    update_fields["balance_due"] = balance_due
    if balance_due <= 0 and amount_paid > 0:
        update_fields["status"] = "Paid"
        update_fields["payment_status"] = "Paid"
    elif amount_paid > 0:
        update_fields["payment_status"] = "Partial"
    else:
        update_fields["payment_status"] = update_fields.get("payment_status") or existing.get("payment_status", "Unpaid")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.invoices.update_one(
        active_company_query(company_id, {"invoice_id": invoice_id}),
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updated = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": invoice_id}), {"_id": 0})
    updated = await sync_invoice_inventory(company_id, updated, user["user_id"])

    old_customer_id = existing.get("customer_id")
    new_customer_id = updated.get("customer_id")
    old_balance = float(existing.get("balance_due", 0) or 0)
    new_balance = float(updated.get("balance_due", 0) or 0)
    if old_customer_id == new_customer_id and new_customer_id:
        await db.customers.update_one(
            {"company_id": company_id, "customer_id": new_customer_id},
            {"$inc": {"open_balance": round(new_balance - old_balance, 2)}, "$set": {"last_invoice_date": updated.get("invoice_date", "")}}
        )
    else:
        if old_customer_id:
            await db.customers.update_one({"company_id": company_id, "customer_id": old_customer_id}, {"$inc": {"open_balance": -old_balance}})
        if new_customer_id:
            await db.customers.update_one(
                {"company_id": company_id, "customer_id": new_customer_id},
                {"$inc": {"open_balance": new_balance}, "$set": {"last_invoice_date": updated.get("invoice_date", "")}}
            )

    await log_record_activity(company_id, user["user_id"], "invoice", invoice_id, "update", f"Updated invoice {updated.get('invoice_number', invoice_id)}", update_fields)
    return updated

@api_router.delete("/companies/{company_id}/invoices/{invoice_id}")
async def delete_invoice(company_id: str, invoice_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "invoices", invoice_id, user)

@api_router.post("/companies/{company_id}/invoices/{invoice_id}/payments")
async def record_payment(company_id: str, invoice_id: str, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": invoice_id}), {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    new_paid = inv.get("amount_paid", 0) + payment.amount
    new_balance = inv["total"] - new_paid
    new_status = "Paid" if new_balance <= 0 else "Sent"
    new_payment_status = "Paid" if new_balance <= 0 else "Partial"
    payment_entry = {
        "payment_id": f"pmt_{uuid.uuid4().hex[:8]}",
        **payment.model_dump(),
        "payment_date": payment.payment_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user["user_id"]
    }
    await db.invoices.update_one(
        active_company_query(company_id, {"invoice_id": invoice_id}),
        {"$set": {"amount_paid": new_paid, "balance_due": new_balance, "status": new_status, "payment_status": new_payment_status},
         "$push": {"payments": payment_entry}}
    )
    # Update customer balance
    if inv.get("customer_id"):
        await db.customers.update_one(
            {"company_id": company_id, "customer_id": inv["customer_id"]},
            {"$inc": {"open_balance": -payment.amount}}
        )
    updated = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": invoice_id}), {"_id": 0})
    await log_record_activity(company_id, user["user_id"], "invoice", invoice_id, "payment", f"Recorded payment of {payment.amount:.2f} on invoice {updated.get('invoice_number', invoice_id)}")
    return updated

@api_router.get("/companies/{company_id}/credit-memos")
async def get_credit_memos(company_id: str, customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if customer_id:
        query["customer_id"] = customer_id
    return await db.credit_memos.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/credit-memos", status_code=201)
async def create_credit_memo(company_id: str, data: CreditMemoCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    credit_memo_id = f"crm_{uuid.uuid4().hex[:10]}"
    credit_number = (await next_document_number(company_id, "credit_memos", "invoice_prefix", "CM")).replace("INV", "CM")
    total = abs(float(data.total or 0))
    activity = build_activity_entry(company_id, user["user_id"], "credit_memo", credit_memo_id, "create", f"Created credit memo {credit_number}")
    credit_memo = {
        "credit_memo_id": credit_memo_id,
        "company_id": company_id,
        "credit_memo_number": credit_number,
        **data.model_dump(),
        "credit_date": data.credit_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total": total,
        "remaining_credit": total,
        "activity_timeline": [activity],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.credit_memos.insert_one(credit_memo)
    await db.customers.update_one(
        {"company_id": company_id, "customer_id": data.customer_id},
        {"$inc": {"open_balance": -total}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if data.invoice_id:
        await db.invoices.update_one(
            {"company_id": company_id, "invoice_id": data.invoice_id},
            {"$inc": {"balance_due": -total}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    await write_audit_entry(activity)
    credit_memo.pop("_id", None)
    return credit_memo

@api_router.delete("/companies/{company_id}/credit-memos/{credit_memo_id}")
async def delete_credit_memo(company_id: str, credit_memo_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "credit_memos", credit_memo_id, user)

# ─── Dashboard Routes ───

@api_router.get("/companies/{company_id}/dashboard")
async def get_dashboard(company_id: str, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    customers = await db.customers.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    vendors = await db.vendors.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    products = await db.products.find(active_company_query(company_id), {"_id": 0}).to_list(2000)
    inventory_items = await db.inventory.find(active_company_query(company_id), {"_id": 0}).to_list(3000)
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(3000)
    bank_accounts = await db.bank_accounts.find({"company_id": company_id}, {"_id": 0}).to_list(200)

    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)

    def safe_float(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    def parse_date(value: str):
        if not value:
            return None
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    total_sales = sum(safe_float(i.get("total")) for i in invoices)
    total_collected = sum(safe_float(i.get("amount_paid")) for i in invoices)
    outstanding_receivables = sum(safe_float(i.get("balance_due")) for i in invoices if safe_float(i.get("balance_due")) > 0)
    total_payables = sum(safe_float(v.get("payable_balance")) for v in vendors)
    invoice_count = len(invoices)
    customer_payment_total = 0.0
    vendor_payment_total = 0.0

    total_sales_today = 0.0
    total_sales_month = 0.0
    collections_today = 0.0
    collections_month = 0.0
    for inv in invoices:
        invoice_date = parse_date(inv.get("invoice_date", ""))
        if invoice_date:
            if invoice_date == today:
                total_sales_today += safe_float(inv.get("total"))
            if invoice_date >= month_start:
                total_sales_month += safe_float(inv.get("total"))
        for payment in inv.get("payments", []):
            payment_date = parse_date(payment.get("payment_date") or payment.get("recorded_at") or "")
            amount = safe_float(payment.get("amount"))
            customer_payment_total += amount
            if payment_date == today:
                collections_today += amount
            if payment_date and payment_date >= month_start:
                collections_month += amount

    bills = await db.bills.find(active_company_query(company_id), {"_id": 0, "payments": 1}).to_list(5000)
    for bill in bills:
        for payment in bill.get("payments", []):
            vendor_payment_total += safe_float(payment.get("amount"))

    if collections_month == 0:
        collections_month = total_collected

    # Top customers by open balance
    top_customers = sorted(customers, key=lambda c: safe_float(c.get("open_balance")), reverse=True)[:5]
    top_vendors = sorted(vendors, key=lambda v: safe_float(v.get("payable_balance")), reverse=True)[:5]

    # Recent invoices
    recent_invoices = sorted(invoices, key=lambda i: i.get("created_at", ""), reverse=True)[:10]

    # Monthly sales (simple aggregation)
    monthly_sales = {}
    for inv in invoices:
        d = inv.get("invoice_date", "")
        if d:
            month_key = d[:7]
            monthly_sales[month_key] = monthly_sales.get(month_key, 0) + safe_float(inv.get("total"))
    sales_trend = [{"month": k, "amount": v} for k, v in sorted(monthly_sales.items())]

    # Aging buckets
    aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for inv in invoices:
        balance_due = safe_float(inv.get("balance_due"))
        if balance_due <= 0:
            continue
        due = inv.get("due_date", "")
        if not due:
            aging["current"] += balance_due
            continue
        try:
            due_date = datetime.strptime(due, "%Y-%m-%d").date()
            days_overdue = (today - due_date).days
            if days_overdue <= 0:
                aging["current"] += balance_due
            elif days_overdue <= 30:
                aging["1_30"] += balance_due
            elif days_overdue <= 60:
                aging["31_60"] += balance_due
            elif days_overdue <= 90:
                aging["61_90"] += balance_due
            else:
                aging["over_90"] += balance_due
        except Exception:
            aging["current"] += balance_due

    inventory_value = 0.0
    inventory_alerts = []
    for item in inventory_items:
        qty = safe_float(item.get("stock_on_hand") or item.get("quantity") or item.get("available_stock") or item.get("cases_on_hand"))
        unit_cost = safe_float(item.get("cost_per_unit") or item.get("average_cost") or item.get("unit_cost"))
        if unit_cost == 0 and item.get("product_id"):
            product_match = next((product for product in products if product.get("product_id") == item.get("product_id")), None)
            unit_cost = safe_float((product_match or {}).get("cost"))
        inventory_value += qty * unit_cost
        reorder_point = safe_float(item.get("reorder_point") or item.get("reorder_level") or 0)
        if item.get("low_stock_flag") or (reorder_point > 0 and qty <= reorder_point):
            inventory_alerts.append({
                "item_id": item.get("item_id", ""),
                "sku": item.get("sku", ""),
                "product_name": item.get("product_name", ""),
                "stock": qty,
                "reorder_point": reorder_point,
                "warehouse": item.get("warehouse", ""),
            })

    monthly_expense = sum(
        safe_float(expense.get("amount"))
        for expense in expenses
        if (parse_date(expense.get("expense_date", "")) or today) >= month_start
    )
    expense_today = sum(
        safe_float(expense.get("amount"))
        for expense in expenses
        if parse_date(expense.get("expense_date", "")) == today
    )

    product_cost_map = {
        (product.get("product_id") or ""): safe_float(product.get("unit_cost", product.get("cost_price", product.get("cost"))))
        for product in products
    }
    product_name_cost_map = {
        (product.get("name") or "").strip().lower(): safe_float(product.get("unit_cost", product.get("cost_price", product.get("cost"))))
        for product in products
    }
    cost_of_goods_sold = 0.0
    cost_of_goods_sold_month = 0.0
    for inv in invoices:
        invoice_date = parse_date(inv.get("invoice_date", ""))
        invoice_cogs = safe_float(inv.get("cogs_total"))
        if invoice_cogs == 0:
            for item in inv.get("items", []):
                item_cost_total = safe_float(item.get("cost_total"))
                if item_cost_total > 0:
                    invoice_cogs += item_cost_total
                    continue
                item_cost = safe_float(item.get("unit_cost"))
                if item_cost == 0:
                    item_cost = product_cost_map.get(item.get("product_id", ""), 0.0)
                if item_cost == 0:
                    item_cost = product_name_cost_map.get((item.get("product") or "").strip().lower(), 0.0)
                if normalize_pricing_mode(item.get("pricing_mode")) == "case":
                    units_per_case = safe_float(item.get("units_per_case", 1)) or 1
                    invoice_cogs += safe_float(item.get("quantity")) * units_per_case * item_cost
                else:
                    invoice_cogs += safe_float(item.get("quantity")) * item_cost
        cost_of_goods_sold += invoice_cogs
        if invoice_date and invoice_date >= month_start:
            cost_of_goods_sold_month += invoice_cogs

    gross_profit = total_sales - cost_of_goods_sold
    gross_profit_month = total_sales_month - cost_of_goods_sold_month
    net_profit = gross_profit - sum(safe_float(expense.get("amount")) for expense in expenses)
    net_profit_month = gross_profit_month - monthly_expense
    bank_cash_balance = sum(safe_float(account.get("current_balance")) for account in bank_accounts)
    if bank_cash_balance == 0:
        bank_cash_balance = max(0.0, customer_payment_total - vendor_payment_total)

    return {
        "total_sales": total_sales,
        "total_sales_today": round(total_sales_today, 2),
        "total_sales_month": round(total_sales_month, 2),
        "total_collected": total_collected,
        "collections_today": round(collections_today, 2),
        "collections_month": round(collections_month, 2),
        "outstanding_receivables": outstanding_receivables,
        "total_payables": total_payables,
        "invoice_count": invoice_count,
        "customer_count": len(customers),
        "vendor_count": len(vendors),
        "bank_cash_balance": round(bank_cash_balance, 2),
        "inventory_value": round(inventory_value, 2),
        "monthly_expense": round(monthly_expense, 2),
        "expense_today": round(expense_today, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_profit_month": round(gross_profit_month, 2),
        "net_profit": round(net_profit, 2),
        "net_profit_month": round(net_profit_month, 2),
        "top_customers": [{"name": c.get("name", ""), "balance": safe_float(c.get("open_balance"))} for c in top_customers],
        "top_vendors": [{"name": v.get("name", ""), "balance": safe_float(v.get("payable_balance"))} for v in top_vendors],
        "recent_invoices": recent_invoices[:10],
        "sales_trend": sales_trend[-12:],
        "inventory_alerts": sorted(inventory_alerts, key=lambda item: item.get("stock", 0))[:10],
        "aging": aging
    }


@api_router.get("/companies/{company_id}/global-search")
async def global_search(company_id: str, q: str = "", limit: int = 8, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant", "Viewer"])
    query = (q or "").strip().lower()
    if not query:
        return {"customers": [], "invoices": [], "products": [], "vendors": []}

    limit = max(1, min(limit, 25))
    customers = await db.customers.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    products = await db.products.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    vendors = await db.vendors.find(active_company_query(company_id), {"_id": 0}).to_list(500)

    def starts_or_contains(value: str) -> tuple:
        text = (value or "").strip().lower()
        return (0 if text.startswith(query) else 1, text)

    customer_results = sorted(
        [
            {
                "id": customer.get("customer_id", ""),
                "title": customer.get("name", ""),
                "subtitle": customer.get("company_name", ""),
                "route": f"/customers/{customer.get('customer_id', '')}",
                "type": "customer",
            }
            for customer in customers
            if query in (customer.get("name", "") + " " + customer.get("company_name", "") + " " + customer.get("email", "")).lower()
        ],
        key=lambda item: starts_or_contains(item["title"])
    )[:limit]

    invoice_results = sorted(
        [
            {
                "id": invoice.get("invoice_id", ""),
                "title": invoice.get("invoice_number", ""),
                "subtitle": invoice.get("customer_name", ""),
                "route": f"/sales/{invoice.get('invoice_id', '')}",
                "type": "invoice",
            }
            for invoice in invoices
            if query in (invoice.get("invoice_number", "") + " " + invoice.get("customer_name", "")).lower()
        ],
        key=lambda item: starts_or_contains(item["title"])
    )[:limit]

    product_results = sorted(
        [
            {
                "id": product.get("product_id", ""),
                "title": product.get("name", ""),
                "subtitle": product.get("sku", ""),
                "route": f"/products/{product.get('product_id', '')}",
                "type": "product",
            }
            for product in products
            if query in (product.get("name", "") + " " + product.get("sku", "") + " " + product.get("category", "")).lower()
        ],
        key=lambda item: starts_or_contains(item["title"])
    )[:limit]

    vendor_results = sorted(
        [
            {
                "id": vendor.get("vendor_id", ""),
                "title": vendor.get("name", ""),
                "subtitle": vendor.get("company_name", ""),
                "route": f"/vendors/{vendor.get('vendor_id', '')}",
                "type": "vendor",
            }
            for vendor in vendors
            if query in (vendor.get("name", "") + " " + vendor.get("company_name", "") + " " + vendor.get("email", "")).lower()
        ],
        key=lambda item: starts_or_contains(item["title"])
    )[:limit]

    return {
        "customers": customer_results,
        "invoices": invoice_results,
        "products": product_results,
        "vendors": vendor_results,
    }


@api_router.get("/companies/{company_id}/deleted-records")
async def get_deleted_records(company_id: str, record_type: str = "all", user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    selected_keys = list(SOFT_DELETE_CONFIG.keys()) if record_type == "all" else [record_type]
    invalid = [key for key in selected_keys if key not in SOFT_DELETE_CONFIG]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid record type: {', '.join(invalid)}")

    results = []
    for key in selected_keys:
        config = SOFT_DELETE_CONFIG[key]
        collection = getattr(db, config["collection"])
        records = await collection.find(
            {"company_id": company_id, "is_deleted": True},
            {"_id": 0},
        ).sort("deleted_at", -1).to_list(500)
        for record in records:
            results.append({
                "record_type": key,
                "record_id": record.get(config["id_field"], ""),
                "title": record.get(config["title_field"]) or record.get(config["id_field"]) or "",
                "subtitle": record.get(config["subtitle_field"]) or "",
                "deleted_at": record.get("deleted_at", ""),
                "deleted_by": record.get("deleted_by", ""),
                "status": record.get("status", ""),
            })

    results.sort(key=lambda item: item.get("deleted_at", ""), reverse=True)
    return results

# ─── Expenses Routes ───

@api_router.get("/companies/{company_id}/expenses")
async def get_expenses(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if category:
        query["category"] = category
    expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(500)
    return expenses

@api_router.post("/companies/{company_id}/expenses", status_code=201)
async def create_expense(company_id: str, data: ExpenseCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    activity = build_activity_entry(company_id, user["user_id"], "expense", f"exp_{uuid.uuid4().hex[:10]}", "create", f"Created expense for {data.vendor_name or data.category}")
    expense = {
        "expense_id": activity["record_id"],
        "company_id": company_id,
        **data.model_dump(),
        "expense_date": data.expense_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.expenses.insert_one(expense)
    await write_audit_entry(activity)
    expense.pop("_id", None)
    return expense

@api_router.get("/companies/{company_id}/expenses/{expense_id}")
async def get_expense(company_id: str, expense_id: str, user: dict = Depends(get_current_user)):
    e = await db.expenses.find_one(active_company_query(company_id, {"expense_id": expense_id}), {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return e

@api_router.put("/companies/{company_id}/expenses/{expense_id}")
async def update_expense(company_id: str, expense_id: str, data: ExpenseCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    existing = await db.expenses.find_one(active_company_query(company_id, {"expense_id": expense_id}))
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["user_id"]
    
    await db.expenses.update_one(
        active_company_query(company_id, {"expense_id": expense_id}),
        {"$set": update_data}
    )
    
    updated = await db.expenses.find_one(active_company_query(company_id, {"expense_id": expense_id}), {"_id": 0})
    await log_record_activity(company_id, user["user_id"], "expense", expense_id, "update", f"Updated expense {expense_id}", update_data)
    return updated

@api_router.delete("/companies/{company_id}/expenses/{expense_id}")
async def delete_expense(company_id: str, expense_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "expenses", expense_id, user)

# ─── Inventory Routes ───

@api_router.get("/companies/{company_id}/inventory")
async def get_inventory(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
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
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.inventory.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.get("/companies/{company_id}/inventory/{item_id}")
async def get_inventory_item(company_id: str, item_id: str, user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one(active_company_query(company_id, {"item_id": item_id}), {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@api_router.post("/companies/{company_id}/inventory/{item_id}/adjust")
async def adjust_stock(company_id: str, item_id: str, adj: StockAdjustment, user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one(active_company_query(company_id, {"item_id": item_id}), {"_id": 0})
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
        active_company_query(company_id, {"item_id": item_id}),
        {"$set": {"stock_on_hand": new_stock, "available_stock": new_available, "inventory_value": new_value},
         "$push": {"movement_history": movement}}
    )
    updated = await db.inventory.find_one(active_company_query(company_id, {"item_id": item_id}), {"_id": 0})
    return updated

@api_router.delete("/companies/{company_id}/inventory/{item_id}")
async def delete_inventory_item(company_id: str, item_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "inventory", item_id, user)

@api_router.get("/companies/{company_id}/inventory-valuation")
async def get_inventory_valuation(company_id: str, user: dict = Depends(get_current_user)):
    items = await db.inventory.find(active_company_query(company_id), {"_id": 0}).to_list(500)
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

@api_router.get("/companies/{company_id}/stock-transfers")
async def get_stock_transfers(company_id: str, user: dict = Depends(get_current_user)):
    return await db.stock_transfers.find(active_company_query(company_id), {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/stock-transfers", status_code=201)
async def create_stock_transfer(company_id: str, data: StockTransferCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    if not data.source_warehouse or not data.destination_warehouse:
        raise HTTPException(status_code=400, detail="Source and destination warehouses are required")
    if data.source_warehouse == data.destination_warehouse:
        raise HTTPException(status_code=400, detail="Choose different source and destination warehouses")
    quantity = float(data.quantity or 0)
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero")

    source_query = {"company_id": company_id, "warehouse": data.source_warehouse}
    if data.item_id:
        source_query["item_id"] = data.item_id
    else:
        source_query["product_id"] = data.product_id

    source_item = await db.inventory.find_one(source_query, {"_id": 0})
    if not source_item:
        raise HTTPException(status_code=404, detail="Source warehouse inventory item not found")
    if float(source_item.get("stock_on_hand", 0) or 0) < quantity:
        raise HTTPException(status_code=400, detail="Not enough stock in source warehouse")

    destination_item = await db.inventory.find_one({"company_id": company_id, "product_id": source_item.get("product_id", data.product_id), "warehouse": data.destination_warehouse}, {"_id": 0})
    if not destination_item:
        destination_item = {
            "item_id": f"itm_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "product_id": source_item.get("product_id", data.product_id),
            "sku": source_item.get("sku", ""),
            "product_name": data.product_name or source_item.get("product_name", ""),
            "category": source_item.get("category", ""),
            "warehouse": data.destination_warehouse,
            "stock_on_hand": 0,
            "reserved_stock": 0,
            "available_stock": 0,
            "unit_cost": source_item.get("unit_cost", 0),
            "sales_price": source_item.get("sales_price", 0),
            "unit": data.unit or source_item.get("unit", "pcs"),
            "reorder_point": source_item.get("reorder_point", 10),
            "status": "Active",
            "inventory_value": 0,
            "movement_history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["user_id"],
        }
        await db.inventory.insert_one(destination_item)

    transfer_id = f"trf_{uuid.uuid4().hex[:10]}"
    transfer = {
        "transfer_id": transfer_id,
        "company_id": company_id,
        **data.model_dump(),
        "transfer_date": data.transfer_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status": "Completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    unit_cost = float(source_item.get("unit_cost", 0) or 0)
    await db.stock_transfers.insert_one(transfer)
    await db.inventory.update_one(
        {"company_id": company_id, "item_id": source_item["item_id"]},
        {"$inc": {"stock_on_hand": -quantity, "available_stock": -quantity, "inventory_value": -(quantity * unit_cost)}},
    )
    await db.inventory.update_one(
        {"company_id": company_id, "item_id": destination_item["item_id"]},
        {"$inc": {"stock_on_hand": quantity, "available_stock": quantity, "inventory_value": quantity * unit_cost}},
    )
    await log_record_activity(company_id, user["user_id"], "stock_transfer", transfer_id, "create", f"Transferred {quantity} {data.unit} of {data.product_name} from {data.source_warehouse} to {data.destination_warehouse}")
    transfer.pop("_id", None)
    return transfer

@api_router.delete("/companies/{company_id}/stock-transfers/{transfer_id}")
async def delete_stock_transfer(company_id: str, transfer_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "stock_transfers", transfer_id, user)

@api_router.get("/companies/{company_id}/shipments")
async def get_shipments(company_id: str, user: dict = Depends(get_current_user)):
    return await db.shipments.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/shipments", status_code=201)
async def create_shipment(company_id: str, data: ShipmentCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    shipment_id = f"shp_{uuid.uuid4().hex[:10]}"
    shipment = {
        "shipment_id": shipment_id,
        "company_id": company_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
        "activity_timeline": [],
    }
    await db.shipments.insert_one(shipment)
    await log_record_activity(company_id, user["user_id"], "shipment", shipment_id, "create", f"Created shipment {data.shipment_name}")
    shipment.pop("_id", None)
    return shipment

@api_router.get("/companies/{company_id}/documents")
async def get_linked_documents(company_id: str, entity_type: Optional[str] = None, entity_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    return await db.linked_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/documents", status_code=201)
async def create_linked_document(company_id: str, data: LinkedDocumentCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    document = {
        "document_id": f"doc_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.linked_documents.insert_one(document)
    document.pop("_id", None)
    return document

# ─── Accounts Receivable Routes ───

@api_router.get("/companies/{company_id}/receivables")
async def get_receivables(company_id: str, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    customers = await db.customers.find(active_company_query(company_id), {"_id": 0}).to_list(500)
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
    vendors = await db.vendors.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
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

@api_router.get("/companies/{company_id}/reports/tax-summary")
async def get_tax_summary(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(2000)
    bills = await db.bills.find(active_company_query(company_id), {"_id": 0}).to_list(2000)
    if start_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") >= start_date]
        bills = [b for b in bills if b.get("bill_date", "") >= start_date]
    if end_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= end_date]
        bills = [b for b in bills if b.get("bill_date", "") <= end_date]
    sales_tax = round(sum(float(i.get("tax_total", 0) or 0) for i in invoices), 2)
    purchase_tax = 0.0
    for bill in bills:
        if "tax_total" in bill:
            purchase_tax += float(bill.get("tax_total", 0) or 0)
        else:
            for item in bill.get("items", []):
                purchase_tax += float(item.get("tax_amount", item.get("tax", 0)) or 0)
    purchase_tax = round(purchase_tax, 2)
    net_tax = round(sales_tax - purchase_tax, 2)
    monthly = {}
    for invoice in invoices:
        month_key = (invoice.get("invoice_date") or "")[:7]
        if month_key:
            monthly.setdefault(month_key, {"sales_tax": 0, "purchase_tax": 0})
            monthly[month_key]["sales_tax"] += float(invoice.get("tax_total", 0) or 0)
    for bill in bills:
        month_key = (bill.get("bill_date") or "")[:7]
        if month_key:
            monthly.setdefault(month_key, {"sales_tax": 0, "purchase_tax": 0})
            bill_tax = float(bill.get("tax_total", 0) or 0)
            if not bill_tax:
                bill_tax = sum(float(item.get("tax_amount", item.get("tax", 0)) or 0) for item in bill.get("items", []))
            monthly[month_key]["purchase_tax"] += bill_tax
    return {
        "sales_tax": sales_tax,
        "purchase_tax": purchase_tax,
        "net_tax_payable": net_tax,
        "invoice_count": len(invoices),
        "bill_count": len(bills),
        "monthly": [
            {
                "month": month,
                "sales_tax": round(values["sales_tax"], 2),
                "purchase_tax": round(values["purchase_tax"], 2),
                "net_tax": round(values["sales_tax"] - values["purchase_tax"], 2),
            }
            for month, values in sorted(monthly.items())
        ],
    }

@api_router.get("/companies/{company_id}/reports/profit-loss")
async def get_profit_loss(company_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    if start_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") >= start_date]
        expenses = [e for e in expenses if e.get("expense_date", "") >= start_date]
    if end_date:
        invoices = [i for i in invoices if i.get("invoice_date", "") <= end_date]
        expenses = [e for e in expenses if e.get("expense_date", "") <= end_date]
    total_income = sum(i.get("total", 0) for i in invoices)
    cogs = sum(
        float(inv.get("cogs_total", 0) or 0)
        or sum(float(item.get("cost_total", 0) or 0) for item in inv.get("items", []))
        for inv in invoices
    )
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
            monthly.setdefault(m, {"income": 0, "expenses": 0, "cogs": 0})
            monthly[m]["income"] += inv.get("total", 0)
            monthly[m]["cogs"] += float(inv.get("cogs_total", 0) or 0) or sum(float(item.get("cost_total", 0) or 0) for item in inv.get("items", []))
    for exp in expenses:
        m = exp.get("expense_date", "")[:7]
        if m:
            monthly.setdefault(m, {"income": 0, "expenses": 0, "cogs": 0})
            monthly[m]["expenses"] += exp.get("amount", 0)
    monthly_data = [{"month": k, "income": v["income"], "cogs": v["cogs"], "expenses": v["expenses"], "profit": v["income"] - v["cogs"] - v["expenses"]} for k, v in sorted(monthly.items())]
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
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
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
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
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
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    vendors = await db.vendors.find(active_company_query(company_id), {"_id": 0}).to_list(500)
    inventory = await db.inventory.find(active_company_query(company_id), {"_id": 0}).to_list(500)
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
    invoices = await db.invoices.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find(active_company_query(company_id), {"_id": 0}).to_list(1000)
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
    customer = await db.customers.find_one(active_company_query(company_id, {"customer_id": customer_id}), {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    invoices = await db.invoices.find(active_company_query(company_id, {"customer_id": customer_id}), {"_id": 0}).sort("invoice_date", 1).to_list(500)
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

@api_router.get("/companies/{company_id}/customers/{customer_id}/ledger")
async def get_customer_ledger(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    statement = await get_customer_statement(company_id, customer_id, user)
    credit_memos = await db.credit_memos.find({"company_id": company_id, "customer_id": customer_id}, {"_id": 0}).sort("credit_date", 1).to_list(500)
    transactions = list(statement["transactions"])
    running_balance = 0
    rebuilt = []
    merged = sorted(
        transactions + [
            {
                "date": memo.get("credit_date", ""),
                "type": "Credit Memo",
                "ref": memo.get("credit_memo_number", ""),
                "description": memo.get("reason") or f"Credit memo {memo.get('credit_memo_number', '')}",
                "amount": -float(memo.get("total", 0) or 0),
            }
            for memo in credit_memos
        ],
        key=lambda row: (row.get("date", ""), row.get("type", "")),
    )
    for row in merged:
        running_balance += float(row.get("amount", 0) or 0)
        rebuilt.append({**row, "balance": round(running_balance, 2)})
    return {
        "customer": statement["customer"],
        "transactions": rebuilt,
        "balance_due": round(running_balance, 2),
        "statement_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }

@api_router.get("/companies/{company_id}/vendors/{vendor_id}/ledger")
async def get_vendor_ledger(company_id: str, vendor_id: str, user: dict = Depends(get_current_user)):
    vendor = await db.vendors.find_one(active_company_query(company_id, {"vendor_id": vendor_id}), {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    bills = await db.bills.find(active_company_query(company_id, {"vendor_id": vendor_id}), {"_id": 0}).sort("bill_date", 1).to_list(500)
    running_balance = 0
    transactions = []
    for bill in bills:
        running_balance += float(bill.get("total", 0) or 0)
        transactions.append({
            "date": bill.get("bill_date", ""),
            "type": "Bill",
            "ref": bill.get("bill_number", ""),
            "description": f"Bill {bill.get('bill_number', '')}",
            "amount": float(bill.get("total", 0) or 0),
            "balance": round(running_balance, 2),
        })
        for payment in bill.get("payments", []):
            running_balance -= float(payment.get("amount", 0) or 0)
            transactions.append({
                "date": payment.get("payment_date", ""),
                "type": "Payment",
                "ref": payment.get("reference", ""),
                "description": f"Payment - {payment.get('payment_method', '')}",
                "amount": -float(payment.get("amount", 0) or 0),
                "balance": round(running_balance, 2),
            })
    return {
        "vendor": vendor,
        "transactions": transactions,
        "balance_due": round(running_balance, 2),
        "statement_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
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
    activity = build_activity_entry(company_id, user["user_id"], "journal_entry", f"je_{uuid.uuid4().hex[:10]}", "create", f"Created journal entry {entry_number}")
    entry = {
        "entry_id": activity["record_id"],
        "company_id": company_id,
        "entry_number": entry_number,
        "entry_date": data.entry_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": data.description,
        "lines": [l.model_dump() for l in data.lines],
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "status": data.status,
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.journal_entries.insert_one(entry)
    await write_audit_entry(activity)
    entry.pop("_id", None)
    if data.status == "Posted":
        for line in data.lines:
            if line.debit > 0:
                await db.accounts.update_one({"company_id": company_id, "code": line.account_code}, {"$inc": {"balance": line.debit}})
            if line.credit > 0:
                await db.accounts.update_one({"company_id": company_id, "code": line.account_code}, {"$inc": {"balance": -line.credit}})
        await log_record_activity(company_id, user["user_id"], "journal_entry", entry["entry_id"], "post", f"Posted journal entry {entry_number}")
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
    await log_record_activity(company_id, user["user_id"], "journal_entry", entry_id, "post", f"Posted journal entry {entry.get('entry_number', entry_id)}")
    return {"ok": True}

# ─── Estimates Routes ───

@api_router.get("/companies/{company_id}/estimates")
async def get_estimates(company_id: str, user: dict = Depends(get_current_user)):
    return await db.estimates.find(active_company_query(company_id), {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/estimates", status_code=201)
async def create_estimate(company_id: str, data: EstimateCreate, user: dict = Depends(get_current_user)):
    count = await db.estimates.count_documents(active_company_query(company_id))
    est = {
        "estimate_id": f"est_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "estimate_number": f"EST-{datetime.now(timezone.utc).year}-{str(count + 1).zfill(3)}",
        **data.model_dump(),
        "items": [i.model_dump() for i in data.items],
        "estimate_date": data.estimate_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.estimates.insert_one(est)
    est.pop("_id", None)
    return est

@api_router.get("/companies/{company_id}/estimates/{estimate_id}")
async def get_estimate(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    e = await db.estimates.find_one(active_company_query(company_id, {"estimate_id": estimate_id}), {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return e

@api_router.put("/companies/{company_id}/estimates/{estimate_id}")
async def update_estimate(company_id: str, estimate_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    body.pop("_id", None)
    body.pop("estimate_id", None)
    body.pop("company_id", None)
    await db.estimates.update_one(active_company_query(company_id, {"estimate_id": estimate_id}), {"$set": body})
    return await db.estimates.find_one(active_company_query(company_id, {"estimate_id": estimate_id}), {"_id": 0})

@api_router.post("/companies/{company_id}/estimates/{estimate_id}/convert")
async def convert_estimate_to_invoice(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    est = await db.estimates.find_one(active_company_query(company_id, {"estimate_id": estimate_id}), {"_id": 0})
    if not est:
        raise HTTPException(status_code=404, detail="Estimate not found")
    count = await db.invoices.count_documents(active_company_query(company_id))
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
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": user["user_id"]
    }
    await db.invoices.insert_one(inv)
    await db.estimates.update_one(active_company_query(company_id, {"estimate_id": estimate_id}), {"$set": {"status": "Converted"}})
    inv.pop("_id", None)
    return inv

@api_router.delete("/companies/{company_id}/estimates/{estimate_id}")
async def delete_estimate(company_id: str, estimate_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "estimates", estimate_id, user)

# ─── Sales Orders Routes ───

@api_router.get("/companies/{company_id}/sales-orders")
async def get_sales_orders(company_id: str, status: Optional[str] = None, customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    return await db.sales_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/sales-orders", status_code=201)
async def create_sales_order(company_id: str, data: SalesOrderCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    order_number = await next_document_number(company_id, "sales_orders", "sales_order_prefix", "SO")
    order_id = f"so_{uuid.uuid4().hex[:10]}"
    activity = build_activity_entry(company_id, user["user_id"], "sales_order", order_id, "create", f"Created sales order {order_number}")
    order = {
        "sales_order_id": order_id,
        "company_id": company_id,
        "sales_order_number": order_number,
        **data.model_dump(),
        "items": [item.model_dump() for item in data.items],
        "order_date": data.order_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.sales_orders.insert_one(order)
    await write_audit_entry(activity)
    order.pop("_id", None)
    return order

@api_router.get("/companies/{company_id}/sales-orders/{sales_order_id}")
async def get_sales_order(company_id: str, sales_order_id: str, user: dict = Depends(get_current_user)):
    order = await db.sales_orders.find_one(active_company_query(company_id, {"sales_order_id": sales_order_id}), {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    return order

@api_router.put("/companies/{company_id}/sales-orders/{sales_order_id}")
async def update_sales_order(company_id: str, sales_order_id: str, request: Request, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    body = await request.json()
    for key in ("_id", "sales_order_id", "company_id", "sales_order_number", "created_at", "created_by"):
        body.pop(key, None)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["updated_by"] = user["user_id"]
    await db.sales_orders.update_one(active_company_query(company_id, {"sales_order_id": sales_order_id}), {"$set": body})
    updated = await db.sales_orders.find_one(active_company_query(company_id, {"sales_order_id": sales_order_id}), {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Sales order not found")
    await log_record_activity(company_id, user["user_id"], "sales_order", sales_order_id, "update", f"Updated sales order {updated.get('sales_order_number', sales_order_id)}", body)
    return updated

@api_router.post("/companies/{company_id}/sales-orders/{sales_order_id}/convert-to-invoice")
async def convert_sales_order_to_invoice(company_id: str, sales_order_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    order = await db.sales_orders.find_one(active_company_query(company_id, {"sales_order_id": sales_order_id}), {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")
    if order.get("converted_invoice_id"):
        existing_invoice = await db.invoices.find_one(
            active_company_query(company_id, {"invoice_id": order.get("converted_invoice_id")}),
            {"_id": 0},
        )
        if existing_invoice:
            return existing_invoice
        await db.sales_orders.update_one(
            active_company_query(company_id, {"sales_order_id": sales_order_id}),
            {"$unset": {"converted_invoice_id": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user["user_id"]}},
        )
        order.pop("converted_invoice_id", None)
    invoice_id = f"inv_{uuid.uuid4().hex[:10]}"
    invoice_number = await next_document_number(company_id, "invoices", "invoice_prefix", "INV")
    activity = build_activity_entry(company_id, user["user_id"], "invoice", invoice_id, "create", f"Converted sales order {order.get('sales_order_number', sales_order_id)} to invoice {invoice_number}")
    invoice = {
        "invoice_id": invoice_id,
        "company_id": company_id,
        "invoice_number": invoice_number,
        "customer_id": order.get("customer_id", ""),
        "customer_name": order.get("customer_name", ""),
        "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "due_date": order.get("expected_date") or (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d"),
        "sales_rep": "",
        "warehouse": "",
        "items": order.get("items", []),
        "notes": order.get("notes", ""),
        "terms": "Net 30",
        "subtotal": order.get("subtotal", 0),
        "tax_total": order.get("tax_total", 0),
        "discount_total": order.get("discount_total", 0),
        "total": order.get("total", 0),
        "status": "Draft",
        "payment_status": "Unpaid",
        "amount_paid": 0,
        "balance_due": order.get("total", 0),
        "payments": [],
        "converted_from_sales_order": sales_order_id,
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.invoices.insert_one(invoice)
    await write_audit_entry(activity)
    await db.sales_orders.update_one(
        active_company_query(company_id, {"sales_order_id": sales_order_id}),
        {"$set": {"status": "Fulfilled", "converted_invoice_id": invoice_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_record_activity(company_id, user["user_id"], "sales_order", sales_order_id, "convert", f"Converted sales order {order.get('sales_order_number', sales_order_id)} to invoice {invoice_number}")
    invoice.pop("_id", None)
    return invoice

@api_router.get("/companies/{company_id}/customers/{customer_id}/sales-orders")
async def get_customer_sales_orders(company_id: str, customer_id: str, user: dict = Depends(get_current_user)):
    return await db.sales_orders.find(active_company_query(company_id, {"customer_id": customer_id}), {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.delete("/companies/{company_id}/sales-orders/{sales_order_id}")
async def delete_sales_order(company_id: str, sales_order_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "sales_orders", sales_order_id, user)

# ─── Purchase Orders Routes ───

@api_router.get("/companies/{company_id}/purchase-orders")
async def get_purchase_orders(company_id: str, status: Optional[str] = None, vendor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if status:
        query["status"] = status
    if vendor_id:
        query["vendor_id"] = vendor_id
    return await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/purchase-orders", status_code=201)
async def create_purchase_order(company_id: str, data: PurchaseOrderCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    po_number = await next_document_number(company_id, "purchase_orders", "purchase_order_prefix", "PO")
    po_id = f"po_{uuid.uuid4().hex[:10]}"
    activity = build_activity_entry(company_id, user["user_id"], "purchase_order", po_id, "create", f"Created purchase order {po_number}")
    po = {
        "purchase_order_id": po_id,
        "company_id": company_id,
        "purchase_order_number": po_number,
        **data.model_dump(),
        "items": [item.model_dump() for item in data.items],
        "order_date": data.order_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "approval_status": "Draft",
        "approval_history": [],
        "activity_timeline": [activity],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.purchase_orders.insert_one(po)
    await write_audit_entry(activity)
    po.pop("_id", None)
    return po

@api_router.get("/companies/{company_id}/purchase-orders/{purchase_order_id}")
async def get_purchase_order(company_id: str, purchase_order_id: str, user: dict = Depends(get_current_user)):
    po = await db.purchase_orders.find_one(active_company_query(company_id, {"purchase_order_id": purchase_order_id}), {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po

@api_router.put("/companies/{company_id}/purchase-orders/{purchase_order_id}")
async def update_purchase_order(company_id: str, purchase_order_id: str, request: Request, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    body = await request.json()
    for key in ("_id", "purchase_order_id", "company_id", "purchase_order_number", "created_at", "created_by"):
        body.pop(key, None)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["updated_by"] = user["user_id"]
    await db.purchase_orders.update_one(active_company_query(company_id, {"purchase_order_id": purchase_order_id}), {"$set": body})
    updated = await db.purchase_orders.find_one(active_company_query(company_id, {"purchase_order_id": purchase_order_id}), {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    await log_record_activity(company_id, user["user_id"], "purchase_order", purchase_order_id, "update", f"Updated purchase order {updated.get('purchase_order_number', purchase_order_id)}", body)
    return updated

@api_router.post("/companies/{company_id}/purchase-orders/{purchase_order_id}/convert-to-bill")
async def convert_purchase_order_to_bill(company_id: str, purchase_order_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    po = await db.purchase_orders.find_one(active_company_query(company_id, {"purchase_order_id": purchase_order_id}), {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("linked_bill_id"):
        raise HTTPException(status_code=400, detail="Purchase order already converted to bill")
    bill = await create_bill_from_purchase_order_doc(company_id, po, user["user_id"], "manual")
    await db.purchase_orders.update_one(
        {"company_id": company_id, "purchase_order_id": purchase_order_id},
        {"$set": {"linked_bill_id": bill["bill_id"], "status": "Received", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_record_activity(company_id, user["user_id"], "purchase_order", purchase_order_id, "convert", f"Converted purchase order {po.get('purchase_order_number', purchase_order_id)} to bill {bill.get('bill_number', bill['bill_id'])}")
    bill.pop("_id", None)
    return bill

@api_router.post("/companies/{company_id}/purchase-orders/auto-create-bills")
async def auto_create_bills_from_purchase_orders(company_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    candidates = await db.purchase_orders.find(
        {
            "company_id": company_id,
            "is_deleted": {"$ne": True},
            "linked_bill_id": {"$exists": False},
            "status": {"$in": ["Approved", "Received", "Sent"]},
        },
        {"_id": 0},
    ).to_list(500)
    created = []
    for po in candidates:
        bill = await create_bill_from_purchase_order_doc(company_id, po, user["user_id"], "automation")
        await db.purchase_orders.update_one(
            {"company_id": company_id, "purchase_order_id": po["purchase_order_id"]},
            {"$set": {"linked_bill_id": bill["bill_id"], "auto_bill_created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await log_record_activity(company_id, user["user_id"], "purchase_order", po["purchase_order_id"], "auto_convert", f"Automatically created bill {bill.get('bill_number', bill['bill_id'])} from purchase order {po.get('purchase_order_number', '')}")
        created.append({"purchase_order_id": po["purchase_order_id"], "purchase_order_number": po.get("purchase_order_number", ""), "bill_id": bill["bill_id"], "bill_number": bill.get("bill_number", "")})
    return {"created_count": len(created), "bills": created}

@api_router.post("/companies/{company_id}/purchase-orders/{purchase_order_id}/receive")
async def receive_purchase_order(company_id: str, purchase_order_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    po = await db.purchase_orders.find_one(active_company_query(company_id, {"purchase_order_id": purchase_order_id}), {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.get("linked_receipt_id"):
        raise HTTPException(status_code=400, detail="Purchase order already received")
    receipt_id = f"rcpt_{uuid.uuid4().hex[:10]}"
    receipt = {
        "receipt_id": receipt_id,
        "company_id": company_id,
        "vendor_id": po.get("vendor_id", ""),
        "vendor_name": po.get("vendor_name", ""),
        "reference": po.get("purchase_order_number", ""),
        "receive_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "items": po.get("items", []),
        "notes": po.get("notes", ""),
        "total_cost": po.get("total", 0),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.stock_receipts.insert_one(receipt)
    for item in po.get("items", []):
        product_id = item.get("product_id")
        if not product_id:
            continue
        inventory_item = await db.inventory.find_one({"company_id": company_id, "product_id": product_id}, {"_id": 0, "item_id": 1})
        if inventory_item:
            quantity = float(item.get("quantity", 0) or 0)
            unit_cost = float(item.get("rate", 0) or 0)
            await db.inventory.update_one(
                {"company_id": company_id, "item_id": inventory_item["item_id"]},
                {"$inc": {"stock_on_hand": quantity, "available_stock": quantity, "inventory_value": quantity * unit_cost}}
            )
    await db.purchase_orders.update_one(
        {"company_id": company_id, "purchase_order_id": purchase_order_id},
        {"$set": {"linked_receipt_id": receipt_id, "status": "Received", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_record_activity(company_id, user["user_id"], "purchase_order", purchase_order_id, "receive", f"Received purchase order {po.get('purchase_order_number', purchase_order_id)} into inventory")
    receipt.pop("_id", None)
    return receipt

@api_router.get("/companies/{company_id}/vendors/{vendor_id}/purchase-orders")
async def get_vendor_purchase_orders(company_id: str, vendor_id: str, user: dict = Depends(get_current_user)):
    return await db.purchase_orders.find(active_company_query(company_id, {"vendor_id": vendor_id}), {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.delete("/companies/{company_id}/purchase-orders/{purchase_order_id}")
async def delete_purchase_order(company_id: str, purchase_order_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "purchase_orders", purchase_order_id, user)

# ─── Approvals & Audit Routes ───

@api_router.get("/companies/{company_id}/audit-logs")
async def get_audit_logs(company_id: str, record_type: Optional[str] = None, action: Optional[str] = None, search: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if record_type:
        query["record_type"] = record_type
    if action:
        query["action"] = action
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    if search:
        needle = search.lower()
        logs = [l for l in logs if needle in (l.get("summary", "").lower()) or needle in (l.get("record_id", "").lower())]
    return logs

@api_router.get("/companies/{company_id}/records/{record_type}/{record_id}/activity")
async def get_record_activity(company_id: str, record_type: str, record_id: str, user: dict = Depends(get_current_user)):
    doc, _, _ = await get_record_for_approval(company_id, record_type, record_id)
    return {
        "record_type": record_type,
        "record_id": record_id,
        "activity_timeline": doc.get("activity_timeline", []),
        "approval_history": doc.get("approval_history", []),
        "approval_status": doc.get("approval_status", "Draft"),
    }

@api_router.post("/companies/{company_id}/approvals/{record_type}/{record_id}/submit")
async def submit_record_for_approval(company_id: str, record_type: str, record_id: str, payload: ApprovalActionRequest, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    doc, collection_name, id_field = await get_record_for_approval(company_id, record_type, record_id)
    history_entry = {
        "decision_id": f"apr_{uuid.uuid4().hex[:10]}",
        "action": "Submitted",
        "note": payload.note,
        "by": user["user_id"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db[collection_name].update_one(
        {"company_id": company_id, id_field: record_id},
        {"$set": {"approval_status": "Submitted"}, "$push": {"approval_history": history_entry}}
    )
    await log_record_activity(company_id, user["user_id"], record_type, record_id, "submit", f"Submitted {record_type.replace('_', ' ')} for approval", {"note": payload.note})
    return await db[collection_name].find_one({"company_id": company_id, id_field: record_id}, {"_id": 0})

@api_router.post("/companies/{company_id}/approvals/{record_type}/{record_id}/approve")
async def approve_record(company_id: str, record_type: str, record_id: str, payload: ApprovalActionRequest, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager"])
    doc, collection_name, id_field = await get_record_for_approval(company_id, record_type, record_id)
    history_entry = {
        "decision_id": f"apr_{uuid.uuid4().hex[:10]}",
        "action": "Approved",
        "note": payload.note,
        "by": user["user_id"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    update_fields = {"approval_status": "Approved"}
    if record_type == "purchase_order" and doc.get("status") == "Draft":
        update_fields["status"] = "Approved"
    await db[collection_name].update_one(
        {"company_id": company_id, id_field: record_id},
        {"$set": update_fields, "$push": {"approval_history": history_entry}}
    )
    await log_record_activity(company_id, user["user_id"], record_type, record_id, "approve", f"Approved {record_type.replace('_', ' ')}", {"note": payload.note})
    return await db[collection_name].find_one({"company_id": company_id, id_field: record_id}, {"_id": 0})

@api_router.post("/companies/{company_id}/approvals/{record_type}/{record_id}/reject")
async def reject_record(company_id: str, record_type: str, record_id: str, payload: ApprovalActionRequest, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager"])
    _, collection_name, id_field = await get_record_for_approval(company_id, record_type, record_id)
    history_entry = {
        "decision_id": f"apr_{uuid.uuid4().hex[:10]}",
        "action": "Rejected",
        "note": payload.note,
        "by": user["user_id"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db[collection_name].update_one(
        {"company_id": company_id, id_field: record_id},
        {"$set": {"approval_status": "Rejected"}, "$push": {"approval_history": history_entry}}
    )
    await log_record_activity(company_id, user["user_id"], record_type, record_id, "reject", f"Rejected {record_type.replace('_', ' ')}", {"note": payload.note})
    return await db[collection_name].find_one({"company_id": company_id, id_field: record_id}, {"_id": 0})

# ─── Recurring Automation & Reminders ───

@api_router.get("/companies/{company_id}/recurring-templates")
async def get_recurring_templates(company_id: str, template_type: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id}
    if template_type:
        query["template_type"] = template_type
    if status:
        query["status"] = status
    return await db.recurring_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/companies/{company_id}/recurring-templates", status_code=201)
async def create_recurring_template(company_id: str, data: RecurringTemplateCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    if data.template_type not in {"invoice", "bill"}:
        raise HTTPException(status_code=400, detail="template_type must be invoice or bill")
    start_date = data.start_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    template = {
        "template_id": f"rtpl_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "template_type": data.template_type,
        "next_run_date": start_date,
        "last_run_date": "",
        "generated_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recurring_templates.insert_one(template)
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "recurring_template", template["template_id"], "create", f"Created recurring {data.template_type} template {data.name}"))
    template.pop("_id", None)
    return template


@api_router.put("/companies/{company_id}/recurring-templates/{template_id}")
async def update_recurring_template(company_id: str, template_id: str, data: RecurringTemplateCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    existing = await db.recurring_templates.find_one({"company_id": company_id, "template_id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    start_date = data.start_date or existing.get("start_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    update_fields = {
        **data.model_dump(),
        "start_date": start_date,
        "next_run_date": existing.get("next_run_date") or start_date,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recurring_templates.update_one({"company_id": company_id, "template_id": template_id}, {"$set": update_fields})
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "recurring_template", template_id, "update", f"Updated recurring template {data.name}"))
    return await db.recurring_templates.find_one({"company_id": company_id, "template_id": template_id}, {"_id": 0})


@api_router.post("/companies/{company_id}/recurring-templates/{template_id}/run")
async def run_recurring_template_now(company_id: str, template_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    template = await db.recurring_templates.find_one({"company_id": company_id, "template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    generated = await run_recurring_template(company_id, template, user["user_id"])
    reminders = await sync_company_reminders(company_id)
    return {"generated": generated, "reminders": reminders}


@api_router.post("/companies/{company_id}/recurring-templates/run-due")
async def run_company_due_recurring_templates(company_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    return await run_due_recurring_templates(company_id, user["user_id"])


@api_router.get("/companies/{company_id}/reminders")
async def get_company_reminders(company_id: str, status: str = "Open", user: dict = Depends(get_current_user)):
    await sync_company_reminders(company_id)
    return await db.reminders.find({"company_id": company_id, "status": status}, {"_id": 0}).sort("due_date", 1).to_list(500)

# ─── Bills Routes ───

@api_router.get("/companies/{company_id}/bills")
async def get_bills(company_id: str, user: dict = Depends(get_current_user)):
    return await db.bills.find(active_company_query(company_id), {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/bills", status_code=201)
async def create_bill(company_id: str, data: BillCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    return await create_bill_document(company_id, data.model_dump(), user["user_id"])

@api_router.get("/companies/{company_id}/bills/{bill_id}")
async def get_bill(company_id: str, bill_id: str, user: dict = Depends(get_current_user)):
    b = await db.bills.find_one(active_company_query(company_id, {"bill_id": bill_id}), {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Bill not found")
    return b

@api_router.post("/companies/{company_id}/bills/{bill_id}/pay")
async def pay_bill(company_id: str, bill_id: str, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one(active_company_query(company_id, {"bill_id": bill_id}), {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    new_paid = bill.get("amount_paid", 0) + payment.amount
    new_balance = bill["total"] - new_paid
    new_status = "Paid" if new_balance <= 0 else "Partial"
    pmt = {"payment_id": f"pmt_{uuid.uuid4().hex[:8]}", **payment.model_dump(), "recorded_at": datetime.now(timezone.utc).isoformat()}
    await db.bills.update_one(active_company_query(company_id, {"bill_id": bill_id}), {"$set": {"amount_paid": new_paid, "balance_due": new_balance, "status": new_status}, "$push": {"payments": pmt}})
    if bill.get("vendor_id"):
            await db.vendors.update_one({"company_id": company_id, "vendor_id": bill["vendor_id"]}, {"$inc": {"payable_balance": -payment.amount}})
    updated = await db.bills.find_one(active_company_query(company_id, {"bill_id": bill_id}), {"_id": 0})
    await log_record_activity(company_id, user["user_id"], "bill", bill_id, "payment", f"Recorded payment of {payment.amount:.2f} on bill {updated.get('bill_number', bill_id)}")
    return updated

@api_router.delete("/companies/{company_id}/bills/{bill_id}")
async def delete_bill(company_id: str, bill_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "bills", bill_id, user)

# ─── Receive Stock Routes ───

@api_router.get("/companies/{company_id}/stock-receipts")
async def get_stock_receipts(company_id: str, user: dict = Depends(get_current_user)):
    return await db.stock_receipts.find(active_company_query(company_id), {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/companies/{company_id}/stock-receipts", status_code=201)
async def create_stock_receipt(company_id: str, data: ReceiveStockCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    prepared_items = await prepare_receipt_items(company_id, data.items, data.warehouse or "Main Warehouse")
    total_cost = round(sum(float(item.get("line_total", 0) or 0) for item in prepared_items), 2)
    receipt = {
        "receipt_id": f"rcpt_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "items": prepared_items,
        "warehouse": data.warehouse or "Main Warehouse",
        "total_cost": total_cost,
        "status": data.status or "Draft",
        "receive_date": data.receive_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.stock_receipts.insert_one(receipt)
    if receipt.get("container_number"):
        shipment_id = await ensure_receipt_shipment_record(company_id, receipt, user["user_id"])
        if shipment_id:
            await db.stock_receipts.update_one(
                {"company_id": company_id, "receipt_id": receipt["receipt_id"]},
                {"$set": {"shipment_id": shipment_id}}
            )
            receipt["shipment_id"] = shipment_id
            await link_receipt_documents(company_id, receipt, receipt.get("items", []), shipment_id, user["user_id"])
    receipt.pop("_id", None)
    if receipt["status"] == "Posted":
        receipt = await post_stock_receipt_to_inventory(company_id, receipt, user["user_id"])
    return receipt


@api_router.post("/companies/{company_id}/stock-receipts/{receipt_id}/post")
async def post_stock_receipt(company_id: str, receipt_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    receipt = await db.stock_receipts.find_one(active_company_query(company_id, {"receipt_id": receipt_id}), {"_id": 0})
    if not receipt:
        raise HTTPException(status_code=404, detail="Stock receipt not found")
    return await post_stock_receipt_to_inventory(company_id, receipt, user["user_id"])

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
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
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
        inv = await db.invoices.find_one(active_company_query(company_id, {"invoice_id": inv_id}), {"_id": 0})
        if not inv:
            continue
        new_paid = inv.get("amount_paid", 0) + amount
        new_balance = inv["total"] - new_paid
        new_status = "Paid" if new_balance <= 0 else "Sent"
        new_ps = "Paid" if new_balance <= 0 else "Partial"
        pmt_entry = {"payment_id": f"pmt_{uuid.uuid4().hex[:8]}", "amount": amount, "payment_date": payment_date, "payment_method": payment_method, "reference": reference, "recorded_at": datetime.now(timezone.utc).isoformat(), "recorded_by": user["user_id"]}
        await db.invoices.update_one(active_company_query(company_id, {"invoice_id": inv_id}), {"$set": {"amount_paid": new_paid, "balance_due": max(0, new_balance), "status": new_status, "payment_status": new_ps}, "$push": {"payments": pmt_entry}})
        if inv.get("customer_id"):
            await db.customers.update_one({"company_id": company_id, "customer_id": inv["customer_id"]}, {"$inc": {"open_balance": -amount}})
        total_applied += amount
    return {"status": "success", "total_applied": round(total_applied, 2), "invoices_updated": len(applications)}

# ─── Customer Payments (Aggregate List) ───

@api_router.get("/companies/{company_id}/customer-payments")
async def list_customer_payments(company_id: str, customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Return a flat, sorted list of all customer payments drawn from invoices.payments."""
    query = active_company_query(company_id)
    if customer_id:
        query["customer_id"] = customer_id
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(5000)
    rows = []
    for inv in invoices:
        for p in inv.get("payments", []):
            rows.append({
                **p,
                "invoice_id": inv.get("invoice_id"),
                "invoice_number": inv.get("invoice_number"),
                "customer_id": inv.get("customer_id"),
                "customer_name": inv.get("customer_name"),
                "invoice_total": inv.get("total", 0),
            })
    rows.sort(key=lambda x: x.get("payment_date", "") or x.get("recorded_at", ""), reverse=True)
    total_received = round(sum(r.get("amount", 0) for r in rows), 2)
    return {"payments": rows, "count": len(rows), "total_received": total_received}


# ─── Vendor Payments (List + Bulk Pay) ───

@api_router.get("/companies/{company_id}/vendor-payments")
async def list_vendor_payments(company_id: str, vendor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Return a flat, sorted list of all vendor payments drawn from bills.payments."""
    query = {"company_id": company_id}
    if vendor_id:
        query["vendor_id"] = vendor_id
    bills = await db.bills.find(query, {"_id": 0}).to_list(5000)
    rows = []
    for b in bills:
        for p in b.get("payments", []):
            rows.append({
                **p,
                "bill_id": b.get("bill_id"),
                "bill_number": b.get("bill_number") or b.get("reference_number") or b.get("bill_id"),
                "vendor_id": b.get("vendor_id"),
                "vendor_name": b.get("vendor_name"),
                "bill_total": b.get("total", 0),
            })
    rows.sort(key=lambda x: x.get("payment_date", "") or x.get("recorded_at", ""), reverse=True)
    total_paid = round(sum(r.get("amount", 0) for r in rows), 2)
    return {"payments": rows, "count": len(rows), "total_paid": total_paid}


@api_router.get("/companies/{company_id}/vendor-payments/{payment_id}")
async def get_vendor_payment_detail(company_id: str, payment_id: str, user: dict = Depends(get_current_user)):
    bills = await db.bills.find({"company_id": company_id}, {"_id": 0}).to_list(5000)
    for bill in bills:
        for payment in bill.get("payments", []):
            if payment.get("payment_id") == payment_id:
                return {
                    **payment,
                    "bill_id": bill.get("bill_id"),
                    "bill_number": bill.get("bill_number") or bill.get("reference_number") or bill.get("bill_id"),
                    "vendor_id": bill.get("vendor_id"),
                    "vendor_name": bill.get("vendor_name"),
                    "bill_total": bill.get("total", 0),
                }
    raise HTTPException(status_code=404, detail="Vendor payment not found")


@api_router.post("/companies/{company_id}/pay-vendor")
async def pay_vendor_bulk(company_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Apply a single payment against one or more vendor bills."""
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    body = await request.json()
    vendor_id = body.get("vendor_id", "")
    payment_date = body.get("payment_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    payment_method = body.get("payment_method", "Bank Transfer")
    reference = body.get("reference", "")
    paid_from = body.get("paid_from", "1000")
    check_number = body.get("check_number", "")
    check_date = body.get("check_date", payment_date)
    memo = body.get("memo", "")
    bank_account_name = body.get("bank_account_name", paid_from)
    applications = body.get("applications", [])
    total_applied = 0
    for app in applications:
        bill_id = app.get("bill_id", "")
        amount = float(app.get("amount", 0) or 0)
        if not bill_id or amount <= 0:
            continue
        bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
        if not bill:
            continue
        new_paid = bill.get("amount_paid", 0) + amount
        new_balance = bill.get("total", 0) - new_paid
        new_status = "Paid" if new_balance <= 0 else "Partial"
        pmt_entry = {
            "payment_id": f"pmt_{uuid.uuid4().hex[:8]}",
            "amount": amount,
            "payment_date": payment_date,
            "payment_method": payment_method,
            "reference": reference,
            "paid_from": paid_from,
            "bank_account_name": bank_account_name,
            "check_number": check_number,
            "check_date": check_date,
            "memo": memo,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "recorded_by": user["user_id"],
        }
        await db.bills.update_one(
            {"bill_id": bill_id},
            {"$set": {"amount_paid": new_paid, "balance_due": max(0, new_balance), "status": new_status},
             "$push": {"payments": pmt_entry}}
        )
        if bill.get("vendor_id"):
            await db.vendors.update_one({"company_id": company_id, "vendor_id": bill["vendor_id"]}, {"$inc": {"payable_balance": -amount}})
        await log_record_activity(company_id, user["user_id"], "bill", bill_id, "payment", f"Recorded {payment_method.lower()} payment of {amount:.2f} on bill {bill.get('bill_number', bill_id)}", {"reference": reference, "check_number": check_number})
        total_applied += amount
    return {"status": "success", "total_applied": round(total_applied, 2), "bills_updated": len(applications), "vendor_id": vendor_id}



# ─── Bank Reconciliation ───

@api_router.get("/companies/{company_id}/bank-accounts")
async def get_bank_accounts(company_id: str, user: dict = Depends(get_current_user)):
    return await db.bank_accounts.find({"company_id": company_id}, {"_id": 0}).sort("account_name", 1).to_list(200)


@api_router.post("/companies/{company_id}/bank-accounts", status_code=201)
async def create_bank_account(company_id: str, data: BankAccountCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager"])
    account = {
        "bank_account_id": f"bank_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.bank_accounts.insert_one(account)
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "bank_account", account["bank_account_id"], "create", f"Created bank account {data.account_name}"))
    account.pop("_id", None)
    return account


@api_router.put("/companies/{company_id}/bank-accounts/{bank_account_id}")
async def update_bank_account(company_id: str, bank_account_id: str, data: BankAccountCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager"])
    result = await db.bank_accounts.update_one(
        {"company_id": company_id, "bank_account_id": bank_account_id},
        {"$set": {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return await db.bank_accounts.find_one({"company_id": company_id, "bank_account_id": bank_account_id}, {"_id": 0})


@api_router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/manual-transactions")
async def get_manual_bank_transactions(company_id: str, bank_account_id: str, user: dict = Depends(get_current_user)):
    return await db.bank_transactions.find({"company_id": company_id, "bank_account_id": bank_account_id}, {"_id": 0}).sort("txn_date", -1).to_list(1000)


@api_router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/manual-transactions", status_code=201)
async def create_manual_bank_transaction_route(company_id: str, bank_account_id: str, data: BankTransactionCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    account = await db.bank_accounts.find_one({"company_id": company_id, "bank_account_id": bank_account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return await create_manual_bank_transaction(company_id, bank_account_id, data, user["user_id"])


@api_router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-lines")
async def get_statement_lines(company_id: str, bank_account_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"company_id": company_id, "bank_account_id": bank_account_id}
    if status:
        query["status"] = status
    return await db.bank_statement_lines.find(query, {"_id": 0}).sort("statement_date", -1).to_list(1000)


@api_router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-import")
async def import_bank_statement(company_id: str, bank_account_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    raw = await file.read()
    text = raw.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    for row in reader:
        normalized = {str(k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        statement_date = normalized.get("date") or normalized.get("statement_date") or normalized.get("posted date") or normalized.get("transaction date") or ""
        description = normalized.get("description") or normalized.get("memo") or normalized.get("details") or normalized.get("transaction") or ""
        amount = normalize_statement_amount({
            "amount": normalized.get("amount"),
            "credit": normalized.get("credit"),
            "debit": normalized.get("debit"),
        })
        if not statement_date or (description == "" and amount == 0):
            continue
        line = {
            "line_id": f"stmt_{uuid.uuid4().hex[:10]}",
            "company_id": company_id,
            "bank_account_id": bank_account_id,
            "statement_date": statement_date,
            "description": description,
            "amount": amount,
            "balance": float(normalized.get("balance") or 0) if str(normalized.get("balance") or "").strip() else None,
            "status": "Unmatched",
            "matched_record_type": "",
            "matched_record_id": "",
            "matched_summary": "",
            "imported_at": datetime.now(timezone.utc).isoformat(),
            "imported_by": user["user_id"],
        }
        await db.bank_statement_lines.update_one(
            {"company_id": company_id, "bank_account_id": bank_account_id, "statement_date": statement_date, "description": description, "amount": amount},
            {"$setOnInsert": line},
            upsert=True,
        )
        imported += 1
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "bank_statement", bank_account_id, "import", f"Imported {imported} statement lines into bank account {bank_account_id}"))
    return {"imported": imported}


@api_router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-lines/{line_id}/candidates")
async def get_statement_line_candidates(company_id: str, bank_account_id: str, line_id: str, user: dict = Depends(get_current_user)):
    line = await db.bank_statement_lines.find_one({"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id}, {"_id": 0})
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    candidates = await collect_bank_match_candidates(company_id, float(line.get("amount", 0) or 0))
    return {"line": line, "candidates": candidates}


@api_router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-lines/{line_id}/match")
async def match_statement_line(company_id: str, bank_account_id: str, line_id: str, data: StatementMatchRequest, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    line = await db.bank_statement_lines.find_one({"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id}, {"_id": 0})
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    await db.bank_statement_lines.update_one(
        {"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id},
        {"$set": {
            "status": "Matched",
            "matched_record_type": data.record_type,
            "matched_record_id": data.record_id,
            "matched_summary": data.note or f"Matched to {data.record_type} {data.record_id}",
            "matched_at": datetime.now(timezone.utc).isoformat(),
            "matched_by": user["user_id"],
        }},
    )
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "bank_statement", line_id, "match", f"Matched statement line {line_id} to {data.record_type} {data.record_id}"))
    return await db.bank_statement_lines.find_one({"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id}, {"_id": 0})


@api_router.post("/companies/{company_id}/bank-accounts/{bank_account_id}/statement-lines/{line_id}/adjust")
async def adjust_statement_line(company_id: str, bank_account_id: str, line_id: str, data: BankAdjustmentCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager"])
    line = await db.bank_statement_lines.find_one({"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id}, {"_id": 0})
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    bank_account = await db.bank_accounts.find_one({"company_id": company_id, "bank_account_id": bank_account_id}, {"_id": 0})
    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    amount = round(abs(float(data.amount or line.get("amount", 0) or 0)), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Adjustment amount must be greater than zero")
    is_credit = float(line.get("amount", 0) or 0) >= 0
    count = await db.journal_entries.count_documents({"company_id": company_id})
    entry = {
        "entry_id": f"je_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "entry_number": f"JE-{datetime.now(timezone.utc).year}-{str(count + 1).zfill(3)}",
        "entry_date": line.get("statement_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": data.description or f"Bank reconciliation adjustment for {line.get('description', line_id)}",
        "lines": [
            {"account_code": bank_account.get("ledger_account_code", "1000"), "account_name": bank_account.get("account_name", "Bank"), "description": "Bank line adjustment", "debit": amount if is_credit else 0, "credit": 0 if is_credit else amount},
            {"account_code": data.account_code, "account_name": data.account_name, "description": data.description or "Reconciliation adjustment", "debit": 0 if is_credit else amount, "credit": amount if is_credit else 0},
        ],
        "total_debit": amount,
        "total_credit": amount,
        "status": "Posted",
        "approval_status": "Approved",
        "approval_history": [],
        "activity_timeline": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.journal_entries.insert_one(entry)
    await db.bank_statement_lines.update_one(
        {"company_id": company_id, "bank_account_id": bank_account_id, "line_id": line_id},
        {"$set": {
            "status": "Adjusted",
            "matched_record_type": "journal_entry",
            "matched_record_id": entry["entry_id"],
            "matched_summary": entry["description"],
            "matched_at": datetime.now(timezone.utc).isoformat(),
            "matched_by": user["user_id"],
        }},
    )
    await write_audit_entry(build_activity_entry(company_id, user["user_id"], "bank_statement", line_id, "adjust", f"Created bank adjustment entry {entry['entry_number']}"))
    return {"statement_line_id": line_id, "journal_entry": entry}


@api_router.get("/companies/{company_id}/bank-accounts/{bank_account_id}/reconciliation-summary")
async def get_bank_reconciliation_summary(company_id: str, bank_account_id: str, user: dict = Depends(get_current_user)):
    lines = await db.bank_statement_lines.find({"company_id": company_id, "bank_account_id": bank_account_id}, {"_id": 0}).to_list(3000)
    total_statement = round(sum(float(line.get("amount", 0) or 0) for line in lines), 2)
    matched = [line for line in lines if line.get("status") == "Matched"]
    adjusted = [line for line in lines if line.get("status") == "Adjusted"]
    unmatched = [line for line in lines if line.get("status") == "Unmatched"]
    matched_total = round(sum(float(line.get("amount", 0) or 0) for line in matched + adjusted), 2)
    return {
        "statement_line_count": len(lines),
        "matched_count": len(matched),
        "adjusted_count": len(adjusted),
        "unmatched_count": len(unmatched),
        "statement_total": total_statement,
        "matched_total": matched_total,
        "difference": round(total_statement - matched_total, 2),
    }


# ─── Products Routes ───

@api_router.get("/companies/{company_id}/products")
async def get_products(company_id: str, category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = active_company_query(company_id)
    if category:
        query["category"] = category
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    balance_map = await build_live_product_balance_map(company_id, products)
    for product in products:
        balance = balance_map.get(product.get("product_id", ""), {})
        cases_on_hand = round_report_quantity(balance.get("cases_on_hand", product.get("cases_on_hand", product.get("stock_cases", 0))))
        stock_units_on_hand = round_report_quantity(balance.get("stock_units_on_hand", product.get("stock_units_on_hand", 0)))
        product["cases_on_hand"] = cases_on_hand
        product["stock_cases"] = cases_on_hand
        product["quantity_on_hand"] = cases_on_hand
        product["total_quantity_on_hand"] = cases_on_hand
        product["stock_units_on_hand"] = stock_units_on_hand
        product["available_cases"] = cases_on_hand
        product["available_stock_units"] = stock_units_on_hand
        product["in_stock"] = cases_on_hand > 0
    return products

@api_router.post("/companies/{company_id}/products", status_code=201)
async def create_product(company_id: str, data: ProductCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    role = await get_user_role_for_company(user["user_id"], company_id)
    payload = build_product_payload(data)
    if role != "OWNER" and (
        float(payload.get("unit_price", 0) or 0) != 0
        or float(payload.get("selling_price", 0) or 0) != 0
        or float(payload.get("case_price", 0) or 0) != 0
    ):
        raise HTTPException(status_code=403, detail="Only Owner can set the sales price")
    product = {
        "product_id": f"prod_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        **payload,
        "sku": payload.get("sku") or f"SKU-{uuid.uuid4().hex[:6].upper()}",
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"]
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    return product

@api_router.post("/companies/{company_id}/products/bulk-delete")
async def bulk_delete_products(company_id: str, data: ProductBulkDeleteRequest, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_records(company_id, "products", data.product_ids, user)

@api_router.get("/companies/{company_id}/products/{product_id}")
async def get_product(company_id: str, product_id: str, user: dict = Depends(get_current_user)):
    p = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    balance_map = await build_live_product_balance_map(company_id, [p])
    balance = balance_map.get(product_id, {})
    cases_on_hand = round_report_quantity(balance.get("cases_on_hand", p.get("cases_on_hand", p.get("stock_cases", 0))))
    stock_units_on_hand = round_report_quantity(balance.get("stock_units_on_hand", p.get("stock_units_on_hand", 0)))
    p["cases_on_hand"] = cases_on_hand
    p["stock_cases"] = cases_on_hand
    p["quantity_on_hand"] = cases_on_hand
    p["total_quantity_on_hand"] = cases_on_hand
    p["stock_units_on_hand"] = stock_units_on_hand
    p["available_cases"] = cases_on_hand
    p["available_stock_units"] = stock_units_on_hand
    p["in_stock"] = cases_on_hand > 0
    return p

@api_router.get("/companies/{company_id}/products/{product_id}/quick-report")
async def get_product_quick_report(
    company_id: str,
    product_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entry_type: str = "all",
    user: dict = Depends(get_current_user),
):
    product = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await build_product_quick_report(company_id, product, start_date, end_date, entry_type)

@api_router.put("/companies/{company_id}/products/{product_id}")
async def update_product(company_id: str, product_id: str, data: ProductCreate, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    existing = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    role = await get_user_role_for_company(user["user_id"], company_id)
    update_data = build_product_payload(data)
    if role != "OWNER" and (
        float(update_data.get("unit_price", 0) or 0) != float(existing.get("unit_price", existing.get("selling_price", 0)) or 0)
        or float(update_data.get("selling_price", 0) or 0) != float(existing.get("selling_price", 0) or 0)
        or float(update_data.get("case_price", 0) or 0) != float(existing.get("case_price", 0) or 0)
    ):
        raise HTTPException(status_code=403, detail="Only Owner can edit the sales price")
    result = await db.products.update_one(
        active_company_query(company_id, {"product_id": product_id}),
        {"$set": update_data}
    )
    updated = await db.products.find_one(active_company_query(company_id, {"product_id": product_id}), {"_id": 0})
    return updated

@api_router.delete("/companies/{company_id}/products/{product_id}")
async def delete_product(company_id: str, product_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    return await soft_delete_company_record(company_id, "products", product_id, user)

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

async def notify_owner_security_change(company_id: str, title: str, summary: str, actor: dict):
    if not company_id:
        return
    try:
        company = await get_company_doc(company_id) or {}
        settings = await get_company_settings_doc(company_id)
        owners = await db.team_members.find(
            {"companies": company_id, "role": {"$in": ["OWNER", "Owner", "Admin"]}, "status": "Active"},
            {"_id": 0, "email": 1},
        ).to_list(50)
        recipients = {
            owner.get("email", "").strip().lower()
            for owner in owners
            if owner.get("email")
        }
        for fallback in [settings.get("notification_email"), ALERT_RECIPIENT_EMAIL]:
            if fallback:
                recipients.add(fallback.strip().lower())
        if not recipients:
            return

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.5;color:#191C1E;">
          <h2 style="margin:0 0 10px;">{title}</h2>
          <p style="margin:0 0 14px;">{summary}</p>
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <tr><td style="padding:8px;border:1px solid #E6E8EA;font-weight:700;">Company</td><td style="padding:8px;border:1px solid #E6E8EA;">{company.get('name', company_id)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #E6E8EA;font-weight:700;">Changed By</td><td style="padding:8px;border:1px solid #E6E8EA;">{actor.get('name') or actor.get('email') or actor.get('user_id')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #E6E8EA;font-weight:700;">Time</td><td style="padding:8px;border:1px solid #E6E8EA;">{datetime.now(timezone.utc).isoformat()}</td></tr>
          </table>
        </div>
        """
        await asyncio.gather(*[
            send_email_async(email, f"{title} - {company.get('short_name') or company.get('name') or company_id}", html)
            for email in recipients
        ])
    except Exception as exc:
        logger.error(f"Owner security notification failed: {exc}")

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
    for c in await get_companies_list():
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
        <p style="text-align:center;font-size:11px;color:#434655;opacity:0.6;">{branded_footer_text()}</p>
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

async def build_ai_business_context(company_id: str) -> str:
    """Assemble a concise, live business snapshot for the AI Assistant system prompt."""
    if not company_id:
        return ""
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")

        # Counts
        inv_count = await db.invoices.count_documents({"company_id": company_id})
        cust_count = await db.customers.count_documents({"company_id": company_id})
        vnd_count = await db.vendors.count_documents({"company_id": company_id})
        prd_count = await db.inventory.count_documents({"company_id": company_id})

        # Company meta
        company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "name": 1, "currency": 1, "country": 1}) or {}
        currency = company.get("currency", "USD")

        # This month sales
        month_invoices = await db.invoices.find(
            {"company_id": company_id, "invoice_date": {"$gte": month_start}, "status": {"$ne": "Cancelled"}},
            {"_id": 0, "total": 1, "customer_name": 1, "balance_due": 1, "due_date": 1, "invoice_number": 1, "status": 1}
        ).to_list(500)
        mtd_sales = round(sum(i.get("total", 0) for i in month_invoices), 2)

        # AR: overdue invoices
        all_open = await db.invoices.find(
            {"company_id": company_id, "balance_due": {"$gt": 0}, "status": {"$ne": "Cancelled"}},
            {"_id": 0, "invoice_number": 1, "customer_name": 1, "balance_due": 1, "due_date": 1, "invoice_date": 1, "total": 1}
        ).to_list(500)
        total_ar = round(sum(i.get("balance_due", 0) for i in all_open), 2)
        overdue = [i for i in all_open if i.get("due_date") and i["due_date"] < today]
        overdue.sort(key=lambda x: x.get("due_date", ""))
        top_overdue = overdue[:5]

        # AP: overdue bills
        all_open_bills = await db.bills.find(
            {"company_id": company_id, "balance_due": {"$gt": 0}},
            {"_id": 0, "bill_number": 1, "vendor_name": 1, "balance_due": 1, "due_date": 1, "total": 1}
        ).to_list(500)
        total_ap = round(sum(b.get("balance_due", 0) for b in all_open_bills), 2)
        overdue_bills = [b for b in all_open_bills if b.get("due_date") and b["due_date"] < today]
        overdue_bills.sort(key=lambda x: x.get("due_date", ""))
        top_overdue_bills = overdue_bills[:5]

        # Low stock
        low_stock = await db.inventory.find(
            {"company_id": company_id, "$or": [
                {"low_stock_flag": True},
                {"$expr": {"$lte": [
                    {"$ifNull": ["$stock_on_hand", "$quantity"]},
                    {"$ifNull": ["$reorder_level", "$reorder_point"]},
                ]}},
            ]},
            {"_id": 0, "product_name": 1, "stock_on_hand": 1, "quantity": 1, "reorder_level": 1, "reorder_point": 1, "unit": 1}
        ).limit(8).to_list(8)

        # This month expenses
        month_exp = await db.expenses.find(
            {"company_id": company_id, "expense_date": {"$gte": month_start}},
            {"_id": 0, "amount": 1, "category": 1}
        ).to_list(500)
        mtd_expenses = round(sum(e.get("amount", 0) for e in month_exp), 2)

        # Top customer balances
        top_cust = await db.customers.find(
            {"company_id": company_id, "open_balance": {"$gt": 0}},
            {"_id": 0, "name": 1, "open_balance": 1}
        ).sort("open_balance", -1).limit(5).to_list(5)

        # Top vendor balances
        top_vend = await db.vendors.find(
            {"company_id": company_id, "payable_balance": {"$gt": 0}},
            {"_id": 0, "name": 1, "payable_balance": 1}
        ).sort("payable_balance", -1).limit(5).to_list(5)

        def money(v):
            return f"{currency} {float(v or 0):,.2f}"

        lines = [f"LIVE BUSINESS SNAPSHOT — {company.get('name', company_id)} ({company_id})",
                 f"Today: {today} | Currency: {currency} | Country: {company.get('country', 'US')}",
                 f"Entities: {inv_count} invoices, {cust_count} customers, {vnd_count} vendors, {prd_count} products.",
                 f"This month so far: Sales={money(mtd_sales)} | Expenses={money(mtd_expenses)} | Rough Profit={money(mtd_sales - mtd_expenses)}",
                 f"Accounts Receivable: {money(total_ar)} open, {len(overdue)} overdue invoices.",
                 f"Accounts Payable: {money(total_ap)} open, {len(overdue_bills)} overdue bills."]

        if top_overdue:
            lines.append("Top overdue invoices:")
            for i in top_overdue:
                lines.append(f"  - {i.get('invoice_number','')} {i.get('customer_name','')} due {i.get('due_date','')} — {money(i.get('balance_due', 0))}")
        if top_overdue_bills:
            lines.append("Top overdue bills:")
            for b in top_overdue_bills:
                lines.append(f"  - {b.get('bill_number','')} {b.get('vendor_name','')} due {b.get('due_date','')} — {money(b.get('balance_due', 0))}")
        if low_stock:
            lines.append("Low-stock items:")
            for p in low_stock:
                lines.append(f"  - {p.get('product_name','')}: {p.get('stock_on_hand', p.get('quantity', 0))} {p.get('unit','')} (reorder at {p.get('reorder_level', p.get('reorder_point', 0))})")
        if top_cust:
            lines.append("Top customer receivables: " + ", ".join(f"{c['name']} {money(c['open_balance'])}" for c in top_cust))
        if top_vend:
            lines.append("Top vendor payables: " + ", ".join(f"{v['name']} {money(v['payable_balance'])}" for v in top_vend))

        return "\n".join(lines)
    except Exception as ex:
        logger.warning(f"AI context build failed: {ex}")
        return ""

def is_ai_data_query(message: str) -> bool:
    text = (message or "").lower()
    return bool(re.search(r"\b(total|sales|balance|overdue|amount|report|reports|receivable|payable|paid|unpaid|profit|expense|low stock|stock)\b", text))

def format_money(value, currency: str = "USD") -> str:
    return f"{currency} {float(value or 0):,.2f}"

async def answer_ai_data_query(company_id: str, message: str):
    text = (message or "").lower()
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "currency": 1, "name": 1}) or {}
    currency = company.get("currency", "USD")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    memory_updates = {}

    if "overdue" in text or "unpaid" in text:
        invoices = await db.invoices.find(
            active_company_query(company_id, {"balance_due": {"$gt": 0}, "status": {"$ne": "Cancelled"}}),
            {"_id": 0, "invoice_id": 1, "invoice_number": 1, "customer_id": 1, "customer_name": 1, "balance_due": 1, "due_date": 1}
        ).sort("due_date", 1).to_list(500)
        overdue = [invoice for invoice in invoices if invoice.get("due_date") and invoice["due_date"] < today]
        if not overdue:
            return "No data found for this period", memory_updates
        first = overdue[0]
        memory_updates["last_customer"] = {"customer_id": first.get("customer_id"), "name": first.get("customer_name")}
        memory_updates["last_invoice"] = {"invoice_id": first.get("invoice_id"), "invoice_number": first.get("invoice_number")}
        total = sum(invoice.get("balance_due", 0) for invoice in overdue)
        lines = [f"Open receivables overdue: **{format_money(total, currency)}** across **{len(overdue)}** invoice(s)."]
        for invoice in overdue[:8]:
            lines.append(f"• {invoice.get('customer_name', 'Unknown customer')} | {invoice.get('invoice_number', '')} | Due: {invoice.get('due_date', '')} | {format_money(invoice.get('balance_due', 0), currency)}")
        lines.append("Recommend following up on the oldest balances first.")
        return "\n".join(lines), memory_updates

    if "sales" in text or "total" in text or "amount" in text:
        invoices = await db.invoices.find(
            active_company_query(company_id, {"invoice_date": {"$gte": month_start}, "status": {"$ne": "Cancelled"}}),
            {"_id": 0, "invoice_id": 1, "invoice_number": 1, "customer_id": 1, "customer_name": 1, "total": 1, "status": 1}
        ).to_list(1000)
        total_sales = sum(invoice.get("total", 0) for invoice in invoices)
        if not invoices:
            return "No data found for this period", memory_updates
        first = invoices[0]
        memory_updates["last_customer"] = {"customer_id": first.get("customer_id"), "name": first.get("customer_name")}
        memory_updates["last_invoice"] = {"invoice_id": first.get("invoice_id"), "invoice_number": first.get("invoice_number")}
        paid_count = sum(1 for invoice in invoices if str(invoice.get("status", "")).lower() == "paid")
        unpaid_count = max(len(invoices) - paid_count, 0)
        lines = [f"This month's sales: **{format_money(total_sales, currency)}** across **{len(invoices)}** invoice(s).", "", "Invoices:"]
        for invoice in invoices[:12]:
            lines.append(f"• {invoice.get('invoice_number', 'Invoice')} | {invoice.get('customer_name', 'Unknown customer')} | {format_money(invoice.get('total', 0), currency)} | {invoice.get('status', 'Unknown')}")
        lines.append(f"{unpaid_count} invoice(s) still open.")
        lines.append("Want me to list the overdue ones?")
        return "\n".join(lines), memory_updates

    if "balance" in text or "receivable" in text:
        customers = await db.customers.find(
            active_company_query(company_id, {"open_balance": {"$gt": 0}}),
            {"_id": 0, "customer_id": 1, "name": 1, "open_balance": 1}
        ).sort("open_balance", -1).limit(10).to_list(10)
        if not customers:
            return "No data found for this period", memory_updates
        memory_updates["last_customer"] = {"customer_id": customers[0].get("customer_id"), "name": customers[0].get("name")}
        total = sum(customer.get("open_balance", 0) for customer in customers)
        lines = [f"Open receivables: **{format_money(total, currency)}**."]
        for customer in customers:
            lines.append(f"• {customer.get('name', 'Unknown customer')} | {format_money(customer.get('open_balance', 0), currency)}")
        lines.append("I recommend reviewing the oldest balances first.")
        return "\n".join(lines), memory_updates

    if "payable" in text:
        bills = await db.bills.find(
            active_company_query(company_id, {"balance_due": {"$gt": 0}}),
            {"_id": 0, "bill_number": 1, "vendor_name": 1, "balance_due": 1, "due_date": 1}
        ).sort("due_date", 1).limit(10).to_list(10)
        if not bills:
            return "No data found for this period", memory_updates
        total = sum(bill.get("balance_due", 0) for bill in bills)
        lines = [f"Open payables: **{format_money(total, currency)}**."]
        for bill in bills:
            lines.append(f"• {bill.get('vendor_name', 'Unknown vendor')} | {bill.get('bill_number', '')} | {format_money(bill.get('balance_due', 0), currency)}")
        return "\n".join(lines), memory_updates

    if "low stock" in text or "stock" in text:
        items = await db.inventory.find(
            active_company_query(company_id, {"$or": [
                {"low_stock_flag": True},
                {"$expr": {"$lte": [
                    {"$ifNull": ["$stock_on_hand", "$quantity"]},
                    {"$ifNull": ["$reorder_level", "$reorder_point"]},
                ]}},
            ]}),
            {"_id": 0, "product_name": 1, "stock_on_hand": 1, "quantity": 1, "reorder_level": 1, "reorder_point": 1, "unit": 1}
        ).limit(10).to_list(10)
        if not items:
            return "No data found for this period", memory_updates
        lines = ["Low stock products:"]
        for item in items:
            on_hand = item.get("stock_on_hand", item.get("quantity", 0))
            reorder = item.get("reorder_level", item.get("reorder_point", 0))
            lines.append(f"• {item.get('product_name', 'Unknown product')} | {on_hand} {item.get('unit', '')} on hand | reorder at {reorder}")
        return "\n".join(lines), memory_updates

    return "No data found for this period", memory_updates


@api_router.post("/ai/chat")
async def ai_chat(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id", f"chat_{uuid.uuid4().hex[:10]}")
    company_id = body.get("company_id", "")
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    if is_ai_data_query(message):
        response, memory_updates = await answer_ai_data_query(company_id, message)
        ts = datetime.now(timezone.utc).isoformat()
        await db.ai_chats.insert_one({"session_id": session_id, "role": "user", "content": message, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        await db.ai_chats.insert_one({"session_id": session_id, "role": "assistant", "content": response, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        return {"response": response, "session_id": session_id, "memory_updates": memory_updates}
    context = await build_ai_business_context(company_id)
    memory = body.get("memory") or {}
    system_msg = """You are ROMA — the AI Accountant and Business Agent
for CK Frozen Fish & Food Canada Inc.

You are sharp, professional, and direct — like a
senior accountant and operations manager with 15
years of experience in wholesale seafood distribution
and import/export business.

YOUR PERSONALITY:
- Speak confidently and efficiently — no filler words
- Give real answers with real numbers, not vague summaries
- Be proactive — if you see something off in the data, mention it
- Treat the owner (Iftekhairul Alam) as your boss
- You are the employee, they are the decision-maker
- Use natural business language: receivables, outstanding
  balance, gross margin, payable, net 30, COGS, etc.
- Format financial data clearly: tables, bullet points, labeled amounts
- Never be confused. If data is missing, say exactly what
  is missing and how to get it.

YOUR RESPONSE FORMAT:
- Always lead with the direct answer first
- Use bullet points or tables for lists of data
- Bold important dollar amounts
- End with a one-line action suggestion when relevant

HOW YOU TALK — EXAMPLES:

User: "Total sales this month"
ROMA: "This month's sales: **$4,280.00** across 6 invoices.
• INV-01001 | TEST CUSTOMER | $842.40 | Paid
• INV-01002 | OCEAN FRESH LLC | $1,560.00 | Unpaid
3 invoices unpaid — outstanding: **$2,340.00**.
Want me to list the overdue ones?"

User: "Who owes me money?"
ROMA: "Open receivables: **$2,340.00**
• OCEAN FRESH LLC — $1,560.00 (Due: May 15)
• HALAL MART — $780.00 (Due: May 20)
Both past Net 30. Recommend sending a follow-up."

User: "How is business this week?"
ROMA: "This week:
• Sales: **$1,620.00** (2 invoices)
• Collections: **$842.40** received
• Stock received: **$2,933.50** from TEST VENDOR
• Payables: $0.00 — clean on vendor side."

STRICT RULES:
- Never say "I am ROMA, I can help with..." as a
  recurring greeting — only say it on first use ever
- Never say "I could not hear clearly" when user typed text
  (only say this if actual voice input failed)
- Never give one-line answers to business data questions
  — always include actual numbers and a list
- Always respond in the same language the user writes in
  (English or Bangla)
- You have full access to: invoices, payments, products,
  inventory, customers, vendors, bills, receipts"""
    runtime = await resolve_ai_runtime(company_id)
    if runtime.get("provider") == "unconfigured":
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Set a local AI provider (like Ollama) or add an OpenAI API key in backend/.env.",
        )
    try:
        history_rows = await db.ai_chats.find({"session_id": session_id}, {"_id": 0, "role": 1, "content": 1}).sort("created_at", -1).to_list(20)
        history: List[Dict[str, str]] = []
        for row in reversed(history_rows):
            if row.get("role") in {"user", "assistant"} and row.get("content"):
                history.append({"role": row["role"], "content": row["content"]})
        live_context = f"LIVE APP CONTEXT:\n{context}\n\nSESSION MEMORY:\n{json.dumps(memory, ensure_ascii=False)}"
        response = await send_ai_chat_completion(
            runtime,
            system_message=system_msg,
            history=history,
            user_message=f"{message}\n\n{live_context}",
        )
        if not response.strip() and runtime.get("provider") != "openai" and llm_api_key():
            response = await send_ai_chat_completion(
                {
                    "provider": "openai",
                    "model": OPENAI_MODEL,
                    "base_url": "",
                    "api_key": llm_api_key(),
                },
                system_message=system_msg,
                history=history,
                user_message=f"{message}\n\n{live_context}",
            )
        # Store messages
        ts = datetime.now(timezone.utc).isoformat()
        await db.ai_chats.insert_one({"session_id": session_id, "role": "user", "content": message, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        await db.ai_chats.insert_one({"session_id": session_id, "role": "assistant", "content": response, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
        return {"response": response, "session_id": session_id, "memory_updates": {}, "provider": runtime.get("provider"), "model": runtime.get("model")}
    except Exception as e:
        if runtime.get("provider") != "openai" and llm_api_key():
            try:
                history_rows = await db.ai_chats.find({"session_id": session_id}, {"_id": 0, "role": 1, "content": 1}).sort("created_at", -1).to_list(20)
                history: List[Dict[str, str]] = []
                for row in reversed(history_rows):
                    if row.get("role") in {"user", "assistant"} and row.get("content"):
                        history.append({"role": row["role"], "content": row["content"]})
                live_context = f"LIVE APP CONTEXT:\n{context}\n\nSESSION MEMORY:\n{json.dumps(memory, ensure_ascii=False)}"
                response = await send_ai_chat_completion(
                    {
                        "provider": "openai",
                        "model": OPENAI_MODEL,
                        "base_url": "",
                        "api_key": llm_api_key(),
                    },
                    system_message=system_msg,
                    history=history,
                    user_message=f"{message}\n\n{live_context}",
                )
                ts = datetime.now(timezone.utc).isoformat()
                await db.ai_chats.insert_one({"session_id": session_id, "role": "user", "content": message, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
                await db.ai_chats.insert_one({"session_id": session_id, "role": "assistant", "content": response, "user_id": user["user_id"], "company_id": company_id, "created_at": ts})
                return {"response": response, "session_id": session_id, "memory_updates": {}, "provider": "openai", "model": OPENAI_MODEL}
            except Exception as fallback_error:
                logger.error(f"AI chat fallback error: {str(fallback_error)}")
        logger.error(f"AI chat error: {str(e)}")
        if runtime.get("provider") in {"ollama", "openai_compatible"}:
            raise HTTPException(
                status_code=503,
                detail=f"Local AI provider is not reachable at {runtime.get('base_url')}. Start the local model server or change ROMA AI Runtime settings.",
            )
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@api_router.post("/ai/extract-invoice")
async def ai_extract_invoice(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    b64 = base64.b64encode(content).decode("utf-8")
    system_msg = """You are an accounting order and invoice extraction assistant. Extract structured data from invoice images, scanned order sheets, and handwritten order lists.
You must understand Bangla, English, and mixed Bangla-English handwriting when possible.
If the file is an order list instead of a final invoice, infer the best invoice-ready structure from the visible customer name, dates, products, quantities, units, rates, totals, notes, and delivery instructions.
If a value is missing, use a sensible empty string or 0 instead of inventing facts.
Return ONLY valid JSON with this exact structure:
{"customer_name":"","invoice_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","items":[{"product":"","description":"","quantity":0,"unit":"pcs","rate":0,"amount":0}],"subtotal":0,"tax_total":0,"total":0,"notes":""}
Do not include any text before or after the JSON."""
    key = llm_api_key()
    if not key:
        raise HTTPException(status_code=503, detail="AI is not configured. Set your AI provider key in backend/.env.")
    try:
        chat = LlmChat(api_key=key, session_id=f"extract_{uuid.uuid4().hex[:8]}", system_message=system_msg)
        chat.with_model("openai", OPENAI_MODEL)
        image_content = ImageContent(image_base64=b64)
        user_msg = UserMessage(text="Extract all invoice or handwritten order data from this file into structured JSON for invoice creation.", file_contents=[image_content])
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
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant", "Viewer"])
    settings = await db.settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        settings = build_default_settings(company_id)
        await db.settings.insert_one(settings)
    else:
        defaults = build_default_settings(company_id)
        settings = {
            **defaults,
            **settings,
            "invoice_layout": {
                **defaults["invoice_layout"],
                **(settings.get("invoice_layout") or {}),
                "sections": (settings.get("invoice_layout") or {}).get("sections") or defaults["invoice_layout"]["sections"],
            },
            "permissions": normalize_permissions_config(settings.get("permissions")),
        }
    return settings

@api_router.put("/settings/{company_id}")
async def update_settings(company_id: str, request: Request, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    body = await request.json()
    body.pop("_id", None)
    body.pop("company_id", None)
    if "permissions" in body:
        body["permissions"] = normalize_permissions_config(body.get("permissions"))
    await db.settings.update_one({"company_id": company_id}, {"$set": body}, upsert=True)
    updated = await db.settings.find_one({"company_id": company_id}, {"_id": 0})
    return updated


@api_router.post("/companies/{company_id}/reset-business-data")
async def reset_business_data(company_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin"])
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    business_collections = [
        "accounts",
        "alerts",
        "ai_chats",
        "customers",
        "vendors",
        "products",
        "inventory",
        "invoices",
        "estimates",
        "sales_orders",
        "credit_memos",
        "bills",
        "expenses",
        "purchase_orders",
        "stock_transfers",
        "stock_receipts",
        "bank_transactions",
        "bank_statement_lines",
        "shipments",
        "linked_documents",
        "ai_uploads",
        "audit_logs",
        "customer_payment_drafts",
        "reminders",
        "recurring_templates",
        "journal_entries",
    ]
    deleted_counts = {}
    for collection_name in business_collections:
        result = await db[collection_name].delete_many({"company_id": company_id})
        deleted_counts[collection_name] = result.deleted_count

    bank_reset = await db.bank_accounts.update_many(
        {"company_id": company_id},
        {
            "$set": {
                "opening_balance": 0,
                "current_balance": 0,
                "balance": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    deleted_counts["bank_account_balances_reset"] = bank_reset.modified_count

    await write_audit_entry(
        build_activity_entry(
            company_id,
            user["user_id"],
            "company",
            company_id,
            "reset_business_data",
            "Reset all business data for company",
            {"deleted_counts": deleted_counts},
        )
    )
    return {
        "ok": True,
        "message": "All business data cleared successfully.",
        "deleted_counts": deleted_counts,
    }

@api_router.get("/team-members")
async def get_team_members(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not company_id:
        raise HTTPException(status_code=400, detail="company_id is required")
    await require_role(user, company_id, ["OWNER"])
    query = {"companies": company_id}
    members = await db.team_members.find(query, {"_id": 0}).to_list(100)
    for member in members:
        member["role"] = normalize_role(member.get("role"))
    return members

@api_router.get("/pending-registrations")
async def get_pending_registrations(company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not company_id:
        raise HTTPException(status_code=400, detail="company_id is required")
    await require_role(user, company_id, ["OWNER"])
    query = {"company_id": company_id}
    pending = await db.pending_registrations.find(query, {"_id": 0}).to_list(100)
    for entry in pending:
        entry["role_requested"] = normalize_role(entry.get("role_requested"))
    return pending

@api_router.post("/team-members", status_code=201)
async def create_team_member(payload: TeamMemberCreateRequest, user: dict = Depends(get_current_user)):
    company_ids = list(dict.fromkeys([
        company_id.strip()
        for company_id in ((payload.company_ids or []) + ([payload.company_id] if payload.company_id else []))
        if (company_id or "").strip()
    ]))
    if not company_ids:
        raise HTTPException(status_code=400, detail="At least one company access assignment is required.")
    for company_id in company_ids:
        await require_role(user, company_id, ["OWNER"])

    email = payload.email.strip().lower()
    name = payload.name.strip()
    role = normalize_role(payload.role)
    if not email or not name:
        raise HTTPException(status_code=400, detail="Name and email are required.")

    existing_member = await db.team_members.find_one({"email": email}, {"_id": 0})
    if existing_member and any(company_id in (existing_member.get("companies") or []) for company_id in company_ids):
        raise HTTPException(status_code=409, detail="A team member with this email already exists for one of the selected companies.")

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    temporary_password = None
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        temporary_password = payload.password or secrets.token_urlsafe(8)
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": "",
            "password_hash": pwd_context.hash(temporary_password),
            "auth_provider": "local",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    if existing_member:
        merged_companies = list(dict.fromkeys([*(existing_member.get("companies") or []), *company_ids]))
        await db.team_members.update_one(
            {"member_id": existing_member["member_id"]},
            {"$set": {"name": name, "role": role, "companies": merged_companies, "status": "Active", "approved_by": user["user_id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        member = await db.team_members.find_one({"member_id": existing_member["member_id"]}, {"_id": 0})
    else:
        member = {
            "member_id": f"mem_{uuid.uuid4().hex[:10]}",
            "user_id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "companies": company_ids,
            "status": "Active",
            "approved_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.team_members.insert_one(member)
    for target_company_id in company_ids:
        await notify_owner_security_change(
            target_company_id,
            "Team member added",
            f"{user.get('name') or user.get('email') or user['user_id']} added {name} ({email}) as {role}.",
            user,
        )
    member.pop("_id", None)
    return {**member, "temporary_password": temporary_password}

@api_router.post("/register-request")
async def register_request(request: Request):
    body = await request.json()
    reg = {
        "request_id": f"reg_{uuid.uuid4().hex[:10]}",
        "name": body.get("name", ""),
        "email": body.get("email", ""),
        "role_requested": normalize_role(body.get("role", "STAFF")),
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pending_registrations.insert_one(reg)
    reg.pop("_id", None)
    return reg

@api_router.post("/team-members/{request_id}/approve")
async def approve_member(request_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    role = normalize_role(body.get("role", "STAFF"))
    companies = body.get("companies", [])
    for company_id in companies:
        await require_role(user, company_id, ["OWNER"])
    reg = await db.pending_registrations.find_one({"request_id": request_id}, {"_id": 0})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    existing_user = await db.users.find_one({"email": reg["email"].strip().lower()}, {"_id": 0})
    existing_member = await db.team_members.find_one({"email": reg["email"].strip().lower()}, {"_id": 0})
    if existing_member:
        merged_companies = list(dict.fromkeys([*(existing_member.get("companies") or []), *companies]))
        await db.team_members.update_one(
            {"member_id": existing_member["member_id"]},
            {"$set": {
                "name": reg["name"],
                "email": reg["email"].strip().lower(),
                "user_id": existing_user.get("user_id") if existing_user else existing_member.get("user_id", ""),
                "role": role,
                "companies": merged_companies,
                "status": "Active",
                "approved_by": user["user_id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        member = await db.team_members.find_one({"member_id": existing_member["member_id"]}, {"_id": 0})
    else:
        member = {
            "member_id": f"mem_{uuid.uuid4().hex[:10]}",
            "name": reg["name"],
            "email": reg["email"].strip().lower(),
            "user_id": existing_user.get("user_id") if existing_user else "",
            "role": role,
            "companies": companies,
            "status": "Active",
            "approved_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.team_members.insert_one(member)
    await db.pending_registrations.update_one({"request_id": request_id}, {"$set": {"status": "Approved"}})
    for company_id in companies:
        await notify_owner_security_change(
            company_id,
            "Team access approved",
            f"{user.get('name') or user.get('email') or user['user_id']} approved {reg.get('name')} ({reg.get('email')}) as {role}.",
            user,
        )
    member.pop("_id", None)
    return member

@api_router.post("/team-members/{request_id}/reject")
async def reject_member(request_id: str, user: dict = Depends(get_current_user)):
    reg = await db.pending_registrations.find_one({"request_id": request_id}, {"_id": 0})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    await require_role(user, reg.get("company_id", ""), ["OWNER"])
    await db.pending_registrations.update_one({"request_id": request_id}, {"$set": {"status": "Rejected"}})
    if reg.get("company_id"):
        await notify_owner_security_change(
            reg.get("company_id"),
            "Team access rejected",
            f"{user.get('name') or user.get('email') or user['user_id']} rejected access for {reg.get('name')} ({reg.get('email')}).",
            user,
        )
    return {"ok": True}

@api_router.put("/team-members/{member_id}/role")
async def update_member_role(member_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    companies = [company_id for company_id in body.get("companies", []) if company_id]
    for company_id in companies:
        await require_role(user, company_id, ["OWNER"])
    new_role = normalize_role(body.get("role", "STAFF"))
    before = await db.team_members.find_one({"member_id": member_id}, {"_id": 0})
    await db.team_members.update_one({"member_id": member_id}, {"$set": {"role": new_role, "companies": companies}})
    updated = await db.team_members.find_one({"member_id": member_id}, {"_id": 0})
    for company_id in companies:
        await notify_owner_security_change(
            company_id,
            "Team role changed",
            f"{user.get('name') or user.get('email') or user['user_id']} changed {updated.get('name') or updated.get('email')} from {before.get('role') if before else 'Unknown'} to {new_role}.",
            user,
        )
    return updated

@api_router.delete("/team-members/{member_id}")
async def delete_team_member(member_id: str, company_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    member = await db.team_members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    target_company = company_id or (member.get("companies") or [""])[0]
    await require_role(user, target_company, ["OWNER"])

    if normalize_role(member.get("role")) == "OWNER":
        owner_count = await db.team_members.count_documents({"companies": target_company, "role": {"$in": ["OWNER", "Owner", "Admin"]}})
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the only Owner from this company.")

    await db.team_members.delete_one({"member_id": member_id})
    await notify_owner_security_change(
        target_company,
        "Team member removed",
        f"{user.get('name') or user.get('email') or user['user_id']} removed {member.get('name') or member.get('email')} from this company.",
        user,
    )
    return {"ok": True}

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

WHOLE_FISH_SHEET_MARKERS = {"IQF WHOLE FISH", "WHOLE FISH"}
PACK_LABEL_KEYWORDS = {"PCS", "PACK", "PKT", "BOX", "BLK", "TRAY", "BAG", "CTN", "EACH", "UNIT"}
WEIGHT_LABEL_KEYWORDS = {"GM", "G", "KG", "LB", "LBS", "OZ"}


def _clean_catalog_category(sheet_title: str) -> str:
    raw = re.sub(r"[^\w/& -]+", " ", str(sheet_title or "")).strip().upper()
    raw = re.sub(r"\s+", " ", raw)
    mapping = {
        "250 GM BLOCK FISH": "250 GM BLOCK FISH",
        "500 GM BLOCK FISH": "500 GM BLOCK FISH",
        "IQFTRAY & VACUUM PACK": "IQF / VP PACK / VP TRAY / VP STEAKS / FILLETS",
        "IQF TRAY & VACUUM PACK": "IQF / VP PACK / VP TRAY / VP STEAKS / FILLETS",
        "IQF WHOLE FISH": "IQF WHOLE FISH",
        "SHRIMP": "SHRIMP",
        "SWEET": "SWEET",
        "SWEETS": "SWEET",
        "SNACKS": "SNACKS",
        "R2E": "READY TO COOKED",
        "READY TO COOKED": "READY TO COOKED",
        "VEGETABLE": "FROZEN VEGETABLE",
        "FROZEN VEGETABLE": "FROZEN VEGETABLE",
        "VORTA": "VORTA",
        "DRY FISH": "DRY FISH",
    }
    return mapping.get(raw, raw.title())


def _normalize_catalog_name(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "").replace("\n", " ").strip()).upper()
    text = re.sub(r"\s*/\s*", " / ", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"\(\s+", "(", text)
    return text.strip()


def _clean_catalog_price(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    text = str(value or "").upper().replace(",", "").strip()
    match = re.search(r"(\d+(?:\.\d+)?)", text.replace("$.", "$0."))
    return round(float(match.group(1)), 2) if match else 0.0


def _extract_stock_flag(values: List[str]) -> bool:
    cleaned = [str(value or "").strip().upper() for value in values]
    if any(value == "Y" for value in cleaned):
        return True
    if any(value == "N" for value in cleaned):
        return False
    return False


def _clean_packing_text(value: str) -> str:
    text = _normalize_catalog_name(value)
    text = re.sub(r"\s*X\s*", " X ", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_reference_price_from_packing(packing_text: str) -> float:
    packing = _clean_packing_text(packing_text)
    match = re.search(r"@\s*(\d+(?:\.\d+)?)", packing.replace("$.", "$0."))
    return round(float(match.group(1)), 2) if match else 0.0


def _extract_price_suffix_from_packing(packing_text: str) -> str:
    packing = _clean_packing_text(packing_text)
    match = re.search(r"@\s*\d+(?:\.\d+)?\s*([A-Z]+)?", packing)
    return (match.group(1) or "").upper() if match else ""


def _infer_pack_quantity_and_label(packing_text: str) -> tuple[int, str]:
    packing = _clean_packing_text(packing_text)
    trailing_match = re.search(r"X\s*(\d+)\s*([A-Z]+)?", packing)
    if trailing_match:
        qty = int(trailing_match.group(1))
        suffix_label = (trailing_match.group(2) or "").upper()
        if suffix_label not in WEIGHT_LABEL_KEYWORDS and qty > 0:
            if suffix_label in PACK_LABEL_KEYWORDS:
                return qty, suffix_label
            prefix = packing[: trailing_match.start()]
            prefix_match = re.search(r"\b(PACK|PKT|BOX|BLK|TRAY|BAG|PCS|EACH|UNIT)\b", prefix)
            return qty, (prefix_match.group(1) if prefix_match else "PCS")
    leading_match = re.search(r"^(\d+)\s*(BOX|PKT|PACK|PCS|BLK|TRAY|BAG|CTN|EACH|UNIT)\b", packing)
    if leading_match:
        return int(leading_match.group(1)), leading_match.group(2)
    if re.search(r"\b\d+(?:\.\d+)?\s*KG\s*BOX\b", packing):
        return 1, "BOX"
    return 1, "UNIT"


def _is_pack_based_line(packing_text: str) -> bool:
    packing = _clean_packing_text(packing_text)
    if " EACH" in f" {packing} " or " IN 1" in packing:
        return True
    qty, label = _infer_pack_quantity_and_label(packing)
    return qty > 1 or label in {"PACK", "PKT", "BLK", "BOX", "PCS", "EACH", "TRAY", "BAG", "CTN"}


def _is_whole_fish_size_line(packing_text: str) -> bool:
    packing = _clean_packing_text(packing_text)
    if not packing or _is_pack_based_line(packing):
        return False
    return bool(re.search(r"^\d+(?:\s*-\s*\d+)?\s*KG\s*UP(?:\s*SIZES?)?$", packing))


def _extract_box_weights(packing_text: str) -> tuple[float, float]:
    packing = _clean_packing_text(packing_text)
    kg_match = re.search(r"(\d+(?:\.\d+)?)\s*KGS?\b", packing)
    lb_match = re.search(r"(\d+(?:\.\d+)?)\s*LBS?\b", packing)
    if kg_match or lb_match:
        kg = round(float(kg_match.group(1)), 2) if kg_match else 0.0
        lb = round(float(lb_match.group(1)), 2) if lb_match else 0.0
        if kg <= 0 and lb > 0:
            kg = round(lb / 2.205, 2)
        if lb <= 0 and kg > 0:
            lb = round(kg * 2.205, 2)
        if kg > 0 or lb > 0:
            return kg or 20.0, lb or 44.10
    return 20.0, 44.10


def _build_pack_display(units_per_case: int, unit_label: str) -> str:
    label = (unit_label or "UNIT").upper()
    return f"{int(units_per_case)} {label}/CASE"


def _build_catalog_description(packing_text: str, product_mode: str, default_box_weight_lb: float = 0) -> str:
    packing = _clean_packing_text(packing_text)
    if product_mode == "WEIGHT":
        return f"{packing} · {default_box_weight_lb:.2f} LB DEFAULT BOX".strip()
    return packing


def _build_catalog_sku(category: str, name: str) -> str:
    base = re.sub(r"[^A-Z0-9]+", "-", f"{category}-{name}".upper()).strip("-")
    return base[:48]


def _parse_catalog_product_record(
    name: str,
    category: str,
    packing_text: str,
    box_price_text,
    in_stock: bool,
    box_cost_text=None,
    preferred_vendor: str = "",
) -> dict:
    normalized_name = _normalize_catalog_name(name)
    normalized_packing = _clean_packing_text(packing_text)
    box_price = _clean_catalog_price(box_price_text)
    box_cost = _clean_catalog_price(box_cost_text)
    reference_price = _extract_reference_price_from_packing(normalized_packing)
    price_suffix = _extract_price_suffix_from_packing(normalized_packing)
    units_per_case, unit_label = _infer_pack_quantity_and_label(normalized_packing)
    default_box_weight_kg, default_box_weight_lb = _extract_box_weights(normalized_packing)
    has_box_weight = default_box_weight_lb > 0 and re.search(r"\b(KG|KGS|LB|LBS)\b", normalized_packing)
    price_basis = "LB" if price_suffix in {"LB", "LBS"} or (has_box_weight and units_per_case == 1 and reference_price > 0) else ""
    size_range = normalized_packing if _is_whole_fish_size_line(normalized_packing) else ""
    default_box_price = 0.0
    product_mode = "CASE"
    cost_type = "CASE"
    unit_type = unit_label if unit_label in {"BOX", "PACK", "PKT", "BLK", "PCS", "EACH", "UNIT"} else "PCS"
    if price_basis == "LB":
        product_mode = "WEIGHT"
        unit_type = "LB"
        units_per_case = 1
        unit_label = "BOX"
        default_box_price = box_price
    elif re.search(r"\b\d+(?:\.\d+)?\s*KG\s*BOX\b", normalized_packing):
        units_per_case = 1
        unit_label = "BOX"
        unit_type = "BOX"
    elif unit_label == "UNIT":
        unit_label = "PCS"
        unit_type = "PCS"

    if reference_price > 0:
        unit_price = reference_price
    elif product_mode == "WEIGHT" and default_box_weight_lb > 0:
        unit_price = round(box_price / default_box_weight_lb, 4)
    elif units_per_case > 0:
        unit_price = round(box_price / units_per_case, 4)
    else:
        unit_price = box_price

    if product_mode == "WEIGHT":
        case_price = box_price
        effective_case_price = box_price
    else:
        case_price = box_price
        effective_case_price = box_price

    if box_cost > 0:
        if product_mode == "WEIGHT" and default_box_weight_lb > 0:
            unit_cost = round(box_cost / default_box_weight_lb, 4)
        elif units_per_case > 0:
            unit_cost = round(box_cost / units_per_case, 4)
        else:
            unit_cost = box_cost
        case_cost = round(box_cost, 2)
        cost_price = unit_cost
    else:
        unit_cost = 0
        case_cost = 0
        cost_price = 0

    description = normalized_packing

    return {
        "name": normalized_name,
        "description": description,
        "packing_text": normalized_packing,
        "product_type": "Inventory",
        "type": "Inventory",
        "category": category,
        "brand": "",
        "product_mode": product_mode,
        "cost_type": cost_type,
        "unit_type": unit_type,
        "unit_label": unit_label,
        "units_per_case": units_per_case,
        "unit_price": unit_price,
        "case_price": case_price,
        "case_price_override": None,
        "effective_case_price": effective_case_price,
        "price_basis": price_basis,
        "size_range": size_range,
        "default_box_weight_kg": default_box_weight_kg if product_mode == "WEIGHT" else 0,
        "default_box_weight_lb": default_box_weight_lb if product_mode == "WEIGHT" else 0,
        "default_box_price": default_box_price if product_mode == "WEIGHT" else 0,
        "actual_dispatch_weight_lb": 0,
        "actual_dispatch_unit_price": 0,
        "final_dispatch_box_price": 0,
        "stock_cases": 0,
        "cases_on_hand": 0,
        "available_cases": 0,
        "stock_units_on_hand": 0,
        "available_stock_units": 0,
        "cost_price": cost_price,
        "unit_cost": unit_cost,
        "case_cost": case_cost,
        "in_stock": bool(in_stock),
        "sku": _build_catalog_sku(category, normalized_name),
        "barcode": "",
        "notes": f"Preferred Vendor: {preferred_vendor}".strip(": ") if preferred_vendor else "",
        "weight_info": normalized_packing if product_mode == "WEIGHT" else "",
        "pack_display": _build_pack_display(units_per_case, unit_label) if product_mode != "WEIGHT" else f"{default_box_weight_kg:.0f} KG BOX",
    }


def _dedupe_catalog_records(records: List[dict]) -> tuple[List[dict], int]:
    deduped = {}
    duplicates = 0
    for record in records:
        key = f"{record.get('category', '').upper()}::{record.get('name', '').upper()}"
        if key in deduped:
            duplicates += 1
        deduped[key] = record
    return list(deduped.values()), duplicates


def _read_catalog_rows_from_workbook(content: bytes) -> List[dict]:
    workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    records: List[dict] = []
    for worksheet in workbook.worksheets:
        category = _clean_catalog_category(worksheet.title)
        rows = [list(row) for row in worksheet.iter_rows(values_only=True)]
        header_index = None
        for index, row in enumerate(rows):
            cells = [str(value or "").strip().upper() for value in row]
            if "PRODUCT NAME" in cells and any("PACKING" in cell for cell in cells):
                header_index = index
                break
        if header_index is None:
            continue
        header_row = [str(value or "").strip().upper() for value in rows[header_index]]
        product_col = header_row.index("PRODUCT NAME")
        packing_col = next(i for i, cell in enumerate(header_row) if "PACKING" in cell)
        price_col = next(i for i, cell in enumerate(header_row) if "UNIT PRICE" in cell)
        stock_col = next((i for i, cell in enumerate(header_row) if "IN STOCK" in cell), None)
        current_whole_fish_name = ""
        for row in rows[header_index + 1:]:
            cells = [str(value).strip() if value is not None else "" for value in row]
            if not any(cells):
                continue
            raw_name = cells[product_col].strip() if product_col < len(cells) else ""
            packing_text = cells[packing_col].strip() if packing_col < len(cells) else ""
            price_text = cells[price_col].strip() if price_col < len(cells) else ""
            if not packing_text and not price_text and not raw_name:
                continue

            final_name = raw_name
            if category == "IQF WHOLE FISH":
                if raw_name:
                    current_whole_fish_name = _normalize_catalog_name(raw_name)
                if current_whole_fish_name and packing_text and price_text:
                    final_name = f"{current_whole_fish_name} {packing_text}"
                elif not final_name:
                    final_name = current_whole_fish_name

            if not final_name or not packing_text or _clean_catalog_price(price_text) <= 0:
                continue
            stock_values = cells[stock_col:stock_col + 2] if stock_col is not None else cells
        records.append(_parse_catalog_product_record(
            name=final_name,
            category=category,
            packing_text=packing_text,
            box_price_text=price_text,
            in_stock=_extract_stock_flag(stock_values),
        ))
    return records


def _read_catalog_rows_from_csv(content: bytes) -> List[dict]:
    text = _decode_file_bytes(content)
    reader = csv.DictReader(io.StringIO(text))
    records = []
    for raw_row in reader:
        row = _normalize_row_keys(raw_row)
        name = _pick(row, "product_name", "name", "product")
        category = _pick(row, "category", "sheet", "group") or "UNASSIGNED"
        packing_text = _pick(row, "packing_qty", "packing", "qty", "description")
        price_text = _pick(row, "selling_price", "sale_price", "price", "unit_price")
        cost_text = _pick(row, "cost", "cost_price", "purchase_cost", "case_cost")
        stock_text = _pick(row, "in_stock_y_n", "in_stock", "status")
        preferred_vendor = _pick(row, "preferred_vendor", "vendor", "supplier")
        if not name or not packing_text or _clean_catalog_price(price_text) <= 0:
            continue
        records.append(_parse_catalog_product_record(
            name=name,
            category=_clean_catalog_category(category),
            packing_text=packing_text,
            box_price_text=price_text,
            in_stock=str(stock_text).strip().upper() == "Y",
            box_cost_text=cost_text,
            preferred_vendor=preferred_vendor,
        ))
    return records


@api_router.post("/companies/{company_id}/import/products")
async def import_products_catalog(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx") or filename.endswith(".xlsm"):
        records = _read_catalog_rows_from_workbook(content)
    else:
        records = _read_catalog_rows_from_csv(content)

    deduped_records, duplicates_removed = _dedupe_catalog_records(records)
    imported = 0
    updated = 0
    categories = set()
    errors = []

    for record in deduped_records:
        try:
            payload = build_product_payload(ProductCreate(**record))
            payload.update({
                "company_id": company_id,
                "product_id": f"prod_{uuid.uuid4().hex[:10]}",
                "status": "Active",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            existing = await db.products.find_one(active_company_query(company_id, {
                "name": payload["name"],
                "category": payload.get("category", ""),
            }))
            if existing:
                await db.products.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {**payload, "product_id": existing["product_id"]}},
                )
                updated += 1
            else:
                await db.products.insert_one(payload)
                imported += 1
            categories.add(payload.get("category") or "UNASSIGNED")
        except Exception as exc:
            errors.append({"name": record.get("name", ""), "error": str(exc)})

    return {
        "type": "products",
        "imported": imported,
        "updated": updated,
        "duplicates_removed": duplicates_removed,
        "categories_created": len(categories),
        "errors": errors,
    }


def _decode_file_bytes(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return content.decode(enc)
        except Exception:
            continue
    return content.decode("utf-8", errors="ignore")


def _norm_col(col: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (col or "").strip().lower()).strip("_")


def _normalize_row_keys(row: dict) -> dict:
    return {_norm_col(k): (v or "").strip() if isinstance(v, str) else v for k, v in row.items()}


def _to_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (float, int)):
        return float(value)
    cleaned = re.sub(r"[,$ ]", "", str(value))
    try:
        return float(cleaned) if cleaned else default
    except Exception:
        return default


def _pick(row: dict, *keys: str) -> str:
    for key in keys:
        v = row.get(key)
        if v not in (None, "", "NULL", "null"):
            return str(v).strip()
    return ""


def _today_str() -> str:
    return datetime.now(timezone.utc).isoformat().split("T")[0]


async def _insert_qb_customer(company_id: str, row: dict, user_id: str):
    name = _pick(row, "name", "customer", "customer_name", "full_name")
    if not name:
        return False
    await db.customers.insert_one({
        "customer_id": f"cust_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "name": name,
        "company_name": _pick(row, "company", "company_name"),
        "phone": _pick(row, "phone", "main_phone"),
        "email": _pick(row, "email", "email_address"),
        "address": _pick(row, "address", "billing_address", "ship_address"),
        "tax_id": _pick(row, "tax_id", "taxid"),
        "notes": _pick(row, "notes", "memo"),
        "open_balance": _to_float(_pick(row, "open_balance", "balance", "balance_total")),
        "total_invoiced": _to_float(_pick(row, "total_invoiced")),
        "last_invoice_date": None,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id
    })
    return True


async def _insert_qb_vendor(company_id: str, row: dict, user_id: str):
    name = _pick(row, "name", "vendor", "vendor_name", "full_name")
    if not name:
        return False
    await db.vendors.insert_one({
        "vendor_id": f"vnd_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "name": name,
        "company_name": _pick(row, "company", "company_name"),
        "phone": _pick(row, "phone", "main_phone"),
        "email": _pick(row, "email", "email_address"),
        "address": _pick(row, "address", "billing_address"),
        "tax_id": _pick(row, "tax_id", "taxid"),
        "default_expense_account": _pick(row, "expense_account", "account"),
        "notes": _pick(row, "notes", "memo"),
        "payable_balance": _to_float(_pick(row, "balance", "open_balance", "balance_total")),
        "total_billed": 0,
        "bill_count": 0,
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id
    })
    return True


async def _insert_qb_product(company_id: str, row: dict, user_id: str):
    name = _pick(row, "item", "name", "product", "item_name")
    if not name:
        return False
    await db.products.insert_one({
        "product_id": f"prod_{uuid.uuid4().hex[:10]}",
        "company_id": company_id,
        "name": name,
        "description": _pick(row, "description", "desc", "sales_desc"),
        "category": _pick(row, "type", "category", "item_type"),
        "unit": _pick(row, "unit", "uom") or "pcs",
        "cost_price": _to_float(_pick(row, "cost", "purchase_cost", "average_cost")),
        "selling_price": _to_float(_pick(row, "price", "sales_price", "unit_price")),
        "case_price": _to_float(_pick(row, "case_price")),
        "case_quantity": int(_to_float(_pick(row, "case_qty", "case_quantity"), 1)),
        "weight_info": _pick(row, "weight_info"),
        "sku": _pick(row, "sku", "item_number") or f"SKU-{uuid.uuid4().hex[:6].upper()}",
        "status": "Active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id
    })
    return True


async def _import_quickbooks_csv(company_id: str, text: str, user_id: str) -> dict:
    reader = csv.DictReader(io.StringIO(text))
    headers = [_norm_col(h or "") for h in (reader.fieldnames or [])]
    rows = [_normalize_row_keys(r) for r in reader]
    imported = {"customers": 0, "vendors": 0, "products": 0, "invoices": 0, "bills": 0}
    dataset = "unknown"

    if any(h in headers for h in ("customer", "customer_name", "balance_total")) and "vendor" not in headers:
        dataset = "customers"
        for row in rows:
            if await _insert_qb_customer(company_id, row, user_id):
                imported["customers"] += 1
    elif any(h in headers for h in ("vendor", "vendor_name", "terms")):
        dataset = "vendors"
        for row in rows:
            if await _insert_qb_vendor(company_id, row, user_id):
                imported["vendors"] += 1
    elif any(h in headers for h in ("item", "item_name", "sales_price", "purchase_cost", "average_cost")):
        dataset = "items"
        for row in rows:
            if await _insert_qb_product(company_id, row, user_id):
                imported["products"] += 1
    elif any(h in headers for h in ("invoice_number", "num", "invoice", "txn_number")):
        dataset = "invoices"
        grouped = {}
        for row in rows:
            inv_no = _pick(row, "invoice_number", "num", "invoice", "txn_number") or f"INV-{uuid.uuid4().hex[:8].upper()}"
            grouped.setdefault(inv_no, []).append(row)
        for inv_no, lines in grouped.items():
            first = lines[0]
            items = []
            subtotal = 0.0
            for ln in lines:
                amount = _to_float(_pick(ln, "amount"))
                qty = _to_float(_pick(ln, "qty", "quantity"), 1)
                rate = _to_float(_pick(ln, "rate", "price"), amount / qty if qty else amount)
                items.append({
                    "product": _pick(ln, "item", "product", "description"),
                    "description": _pick(ln, "description", "memo"),
                    "quantity": qty,
                    "unit": _pick(ln, "unit") or "pcs",
                    "rate": rate,
                    "discount": 0,
                    "tax": 0,
                    "amount": amount if amount else round(qty * rate, 2),
                })
                subtotal += items[-1]["amount"]
            total = _to_float(_pick(first, "total")) or subtotal
            invoice = {
                "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "invoice_number": inv_no,
                "customer_id": "",
                "customer_name": _pick(first, "customer", "customer_name", "name"),
                "invoice_date": _pick(first, "date", "invoice_date", "txn_date") or _today_str(),
                "due_date": _pick(first, "due_date") or _today_str(),
                "sales_rep": "",
                "warehouse": "Main Warehouse",
                "items": items,
                "notes": _pick(first, "memo"),
                "terms": _pick(first, "terms") or "Net 30",
                "subtotal": round(subtotal, 2),
                "tax_total": 0,
                "discount_total": 0,
                "total": round(total, 2),
                "status": "Sent",
                "payment_status": "Unpaid",
                "amount_paid": 0,
                "balance_due": round(total, 2),
                "payments": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user_id,
            }
            await db.invoices.insert_one(invoice)
            imported["invoices"] += 1
    elif "name" in headers and not any(h in headers for h in ("item", "item_name", "sales_price", "cost", "purchase_cost", "average_cost", "price")):
        dataset = "customers"
        for row in rows:
            if await _insert_qb_customer(company_id, row, user_id):
                imported["customers"] += 1
    else:
        # Fallback attempt: treat rows as products if item-like columns exist.
        dataset = "fallback_items"
        for row in rows:
            if await _insert_qb_product(company_id, row, user_id):
                imported["products"] += 1

    return {"dataset": dataset, "rows": len(rows), "imported": imported}


async def _import_quickbooks_iif(company_id: str, text: str, user_id: str) -> dict:
    imported = {"customers": 0, "vendors": 0, "products": 0, "invoices": 0, "bills": 0}
    lines = [ln for ln in text.splitlines() if ln.strip()]
    current_headers = {}
    current_trns = None
    current_spl = []

    for raw_line in lines:
        parts = raw_line.split("\t")
        tag = (parts[0] or "").strip().upper()
        values = parts[1:]

        if tag.startswith("!"):
            current_headers[tag[1:]] = [v.strip() for v in values]
            continue

        if tag == "CUST":
            headers = current_headers.get("CUST", [])
            row = _normalize_row_keys(dict(zip(headers, values)))
            if await _insert_qb_customer(company_id, row, user_id):
                imported["customers"] += 1
            continue

        if tag == "VEND":
            headers = current_headers.get("VEND", [])
            row = _normalize_row_keys(dict(zip(headers, values)))
            if await _insert_qb_vendor(company_id, row, user_id):
                imported["vendors"] += 1
            continue

        if tag == "INVITEM":
            headers = current_headers.get("INVITEM", [])
            row = _normalize_row_keys(dict(zip(headers, values)))
            if await _insert_qb_product(company_id, row, user_id):
                imported["products"] += 1
            continue

        if tag == "TRNS":
            headers = current_headers.get("TRNS", [])
            current_trns = _normalize_row_keys(dict(zip(headers, values)))
            current_spl = []
            continue

        if tag == "SPL":
            headers = current_headers.get("SPL", [])
            current_spl.append(_normalize_row_keys(dict(zip(headers, values))))
            continue

        if tag == "ENDTRNS" and current_trns:
            trns_type = _pick(current_trns, "trnstype", "txn_type").upper()
            if trns_type == "INVOICE":
                items = []
                subtotal = 0.0
                for spl in current_spl:
                    amount = abs(_to_float(_pick(spl, "amount")))
                    qty = abs(_to_float(_pick(spl, "qnty"), 1))
                    rate = amount / qty if qty else amount
                    items.append({
                        "product": _pick(spl, "item", "name", "memo"),
                        "description": _pick(spl, "memo"),
                        "quantity": qty,
                        "unit": "pcs",
                        "rate": rate,
                        "discount": 0,
                        "tax": 0,
                        "amount": amount,
                    })
                    subtotal += amount
                total = abs(_to_float(_pick(current_trns, "amount"))) or subtotal
                await db.invoices.insert_one({
                    "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
                    "company_id": company_id,
                    "invoice_number": _pick(current_trns, "docnum") or f"INV-{uuid.uuid4().hex[:8].upper()}",
                    "customer_id": "",
                    "customer_name": _pick(current_trns, "name"),
                    "invoice_date": _pick(current_trns, "date") or _today_str(),
                    "due_date": _pick(current_trns, "duedate") or _today_str(),
                    "sales_rep": "",
                    "warehouse": "Main Warehouse",
                    "items": items,
                    "notes": _pick(current_trns, "memo"),
                    "terms": "Net 30",
                    "subtotal": round(subtotal, 2),
                    "tax_total": 0,
                    "discount_total": 0,
                    "total": round(total, 2),
                    "status": "Sent",
                    "payment_status": "Unpaid",
                    "amount_paid": 0,
                    "balance_due": round(total, 2),
                    "payments": [],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": user_id,
                })
                imported["invoices"] += 1
            elif trns_type in ("BILL", "CHECK"):
                total = abs(_to_float(_pick(current_trns, "amount")))
                await db.bills.insert_one({
                    "bill_id": f"bill_{uuid.uuid4().hex[:10]}",
                    "company_id": company_id,
                    "vendor_id": "",
                    "vendor_name": _pick(current_trns, "name"),
                    "bill_number": _pick(current_trns, "docnum") or f"BILL-{uuid.uuid4().hex[:8].upper()}",
                    "bill_date": _pick(current_trns, "date") or _today_str(),
                    "due_date": _pick(current_trns, "duedate") or _today_str(),
                    "items": [],
                    "notes": _pick(current_trns, "memo"),
                    "total": total,
                    "amount_paid": 0,
                    "balance_due": total,
                    "status": "Open",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": user_id,
                })
                imported["bills"] += 1
            current_trns = None
            current_spl = []

    return {"dataset": "iif", "rows": len(lines), "imported": imported}


@api_router.post("/companies/{company_id}/import/quickbooks-desktop")
async def import_quickbooks_desktop(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    content = await file.read()
    text = _decode_file_bytes(content)
    file_name = (file.filename or "").lower()
    if file_name.endswith(".iif"):
        result = await _import_quickbooks_iif(company_id, text, user["user_id"])
    else:
        result = await _import_quickbooks_csv(company_id, text, user["user_id"])
    return {
        "status": "ok",
        "type": "quickbooks_desktop",
        "file_name": file.filename,
        **result,
    }

# ─── Scheduled Alert (Manual Trigger / Cron-Ready) ───

@api_router.post("/scheduled/daily-low-stock-check")
async def daily_low_stock_check():
    """Check all companies for low stock and send alerts. Designed to be called by a cron job."""
    if not ALERT_RECIPIENT_EMAIL:
        return {"status": "skipped", "reason": "No alert recipient"}
    results = []
    for company in await get_companies_list():
        cid = company["company_id"]
        items = await db.inventory.find({"company_id": cid}, {"_id": 0}).to_list(500)
        low_stock = [i for i in items if i.get("stock_on_hand", 0) <= i.get("reorder_point", 10)]
        if not low_stock:
            results.append({"company": cid, "status": "ok", "low_stock": 0})
            continue
        rows = ""
        for item in low_stock:
            rows += f"<tr><td style='padding:6px 10px;font-size:12px;'>{item.get('sku','')}</td><td style='padding:6px 10px;font-size:12px;font-weight:600;'>{item.get('product_name','')}</td><td style='padding:6px 10px;font-size:12px;color:#BA1A1A;font-weight:700;text-align:right;'>{item.get('stock_on_hand',0)}</td><td style='padding:6px 10px;font-size:12px;text-align:right;'>{item.get('reorder_point',0)}</td></tr>"
        html = f"<div style='font-family:Inter,sans-serif;max-width:600px;margin:0 auto;'><h2 style='color:#191C1E;'>Daily Low Stock Alert - {company['name']}</h2><p>{len(low_stock)} item(s) below reorder point.</p><table style='width:100%;border-collapse:collapse;'><thead><tr style='background:#F7F9FB;border-bottom:1px solid #C4C5D7;'><th style='padding:6px 10px;text-align:left;font-size:11px;'>SKU</th><th style='padding:6px 10px;text-align:left;font-size:11px;'>Product</th><th style='padding:6px 10px;text-align:right;font-size:11px;'>Stock</th><th style='padding:6px 10px;text-align:right;font-size:11px;'>Reorder</th></tr></thead><tbody>{rows}</tbody></table><p style='font-size:10px;color:#434655;margin-top:16px;'>{branded_footer_text(' - Automated Alert')}</p></div>"
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
    return {"message": f"{APP_DISPLAY_NAME} API"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


PUBLIC_AUTH_PATHS = {
    "/api/",
    "/api/companies",
    "/api/auth/login",
    "/api/auth/login-local",
    "/api/auth/register-local",
    "/api/auth/session",
    "/api/auth/logout",
}


@app.middleware("http")
async def company_scope_guard(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api"):
        return await call_next(request)

    if path in PUBLIC_AUTH_PATHS or path.startswith("/api/companies/") and request.method.upper() == "GET" and path.count("/") == 4:
        return await call_next(request)

    if path.startswith("/api/companies/") or path.startswith("/api/settings/"):
        try:
            session = await get_current_session(request)
            user = await get_current_user(request)
            await ensure_company_request_access(request, user, session)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return await call_next(request)



# ─── AI Import Center Routes ───

async def _create_ai_upload_record(company_id: str, user_id: str, file_name: str, file_type: str, file_size: int, file_base64: str) -> dict:
    upload = {
        "upload_id": f"upload_{uuid.uuid4().hex[:12]}",
        "company_id": company_id,
        "user_id": user_id,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": file_size,
        "file_base64": file_base64,
        "status": "pending",
        "detected_type": None,
        "confidence": 0.0,
        "extracted_data": {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ai_uploads.insert_one(upload)
    upload.pop("_id", None)
    return upload


def _validate_ai_import_upload(file_name: str, file_type: str, file_size: int):
    extension = Path(file_name or "").suffix.lower()
    normalized_type = (file_type or "").lower()
    if not file_name:
        raise HTTPException(status_code=400, detail="No file was provided.")
    if extension not in AI_IMPORT_ALLOWED_EXTENSIONS and normalized_type not in AI_IMPORT_ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed types: PDF, PNG, JPG, CSV, XLSX."
        )
    if file_size <= 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if file_size > AI_IMPORT_MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit.")


async def _extract_ai_upload_data(company_id: str, upload_id: str) -> dict:
    upload = await db.ai_uploads.find_one({"upload_id": upload_id, "company_id": company_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    await db.ai_uploads.update_one(
        {"upload_id": upload_id},
        {"$set": {"status": "processing"}}
    )

    try:
        key = llm_api_key()
        if not key:
            raise HTTPException(status_code=503, detail="AI is not configured. Set your AI provider key in backend/.env.")

        chat = LlmChat(
            api_key=key,
            session_id=f"ai_upload_{upload_id}",
            system_message="You are a document extraction assistant for a wholesale distribution and import warehouse business. Extract structured data from invoices, bills, receipts, container packing lists, bill of lading files, and stock receiving documents. Always respond in valid JSON."
        ).with_model("openai", OPENAI_MODEL)

        image_content = ImageContent(
            image_base64=upload["file_base64"],
            mime_type=upload.get("file_type") or "image/png",
        )
        prompt = """Analyze this document and extract the following information in JSON format:

{
  "detected_type": "invoice|bill|expense|stock_receipt|customer_payment|unknown",
  "confidence": 0.0-1.0,
  "extracted_fields": {
    // For invoice: customer_name, invoice_number, invoice_date, items[{description, quantity, price}], total
    // For bill: vendor_name, bill_number, bill_date, items[{description, quantity, cost}], total
    // For expense: vendor_name, date, amount, category, reference, memo
    // For stock receipt: vendor_name, supplier_name, invoice_number, container_number, shipment_date, eta, reference, warehouse, items[{product_name, description, cartons, quantity, net_weight, unit_cost, sku}], total
    // For customer_payment: customer_name, payment_date, amount, payment_method, reference, memo
  },
  "suggestions": ["any clarifying questions if unsure"]
}

Important:
- detected_type should be your best guess
- confidence: 1.0 if very clear, 0.5 if somewhat unclear, 0.3 if very unclear
- If confidence < 0.7, add suggestions with questions
- For stock receipt documents, prioritize: supplier, container no, invoice no, shipment date, ETA, product names, cartons/CTNS, net weight (KGS), and unit price
- Extract all visible text fields"""

        user_message = UserMessage(
            text=prompt,
            file_contents=[image_content]
        )
        response = await chat.send_message(user_message)

        raw = (response or "").strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw.lstrip("`")
            if raw.rstrip().endswith("```"):
                raw = raw.rstrip().rstrip("`").rstrip()
        try:
            extracted = json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                extracted = json.loads(match.group(0))
            else:
                extracted = {
                    "detected_type": "unknown",
                    "confidence": 0.0,
                    "extracted_fields": {
                        "raw_response": raw
                    },
                    "suggestions": [
                        "The AI response was not valid JSON. Review the uploaded file and retry if needed."
                    ]
                }

        await db.ai_uploads.update_one(
            {"upload_id": upload_id},
            {"$set": {
                "status": "pending_approval",
                "detected_type": extracted.get("detected_type", "unknown"),
                "confidence": extracted.get("confidence", 0.5),
                "extracted_data": extracted.get("extracted_fields", {}),
                "suggestions": extracted.get("suggestions", []),
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        return extracted
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI processing error: {e}")
        extracted = {
            "detected_type": "unknown",
            "confidence": 0.0,
            "extracted_fields": {
                "extraction_error": str(e)
            },
            "suggestions": [
                f"Automatic extraction could not complete: {str(e)}"
            ]
        }
        await db.ai_uploads.update_one(
            {"upload_id": upload_id},
            {"$set": {
                "status": "pending_approval",
                "detected_type": "unknown",
                "confidence": 0.0,
                "extracted_data": extracted["extracted_fields"],
                "suggestions": extracted["suggestions"],
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            }}
        )
        return extracted


@api_router.post("/companies/{company_id}/ai-uploads", status_code=201)
async def create_ai_upload(company_id: str, data: AIUploadCreate, user: dict = Depends(get_current_user)):
    """Upload a file for AI processing"""
    return await _create_ai_upload_record(
        company_id=company_id,
        user_id=user["user_id"],
        file_name=data.file_name,
        file_type=data.file_type,
        file_size=data.file_size,
        file_base64=data.file_base64,
    )


@api_router.post("/ai/import", status_code=201)
async def ai_import_upload(
    file: UploadFile = File(...),
    company_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    try:
        contents = await file.read()
        file_size = len(contents)
        print("File received:", file.filename)
        _validate_ai_import_upload(file.filename or "", file.content_type or "", file_size)
        upload = await _create_ai_upload_record(
            company_id=company_id,
            user_id=user["user_id"],
            file_name=file.filename or "upload",
            file_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            file_base64=base64.b64encode(contents).decode("utf-8"),
        )
        return {
            "upload_id": upload["upload_id"],
            "filename": upload["file_name"],
            "size": upload["file_size"],
            "status": upload["status"],
        }
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as e:
        logger.error(f"AI import upload error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@api_router.get("/companies/{company_id}/ai-uploads")
async def list_ai_uploads(company_id: str, user: dict = Depends(get_current_user)):
    """List all AI uploads for a company"""
    uploads = await db.ai_uploads.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"data": uploads}

@api_router.get("/companies/{company_id}/ai-uploads/{upload_id}")
async def get_ai_upload(company_id: str, upload_id: str, user: dict = Depends(get_current_user)):
    """Get a single AI upload with all extracted data for the review page"""
    upload = await db.ai_uploads.find_one(
        {"upload_id": upload_id, "company_id": company_id},
        {"_id": 0}
    )
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload

@api_router.post("/companies/{company_id}/ai-uploads/{upload_id}/process")
async def process_ai_upload(company_id: str, upload_id: str, user: dict = Depends(get_current_user)):
    """Process uploaded file with AI to extract data"""
    extracted = await _extract_ai_upload_data(company_id, upload_id)
    return {"status": "success", "data": extracted}


@api_router.post("/ai/extract-document")
async def ai_extract_document(
    upload_id: str = Form(...),
    company_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    await require_role(user, company_id, ["Owner", "Admin", "Manager", "Staff/Accountant"])
    try:
        extracted = await _extract_ai_upload_data(company_id, upload_id)
        return {"status": "success", "upload_id": upload_id, "data": extracted}
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    except Exception as e:
        logger.error(f"AI extract document error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@api_router.post("/companies/{company_id}/ai-uploads/{upload_id}/confirm")
async def confirm_ai_upload(company_id: str, upload_id: str, data: AIUploadConfirm, user: dict = Depends(get_current_user)):
    """Confirm and create record from AI upload"""
    upload = await db.ai_uploads.find_one({"upload_id": upload_id, "company_id": company_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    destination = data.destination
    confirmed_data = data.data
    
    result = None
    
    try:
        if destination == "invoice":
            # Create invoice from confirmed data
            invoice = {
                "invoice_id": f"inv_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "customer_id": confirmed_data.get("customer_id", ""),
                "customer_name": confirmed_data.get("customer_name", ""),
                "invoice_number": confirmed_data.get("invoice_number", ""),
                "invoice_date": confirmed_data.get("invoice_date", datetime.now(timezone.utc).isoformat().split('T')[0]),
                "due_date": confirmed_data.get("due_date", ""),
                "items": confirmed_data.get("items", []),
                "subtotal": confirmed_data.get("subtotal", 0),
                "tax": confirmed_data.get("tax", 0),
                "total": confirmed_data.get("total", 0),
                "balance_due": confirmed_data.get("total", 0),
                "status": confirmed_data.get("status", "Draft"),
                "notes": f"Created from AI import (upload_id: {upload_id})",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"]
            }
            await db.invoices.insert_one(invoice)
            result = invoice
            
        elif destination == "bill":
            # Create bill from confirmed data
            bill = {
                "bill_id": f"bill_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "vendor_id": confirmed_data.get("vendor_id", ""),
                "vendor_name": confirmed_data.get("vendor_name", ""),
                "bill_number": confirmed_data.get("bill_number", ""),
                "bill_date": confirmed_data.get("bill_date", datetime.now(timezone.utc).isoformat().split('T')[0]),
                "due_date": confirmed_data.get("due_date", ""),
                "items": confirmed_data.get("items", []),
                "total": confirmed_data.get("total", 0),
                "balance_due": confirmed_data.get("total", 0),
                "status": "Open",
                "notes": f"Created from AI import (upload_id: {upload_id})",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"]
            }
            await db.bills.insert_one(bill)
            result = bill
            
        elif destination == "expense":
            # Create expense from confirmed data
            expense = {
                "expense_id": f"exp_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "vendor_id": confirmed_data.get("vendor_id", ""),
                "vendor_name": confirmed_data.get("vendor_name", ""),
                "category": confirmed_data.get("category", "Other"),
                "expense_date": confirmed_data.get("date", datetime.now(timezone.utc).isoformat().split('T')[0]),
                "amount": confirmed_data.get("amount", 0),
                "payment_method": confirmed_data.get("payment_method", "Cash"),
                "payment_account": confirmed_data.get("payment_account", "Operating Account"),
                "reference_number": confirmed_data.get("reference", ""),
                "memo": confirmed_data.get("memo", f"Created from AI import (upload_id: {upload_id})"),
                "status": "Recorded",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"]
            }
            await db.expenses.insert_one(expense)
            result = expense
            
        elif destination == "stock_receipt":
            prepared_items = await prepare_receipt_items(company_id, confirmed_data.get("items", []), confirmed_data.get("warehouse", "Main Warehouse"))
            receipt = {
                "receipt_id": f"rcpt_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "vendor_id": confirmed_data.get("vendor_id", ""),
                "vendor_name": confirmed_data.get("vendor_name", ""),
                "supplier_name": confirmed_data.get("supplier_name", confirmed_data.get("vendor_name", "")),
                "invoice_number": confirmed_data.get("invoice_number", ""),
                "container_number": confirmed_data.get("container_number", ""),
                "shipment_date": confirmed_data.get("shipment_date", ""),
                "eta": confirmed_data.get("eta", ""),
                "receive_date": confirmed_data.get("date", datetime.now(timezone.utc).isoformat().split('T')[0]),
                "reference": confirmed_data.get("reference", f"AI-{upload_id[:8]}"),
                "items": prepared_items,
                "warehouse": confirmed_data.get("warehouse", "Main Warehouse"),
                "total_cost": round(sum(float(item.get("line_total", 0) or 0) for item in prepared_items), 2),
                "notes": confirmed_data.get("notes", f"Created from AI import (upload_id: {upload_id})"),
                "status": "Draft",
                "source_upload_id": upload_id,
                "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"]
            }
            await db.stock_receipts.insert_one(receipt)
            shipment_id = await ensure_receipt_shipment_record(company_id, receipt, user["user_id"])
            if shipment_id:
                await db.stock_receipts.update_one(
                    {"company_id": company_id, "receipt_id": receipt["receipt_id"]},
                    {"$set": {"shipment_id": shipment_id}}
                )
                receipt["shipment_id"] = shipment_id
                await link_receipt_documents(company_id, receipt, prepared_items, shipment_id, user["user_id"])
            result = receipt

        elif destination == "customer_payment":
            payment_draft = {
                "payment_draft_id": f"cpd_{uuid.uuid4().hex[:10]}",
                "company_id": company_id,
                "customer_id": confirmed_data.get("customer_id", ""),
                "customer_name": confirmed_data.get("customer_name", ""),
                "payment_date": confirmed_data.get("payment_date", datetime.now(timezone.utc).isoformat().split('T')[0]),
                "amount": float(confirmed_data.get("amount", 0) or 0),
                "payment_method": confirmed_data.get("payment_method", "Check"),
                "reference": confirmed_data.get("reference", ""),
                "memo": confirmed_data.get("memo", f"Draft payment from AI import ({upload_id})"),
                "status": "Draft",
                "source_upload_id": upload_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["user_id"],
            }
            await db.customer_payment_drafts.insert_one(payment_draft)
            result = payment_draft
        
        # Mark upload as confirmed
        await db.ai_uploads.update_one(
            {"upload_id": upload_id},
            {"$set": {
                "status": "confirmed",
                "destination": destination,
                "confirmed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        result.pop("_id", None)
        return {"status": "success", "destination": destination, "data": result}
        
    except Exception as e:
        logger.error(f"Confirm upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create {destination}: {str(e)}")

@api_router.delete("/companies/{company_id}/ai-uploads/{upload_id}")
async def delete_ai_upload(company_id: str, upload_id: str, user: dict = Depends(get_current_user)):
    """Delete an AI upload"""
    result = await db.ai_uploads.delete_one({"upload_id": upload_id, "company_id": company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"status": "deleted"}

@api_router.get("/companies/{company_id}/workflow-alerts")
async def get_workflow_alerts(company_id: str, user: dict = Depends(get_current_user)):
    """Get workflow alerts for common issues"""
    alerts = []
    
    # Check for negative stock
    products = await db.products.find({"company_id": company_id, "cases_on_hand": {"$lt": 0}}, {"_id": 0, "name": 1, "cases_on_hand": 1}).to_list(10)
    for p in products:
        alerts.append({
            "type": "negative_stock",
            "severity": "high",
            "message": f"Product '{p.get('name')}' has negative stock: {p.get('cases_on_hand')} cases",
            "data": p
        })
    
    # Check for invoices without payment (overdue)
    today = datetime.now(timezone.utc).isoformat().split('T')[0]
    overdue_invoices = await db.invoices.find({
        "company_id": company_id,
        "status": {"$in": ["Sent", "Partial Paid"]},
        "due_date": {"$lt": today},
        "balance_due": {"$gt": 0}
    }, {"_id": 0, "invoice_number": 1, "customer_name": 1, "balance_due": 1, "due_date": 1}).limit(10).to_list(10)
    for inv in overdue_invoices:
        alerts.append({
            "type": "overdue_invoice",
            "severity": "high",
            "message": f"Invoice {inv.get('invoice_number')} for {inv.get('customer_name')} is overdue (due: {inv.get('due_date')})",
            "data": inv
        })
    
    # Check for duplicate invoice numbers
    pipeline = [
        {"$match": {"company_id": company_id}},
        {"$group": {"_id": "$invoice_number", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}}
    ]
    duplicates = await db.invoices.aggregate(pipeline).to_list(10)
    for dup in duplicates:
        if dup.get("_id"):
            alerts.append({
                "type": "duplicate_invoice",
                "severity": "medium",
                "message": f"Duplicate invoice number: {dup.get('_id')} ({dup.get('count')} invoices)",
                "data": dup
            })
    
    # Check for expenses without category
    no_category_expenses = await db.expenses.find({
        "company_id": company_id,
        "$or": [{"category": ""}, {"category": {"$exists": False}}]
    }, {"_id": 0, "expense_id": 1, "vendor_name": 1, "amount": 1, "expense_date": 1}).limit(10).to_list(10)
    for exp in no_category_expenses:
        alerts.append({
            "type": "missing_category",
            "severity": "low",
            "message": f"Expense from {exp.get('vendor_name')} (${exp.get('amount')}) has no category",
            "data": exp
        })
    
    # Check for products missing units_per_case
    no_conversion = await db.products.find({
        "company_id": company_id,
        "$or": [{"units_per_case": {"$exists": False}}, {"units_per_case": None}]
    }, {"_id": 0, "name": 1, "sku": 1}).limit(10).to_list(10)
    for prod in no_conversion:
        alerts.append({
            "type": "missing_conversion",
            "severity": "low",
            "message": f"Product '{prod.get('name')}' (SKU: {prod.get('sku')}) missing units per case",
            "data": prod
        })
    
    return {"data": alerts, "count": len(alerts)}

app.include_router(api_router)

@app.on_event("startup")
async def startup_scheduler():
    """Start background scheduler for daily low-stock checks."""
    await ensure_default_companies()
    await ensure_rbac_seed()

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
                    for company in await get_companies_list():
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
