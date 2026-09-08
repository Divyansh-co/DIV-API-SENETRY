import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import jsonschema
from app.generator.test_generator import GeneratedTestCase

@dataclass
class TestEvaluation:
    status: str  # PASS, FAIL, WARNING
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    failure_reasons: List[str] = field(default_factory=list)
    remediation_hint: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class ResponseComparator:
    """Evaluates live API responses against generated test cases and OpenAPI contracts."""

    @staticmethod
    def evaluate(
        test_case: GeneratedTestCase,
        status_code: int,
        headers: Dict[str, str],
        body: Any
    ) -> TestEvaluation:
        # Lowercase headers for consistent lookup
        norm_headers = {k.lower(): v for k, v in headers.items()}

        # 1. Immediate check: 5xx server crashes are always failures
        if status_code >= 500:
            return TestEvaluation(
                status="FAIL",
                severity="HIGH",
                failure_reasons=[
                    f"Server returned unhandled error status {status_code}. The API crashed instead of returning a controlled client error."
                ],
                remediation_hint="Add defensive error handling or schema input validation to avoid unhandled exceptions.",
                metadata={"status_code": status_code}
            )

        category = test_case.test_category

        if category == "DATA_ISOLATION":
            return ResponseComparator._evaluate_data_isolation(test_case, status_code, body)

        elif category == "SCHEMA_CONFORMANCE":
            return ResponseComparator._evaluate_schema_conformance(test_case, status_code, body)

        elif category == "INPUT_VALIDATION":
            return ResponseComparator._evaluate_input_validation(test_case, status_code, body)

        elif category == "UNDECLARED_FIELDS":
            return ResponseComparator._evaluate_undeclared_fields(test_case, status_code, body)

        elif category == "BOUNDARY_CHECK":
            return ResponseComparator._evaluate_boundary_check(test_case, status_code, body)

        elif category == "RATE_LIMIT_CHECK":
            return ResponseComparator._evaluate_rate_limit_check(test_case, status_code, norm_headers)

        # Fallback default evaluation
        if test_case.expected_status_codes and status_code not in test_case.expected_status_codes:
            return TestEvaluation(
                status="WARNING",
                severity=test_case.severity,
                failure_reasons=[f"Status code {status_code} was unexpected (expected one of {test_case.expected_status_codes})."],
                remediation_hint="Verify documented status codes in OpenAPI spec.",
                metadata={"status_code": status_code}
            )

        return TestEvaluation(
            status="PASS",
            severity=test_case.severity,
            metadata={"status_code": status_code}
        )

    @staticmethod
    def _evaluate_data_isolation(test_case: GeneratedTestCase, status_code: int, body: Any) -> TestEvaluation:
        target_resource = test_case.metadata.get("target_resource_key", "resource")
        target_val = test_case.metadata.get("target_resource_value", "")

        # Proper authorization enforcement should reject with 401, 403, or 404
        if status_code in (401, 403, 404):
            return TestEvaluation(
                status="PASS",
                severity="CRITICAL",
                metadata={"status_code": status_code, "note": f"Cross-tenant access correctly denied with {status_code}."}
            )

        if status_code in (200, 201):
            # Check if response returned data
            is_leaked = True
            if isinstance(body, dict) and not body:
                is_leaked = False  # Empty dict may mean no data
            elif isinstance(body, list) and not body:
                is_leaked = False

            if is_leaked:
                return TestEvaluation(
                    status="FAIL",
                    severity="CRITICAL",
                    failure_reasons=[
                        f"Multi-Tenant Isolation Failure: Account B successfully accessed Account A's {target_resource} ('{target_val}') with HTTP 200 OK."
                    ],
                    remediation_hint=f"Ensure authorization middleware verifies that the authenticated user owns or is granted permission for {target_resource} before returning records.",
                    metadata={"status_code": status_code, "leaked": True}
                )

        return TestEvaluation(
            status="WARNING",
            severity="HIGH",
            failure_reasons=[f"Received unexpected status {status_code} during cross-tenant isolation test."],
            remediation_hint="Ensure unauthorized or forbidden tenant requests return standard 403 Forbidden or 404 Not Found.",
            metadata={"status_code": status_code}
        )

    @staticmethod
    def _evaluate_schema_conformance(test_case: GeneratedTestCase, status_code: int, body: Any) -> TestEvaluation:
        declared_responses = test_case.metadata.get("declared_responses", {})
        str_status = str(status_code)

        schema = declared_responses.get(str_status) or declared_responses.get("default")

        if not schema:
            # Status code not in declared responses
            if status_code in (200, 201, 204):
                return TestEvaluation(
                    status="WARNING",
                    severity="LOW",
                    failure_reasons=[f"HTTP {status_code} was returned but is not documented in the OpenAPI responses."],
                    remediation_hint=f"Add response definition for HTTP {status_code} in the OpenAPI spec.",
                    metadata={"status_code": status_code}
                )
            return TestEvaluation(
                status="PASS",
                severity="LOW",
                metadata={"status_code": status_code}
            )

        if status_code == 204 or body is None or body == "":
            return TestEvaluation(status="PASS", severity="HIGH", metadata={"status_code": status_code})

        # Validate JSON schema conformance
        validator = jsonschema.Draft7Validator(schema)
        errors = list(validator.iter_errors(body))

        failure_reasons = []
        for err in errors[:5]:  # Capture first 5 errors to avoid huge logs
            path_str = " -> ".join([str(p) for p in err.path]) if err.path else "root"
            failure_reasons.append(f"Field '{path_str}': {err.message}")

        # Check for undeclared extra fields (Excessive Data Exposure / Schema Drift)
        extra_fields = []
        if isinstance(body, dict) and schema.get("type") == "object":
            declared_properties = set(schema.get("properties", {}).keys())
            if declared_properties:
                for key in body.keys():
                    if key not in declared_properties and not schema.get("additionalProperties", True) is True:
                        extra_fields.append(key)

        if extra_fields:
            failure_reasons.append(
                f"Schema Drift: Response returned {len(extra_fields)} undeclared fields not defined in contract: {', '.join(extra_fields[:5])}"
            )

        if failure_reasons:
            return TestEvaluation(
                status="FAIL",
                severity="HIGH",
                failure_reasons=failure_reasons,
                remediation_hint="Update API response serializing / DTO to match declared OpenAPI schema or update the specification.",
                metadata={"schema_errors_count": len(errors), "extra_fields": extra_fields}
            )

        return TestEvaluation(
            status="PASS",
            severity="HIGH",
            metadata={"status_code": status_code, "validated_schema": True}
        )

    @staticmethod
    def _evaluate_input_validation(test_case: GeneratedTestCase, status_code: int, body: Any) -> TestEvaluation:
        # Expected: client validation error 400, 422, or 404
        if status_code in (400, 422, 404):
            return TestEvaluation(
                status="PASS",
                severity="HIGH",
                metadata={"status_code": status_code, "note": f"Handled invalid input with client error {status_code}."}
            )

        if status_code in (200, 201):
            return TestEvaluation(
                status="WARNING",
                severity="MEDIUM",
                failure_reasons=[
                    f"API returned {status_code} despite receiving an invalid type for parameter '{test_case.metadata.get('parameter')}'. Expected validation error 400/422."
                ],
                remediation_hint="Enable type casting/validation in endpoint controller to reject invalid types.",
                metadata={"status_code": status_code}
            )

        return TestEvaluation(
            status="WARNING",
            severity="MEDIUM",
            failure_reasons=[f"Unexpected status code {status_code} when submitting invalid parameter type."],
            metadata={"status_code": status_code}
        )

    @staticmethod
    def _evaluate_undeclared_fields(test_case: GeneratedTestCase, status_code: int, body: Any) -> TestEvaluation:
        injected_key = test_case.metadata.get("injected_key", "")
        # Strict validation: rejected with 400/422
        if status_code in (400, 422):
            return TestEvaluation(
                status="PASS",
                severity="MEDIUM",
                metadata={"status_code": status_code, "note": "Server strictly rejected undeclared request property."}
            )

        # Permissive acceptance: check if echoed or leaked back
        if isinstance(body, dict) and injected_key in body:
            return TestEvaluation(
                status="WARNING",
                severity="MEDIUM",
                failure_reasons=[
                    f"API silently persisted and echoed undeclared request field '{injected_key}'. Consider validating request schema against unexpected properties."
                ],
                remediation_hint="Configure input DTOs to strip or reject extra attributes.",
                metadata={"status_code": status_code, "echoed": True}
            )

        return TestEvaluation(
            status="PASS",
            severity="MEDIUM",
            metadata={"status_code": status_code, "note": "Server accepted request without echoing extra property."}
        )

    @staticmethod
    def _evaluate_boundary_check(test_case: GeneratedTestCase, status_code: int, body: Any) -> TestEvaluation:
        if status_code in (400, 422):
            return TestEvaluation(
                status="PASS",
                severity="MEDIUM",
                metadata={"status_code": status_code, "note": "Missing body correctly caught by validator."}
            )

        return TestEvaluation(
            status="WARNING",
            severity="MEDIUM",
            failure_reasons=[f"Missing required body returned unexpected status {status_code} instead of 400/422."],
            remediation_hint="Mark request body as required in framework router.",
            metadata={"status_code": status_code}
        )

    @staticmethod
    def _evaluate_rate_limit_check(test_case: GeneratedTestCase, status_code: int, headers: Dict[str, str]) -> TestEvaluation:
        rate_limit_keys = [
            "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset",
            "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"
        ]
        found_headers = {k: headers[k] for k in rate_limit_keys if k in headers}

        if status_code == 429:
            return TestEvaluation(
                status="PASS",
                severity="LOW",
                metadata={"status_code": 429, "rate_limited": True, "headers": found_headers}
            )

        if found_headers:
            return TestEvaluation(
                status="PASS",
                severity="LOW",
                metadata={"status_code": status_code, "rate_limit_headers": found_headers}
            )

        return TestEvaluation(
            status="WARNING",
            severity="LOW",
            failure_reasons=["No standard rate-limiting headers (RateLimit-* or X-RateLimit-*) detected in response."],
            remediation_hint="Consider configuring rate limiting headers on public or sensitive API endpoints to improve client observability.",
            metadata={"status_code": status_code}
        )
