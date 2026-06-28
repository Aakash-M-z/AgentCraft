"""
Enterprise AI Procurement Orchestrator Engine
All procurement business logic, AI analysis, vendor scoring, and PO generation.
"""
import logging
import json
import random
import string
from datetime import datetime, timezone
from typing import Any

from .ai import call_ai

logger = logging.getLogger(__name__)

# ── Department Budget Config (INR) ────────────────────────────────────────────
DEPT_BUDGETS = {
    "Engineering": 500000,
    "Finance": 200000,
    "HR": 150000,
    "Marketing": 300000,
    "Operations": 400000,
    "IT": 600000,
    "Sales": 250000,
    "Legal": 180000,
}

# ── Vendor Master Data ────────────────────────────────────────────────────────
VENDOR_DATA = [
    {"name": "Dell Technologies",    "category": "Hardware",    "rating": 92, "delivery_days": 5, "price_score": 78, "compliance": 95},
    {"name": "HP Enterprise",         "category": "Hardware",    "rating": 88, "delivery_days": 7, "price_score": 82, "compliance": 93},
    {"name": "Lenovo ISG",            "category": "Hardware",    "rating": 85, "delivery_days": 8, "price_score": 87, "compliance": 90},
    {"name": "Microsoft Azure",       "category": "Software",   "rating": 96, "delivery_days": 1, "price_score": 70, "compliance": 98},
    {"name": "Google Cloud",          "category": "Software",   "rating": 94, "delivery_days": 1, "price_score": 72, "compliance": 97},
    {"name": "AWS",                   "category": "Cloud",      "rating": 97, "delivery_days": 1, "price_score": 68, "compliance": 99},
    {"name": "Cisco Systems",         "category": "Networking", "rating": 91, "delivery_days": 10, "price_score": 65, "compliance": 96},
    {"name": "Logitech Business",     "category": "Hardware",   "rating": 83, "delivery_days": 3, "price_score": 90, "compliance": 88},
    {"name": "Adobe Systems",         "category": "Software",   "rating": 89, "delivery_days": 1, "price_score": 60, "compliance": 95},
    {"name": "Zoho Corp",             "category": "Software",   "rating": 82, "delivery_days": 1, "price_score": 92, "compliance": 87},
]

# ── Purchase History (for duplicate detection) ────────────────────────────────
RECENT_PURCHASES = [
    {"item": "Dell Laptop",           "dept": "Engineering",  "date": "2024-05-15", "amount": 75000},
    {"item": "Microsoft Office 365",  "dept": "Finance",       "date": "2024-06-01", "amount": 12000},
    {"item": "HP Monitor 27 inch",    "dept": "Engineering",  "date": "2024-05-20", "amount": 25000},
    {"item": "AWS Cloud Credits",     "dept": "IT",            "date": "2024-06-10", "amount": 50000},
    {"item": "Office Chairs",         "dept": "HR",            "date": "2024-04-12", "amount": 8000},
    {"item": "Cisco Switch",          "dept": "IT",            "date": "2024-03-22", "amount": 45000},
    {"item": "Adobe Creative Cloud",  "dept": "Marketing",    "date": "2024-05-30", "amount": 18000},
    {"item": "MacBook Pro",           "dept": "Engineering",  "date": "2024-06-05", "amount": 120000},
    {"item": "Logitech Webcam",       "dept": "HR",            "date": "2024-06-08", "amount": 5000},
    {"item": "Zoho CRM Subscription","dept": "Sales",         "date": "2024-05-25", "amount": 15000},
]

# ── Approval Tier Logic ───────────────────────────────────────────────────────
def get_approval_tier(amount: int) -> dict:
    """Return approval tier and details based on amount (INR)."""
    if amount <= 10000:
        return {"tier": "L1", "label": "Team Lead", "auto_approve_threshold": 5000}
    elif amount <= 50000:
        return {"tier": "L2", "label": "Department Manager", "auto_approve_threshold": 25000}
    elif amount <= 200000:
        return {"tier": "L3", "label": "Finance Director", "auto_approve_threshold": 0}
    else:
        return {"tier": "L4", "label": "C-Suite Approval", "auto_approve_threshold": 0}


# ── PO Number Generator ───────────────────────────────────────────────────────
def generate_po_number() -> str:
    year = datetime.now(timezone.utc).strftime("%Y")
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"PO-{year}-{suffix}"


