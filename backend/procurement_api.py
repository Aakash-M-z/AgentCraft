"""
Enterprise AI Procurement Orchestrator - API Router
Provides dashboard, requests, audit, and vendor endpoints.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from .database import get_db, ProcurementRequest, ProcurementAuditLog, ProcurementVendor, AsyncSessionLocal
from .procurement_engine import VENDOR_DATA, DEPT_BUDGETS, get_approval_tier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/procurement", tags=["procurement"])


# ── Pydantic Models ───────────────────────────────────────────────────────────

class CreateRequestBody(BaseModel):
    requester: str
    department: str
    item_name: str
    item_category: str
    quantity: int = 1
    amount: int
    business_justification: Optional[str] = None
    priority: str = "medium"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _req_response(r: Any) -> dict:
    return {
        "id": r.id,
        "requestId": r.request_id,
        "requester": r.requester,
        "department": r.department,
        "itemName": r.item_name,
        "itemCategory": r.item_category,
        "quantity": r.quantity,
        "amount": r.amount,
        "businessJustification": r.business_justification,
        "priority": r.priority,
        "status": r.status,
        "approvalTier": r.approval_tier,
        "riskScore": r.risk_score,
        "riskLevel": r.risk_level,
        "recommendedVendor": r.recommended_vendor,
        "vendorScore": r.vendor_score,
        "poNumber": r.po_number,
        "duplicateDetected": r.duplicate_detected,
        "budgetAvailable": r.budget_available,
        "aiAnalysis": r.ai_analysis,
        "executionId": r.execution_id,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
        "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
    }


def _audit_response(a: Any) -> dict:
    return {
        "id": a.id,
        "requestId": a.request_id,
        "action": a.action,
        "actor": a.actor,
        "details": a.details,
        "oldStatus": a.old_status,
        "newStatus": a.new_status,
        "timestamp": a.timestamp.isoformat() if a.timestamp else None,
    }


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Return aggregate KPI metrics for the executive procurement dashboard."""
    # Get all requests
    result = await db.execute(select(ProcurementRequest).order_by(desc(ProcurementRequest.created_at)))
    requests = list(result.scalars().all())

    total = len(requests)
    pending = sum(1 for r in requests if r.status in ("pending", "analyzing"))
    approved = sum(1 for r in requests if r.status in ("approved", "po_generated"))
    rejected = sum(1 for r in requests if r.status == "rejected")
    total_spend = sum(r.amount for r in requests if r.status in ("approved", "po_generated"))

    # Risk distribution
    low_risk = sum(1 for r in requests if r.risk_level == "Low")
    medium_risk = sum(1 for r in requests if r.risk_level == "Medium")
    high_risk = sum(1 for r in requests if r.risk_level == "High")

    # Department spend
    dept_spend: dict[str, int] = {}
    for r in requests:
        if r.status in ("approved", "po_generated"):
            dept_spend[r.department] = dept_spend.get(r.department, 0) + r.amount

    # Duplicate detection rate
    duplicates = sum(1 for r in requests if r.duplicate_detected == "yes")

    # Avg risk score
    risk_scores = [r.risk_score for r in requests if r.risk_score is not None]
    avg_risk = round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0

    # Vendor distribution
    vendor_counts: dict[str, int] = {}
    for r in requests:
        if r.recommended_vendor:
            vendor_counts[r.recommended_vendor] = vendor_counts.get(r.recommended_vendor, 0) + 1

    return {
        "kpis": {
            "totalRequests": total,
            "pendingApproval": pending,
            "approved": approved,
            "rejected": rejected,
            "totalSpend": total_spend,
            "totalSpendWithGST": int(total_spend * 1.18),
            "duplicatesBlocked": duplicates,
            "avgRiskScore": avg_risk,
            "approvalRate": round(approved / total * 100, 1) if total > 0 else 0,
            "aiSavings": int(total_spend * 0.12),  # Estimated 12% savings via AI vendor selection
        },
        "riskDistribution": {
            "low": low_risk,
            "medium": medium_risk,
            "high": high_risk,
        },
        "departmentSpend": [
            {"department": dept, "amount": amount, "budget": DEPT_BUDGETS.get(dept, 200000)}
            for dept, amount in sorted(dept_spend.items(), key=lambda x: -x[1])
        ],
        "vendorDistribution": [
            {"vendor": vendor, "count": count}
            for vendor, count in sorted(vendor_counts.items(), key=lambda x: -x[1])[:5]
        ],
        "recentRequests": [_req_response(r) for r in requests[:5]],
    }


