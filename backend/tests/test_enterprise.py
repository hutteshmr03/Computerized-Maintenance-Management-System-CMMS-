"""
Enterprise Test Suite verifying German Industrial Standards:
DIN 31051, EN 13306, ISO 55001, and ISO 14224.
"""
import pytest
from conftest import login


@pytest.fixture(scope="session")
def superadmin(client):
    return login(client, "superadmin@cmms.test", "SuperAdmin@123")


@pytest.fixture(scope="session")
def planner(client):
    return login(client, "planner@cmms.test", "Planner@123")


@pytest.fixture(scope="session")
def contractor(client):
    return login(client, "contractor@cmms.test", "Contractor@123")


def test_seven_roles_authentication(client, superadmin, admin, planner, manager, tech, contractor, ceo):
    # Verify each role receives their exact segregated menu configuration
    assert "users" in client.get("/api/me", headers=superadmin).json()["menu"]
    assert "hierarchy" in client.get("/api/me", headers=admin).json()["menu"]
    assert "gantt" in client.get("/api/me", headers=planner).json()["menu"]
    assert "transfers" in client.get("/api/me", headers=manager).json()["menu"]
    assert "scan" in client.get("/api/me", headers=tech).json()["menu"]
    assert client.get("/api/me", headers=contractor).json()["menu"] == ["portal"]
    assert client.get("/api/me", headers=ceo).json()["menu"] == ["dashboard", "reports"]


def test_asset_hierarchy_tree(client, admin):
    tree = client.get("/api/hierarchy", headers=admin).json()
    assert len(tree) >= 1
    root = tree[0]
    assert root["tier"] == "site"
    assert len(root["children"]) >= 1
    loc_node = root["children"][0]
    assert loc_node["tier"] == "location"
    assert len(loc_node["children"]) >= 1
    sys_node = loc_node["children"][0]
    assert sys_node["tier"] == "system"


def test_iso_14224_failure_code_library(client, tech):
    codes = client.get("/api/failure-codes", headers=tech).json()
    assert len(codes) >= 5
    pwr_codes = [c for c in codes if c["asset_category"] == "Power"]
    assert pwr_codes
    assert any(c["failure_mode"] == "Failure to start" for c in pwr_codes)


def test_multi_trigger_plan_and_auto_wo_generation(client, planner):
    plans = client.get("/api/plans", headers=planner).json()
    assert len(plans) >= 2
    plan = plans[0]

    # Trigger generation of Work Order from PM plan
    res = client.post(f"/api/plans/{plan['id']}/trigger", headers=planner).json()
    assert res["status"] == "approved"
    assert res["din_type"] == plan["din_type"]
    assert len(res["checklists"]) >= 1


def test_loto_safety_permit_blocks_start_until_signed(client, tech, admin):
    # Create fresh asset for LOTO test
    loc = client.get("/api/locations", headers=admin).json()[0]["id"]
    asset = client.post("/api/assets", headers=admin, json={"name": "High Voltage Switchgear", "location_id": loc, "criticality": "A"}).json()

    job_res = client.post("/api/jobs", headers=tech, json={
        "title": "High Voltage Switchgear Maintenance",
        "asset_id": asset["id"],
        "priority": "critical",
        "loto_required": True,
    })
    assert job_res.status_code == 201
    job = job_res.json()

    # Move to approved
    client.post(f"/api/jobs/{job['id']}/action/send", headers=tech, json={})
    client.post(f"/api/jobs/{job['id']}/action/approve", headers=admin, json={})

    # Cannot start without LOTO sign-off
    r_start = client.post(f"/api/jobs/{job['id']}/action/start", headers=tech, json={})
    assert r_start.status_code == 400
    assert "Safety violation" in r_start.json()["detail"]

    # Sign LOTO permit
    r_sign = client.post(f"/api/jobs/{job['id']}/loto/sign", headers=tech, json={})
    assert r_sign.status_code == 200

    # Now can start work!
    r_start_ok = client.post(f"/api/jobs/{job['id']}/action/start", headers=tech, json={})
    assert r_start_ok.status_code == 200
    assert r_start_ok.json()["status"] == "in_progress"


def test_procurement_workflow_replenishes_stock(client, admin, manager, tech):
    # Choose a normal stock part so low-stock test invariants are preserved
    parts = client.get("/api/parts", headers=admin).json()
    part = next(p for p in parts if not p["low"])
    before_stock = part["stock"]

    # Create Purchase Request as Admin
    pr_res = client.post("/api/procurement/requests", headers=admin, json={
        "part_id": part["id"],
        "qty": 10,
    })
    assert pr_res.status_code == 201
    pr = pr_res.json()

    # Manager approves, orders, and marks received
    client.post(f"/api/procurement/requests/{pr['id']}/action/approve", headers=manager, json={})
    client.post(f"/api/procurement/requests/{pr['id']}/action/order", headers=manager, json={})
    client.post(f"/api/procurement/requests/{pr['id']}/action/receive", headers=manager, json={})

    updated_part = next(p for p in client.get("/api/parts", headers=tech).json() if p["id"] == part["id"])
    assert updated_part["stock"] == before_stock + 10


def test_contractor_portal_isolation(client, contractor):
    jobs = client.get("/api/contractor/jobs", headers=contractor).json()
    assert len(jobs) >= 1
    # Contractor should only see jobs assigned to them
    me = client.get("/api/me", headers=contractor).json()
    for j in jobs:
        assert j["contractor_id"] == me["id"]


def test_en13306_kpis_and_oee(client, ceo):
    kpis = client.get("/api/reports/kpis", headers=ceo).json()
    assert "pm_compliance_pct" in kpis
    assert "backlog_hours" in kpis
    assert "wrench_time_pct" in kpis
    assert "mtbf_hours" in kpis
    assert "mttr_hours" in kpis

    oee = client.get("/api/reports/oee", headers=ceo).json()
    assert len(oee) >= 1
    assert "availability_pct" in oee[0]
    assert "performance_pct" in oee[0]
    assert "quality_pct" in oee[0]
    assert "oee_pct" in oee[0]


def test_superadmin_user_management_and_gdpr(client, superadmin):
    # View users
    users = client.get("/api/admin/users", headers=superadmin).json()
    assert len(users) >= 7

    # GDPR Data Export
    gdpr_export = client.get(f"/api/gdpr/export/{users[0]['id']}", headers=superadmin).json()
    assert "user_profile" in gdpr_export
    assert "audit_logs" in gdpr_export