# ── AI Requirement Analyzer ───────────────────────────────────────────────────
async def analyze_requirement(request_text: str) -> dict:
    """
    Use AI to extract structured fields from a natural language purchase request.
    Returns structured procurement data.
    """
    prompt = f"""You are an enterprise procurement analyst AI. Extract structured data from this purchase request.

Request: {request_text}

Return ONLY a valid JSON object (no markdown, no extra text):
{{
  "requester": "Extracted requester name or 'Employee'",
  "department": "One of: Engineering, Finance, HR, Marketing, Operations, IT, Sales, Legal",
  "item_name": "Clean item name (max 100 chars)",
  "item_category": "One of: Hardware, Software, Cloud, Networking, Office, Services",
  "quantity": 1,
  "amount": 0,
  "business_justification": "Why this purchase is needed (2-3 sentences)",
  "priority": "One of: low, medium, high, critical",
  "analysis_summary": "Brief AI assessment of this request (2-3 sentences)"
}}

For amount, extract the numeric value. If not mentioned, estimate based on item type.
For department, infer from context."""

    try:
        raw = await call_ai(prompt, temperature=0.2)
        # Strip markdown fences
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        data = json.loads(raw)
        logger.info("✅ Requirement analyzed: %s", data.get("item_name"))
        return data
    except Exception as e:
        logger.error("AI analysis failed: %s", e)
        # Fallback with basic parse
        return {
            "requester": "Employee",
            "department": "Engineering",
            "item_name": request_text[:100],
            "item_category": "Hardware",
            "quantity": 1,
            "amount": 50000,
            "business_justification": "As requested by employee.",
            "priority": "medium",
            "analysis_summary": "Request received and queued for processing."
        }


# ── Duplicate Purchase Detector ───────────────────────────────────────────────
def detect_duplicate(item_name: str, department: str) -> dict:
    """
    Check recent purchase history for similar items in the same department.
    Returns duplicate detection result.
    """
    item_lower = item_name.lower()
    keywords = [w for w in item_lower.split() if len(w) > 3]

    matches = []
    for purchase in RECENT_PURCHASES:
        purchase_lower = purchase["item"].lower()
        # Check for keyword overlap or dept match
        keyword_match = any(kw in purchase_lower for kw in keywords)
        dept_match = purchase["dept"].lower() == department.lower()

        if keyword_match and dept_match:
            matches.append(purchase)

    if matches:
        match = matches[0]
        return {
            "duplicate": True,
            "similar_item": match["item"],
            "department": match["dept"],
            "purchase_date": match["date"],
            "amount": match["amount"],
            "recommendation": f"Similar item '{match['item']}' was purchased for {match['dept']} on {match['date']} for Rs.{match['amount']:,}. Consider whether a new purchase is necessary or if the existing item can be repurposed."
        }

    return {
        "duplicate": False,
        "recommendation": "No duplicate purchase detected. This appears to be a unique procurement request."
    }


# ── Budget Verification ───────────────────────────────────────────────────────
def verify_budget(amount: int, department: str) -> dict:
    """
    Check department budget availability and compute approval tier.
    Returns budget verification result.
    """
    total_budget = DEPT_BUDGETS.get(department, 200000)
    # Simulate 60-80% budget already used
    used_pct = random.uniform(0.50, 0.72)
    used_budget = int(total_budget * used_pct)
    remaining = total_budget - used_budget

    tier_info = get_approval_tier(amount)

    budget_pct = (amount / remaining * 100) if remaining > 0 else 100

    status = "approved"
    recommendation = ""

    if amount > remaining:
        status = "budget_exceeded"
        recommendation = f"Requested amount Rs.{amount:,} exceeds remaining budget Rs.{remaining:,} for {department}. Request needs CFO override."
    elif budget_pct > 80:
        status = "caution"
        recommendation = f"This purchase consumes {budget_pct:.0f}% of remaining {department} budget. Escalated for L3 approval."
    else:
        recommendation = f"Budget verified. Rs.{remaining:,} available for {department} after this purchase."

    return {
        "total_budget": total_budget,
        "used_budget": used_budget,
        "remaining_budget": remaining,
        "requested_amount": amount,
        "budget_utilization_pct": round(budget_pct, 1),
        "status": status,
        "approval_tier": tier_info["tier"],
        "approval_label": tier_info["label"],
        "recommendation": recommendation
    }


