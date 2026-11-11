"""
Enterprise Demo Data compliant with DIN 31051, EN 13306, ISO 55001, and ISO 14224.
Seeds 7 distinct roles, a 5-tier asset hierarchy, failure library, BOMs, multi-trigger plans,
contracts/SLAs, condition readings, purchase requests, and historical work orders.
"""
import json
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from . import models as m
from .db import utcnow
from .security import hash_password

# Exactly 9 HR Roles
DEMO_USERS = [
    ("Admin", "superadmin@cmms.test", "SuperAdmin@123", "admin", "", "+49 711 901201"),
    ("Ravi Plant Head", "planthead@cmms.test", "PlantHead@123", "plant_head", "", "+49 711 901202"),
    ("Anita Manager", "manager@cmms.test", "Manager@123", "maintenance_manager", "", "+49 711 901203"),
    ("Kiran Engineer", "engineer@cmms.test", "Engineer@123", "maintenance_engineer", "", "+49 711 901204"),
    ("Suresh Tech", "tech@cmms.test", "Tech@123", "technician", "", "+49 711 901205"),
    ("Meena Store", "store@cmms.test", "Store@123", "store_manager", "", "+49 711 901206"),
    ("Arjun Production", "production@cmms.test", "Prod@123", "production_manager", "", "+49 711 901207"),
    ("Priya Purchase", "purchase@cmms.test", "Purchase@123", "purchase_manager", "", "+49 711 901208"),
    ("Suresh Auditor", "auditor@cmms.test", "Audit@123", "auditor", "", "+49 711 901209"),
]

COST_CENTRES = [
    ("CC-101", "Power & Utilities", 2500000.0, 342000.0),
    ("CC-102", "Mechanical Production", 4200000.0, 785000.0),
    ("CC-103", "Heavy Forming & Pressing", 3100000.0, 490000.0),
    ("CC-104", "Logistics & Material Flow", 1200000.0, 145000.0),
]

LOCATIONS = ["Plant A", "Plant B", "Warehouse", "Workshop"]

# ISO 14224 Failure Code Library
FAILURE_CODES = [
    ("FC-PWR-01", "Power", "Failure to start", "Dead starter battery / fuel starvation", "Total loss of backup power", "Periodic start test"),
    ("FC-PWR-02", "Power", "Engine overheating", "Coolant leak / radiator blockage", "Automatic thermal trip", "Temperature sensor reading"),
    ("FC-PWR-03", "Power", "High vibration", "Bearing fatigue / rotor imbalance", "Bearing race spalling", "Vibration analysis"),
    ("FC-UTL-01", "Utilities", "Pressure drop below 6 bar", "Intake valve stuck / air filter clogged", "Pneumatic line starvation", "Differential pressure gauge"),
    ("FC-UTL-02", "Utilities", "Oil carryover", "Separator filter membrane rupture", "Downstream air contamination", "Air quality audit"),
    ("FC-MCH-01", "Machine tools", "Spindle stall / overheat", "Bearing lubrication starvation", "Machine stop / workpiece scrap", "Thermal imaging"),
    ("FC-MCH-02", "Machine tools", "Hydraulic pressure loss", "Proportional valve failure / blown O-ring", "Ram stuck mid-stroke", "Pressure transducer"),
    ("FC-MCH-03", "Machine tools", "Axis positioning error", "Ballscrew backlash / encoder dirt", "Dimensional tolerance breach", "Laser interferometer"),
    ("FC-VEH-01", "Vehicles", "Hydraulic lift slow", "Pump cavitation / low fluid level", "Reduced lifting speed", "Daily operator inspection"),
    ("FC-VEH-02", "Vehicles", "Brake fade / failure", "Worn friction linings / hydraulic leak", "Loss of braking force (Hazard)", "Safety check"),
]

# Spare parts catalogue with bin locations
PARTS = [
    ("BRG-6205", "Ball bearing 6205 SKF", "pcs", 6, 4, 20, "Sree Bearings", 250.0, "Bin A-12"),
    ("BLT-B52", "V-belt B-52 Optibelt", "pcs", 14, 5, 25, "Sree Bearings", 180.0, "Bin A-14"),
    ("OIL-HYD20", "Hydraulic oil HLP 46 (20 L)", "can", 8, 3, 15, "Lubetech", 4200.0, "Oil Bay 3"),
    ("FLT-AIR01", "Air filter element Mann C15", "pcs", 3, 4, 15, "FilterWorld", 650.0, "Bin B-02"),
    ("FLT-OIL02", "Oil filter cartridge W920", "pcs", 10, 4, 16, "FilterWorld", 400.0, "Bin B-03"),
    ("FUS-10A", "Fuse 10 A ceramic NH00", "pcs", 45, 20, 100, "Volt Supplies", 15.0, "Bin E-01"),
]


