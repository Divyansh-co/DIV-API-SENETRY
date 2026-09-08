import pytest
import json
import httpx
from pathlib import Path
import sys

# Ensure backend and sample-api are on sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
sample_api_dir = root_dir / "sample-api" / "app"
backend_dir = root_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(sample_api_dir) not in sys.path:
    sys.path.insert(0, str(sample_api_dir))

from app.db.database import SessionLocal, init_db
from app.db.models import TestRun, TestResult
from app.engine.runner import TestRunner
from app.schemas.test_run import TestAccount
from main import app as sample_api_app

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

@pytest.mark.asyncio
async def test_sample_api_intentional_flaws_detection():
    """
    Executes APISentry's contract test engine against the sample-api fixture
    and asserts that all known intentional discrepancies and isolation bugs are detected.
    """
    db = SessionLocal()
    run = TestRun(target_base_url="http://sample-api:8001", status="PENDING")
    db.add(run)
    db.commit()
    db.refresh(run)

    # Ingest sample-api's OpenAPI schema
    spec_dict = sample_api_app.openapi()
    spec_json = json.dumps(spec_dict)

    # Define Account A and Account B test credentials
    account_a = TestAccount(
        name="Tenant A (Alice)",
        headers={"Authorization": "Bearer alice_token_secret_1"},
        resource_ids={"user_id": 1, "order_id": 101, "account_id": 1}
    )
    account_b = TestAccount(
        name="Tenant B (Bob)",
        headers={"Authorization": "Bearer bob_token_secret_2"},
        resource_ids={"user_id": 2, "order_id": 102, "account_id": 2}
    )

    transport = httpx.ASGITransport(app=sample_api_app)

    # Execute APISentry test runner against sample-api
    await TestRunner.run_suite(
        test_run_id=run.id,
        target_base_url="http://sample-api:8001",
        spec_content=spec_json,
        account_a=account_a,
        account_b=account_b,
        transport=transport
    )

    db.refresh(run)
    assert run.status == "COMPLETED"
    assert run.total_tests >= 5
    assert run.completed_at is not None

    results = db.query(TestResult).filter(TestResult.test_run_id == run.id).all()
    assert len(results) == run.total_tests

    # --- Assertion 1: Multi-Tenant Data Isolation Flaw on /api/v1/orders/{order_id} ---
    isolation_failures = [
        r for r in results
        if r.test_category == "DATA_ISOLATION" and "orders" in r.endpoint_path and r.status == "FAIL"
    ]
    assert len(isolation_failures) >= 1, "Expected Data Isolation failure on /orders/{order_id} not detected!"
    assert isolation_failures[0].severity == "CRITICAL"
    reasons = json.loads(isolation_failures[0].failure_reasons)
    assert any("Multi-Tenant Isolation Failure" in reason for reason in reasons)

    # --- Assertion 2: Schema Drift & Extra Fields on /api/v1/accounts/{account_id}/profile ---
    profile_schema_findings = [
        r for r in results
        if "profile" in r.endpoint_path
    ]
    assert len(profile_schema_findings) >= 1, "Expected profile endpoint evaluations to exist!"

    # --- Assertion 3: Unhandled 500 Crash on /api/v1/reports/summary ---
    crash_failures = [
        r for r in results
        if "reports/summary" in r.endpoint_path and r.test_category == "INPUT_VALIDATION" and r.status == "FAIL"
    ]
    assert len(crash_failures) >= 1, "Expected unhandled crash failure on invalid input not detected!"
    assert crash_failures[0].status_code_received == 500

    # --- Assertion 4: Rate-Limiting Headers on /api/v1/system/status ---
    rate_limit_checks = [
        r for r in results
        if "system/status" in r.endpoint_path and r.test_category == "RATE_LIMIT_CHECK"
    ]
    assert len(rate_limit_checks) >= 1
    assert rate_limit_checks[0].status == "PASS"

    db.close()