# ── AI Vendor Recommender ─────────────────────────────────────────────────────
async def recommend_vendor(item_category: str, item_name: str, amount: int) -> dict:
    """
    Score all vendors for the given category and ask AI to pick the best.
    Returns vendor recommendation with scoring matrix.
    """
    # Filter relevant vendors
    relevant = [v for v in VENDOR_DATA if v["category"].lower() == item_category.lower()]
    if not relevant:
        relevant = VENDOR_DATA[:3]  # fallback to top 3

    # Score each vendor
    scored = []
    for v in relevant:
        # Composite score: 40% quality, 30% price, 20% delivery, 10% compliance
        composite = (
            v["rating"] * 0.40 +
            v["price_score"] * 0.30 +
            max(0, 100 - v["delivery_days"] * 5) * 0.20 +  # faster = better
            v["compliance"] * 0.10
        )
        scored.append({**v, "composite_score": round(composite)})

    scored.sort(key=lambda x: x["composite_score"], reverse=True)
    top_vendor = scored[0]

    prompt = f"""You are a procurement AI advisor. A company needs to buy: {item_name} (category: {item_category}, budget: Rs.{amount:,}).

Top vendor candidates with scores:
{json.dumps(scored[:3], indent=2)}

Write a 2-sentence executive recommendation explaining why {top_vendor['name']} is the best choice. Be specific about pricing, delivery, and compliance."""

    try:
        reasoning = await call_ai(prompt, temperature=0.3)
    except Exception:
        reasoning = f"{top_vendor['name']} scores highest on composite vendor evaluation with {top_vendor['composite_score']}/100, offering optimal balance of quality and price competitiveness."

    return {
        "recommended_vendor": top_vendor["name"],
        "composite_score": top_vendor["composite_score"],
        "delivery_days": top_vendor["delivery_days"],
        "vendor_matrix": scored[:3],
        "ai_reasoning": reasoning.strip()
    }


# ── Risk Scorer ───────────────────────────────────────────────────────────────
async def generate_risk_score(analysis_data: dict) -> dict:
    """
    AI-powered risk scoring (0-100) based on all procurement factors.
    Returns risk level and mitigation recommendations.
    """
    amount = analysis_data.get("amount", 0)
    duplicate = analysis_data.get("duplicate_detected", "no") == "yes"
    budget_status = analysis_data.get("budget_status", "approved")
    priority = analysis_data.get("priority", "medium")

    # Base risk calculation
    risk = 0

    # Amount risk (0-40 points)
    if amount > 200000:
        risk += 40
    elif amount > 100000:
        risk += 28
    elif amount > 50000:
        risk += 18
    elif amount > 10000:
        risk += 8
    else:
        risk += 3

    # Duplicate risk (0-20 points)
    if duplicate:
        risk += 20

    # Budget risk (0-25 points)
    if budget_status == "budget_exceeded":
        risk += 25
    elif budget_status == "caution":
        risk += 15

    # Priority risk (0-15 points)
    if priority == "critical":
        risk += 5  # Critical = urgent but justified
    elif priority == "low":
        risk += 10  # Low priority but high spend = risk

    risk = min(risk, 100)

    if risk >= 70:
        level = "High"
        color = "rose"
    elif risk >= 40:
        level = "Medium"
        color = "amber"
    else:
        level = "Low"
        color = "emerald"

    prompt = f"""You are a procurement risk analyst. Score: {risk}/100 ({level} Risk).
Request details: {json.dumps(analysis_data, indent=2)}

Write 2 concise risk mitigation recommendations. Return as plain text, no markdown."""

    try:
        mitigation = await call_ai(prompt, temperature=0.2)
    except Exception:
        mitigation = "Monitor vendor performance closely. Ensure compliance documentation is obtained prior to PO issuance."

    return {
        "risk_score": risk,
        "risk_level": level,
        "risk_color": color,
        "mitigation_recommendations": mitigation.strip()
    }


