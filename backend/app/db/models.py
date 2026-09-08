import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class TestRun(Base):
    __test__ = False
    __tablename__ = "test_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    target_base_url = Column(String(500), nullable=False)
    spec_title = Column(String(200), nullable=True)
    spec_version = Column(String(50), nullable=True)
    status = Column(String(50), default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    warning_tests = Column(Integer, default=0)
    compliance_score = Column(Float, default=100.0)

    started_at = Column(DateTime, default=get_utc_now)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    results = relationship("TestResult", back_populates="test_run", cascade="all, delete-orphan")


class TestResult(Base):
    __test__ = False
    __tablename__ = "test_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_run_id = Column(String(36), ForeignKey("test_runs.id"), nullable=False)
    
    endpoint_path = Column(String(500), nullable=False)
    http_method = Column(String(10), nullable=False)
    test_category = Column(String(100), nullable=False)
    test_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    
    status = Column(String(20), nullable=False)  # PASS, FAIL, WARNING
    severity = Column(String(20), default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    
    status_code_received = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    
    request_data = Column(Text, nullable=True)  # JSON-encoded string
    response_data = Column(Text, nullable=True)  # JSON-encoded string
    failure_reasons = Column(Text, nullable=True)  # JSON-encoded list of issues
    remediation_hint = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=get_utc_now)

    test_run = relationship("TestRun", back_populates="results")
