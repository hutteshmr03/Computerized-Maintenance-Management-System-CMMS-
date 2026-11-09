"""
Enterprise Test Suite verifying German Industrial Standards:
DIN 31051, EN 13306, ISO 55001, and ISO 14224.
"""
import pytest
from conftest import login


@pytest.fixture(scope="session")
def superadmin(client):
    return login(client, "superadmin@cmms.test", "SuperAdmin@123")


def test_nine_hr_roles_authentication(client):
    expected_menus = {
        ("superadmin@cmms.test", "SuperAdmin@123"): ["dashboard", "assets", "transfers", "jobs", "parts", "procurement", "reports", "audit", "calibration", "users"],
        ("planthead@cmms.test", "PlantHead@123"): ["dashboard", "assets", "jobs", "reports", "audit", "calibration"],
        ("manager@cmms.test", "Manager@123"): ["dashboard", "assets", "transfers", "jobs", "parts", "reports", "audit", "calibration"],
        ("engineer@cmms.test", "Engineer@123"): ["dashboard", "assets", "jobs", "parts", "calibration"],
        ("tech@cmms.test", "Tech@123"): ["dashboard", "assets", "jobs"],
        ("store@cmms.test", "Store@123"): ["dashboard", "parts", "procurement"],
        ("production@cmms.test", "Prod@123"): ["dashboard", "assets", "jobs"],
        ("purchase@cmms.test", "Purchase@123"): ["dashboard", "procurement"],
        ("auditor@cmms.test", "Audit@123"): ["dashboard", "assets", "jobs", "parts", "reports", "audit"],
    }
    for (email, pw), expected in expected_menus.items():
        h = login(client, email, pw)
        me = client.get("/api/me", headers=h).json()
        assert me["menu"] == expected, f"{email} expected {expected} but got {me['menu']}" 


def test_asset_hierarchy_tree(client, superadmin):
    tree = client.get("/api/hierarchy", headers=superadmin).json()
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


def test_procurement_workflow_replenishes_stock(client, store, purchase, tech):
    # Choose a normal stock part so low-stock test invariants are preserved
    parts = client.get("/api/parts", headers=store).json()
    part = next(p for p in parts if not p["low"])
    before_stock = part["stock"]

    # Create Purchase Request as Store Manager
    pr_res = client.post("/api/procurement/requests", headers=store, json={
        "part_id": part["id"],
        "qty": 10,
    })
    assert pr_res.status_code == 201
    pr = pr_res.json()

    # Purchase Manager approves & orders; Store Manager marks received
    client.post(f"/api/procurement/requests/{pr['id']}/action/approve", headers=purchase, json={})
    client.post(f"/api/procurement/requests/{pr['id']}/action/order", headers=purchase, json={})
    client.post(f"/api/procurement/requests/{pr['id']}/action/receive", headers=store, json={})

    updated_part = next(p for p in client.get("/api/parts", headers=tech).json() if p["id"] == part["id"])
    assert updated_part["stock"] == before_stock + 10


def test_maintenance_engineer_work(client, engineer):
    jobs = client.get("/api/jobs", headers=engineer).json()
    assert isinstance(jobs, list)


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
    assert len(users) >= 9

    # GDPR Data Export
    gdpr_export = client.get(f"/api/gdpr/export/{users[0]['id']}", headers=superadmin).json()
    assert "user_profile" in gdpr_export
    assert "audit_logs" in gdpr_export





def test_calibration_module(client, admin):
    # 1. List calibrations
    cals = client.get("/api/calibrations", headers=admin).json()
    assert len(cals) >= 1
    first = cals[0]
    assert "certificate_number" in first
    assert "result" in first

    # 2. Filter due soon
    due_soon = client.get("/api/calibrations?due_soon=true", headers=admin).json()
    assert isinstance(due_soon, list)

    # 3. Log calibration
    asset_id = first["asset_id"]
    new_cal = client.post("/api/calibrations", headers=admin, json={
        "asset_id": asset_id,
        "last_calibrated_date": "2026-11-01",
        "next_due_date": "2027-11-01",
        "calibrated_by": "TÜV Rheinland",
        "certificate_number": "CERT-2026-TEST",
        "standard_used": "ISO 9001",
        "result": "pass",
        "notes": "Annual certification test"
    })
    assert new_cal.status_code == 201
    created = new_cal.json()
    assert created["certificate_number"] == "CERT-2026-TEST"

    # 4. Update calibration
    updated = client.put(f"/api/calibrations/{created['id']}", headers=admin, json={
        "result": "conditional",
        "notes": "Updated note"
    })
    assert updated.status_code == 200
    assert updated.json()["result"] == "conditional"


def test_live_downtime_endpoint(client, admin):
    res = client.get("/api/downtime/live", headers=admin)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "asset_name" in data[0]
        assert "downtime_hours" in data[0]
        assert "hours_down" in data[0]


def test_asset_utility_type(client, admin):
    # Create asset with utility_type
    loc = client.get("/api/locations", headers=admin).json()[0]["id"]
    r = client.post("/api/assets", headers=admin, json={
        "name": "Chiller Unit 1",
        "category": "Utilities",
        "location_id": loc,
        "utility_type": "chiller"
    })
    assert r.status_code == 201
    asset = r.json()
    assert asset["utility_type"] == "chiller"

    # Filter by utility_type
    filtered = client.get("/api/assets?utility_type=chiller", headers=admin).json()
    assert any(a["id"] == asset["id"] for a in filtered)