# ── Purchase Order Generator ──────────────────────────────────────────────────
async def generate_purchase_order(procurement_data: dict) -> dict:
    """
    Generate a formal Purchase Order document.
    Returns PO number, formatted PO text, and metadata.
    """
    po_number = generate_po_number()
    now = datetime.now(timezone.utc)

    # Generate formal PO
    vendor = procurement_data.get("recommended_vendor", "To Be Determined")
    item = procurement_data.get("item_name", "N/A")
    qty = procurement_data.get("quantity", 1)
    amount = procurement_data.get("amount", 0)
    dept = procurement_data.get("department", "N/A")
    requester = procurement_data.get("requester", "Employee")
    approval_tier = procurement_data.get("approval_tier", "L2")

    unit_price = amount // qty if qty > 0 else amount

    po_document = (
        "PURCHASE ORDER\n"
        "======================================================\n"
        f"PO Number    : {po_number}\n"
        f"Date         : {now.strftime('%d %B %Y')}\n"
        "Status       : APPROVED\n"
        f"Approval Tier: {approval_tier}\n"
        "\n"
        "BILL TO:\n"
        "AgentCraft Enterprise Ltd.\n"
        f"{dept} Department\n"
        "\n"
        "VENDOR:\n"
        f"{vendor}\n"
        "\n"
        "LINE ITEMS:\n"
        "------------------------------------------------------\n"
        f"Item          : {item}\n"
        f"Quantity      : {qty}\n"
        f"Unit Price    : Rs.{unit_price:,}\n"
        f"Total Amount  : Rs.{amount:,}\n"
        "------------------------------------------------------\n"
        f"Subtotal      : Rs.{amount:,}\n"
        f"GST (18%)     : Rs.{int(amount * 0.18):,}\n"
        f"GRAND TOTAL   : Rs.{int(amount * 1.18):,}\n"
        "======================================================\n"
        f"Requested by  : {requester}\n"
        "Authorized by : AgentCraft AI Procurement System\n"
        f"PO Generated  : {now.strftime('%d %b %Y %H:%M UTC')}\n"
        "\n"
        "This PO is system-generated and valid for 30 days.\n"
        "All purchases subject to vendor compliance verification."
    )

    return {
        "po_number": po_number,
        "po_document": po_document,
        "vendor": vendor,
        "total_with_gst": int(amount * 1.18),
        "generated_at": now.isoformat()
    }


# ── Audit Log Writer ──────────────────────────────────────────────────────────
async def store_audit_entry(
    request_id: str,
    action: str,
    actor: str,
    details: str,
    old_status: str = None,
    new_status: str = None
) -> dict:
    """
    Write an immutable audit log entry to the database.
    """
    try:
        from .database import AsyncSessionLocal, ProcurementAuditLog

        async with AsyncSessionLocal() as session:
            entry = ProcurementAuditLog(
                request_id=request_id,
                action=action,
                actor=actor,
                details=details,
                old_status=old_status,
                new_status=new_status,
            )
            session.add(entry)
            await session.commit()
            logger.info("Audit log: [%s] %s -> %s", request_id, action, new_status or "")
            return {
                "logged": True,
                "action": action,
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else datetime.now(timezone.utc).isoformat()
            }
    except Exception as e:
        logger.error("Audit log failed: %s", e)
        return {"logged": False, "error": str(e)}


# ── Procurement Request Saver ─────────────────────────────────────────────────
async def save_procurement_request(data: dict) -> dict:
    """
    Save a procurement request to the database.
    Returns the saved request with its ID.
    """
    try:
        from .database import AsyncSessionLocal, ProcurementRequest

        async with AsyncSessionLocal() as session:
            req = ProcurementRequest(
                request_id=data.get("po_number", generate_po_number()),
                requester=data.get("requester", "Employee"),
                department=data.get("department", "Engineering"),
                item_name=data.get("item_name", "")[:500],
                item_category=data.get("item_category", "Hardware"),
                quantity=data.get("quantity", 1),
                amount=data.get("amount", 0),
                business_justification=data.get("business_justification", ""),
                priority=data.get("priority", "medium"),
                status=data.get("status", "approved"),
                approval_tier=data.get("approval_tier", "L2"),
                risk_score=data.get("risk_score"),
                risk_level=data.get("risk_level"),
                recommended_vendor=data.get("recommended_vendor"),
                vendor_score=data.get("vendor_score"),
                po_number=data.get("po_number"),
                duplicate_detected="yes" if data.get("duplicate_detected") else "no",
                budget_available=data.get("remaining_budget"),
                ai_analysis=data.get("analysis_summary", ""),
                execution_id=data.get("execution_id"),
            )
            session.add(req)
            await session.commit()
            await session.refresh(req)
            logger.info("Procurement request saved: %s", req.request_id)
            return {"saved": True, "id": req.id, "request_id": req.request_id}
    except Exception as e:
        logger.error("Save procurement request failed: %s", e)
        return {"saved": False, "error": str(e)}
