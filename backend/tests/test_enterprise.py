"""
Enterprise Test Suite verifying German Industrial Standards:
DIN 31051, EN 13306, ISO 55001, and ISO 14224.
"""
import pytest
from conftest import login


@pytest.fixture(scope="session")
def superadmin(client):
    return login(client, "superadmin@cmms.test", "SuperAdmin@123")


def test_ten_hr_roles_authentication(client):
    expected_menus = {
        ("superadmin@cmms.test", "SuperAdmin@123"): ["dashboard", "assets", "transfers", "jobs", "parts", "procurement", "reports", "audit", "calibration", "users", "security"],
        ("planthead@cmms.test", "PlantHead@123"): ["dashboard", "assets", "jobs", "reports", "audit", "calibration"],
        ("manager@cmms.test", "Manager@123"): ["dashboard", "assets", "transfers", "jobs", "parts", "reports", "audit", "calibration"],
        ("engineer@cmms.test", "Engineer@123"): ["dashboard", "assets", "jobs", "parts", "calibration"],
        ("tech@cmms.test", "Tech@123"): ["dashboard", "assets", "jobs"],
        ("store@cmms.test", "Store@123"): ["dashboard", "parts", "procurement"],
        ("production@cmms.test", "Prod@123"): ["dashboard", "assets", "jobs"],
        ("purchase@cmms.test", "Purchase@123"): ["dashboard", "procurement"],
        ("quality@cmms.test", "Quality@123"): ["dashboard", "assets", "jobs", "reports", "audit", "calibration"],
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


def test_user_management_edit_and_quality_manager_role(client, superadmin):
    # 1. Create a quality manager user
    email = "qm_test@cmms.test"
    create_res = client.post(
        "/api/admin/users",
        headers=superadmin,
        json={
            "full_name": "Quality Officer",
            "username": "qm_officer",
            "email": email,
            "password": "QualityPass@123",
            "role": "quality_manager",
            "locations": ["Plant A"],
            "units": ["Packaging Unit"],
            "departments": ["Quality"],
            "phone": "+49 89 1234567",
        },
    )
    assert create_res.status_code == 201
    created_user = create_res.json()
    user_id = created_user["id"]
    assert created_user["role"] == "quality_manager"
    assert created_user["locations"] == ["Plant A"]

    # 2. Login as the new quality manager and verify menu permissions
    qm_headers = login(client, email, "QualityPass@123")
    me = client.get("/api/me", headers=qm_headers).json()
    assert me["role"] == "quality_manager"
    assert "calibration" in me["menu"]
    assert "reports" in me["menu"]

    # 3. Edit the user profile (SCR-059) via PUT /api/admin/users/{user_id}
    edit_res = client.put(
        f"/api/admin/users/{user_id}",
        headers=superadmin,
        json={
            "full_name": "Senior Quality Officer",
            "locations": ["Plant A", "Plant B"],
            "units": ["Packaging Unit", "Assembly Line 1"],
            "departments": ["Quality", "Maintenance"],
            "phone": "+49 89 7654321",
            "contractor_company": "TUV SUD QM Services",
        },
    )
    assert edit_res.status_code == 200
    updated_user = edit_res.json()
    assert updated_user["name"] == "Senior Quality Officer"
    assert updated_user["locations"] == ["Plant A", "Plant B"]
    assert updated_user["phone"] == "+49 89 7654321"
    assert updated_user["contractor_company"] == "TUV SUD QM Services"

    # 4. Verify password update via edit endpoint
    pw_update_res = client.put(
        f"/api/admin/users/{user_id}",
        headers=superadmin,
        json={"password": "NewQualityPass@456"},
    )
    assert pw_update_res.status_code == 200
    new_qm_headers = login(client, email, "NewQualityPass@456")
    assert new_qm_headers is not None

    # 5. Clean up created test user
    del_res = client.delete(f"/api/admin/users/{user_id}", headers=superadmin)
    assert del_res.status_code == 200


def test_organizations_and_sites_crud(client, superadmin):
    # 1. List organizations (URS-001)
    orgs_res = client.get("/api/organizations", headers=superadmin)
    assert orgs_res.status_code == 200
    orgs = orgs_res.json()
    assert len(orgs) >= 1
    assert any(o["code"] == "ORG-001" for o in orgs)

    # 2. Create new organization
    new_org_res = client.post(
        "/api/organizations",
        headers=superadmin,
        json={
            "code": "ORG-TEST",
            "name": "Bayer Automation Werk GmbH",
            "domain": "bayer-plant.de",
            "tax_id": "DE998877665",
            "is_active": True,
        },
    )
    assert new_org_res.status_code == 201
    new_org = new_org_res.json()
    assert new_org["code"] == "ORG-TEST"

    # 3. List manufacturing sites (URS-002)
    sites_res = client.get("/api/sites", headers=superadmin)
    assert sites_res.status_code == 200
    sites = sites_res.json()
    assert len(sites) >= 3
    assert any(s["code"] == "SITE-01" for s in sites)

    # 4. Create new manufacturing site under organization
    new_site_res = client.post(
        "/api/sites",
        headers=superadmin,
        json={
            "organization_id": new_org["id"],
            "code": "SITE-TEST-01",
            "name": "Plant C - Battery Storage & Cells",
            "city": "Nuremberg",
            "country": "Germany",
            "address": "Industriestrasse 10",
            "timezone": "Europe/Berlin",
        },
    )
    assert new_site_res.status_code == 201
    new_site = new_site_res.json()
    assert new_site["code"] == "SITE-TEST-01"
    assert new_site["name"] == "Plant C - Battery Storage & Cells"

    # 5. Update site details
    update_res = client.put(
        f"/api/sites/{new_site['id']}",
        headers=superadmin,
        json={"city": "Erlangen", "address": "Am Werk 5"},
    )
    assert update_res.status_code == 200

    # 6. Verify updated details
    get_res = client.get(f"/api/sites/{new_site['id']}", headers=superadmin)
    assert get_res.status_code == 200
    assert get_res.json()["city"] == "Erlangen"


def test_first_login_password_reset_and_account_lockout_policy(client, superadmin):
    # 1. Admin creates a brand new user
    email = "new_operator@cmms.test"
    create_res = client.post(
        "/api/admin/users",
        headers=superadmin,
        json={
            "full_name": "New Operator",
            "username": "new_op",
            "email": email,
            "password": "TempPass@123",
            "role": "technician",
            "locations": ["Plant A"],
        },
    )
    assert create_res.status_code == 201
    user_id = create_res.json()["id"]
    assert create_res.json()["must_reset_password"] is True

    # 2. First login must indicate must_reset_password == True
    login1 = client.post("/api/login", json={"email": email, "password": "TempPass@123"})
    assert login1.status_code == 200
    assert login1.json()["user"]["must_reset_password"] is True
    op_headers = {"Authorization": f"Bearer {login1.json()['token']}"}

    # 3. User resets their password via /api/auth/reset-password
    reset_res = client.post(
        "/api/auth/reset-password",
        headers=op_headers,
        json={"new_password": "MyPersonalPass@999"},
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["user"]["must_reset_password"] is False

    # 4. Subsequent login with personal password has must_reset_password == False
    login2 = client.post("/api/login", json={"email": email, "password": "MyPersonalPass@999"})
    assert login2.status_code == 200
    assert login2.json()["user"]["must_reset_password"] is False

    # 5. Admin sets Account Policy max_login_attempts = 3
    sec_res = client.put(
        "/api/security-settings",
        headers=superadmin,
        json={
            "password_expiry_days": 90,
            "session_timeout_minutes": 30,
            "max_login_attempts": 3,
        },
    )
    assert sec_res.status_code == 200

    # 6. User fails 3 times -> gets exact lockout message on reaching limit and afterwards
    bad1 = client.post("/api/login", json={"email": email, "password": "wrong1"})
    assert bad1.status_code == 401
    bad2 = client.post("/api/login", json={"email": email, "password": "wrong2"})
    assert bad2.status_code == 401
    bad3 = client.post("/api/login", json={"email": email, "password": "wrong3"})
    assert bad3.status_code == 423
    assert "Maximum login attempts reached" in bad3.json()["detail"]

    # Even with correct password, account stays locked with exact message
    locked_try = client.post("/api/login", json={"email": email, "password": "MyPersonalPass@999"})
    assert locked_try.status_code == 423
    assert "Maximum login attempts reached" in locked_try.json()["detail"]

    # 7. Admin resets the locked user's password via Edit User
    admin_reset = client.put(
        f"/api/admin/users/{user_id}",
        headers=superadmin,
        json={"password": "AdminReset@777"},
    )
    assert admin_reset.status_code == 200

    # 8. User logs in 1st time with admin-reset password -> unlocked and must_reset_password == True
    login3 = client.post("/api/login", json={"email": email, "password": "AdminReset@777"})
    assert login3.status_code == 200
    assert login3.json()["user"]["must_reset_password"] is True

    # Cleanup
    client.delete(f"/api/admin/users/{user_id}", headers=superadmin)


def test_database_config_and_health_check(client):
    from app.db import normalize_database_url, build_engine_kwargs

    assert normalize_database_url("postgres://u:p@host:5432/db") == "postgresql://u:p@host:5432/db"
    assert normalize_database_url("mysql://u:p@host:3306/db") == "mysql+pymysql://u:p@host:3306/db"
    assert normalize_database_url("sqlite:///./cmms.db") == "sqlite:///./cmms.db"

    pg_kwargs = build_engine_kwargs("postgresql://u:p@host:5432/db")
    assert pg_kwargs["pool_size"] >= 1
    assert pg_kwargs["pool_recycle"] >= 60
    assert pg_kwargs["pool_pre_ping"] is True

    sqlite_kwargs = build_engine_kwargs("sqlite:///./cmms.db")
    assert sqlite_kwargs["connect_args"]["check_same_thread"] is False

    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["dialect"] == "sqlite"

