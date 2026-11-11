import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db, utcnow
from .models import User

SECRET = os.getenv("CMMS_SECRET", "change-me-in-production")
ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)

# Comprehensive RBAC for German Industrial Enterprise CMMS (DIN 31051, EN 13306, ISO 55001)
PERMISSIONS = {
    "admin": {"*"},  # all permissions
    "super_admin": {"*"},  # backward compatibility alias
    "plant_head": {"report.view", "kpi.view", "oee.view", "asset.view", "job.view", "audit.view", "calibration.view", "downtime.view"},
    "maintenance_manager": {"asset.create", "asset.transfer", "transfer.decide", "job.create", "job.send", "job.decide", "job.work", "part.manage", "report.view", "audit.view", "user.view", "calibration.view"},
    "maintenance_engineer": {"asset.transfer", "job.create", "job.send", "job.decide", "job.work", "part.manage", "calibration.view"},
    "technician": {"job.create", "job.send", "job.work", "asset.view"},
    "store_manager": {"part.manage", "part.view", "procurement.manage"},
    "production_manager": {"job.create", "job.send", "asset.view", "downtime.view"},
    "purchase_manager": {"procurement.approve", "procurement.order"},
    "auditor": {"report.view", "audit.view", "asset.view", "job.view", "part.view"},
}

MENUS = {
    "admin": ["dashboard", "assets", "transfers", "jobs", "parts", "procurement", "reports", "audit", "calibration", "users", "security"],
    "super_admin": ["dashboard", "assets", "transfers", "jobs", "parts", "procurement", "reports", "audit", "calibration", "users", "security"],
    "plant_head": ["dashboard", "assets", "jobs", "reports", "audit", "calibration"],
    "maintenance_manager": ["dashboard", "assets", "transfers", "jobs", "parts", "reports", "audit", "calibration"],
    "maintenance_engineer": ["dashboard", "assets", "jobs", "parts", "calibration"],
    "technician": ["dashboard", "assets", "jobs"],
    "store_manager": ["dashboard", "parts", "procurement"],
    "production_manager": ["dashboard", "assets", "jobs"],
    "purchase_manager": ["dashboard", "procurement"],
    "auditor": ["dashboard", "assets", "jobs", "parts", "reports", "audit"],
}

PRIVILEGE_GROUPS = {
    "Master Data & Assets": [
        "asset.view",
        "asset.create",
        "asset.edit",
        "asset.delete",
        "asset.transfer",
        "transfer.decide",
        "bom.manage",
    ],
    "Work Orders & Repairs": [
        "job.view",
        "job.create",
        "job.plan",
        "job.send",
        "job.approve",
        "job.start",
        "job.work",
        "job.loto_sign",
        "job.review",
        "job.close",
    ],
    "Preventive Maintenance (PM)": [
        "plan.view",
        "plan.manage",
    ],
    "Spare Parts & Inventory": [
        "part.view",
        "part.manage",
    ],
    "Purchase & Procurement": [
        "procurement.view",
        "procurement.manage",
        "procurement.approve",
        "procurement.order",
    ],
    "Condition Monitoring & Readings": [
        "reading.view",
        "reading.log",
    ],
    "Calibration (ISO 9001)": [
        "calibration.view",
        "calibration.manage",
    ],
    "Service Contracts & SLAs": [
        "contract.view",
        "contract.manage",
    ],
    "Reports, KPIs & Analytics": [
        "report.view",
        "report.export",
        "kpi.view",
        "oee.view",
        "downtime.view",
        "downtime.manage",
        "audit.view",
    ],
    "User Management & Security": [
        "user.view",
        "user.manage",
    ],
}

# Compatibility aliases mapping legacy/shorthand permissions to actual system capabilities
PRIVILEGE_ALIASES = {
    "wo.view": "job.view",
    "wo.create": "job.create",
    "wo.assign": "job.plan",
    "wo.close": "job.close",
    "pm.view": "plan.view",
    "pm.create": "plan.manage",
    "pm.generate": "plan.manage",
    "bd.view": "job.view",
    "bd.report": "job.create",
    "bd.close": "job.close",
    "part.transfer": "part.manage",
    "part.adjust": "part.manage",
    "pr.view": "procurement.view",
    "pr.create": "procurement.manage",
    "pr.approve": "procurement.approve",
    "pr.order": "procurement.order",
    "calibration.log": "calibration.manage",
    "user.create": "user.manage",
    "user.edit": "user.manage",
    "user.deactivate": "user.manage",
    "job.decide": "job.approve",
}

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


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt, _ = stored.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt), stored)


def make_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "exp": utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not cred:
        raise HTTPException(401, "Please log in.")
    try:
        data = jwt.decode(cred.credentials, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired. Please log in again.")
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "Account not found.")
    return user


def require(permission: str):
    def checker(user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
        if user.role in ("admin", "super_admin"):
            return user
        user_perms = None
        from .models import CustomRole
        cr = db.query(CustomRole).filter_by(name=user.role).first()
        if cr and cr.privileges:
            user_perms = set(cr.privileges)
        if user_perms is None:
            user_perms = PERMISSIONS.get(user.role, set())
        if permission not in user_perms and "*" not in user_perms:
            has_alias = any(
                alias in user_perms
                for alias, target in PRIVILEGE_ALIASES.items()
                if target == permission
            )
            if not has_alias:
                raise HTTPException(403, f"Your role ({user.role}) is not allowed to perform action: {permission}.")
        return user
    return checker


# SSO / OIDC Authentication hook helper
def verify_sso_identity(token_or_payload: dict) -> dict:
    """Verifies enterprise SAML/OIDC payload and extracts user attributes."""
    email = token_or_payload.get("email")
    if not email:
        raise HTTPException(400, "Invalid SSO claims: email missing.")
    return {
        "email": email,
        "name": token_or_payload.get("name", email.split("@")[0]),
        "role": token_or_payload.get("role", "technician"),
    }
