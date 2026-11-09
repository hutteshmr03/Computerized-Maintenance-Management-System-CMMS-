from datetime import datetime, date
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Date, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from .db import Base, utcnow

VALID_ROLES = (
    "super_admin",
    "plant_head",
    "maintenance_manager",
    "maintenance_engineer",
    "technician",
    "store_manager",
    "production_manager",
    "purchase_manager",
    "auditor",
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('super_admin', 'plant_head', 'maintenance_manager', 'maintenance_engineer', "
            "'technician', 'store_manager', 'production_manager', 'purchase_manager', 'auditor')",
            name="check_valid_user_role",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    # Exactly 9 HR roles: super_admin, plant_head, maintenance_manager, maintenance_engineer, technician, store_manager, production_manager, purchase_manager, auditor
    role: Mapped[str] = mapped_column(String(30))
    contractor_company: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    @validates("role")
    def validate_role(self, key, value):
        if value not in VALID_ROLES:
            raise ValueError(f"Invalid role: {value}. Allowed roles are: {', '.join(VALID_ROLES)}")
        return value


class CostCentre(Base):
    __tablename__ = "cost_centres"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    budget_annual: Mapped[float] = mapped_column(Float, default=0.0)
    budget_spent: Mapped[float] = mapped_column(Float, default=0.0)


class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Asset(Base):
    """
    Asset hierarchy node compliant with ISO 55001.
    Tiers: site -> location -> system -> asset -> component (tree structure)
    Criticality: A (Critical/High risk), B (Important/Medium), C (Low risk/Run-to-failure)
    """
    __tablename__ = "assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(140))
    tier: Mapped[str] = mapped_column(String(20), default="asset")  # site | location | system | asset | component
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    criticality: Mapped[str] = mapped_column(String(5), default="B")  # A | B | C
    category: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(20), default="operational")  # operational | degraded | in_maintenance | decommissioned
    is_movable: Mapped[bool] = mapped_column(Boolean, default=False)
    under_warranty: Mapped[bool] = mapped_column(Boolean, default=False)
    replacement_value: Mapped[float] = mapped_column(Float, default=0.0)
    install_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_life_years: Mapped[int] = mapped_column(Integer, default=10)
    serial_number: Mapped[str] = mapped_column(String(80), default="")
    manufacturer: Mapped[str] = mapped_column(String(100), default="")
    running_hours: Mapped[float] = mapped_column(Float, default=0.0)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), default=1)
    location: Mapped[Location] = relationship()
    cost_centre_id: Mapped[int | None] = mapped_column(ForeignKey("cost_centres.id"), nullable=True)
    cost_centre: Mapped[CostCentre | None] = relationship()
    # Utility type enum: compressor | boiler | chiller | generator | other | None
    utility_type: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    parent: Mapped["Asset | None"] = relationship("Asset", remote_side=[id], back_populates="children")
    children: Mapped[list["Asset"]] = relationship("Asset", back_populates="parent", cascade="all, delete-orphan")
    documents: Mapped[list["AssetDocument"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    boms: Mapped[list["BOMItem"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    readings: Mapped[list["ConditionReading"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    calibrations: Mapped[list["Calibration"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class AssetDocument(Base):
    """Document management for manuals, CE certificates, calibration records per asset."""
    __tablename__ = "asset_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship(back_populates="documents")
    title: Mapped[str] = mapped_column(String(160))
    doc_type: Mapped[str] = mapped_column(String(40))  # manual | ce_certificate | calibration | schematic | report
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    filename: Mapped[str] = mapped_column(String(250))
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[str] = mapped_column(String(100), default="system")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str] = mapped_column(Text, default="")


class Contract(Base):
    """Warranty & SLA service contracts linked to assets."""
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship(back_populates="contracts")
    vendor_name: Mapped[str] = mapped_column(String(120))
    contract_type: Mapped[str] = mapped_column(String(40))  # warranty | service_sla | preventive_sla
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    sla_response_hours: Mapped[float] = mapped_column(Float, default=4.0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    terms: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | expired | warning
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FailureCode(Base):
    """ISO 14224 failure code library (failure mode, cause, effect per asset category)."""
    __tablename__ = "failure_codes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    asset_category: Mapped[str] = mapped_column(String(80))
    failure_mode: Mapped[str] = mapped_column(String(120))
    failure_cause: Mapped[str] = mapped_column(String(160))
    failure_effect: Mapped[str] = mapped_column(String(160))
    detection_method: Mapped[str] = mapped_column(String(100), default="Inspection")


class MaintenancePlan(Base):
    """
    Multi-trigger maintenance plan (DIN 31051).
    Triggers: calendar interval | running hours | condition threshold | event.
    Auto-generates work orders on due threshold.
    """
    __tablename__ = "maintenance_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship()
    # DIN 31051 Activity: inspection | servicing | repair | improvement
    din_type: Mapped[str] = mapped_column(String(20), default="servicing")
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    # Trigger: calendar | running_hours | condition | event
    trigger_type: Mapped[str] = mapped_column(String(30), default="calendar")
    interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interval_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    condition_metric: Mapped[str | None] = mapped_column(String(50), nullable=True)
    condition_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_performed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_reading_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    estimated_hours: Mapped[float] = mapped_column(Float, default=2.0)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    loto_required: Mapped[bool] = mapped_column(Boolean, default=False)
    checklist_template: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of task descriptions
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ConditionReading(Base):
    """Condition monitoring manual or sensor readings."""
    __tablename__ = "condition_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship(back_populates="readings")
    metric: Mapped[str] = mapped_column(String(50))  # vibration | temperature | pressure | running_hours | oil_level
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))
    threshold_warning: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_critical: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="normal")  # normal | warning | critical
    recorded_by: Mapped[str] = mapped_column(String(100), default="Technician")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str] = mapped_column(String(200), default="")


class LocationHistory(Base):
    __tablename__ = "location_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    from_location: Mapped[str] = mapped_column(String(100), default="")
    to_location: Mapped[str] = mapped_column(String(100))
    moved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Transfer(Base):
    __tablename__ = "transfers"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship()
    to_location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    to_location: Mapped[Location] = relationship()
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SparePart(Base):
    __tablename__ = "spare_parts"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_level: Mapped[int] = mapped_column(Integer, default=0)
    max_level: Mapped[int] = mapped_column(Integer, default=0)
    vendor: Mapped[str] = mapped_column(String(120), default="")
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    location_bin: Mapped[str] = mapped_column(String(40), default="Warehouse A-1")


class BOMItem(Base):
    """Bill of Materials linking SpareParts to an Asset node."""
    __tablename__ = "bom_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship(back_populates="boms")
    part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    part: Mapped[SparePart] = relationship()
    qty_recommended: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str] = mapped_column(String(200), default="")


class PurchaseRequest(Base):
    """Procurement workflow: reorder -> purchase request -> approval -> ordered -> received."""
    __tablename__ = "purchase_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    pr_number: Mapped[str] = mapped_column(String(30), unique=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    part: Mapped[SparePart] = relationship()
    qty: Mapped[int] = mapped_column(Integer, default=1)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    vendor: Mapped[str] = mapped_column(String(120), default="")
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="requested")  # requested | approved | ordered | received | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Job(Base):
    """
    Work Order model compliant with DIN 31051 and EN 13306.
    Lifecycle: created -> planned -> approved -> in_progress -> review -> closed
    """
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    wo_number: Mapped[str] = mapped_column(String(30), unique=True, default="")
    # DIN 31051 activity: inspection | servicing | repair | improvement
    din_type: Mapped[str] = mapped_column(String(20), default="repair")
    type: Mapped[str] = mapped_column(String(20), default="repair")  # backwards compatible: repair | scheduled | condition | improvement
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    asset: Mapped[Asset] = relationship()
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("maintenance_plans.id"), nullable=True)
    cost_centre_id: Mapped[int | None] = mapped_column(ForeignKey("cost_centres.id"), nullable=True)
    cost_centre: Mapped[CostCentre | None] = relationship()
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # low | medium | high | critical
    # Lifecycle: created -> planned -> approved -> in_progress -> review -> closed (plus rejected, cancelled)
    status: Mapped[str] = mapped_column(String(20), default="created")

    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    estimated_hours: Mapped[float] = mapped_column(Float, default=2.0)
    labour_hours: Mapped[float] = mapped_column(Float, default=0.0)
    labour_rate: Mapped[float] = mapped_column(Float, default=0.0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ISO 14224 failure data (mandatory for completed repairs)
    breakdown_reason: Mapped[str] = mapped_column(String(160), default="")
    failure_mode: Mapped[str] = mapped_column(String(120), default="")
    failure_cause: Mapped[str] = mapped_column(String(160), default="")
    failure_effect: Mapped[str] = mapped_column(String(160), default="")
    failure_code_id: Mapped[int | None] = mapped_column(ForeignKey("failure_codes.id"), nullable=True)
    action_taken: Mapped[str] = mapped_column(Text, default="")
    rejection_reason: Mapped[str] = mapped_column(Text, default="")

    # Safety LOTO permit
    loto_required: Mapped[bool] = mapped_column(Boolean, default=False)
    loto_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    loto_signed_by: Mapped[str] = mapped_column(String(100), default="")
    loto_signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Contractor assignment
    contractor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    contractor_invoice_ref: Mapped[str] = mapped_column(String(80), default="")
    contractor_invoice_amount: Mapped[float] = mapped_column(Float, default=0.0)
    contractor_notes: Mapped[str] = mapped_column(Text, default="")

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    warranty_at_creation: Mapped[bool] = mapped_column(Boolean, default=False)
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    parts: Mapped[list["JobPart"]] = relationship(cascade="all, delete-orphan")
    photos: Mapped[list["JobPhoto"]] = relationship(cascade="all, delete-orphan")
    checklists: Mapped[list["WorkOrderChecklist"]] = relationship(cascade="all, delete-orphan")
    loto_steps: Mapped[list["WorkOrderLOTO"]] = relationship(cascade="all, delete-orphan")


class WorkOrderChecklist(Base):
    """Digital step-by-step checklist task for work orders."""
    __tablename__ = "work_order_checklists"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    step_number: Mapped[int] = mapped_column(Integer, default=1)
    task_description: Mapped[str] = mapped_column(String(250))
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_by: Mapped[str] = mapped_column(String(100), default="")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str] = mapped_column(String(200), default="")


class WorkOrderLOTO(Base):
    """Mandatory safety Permit to Work / Lockout-Tagout sign-off."""
    __tablename__ = "work_order_loto"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    step_number: Mapped[int] = mapped_column(Integer, default=1)
    hazard_description: Mapped[str] = mapped_column(String(250))
    # Hazard types: electrical | hydraulic | pneumatic | thermal | chemical | mechanical | ppe
    loto_type: Mapped[str] = mapped_column(String(30), default="electrical")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[str] = mapped_column(String(100), default="")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class JobPart(Base):
    __tablename__ = "job_parts"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    part: Mapped[SparePart] = relationship()
    qty: Mapped[int] = mapped_column(Integer)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)


class JobPhoto(Base):
    __tablename__ = "job_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    filename: Mapped[str] = mapped_column(String(200))
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    """Immutable audit trail compliant with ISO 55001 (stores before & after JSON states)."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    user_name: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    before_state: Mapped[str] = mapped_column(Text, default="")
    after_state: Mapped[str] = mapped_column(Text, default="")
    detail: Mapped[str] = mapped_column(Text, default="")


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str] = mapped_column(String(300))
    link: Mapped[str] = mapped_column(String(100), default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

class Calibration(Base):
    """
    Calibration management module.
    Tracks instrument/asset calibration, certificates, standards, pass/fail/conditional results, and due dates.
    """
    __tablename__ = "calibrations"
    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    asset: Mapped[Asset] = relationship(back_populates="calibrations")
    last_calibrated_date: Mapped[date] = mapped_column(Date)
    next_due_date: Mapped[date] = mapped_column(Date)
    calibrated_by: Mapped[str] = mapped_column(String(120))
    certificate_number: Mapped[str] = mapped_column(String(80))
    standard_used: Mapped[str | None] = mapped_column(String(120), nullable=True, default=None)
    result: Mapped[str] = mapped_column(String(30))  # pass | fail | conditional
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
