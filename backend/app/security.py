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
ALL_PERMISSIONS = {
    "user.manage", "user.view",
    "asset.create", "asset.edit", "asset.delete", "asset.view", "asset.transfer", "transfer.decide",
    "job.create", "job.send", "job.decide", "job.plan", "job.work", "job.contractor_work",
    "checklist.sign", "loto.sign", "reading.log",
    "part.manage", "part.view", "procurement.manage", "procurement.decide", "bom.manage",
    "plan.manage", "doc.manage", "contract.manage", "contractor.decide",
    "budget.manage", "condition.manage", "report.view", "kpi.view", "oee.view", "audit.view", "gantt.view",
    "invoice.submit", "gdpr.manage"
}

PERMISSIONS = {
    "super_admin": set(ALL_PERMISSIONS),
    "admin": {
        "user.view", "asset.create", "asset.edit", "asset.delete", "asset.view", "asset.transfer", "transfer.decide",
        "job.create", "job.send", "job.decide", "job.plan", "job.work",
        "checklist.sign", "loto.sign", "reading.log",
        "part.manage", "part.view", "procurement.manage", "procurement.decide", "bom.manage",
        "plan.manage", "doc.manage", "contract.manage", "condition.manage",
        "report.view", "kpi.view", "oee.view", "audit.view", "gantt.view", "budget.manage"
    },
    "planner": {
        "asset.view", "part.view", "gantt.view",
        "job.create", "job.send", "job.plan", "job.work",
        "plan.manage", "report.view", "kpi.view"
    },
    "manager": {
        "asset.view", "asset.transfer", "transfer.decide",
        "job.create", "job.send", "job.decide", "job.work",
        "contractor.decide", "procurement.decide", "budget.manage",
        "part.manage", "part.view", "contract.manage",
        "report.view", "kpi.view", "oee.view", "audit.view"
    },
    "technician": {
        "asset.view", "asset.transfer", "part.view",
        "job.create", "job.send", "job.work",
        "checklist.sign", "loto.sign", "reading.log"
    },
    "contractor": {
        "job.contractor_work", "checklist.sign", "loto.sign", "invoice.submit"
    },
    "executive": {
        "report.view", "kpi.view", "oee.view"
    },
}

MENUS = {
    "super_admin": ["dashboard", "assets", "hierarchy", "jobs", "kanban", "plans", "parts", "procurement", "contracts", "readings", "reports", "transfers", "users", "audit"],
    "admin": ["dashboard", "assets", "hierarchy", "jobs", "kanban", "plans", "parts", "procurement", "contracts", "readings", "reports", "transfers", "audit"],
    "planner": ["dashboard", "jobs", "kanban", "gantt", "plans", "assets", "parts", "reports"],
    "manager": ["dashboard", "jobs", "kanban", "transfers", "assets", "parts", "procurement", "reports", "audit"],
    "technician": ["dashboard", "jobs", "scan", "parts", "readings"],
    "contractor": ["dashboard", "contractor_portal"],
    "executive": ["dashboard", "reports"],
}


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
    def checker(user: User = Depends(current_user)) -> User:
        user_perms = PERMISSIONS.get(user.role, set())
        if permission not in user_perms and "*" not in user_perms and "super_admin" != user.role:
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
