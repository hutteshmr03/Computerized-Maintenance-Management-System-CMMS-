"""Tests for the business rules the POC promises: roles, one open job per asset,
job lifecycle, stock deduction, transfers, lockout and reports."""
import pytest
from conftest import login


def new_asset(client, h, name="Test Lathe", movable=False):
    loc = client.get("/api/locations", headers=h).json()[0]["id"]
    r = client.post("/api/assets", headers=h, json={"name": name, "is_movable": movable, "location_id": loc})
    assert r.status_code == 201, r.text
    return r.json()


def new_job(client, h, asset_id, **kw):
    body = {"type": "repair", "asset_id": asset_id, "title": "Test fault", "priority": "high"}
    body.update(kw)
    return client.post("/api/jobs", headers=h, json=body)


# ------------------------------------------------------------ auth and roles
def test_login_wrong_password_gives_clear_message(client):
    r = client.post("/api/login", json={"email": "tech@cmms.test", "password": "nope"})
    assert r.status_code == 401
    assert "not correct" in r.json()["detail"]


def test_lockout_after_five_wrong_attempts(client):
    for _ in range(5):
        client.post("/api/login", json={"email": "tech2@cmms.test", "password": "bad"})
    r = client.post("/api/login", json={"email": "tech2@cmms.test", "password": "Tech@123"})
    assert r.status_code == 423
    assert "minute" in r.json()["detail"]


def test_requires_login(client):
    assert client.get("/api/jobs").status_code == 401


def test_menu_depends_on_role(client, tech, ceo):
    assert "audit" not in client.get("/api/me", headers=tech).json()["menu"]
    assert client.get("/api/me", headers=ceo).json()["menu"] == ["dashboard", "reports"]


def test_technician_cannot_approve_or_see_audit(client, tech):
    assert client.get("/api/audit", headers=tech).status_code == 403
    sent = [j for j in client.get("/api/jobs?status=sent_for_approval", headers=tech).json()][0]
    r = client.post(f"/api/jobs/{sent['id']}/action/approve", headers=tech, json={})
    assert r.status_code == 403


def test_executive_cannot_create_job(client, ceo, tech):
    asset = client.get("/api/assets", headers=tech).json()[-1]
    assert new_job(client, ceo, asset["id"]).status_code == 403


# ------------------------------------------------------------ jobs
def test_one_open_job_per_asset(client, admin, tech):
    a = new_asset(client, admin, "OneJob Machine")
    first = new_job(client, tech, a["id"])
    assert first.status_code == 201
    second = new_job(client, tech, a["id"])
    assert second.status_code == 409
    assert f"#{first.json()['id']}" in second.json()["detail"]


def test_full_lifecycle_and_stock_deduction(client, admin, tech, manager):
    a = new_asset(client, admin, "Lifecycle Machine")
    job = new_job(client, tech, a["id"], estimated_cost=1000).json()
    assert job["status"] == "created" and "send" in job["actions"]
    jid = job["id"]

    # cannot jump ahead
    assert client.post(f"/api/jobs/{jid}/action/start", headers=tech, json={}).status_code == 409

    assert client.post(f"/api/jobs/{jid}/action/send", headers=tech, json={}).json()["status"] == "sent_for_approval"
    # technician now sees no actions, manager sees approve and reject
    assert client.get(f"/api/jobs/{jid}", headers=tech).json()["actions"] == []
    assert client.get(f"/api/jobs/{jid}", headers=manager).json()["actions"] == ["approve", "reject"]

    assert client.post(f"/api/jobs/{jid}/action/approve", headers=manager, json={}).json()["status"] == "approved"
    assert client.post(f"/api/jobs/{jid}/action/start", headers=tech, json={}).json()["status"] == "in_progress"

    part = next(p for p in client.get("/api/parts", headers=tech).json() if p["sku"] == "FUS-10A")
    before = part["stock"]
    r = client.post(f"/api/jobs/{jid}/parts", headers=tech, json={"part_id": part["id"], "qty": 4})
    assert r.status_code == 201

    # repair job cannot close without a breakdown reason
    assert client.post(f"/api/jobs/{jid}/action/close", headers=tech, json={}).status_code == 422
    client.put(f"/api/jobs/{jid}/work", headers=tech,
               json={"breakdown_reason": "Blown fuse", "action_taken": "Replaced", "labour_hours": 2, "labour_rate": 100})
    done = client.post(f"/api/jobs/{jid}/action/close", headers=tech, json={}).json()
    assert done["status"] == "completed"
    assert done["total_cost"] == 4 * 15 + 2 * 100

    after = next(p for p in client.get("/api/parts", headers=tech).json() if p["sku"] == "FUS-10A")["stock"]
    assert after == before - 4

    # asset is free for a new job again
    assert new_job(client, tech, a["id"]).status_code == 201


