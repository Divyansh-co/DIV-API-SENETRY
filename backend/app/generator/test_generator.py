import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from app.parser.spec_parser import ParsedEndpoint, ParsedParameter, ParsedSpec
from app.schemas.test_run import TestAccount

@dataclass
class GeneratedTestCase:
    test_name: str
    test_category: str  # SCHEMA_CONFORMANCE, DATA_ISOLATION, INPUT_VALIDATION, UNDECLARED_FIELDS, BOUNDARY_CHECK, RATE_LIMIT_CHECK
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    description: str
    endpoint_path: str
    http_method: str
    headers: Dict[str, str] = field(default_factory=dict)
    path_params: Dict[str, Any] = field(default_factory=dict)
    query_params: Dict[str, Any] = field(default_factory=dict)
    body: Optional[Any] = None
    expected_status_codes: List[int] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class MockDataGenerator:
    """Generates synthetic values based on OpenAPI JSON schema types and constraints."""

    @staticmethod
    def generate_value_for_schema(schema: Dict[str, Any], param_name: str = "") -> Any:
        if not schema or not isinstance(schema, dict):
            return "test_value"

        # If an example or default is provided in spec, prioritize it
        if "example" in schema:
            return schema["example"]
        if "default" in schema:
            return schema["default"]
        if "enum" in schema and schema["enum"]:
            return schema["enum"][0]

        schema_type = schema.get("type", "string")
        schema_format = schema.get("format", "")

        # Infer based on name hints if available
        lower_name = param_name.lower()
        if "email" in lower_name or schema_format == "email":
            return "tester@example.com"
        if "uuid" in lower_name or schema_format == "uuid":
            return "123e4567-e89b-12d3-a456-426614174000"
        if "date" in lower_name or schema_format == "date":
            return "2026-01-15"
        if "id" in lower_name:
            if schema_type in ("integer", "number"):
                return 1
            return "1"

        if schema_type == "string":
            min_len = schema.get("minLength", 1)
            base = "test_string"
            if len(base) < min_len:
                base = base * (min_len // len(base) + 1)
            return base

        elif schema_type in ("integer", "number"):
            minimum = schema.get("minimum", 1)
            return int(minimum) if schema_type == "integer" else float(minimum)

        elif schema_type == "boolean":
            return True

        elif schema_type == "array":
            items_schema = schema.get("items", {"type": "string"})
            return [MockDataGenerator.generate_value_for_schema(items_schema, param_name)]

        elif schema_type == "object":
            properties = schema.get("properties", {})
            required_props = set(schema.get("required", []))
            obj = {}
            for prop_name, prop_schema in properties.items():
                # Include required properties or first few props
                if prop_name in required_props or len(obj) < 5:
                    obj[prop_name] = MockDataGenerator.generate_value_for_schema(prop_schema, prop_name)
            return obj

        return "test_value"


class TestGenerator:
    __test__ = False

    def __init__(
        self,
        spec: ParsedSpec,
        account_a: Optional[TestAccount] = None,
        account_b: Optional[TestAccount] = None
    ):
        self.spec = spec
        self.account_a = account_a
        self.account_b = account_b

    def generate_all_tests(self) -> List[GeneratedTestCase]:
        all_tests: List[GeneratedTestCase] = []
        for endpoint in self.spec.endpoints:
            all_tests.extend(self._generate_endpoint_tests(endpoint))
        return all_tests

    def _generate_endpoint_tests(self, endpoint: ParsedEndpoint) -> List[GeneratedTestCase]:
        tests: List[GeneratedTestCase] = []

        # Build baseline valid parameters
        base_path_params: Dict[str, Any] = {}
        base_query_params: Dict[str, Any] = {}
        base_headers: Dict[str, str] = {}

        # Default auth headers from account_a if available
        if self.account_a and self.account_a.headers:
            base_headers.update(self.account_a.headers)

        for param in endpoint.parameters:
            # Check if account_a has a predefined resource ID for this param
            resource_val = None
            if self.account_a and self.account_a.resource_ids:
                resource_val = self.account_a.resource_ids.get(param.name)

            val = resource_val if resource_val is not None else MockDataGenerator.generate_value_for_schema(param.schema, param.name)

            if param.location == "path":
                base_path_params[param.name] = val
            elif param.location == "query":
                base_query_params[param.name] = val
            elif param.location == "header":
                base_headers[param.name] = str(val)

        # Build baseline request body
        base_body: Optional[Any] = None
        if endpoint.request_body and endpoint.request_body.schema:
            base_body = MockDataGenerator.generate_value_for_schema(endpoint.request_body.schema)
            base_headers["Content-Type"] = endpoint.request_body.content_type

        # Determine expected baseline success codes
        declared_success_codes = [
            int(sc) for sc in endpoint.responses.keys() if sc.isdigit() and int(sc) < 400
        ]
        if not declared_success_codes:
            declared_success_codes = [200, 201, 204]

        # -------------------------------------------------------------
        # 1. Baseline Contract & Schema Conformance Test
        # -------------------------------------------------------------
        tests.append(
            GeneratedTestCase(
                test_name=f"Schema Conformance: {endpoint.method} {endpoint.path}",
                test_category="SCHEMA_CONFORMANCE",
                severity="HIGH",
                description="Validates that actual API responses strictly match the declared OpenAPI response schema, field types, and required properties.",
                endpoint_path=endpoint.path,
                http_method=endpoint.method,
                headers=dict(base_headers),
                path_params=dict(base_path_params),
                query_params=dict(base_query_params),
                body=base_body,
                expected_status_codes=declared_success_codes,
                metadata={
                    "check": "baseline_schema",
                    "declared_responses": {
                        sc: r.schema for sc, r in endpoint.responses.items() if r.schema
                    }
                }
            )
        )

        # -------------------------------------------------------------
        # 2. Undeclared / Extra Fields Test (for payload mutation)
        # -------------------------------------------------------------
        if endpoint.method in ("POST", "PUT", "PATCH") and isinstance(base_body, dict):
            mutated_body = dict(base_body)
            mutated_body["_apisentry_undeclared_key"] = "test_unexpected_contract_field"
            tests.append(
                GeneratedTestCase(
                    test_name=f"Undeclared Request Property: {endpoint.method} {endpoint.path}",
                    test_category="UNDECLARED_FIELDS",
                    severity="MEDIUM",
                    description="Tests server behavior when receiving undeclared properties to evaluate strict schema validation vs silent acceptance/drift.",
                    endpoint_path=endpoint.path,
                    http_method=endpoint.method,
                    headers=dict(base_headers),
                    path_params=dict(base_path_params),
                    query_params=dict(base_query_params),
                    body=mutated_body,
                    expected_status_codes=[200, 201, 204, 400, 422],
                    metadata={"check": "undeclared_fields", "injected_key": "_apisentry_undeclared_key"}
                )
            )

        # -------------------------------------------------------------
        # 3. Input Validation: Type Mismatch Handling
        # -------------------------------------------------------------
        # Test wrong type on a query/path parameter or body property
        mutated_param_name = None
        for p in endpoint.parameters:
            param_type = p.schema.get("type", "")
            if param_type in ("integer", "number"):
                mutated_query = dict(base_query_params)
                mutated_path = dict(base_path_params)
                if p.location == "query":
                    mutated_query[p.name] = "invalid_not_a_number_type"
                elif p.location == "path":
                    mutated_path[p.name] = "invalid_not_a_number_type"
                mutated_param_name = p.name

                tests.append(
                    GeneratedTestCase(
                        test_name=f"Input Type Validation: {endpoint.method} {endpoint.path} ({p.name})",
                        test_category="INPUT_VALIDATION",
                        severity="HIGH",
                        description="Submits type-incompatible parameter value to verify the API returns a structured 4xx client error rather than an unhandled 500 server crash.",
                        endpoint_path=endpoint.path,
                        http_method=endpoint.method,
                        headers=dict(base_headers),
                        path_params=mutated_path,
                        query_params=mutated_query,
                        body=base_body,
                        expected_status_codes=[400, 404, 422],
                        metadata={"check": "type_mismatch", "parameter": p.name}
                    )
                )
                break  # Test one parameter per endpoint to keep runs focused

        # -------------------------------------------------------------
        # 4. Boundary & Missing Required Fields
        # -------------------------------------------------------------
        if endpoint.request_body and endpoint.request_body.required and endpoint.method in ("POST", "PUT", "PATCH"):
            tests.append(
                GeneratedTestCase(
                    test_name=f"Missing Body Validation: {endpoint.method} {endpoint.path}",
                    test_category="BOUNDARY_CHECK",
                    severity="MEDIUM",
                    description="Sends empty body on required-body endpoint to verify clean 4xx client validation instead of unhandled 500 errors.",
                    endpoint_path=endpoint.path,
                    http_method=endpoint.method,
                    headers=dict(base_headers),
                    path_params=dict(base_path_params),
                    query_params=dict(base_query_params),
                    body={},
                    expected_status_codes=[400, 422],
                    metadata={"check": "missing_required_body"}
                )
            )

        # -------------------------------------------------------------
        # 5. Multi-Tenant Data Isolation Test (Cross-Account Access)
        # -------------------------------------------------------------
        if self.account_a and self.account_b:
            # Check if this endpoint accesses a specific user or tenant entity
            resource_key = self._find_resource_id_parameter(endpoint)
            if resource_key:
                # Use Account B's credentials to query Account A's resource
                account_a_val = self.account_a.resource_ids.get(resource_key, base_path_params.get(resource_key, "1"))
                
                isolation_headers = dict(self.account_b.headers)
                isolation_path_params = dict(base_path_params)
                isolation_path_params[resource_key] = account_a_val

                tests.append(
                    GeneratedTestCase(
                        test_name=f"Data Isolation: {endpoint.method} {endpoint.path} ({resource_key})",
                        test_category="DATA_ISOLATION",
                        severity="CRITICAL",
                        description=f"Verifies multi-tenant isolation: Account B requests Account A's resource ({resource_key}={account_a_val}). Must reject with 401, 403, or 404 and not leak data.",
                        endpoint_path=endpoint.path,
                        http_method=endpoint.method,
                        headers=isolation_headers,
                        path_params=isolation_path_params,
                        query_params=dict(base_query_params),
                        body=base_body,
                        expected_status_codes=[401, 403, 404],
                        metadata={
                            "check": "cross_tenant_isolation",
                            "target_resource_key": resource_key,
                            "target_resource_value": str(account_a_val),
                            "requesting_account": "Account B"
                        }
                    )
                )

        # -------------------------------------------------------------
        # 6. Rate Limiting & Header Conformance
        # -------------------------------------------------------------
        tests.append(
            GeneratedTestCase(
                test_name=f"Rate Limit & Throttling Header Check: {endpoint.method} {endpoint.path}",
                test_category="RATE_LIMIT_CHECK",
                severity="LOW",
                description="Inspects response headers for standard rate-limiting metadata (e.g. RateLimit-Limit, X-RateLimit-Remaining) or expected 429 throttling behavior.",
                endpoint_path=endpoint.path,
                http_method=endpoint.method,
                headers=dict(base_headers),
                path_params=dict(base_path_params),
                query_params=dict(base_query_params),
                body=base_body,
                expected_status_codes=[200, 201, 204, 429],
                metadata={"check": "rate_limit_headers"}
            )
        )

        return tests

    def _find_resource_id_parameter(self, endpoint: ParsedEndpoint) -> Optional[str]:
        """Detects path parameters that indicate entity or user identifiers."""
        id_patterns = [r".*_?id$", r"^id$", r"user.*", r"account.*", r"tenant.*", r"order.*", r"item.*"]
        for p in endpoint.parameters:
            if p.location == "path":
                for pattern in id_patterns:
                    if re.match(pattern, p.name, re.IGNORECASE):
                        return p.name
        return None
