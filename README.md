# CMMS — Proof of Concept

A full-stack Computerised Maintenance Management System POC built with **FastAPI + React**.

---

## Quick start (development)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt        # or: pip install -r requirements.txt --break-system-packages
python -m uvicorn app.main:app --reload --port 8000
```

The first run seeds the database with demo data automatically (`cmms.db` created in `backend/`).

### 2. Frontend (dev mode)

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173, proxies /api to :8000
```

### 3. Frontend (production — served by FastAPI)

```bash
cd frontend
npm run build      # outputs to frontend/dist/
# FastAPI already serves dist/ and falls back to index.html for SPA routing
# Just start the backend — open http://localhost:8000
```
## Switch to PostgreSQL

Set the environment variable before starting the backend:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/cmms"
python -m uvicorn app.main:app --port 8000
```

The schema is created automatically on first start. Re-run the seed manually if needed:

```bash
python -c "from app.seed import seed; from app.db import SessionLocal; seed(SessionLocal())"
```

---

## Project structure

```
cmms-poc/
├── backend/
│   ├── app/
│   │   ├── main.py        # All API endpoints
│   │   ├── models.py      # SQLAlchemy models
│   │   ├── security.py    # Auth, roles, permissions
│   │   ├── db.py          # DB session / engine
│   │   └── seed.py        # Demo data
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_rules.py  # 20 business-rule tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/         # Login, Dashboard, Assets, Jobs, Parts, Reports, Audit…
│   │   ├── App.jsx        # Shell, routing, notifications
│   │   ├── auth.jsx       # Auth context
│   │   ├── api.js         # Fetch wrapper
│   │   ├── ui.jsx         # Shared components
│   │   └── styles.css     # All styles
│   ├── public/
│   │   └── manifest.webmanifest   # PWA manifest
│   └── vite.config.js
└── README.md
```

---

## Running tests

```bash
cd backend
pip install pytest httpx --break-system-packages
python -m pytest tests/ -v
```

All 20 tests should pass. They cover: login/lockout, role menus, one-open-job rule, full job lifecycle with stock deduction, reject/revise, edit-only-in-created, stock limits, scheduled jobs needing due dates, asset transfers, low-stock alerts, MTBF formula, downtime report, audit log, notifications, and dashboard per role.

---

## Key features (POC scope)

- **Assets** — fixed and movable, QR code label per asset, location history, transfer workflow
- **Jobs** — repair and scheduled service, 5-step approval workflow, work notes, photos, spare parts, cost tracking
- **Spare parts** — min/max stock, reorder alerts, stock deduction on job close
- **Reports** — downtime trend chart (12 months), MTBF/MTTR, maintenance KPIs; CSV export
- **Roles** — admin / manager / technician / executive; role-based menus and dashboards
- **Audit log** — every state change recorded with user and timestamp
- **Notifications** — in-app alerts for approvals, low stock, overdue jobs
- **Mobile** — responsive layout, bottom navigation bar, "Scan or enter asset code" on technician dashboard

---

## Assumptions and limitations (POC)

| Area | POC behaviour | Full 2.0 |
|------|---------------|----------|
| PDF/Excel export | CSV + browser print | Proper PDF/Excel |
| Offline sync | Banner only (no background sync) | Service Worker with queue |
| QR scanning | Phone camera opens /scan/:code URL | In-app camera scanner |
| Currency | ₹ (Indian Rupee) hardcoded | Configurable |
| Account lockout | 5 failed attempts → 15 min lock | Configurable |
| Preventive trigger | Date-based due date | Hours, both, either |
| Email notifications | Not implemented | SMTP integration |

---

## Photo uploads

Photos are stored in `backend/uploads/` and served at `/uploads/<filename>`.  
The folder is created automatically on first photo upload.

---

*Built as a Phase-1 POC. See the CMMS 2.0 User Manual for the full feature specification.*