def test_reject_needs_reason_and_can_be_revised(client, admin, tech, manager):
    a = new_asset(client, admin, "Reject Machine")
    jid = new_job(client, tech, a["id"]).json()["id"]
    client.post(f"/api/jobs/{jid}/action/send", headers=tech, json={})
    assert client.post(f"/api/jobs/{jid}/action/reject", headers=manager, json={}).status_code == 422
    r = client.post(f"/api/jobs/{jid}/action/reject", headers=manager, json={"reason": "Need a quote first"})
    assert r.json()["status"] == "rejected" and r.json()["rejection_reason"] == "Need a quote first"
    assert client.post(f"/api/jobs/{jid}/action/revise", headers=tech, json={}).json()["status"] == "created"


def test_job_editable_only_in_created(client, admin, tech):
    a = new_asset(client, admin, "Edit Machine")
    j = new_job(client, tech, a["id"]).json()
    body = {"type": "repair", "asset_id": a["id"], "title": "Changed title", "priority": "low"}
    assert client.patch(f"/api/jobs/{j['id']}", headers=tech, json=body).status_code == 200
    client.post(f"/api/jobs/{j['id']}/action/send", headers=tech, json={})
    assert client.patch(f"/api/jobs/{j['id']}", headers=tech, json=body).status_code == 409


def test_cannot_use_more_parts_than_in_stock(client, admin, tech, manager):
    a = new_asset(client, admin, "Stock Machine")
    jid = new_job(client, tech, a["id"]).json()["id"]
    client.post(f"/api/jobs/{jid}/action/send", headers=tech, json={})
    client.post(f"/api/jobs/{jid}/action/approve", headers=manager, json={})
    client.post(f"/api/jobs/{jid}/action/start", headers=tech, json={})
    part = client.get("/api/parts", headers=tech).json()[0]
    r = client.post(f"/api/jobs/{jid}/parts", headers=tech, json={"part_id": part["id"], "qty": part["stock"] + 1})
    assert r.status_code == 409 and "in stock" in r.json()["detail"]


def test_scheduled_job_needs_due_date(client, admin, tech):
    a = new_asset(client, admin, "Schedule Machine")
    assert new_job(client, tech, a["id"], type="scheduled").status_code == 422


# ------------------------------------------------------------ transfers
def test_transfer_flow_updates_location_and_history(client, admin, tech, manager):
    a = new_asset(client, admin, "Movable Cart", movable=True)
    locs = client.get("/api/locations", headers=tech).json()
    target = next(l for l in locs if l["name"] != a["location"])
    t = client.post(f"/api/assets/{a['id']}/transfer", headers=tech, json={"to_location_id": target["id"]})
    assert t.status_code == 201
    # second request while pending is refused
    assert client.post(f"/api/assets/{a['id']}/transfer", headers=tech,
                       json={"to_location_id": target["id"]}).status_code == 409
    assert client.post(f"/api/transfers/{t.json()['id']}/approve", headers=tech, json={}).status_code == 403
    assert client.post(f"/api/transfers/{t.json()['id']}/approve", headers=manager, json={}).json()["status"] == "approved"
    detail = client.get(f"/api/assets/{a['id']}", headers=tech).json()
    assert detail["location"] == target["name"]
    assert detail["history"][0]["to"] == target["name"]


def test_fixed_asset_cannot_be_transferred(client, admin, tech):
    a = new_asset(client, admin, "Fixed Boiler", movable=False)
    loc = client.get("/api/locations", headers=tech).json()[-1]["id"]
    assert client.post(f"/api/assets/{a['id']}/transfer", headers=tech, json={"to_location_id": loc}).status_code == 409


# ------------------------------------------------------------ parts, reports, audit
def test_low_stock_and_purchase_quantity(client, tech):
    low = [p for p in client.get("/api/parts", headers=tech).json() if p["low"]]
    assert low, "seed data should contain low-stock parts"
    for p in low:
        assert p["order_qty"] == p["max_level"] - p["stock"]


def test_mtbf_report_matches_manual_formula(client, manager):
    r = client.get("/api/reports/mtbf?asset_id=1", headers=manager).json()
    assert r["failures"] >= 1
    assert r["mtbf_hours"] == pytest.approx(r["uptime_hours"] / r["failures"], abs=0.1)


def test_downtime_report_has_twelve_months(client, manager):
    r = client.get("/api/reports/downtime?asset_id=1", headers=manager).json()
    assert len(r["months"]) == 12
    assert all(m["total"] == pytest.approx(m["repair"] + m["scheduled"], abs=0.11) for m in r["months"])


def test_audit_log_records_actions(client, manager):
    rows = client.get("/api/audit?q=approve", headers=manager).json()
    assert rows and rows[0]["user"]


def test_notifications_reach_manager(client, manager):
    n = client.get("/api/notifications", headers=manager).json()
    assert n["unread"] >= 1
    client.post("/api/notifications/read-all", headers=manager)
    assert client.get("/api/notifications", headers=manager).json()["unread"] == 0


def test_dashboard_shape_per_role(client, manager, tech, ceo):
    assert "pending_approvals" in client.get("/api/dashboard", headers=manager).json()
    assert "my_tasks" in client.get("/api/dashboard", headers=tech).json()
    assert "kpis" in client.get("/api/dashboard", headers=ceo).json()
