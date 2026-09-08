import pytest
import json
import httpx
from fastapi.testclient import TestClient

from app.parser.spec_parser import SpecParser
from app.generator.test_generator import TestGenerator, GeneratedTestCase, MockDataGenerator
from app.engine.comparator import ResponseComparator
from app.schemas.test_run import TestAccount
from app.main import app as apisentry_app
from demo_target.app import demo_app

SAMPLE_OPENAPI_SPEC = {
    "openapi": "3.0.0",
    "info": {
        "title": "Sample E-Commerce API",
        "version": "1.0.0"
    },
    "paths": {
        "/api/v1/users/{user_id}": {
            "get": {
                "summary": "Get user by ID",
                "parameters": [
                    {
                        "name": "user_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User found",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/User"}
                            }
                        }
                    },
                    "404": {
                        "description": "Not found"
                    }
                }
            }
        },
        "/api/v1/invoices/{invoice_id}": {
            "get": {
                "summary": "Get invoice by ID",
                "parameters": [
                    {
                        "name": "invoice_id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Invoice details",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/Invoice"}
                            }
                        }
                    }
                }
            }
        },
        "/api/v1/users": {
            "post": {
                "summary": "Create user",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/UserCreate"}
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "User created",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/User"}
                            }
                        }
                    }
                }
            }
        }
    },
    "components": {
        "schemas": {
            "User": {
                "type": "object",
                "required": ["id", "username", "email"],
                "properties": {
                    "id": {"type": "integer"},
                    "username": {"type": "string"},
                    "email": {"type": "string", "format": "email"}
                },
                "additionalProperties": False
            },
            "UserCreate": {
                "type": "object",
                "required": ["username", "email"],
                "properties": {
                    "username": {"type": "string"},
                    "email": {"type": "string", "format": "email"}
                }
            },
            "Invoice": {
                "type": "object",
                "required": ["id", "owner_id", "amount"],
                "properties": {
                    "id": {"type": "integer"},
                    "owner_id": {"type": "integer"},
                    "amount": {"type": "number"},
                    "status": {"type": "string"}
                }
            }
        }
    }
}


def test_spec_parser_dereferences_refs():
    raw_json = json.dumps(SAMPLE_OPENAPI_SPEC)
    parser = SpecParser(raw_json)
    parsed = parser.parse()

    assert parsed.title == "Sample E-Commerce API"
    assert parsed.version == "1.0.0"
    assert len(parsed.endpoints) == 3

    # Verify $ref resolution for /api/v1/users/{user_id}
    user_endpoint = next(e for e in parsed.endpoints if e.path == "/api/v1/users/{user_id}")
    assert user_endpoint.method == "GET"
    assert "200" in user_endpoint.responses
    resolved_schema = user_endpoint.responses["200"].schema
    assert resolved_schema is not None
    assert "$ref" not in resolved_schema
    assert "username" in resolved_schema["properties"]


def test_test_generator_cases():
    parser = SpecParser(json.dumps(SAMPLE_OPENAPI_SPEC))
    parsed = parser.parse()

    account_a = TestAccount(
        name="Tenant A",
        headers={"Authorization": "Bearer token_a"},
        resource_ids={"user_id": 1, "invoice_id": 101}
    )
    account_b = TestAccount(
        name="Tenant B",
        headers={"Authorization": "Bearer token_b"},
        resource_ids={"user_id": 2, "invoice_id": 102}
    )

    generator = TestGenerator(parsed, account_a=account_a, account_b=account_b)
    tests = generator.generate_all_tests()

    assert len(tests) > 0

    # Ensure Data Isolation test was generated for invoice_id and user_id
    isolation_tests = [t for t in tests if t.test_category == "DATA_ISOLATION"]
    assert len(isolation_tests) >= 2
    for it in isolation_tests:
        assert it.severity == "CRITICAL"
        assert it.headers["Authorization"] == "Bearer token_b"

    # Ensure Schema Conformance tests exist
    conformance_tests = [t for t in tests if t.test_category == "SCHEMA_CONFORMANCE"]
    assert len(conformance_tests) == 3

    # Ensure Type Validation tests exist
    type_tests = [t for t in tests if t.test_category == "INPUT_VALIDATION"]
    assert len(type_tests) >= 1

    # Ensure Undeclared Fields test exists for POST /api/v1/users
    extra_field_tests = [t for t in tests if t.test_category == "UNDECLARED_FIELDS"]
    assert len(extra_field_tests) == 1


def test_comparator_schema_conformance():
    schema = {
        "type": "object",
        "required": ["id", "username", "email"],
        "properties": {
            "id": {"type": "integer"},
            "username": {"type": "string"},
            "email": {"type": "string"}
        },
        "additionalProperties": False
    }

    test_case = GeneratedTestCase(
        test_name="Schema Test",
        test_category="SCHEMA_CONFORMANCE",
        severity="HIGH",
        description="test",
        endpoint_path="/users/1",
        http_method="GET",
        metadata={"declared_responses": {"200": schema}}
    )

    # 1. Valid conforming response -> PASS
    eval_pass = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=200,
        headers={"Content-Type": "application/json"},
        body={"id": 1, "username": "alice", "email": "alice@example.com"}
    )
    assert eval_pass.status == "PASS"

    # 2. Schema violation (wrong type: id is string instead of integer) -> FAIL
    eval_fail = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=200,
        headers={"Content-Type": "application/json"},
        body={"id": "not_an_int", "username": "alice", "email": "alice@example.com"}
    )
    assert eval_fail.status == "FAIL"
    assert any("id" in r for r in eval_fail.failure_reasons)

    # 3. Schema drift (undeclared extra fields when additionalProperties is False) -> FAIL
    eval_drift = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=200,
        headers={"Content-Type": "application/json"},
        body={"id": 1, "username": "alice", "email": "alice@example.com", "secret_token": "xyz123"}
    )
    assert eval_drift.status == "FAIL"
    assert any("Schema Drift" in r for r in eval_drift.failure_reasons)


