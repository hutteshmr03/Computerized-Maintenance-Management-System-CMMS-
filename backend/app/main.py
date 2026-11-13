import asyncio
import json
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from . import models as m
from .db import Base, SessionLocal, engine, get_db, utcnow
from .security import (
    DEFAULT_BUILTIN_ROLES,
    MENUS,
    PERMISSIONS,
    PRIVILEGE_ALIASES,
    PRIVILEGE_GROUPS,
    current_user,
    hash_password,
    make_token,
    require,
    verify_password,
    verify_sso_identity,
)

UPLOAD_DIR = Path(os.getenv("CMMS_UPLOADS", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

OPEN_STATES = ("created", "planned", "sent_for_approval", "approved", "in_progress", "review")
PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 5


INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_asset_id ON jobs (asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs (assigned_to)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_contractor_id ON jobs (contractor_id)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON jobs (due_date)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_din_type ON jobs (din_type)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs (priority)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_asset_status ON jobs (asset_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_job_parts_job_id ON job_parts (job_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_parts_part_id ON job_parts (part_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_checklists_job_id ON work_order_checklists (job_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_loto_job_id ON work_order_loto (job_id)",
    "CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos (job_id)",
    "CREATE INDEX IF NOT EXISTS idx_assets_parent_id ON assets (parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_assets_cost_centre_id ON assets (cost_centre_id)",
    "CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status)",
    "CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets (criticality)",
    "CREATE INDEX IF NOT EXISTS idx_assets_tier ON assets (tier)",
    "CREATE INDEX IF NOT EXISTS idx_calibrations_asset_id ON calibrations (asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_calibrations_next_date ON calibrations (next_due_date)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read)",
    "CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity, entity_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_bom_asset_id ON bom_items (asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_bom_part_id ON bom_items (part_id)",
    "CREATE INDEX IF NOT EXISTS idx_purchase_part_id ON purchase_requests (part_id)",
    "CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_requests (status)",
    "CREATE INDEX IF NOT EXISTS idx_condition_readings_asset ON condition_readings (asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_condition_readings_recorded ON condition_readings (recorded_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_asset ON transfers (asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers (status)",
]


async def keep_alive_task():
    """Pings the public service URL every 3 minutes (180s) to keep Render awake."""
    await asyncio.sleep(45)  # Initial wait before starting pings
    while True:
        url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("SELF_PING_URL")
        if url:
            ping_url = f"{url.rstrip('/')}/api/health"
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.get(ping_url)
            except Exception:
                pass
        await asyncio.sleep(180)  # Ping every 3 minutes


@asynccontextmanager
async def lifespan(_app):
    Base.metadata.create_all(engine)
    # Ensure performance indexes and schema migrations
    with engine.connect() as conn:
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(assets)").fetchall()
            col_names = [r[1] for r in res]
            if "utility_type" not in col_names:
                conn.exec_driver_sql("ALTER TABLE assets ADD COLUMN utility_type VARCHAR(30)")
        except Exception:
            pass

        for idx in INDEXES_SQL:
            try:
                conn.exec_driver_sql(idx)
            except Exception:
                pass
        conn.commit()

    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(m.User)):
            from .seed import seed
            seed(db)
        else:
            # Ensure new roles exist in DB
            from .seed import DEMO_USERS
            for name, email, pw, role, company, phone in DEMO_USERS:
                existing = db.scalar(select(m.User).where(func.lower(m.User.email) == email.lower()))
                if not existing:
                    db.add(m.User(name=name, email=email, password_hash=hash_password(pw), role=role, contractor_company=company, phone=phone))
            # Ensure sample calibrations exist
            if not db.scalar(select(func.count()).select_from(m.Calibration)):
                ast = db.scalar(select(m.Asset))
                if ast:
                    db.add(m.Calibration(
                        asset_id=ast.id,
                        last_calibrated_date=date.today() - timedelta(days=120),
                        next_due_date=date.today() + timedelta(days=14),
                        calibrated_by="TÜV SÜD Calibration Services",
                        certificate_number="CAL-2026-0091",
                        standard_used="ISO 230-1 / VDI/DGQ 3441",
                        result="pass",
                        notes="Calibration compliant with ISO standards.",
                    ))
            db.commit()

    ping_task = asyncio.create_task(keep_alive_task())
    try:
        yield
    finally:
        ping_task.cancel()


app = FastAPI(
    title="Enterprise CMMS (DIN 31051 / EN 13306 / ISO 55001)",
    description="Production-grade Computerized Maintenance Management System with asset hierarchy, ISO 14224 failure codes, multi-trigger PM plans, LOTO safety checklists, BOM procurement, contractor portal, and EN 13306 KPIs.",
    version="2.0.0",
    lifespan=lifespan,
)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if cors_origins_env == "*" else [o.strip() for o in cors_origins_env.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
@app.get("/api/health")
def health_check():
    """Unauthenticated health probe and keep-alive heartbeat target."""
    return {
        "status": "ok",
        "service": "Enterprise CMMS",
        "timestamp": utcnow().isoformat(),
        "keep_alive_every": "3min",
    }


# ---------------------------------------------------------------- helpers & auditing
def audit(
    db: Session,
    user: m.User | None,
    action: str,
    entity: str,
    entity_id: int | None,
    detail: str = "",
    before_state: dict | None = None,
    after_state: dict | None = None,
):
    """Immutable audit logging compliant with ISO 55001 (stores before and after states)."""
    db.add(
        m.AuditLog(
            user_name=user.name if user else "system",
            action=action,
            entity=entity,
            entity_id=entity_id,
            before_state=json.dumps(before_state, default=str) if before_state else "",
            after_state=json.dumps(after_state, default=str) if after_state else "",
            detail=detail,
        )
    )


def notify(db: Session, user_ids, message: str, link: str = ""):
    for uid in set(user_ids):
        if uid:
            db.add(m.Notification(user_id=uid, message=message, link=link))


def users_with_role(db: Session, *roles):
    return [u.id for u in db.scalars(select(m.User).where(m.User.role.in_(roles)))]


def hours_between(a: datetime | None, b: datetime | None) -> float:
    if not a or not b:
        return 0.0
    return max(0.0, round((b - a).total_seconds() / 3600, 2))


def open_job_for(db: Session, asset_id: int, exclude_id: int | None = None):
    q = select(m.Job).where(m.Job.asset_id == asset_id, m.Job.status.in_(OPEN_STATES))
    if exclude_id:
        q = q.where(m.Job.id != exclude_id)
    return db.scalar(q)


_user_name_cache: dict[int, str] = {}


def user_name(db: Session, uid: int | None) -> str:
    if not uid:
        return ""
    if uid in _user_name_cache:
        return _user_name_cache[uid]
    u = db.get(m.User, uid)
    name = u.name if u else ""
    if u:
        _user_name_cache[uid] = name
    return name


def get_user_permissions(u: m.User, db: Session | None = None) -> list[str]:
    if u.role in ("admin", "super_admin"):
        return ["*"]
    if db:
        cr = db.scalar(select(m.CustomRole).where(m.CustomRole.name == u.role))
        if cr and cr.privileges:
            perms = set(cr.privileges)
            for p in list(perms):
                if p in PRIVILEGE_ALIASES:
                    perms.add(PRIVILEGE_ALIASES[p])
            return sorted(perms)
    if u.role in PERMISSIONS:
        return sorted(PERMISSIONS[u.role])
    return []


def get_user_menu(u: m.User, db: Session | None = None) -> list[str]:
    if u.role in MENUS:
        return MENUS[u.role]
    menu = ["dashboard"]
    perms = get_user_permissions(u, db)
    if any(p.startswith("asset.") or p.startswith("transfer.") or p.startswith("bom.") for p in perms):
        menu.append("assets")
    if any(p.startswith("transfer.") for p in perms):
        menu.append("transfers")
    if any(p.startswith("job.") or p.startswith("wo.") or p.startswith("pm.") or p.startswith("bd.") or p.startswith("plan.") for p in perms):
        menu.append("jobs")
    if any(p.startswith("part.") for p in perms):
        menu.append("parts")
    if any(p.startswith("procurement.") or p.startswith("pr.") for p in perms):
        menu.append("procurement")
    if any(p.startswith("report.") or p.startswith("kpi.") or p.startswith("oee.") or p.startswith("downtime.") for p in perms):
        menu.append("reports")
    if any(p.startswith("audit.") for p in perms):
        menu.append("audit")
    if any(p.startswith("calibration.") for p in perms):
        menu.append("calibration")
    if any(p.startswith("user.") for p in perms):
        menu.append("users")
    if u.role in ("admin", "super_admin"):
        menu.append("security")
    return menu
    return menu


def user_payload(u: m.User, db: Session | None = None) -> dict:
    perms = get_user_permissions(u, db)
    menu = get_user_menu(u, db)
    return {
        "id": u.id,
        "name": u.name,
        "full_name": u.full_name or u.name,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "units": u.units or [],
        "departments": u.departments or [],
        "status": u.status or "active",
        "contractor_company": u.contractor_company,
        "permissions": perms,
        "menu": menu,
    }


def job_actions(job: m.Job, user: m.User) -> list[str]:
    """State transition actions available to the user based on role and current job status."""
    role = user.role
    perms = PERMISSIONS.get(role, set())
    acts: list[str] = []

    # Admin, Super Admin, Maintenance Manager, and Plant Head
    if role in ("admin", "super_admin", "maintenance_manager", "plant_head"):
        if job.status == "created":
            acts += ["send", "plan", "edit", "cancel"]
        elif job.status == "planned":
            acts += ["send", "approve", "reject", "edit"]
        elif job.status == "sent_for_approval":
            acts += ["approve", "reject"]
        elif job.status == "approved":
            acts += ["start", "assign"]
        elif job.status == "in_progress":
            acts += ["review", "close"]
        elif job.status == "review":
            acts += ["close", "revise"]
        elif job.status == "rejected":
            acts += ["revise"]
        return acts

    # Maintenance Engineer
    if role == "maintenance_engineer":
        if job.status in ("created", "planned"):
            acts += ["plan", "send", "edit"]
        elif job.status == "sent_for_approval":
            acts += ["approve", "reject"]
        elif job.status == "approved":
            acts += ["start", "assign"]
        elif job.status == "in_progress":
            acts += ["review", "close"]
        elif job.status == "review":
            acts += ["close", "revise"]
        elif job.status == "rejected":
            acts.append("revise")

    # Technician
    elif role == "technician":
        if job.status == "created":
            acts += ["send", "edit"]
        elif job.status == "approved":
            acts.append("start")
        elif job.status == "in_progress":
            acts += ["review", "close"]
        elif job.status == "rejected":
            acts.append("revise")

    # Production Manager can report/send breakdown work orders
    elif role == "production_manager":
        if job.status == "created":
            acts += ["send", "edit"]

    # Dynamic custom roles with assigned work order privileges
    if not acts:
        perms_set = set(get_user_permissions(user))
        if "*" in perms_set or "job.work" in perms_set or "job.create" in perms_set or "job.plan" in perms_set or "job.approve" in perms_set:
            if job.status == "created":
                if "job.plan" in perms_set or "*" in perms_set:
                    acts.append("plan")
                if "job.send" in perms_set or "job.create" in perms_set or "*" in perms_set:
                    acts.append("send")
                acts.append("edit")
            elif job.status == "planned":
                if "job.approve" in perms_set or "job.decide" in perms_set or "*" in perms_set:
                    acts += ["approve", "reject"]
                if "job.send" in perms_set or "*" in perms_set:
                    acts.append("send")
                acts.append("edit")
            elif job.status == "sent_for_approval":
                if "job.approve" in perms_set or "job.decide" in perms_set or "*" in perms_set:
                    acts += ["approve", "reject"]
            elif job.status == "approved":
                if "job.start" in perms_set or "job.work" in perms_set or "*" in perms_set:
                    acts.append("start")
                if "job.plan" in perms_set or "*" in perms_set:
                    acts.append("assign")
            elif job.status == "in_progress":
                if "job.work" in perms_set or "*" in perms_set:
                    acts.append("review")
                if "job.close" in perms_set or "*" in perms_set:
                    acts.append("close")
            elif job.status == "review":
                if "job.close" in perms_set or "*" in perms_set:
                    acts.append("close")
                acts.append("revise")
            elif job.status == "rejected":
                acts.append("revise")

    return acts


def job_dict(db: Session, job: m.Job, user: m.User) -> dict:
    parts_cost = sum(p.qty * p.unit_cost for p in job.parts)
    labour = job.labour_hours * job.labour_rate
    contractor_fee = job.contractor_invoice_amount or 0.0
    total = parts_cost + labour + contractor_fee

    loto_pending = bool(job.loto_required and not job.loto_signed)
    checklists_data = [
        {
            "id": c.id,
            "step_number": c.step_number,
            "task_description": c.task_description,
            "is_mandatory": c.is_mandatory,
            "is_completed": c.is_completed,
            "completed_by": c.completed_by,
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "notes": c.notes,
        }
        for c in sorted(job.checklists, key=lambda x: x.step_number)
    ]
    all_mandatory_checked = all(c["is_completed"] for c in checklists_data if c["is_mandatory"])

    loto_steps_data = [
        {
            "id": l.id,
            "step_number": l.step_number,
            "hazard_description": l.hazard_description,
            "loto_type": l.loto_type,
            "verified": l.verified,
            "verified_by": l.verified_by,
            "verified_at": l.verified_at.isoformat() if l.verified_at else None,
        }
        for l in sorted(job.loto_steps, key=lambda x: x.step_number)
    ]

    return {
        "id": job.id,
        "wo_number": job.wo_number or f"WO-{job.created_at.year}-{job.id:04d}",
        "type": job.type,
        "din_type": job.din_type,
        "title": job.title,
        "description": job.description,
        "priority": job.priority,
        "status": job.status,
        "asset": {
            "id": job.asset.id,
            "code": job.asset.code,
            "name": job.asset.name,
            "tier": job.asset.tier,
            "criticality": job.asset.criticality,
            "location": job.asset.location.name if job.asset.location else "Plant Area",
        } if job.asset else None,
        "cost_centre": {
            "id": job.cost_centre.id,
            "code": job.cost_centre.code,
            "name": job.cost_centre.name,
        } if job.cost_centre else None,
        "estimated_cost": job.estimated_cost,
        "estimated_hours": job.estimated_hours,
        "labour_hours": job.labour_hours,
        "labour_rate": job.labour_rate,
        "contractor_invoice_amount": job.contractor_invoice_amount,
        "contractor_invoice_ref": job.contractor_invoice_ref,
        "contractor_notes": job.contractor_notes,
        "due_date": job.due_date.isoformat() if job.due_date else None,
        "scheduled_start": job.scheduled_start.isoformat() if job.scheduled_start else None,
        "scheduled_end": job.scheduled_end.isoformat() if job.scheduled_end else None,
        "overdue": bool(job.due_date and job.status in OPEN_STATES and job.due_date < date.today()),
        # ISO 14224 failure reporting
        "breakdown_reason": job.breakdown_reason,
        "failure_mode": job.failure_mode,
        "failure_cause": job.failure_cause,
        "failure_effect": job.failure_effect,
        "failure_code_id": job.failure_code_id,
        "action_taken": job.action_taken,
        "rejection_reason": job.rejection_reason,
        "warranty": job.warranty_at_creation,
        "sla_breached": job.sla_breached,
        "created_by": user_name(db, job.created_by),
        "assigned_to": job.assigned_to,
        "assigned_to_name": user_name(db, job.assigned_to),
        "contractor_id": job.contractor_id,
        "contractor_name": user_name(db, job.contractor_id),
        "created_at": job.created_at.isoformat(),
        "start_time": job.start_time.isoformat() if job.start_time else None,
        "end_time": job.end_time.isoformat() if job.end_time else None,
        "loto_required": job.loto_required,
        "loto_signed": job.loto_signed,
        "loto_signed_by": job.loto_signed_by,
        "loto_signed_at": job.loto_signed_at.isoformat() if job.loto_signed_at else None,
        "loto_pending": loto_pending,
        "loto_steps": loto_steps_data,
        "checklists": checklists_data,
        "all_mandatory_checked": all_mandatory_checked,
        "parts": [
            {
                "id": p.id,
                "part_id": p.part_id,
                "name": p.part.name,
                "sku": p.part.sku,
                "qty": p.qty,
                "unit_cost": p.unit_cost,
                "location_bin": p.part.location_bin,
            }
            for p in job.parts
        ],
        "photos": [
            {
                "id": p.id,
                "url": f"/uploads/{p.filename}",
                "note": p.note,
                "at": p.created_at.isoformat(),
            }
            for p in job.photos
        ],
        "parts_cost": round(parts_cost, 2),
        "labour_cost": round(labour, 2),
        "total_cost": round(total, 2),
        "downtime_hours": hours_between(job.start_time, job.end_time),
        "actions": job_actions(job, user),
    }


def asset_dict(db: Session, a: m.Asset) -> dict:
    oj = open_job_for(db, a.id)
    doc_count = db.scalar(select(func.count(m.AssetDocument.id)).where(m.AssetDocument.asset_id == a.id)) or 0
    bom_count = db.scalar(select(func.count(m.BOMItem.id)).where(m.BOMItem.asset_id == a.id)) or 0
    reading_count = db.scalar(select(func.count(m.ConditionReading.id)).where(m.ConditionReading.asset_id == a.id)) or 0
    active_contract = db.scalar(select(m.Contract).where(m.Contract.asset_id == a.id, m.Contract.status == "active"))

    return {
        "id": a.id,
        "code": a.code,
        "name": a.name,
        "tier": a.tier,
        "parent_id": a.parent_id,
        "criticality": a.criticality,
        "category": a.category,
        "status": a.status,
        "is_movable": a.is_movable,
        "under_warranty": a.under_warranty,
        "replacement_value": a.replacement_value,
        "install_date": a.install_date.isoformat() if a.install_date else None,
        "expected_life_years": a.expected_life_years,
        "serial_number": a.serial_number,
        "manufacturer": a.manufacturer,
        "running_hours": a.running_hours,
        "location": a.location.name if a.location else "Plant",
        "location_id": a.location_id,
        "cost_centre_id": a.cost_centre_id,
        "cost_centre": a.cost_centre.code if a.cost_centre else None,
        "utility_type": a.utility_type,
        "open_job_id": oj.id if oj else None,
        "open_job_status": oj.status if oj else None,
        "open_job_priority": oj.priority if oj else None,
        "doc_count": doc_count,
        "bom_count": bom_count,
        "reading_count": reading_count,
        "contract": {
            "vendor": active_contract.vendor_name,
            "type": active_contract.contract_type,
            "sla_hours": active_contract.sla_response_hours,
            "end_date": active_contract.end_date.isoformat(),
        } if active_contract else None,
    }


# ---------------------------------------------------------------- AUTHENTICATION
class LoginIn(BaseModel):
    email: str
    password: str


@app.post("/api/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    req_email = body.email.strip().lower()
    user = db.scalar(select(m.User).where(func.lower(m.User.email) == req_email))
    if not user and req_email in ("super@cmms.test", "superadmin@cmms.test"):
        user = db.scalar(select(m.User).where(func.lower(m.User.email).in_(["superadmin@cmms.test", "super@cmms.test"])))

    if user and user.locked_until and user.locked_until > utcnow():
        mins = int((user.locked_until - utcnow()).total_seconds() // 60) + 1
        raise HTTPException(423, f"Too many wrong attempts. Try again in about {mins} minute(s).")

    pw_ok = False
    if user:
        pw_ok = verify_password(body.password, user.password_hash)

    if not user or not pw_ok:
        if user:
            user.failed_logins += 1
            sec = db.get(m.SecuritySettings, 1)
            max_attempts = sec.max_login_attempts if (sec and sec.max_login_attempts is not None) else MAX_FAILED_LOGINS
            if max_attempts <= 0:
                max_attempts = 999999  # Unlimited
            if user.failed_logins >= max_attempts:
                user.locked_until = utcnow() + timedelta(minutes=LOCK_MINUTES)
                user.failed_logins = 0
            audit(db, user, "login_failed", "user", user.id, f"Wrong password attempt for {user.email}")
            db.commit()
        raise HTTPException(401, "Email or password is not correct.")

    user.failed_logins = 0
    user.locked_until = None
    audit(db, user, "login", "user", user.id, f"User {user.name} ({user.role}) logged in")
    db.commit()
    return {"token": make_token(user), "user": user_payload(user, db)}


@app.post("/api/auth/sso/callback")
def sso_callback(payload: dict, db: Session = Depends(get_db)):
    """SSO hook for OIDC/SAML token claims."""
    claims = verify_sso_identity(payload)
    user = db.scalar(select(m.User).where(func.lower(m.User.email) == claims["email"].lower()))
    if not user:
        user = m.User(
            name=claims["name"],
            email=claims["email"],
            password_hash=hash_password(uuid.uuid4().hex),
            role=claims["role"],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    audit(db, user, "sso_login", "user", user.id, f"SSO authenticated via {claims.get('provider', 'OIDC')}")
    db.commit()
    return {"token": make_token(user), "user": user_payload(user, db)}


@app.get("/api/me")
def me(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return user_payload(user, db)


@app.get("/api/users")
def list_users(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = select(m.User).order_by(m.User.name)
    return [
        {
            "id": u.id,
            "name": u.name,
            "role": u.role,
            "email": u.email,
            "contractor_company": u.contractor_company,
        }
        for u in db.scalars(stmt)
    ]


# ---------------------------------------------------------------- ASSET HIERARCHY (Tree Structure)
@app.get("/api/hierarchy")
def get_hierarchy_tree(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """
    Returns full asset tree structure (Site -> Location -> System -> Asset -> Component)
    compliant with DIN 31051 and ISO 55001.
    """
    all_nodes = db.scalars(select(m.Asset).order_by(m.Asset.tier, m.Asset.name)).all()
    nodes_by_id = {}
    for a in all_nodes:
        nodes_by_id[a.id] = {**asset_dict(db, a), "children": []}

    roots = []
    for a in all_nodes:
        if a.parent_id and a.parent_id in nodes_by_id:
            nodes_by_id[a.parent_id]["children"].append(nodes_by_id[a.id])
        else:
            roots.append(nodes_by_id[a.id])
    return roots


class NodeIn(BaseModel):
    name: str
    tier: str = "asset"  # site | location | system | asset | component
    parent_id: int | None = None
    criticality: str = "B"
    category: str = ""
    replacement_value: float = 0.0
    install_date: date | None = None
    expected_life_years: int = 10
    serial_number: str = ""
    manufacturer: str = ""
    is_movable: bool = False
    under_warranty: bool = False
    location_id: int | None = None
    cost_centre_id: int | None = None


@app.post("/api/hierarchy/nodes", status_code=201)
def create_node(body: NodeIn, db: Session = Depends(get_db), user: m.User = Depends(require("asset.create"))):
    if not body.name.strip():
        raise HTTPException(422, "Please enter node name.")
    prefix_map = {"site": "SITE", "location": "LOC", "system": "SYS", "asset": "AST", "component": "CMP"}
    prefix = prefix_map.get(body.tier, "AST")
    n = (db.scalar(select(func.max(m.Asset.id))) or 0) + 1
    code = f"{prefix}-{n:04d}"

    loc_id = body.location_id
    if not loc_id and body.parent_id:
        parent = db.get(m.Asset, body.parent_id)
        if parent:
            loc_id = parent.location_id
    if not loc_id:
        first_loc = db.scalar(select(m.Location))
        loc_id = first_loc.id if first_loc else 1

    node = m.Asset(
        code=code,
        name=body.name.strip(),
        tier=body.tier,
        parent_id=body.parent_id,
        criticality=body.criticality,
        category=body.category,
        replacement_value=body.replacement_value,
        install_date=body.install_date,
        expected_life_years=body.expected_life_years,
        serial_number=body.serial_number,
        manufacturer=body.manufacturer,
        is_movable=body.is_movable,
        under_warranty=body.under_warranty,
        location_id=loc_id,
        cost_centre_id=body.cost_centre_id,
    )
    db.add(node)
    db.flush()
    audit(db, user, "create_node", "asset_node", node.id, f"Created {node.tier} node: {node.code} {node.name}")
    db.commit()
    db.refresh(node)
    return asset_dict(db, node)


# ---------------------------------------------------------------- ASSETS (Flat / Search & Backward Compatibility)
@app.get("/api/locations")
def list_locations(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    return [{"id": l.id, "name": l.name} for l in db.scalars(select(m.Location).order_by(m.Location.name))]


@app.get("/api/assets")
def list_assets(q: str = "", tier: str = "", utility_type: str = "", db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = (
        select(m.Asset)
        .options(joinedload(m.Asset.location), joinedload(m.Asset.cost_centre))
        .order_by(m.Asset.code)
    )
    if tier:
        stmt = stmt.where(m.Asset.tier == tier)
    if utility_type:
        stmt = stmt.where(m.Asset.utility_type == utility_type)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(m.Asset.name).like(like),
                func.lower(m.Asset.code).like(like),
                func.lower(m.Asset.category).like(like),
            )
        )
    return [asset_dict(db, a) for a in db.scalars(stmt).unique()]


class AssetIn(BaseModel):
    name: str
    category: str = ""
    is_movable: bool = False
    under_warranty: bool = False
    replacement_value: float = 0
    location_id: int
    tier: str = "asset"
    criticality: str = "B"
    parent_id: int | None = None
    utility_type: str | None = None


@app.post("/api/assets", status_code=201)
def create_asset(body: AssetIn, db: Session = Depends(get_db), user: m.User = Depends(require("asset.create"))):
    if not body.name.strip():
        raise HTTPException(422, "Please enter the asset name.")
    loc = db.get(m.Location, body.location_id)
    if not loc:
        raise HTTPException(422, "Please choose a location.")
    n = (db.scalar(select(func.max(m.Asset.id))) or 0) + 1
    asset = m.Asset(
        code=f"AST-{n:04d}",
        name=body.name.strip(),
        category=body.category,
        is_movable=body.is_movable,
        under_warranty=body.under_warranty,
        replacement_value=body.replacement_value,
        location_id=loc.id,
        tier=body.tier,
        criticality=body.criticality,
        parent_id=body.parent_id,
        utility_type=body.utility_type,
    )
    db.add(asset)
    db.flush()
    db.add(m.LocationHistory(asset_id=asset.id, from_location="", to_location=loc.name))
    audit(db, user, "create", "asset", asset.id, f"{asset.code} {asset.name} at {loc.name}")
    db.commit()
    db.refresh(asset)
    return asset_dict(db, asset)


@app.get("/api/assets/by-code/{code}")
def asset_by_code(code: str, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    a = db.scalar(select(m.Asset).where(func.lower(m.Asset.code) == code.strip().lower()))
    if not a:
        raise HTTPException(404, f"No asset with code {code}.")
    return asset_detail(a.id, db, user)


@app.get("/api/assets/{asset_id}")
def asset_detail(asset_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    a = db.get(m.Asset, asset_id)
    if not a:
        raise HTTPException(404, "Asset not found.")
    history = db.scalars(
        select(m.LocationHistory).where(m.LocationHistory.asset_id == a.id).order_by(m.LocationHistory.moved_at.desc())
    )
    jobs = db.scalars(select(m.Job).where(m.Job.asset_id == a.id).order_by(m.Job.created_at.desc()))
    pending = db.scalar(select(m.Transfer).where(m.Transfer.asset_id == a.id, m.Transfer.status == "pending"))

    # Parents hierarchy breadcrumbs
    breadcrumbs = []
    curr = a.parent
    while curr:
        breadcrumbs.append({"id": curr.id, "code": curr.code, "name": curr.name, "tier": curr.tier})
        curr = curr.parent
    breadcrumbs.reverse()

    # Children sub-nodes
    children = [
        {"id": c.id, "code": c.code, "name": c.name, "tier": c.tier, "criticality": c.criticality, "status": c.status}
        for c in a.children
    ]

    # Documents
    docs = [
        {
            "id": d.id,
            "title": d.title,
            "doc_type": d.doc_type,
            "version": d.version,
            "filename": d.filename,
            "url": f"/uploads/{d.filename}",
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at.isoformat(),
        }
        for d in a.documents
    ]

    # BOM items
    bom = [
        {
            "id": b.id,
            "part_id": b.part_id,
            "sku": b.part.sku,
            "name": b.part.name,
            "unit": b.part.unit,
            "stock": b.part.stock,
            "qty_recommended": b.qty_recommended,
            "unit_cost": b.part.unit_cost,
        }
        for b in a.boms
    ]

    # Condition readings
    readings = [
        {
            "id": r.id,
            "metric": r.metric,
            "value": r.value,
            "unit": r.unit,
            "status": r.status,
            "recorded_by": r.recorded_by,
            "at": r.recorded_at.isoformat(),
        }
        for r in sorted(a.readings, key=lambda x: x.recorded_at, reverse=True)[:10]
    ]

    return {
        **asset_dict(db, a),
        "pending_transfer": bool(pending),
        "breadcrumbs": breadcrumbs,
        "children": children,
        "documents": docs,
        "bom": bom,
        "recent_readings": readings,
        "history": [{"from": h.from_location, "to": h.to_location, "at": h.moved_at.isoformat()} for h in history],
        "jobs": [
            {
                "id": j.id,
                "wo_number": j.wo_number,
                "title": j.title,
                "type": j.type,
                "din_type": j.din_type,
                "status": j.status,
                "priority": j.priority,
                "due_date": j.due_date.isoformat() if j.due_date else None,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
    }


# ---------------------------------------------------------------- FAILURE CODE LIBRARY (ISO 14224)
@app.get("/api/failure-codes")
def list_failure_codes(category: str = "", db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = select(m.FailureCode).order_by(m.FailureCode.asset_category, m.FailureCode.failure_mode)
    if category:
        stmt = stmt.where(func.lower(m.FailureCode.asset_category).like(f"%{category.lower()}%"))
    return [
        {
            "id": fc.id,
            "code": fc.code,
            "asset_category": fc.asset_category,
            "failure_mode": fc.failure_mode,
            "failure_cause": fc.failure_cause,
            "failure_effect": fc.failure_effect,
            "detection_method": fc.detection_method,
        }
        for fc in db.scalars(stmt)
    ]


# ---------------------------------------------------------------- MAINTENANCE PLANS (Multi-Trigger DIN 31051)
@app.get("/api/plans")
def list_maintenance_plans(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    plans = db.scalars(select(m.MaintenancePlan).order_by(m.MaintenancePlan.code)).all()
    out = []
    for p in plans:
        out.append({
            "id": p.id,
            "code": p.code,
            "asset": {"id": p.asset.id, "code": p.asset.code, "name": p.asset.name, "location": p.asset.location.name},
            "din_type": p.din_type,
            "title": p.title,
            "description": p.description,
            "trigger_type": p.trigger_type,
            "interval_days": p.interval_days,
            "interval_hours": p.interval_hours,
            "condition_metric": p.condition_metric,
            "condition_threshold": p.condition_threshold,
            "last_performed_at": p.last_performed_at.isoformat() if p.last_performed_at else None,
            "next_due_date": p.next_due_date.isoformat() if p.next_due_date else None,
            "priority": p.priority,
            "estimated_hours": p.estimated_hours,
            "assigned_to": p.assigned_to,
            "assigned_to_name": user_name(db, p.assigned_to),
            "loto_required": p.loto_required,
            "checklist_template": json.loads(p.checklist_template or "[]"),
            "active": p.active,
        })
    return out


class PlanIn(BaseModel):
    asset_id: int
    din_type: str = "servicing"  # inspection | servicing | repair | improvement
    title: str
    description: str = ""
    trigger_type: str = "calendar"  # calendar | running_hours | condition | event
    interval_days: int | None = 30
    interval_hours: float | None = None
    condition_metric: str | None = None
    condition_threshold: float | None = None
    priority: str = "medium"
    estimated_hours: float = 2.0
    assigned_to: int | None = None
    loto_required: bool = False
    checklist_template: list[str] = []


@app.post("/api/plans", status_code=201)
def create_plan(body: PlanIn, db: Session = Depends(get_db), user: m.User = Depends(require("plan.manage"))):
    asset = db.get(m.Asset, body.asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found.")
    n = (db.scalar(select(func.max(m.MaintenancePlan.id))) or 0) + 1
    next_due = date.today() + timedelta(days=body.interval_days or 30)

    plan = m.MaintenancePlan(
        code=f"PM-{n:04d}",
        asset_id=body.asset_id,
        din_type=body.din_type,
        title=body.title.strip(),
        description=body.description.strip(),
        trigger_type=body.trigger_type,
        interval_days=body.interval_days,
        interval_hours=body.interval_hours,
        condition_metric=body.condition_metric,
        condition_threshold=body.condition_threshold,
        next_due_date=next_due,
        priority=body.priority,
        estimated_hours=body.estimated_hours,
        assigned_to=body.assigned_to,
        loto_required=body.loto_required,
        checklist_template=json.dumps(body.checklist_template),
    )
    db.add(plan)
    db.flush()
    audit(db, user, "create_plan", "maintenance_plan", plan.id, f"Created {plan.code} for {asset.name}")
    db.commit()
    return {"id": plan.id, "code": plan.code, "message": "Maintenance plan registered."}


@app.post("/api/plans/{plan_id}/trigger")
def trigger_plan_work_order(plan_id: int, db: Session = Depends(get_db), user: m.User = Depends(require("job.create"))):
    """Generates an official Work Order from a maintenance plan template."""
    plan = db.get(m.MaintenancePlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found.")

    n = (db.scalar(select(func.max(m.Job.id))) or 0) + 1
    wo_number = f"WO-{date.today().year}-{n:04d}"

    wo = m.Job(
        wo_number=wo_number,
        din_type=plan.din_type,
        type="scheduled",
        asset_id=plan.asset_id,
        plan_id=plan.id,
        title=f"[{plan.code}] {plan.title}",
        description=plan.description,
        priority=plan.priority,
        status="approved",  # Scheduled PMs auto-enter approved state ready to execute
        estimated_hours=plan.estimated_hours,
        due_date=plan.next_due_date or date.today(),
        created_by=user.id,
        assigned_to=plan.assigned_to or user.id,
        loto_required=plan.loto_required,
        cost_centre_id=plan.asset.cost_centre_id,
    )
    db.add(wo)
    db.flush()

    # Create checklists from template
    tasks = json.loads(plan.checklist_template or "[]")
    for idx, task in enumerate(tasks, start=1):
        db.add(m.WorkOrderChecklist(job_id=wo.id, step_number=idx, task_description=task, is_mandatory=True))

    # Pre-fill parts from asset BOM
    for bom_item in plan.asset.boms:
        db.add(m.JobPart(job_id=wo.id, part_id=bom_item.part_id, qty=bom_item.qty_recommended, unit_cost=bom_item.part.unit_cost))

    # Add default LOTO if required
    if plan.loto_required:
        db.add(m.WorkOrderLOTO(job_id=wo.id, step_number=1, hazard_description="Main 415V electrical switch locked & tagged out", loto_type="electrical"))
        db.add(m.WorkOrderLOTO(job_id=wo.id, step_number=2, hazard_description="Residual hydraulic/pneumatic pressure drained to zero", loto_type="hydraulic"))

    # Update plan schedule
    plan.last_performed_at = utcnow()
    if plan.interval_days:
        plan.next_due_date = date.today() + timedelta(days=plan.interval_days)

    audit(db, user, "auto_generate_wo", "job", wo.id, f"Auto-generated {wo.wo_number} from {plan.code}")
    db.commit()
    db.refresh(wo)
    return job_dict(db, wo, user)


# ---------------------------------------------------------------- WORK ORDERS (Lifecycle & Views)
class JobIn(BaseModel):
    type: str = "repair"
    din_type: str = "repair"
    asset_id: int
    title: str
    description: str = ""
    priority: str = "medium"
    estimated_cost: float = 0
    estimated_hours: float = 2.0
    due_date: date | None = None
    assigned_to: int | None = None
    contractor_id: int | None = None
    loto_required: bool = False
    cost_centre_id: int | None = None
    checklists: list[str] = []


@app.get("/api/jobs")
def list_jobs(
    status: str = "",
    din_type: str = "",
    priority: str = "",
    asset_id: int | None = None,
    q: str = "",
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    stmt = (
        select(m.Job)
        .options(
            joinedload(m.Job.asset).joinedload(m.Asset.location),
            joinedload(m.Job.cost_centre),
            selectinload(m.Job.parts),
            selectinload(m.Job.checklists),
            selectinload(m.Job.loto_steps),
        )
        .order_by(m.Job.created_at.desc())
    )
    # Contractors only see their assigned work orders
    if user.role == "contractor":
        stmt = stmt.where(m.Job.contractor_id == user.id)

    if status:
        stmt = stmt.where(m.Job.status == status)
    if din_type:
        stmt = stmt.where(m.Job.din_type == din_type)
    if priority:
        stmt = stmt.where(m.Job.priority == priority)
    if asset_id:
        stmt = stmt.where(m.Job.asset_id == asset_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(m.Job.title).like(like), func.lower(m.Job.wo_number).like(like)))

    return [job_dict(db, j, user) for j in db.scalars(stmt).unique()]


@app.get("/api/jobs/kanban")
def get_kanban_board(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """Kanban board categorized by work order lifecycle columns."""
    columns = ["created", "planned", "approved", "in_progress", "review", "closed"]
    board = {col: [] for col in columns}

    stmt = (
        select(m.Job)
        .options(
            joinedload(m.Job.asset).joinedload(m.Asset.location),
            joinedload(m.Job.cost_centre),
            selectinload(m.Job.parts),
            selectinload(m.Job.checklists),
            selectinload(m.Job.loto_steps),
        )
        .order_by(m.Job.created_at.desc())
    )
    if user.role == "contractor":
        stmt = stmt.where(m.Job.contractor_id == user.id)

    for j in db.scalars(stmt).unique():
        col = j.status if j.status in board else "created"
        board[col].append(job_dict(db, j, user))
    return board


@app.get("/api/jobs/gantt")
def get_gantt_schedule(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """Timeline data for drag-and-drop Gantt scheduler."""
    stmt = select(m.Job).where(m.Job.status.in_(OPEN_STATES)).order_by(m.Job.due_date)
    items = []
    for j in db.scalars(stmt):
        start = j.scheduled_start or j.created_at
        end = j.scheduled_end or (start + timedelta(hours=j.estimated_hours or 3))
        items.append({
            "id": j.id,
            "wo_number": j.wo_number or f"WO-{j.id}",
            "title": j.title,
            "asset": j.asset.name,
            "criticality": j.asset.criticality,
            "priority": j.priority,
            "status": j.status,
            "assigned_to": j.assigned_to,
            "assigned_to_name": user_name(db, j.assigned_to),
            "start": start.isoformat(),
            "end": end.isoformat(),
            "estimated_hours": j.estimated_hours,
        })
    return items


@app.put("/api/jobs/{job_id}/reschedule")
def reschedule_job(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.plan")),
):
    """Drag-to-reschedule endpoint for Gantt view."""
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    if "start" in body:
        job.scheduled_start = datetime.fromisoformat(body["start"])
    if "end" in body:
        job.scheduled_end = datetime.fromisoformat(body["end"])
    if "due_date" in body and body["due_date"]:
        job.due_date = date.fromisoformat(body["due_date"])
    if "assigned_to" in body:
        job.assigned_to = body["assigned_to"]
    audit(db, user, "reschedule", "job", job.id, f"Rescheduled {job.wo_number} to {job.scheduled_start}")
    db.commit()
    return job_dict(db, job, user)


@app.post("/api/jobs", status_code=201)
def create_job(body: JobIn, db: Session = Depends(get_db), user: m.User = Depends(require("job.create"))):
    if not body.title.strip():
        raise HTTPException(422, "Please enter the work order title.")
    if body.type == "scheduled" and not body.due_date:
        raise HTTPException(422, "Please set a due date for scheduled service.")
    asset = db.get(m.Asset, body.asset_id)
    if not asset:
        raise HTTPException(422, "Please choose an asset.")

    # Rule: Check if open job already exists for this asset
    existing = open_job_for(db, asset.id)
    if existing:
        raise HTTPException(409, f"Asset already has an open work order (#{existing.id}: {existing.title}).")

    n = (db.scalar(select(func.max(m.Job.id))) or 0) + 1
    wo_number = f"WO-{date.today().year}-{n:04d}"

    # Auto-flag LOTO requirement for critical assets or high-voltage/press machines
    loto_req = body.loto_required or asset.criticality == "A" or "press" in asset.name.lower()

    job = m.Job(
        wo_number=wo_number,
        type=body.type,
        din_type=body.din_type,
        asset_id=asset.id,
        title=body.title.strip(),
        description=body.description.strip(),
        priority=body.priority,
        status="created",
        estimated_cost=body.estimated_cost,
        estimated_hours=body.estimated_hours,
        due_date=body.due_date,
        cost_centre_id=body.cost_centre_id or asset.cost_centre_id,
        created_by=user.id,
        assigned_to=body.assigned_to or user.id,
        contractor_id=body.contractor_id,
        loto_required=loto_req,
        warranty_at_creation=asset.under_warranty,
    )
    db.add(job)
    db.flush()

    # Pre-fill parts from asset Bill of Materials (BOM)
    for b in asset.boms:
        db.add(m.JobPart(job_id=job.id, part_id=b.part_id, qty=b.qty_recommended, unit_cost=b.part.unit_cost))

    # Checklists
    tasks = body.checklists or [
        "Inspect component for physical damage or wear",
        "Perform DIN 31051 compliance checks & functional test",
        "Clean work area & restore safety guards",
    ]
    for idx, t in enumerate(tasks, start=1):
        db.add(m.WorkOrderChecklist(job_id=job.id, step_number=idx, task_description=t, is_mandatory=True))

    # LOTO checklist if required
    if loto_req:
        db.add(m.WorkOrderLOTO(job_id=job.id, step_number=1, hazard_description="Main breaker 415V isolated & padlock locked", loto_type="electrical"))
        db.add(m.WorkOrderLOTO(job_id=job.id, step_number=2, hazard_description="Hydraulic / pressure lines depressurized & gauge reads 0", loto_type="hydraulic"))
        db.add(m.WorkOrderLOTO(job_id=job.id, step_number=3, hazard_description="PPE verified (Safety glasses, insulated gloves, steel-cap boots)", loto_type="ppe"))

    audit(db, user, "create", "job", job.id, f"Created {job.wo_number}: {job.title} on {asset.name}")
    db.commit()
    db.refresh(job)
    return job_dict(db, job, user)


@app.get("/api/jobs/{job_id}")
def get_job_detail(job_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = (
        select(m.Job)
        .options(
            joinedload(m.Job.asset).joinedload(m.Asset.location),
            joinedload(m.Job.cost_centre),
            selectinload(m.Job.parts),
            selectinload(m.Job.checklists),
            selectinload(m.Job.loto_steps),
        )
        .where(m.Job.id == job_id)
    )
    job = db.scalar(stmt)
    if not job:
        raise HTTPException(404, "Job not found.")
    return job_dict(db, job, user)


@app.patch("/api/jobs/{job_id}")
def patch_job(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.create")),
):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    if job.status != "created":
        raise HTTPException(409, "Jobs can only be edited before they are sent for approval.")
    if "title" in body:
        job.title = body["title"]
    if "description" in body:
        job.description = body["description"]
    if "priority" in body:
        job.priority = body["priority"]
    if "due_date" in body:
        job.due_date = date.fromisoformat(body["due_date"]) if body["due_date"] else None
    if "estimated_cost" in body:
        job.estimated_cost = float(body["estimated_cost"] or 0)
    db.commit()
    return job_dict(db, job, user)


# ---------------------------------------------------------------- LOTO SAFETY PERMIT SIGN-OFF
@app.post("/api/jobs/{job_id}/loto/sign")
def sign_loto_permit(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    """Mandatory safety permit sign-off. Technicians verify each physical lockout."""
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    for step in job.loto_steps:
        step.verified = True
        step.verified_by = user.name
        step.verified_at = utcnow()

    job.loto_signed = True
    job.loto_signed_by = user.name
    job.loto_signed_at = utcnow()

    audit(db, user, "loto_signoff", "job", job.id, f"LOTO permit signed off by {user.name}")
    db.commit()
    return {"message": "Safety Permit to Work / LOTO signed off successfully.", "loto_signed": True}


# ---------------------------------------------------------------- DIGITAL CHECKLIST STEP TOGGLE
@app.post("/api/jobs/{job_id}/checklists/{step_id}/toggle")
def toggle_checklist_step(
    job_id: int,
    step_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    step = db.get(m.WorkOrderChecklist, step_id)
    if not step or step.job_id != job_id:
        raise HTTPException(404, "Checklist step not found.")

    step.is_completed = body.get("completed", not step.is_completed)
    step.completed_by = user.name if step.is_completed else ""
    step.completed_at = utcnow() if step.is_completed else None
    if "notes" in body:
        step.notes = body["notes"]

    db.commit()
    return {"step_id": step.id, "is_completed": step.is_completed, "completed_by": step.completed_by}


# ---------------------------------------------------------------- WORK ORDER ACTIONS (State Machine)
ACTION_PERMS = {
    "send": "job.send",
    "plan": "job.plan",
    "approve": "job.decide",
    "reject": "job.decide",
    "assign": "job.decide",
    "start": "job.work",
    "review": "job.work",
    "close": "job.work",
    "revise": "job.send",
}


@app.post("/api/jobs/{job_id}/action/{action}")
def perform_job_action(
    job_id: int,
    action: str,
    body: dict = {},
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    perm = ACTION_PERMS.get(action)
    user_perms = PERMISSIONS.get(user.role, set())
    if perm and perm not in user_perms and user.role not in ("admin", "super_admin"):
        raise HTTPException(403, f"Your role ({user.role}) is not allowed to '{action}' jobs.")

    allowed = job_actions(job, user)
    if action not in allowed and user.role not in ("admin", "super_admin"):
        raise HTTPException(409, f"Cannot '{action}' a job that is in '{job.status}'.")

    now = utcnow()

    if action == "send":
        job.status = "sent_for_approval"
        notify(db, users_with_role(db, "maintenance_manager", "admin", "super_admin", "plant_head"), f"Job #{job.id} awaiting approval: {job.title}", f"/jobs/{job.id}")

    elif action == "plan":
        job.status = "planned"
        if "assigned_to" in body:
            job.assigned_to = body["assigned_to"]
        if "scheduled_start" in body:
            job.scheduled_start = datetime.fromisoformat(body["scheduled_start"])

    elif action == "approve":
        job.status = "approved"
        notify(db, [job.assigned_to, job.contractor_id], f"Job #{job.id} approved: {job.title}", f"/jobs/{job.id}")

    elif action == "reject":
        reason = body.get("reason", "").strip()
        if not reason:
            raise HTTPException(422, "Please state the reason for rejecting.")
        job.status = "rejected"
        job.rejection_reason = reason
        notify(db, [job.created_by], f"Job #{job.id} was rejected: {reason}", f"/jobs/{job.id}")

    elif action == "assign":
        assigned_to = body.get("assigned_to")
        contractor_id = body.get("contractor_id")
        if assigned_to is not None:
            job.assigned_to = int(assigned_to) if assigned_to else None
        if contractor_id is not None:
            job.contractor_id = int(contractor_id) if contractor_id else None

        assignee_id = job.assigned_to or job.contractor_id
        if assignee_id:
            assignee = db.get(m.User, assignee_id)
            assignee_name = assignee.name if assignee else "user"
            notify(db, [assignee_id], f"Work order #{job.id} assigned to you: {job.title}", f"/jobs/{job.id}")
            audit(db, user, "assign", "job", job.id, f"Assigned #{job.id} to {assignee_name}")

    elif action == "start":
        if job.loto_required and not job.loto_signed:
            raise HTTPException(400, "Safety violation: Cannot start work until Permit to Work / LOTO steps are signed off.")
        job.status = "in_progress"
        job.start_time = now

    elif action == "review":
        job.status = "review"
        if "contractor_invoice_amount" in body:
            job.contractor_invoice_amount = float(body["contractor_invoice_amount"])
        if "contractor_invoice_ref" in body:
            job.contractor_invoice_ref = body["contractor_invoice_ref"]
        notify(db, users_with_role(db, "maintenance_manager", "admin", "super_admin", "plant_head"), f"Job #{job.id} submitted for review: {job.title}", f"/jobs/{job.id}")

    elif action == "close":
        if job.type == "repair" and not (job.breakdown_reason or body.get("breakdown_reason")):
            raise HTTPException(422, "Please record why it broke before closing.")

        job.status = "completed"  # keep "completed" for backward compatibility with existing tests
        job.end_time = now
        if "action_taken" in body:
            job.action_taken = body["action_taken"]
        if "breakdown_reason" in body:
            job.breakdown_reason = body["breakdown_reason"]
        if "failure_mode" in body:
            job.failure_mode = body["failure_mode"]
        if "failure_cause" in body:
            job.failure_cause = body["failure_cause"]
        if "failure_effect" in body:
            job.failure_effect = body["failure_effect"]

        for jp in job.parts:
            part = jp.part
            if part:
                part.stock = max(0, part.stock - jp.qty)

        if job.cost_centre:
            parts_cost = sum(p.qty * p.unit_cost for p in job.parts)
            labour_cost = job.labour_hours * job.labour_rate
            contractor_cost = job.contractor_invoice_amount or 0.0
            job.cost_centre.budget_spent += (parts_cost + labour_cost + contractor_cost)

    elif action == "revise":
        job.status = "created"

    audit(db, user, f"job_{action}", "job", job.id, f"Transitioned {job.wo_number} to {job.status}")
    db.commit()
    return job_dict(db, job, user)


@app.put("/api/jobs/{job_id}/assign")
def assign_job_direct(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    if user.role not in ("admin", "super_admin", "maintenance_manager", "plant_head", "maintenance_engineer"):
        raise HTTPException(403, "Not authorized to assign work orders.")
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    assigned_to = body.get("assigned_to")
    contractor_id = body.get("contractor_id")
    if assigned_to is not None:
        job.assigned_to = int(assigned_to) if assigned_to else None
    if contractor_id is not None:
        job.contractor_id = int(contractor_id) if contractor_id else None

    assignee_id = job.assigned_to or job.contractor_id
    if assignee_id:
        assignee = db.get(m.User, assignee_id)
        assignee_name = assignee.name if assignee else "user"
        notify(db, [assignee_id], f"Work order #{job.id} assigned to you: {job.title}", f"/jobs/{job.id}")
        audit(db, user, "assign", "job", job.id, f"Assigned #{job.id} to {assignee_name}")
    db.commit()
    db.refresh(job)
    return job_dict(db, job, user)


# ---------------------------------------------------------------- WORK DETAILS & PARTS
@app.put("/api/jobs/{job_id}/work")
def update_work_details(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    if "breakdown_reason" in body:
        job.breakdown_reason = body["breakdown_reason"]
    if "failure_mode" in body:
        job.failure_mode = body["failure_mode"]
    if "failure_cause" in body:
        job.failure_cause = body["failure_cause"]
    if "failure_effect" in body:
        job.failure_effect = body["failure_effect"]
    if "action_taken" in body:
        job.action_taken = body["action_taken"]
    if "labour_hours" in body:
        job.labour_hours = float(body["labour_hours"] or 0)
    if "labour_rate" in body:
        job.labour_rate = float(body["labour_rate"] or 0)

    db.commit()
    return job_dict(db, job, user)


@app.post("/api/jobs/{job_id}/parts", status_code=201)
def add_job_part(
    job_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    part_id = int(body["part_id"])
    qty = int(body.get("qty", 1))
    part = db.get(m.SparePart, part_id)
    if not part:
        raise HTTPException(404, "Part not found.")
    if qty > part.stock:
        raise HTTPException(409, f"Only {part.stock} in stock.")

    jp = m.JobPart(job_id=job.id, part_id=part.id, qty=qty, unit_cost=part.unit_cost)
    db.add(jp)
    db.commit()
    return job_dict(db, job, user)


@app.delete("/api/jobs/{job_id}/parts/{jp_id}")
def remove_job_part(
    job_id: int,
    jp_id: int,
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    jp = db.get(m.JobPart, jp_id)
    if jp and jp.job_id == job_id:
        db.delete(jp)
        db.commit()
    return {"message": "Part removed."}


@app.post("/api/jobs/{job_id}/photos")
def upload_job_photo(
    job_id: int,
    file: UploadFile = File(...),
    note: str = Form(""),
    db: Session = Depends(get_db),
    user: m.User = Depends(require("job.work")),
):
    job = db.get(m.Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    ext = Path(file.filename or "").suffix or ".jpg"
    filename = f"wo_{job.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    p = m.JobPhoto(job_id=job.id, filename=filename, note=note)
    db.add(p)
    db.commit()
    return job_dict(db, job, user)


# ---------------------------------------------------------------- SPARE PARTS & BILL OF MATERIALS (BOM)
@app.get("/api/spare_parts")
@app.get("/api/parts")
def list_spare_parts(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    parts = db.scalars(select(m.SparePart).order_by(m.SparePart.name)).all()
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "unit": p.unit,
            "stock": p.stock,
            "min_level": p.min_level,
            "max_level": p.max_level,
            "vendor": p.vendor,
            "unit_cost": p.unit_cost,
            "location_bin": p.location_bin,
            "low": p.stock <= p.min_level,
            "order_qty": max(0, p.max_level - p.stock),
        }
        for p in parts
    ]


@app.post("/api/parts", status_code=201)
def create_spare_part(body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("part.manage"))):
    p = m.SparePart(
        sku=body["sku"].strip(),
        name=body["name"].strip(),
        unit=body.get("unit", "pcs"),
        stock=int(body.get("stock", 0)),
        min_level=int(body.get("min_level", 0)),
        max_level=int(body.get("max_level", 0)),
        vendor=body.get("vendor", ""),
        unit_cost=float(body.get("unit_cost", 0)),
        location_bin=body.get("location_bin", "Warehouse A-1"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.post("/api/parts/{part_id}/stock")
def adjust_part_stock(part_id: int, body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("part.manage"))):
    part = db.get(m.SparePart, part_id)
    if not part:
        raise HTTPException(404, "Part not found.")
    qty = int(body.get("qty", 0))
    part.stock += qty
    audit(db, user, "stock_in", "spare_part", part.id, f"Received {qty} {part.unit} for {part.name}. Stock now {part.stock}")
    db.commit()
    return {"id": part.id, "name": part.name, "stock": part.stock}


# ---------------------------------------------------------------- ASSET BILL OF MATERIALS (BOM)
@app.get("/api/assets/{asset_id}/bom")
def get_asset_bom(asset_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    items = db.scalars(select(m.BOMItem).where(m.BOMItem.asset_id == asset_id)).all()
    return [
        {
            "id": b.id,
            "part_id": b.part_id,
            "sku": b.part.sku,
            "name": b.part.name,
            "unit": b.part.unit,
            "stock": b.part.stock,
            "qty_recommended": b.qty_recommended,
            "unit_cost": b.part.unit_cost,
            "notes": b.notes,
        }
        for b in items
    ]


@app.post("/api/assets/{asset_id}/bom", status_code=201)
def add_asset_bom_item(asset_id: int, body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("bom.manage"))):
    part_id = int(body["part_id"])
    qty = int(body.get("qty_recommended", 1))
    notes = body.get("notes", "")

    bom = m.BOMItem(asset_id=asset_id, part_id=part_id, qty_recommended=qty, notes=notes)
    db.add(bom)
    db.commit()
    return {"message": "Part added to asset Bill of Materials."}


# ---------------------------------------------------------------- PROCUREMENT WORKFLOW
@app.get("/api/procurement/requests")
def list_purchase_requests(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    reqs = db.scalars(select(m.PurchaseRequest).order_by(m.PurchaseRequest.created_at.desc())).all()
    return [
        {
            "id": r.id,
            "pr_number": r.pr_number,
            "part": {"id": r.part.id, "name": r.part.name, "sku": r.part.sku, "stock": r.part.stock},
            "qty": r.qty,
            "estimated_cost": r.estimated_cost,
            "vendor": r.vendor,
            "status": r.status,
            "requested_by": user_name(db, r.requested_by),
            "approved_by": user_name(db, r.approved_by),
            "created_at": r.created_at.isoformat(),
        }
        for r in reqs
    ]


@app.post("/api/procurement/requests", status_code=201)
def create_purchase_request(body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("procurement.manage"))):
    part_id = int(body["part_id"])
    qty = int(body["qty"])
    part = db.get(m.SparePart, part_id)
    if not part:
        raise HTTPException(404, "Part not found.")

    n = (db.scalar(select(func.max(m.PurchaseRequest.id))) or 0) + 1
    pr = m.PurchaseRequest(
        pr_number=f"PR-{date.today().year}-{n:04d}",
        part_id=part.id,
        qty=qty,
        estimated_cost=qty * part.unit_cost,
        vendor=part.vendor or body.get("vendor", ""),
        requested_by=user.id,
        status="requested",
    )
    db.add(pr)
    db.commit()
    return {"id": pr.id, "pr_number": pr.pr_number, "message": "Purchase request created."}


@app.post("/api/procurement/requests/{pr_id}/action/{action}")
def procurement_action(
    pr_id: int,
    action: str,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    pr = db.get(m.PurchaseRequest, pr_id)
    if not pr:
        raise HTTPException(404, "Purchase request not found.")

    user_perms = PERMISSIONS.get(user.role, set())
    has_all = "*" in user_perms or user.role in ("admin", "super_admin")

    if action == "approve":
        if not (has_all or "procurement.approve" in user_perms or "procurement.manage" in user_perms):
            raise HTTPException(403, "Permission denied")
        pr.status = "approved"
        pr.approved_by = user.id
    elif action == "order":
        if not (has_all or "procurement.order" in user_perms or "procurement.manage" in user_perms):
            raise HTTPException(403, "Permission denied")
        pr.status = "ordered"
        pr.ordered_at = utcnow()
    elif action == "receive":
        if not (has_all or "procurement.manage" in user_perms or "procurement.order" in user_perms):
            raise HTTPException(403, "Permission denied")
        pr.status = "received"
        pr.received_at = utcnow()
        pr.part.stock += pr.qty  # Automatically replenish stock
        audit(db, user, "receive_pr", "purchase_request", pr.id, f"Received {pr.qty} {pr.part.unit} of {pr.part.name}")
    elif action == "reject":
        if not (has_all or "procurement.approve" in user_perms or "procurement.manage" in user_perms):
            raise HTTPException(403, "Permission denied")
        pr.status = "rejected"

    db.commit()
    return {"id": pr.id, "status": pr.status}


# ---------------------------------------------------------------- CONDITION MONITORING & AUTO-WORK ORDERS
@app.get("/api/condition/readings")
def list_condition_readings(asset_id: int | None = None, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = select(m.ConditionReading).order_by(m.ConditionReading.recorded_at.desc())
    if asset_id:
        stmt = stmt.where(m.ConditionReading.asset_id == asset_id)
    return [
        {
            "id": r.id,
            "asset": {"id": r.asset.id, "code": r.asset.code, "name": r.asset.name},
            "metric": r.metric,
            "value": r.value,
            "unit": r.unit,
            "threshold_warning": r.threshold_warning,
            "threshold_critical": r.threshold_critical,
            "status": r.status,
            "recorded_by": r.recorded_by,
            "recorded_at": r.recorded_at.isoformat(),
            "notes": r.notes,
        }
        for r in db.scalars(stmt.limit(50))
    ]


@app.post("/api/condition/readings", status_code=201)
def log_condition_reading(body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("reading.log"))):
    asset_id = int(body["asset_id"])
    asset = db.get(m.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found.")

    metric = body["metric"]
    val = float(body["value"])
    unit = body.get("unit", "")
    warn_th = float(body.get("threshold_warning", 0)) or None
    crit_th = float(body.get("threshold_critical", 0)) or None

    reading_status = "normal"
    if crit_th and val >= crit_th:
        reading_status = "critical"
    elif warn_th and val >= warn_th:
        reading_status = "warning"

    reading = m.ConditionReading(
        asset_id=asset.id,
        metric=metric,
        value=val,
        unit=unit,
        threshold_warning=warn_th,
        threshold_critical=crit_th,
        status=reading_status,
        recorded_by=user.name,
        notes=body.get("notes", ""),
    )
    db.add(reading)
    db.flush()

    # Automatic Emergency Work Order Generation on Critical Threshold Breach!
    auto_wo = None
    if reading_status == "critical":
        existing = open_job_for(db, asset.id)
        if not existing:
            n = (db.scalar(select(func.max(m.Job.id))) or 0) + 1
            auto_wo = m.Job(
                wo_number=f"WO-{date.today().year}-{n:04d}",
                type="repair",
                din_type="repair",
                asset_id=asset.id,
                title=f"[Condition Alert] Critical {metric}: {val} {unit}",
                description=f"Auto-generated work order triggered by threshold breach: {metric} reached {val} {unit} (Critical limit: {crit_th} {unit}).",
                priority="critical",
                status="approved",
                due_date=date.today(),
                created_by=user.id,
                loto_required=True,
            )
            db.add(auto_wo)
            audit(db, user, "auto_condition_wo", "job", n, f"Threshold breach: auto-created emergency WO on {asset.name}")

    audit(db, user, "condition_reading", "condition_reading", reading.id, f"Logged {metric}={val} {unit} ({reading_status}) on {asset.name}")
    db.commit()
    return {
        "id": reading.id,
        "status": reading_status,
        "auto_wo_created": bool(auto_wo),
        "message": "Reading recorded." + (" Emergency work order generated!" if auto_wo else ""),
    }


# ---------------------------------------------------------------- DOCUMENT MANAGEMENT (Version History)
@app.get("/api/assets/{asset_id}/documents")
def list_asset_documents(asset_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    docs = db.scalars(select(m.AssetDocument).where(m.AssetDocument.asset_id == asset_id).order_by(m.AssetDocument.uploaded_at.desc())).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "doc_type": d.doc_type,
            "version": d.version,
            "filename": d.filename,
            "url": f"/uploads/{d.filename}",
            "file_size_bytes": d.file_size_bytes,
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at.isoformat(),
            "notes": d.notes,
        }
        for d in docs
    ]


@app.post("/api/assets/{asset_id}/documents", status_code=201)
def upload_asset_document(
    asset_id: int,
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form("manual"),
    version: str = Form("1.0"),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    user: m.User = Depends(require("doc.manage")),
):
    asset = db.get(m.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found.")

    ext = Path(file.filename or "").suffix or ".pdf"
    safe_name = f"doc_{asset.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / safe_name
    size = 0
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
        size = dest.stat().st_size

    doc = m.AssetDocument(
        asset_id=asset.id,
        title=title.strip(),
        doc_type=doc_type,
        version=version.strip(),
        filename=safe_name,
        file_size_bytes=size,
        uploaded_by=user.name,
        notes=notes.strip(),
    )
    db.add(doc)
    audit(db, user, "upload_document", "asset_document", doc.id, f"Uploaded {doc.title} (v{doc.version}) for {asset.name}")
    db.commit()
    return {"id": doc.id, "title": doc.title, "version": doc.version, "url": f"/uploads/{safe_name}"}


# ---------------------------------------------------------------- WARRANTY & SLA CONTRACTS
@app.get("/api/contracts")
def list_contracts(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    contracts = db.scalars(select(m.Contract).order_by(m.Contract.end_date)).all()
    today = date.today()
    out = []
    for c in contracts:
        days_left = (c.end_date - today).days
        status = "expired" if days_left < 0 else "warning" if days_left <= 30 else "active"
        out.append({
            "id": c.id,
            "asset": {"id": c.asset.id, "code": c.asset.code, "name": c.asset.name},
            "vendor_name": c.vendor_name,
            "contract_type": c.contract_type,
            "start_date": c.start_date.isoformat(),
            "end_date": c.end_date.isoformat(),
            "days_left": days_left,
            "sla_response_hours": c.sla_response_hours,
            "cost": c.cost,
            "status": status,
            "terms": c.terms,
        })
    return out


@app.post("/api/contracts", status_code=201)
def create_contract(body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("contract.manage"))):
    asset_id = int(body["asset_id"])
    c = m.Contract(
        asset_id=asset_id,
        vendor_name=body["vendor_name"].strip(),
        contract_type=body.get("contract_type", "warranty"),
        start_date=date.fromisoformat(body["start_date"]),
        end_date=date.fromisoformat(body["end_date"]),
        sla_response_hours=float(body.get("sla_response_hours", 4.0)),
        cost=float(body.get("cost", 0.0)),
        terms=body.get("terms", ""),
    )
    db.add(c)
    db.commit()
    return {"id": c.id, "message": "Contract saved."}


# ---------------------------------------------------------------- COST CENTRE BUDGETING
@app.get("/api/cost-centres")
def list_cost_centres(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    ccs = db.scalars(select(m.CostCentre).order_by(m.CostCentre.code)).all()
    return [
        {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "budget_annual": c.budget_annual,
            "budget_spent": round(c.budget_spent, 2),
            "variance": round(c.budget_annual - c.budget_spent, 2),
            "utilization_pct": round((c.budget_spent / c.budget_annual * 100), 1) if c.budget_annual > 0 else 0,
        }
        for c in ccs
    ]


# ---------------------------------------------------------------- CONTRACTOR PORTAL (External Limited Access)
@app.get("/api/contractor/jobs")
def contractor_assigned_jobs(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """Contractor portal endpoint: shows ONLY work orders assigned to this contractor user."""
    stmt = select(m.Job).where(m.Job.contractor_id == user.id).order_by(m.Job.due_date)
    return [job_dict(db, j, user) for j in db.scalars(stmt)]


# ---------------------------------------------------------------- USER MANAGEMENT & ROLES (Admin)
@app.get("/api/admin/users")
def admin_list_users(db: Session = Depends(get_db), user: m.User = Depends(require("user.manage"))):
    users = db.scalars(select(m.User).order_by(m.User.name)).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "full_name": u.full_name or u.name,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "units": u.units or [],
            "departments": u.departments or [],
            "status": u.status or "active",
            "contractor_company": u.contractor_company,
            "phone": u.phone,
            "is_locked": bool(u.locked_until and u.locked_until > utcnow()),
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class UserCreateIn(BaseModel):
    name: str | None = None
    full_name: str | None = None
    username: str | None = None
    email: str
    password: str
    role: str
    units: list[str] = []
    departments: list[str] = []
    status: str = "active"
    contractor_company: str = ""
    phone: str = ""


@app.post("/api/users", status_code=201)
@app.post("/api/admin/users", status_code=201)
def admin_create_user(body: UserCreateIn, db: Session = Depends(get_db), user: m.User = Depends(require("user.manage"))):
    clean_email = body.email.strip().lower()
    existing = db.scalar(select(m.User).where(func.lower(m.User.email) == clean_email))
    if existing:
        raise HTTPException(409, "User email already registered.")

    clean_username = body.username.strip() if body.username else None
    if clean_username:
        existing_u = db.scalar(select(m.User).where(func.lower(m.User.username) == clean_username.lower()))
        if existing_u:
            raise HTTPException(409, "Username already registered.")

    name = (body.full_name or body.name or clean_username or clean_email.split("@")[0]).strip()
    full_name = (body.full_name or body.name or name).strip()

    new_u = m.User(
        name=name,
        full_name=full_name,
        username=clean_username,
        email=clean_email,
        password_hash=hash_password(body.password),
        role=body.role,
        units=body.units or [],
        departments=body.departments or [],
        status=body.status or "active",
        contractor_company=body.contractor_company.strip(),
        phone=body.phone.strip(),
    )
    db.add(new_u)
    audit(db, user, "create_user", "user", None, f"Created {new_u.name} ({new_u.role})")
    db.commit()
    db.refresh(new_u)
    return {
        "id": new_u.id,
        "name": new_u.name,
        "full_name": new_u.full_name,
        "username": new_u.username,
        "email": new_u.email,
        "role": new_u.role,
        "units": new_u.units,
        "departments": new_u.departments,
        "status": new_u.status,
        "message": "User created successfully."
    }


@app.put("/api/admin/users/{user_id}/unlock")
def admin_unlock_user(user_id: int, db: Session = Depends(get_db), user: m.User = Depends(require("user.manage"))):
    target = db.get(m.User, user_id)
    if not target:
        raise HTTPException(404, "User not found.")
    target.locked_until = None
    target.failed_logins = 0
    audit(db, user, "unlock_user", "user", target.id, f"Unlocked account {target.email}")
    db.commit()
    return {"message": "User account unlocked."}


# ---------------------------------------------------------------- CUSTOM ROLES MANAGEMENT (Admin)
DEFAULT_BUILTIN_ROLES = [
    {
        "name": "admin",
        "display_name": "Admin",
        "privileges": ["*"],
    },
    {
        "name": "plant_head",
        "display_name": "Plant Head",
        "privileges": ["report.view", "kpi.view", "oee.view", "asset.view", "job.view", "audit.view", "calibration.view", "downtime.view"],
    },
    {
        "name": "maintenance_manager",
        "display_name": "Maintenance Manager",
        "privileges": ["asset.create", "asset.view", "asset.transfer", "transfer.decide", "job.create", "job.send", "job.approve", "job.work", "job.view", "part.manage", "part.view", "report.view", "audit.view", "user.view", "calibration.view"],
    },
    {
        "name": "maintenance_engineer",
        "display_name": "Maintenance Engineer",
        "privileges": ["asset.transfer", "asset.view", "job.create", "job.send", "job.approve", "job.work", "job.view", "part.manage", "part.view", "calibration.view"],
    },
    {
        "name": "technician",
        "display_name": "Technician",
        "privileges": ["job.create", "job.send", "job.work", "job.view", "asset.view"],
    },
    {
        "name": "store_manager",
        "display_name": "Store Manager",
        "privileges": ["part.manage", "part.view", "procurement.manage", "procurement.view"],
    },
    {
        "name": "production_manager",
        "display_name": "Production Manager",
        "privileges": ["job.create", "job.send", "job.view", "asset.view", "downtime.view"],
    },
    {
        "name": "purchase_manager",
        "display_name": "Purchase Manager",
        "privileges": ["procurement.view", "procurement.approve", "procurement.order"],
    },
    {
        "name": "auditor",
        "display_name": "Auditor",
        "privileges": ["report.view", "report.export", "audit.view", "asset.view", "job.view", "part.view"],
    },
]


def ensure_builtin_roles(db: Session):
    for r in DEFAULT_BUILTIN_ROLES:
        existing = db.scalar(select(m.CustomRole).where(m.CustomRole.name == r["name"]))
        if not existing:
            cr = m.CustomRole(
                name=r["name"],
                display_name=r["display_name"],
                privileges=r["privileges"],
                created_by="System Built-in",
                created_at=utcnow(),
            )
            db.add(cr)
    db.commit()


@app.get("/api/roles")
def list_custom_roles(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")
    ensure_builtin_roles(db)
    roles = db.scalars(select(m.CustomRole)).all()
    canonical = [r["name"] for r in DEFAULT_BUILTIN_ROLES]
    order_map = {name: i for i, name in enumerate(canonical)}
    sorted_roles = sorted(roles, key=lambda r: (0 if r.name in order_map else 1, order_map.get(r.name, 999), r.name))
    return [
        {
            "id": r.id,
            "name": r.name,
            "display_name": r.display_name,
            "privileges": r.privileges or [],
            "is_builtin": r.name in m.VALID_ROLES or r.name in ("admin", "super_admin"),
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in sorted_roles
    ]


class RoleCreateIn(BaseModel):
    name: str
    display_name: str
    privileges: list[str] = []


@app.post("/api/roles", status_code=201)
def create_custom_role(body: RoleCreateIn, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")

    clean_name = body.name.strip().lower().replace(" ", "_")
    if not clean_name:
        raise HTTPException(400, "Role name cannot be empty.")
    if clean_name in m.VALID_ROLES or clean_name == "super_admin":
        raise HTTPException(400, "Cannot use a built-in role name. Edit the built-in role instead.")

    existing = db.scalar(select(m.CustomRole).where(m.CustomRole.name == clean_name))
    if existing:
        raise HTTPException(409, "A role with this name already exists.")

    new_role = m.CustomRole(
        name=clean_name,
        display_name=body.display_name.strip() or clean_name,
        privileges=body.privileges or [],
        created_by=user.name or user.email,
        created_at=utcnow(),
    )
    db.add(new_role)
    audit(db, user, "create_role", "custom_role", None, f"Created custom role {new_role.name}")
    db.commit()
    db.refresh(new_role)
    return {
        "id": new_role.id,
        "name": new_role.name,
        "display_name": new_role.display_name,
        "privileges": new_role.privileges,
        "is_builtin": False,
        "created_by": new_role.created_by,
        "created_at": new_role.created_at.isoformat() if new_role.created_at else None,
    }


class RoleUpdateIn(BaseModel):
    display_name: str | None = None
    privileges: list[str] = []


@app.put("/api/roles/{role_id}")
def update_custom_role(role_id: str, body: RoleUpdateIn, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")

    ensure_builtin_roles(db)
    role = None
    if role_id.isdigit():
        role = db.get(m.CustomRole, int(role_id))
    if not role:
        role = db.scalar(select(m.CustomRole).where(m.CustomRole.name == role_id))

    if not role:
        raise HTTPException(404, "Role not found.")

    if body.display_name:
        role.display_name = body.display_name.strip()
    role.privileges = body.privileges
    audit(db, user, "update_role", "custom_role", role.id, f"Updated privileges for {role.name}")
    db.commit()
    db.refresh(role)
    is_builtin = role.name in m.VALID_ROLES or role.name in ("admin", "super_admin")
    return {
        "id": role.id,
        "name": role.name,
        "display_name": role.display_name,
        "privileges": role.privileges,
        "is_builtin": is_builtin,
        "created_by": role.created_by,
        "created_at": role.created_at.isoformat() if role.created_at else None,
    }


@app.delete("/api/roles/{role_id}")
def delete_custom_role(role_id: str, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")

    if role_id.isdigit():
        role = db.get(m.CustomRole, int(role_id))
    else:
        role = db.scalar(select(m.CustomRole).where(m.CustomRole.name == role_id))

    if not role:
        raise HTTPException(404, "Role not found.")

    if role.name in m.VALID_ROLES or role.name in ("admin", "super_admin"):
        raise HTTPException(400, "Cannot delete built-in system roles.")

    user_count = db.scalar(select(func.count(m.User.id)).where(m.User.role == role.name))
    if user_count and user_count > 0:
        raise HTTPException(400, f"Cannot delete role '{role.display_name}' because {user_count} user(s) are assigned to it.")

    role_name = role.name
    db.delete(role)
    audit(db, user, "delete_role", "custom_role", role.id, f"Deleted custom role {role_name}")
    db.commit()
    return {"ok": True, "message": f"Role '{role_name}' deleted."}


@app.get("/api/roles/privileges")
def get_privilege_groups(user: m.User = Depends(current_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")
    return PRIVILEGE_GROUPS


# ---------------------------------------------------------------- SECURITY SETTINGS (Admin)
@app.get("/api/security-settings")
def get_security_settings(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    s = db.get(m.SecuritySettings, 1)
    if not s:
        s = m.SecuritySettings(
            id=1,
            password_expiry_days=90,
            session_timeout_minutes=30,
            max_login_attempts=5,
            updated_by="System",
            updated_at=utcnow(),
        )
        db.add(s)
        db.commit()
        db.refresh(s)
    return {
        "id": s.id,
        "password_expiry_days": s.password_expiry_days,
        "session_timeout_minutes": s.session_timeout_minutes,
        "max_login_attempts": s.max_login_attempts,
        "updated_by": s.updated_by,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


class SecuritySettingsUpdateIn(BaseModel):
    password_expiry_days: int = 90
    session_timeout_minutes: int = 30
    max_login_attempts: int = 5


@app.put("/api/security-settings")
def update_security_settings(
    body: SecuritySettingsUpdateIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required.")

    s = db.get(m.SecuritySettings, 1)
    if not s:
        s = m.SecuritySettings(id=1)
        db.add(s)

    days = min(90, max(1, body.password_expiry_days))
    s.password_expiry_days = days
    s.session_timeout_minutes = body.session_timeout_minutes
    s.max_login_attempts = body.max_login_attempts
    s.updated_by = user.name or user.email
    s.updated_at = utcnow()
    audit(db, user, "update_security_settings", "security_settings", 1, "Updated enterprise security settings")
    db.commit()
    db.refresh(s)
    return {
        "id": s.id,
        "password_expiry_days": s.password_expiry_days,
        "session_timeout_minutes": s.session_timeout_minutes,
        "max_login_attempts": s.max_login_attempts,
        "updated_by": s.updated_by,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


# ---------------------------------------------------------------- GDPR COMPLIANCE
@app.get("/api/gdpr/export/{user_id}")
def gdpr_export_user_data(user_id: int, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    if user.id != user_id and user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Access denied to export data.")
    target = db.get(m.User, user_id)
    if not target:
        raise HTTPException(404, "User not found.")

    audits = db.scalars(select(m.AuditLog).where(m.AuditLog.user_name == target.name)).all()
    jobs_assigned = db.scalars(select(m.Job).where(m.Job.assigned_to == target.id)).all()

    return {
        "user_profile": {"id": target.id, "name": target.name, "email": target.email, "role": target.role},
        "audit_logs": [{"action": a.action, "at": a.at.isoformat(), "detail": a.detail} for a in audits],
        "assigned_work_orders": [{"id": j.id, "wo_number": j.wo_number, "title": j.title} for j in jobs_assigned],
    }


# ---------------------------------------------------------------- EN 13306 REPORTING & KPIs
@app.get("/api/reports/kpis")
def get_en13306_kpis(year: int | None = None, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """
    EN 13306 Maintenance Standard KPIs:
    - PM Compliance %
    - Backlog Hours
    - Wrench Time %
    - MTBF (Mean Time Between Failures)
    - MTTR (Mean Time To Repair)
    - MTTA (Mean Time To Acknowledge)
    - Total maintenance cost per asset
    """
    now = utcnow()
    target_year = year or now.year

    completed_jobs = db.scalars(
        select(m.Job).where(m.Job.status.in_(["completed", "closed"]), func.strftime("%Y", m.Job.created_at) == str(target_year))
    ).all()

    # PM Compliance: PM work orders completed on or before due date
    scheduled_jobs = [j for j in completed_jobs if j.type == "scheduled" or j.din_type in ("servicing", "inspection")]
    pm_on_time = sum(1 for j in scheduled_jobs if j.due_date and j.end_time and j.end_time.date() <= j.due_date)
    pm_total = len(scheduled_jobs)
    pm_compliance = round((pm_on_time / pm_total * 100), 1) if pm_total > 0 else 100.0

    # Backlog Hours: Remaining estimated hours of open planned work orders
    open_jobs = db.scalars(select(m.Job).where(m.Job.status.in_(OPEN_STATES))).all()
    backlog_hours = round(sum(j.estimated_hours for j in open_jobs), 1)

    # Wrench Time %: Active repair hands-on hours vs total elapsed time
    repairs = [j for j in completed_jobs if j.type == "repair" or j.din_type == "repair"]
    total_labour = sum(j.labour_hours for j in repairs)
    total_elapsed = sum(hours_between(j.start_time, j.end_time) for j in repairs)
    wrench_time_pct = round((total_labour / max(1.0, total_elapsed) * 100), 1) if total_elapsed > 0 else 65.0
    wrench_time_pct = min(100.0, max(15.0, wrench_time_pct))

    # MTBF (Mean Time Between Failures) & MTTR (Mean Time To Repair)
    failure_count = max(1, len(repairs))
    total_repair_downtime = sum(hours_between(j.start_time, j.end_time) for j in repairs)
    total_operating_hours = (365 * 24 * 7) - total_repair_downtime  # Approx 7 major assets
    mtbf = round(total_operating_hours / failure_count, 1)
    mttr = round(total_repair_downtime / failure_count, 1)

    # MTTA (Mean Time To Acknowledge): created to start_time
    started_jobs = [j for j in completed_jobs if j.start_time]
    mtta_hours = round(
        sum((j.start_time - j.created_at).total_seconds() / 3600 for j in started_jobs) / max(1, len(started_jobs)), 1
    )

    # Total Maintenance Cost
    total_cost = sum(
        sum(p.qty * p.unit_cost for p in j.parts) + (j.labour_hours * j.labour_rate) + (j.contractor_invoice_amount or 0.0)
        for j in completed_jobs
    )

    return {
        "year": target_year,
        "pm_compliance_pct": pm_compliance,
        "pm_on_time": pm_on_time,
        "pm_total": pm_total,
        "backlog_hours": backlog_hours,
        "open_orders_count": len(open_jobs),
        "wrench_time_pct": wrench_time_pct,
        "mtbf_hours": mtbf,
        "mttr_hours": mttr,
        "mtta_hours": mtta_hours,
        "total_cost": round(total_cost, 2),
        "failure_count": len(repairs),
        # Backwards compatible keys for existing frontend
        "availability": round(100.0 - (total_repair_downtime / (365 * 24) * 100), 1),
        "planned_pct": pm_compliance,
        "pm_compliance": pm_compliance,
    }


@app.get("/api/reports/oee")
def get_oee_metrics(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """OEE = Availability x Performance x Quality per asset."""
    assets = db.scalars(select(m.Asset).where(m.Asset.tier.in_(["asset", "system"]))).all()
    res = []
    for a in assets:
        # Calculate availability from logged downtime
        jobs = db.scalars(select(m.Job).where(m.Job.asset_id == a.id, m.Job.status.in_(["completed", "closed"]))).all()
        downtime = sum(hours_between(j.start_time, j.end_time) for j in jobs)
        operating_window = 720.0  # 30 days * 24 hours
        availability = max(0.5, round((operating_window - min(operating_window, downtime)) / operating_window, 3))
        performance = 0.94  # standard rated speed achievement
        quality = 0.985  # first-pass yield
        oee = round(availability * performance * quality * 100, 1)
        res.append({
            "asset_id": a.id,
            "asset_name": a.name,
            "code": a.code,
            "criticality": a.criticality,
            "availability_pct": round(availability * 100, 1),
            "performance_pct": round(performance * 100, 1),
            "quality_pct": round(quality * 100, 1),
            "oee_pct": oee,
            "downtime_hours": round(downtime, 1),
        })
    return res


@app.get("/api/reports/failure-heatmap")
def get_failure_frequency_heatmap(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """ISO 14224 Failure Frequency & Mode Heatmap."""
    repairs = db.scalars(select(m.Job).where(m.Job.type == "repair", m.Job.status.in_(["completed", "closed"]))).all()
    matrix = {}
    for r in repairs:
        cat = r.asset.category or "General"
        mode = r.failure_mode or r.breakdown_reason or "Unclassified"
        key = (cat, mode)
        matrix[key] = matrix.get(key, 0) + 1

    cells = [{"asset_category": k[0], "failure_mode": k[1], "count": v} for k, v in matrix.items()]
    return sorted(cells, key=lambda x: x["count"], reverse=True)


@app.get("/api/reports/downtime")
def get_downtime_report(asset_id: int | None = None, year: int | None = None, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    y = year or utcnow().year
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly = {m_name: {"month": m_name, "repair": 0.0, "scheduled": 0.0, "total": 0.0} for m_name in months}

    stmt = select(m.Job).where(m.Job.status.in_(["completed", "closed"]), func.strftime("%Y", m.Job.created_at) == str(y))
    if asset_id:
        stmt = stmt.where(m.Job.asset_id == asset_id)

    for m_name in months:
        monthly[m_name]["pm_completed"] = 0
        monthly[m_name]["downtime_hours"] = 0.0

    for j in db.scalars(stmt):
        m_idx = j.created_at.month - 1
        m_name = months[m_idx]
        dt = hours_between(j.start_time, j.end_time)
        if j.type == "repair" or j.din_type == "repair":
            monthly[m_name]["repair"] += dt
            monthly[m_name]["downtime_hours"] += dt
        else:
            monthly[m_name]["scheduled"] += dt
            monthly[m_name]["pm_completed"] += 1
        monthly[m_name]["total"] += dt

    for m_name in months:
        monthly[m_name]["repair"] = round(monthly[m_name]["repair"], 1)
        monthly[m_name]["scheduled"] = round(monthly[m_name]["scheduled"], 1)
        monthly[m_name]["total"] = round(monthly[m_name]["total"], 1)

    return {"year": y, "months": list(monthly.values())}


@app.get("/api/reports/mtbf")
def get_mtbf_report(asset_id: int | None = None, year: int | None = None, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    now = utcnow()
    y = year or now.year
    start_of_year = datetime(y, 1, 1)
    end_window = min(now, datetime(y, 12, 31, 23, 59, 59))
    elapsed_hours = max(1.0, (end_window - start_of_year).total_seconds() / 3600)

    stmt = select(m.Job).where(m.Job.type == "repair", m.Job.status.in_(["completed", "closed"]), func.strftime("%Y", m.Job.created_at) == str(y))
    if asset_id:
        stmt = stmt.where(m.Job.asset_id == asset_id)
    repairs = db.scalars(stmt).all()
    failures = len(repairs)
    downtime = sum(hours_between(j.start_time, j.end_time) for j in repairs)
    uptime = max(0.0, elapsed_hours - downtime)
    mtbf = round(uptime / max(1, failures), 1)
    mttr = round(downtime / max(1, failures), 1)

    return {
        "uptime_hours": round(uptime, 1),
        "failures": failures,
        "mtbf": mtbf,
        "mtbf_hours": mtbf,
        "mttr": mttr,
        "mttr_hours": mttr,
    }


@app.get("/api/reports/export")
def export_reports_csv(report_type: str = "kpis", db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """Export standard report data in CSV format."""
    if report_type == "oee":
        data = get_oee_metrics(db, user)
        headers = ["Asset ID", "Asset Name", "Code", "Criticality", "Availability %", "Performance %", "Quality %", "OEE %", "Downtime (h)"]
        rows = [headers] + [[d["asset_id"], d["asset_name"], d["code"], d["criticality"], d["availability_pct"], d["performance_pct"], d["quality_pct"], d["oee_pct"], d["downtime_hours"]] for d in data]
    else:
        kpis = get_en13306_kpis(None, db, user)
        headers = ["Metric", "Value", "Standard Reference"]
        rows = [
            headers,
            ["PM Compliance %", f"{kpis['pm_compliance_pct']}%", "DIN 31051"],
            ["Backlog Hours", f"{kpis['backlog_hours']} h", "EN 13306"],
            ["Wrench Time %", f"{kpis['wrench_time_pct']}%", "EN 13306"],
            ["MTBF", f"{kpis['mtbf_hours']} h", "ISO 14224 / EN 13306"],
            ["MTTR", f"{kpis['mttr_hours']} h", "ISO 14224 / EN 13306"],
            ["MTTA", f"{kpis['mtta_hours']} h", "EN 13306"],
            ["Total Maintenance Cost", f"₹{kpis['total_cost']}", "ISO 55001"],
        ]

    csv_text = "\n".join([",".join([f'"{str(cell)}"' for cell in r]) for r in rows])
    return PlainTextResponse(csv_text, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=cmms_{report_type}.csv"})


@app.post("/api/reports/schedule-email")
async def schedule_report_email(body: dict, db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    """Trigger scheduled report email dispatch using FastMail with SMTP config."""
    email = body.get("recipient_email", user.email)
    freq = body.get("frequency", "weekly")
    report_type = body.get("report_type", "summary")
    audit(db, user, "schedule_report", "report", None, f"Scheduled {freq} maintenance report to {email}")
    db.commit()

    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    mail_from = os.getenv("MAIL_FROM")
    mail_server = os.getenv("MAIL_SERVER")
    mail_port = int(os.getenv("MAIL_PORT", "587"))

    if mail_server and mail_from:
        conf = ConnectionConfig(
            MAIL_USERNAME=mail_username or "",
            MAIL_PASSWORD=mail_password or "",
            MAIL_FROM=mail_from,
            MAIL_PORT=mail_port,
            MAIL_SERVER=mail_server,
            MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "True").lower() in ("true", "1"),
            MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False").lower() in ("true", "1"),
            USE_CREDENTIALS=bool(mail_username and mail_password),
            VALIDATE_CERTS=False,
        )
        message = MessageSchema(
            subject=f"CMMS Scheduled {freq.capitalize()} Maintenance Report",
            recipients=[email],
            body=f"Hello,\n\nHere is your scheduled {freq} maintenance report ({report_type}) from Computerized Maintenance Management System (CMMS).\n\nGenerated: {utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\nBest regards,\nCMMS Automation",
            subtype=MessageType.plain,
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        return {"message": f"Report scheduled and sent to {email} ({freq})."}

    return {"message": f"Report scheduled for delivery to {email} ({freq})."}


# ---------------------------------------------------------------- DASHBOARD DATA
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    now = utcnow()
    cur_year = now.year
    cur_month = now.month

    # General KPIs
    kpis = get_en13306_kpis(cur_year, db, user)
    downtime_data = get_downtime_report(None, cur_year, db, user)["months"]

    # Month cost
    month_jobs = db.scalars(
        select(m.Job).where(
            m.Job.status.in_(["completed", "closed"]),
            func.strftime("%Y", m.Job.created_at) == str(cur_year),
            func.strftime("%m", m.Job.created_at) == f"{cur_month:02d}",
        )
    ).all()
    month_cost = sum(
        sum(p.qty * p.unit_cost for p in j.parts) + (j.labour_hours * j.labour_rate) + (j.contractor_invoice_amount or 0.0)
        for j in month_jobs
    )

    open_jobs = db.scalars(select(m.Job).where(m.Job.status.in_(OPEN_STATES))).all()
    closed_jobs_month = len(month_jobs)
    warranty_month = sum(1 for j in month_jobs if j.warranty_at_creation)
    breakdown_month = sum(1 for j in month_jobs if j.type == "repair")

    # Manager view specific
    pending_approvals = [
        job_dict(db, j, user)
        for j in db.scalars(select(m.Job).where(m.Job.status.in_(["sent_for_approval", "review"])).order_by(m.Job.created_at))
    ]
    pending_transfers = db.scalar(select(func.count(m.Transfer.id)).where(m.Transfer.status == "pending")) or 0

    ten_days = date.today() + timedelta(days=10)
    due_soon = [
        job_dict(db, j, user)
        for j in db.scalars(
            select(m.Job).where(m.Job.status.in_(OPEN_STATES), m.Job.due_date <= ten_days).order_by(m.Job.due_date)
        )
    ]
    ongoing = [
        job_dict(db, j, user)
        for j in db.scalars(select(m.Job).where(m.Job.status == "in_progress").order_by(m.Job.start_time.desc()))
    ]

    parts_all = list_spare_parts(db, user)
    low_stock = [p for p in parts_all if p["low"]]

    # Technician view specific
    my_tasks = [
        job_dict(db, j, user)
        for j in db.scalars(
            select(m.Job)
            .where(
                or_(m.Job.assigned_to == user.id, m.Job.contractor_id == user.id),
                m.Job.status.in_(OPEN_STATES),
            )
            .order_by(m.Job.priority, m.Job.due_date)
        )
    ]
    due_today_count = sum(1 for t in my_tasks if t["due_date"] and date.fromisoformat(t["due_date"]) <= date.today())
    waiting_approval_count = sum(1 for t in my_tasks if t["status"] == "sent_for_approval")

    # Equipment status distribution for donut chart
    all_assets = db.scalars(select(m.Asset)).all()
    total_assets = len(all_assets)
    bd_asset_ids = set(db.scalars(
        select(m.Job.asset_id).where(
            or_(m.Job.din_type == "repair", m.Job.type == "repair"),
            m.Job.status.in_(["in_progress", "approved"]),
        )
    ).all())
    pm_asset_ids = set(db.scalars(
        select(m.Job.asset_id).where(
            or_(m.Job.din_type.in_(["inspection", "servicing"]), m.Job.type == "scheduled"),
            m.Job.status.in_(OPEN_STATES),
        )
    ).all()) - bd_asset_ids
    maint_asset_ids = set(db.scalars(
        select(m.Job.asset_id).where(m.Job.status.in_(OPEN_STATES))
    ).all()) - bd_asset_ids - pm_asset_ids

    breakdown_count = sum(1 for a in all_assets if a.id in bd_asset_ids or a.status == "degraded")
    pm_count = sum(1 for a in all_assets if a.id in pm_asset_ids)
    in_maint_count = sum(1 for a in all_assets if a.id in maint_asset_ids or a.status == "in_maintenance")
    active_count = max(0, total_assets - breakdown_count - pm_count - in_maint_count)

    equipment_status = {
        "total": total_assets,
        "active": active_count,
        "in_pm": pm_count,
        "in_maintenance": in_maint_count,
        "breakdown": breakdown_count,
    }

    # Recent 8 jobs
    recent_jobs = [
        job_dict(db, j, user)
        for j in db.scalars(select(m.Job).order_by(m.Job.created_at.desc()).limit(8))
    ]

    return {
        "kpis": kpis,
        "downtime": downtime_data,
        "month_cost": round(month_cost, 2),
        "open_jobs": len(open_jobs),
        "closed_jobs_month": closed_jobs_month,
        "warranty_repairs_month": warranty_month,
        "breakdown_repairs_month": breakdown_month,
        "pending_approvals": pending_approvals,
        "pending_transfers": pending_transfers,
        "due_soon": due_soon,
        "ongoing": ongoing,
        "low_stock": low_stock,
        "my_tasks": my_tasks,
        "due_today": due_today_count,
        "waiting_approval": waiting_approval_count,
        "equipment_status": equipment_status,
        "recent_jobs": recent_jobs,
    }


# ---------------------------------------------------------------- TRANSFERS
@app.get("/api/transfers")
def list_transfers(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    stmt = select(m.Transfer).order_by(m.Transfer.created_at.desc())
    return [
        {
            "id": t.id,
            "asset": {"id": t.asset.id, "code": t.asset.code, "name": t.asset.name, "from": t.asset.location.name},
            "to": t.to_location.name,
            "status": t.status,
            "reason": t.reason,
            "requested_by": user_name(db, t.requested_by),
            "created_at": t.created_at.isoformat(),
        }
        for t in db.scalars(stmt)
    ]


@app.post("/api/assets/{asset_id}/transfer", status_code=201)
def request_transfer(asset_id: int, body: dict, db: Session = Depends(get_db), user: m.User = Depends(require("asset.transfer"))):
    asset = db.get(m.Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found.")
    if not asset.is_movable:
        raise HTTPException(409, "This asset is fixed in place and cannot be moved.")
    existing = db.scalar(select(m.Transfer).where(m.Transfer.asset_id == asset.id, m.Transfer.status == "pending"))
    if existing:
        raise HTTPException(409, "A transfer is already waiting for approval.")
    to_loc = db.get(m.Location, int(body["to_location_id"]))
    if not to_loc:
        raise HTTPException(404, "Destination location not found.")

    t = m.Transfer(asset_id=asset.id, to_location_id=to_loc.id, requested_by=user.id, reason=body.get("reason", ""))
    db.add(t)
    notify(db, users_with_role(db, "maintenance_manager", "admin", "super_admin", "plant_head"), f"Transfer requested for {asset.name} to {to_loc.name}", "/transfers")
    audit(db, user, "request_transfer", "asset", asset.id, f"Requested transfer to {to_loc.name}")
    db.commit()
    return {"id": t.id, "message": "Transfer requested."}


@app.post("/api/transfers/{transfer_id}/{decision}")
def decide_transfer(transfer_id: int, decision: str, body: dict = {}, db: Session = Depends(get_db), user: m.User = Depends(require("transfer.decide"))):
    t = db.get(m.Transfer, transfer_id)
    if not t or t.status != "pending":
        raise HTTPException(404, "Transfer not pending.")

    if decision == "approve":
        t.status = "approved"
        t.decided_by = user.id
        from_loc = t.asset.location.name
        t.asset.location_id = t.to_location_id
        db.add(m.LocationHistory(asset_id=t.asset_id, from_location=from_loc, to_location=t.to_location.name))
        notify(db, [t.requested_by], f"Transfer approved: {t.asset.name} is now at {t.to_location.name}")
        audit(db, user, "approve_transfer", "transfer", t.id, f"Approved move of {t.asset.code} to {t.to_location.name}")
    elif decision == "reject":
        t.status = "rejected"
        t.decided_by = user.id
        t.reason = body.get("reason", t.reason)
        notify(db, [t.requested_by], f"Transfer rejected: {t.asset.name}")
        audit(db, user, "reject_transfer", "transfer", t.id, f"Rejected move of {t.asset.code}")
    else:
        raise HTTPException(400, "Decision must be approve or reject.")

    db.commit()
    return {"id": t.id, "status": t.status}


# ---------------------------------------------------------------- AUDIT LOG & NOTIFICATIONS
@app.get("/api/audit")
def list_audit(q: str = "", db: Session = Depends(get_db), user: m.User = Depends(require("audit.view"))):
    stmt = select(m.AuditLog).order_by(m.AuditLog.at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(m.AuditLog.user_name).like(like),
                func.lower(m.AuditLog.action).like(like),
                func.lower(m.AuditLog.entity).like(like),
                func.lower(m.AuditLog.detail).like(like),
            )
        )
    return [
        {
            "id": a.id,
            "at": a.at.isoformat(),
            "user": a.user_name,
            "action": a.action,
            "entity": a.entity,
            "entity_id": a.entity_id,
            "detail": a.detail,
            "before_state": a.before_state,
            "after_state": a.after_state,
        }
        for a in db.scalars(stmt.limit(100))
    ]


@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    notes = db.scalars(
        select(m.Notification).where(m.Notification.user_id == user.id).order_by(m.Notification.created_at.desc()).limit(20)
    ).all()
    unread = sum(1 for n in notes if not n.read)
    return {
        "unread": unread,
        "items": [
            {"id": n.id, "message": n.message, "link": n.link, "read": n.read, "at": n.created_at.isoformat()}
            for n in notes
        ],
    }


@app.post("/api/notifications/read-all")
def mark_notifications_read(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    notes = db.scalars(select(m.Notification).where(m.Notification.user_id == user.id, m.Notification.read == False)).all()
    for n in notes:
        n.read = True
    db.commit()
    return {"message": "All marked as read."}

# ---------------------------------------------------------------- CALIBRATION MANAGEMENT
class CalibrationIn(BaseModel):
    asset_id: int
    last_calibrated_date: date
    next_due_date: date
    calibrated_by: str
    certificate_number: str
    standard_used: str | None = None
    result: str = "pass"  # pass | fail | conditional
    notes: str = ""


class CalibrationUpdateIn(BaseModel):
    asset_id: int | None = None
    last_calibrated_date: date | None = None
    next_due_date: date | None = None
    calibrated_by: str | None = None
    certificate_number: str | None = None
    standard_used: str | None = None
    result: str | None = None
    notes: str | None = None


def calibration_dict(c: m.Calibration) -> dict:
    today = date.today()
    due_within_30 = 0 <= (c.next_due_date - today).days <= 30
    is_overdue = c.next_due_date < today
    return {
        "id": c.id,
        "asset_id": c.asset_id,
        "asset_name": c.asset.name if c.asset else "Unknown Asset",
        "asset_code": c.asset.code if c.asset else "N/A",
        "asset_location": c.asset.location.name if c.asset and c.asset.location else "",
        "last_calibrated_date": c.last_calibrated_date.isoformat(),
        "next_due_date": c.next_due_date.isoformat(),
        "calibrated_by": c.calibrated_by,
        "certificate_number": c.certificate_number,
        "standard_used": c.standard_used or "",
        "result": c.result,
        "notes": c.notes or "",
        "created_at": c.created_at.isoformat(),
        "due_soon": due_within_30,
        "overdue": is_overdue,
    }


@app.get("/api/calibrations")
def list_calibrations(
    asset_id: int | None = None,
    due_within_days: int | None = None,
    due_soon: bool = False,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    stmt = select(m.Calibration).order_by(m.Calibration.next_due_date.asc())
    if asset_id:
        stmt = stmt.where(m.Calibration.asset_id == asset_id)
    if due_soon or due_within_days:
        days = due_within_days or 30
        cutoff = date.today() + timedelta(days=days)
        stmt = stmt.where(m.Calibration.next_due_date <= cutoff)
    return [calibration_dict(c) for c in db.scalars(stmt)]


@app.post("/api/calibrations", status_code=201)
def create_calibration(
    body: CalibrationIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    # Verify permission (asset.manage / asset.edit / asset.create / calibration.manage or super_admin / admin / plant_head)
    user_perms = PERMISSIONS.get(user.role, set())
    allowed = (
        user.role in ("admin", "super_admin", "maintenance_manager", "plant_head")
        or "*" in user_perms
        or "asset.manage" in user_perms
        or "asset.edit" in user_perms
        or "asset.create" in user_perms
        or "calibration.manage" in user_perms
    )
    if not allowed:
        raise HTTPException(403, "Your role is not allowed to perform action: asset.manage.")

    asset = db.get(m.Asset, body.asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found.")

    cal = m.Calibration(
        asset_id=body.asset_id,
        last_calibrated_date=body.last_calibrated_date,
        next_due_date=body.next_due_date,
        calibrated_by=body.calibrated_by.strip(),
        certificate_number=body.certificate_number.strip(),
        standard_used=body.standard_used.strip() if body.standard_used else None,
        result=body.result.strip().lower(),
        notes=body.notes.strip(),
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    audit(db, user, "create", "calibration", cal.id, f"Logged calibration {cal.certificate_number} for {asset.code} ({cal.result})")
    return calibration_dict(cal)


@app.put("/api/calibrations/{id}")
def update_calibration(
    id: int,
    body: CalibrationUpdateIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    user_perms = PERMISSIONS.get(user.role, set())
    allowed = (
        user.role in ("admin", "super_admin", "maintenance_manager", "plant_head")
        or "*" in user_perms
        or "asset.manage" in user_perms
        or "asset.edit" in user_perms
        or "calibration.manage" in user_perms
    )
    if not allowed:
        raise HTTPException(403, "Your role is not allowed to update calibration.")

    cal = db.get(m.Calibration, id)
    if not cal:
        raise HTTPException(404, "Calibration record not found.")

    if body.asset_id is not None:
        cal.asset_id = body.asset_id
    if body.last_calibrated_date is not None:
        cal.last_calibrated_date = body.last_calibrated_date
    if body.next_due_date is not None:
        cal.next_due_date = body.next_due_date
    if body.calibrated_by is not None:
        cal.calibrated_by = body.calibrated_by.strip()
    if body.certificate_number is not None:
        cal.certificate_number = body.certificate_number.strip()
    if body.standard_used is not None:
        cal.standard_used = body.standard_used.strip()
    if body.result is not None:
        cal.result = body.result.strip().lower()
    if body.notes is not None:
        cal.notes = body.notes.strip()

    db.commit()
    db.refresh(cal)
    audit(db, user, "update", "calibration", cal.id, f"Updated calibration {cal.certificate_number}")
    return calibration_dict(cal)


@app.get("/api/calibrations/{id}")
def get_calibration(
    id: int,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
):
    cal = db.get(m.Calibration, id)
    if not cal:
        raise HTTPException(404, "Calibration record not found.")
    return calibration_dict(cal)


# ---------------------------------------------------------------- LIVE DOWNTIME MONITORING
@app.get("/api/downtime/live")
def get_live_downtime(db: Session = Depends(get_db), user: m.User = Depends(current_user)):
    now = utcnow()
    # Assets currently in breakdown (open repair jobs with status in_progress or approved)
    stmt = (
        select(m.Job)
        .where(
            or_(m.Job.din_type == "repair", m.Job.type == "repair"),
            m.Job.status.in_(["in_progress", "approved"]),
        )
        .order_by(m.Job.created_at.asc())
    )
    jobs = db.scalars(stmt).all()
    res = []
    for j in jobs:
        dt_hours = round(max(0.0, (now - j.created_at).total_seconds() / 3600.0), 1)
        res.append({
            "id": j.id,
            "job_id": j.id,
            "job_title": j.title,
            "asset_id": j.asset_id,
            "asset_name": j.asset.name if j.asset else "Unknown Asset",
            "asset_code": j.asset.code if j.asset else "N/A",
            "location": j.asset.location.name if j.asset and j.asset.location else "Plant 1",
            "status": j.status,
            "priority": j.priority,
            "created_at": j.created_at.isoformat(),
            "downtime_hours": dt_hours,
            "hours_down": dt_hours,
        })
    # Sort by hours_down descending
    res.sort(key=lambda x: x["hours_down"], reverse=True)
    return res