# ── Requests ──────────────────────────────────────────────────────────────────

@router.get("/requests")
async def list_requests(
    status: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """List procurement requests with optional filters."""
    query = select(ProcurementRequest).order_by(desc(ProcurementRequest.created_at))
    if status:
        query = query.where(ProcurementRequest.status == status)
    if department:
        query = query.where(ProcurementRequest.department == department)
    query = query.limit(limit)

    result = await db.execute(query)
    requests = list(result.scalars().all())
    return [_req_response(r) for r in requests]


@router.get("/requests/{request_id}")
async def get_request(request_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single procurement request by its request ID."""
    result = await db.execute(
        select(ProcurementRequest).where(ProcurementRequest.request_id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return _req_response(req)


@router.post("/requests", status_code=201)
async def create_request(body: CreateRequestBody, db: AsyncSession = Depends(get_db)):
    """Manually create a procurement request (bypasses AI analysis)."""
    from .procurement_engine import generate_po_number

    tier_info = get_approval_tier(body.amount)
    req = ProcurementRequest(
        request_id=generate_po_number(),
        requester=body.requester,
        department=body.department,
        item_name=body.item_name[:500],
        item_category=body.item_category,
        quantity=body.quantity,
        amount=body.amount,
        business_justification=body.business_justification,
        priority=body.priority,
        status="pending",
        approval_tier=tier_info["tier"],
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    logger.info("Created procurement request: %s", req.request_id)
    return _req_response(req)


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_log(
    request_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Get immutable audit trail, optionally filtered by request_id."""
    query = select(ProcurementAuditLog).order_by(desc(ProcurementAuditLog.timestamp)).limit(limit)
    if request_id:
        query = query.where(ProcurementAuditLog.request_id == request_id)
    result = await db.execute(query)
    logs = list(result.scalars().all())
    return [_audit_response(a) for a in logs]


# ── Vendors ───────────────────────────────────────────────────────────────────

@router.get("/vendors")
async def get_vendors():
    """Return vendor master data with performance metrics."""
    return [
        {
            "name": v["name"],
            "category": v["category"],
            "qualityRating": v["rating"],
            "deliveryDays": v["delivery_days"],
            "priceScore": v["price_score"],
            "complianceScore": v["compliance"],
            "compositeScore": round(
                v["rating"] * 0.40 + v["price_score"] * 0.30 +
                max(0, 100 - v["delivery_days"] * 5) * 0.20 + v["compliance"] * 0.10
            ),
        }
        for v in sorted(VENDOR_DATA, key=lambda x: -x["rating"])
    ]


# ── Budget Status ─────────────────────────────────────────────────────────────

@router.get("/budgets")
async def get_budgets(db: AsyncSession = Depends(get_db)):
    """Return department budget utilization."""
    result = await db.execute(select(ProcurementRequest))
    requests = list(result.scalars().all())

    approved_by_dept: dict[str, int] = {}
    for r in requests:
        if r.status in ("approved", "po_generated"):
            approved_by_dept[r.department] = approved_by_dept.get(r.department, 0) + r.amount

    return [
        {
            "department": dept,
            "total": total,
            "used": approved_by_dept.get(dept, 0),
            "remaining": total - approved_by_dept.get(dept, 0),
            "utilizationPct": round(approved_by_dept.get(dept, 0) / total * 100, 1) if total > 0 else 0,
        }
        for dept, total in sorted(DEPT_BUDGETS.items(), key=lambda x: -x[1])
    ]