def test_comparator_data_isolation():
    test_case = GeneratedTestCase(
        test_name="Isolation Test",
        test_category="DATA_ISOLATION",
        severity="CRITICAL",
        description="Verify Account B cannot read Account A resource",
        endpoint_path="/invoices/101",
        http_method="GET",
        metadata={
            "target_resource_key": "invoice_id",
            "target_resource_value": "101",
            "requesting_account": "Account B"
        }
    )

    # 1. Server protected resource with 403 Forbidden -> PASS
    eval_pass = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=403,
        headers={},
        body={"detail": "Forbidden"}
    )
    assert eval_pass.status == "PASS"

    # 2. Server returned Account A's data with 200 OK -> CRITICAL FAIL
    eval_fail = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=200,
        headers={"Content-Type": "application/json"},
        body={"id": 101, "owner_id": 1, "amount": 250.0}
    )
    assert eval_fail.status == "FAIL"
    assert eval_fail.severity == "CRITICAL"
    assert any("Multi-Tenant Isolation Failure" in r for r in eval_fail.failure_reasons)


def test_comparator_unhandled_server_crash():
    test_case = GeneratedTestCase(
        test_name="Crash Test",
        test_category="INPUT_VALIDATION",
        severity="HIGH",
        description="test crash",
        endpoint_path="/metrics",
        http_method="GET"
    )

    eval_crash = ResponseComparator.evaluate(
        test_case=test_case,
        status_code=500,
        headers={},
        body="Internal Server Error: ZeroDivisionError"
    )
    assert eval_crash.status == "FAIL"
    assert eval_crash.severity == "HIGH"
    assert any("500" in r for r in eval_crash.failure_reasons)


def test_fastapi_endpoints():
    client = TestClient(apisentry_app)

    # Health check
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    # Create Test Run
    run_payload = {
        "target_base_url": "http://testserver",
        "spec_content": json.dumps(SAMPLE_OPENAPI_SPEC),
        "account_a": {
            "name": "User 1",
            "headers": {"Authorization": "Bearer token1"},
            "resource_ids": {"user_id": 1, "invoice_id": 101}
        },
        "account_b": {
            "name": "User 2",
            "headers": {"Authorization": "Bearer token2"},
            "resource_ids": {"user_id": 2, "invoice_id": 102}
        }
    }

    create_resp = client.post("/api/v1/testrun", json=run_payload)
    assert create_resp.status_code == 201
    run_data = create_resp.json()
    assert "id" in run_data
    run_id = run_data["id"]

    # Query Test Run
    get_resp = client.get(f"/api/v1/testruns/{run_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == run_id

    # Query History
    hist_resp = client.get("/api/v1/history")
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()) >= 1


@pytest.mark.asyncio
async def test_runner_live_suite_with_demo_app():
    from app.db.database import SessionLocal
    from app.db.models import TestRun, TestResult
    from app.engine.runner import TestRunner

    db = SessionLocal()
    run = TestRun(target_base_url="http://testserver", status="PENDING")
    db.add(run)
    db.commit()
    db.refresh(run)

    demo_spec = demo_app.openapi()
    account_a = TestAccount(
        name="Alice",
        headers={"Authorization": "Bearer alice_token"},
        resource_ids={"user_id": 1, "invoice_id": 101}
    )
    account_b = TestAccount(
        name="Bob",
        headers={"Authorization": "Bearer bob_token"},
        resource_ids={"user_id": 2, "invoice_id": 102}
    )

    transport = httpx.ASGITransport(app=demo_app)
    await TestRunner.run_suite(
        test_run_id=run.id,
        target_base_url="http://testserver",
        spec_content=json.dumps(demo_spec),
        account_a=account_a,
        account_b=account_b,
        transport=transport
    )

    db.refresh(run)
    assert run.status == "COMPLETED"
    assert run.total_tests > 0
    assert run.completed_at is not None

    results = db.query(TestResult).filter(TestResult.test_run_id == run.id).all()
    assert len(results) == run.total_tests

    # Verify that the multi-tenant data isolation flaw on /api/v1/invoices/{invoice_id} was identified
    isolation_fails = [
        r for r in results 
        if r.test_category == "DATA_ISOLATION" and "invoices" in r.endpoint_path and r.status == "FAIL"
    ]
    assert len(isolation_fails) >= 1
    assert isolation_fails[0].severity == "CRITICAL"

    # Verify report endpoint
    client = TestClient(apisentry_app)
    rep_resp = client.get(f"/api/v1/reports/{run.id}")
    assert rep_resp.status_code == 200
    rep_data = rep_resp.json()
    assert rep_data["id"] == run.id
    assert "DATA_ISOLATION" in rep_data["category_breakdown"]
    assert rep_data["severity_breakdown"]["CRITICAL"] >= 1
    db.close()

