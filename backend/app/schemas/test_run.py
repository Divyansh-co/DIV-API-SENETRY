from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class TestAccount(BaseModel):
    __test__ = False
    name: Optional[str] = "User"
    headers: Dict[str, str] = Field(default_factory=dict)
    resource_ids: Dict[str, Any] = Field(default_factory=dict)

class TestRunCreateRequest(BaseModel):
    target_base_url: str = Field(..., description="Base URL of the target API, e.g. http://localhost:8000")
    spec_content: Optional[str] = Field(None, description="OpenAPI specification in JSON or YAML string")
    spec_url: Optional[str] = Field(None, description="URL to fetch OpenAPI specification from")
    account_a: Optional[TestAccount] = Field(None, description="Primary test account configuration")
    account_b: Optional[TestAccount] = Field(None, description="Secondary test account for data isolation checks")

class TestResultResponse(BaseModel):
    id: str
    test_run_id: str
    endpoint_path: str
    http_method: str
    test_category: str
    test_name: str
    description: str
    status: str
    severity: str
    status_code_received: Optional[int] = None
    duration_ms: Optional[float] = None
    request_data: Optional[Dict[str, Any]] = None
    response_data: Optional[Dict[str, Any]] = None
    failure_reasons: Optional[List[str]] = None
    remediation_hint: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TestRunResponse(BaseModel):
    id: str
    target_base_url: str
    spec_title: Optional[str] = None
    spec_version: Optional[str] = None
    status: str
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    warning_tests: int = 0
    compliance_score: float = 100.0
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TestRunDetailResponse(TestRunResponse):
    results: List[TestResultResponse] = []

class CategoryStat(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0
    warning: int = 0

class ReportSummaryResponse(BaseModel):
    id: str
    target_base_url: str
    spec_title: Optional[str] = None
    spec_version: Optional[str] = None
    status: str
    compliance_score: float
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_tests: int
    passed_tests: int
    failed_tests: int
    warning_tests: int
    category_breakdown: Dict[str, CategoryStat]
    severity_breakdown: Dict[str, int]
    top_findings: List[TestResultResponse]