def seed(db: Session):
    now = utcnow()
    year = now.year

    # 0. Seed Built-in Roles into CustomRole
    from .security import DEFAULT_BUILTIN_ROLES
    for r in DEFAULT_BUILTIN_ROLES:
        existing = db.query(m.CustomRole).filter_by(name=r["name"]).first()
        if not existing:
            db.add(m.CustomRole(
                name=r["name"],
                display_name=r["display_name"],
                privileges=r["privileges"],
                created_by="System Built-in",
                created_at=now,
            ))
    db.flush()

    # 1. Seed Users
    users = {}
    for name, email, pw, role, company, phone in DEMO_USERS:
        u = m.User(
            name=name,
            full_name=name,
            username=email.split("@")[0],
            email=email,
            password_hash=hash_password(pw),
            role=role,
            contractor_company=company,
            phone=phone,
            status="active",
        )
        db.add(u)
        users[email] = u
    db.flush()

    # Seed Default Security Settings
    if not db.query(m.SecuritySettings).first():
        db.add(m.SecuritySettings(
            id=1,
            password_expiry_days=90,
            session_timeout_minutes=30,
            max_login_attempts=5,
            updated_by="System",
            updated_at=now,
        ))
    db.flush()

    # 2. Seed Cost Centres
    ccs = {}
    for code, name, annual, spent in COST_CENTRES:
        cc = m.CostCentre(code=code, name=name, budget_annual=annual, budget_spent=spent)
        db.add(cc)
        ccs[code] = cc
    db.flush()

    # 3. Seed Legacy Locations
    locs = {n: m.Location(name=n) for n in LOCATIONS}
    db.add_all(locs.values())
    db.flush()

    # 4. Seed ISO 14224 Failure Codes
    for code, cat, mode, cause, effect, detect in FAILURE_CODES:
        fc = m.FailureCode(
            code=code,
            asset_category=cat,
            failure_mode=mode,
            failure_cause=cause,
            failure_effect=effect,
            detection_method=detect,
        )
        db.add(fc)
    db.flush()

    # 5. Seed Spare Parts
    parts = {}
    for sku, name, unit, stock, mn, mx, vendor, cost, bin_loc in PARTS:
        p = m.SparePart(
            sku=sku,
            name=name,
            unit=unit,
            stock=stock,
            min_level=mn,
            max_level=mx,
            vendor=vendor,
            unit_cost=cost,
            location_bin=bin_loc,
        )
        db.add(p)
        parts[sku] = p
    db.flush()

    # 6. Seed Assets first so AST-0001 gets ID 1 (preserving historical ID contracts)
    ast_gen = m.Asset(
        code="AST-0001",
        name="Diesel Generator Set 1250kVA",
        tier="asset",
        category="Power",
        criticality="A",
        replacement_value=850000.0,
        under_warranty=False,
        install_date=date(year - 4, 3, 15),
        expected_life_years=15,
        serial_number="CAT-3512B-9812",
        manufacturer="Caterpillar",
        running_hours=4250.0,
        location_id=locs["Plant A"].id,
        cost_centre_id=ccs["CC-101"].id,
    )
    ast_comp = m.Asset(
        code="AST-0002",
        name="Air Compressor Rotary Screw 75kW",
        tier="asset",
        category="Utilities",
        criticality="B",
        replacement_value=420000.0,
        under_warranty=True,
        install_date=date(year - 1, 6, 20),
        expected_life_years=12,
        serial_number="AC-GA75-VSD",
        manufacturer="Atlas Copco",
        running_hours=1890.0,
        location_id=locs["Plant A"].id,
        cost_centre_id=ccs["CC-101"].id,
    )
    ast_forklift = m.Asset(
        code="AST-0003",
        name="Electric Forklift FL-02 2.5T",
        tier="asset",
        category="Vehicles",
        criticality="B",
        is_movable=True,
        replacement_value=1200000.0,
        under_warranty=False,
        install_date=date(year - 3, 2, 10),
        expected_life_years=8,
        serial_number="JUN-EFG-216",
        manufacturer="Jungheinrich",
        running_hours=3120.0,
        location_id=locs["Warehouse"].id,
        cost_centre_id=ccs["CC-104"].id,
    )
    ast_cnc = m.Asset(
        code="AST-0004",
        name="CNC 5-Axis Milling Machine DMU 50",
        tier="asset",
        category="Machine tools",
        criticality="A",
        replacement_value=3500000.0,
        under_warranty=True,
        install_date=date(year - 1, 9, 1),
        expected_life_years=10,
        serial_number="DMG-DMU50-449",
        manufacturer="DMG Mori",
        running_hours=2400.0,
        location_id=locs["Plant B"].id,
        cost_centre_id=ccs["CC-102"].id,
    )
    ast_conveyor = m.Asset(
        code="AST-0005",
        name="Conveyor Belt Line 1 Heavy Duty",
        tier="asset",
        category="Material handling",
        criticality="B",
        replacement_value=600000.0,
        under_warranty=False,
        install_date=date(year - 5, 4, 12),
        expected_life_years=10,
        serial_number="TRX-CV-600",
        manufacturer="TGW Logistics",
        running_hours=8900.0,
        location_id=locs["Plant B"].id,
        cost_centre_id=ccs["CC-102"].id,
    )
    ast_press = m.Asset(
        code="AST-0006",
        name="Hydraulic Press 500-Ton Schuler",
        tier="asset",
        category="Machine tools",
        criticality="A",
        replacement_value=1500000.0,
        under_warranty=False,
        install_date=date(year - 6, 8, 24),
        expected_life_years=20,
        serial_number="SCH-HP500-08",
        manufacturer="Schuler AG",
        running_hours=12450.0,
        location_id=locs["Workshop"].id,
        cost_centre_id=ccs["CC-103"].id,
    )
    ast_pallet = m.Asset(
        code="AST-0007",
        name="Manual Pallet Truck 2000kg",
        tier="asset",
        category="Vehicles",
        criticality="C",
        is_movable=True,
        replacement_value=80000.0,
        under_warranty=False,
        install_date=date(year - 2, 11, 5),
        expected_life_years=5,
        serial_number="STK-PT20-77",
        manufacturer="Still",
        running_hours=500.0,
        location_id=locs["Warehouse"].id,
        cost_centre_id=ccs["CC-104"].id,
    )
    db.add_all([ast_gen, ast_comp, ast_forklift, ast_cnc, ast_conveyor, ast_press, ast_pallet])
    db.flush()

    for a in [ast_gen, ast_comp, ast_forklift, ast_cnc, ast_conveyor, ast_press, ast_pallet]:
        db.add(m.LocationHistory(asset_id=a.id, from_location="", to_location=a.location.name, moved_at=datetime(year, 1, 1)))

    # Seed 5-Tier Asset Hierarchy Nodes (Site -> Location -> System)
    site1 = m.Asset(code="SITE-0001", name="Stuttgart Manufacturing Campus", tier="site", criticality="A", location_id=locs["Plant A"].id, cost_centre_id=ccs["CC-101"].id)
    db.add(site1)
    db.flush()

    loc_plant_a = m.Asset(code="LOC-0001", name="Plant A - Power & Utilities", tier="location", parent_id=site1.id, location_id=locs["Plant A"].id, cost_centre_id=ccs["CC-101"].id)
    loc_plant_b = m.Asset(code="LOC-0002", name="Plant B - Heavy Production", tier="location", parent_id=site1.id, location_id=locs["Plant B"].id, cost_centre_id=ccs["CC-102"].id)
    loc_warehouse = m.Asset(code="LOC-0003", name="Logistics & Storage Bay", tier="location", parent_id=site1.id, location_id=locs["Warehouse"].id, cost_centre_id=ccs["CC-104"].id)
    db.add_all([loc_plant_a, loc_plant_b, loc_warehouse])
    db.flush()

    sys_gen = m.Asset(code="SYS-0001", name="Emergency Backup Generation System", tier="system", parent_id=loc_plant_a.id, location_id=locs["Plant A"].id, cost_centre_id=ccs["CC-101"].id)
    sys_comp = m.Asset(code="SYS-0002", name="Pneumatics & High-Pressure Air System", tier="system", parent_id=loc_plant_a.id, location_id=locs["Plant A"].id, cost_centre_id=ccs["CC-101"].id)
    sys_press = m.Asset(code="SYS-0003", name="Heavy Stamping & Hydraulic Forming System", tier="system", parent_id=loc_plant_b.id, location_id=locs["Workshop"].id, cost_centre_id=ccs["CC-103"].id)
    sys_milling = m.Asset(code="SYS-0004", name="High-Precision CNC Machining Center", tier="system", parent_id=loc_plant_b.id, location_id=locs["Plant B"].id, cost_centre_id=ccs["CC-102"].id)
    sys_conveyor = m.Asset(code="SYS-0005", name="Assembly Line 1 Continuous Flow", tier="system", parent_id=loc_plant_b.id, location_id=locs["Plant B"].id, cost_centre_id=ccs["CC-102"].id)
    sys_fleet = m.Asset(code="SYS-0006", name="Intralogistics Material Handling Fleet", tier="system", parent_id=loc_warehouse.id, location_id=locs["Warehouse"].id, cost_centre_id=ccs["CC-104"].id)
    db.add_all([sys_gen, sys_comp, sys_press, sys_milling, sys_conveyor, sys_fleet])
    db.flush()

    # Link assets into systems
    ast_gen.parent_id = sys_gen.id
    ast_comp.parent_id = sys_comp.id
    ast_forklift.parent_id = sys_fleet.id
    ast_cnc.parent_id = sys_milling.id
    ast_conveyor.parent_id = sys_conveyor.id
    ast_press.parent_id = sys_press.id
    ast_pallet.parent_id = sys_fleet.id

    # Tier 5: Components
    cmp1 = m.Asset(code="CMP-0001", name="Main Crankshaft & Bearing Assembly", tier="component", parent_id=ast_gen.id, location_id=locs["Plant A"].id, criticality="A")
    cmp2 = m.Asset(code="CMP-0002", name="Turbocharger Boost Unit", tier="component", parent_id=ast_gen.id, location_id=locs["Plant A"].id, criticality="B")
    cmp3 = m.Asset(code="CMP-0003", name="Oil/Air Separator Cartridge Assembly", tier="component", parent_id=ast_comp.id, location_id=locs["Plant A"].id, criticality="B")
    cmp4 = m.Asset(code="CMP-0004", name="High-Speed Milling Spindle 24000 RPM", tier="component", parent_id=ast_cnc.id, location_id=locs["Plant B"].id, criticality="A")
    cmp5 = m.Asset(code="CMP-0005", name="500-Ton Main Cylinder Seal Pack", tier="component", parent_id=ast_press.id, location_id=locs["Workshop"].id, criticality="A")
    db.add_all([cmp1, cmp2, cmp3, cmp4, cmp5])
    db.flush()

    # 7. Bill of Materials (BOM) linking spare parts to assets
    db.add_all([
        m.BOMItem(asset_id=ast_gen.id, part_id=parts["FLT-OIL02"].id, qty_recommended=2, notes="Primary engine oil filter"),
        m.BOMItem(asset_id=ast_gen.id, part_id=parts["BLT-B52"].id, qty_recommended=1, notes="Alternator drive belt"),
        m.BOMItem(asset_id=ast_comp.id, part_id=parts["FLT-AIR01"].id, qty_recommended=1, notes="Compressor intake air filter"),
        m.BOMItem(asset_id=ast_comp.id, part_id=parts["OIL-HYD20"].id, qty_recommended=1, notes="Synthetic compressor lubricant"),
        m.BOMItem(asset_id=ast_cnc.id, part_id=parts["BRG-6205"].id, qty_recommended=2, notes="Spindle support ball bearings"),
        m.BOMItem(asset_id=ast_cnc.id, part_id=parts["FUS-10A"].id, qty_recommended=4, notes="Drive amplifier control circuit fuses"),
        m.BOMItem(asset_id=ast_press.id, part_id=parts["OIL-HYD20"].id, qty_recommended=3, notes="Hydraulic reservoir replenishment"),
    ])
    db.flush()

    # 8. Document Management Attachments
    db.add_all([
        m.AssetDocument(asset_id=ast_gen.id, title="Caterpillar 3512B Maintenance Manual (DIN EN 82079)", doc_type="manual", version="2.4", filename="manual_cat3512.pdf", file_size_bytes=4250000, uploaded_by="Anita Manager", notes="Full factory workshop overhaul guidelines"),
        m.AssetDocument(asset_id=ast_gen.id, title="EC Declaration of Conformity (2006/42/EC)", doc_type="ce_certificate", version="1.0", filename="ce_cat3512.pdf", file_size_bytes=412000, uploaded_by="Anita Manager", notes="TÜV Rheinland certified"),
        m.AssetDocument(asset_id=ast_cnc.id, title="DMU 50 High-Speed Spindle Calibration ISO 17025", doc_type="calibration", version="1.1", filename="calib_dmu50.pdf", file_size_bytes=890000, uploaded_by="Klaus Planner", notes="Spindle dynamic balancing & runout < 2 µm"),
        m.AssetDocument(asset_id=ast_press.id, title="Schuler HP-500 Hydraulic Circuit Schematic", doc_type="schematic", version="3.0", filename="schematic_hp500.pdf", file_size_bytes=6100000, uploaded_by="Anita Manager", notes="Updated with proportional servo manifold"),
    ])
    db.flush()

    # 9. Warranty & SLA Contracts
    db.add_all([
        m.Contract(
            asset_id=ast_cnc.id,
            vendor_name="DMG Mori Industrial Services",
            contract_type="service_sla",
            start_date=date(year - 1, 9, 1),
            end_date=date(year + 1, 9, 1),
            sla_response_hours=2.0,
            cost=240000.0,
            terms="24/7 priority technician dispatch; guaranteed 2-hour response for spindle faults.",
            status="active",
        ),
        m.Contract(
            asset_id=ast_comp.id,
            vendor_name="Atlas Copco Certified Care",
            contract_type="warranty",
            start_date=date(year - 1, 6, 20),
            end_date=date(year + 1, 6, 20),
            sla_response_hours=4.0,
            cost=85000.0,
            terms="All screw element defects covered under 24-month manufacturer warranty.",
            status="active",
        ),
        m.Contract(
            asset_id=ast_gen.id,
            vendor_name="Siemens Energy Service GmbH",
            contract_type="preventive_sla",
            start_date=date(year - 1, 1, 1),
            end_date=date(year, 12, 31),
            sla_response_hours=4.0,
            cost=120000.0,
            terms="Semi-annual load bank testing and oil spectrographic analysis.",
            status="active",
        ),
    ])
    db.flush()

    # 10. Multi-Trigger Maintenance Plans (DIN 31051)
    db.add_all([
        m.MaintenancePlan(
            code="PM-0001",
            asset_id=ast_gen.id,
            din_type="servicing",
            title="Monthly Generator Lubrication & Battery Load Test",
            description="Inspect fuel lines, replace oil filter, test starter battery impedance, check coolant specific gravity.",
            trigger_type="calendar",
            interval_days=30,
            next_due_date=date.today() + timedelta(days=5),
            priority="medium",
            estimated_hours=3.0,
            assigned_to=users["tech@cmms.test"].id,
            loto_required=True,
            checklist_template=json.dumps([
                "Lockout starter solenoid breaker & tag out controls",
                "Measure battery open-circuit voltage & load test",
                "Inspect fuel water separator & drain sediment bowl",
                "Check engine oil level & record dipstick reading",
                "Run engine under 50% load for 15 minutes & check exhaust temperature",
            ]),
        ),
        m.MaintenancePlan(
            code="PM-0002",
            asset_id=ast_comp.id,
            din_type="servicing",
            title="Compressor 500-Hour Screw Element Service",
            description="Replace intake air filter, sample synthetic oil, inspect minimum pressure valve seals.",
            trigger_type="running_hours",
            interval_hours=500.0,
            next_due_date=date.today() + timedelta(days=12),
            priority="medium",
            estimated_hours=4.0,
            assigned_to=users["tech@cmms.test"].id,
            loto_required=True,
            checklist_template=json.dumps([
                "Isolate 415V electrical feed & verify zero voltage",
                "Bleed compressor sump pressure gauge to 0 bar",
                "Remove and replace air filter cartridge Mann C15",
                "Inspect belt tension with optical frequency meter (rated 58 Hz)",
                "Restore electrical power & log oil pressure at full discharge",
            ]),
        ),
        m.MaintenancePlan(
            code="PM-0003",
            asset_id=ast_cnc.id,
            din_type="inspection",
            title="CNC High-Speed Spindle DIN ISO 230-1 Runout Inspection",
            description="Verify spindle radial & axial runout with 0.001 mm dial indicator, check tool clamp retention force.",
            trigger_type="calendar",
            interval_days=60,
            next_due_date=date.today() + timedelta(days=18),
            priority="high",
            estimated_hours=2.5,
            assigned_to=users["engineer@cmms.test"].id,
            loto_required=False,
            checklist_template=json.dumps([
                "Clean spindle taper with alcohol and wipe test arbor",
                "Mount 300 mm test bar & measure runout at 0 and 300 mm (< 3 µm)",
                "Verify drawbar pull force with hydraulic gauge (> 18 kN)",
                "Inspect chiller coolant flow rate and temperature stability (20°C ± 0.5°C)",
            ]),
        ),
        m.MaintenancePlan(
            code="PM-0004",
            asset_id=ast_press.id,
            din_type="inspection",
            title="Hydraulic Press Annual DIN EN 693 Safety Audit",
            description="Test light curtain stop time, verify dual hydraulic anti-fall valves, ultrasonic pipe inspection.",
            trigger_type="calendar",
            interval_days=365,
            next_due_date=date.today() + timedelta(days=25),
            priority="critical",
            estimated_hours=6.0,
            assigned_to=users["tech@cmms.test"].id,
            loto_required=True,
            checklist_template=json.dumps([
                "Insert mechanical ram locking block and secure padlock",
                "Measure optical light curtain reaction time (< 45 ms)",
                "Verify safety overpressure relief valve cracking pressure (250 bar)",
                "Check foundation anchoring bolts torque (350 Nm)",
            ]),
        ),
    ])
    db.flush()

    # 11. Condition Monitoring Sensor Readings
    db.add_all([
        m.ConditionReading(asset_id=ast_gen.id, metric="vibration", value=2.4, unit="mm/s", threshold_warning=4.5, threshold_critical=7.1, status="normal", recorded_by="Tara Technician", notes="Vibration within ISO 10816 Zone A"),
        m.ConditionReading(asset_id=ast_gen.id, metric="temperature", value=78.5, unit="°C", threshold_warning=92.0, threshold_critical=105.0, status="normal", recorded_by="Tara Technician"),
        m.ConditionReading(asset_id=ast_comp.id, metric="pressure", value=7.4, unit="bar", threshold_warning=6.0, threshold_critical=5.0, status="normal", recorded_by="Tarun Technician"),
        m.ConditionReading(asset_id=ast_comp.id, metric="running_hours", value=1890.0, unit="h", status="normal", recorded_by="Tarun Technician"),
        m.ConditionReading(asset_id=ast_press.id, metric="vibration", value=5.2, unit="mm/s", threshold_warning=4.5, threshold_critical=7.1, status="warning", recorded_by="Tara Technician", notes="Elevated pump pulsation, inspection scheduled"),
        m.ConditionReading(asset_id=ast_cnc.id, metric="temperature", value=22.1, unit="°C", threshold_warning=28.0, threshold_critical=35.0, status="normal", recorded_by="Hans Contractor (Siemens Energy)"),
    ])
    db.flush()

    # 12. Purchase Requests (Procurement)
    db.add_all([
        m.PurchaseRequest(pr_number="PR-2026-0001", part_id=parts["FLT-AIR01"].id, qty=10, estimated_cost=6500.0, vendor="FilterWorld", requested_by=users["tech@cmms.test"].id, status="requested"),
        m.PurchaseRequest(pr_number="PR-2026-0002", part_id=parts["OIL-HYD20"].id, qty=5, estimated_cost=21000.0, vendor="Lubetech", requested_by=users["tech@cmms.test"].id, approved_by=users["manager@cmms.test"].id, status="approved"),
        m.PurchaseRequest(pr_number="PR-2026-0003", part_id=parts["BRG-6205"].id, qty=12, estimated_cost=3000.0, vendor="Sree Bearings", requested_by=users["manager@cmms.test"].id, approved_by=users["manager@cmms.test"].id, status="ordered", ordered_at=now - timedelta(days=2)),
    ])
    db.flush()

    # 13. Historical & Current Work Orders (EN 13306 standard dataset)
    # (asset, type, din_type, title, month, day, hour, down_hours, failure_mode, failure_cause, failure_effect, labour_h, rate, parts_list)
    HISTORY = [
        (ast_gen, "repair", "repair", "Generator fails to start", 1, 8, 9, 6.0, "Failure to start", "Fuel filter blocked / sediment", "Total loss of backup power", 4.0, 500.0, [("FLT-OIL02", 1)]),
        (ast_gen, "scheduled", "servicing", "Monthly generator service", 2, 12, 10, 4.0, "", "", "", 3.0, 500.0, [("FLT-OIL02", 1)]),
        (ast_gen, "scheduled", "servicing", "Monthly generator service", 3, 12, 10, 4.0, "", "", "", 3.0, 500.0, []),
        (ast_gen, "repair", "repair", "Overheating alarm on cylinder bank 1", 5, 20, 14, 9.0, "Engine overheating", "Coolant leak at hose elbow", "Thermal trip during test run", 6.0, 500.0, [("BLT-B52", 1)]),
        (ast_gen, "scheduled", "servicing", "Monthly generator service", 6, 12, 10, 4.0, "", "", "", 3.0, 500.0, [("FLT-OIL02", 1)]),
        (ast_gen, "repair", "repair", "Abnormal noise from alternator bearing", 8, 3, 11, 12.0, "High vibration", "Bearing race spalling / wear", "Rotor runout non-conformance", 8.0, 500.0, [("BRG-6205", 2)]),
        (ast_comp, "scheduled", "servicing", "Compressor quarterly preventive service", 3, 18, 9, 5.0, "", "", "", 4.0, 450.0, [("FLT-AIR01", 1)]),
        (ast_comp, "repair", "repair", "Compressor not building rated pressure", 6, 25, 8, 7.0, "Pressure drop below 6 bar", "Air filter heavily clogged", "Downstream tool starvation", 3.0, 450.0, [("FLT-AIR01", 1)]),
        (ast_forklift, "repair", "repair", "Forklift hydraulic mast lift sluggish", 4, 9, 13, 8.0, "Hydraulic lift slow", "Low hydraulic reservoir level", "Reduced lifting speed", 3.0, 400.0, [("OIL-HYD20", 1)]),
        (ast_forklift, "scheduled", "servicing", "Forklift 250-hour comprehensive service", 7, 15, 9, 5.0, "", "", "", 4.0, 400.0, [("FLT-OIL02", 1), ("BLT-B52", 1)]),
        (ast_cnc, "scheduled", "servicing", "CNC spindle taper cleaning & lubrication", 5, 6, 9, 3.0, "", "", "", 2.0, 600.0, []),
        (ast_cnc, "scheduled", "servicing", "CNC axis alignment verification", 8, 7, 9, 3.0, "", "", "", 2.0, 600.0, []),
        (ast_conveyor, "repair", "repair", "Conveyor belt tracking off-centre", 9, 2, 10, 5.0, "Belt tracking error", "Drive drum roller misaligned", "Edge fraying hazard", 4.0, 400.0, [("BLT-B52", 2)]),
        (ast_press, "repair", "repair", "Press ram stuck at 50% stroke", 7, 28, 15, 10.0, "Hydraulic pressure loss", "Proportional valve spool seized", "Emergency stop trip", 7.0, 550.0, [("OIL-HYD20", 1)]),
    ]

    for idx, (ast, typ, din, title, mo, day, hr, down, mode, cause, effect, lh, rate, plist) in enumerate(HISTORY, start=1):
        start = datetime(year, mo, day, hr)
        end = start + timedelta(hours=down)
        wo = m.Job(
            wo_number=f"WO-{year}-{idx:04d}",
            type=typ,
            din_type=din,
            asset_id=ast.id,
            title=title,
            priority="high" if typ == "repair" else "medium",
            status="completed",
            due_date=start.date(),
            start_time=start,
            end_time=end,
            labour_hours=lh,
            labour_rate=rate,
            breakdown_reason=cause or "Routine planned maintenance",
            failure_mode=mode,
            failure_cause=cause,
            failure_effect=effect,
            action_taken=f"Executed DIN 31051 {din} procedures and verified functional operation.",
            created_by=users["manager@cmms.test"].id,
            assigned_to=users["tech@cmms.test"].id,
            cost_centre_id=ast.cost_centre_id,
            created_at=start - timedelta(days=2),
            loto_required=True,
            loto_signed=True,
            loto_signed_by="Tara Technician",
            loto_signed_at=start,
        )
        db.add(wo)
        db.flush()

        for sku, q in plist:
            p = parts[sku]
            db.add(m.JobPart(job_id=wo.id, part_id=p.id, qty=q, unit_cost=p.unit_cost))

        db.add(m.WorkOrderChecklist(job_id=wo.id, step_number=1, task_description="Inspect component for physical damage or wear", is_mandatory=True, is_completed=True, completed_by="Tara Technician", completed_at=start + timedelta(minutes=30)))
        db.add(m.WorkOrderChecklist(job_id=wo.id, step_number=2, task_description="Perform DIN 31051 compliance checks & functional test", is_mandatory=True, is_completed=True, completed_by="Tara Technician", completed_at=end))

    # 14. Active & In-Progress Work Orders (Kanban demo)
    curr_n = len(HISTORY) + 1

    # In Progress (assigned to Tara Technician, LOTO signed)
    wo_ongoing = m.Job(
        wo_number=f"WO-{year}-{curr_n:04d}",
        type="repair",
        din_type="repair",
        asset_id=ast_press.id,
        title="Hydraulic Press oil leak at cylinder manifold",
        description="Hydraulic fluid dripping from proportional valve O-ring. High pressure line.",
        priority="critical",
        status="in_progress",
        due_date=date.today(),
        start_time=now - timedelta(hours=2),
        estimated_hours=4.0,
        labour_rate=550.0,
        labour_hours=2.0,
        loto_required=True,
        loto_signed=True,
        loto_signed_by="Tara Technician",
        loto_signed_at=now - timedelta(hours=2),
        created_by=users["tech@cmms.test"].id,
        assigned_to=users["tech@cmms.test"].id,
        cost_centre_id=ast_press.cost_centre_id,
        created_at=now - timedelta(hours=3),
    )
    db.add(wo_ongoing)
    db.flush()
    db.add(m.WorkOrderLOTO(job_id=wo_ongoing.id, step_number=1, hazard_description="415V Main Isolator locked and tagged with yellow padlock", loto_type="electrical", verified=True, verified_by="Tara Technician", verified_at=now - timedelta(hours=2)))
    db.add(m.WorkOrderLOTO(job_id=wo_ongoing.id, step_number=2, hazard_description="Hydraulic accumulator depressurized, line gauge 0 bar", loto_type="hydraulic", verified=True, verified_by="Tara Technician", verified_at=now - timedelta(hours=2)))
    db.add(m.WorkOrderChecklist(job_id=wo_ongoing.id, step_number=1, task_description="Depressurize manifold and remove valve block", is_mandatory=True, is_completed=True, completed_by="Tara Technician", completed_at=now - timedelta(hours=1)))
    db.add(m.WorkOrderChecklist(job_id=wo_ongoing.id, step_number=2, task_description="Replace Viton 90 shore O-rings", is_mandatory=True, is_completed=False))
    db.add(m.WorkOrderChecklist(job_id=wo_ongoing.id, step_number=3, task_description="Torque socket head cap screws to 85 Nm", is_mandatory=True, is_completed=False))

    curr_n += 1
    # Waiting for Manager Approval
    wo_pending = m.Job(
        wo_number=f"WO-{year}-{curr_n:04d}",
        type="repair",
        din_type="repair",
        asset_id=ast_comp.id,
        title="Air Compressor pressure drops after 10 minutes run",
        description="Air pressure falls from 7.5 to 5.2 bar under load. Suspected unloader valve spring fatigue.",
        priority="high",
        status="sent_for_approval",
        due_date=date.today() + timedelta(days=2),
        estimated_cost=8500.0,
        estimated_hours=3.0,
        loto_required=True,
        created_by=users["tech@cmms.test"].id,
        assigned_to=users["tech@cmms.test"].id,
        cost_centre_id=ast_comp.cost_centre_id,
        created_at=now - timedelta(hours=4),
    )
    db.add(wo_pending)

    curr_n += 1
    # Contractor Assigned Job (In Review)
    wo_contractor = m.Job(
        wo_number=f"WO-{year}-{curr_n:04d}",
        type="scheduled",
        din_type="inspection",
        asset_id=ast_cnc.id,
        title="CNC 5-Axis Spindle Dynamic Balancing & Laser Interferometry",
        description="Annual precision geometric validation and laser calibration of X/Y/Z axes per ISO 230-2.",
        priority="high",
        status="review",
        due_date=date.today() - timedelta(days=1),
        start_time=now - timedelta(days=1, hours=4),
        end_time=now - timedelta(days=1),
        estimated_hours=6.0,
        labour_hours=6.0,
        contractor_id=users["engineer@cmms.test"].id,
        contractor_invoice_ref="INV-SIEM-9921",
        contractor_invoice_amount=48000.0,
        contractor_notes="Completed laser interferometer calibration. Positional deviation across 500 mm stroke measured at 1.8 µm (tolerance: 3 µm). Report attached.",
        action_taken="Re-leveled bed and updated CNC pitch compensation tables.",
        created_by=users["engineer@cmms.test"].id,
        assigned_to=users["engineer@cmms.test"].id,
        cost_centre_id=ast_cnc.cost_centre_id,
        created_at=now - timedelta(days=5),
        loto_required=False,
    )
    db.add(wo_contractor)
    db.flush()
    db.add(m.WorkOrderChecklist(job_id=wo_contractor.id, step_number=1, task_description="Mount laser interferometer retroreflector", is_mandatory=True, is_completed=True, completed_by="Hans Contractor (Siemens Energy)", completed_at=now - timedelta(days=1, hours=3)))
    db.add(m.WorkOrderChecklist(job_id=wo_contractor.id, step_number=2, task_description="Log ISO 230-2 positioning accuracy chart", is_mandatory=True, is_completed=True, completed_by="Hans Contractor (Siemens Energy)", completed_at=now - timedelta(days=1)))

    curr_n += 1
    # Planned Work Order (Gantt view)
    wo_planned = m.Job(
        wo_number=f"WO-{year}-{curr_n:04d}",
        type="scheduled",
        din_type="servicing",
        asset_id=ast_gen.id,
        title="Diesel Generator semi-annual fuel tank filtration",
        description="Polish 4,000 litre diesel reservoir with mobile centrifugal separator to remove bacterial biomass.",
        priority="medium",
        status="planned",
        due_date=date.today() + timedelta(days=7),
        scheduled_start=now + timedelta(days=7, hours=9),
        scheduled_end=now + timedelta(days=7, hours=15),
        estimated_hours=6.0,
        created_by=users["engineer@cmms.test"].id,
        assigned_to=users["tech@cmms.test"].id,
        cost_centre_id=ast_gen.cost_centre_id,
        created_at=now - timedelta(days=1),
    )
    db.add(wo_planned)

    # 15. Seed Sample Calibrations (Calibration Management Module)
    calibrations_to_seed = [
        m.Calibration(
            asset_id=ast_cnc.id,
            last_calibrated_date=date.today() - timedelta(days=165),
            next_due_date=date.today() + timedelta(days=15),
            calibrated_by="TÜV SÜD Calibration Services",
            certificate_number="CAL-2026-0091",
            standard_used="ISO 230-1 / VDI/DGQ 3441",
            result="pass",
            notes="Full 5-axis linear and volumetric positioning accuracy verified.",
            created_at=now - timedelta(days=165),
        ),
        m.Calibration(
            asset_id=ast_comp.id,
            last_calibrated_date=date.today() - timedelta(days=350),
            next_due_date=date.today() + timedelta(days=8),
            calibrated_by="Atlas Copco Certified Metrology",
            certificate_number="CAL-2026-0012",
            standard_used="ISO 1217 / DIN 1945",
            result="conditional",
            notes="Recalibrate pressure transducer after valve overhaul. Drift noted at 7.5 bar.",
            created_at=now - timedelta(days=350),
        ),
        m.Calibration(
            asset_id=ast_gen.id,
            last_calibrated_date=date.today() - timedelta(days=90),
            next_due_date=date.today() + timedelta(days=275),
            calibrated_by="DEKRA Metrology GmbH",
            certificate_number="CAL-2026-0044",
            standard_used="DIN EN ISO 7500-1",
            result="pass",
            notes="Governor frequency and voltage regulation within ±0.5% tolerance.",
            created_at=now - timedelta(days=90),
        ),
    ]
    db.add_all(calibrations_to_seed)

    # Assign utility types to sample assets
    ast_comp.utility_type = "compressor"
    ast_gen.utility_type = "generator"

    # 16. Initial Audit Entries
    db.add(m.AuditLog(user_name="Anita Manager", action="seed_database", entity="system", detail="Initialized Enterprise CMMS DIN 31051 baseline"))
    db.commit()
