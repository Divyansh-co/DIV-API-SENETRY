import time
import json
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.db.database import SessionLocal
from app.db.models import TestRun, TestResult
from app.parser.spec_parser import SpecParser
from app.generator.test_generator import TestGenerator, GeneratedTestCase
from app.engine.comparator import ResponseComparator
from app.schemas.test_run import TestAccount
from app.core.config import settings

class TestRunner:
    __test__ = False
    """Orchestrates test case execution against a target API and records results."""

    @staticmethod
    async def run_suite(
        test_run_id: str,
        target_base_url: str,
        spec_content: str,
        account_a: Optional[TestAccount] = None,
        account_b: Optional[TestAccount] = None,
        transport: Optional[httpx.BaseTransport] = None
    ):
        db = SessionLocal()
        test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not test_run:
            db.close()
            return

        try:
            test_run.status = "RUNNING"
            db.commit()

            # 1. Parse OpenAPI Spec
            parser = SpecParser(spec_content)
            parsed_spec = parser.parse()

            test_run.spec_title = parsed_spec.title
            test_run.spec_version = parsed_spec.version
            db.commit()

            # 2. Generate Test Cases
            generator = TestGenerator(parsed_spec, account_a=account_a, account_b=account_b)
            generated_tests = generator.generate_all_tests()

            test_run.total_tests = len(generated_tests)
            db.commit()

            passed_count = 0
            failed_count = 0
            warning_count = 0

            # 3. Execute Tests
            target_url = target_base_url.rstrip("/")
            client_kwargs = {
                "base_url": target_url,
                "timeout": settings.DEFAULT_TIMEOUT_SECONDS,
                "verify": False
            }
            if transport is not None:
                client_kwargs["transport"] = transport

            async with httpx.AsyncClient(**client_kwargs) as client:
                for tc in generated_tests:
                    # Construct URL path with path parameters
                    resolved_path = tc.endpoint_path
                    for param_name, param_val in tc.path_params.items():
                        resolved_path = resolved_path.replace(f"{{{param_name}}}", str(param_val))

                    # Ensure headers dictionary
                    request_headers = dict(tc.headers)
                    if tc.body is not None and "content-type" not in {k.lower(): v for k, v in request_headers.items()}:
                        request_headers["Content-Type"] = "application/json"

                    start_time = time.perf_counter()
                    resp_status = None
                    resp_headers = {}
                    resp_body = None
                    error_msg = None

                    try:
                        resp = await client.request(
                            method=tc.http_method,
                            url=resolved_path,
                            params=tc.query_params or None,
                            headers=request_headers,
                            json=tc.body if tc.body is not None else None
                        )
                        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                        resp_status = resp.status_code
                        resp_headers = dict(resp.headers)
                        try:
                            resp_body = resp.json()
                        except Exception:
                            resp_body = resp.text
                    except httpx.RequestError as exc:
                        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                        error_msg = f"Network/Connection error communicating with target: {str(exc)}"

                    # 4. Evaluate Response
                    if error_msg:
                        status = "FAIL"
                        severity = tc.severity
                        failure_reasons = [error_msg]
                        remediation_hint = "Ensure target API server is running and reachable at target_base_url."
                    else:
                        eval_res = ResponseComparator.evaluate(
                            test_case=tc,
                            status_code=resp_status,
                            headers=resp_headers,
                            body=resp_body
                        )
                        status = eval_res.status
                        severity = eval_res.severity
                        failure_reasons = eval_res.failure_reasons
                        remediation_hint = eval_res.remediation_hint

                    if status == "PASS":
                        passed_count += 1
                    elif status == "FAIL":
                        failed_count += 1
                    else:
                        warning_count += 1

                    # 5. Persist Test Result
                    result_record = TestResult(
                        test_run_id=test_run_id,
                        endpoint_path=tc.endpoint_path,
                        http_method=tc.http_method,
                        test_category=tc.test_category,
                        test_name=tc.test_name,
                        description=tc.description,
                        status=status,
                        severity=severity,
                        status_code_received=resp_status,
                        duration_ms=duration_ms,
                        request_data=json.dumps({
                            "url": f"{target_url}{resolved_path}",
                            "method": tc.http_method,
                            "headers": {k: (v if "auth" not in k.lower() else "Bearer ***") for k, v in request_headers.items()},
                            "params": tc.query_params,
                            "body": tc.body
                        }),
                        response_data=json.dumps({
                            "status_code": resp_status,
                            "headers": resp_headers,
                            "body": resp_body
                        }),
                        failure_reasons=json.dumps(failure_reasons) if failure_reasons else None,
                        remediation_hint=remediation_hint
                    )
                    db.add(result_record)

                    # Update live counts on TestRun
                    test_run.passed_tests = passed_count
                    test_run.failed_tests = failed_count
                    test_run.warning_tests = warning_count
                    db.commit()

            # 6. Finalize Run
            test_run.status = "COMPLETED"
            test_run.completed_at = datetime.now(timezone.utc)
            total_t = max(test_run.total_tests, 1)
            score = round(((passed_count + (0.5 * warning_count)) / total_t) * 100.0, 1)
            test_run.compliance_score = min(score, 100.0)
            db.commit()

        except Exception as exc:
            test_run.status = "FAILED"
            test_run.error_message = str(exc)
            test_run.completed_at = datetime.now(timezone.utc)
            db.commit()
        finally:
            db.close()
