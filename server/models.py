# models.py - Fixed UUID for Postgres with Soft Delete (ADDED RESET TOKEN FIELDS)
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from datetime import datetime
from database import Base

class ScanStatus:
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"
    
    id = Column(PG_UUID, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    
    # ✅ FORGOT PASSWORD FIELDS (ADD THESE)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

class SecurityScan(Base):
    __tablename__ = "security_scans"
    
    id = Column(PG_UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target = Column(String(500), nullable=False)
    scan_status = Column(String(50), default=ScanStatus.QUEUED)
    risk_score = Column(Integer, nullable=True)
    findings = Column(JSON, default=list)
    findings_count = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    ai_analysis = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # ✅ Soft Delete Fields
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(PG_UUID, ForeignKey("users.id"), nullable=True)
    deletion_reason = Column(String(255), nullable=True)

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(PG_UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scan_id = Column(PG_UUID, ForeignKey("security_scans.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), default="active")
    source_ip = Column(String(45), nullable=True)
    source_type = Column(String(50), nullable=True)
    rule_id = Column(String(100), nullable=True)
    affected_user_id = Column(PG_UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ai_insight = Column(JSON, nullable=True)
    ai_confidence = Column(Integer, default=0)
    ai_model_version = Column(String(50), nullable=True)
    mitre_tactic = Column(String(100), nullable=True)
    mitre_technique = Column(String(100), nullable=True)
    mitre_id = Column(String(50), nullable=True)
    cve_ids = Column(JSON, default=list)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(PG_UUID, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SecurityLog(Base):
    __tablename__ = "security_logs"
    
    id = Column(PG_UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(PG_UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(10), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    permissions = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)