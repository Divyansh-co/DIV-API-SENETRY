import json
import yaml
import copy
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

@dataclass
class ParsedParameter:
    name: str
    location: str  # query, header, path, cookie
    required: bool
    schema: Dict[str, Any]
    description: Optional[str] = None

@dataclass
class ParsedRequestBody:
    required: bool
    content_type: str
    schema: Dict[str, Any]

@dataclass
class ParsedResponse:
    status_code: str
    description: str
    content_type: Optional[str]
    schema: Optional[Dict[str, Any]]

@dataclass
class ParsedEndpoint:
    path: str
    method: str  # GET, POST, etc.
    operation_id: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    parameters: List[ParsedParameter] = field(default_factory=list)
    request_body: Optional[ParsedRequestBody] = None
    responses: Dict[str, ParsedResponse] = field(default_factory=dict)
    security: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ParsedSpec:
    title: str
    version: str
    base_path: str
    endpoints: List[ParsedEndpoint] = field(default_factory=list)
    raw_spec: Dict[str, Any] = field(default_factory=dict)


class SpecParser:
    def __init__(self, raw_content: str):
        self.raw_content = raw_content
        self.spec: Dict[str, Any] = self._parse_raw(raw_content)

    def _parse_raw(self, content: str) -> Dict[str, Any]:
        """Parse raw JSON or YAML string into a Python dict."""
        content = content.strip()
        if content.startswith("{") or content.startswith("["):
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
        try:
            parsed = yaml.safe_load(content)
            if isinstance(parsed, dict):
                return parsed
        except yaml.YAMLError as e:
            raise ValueError(f"Failed to parse spec as YAML or JSON: {str(e)}")
        raise ValueError("Invalid specification format: root must be a JSON/YAML object.")

    def resolve_refs(self, node: Any, root: Dict[str, Any], visited: Optional[set] = None) -> Any:
        """Recursively resolves internal JSON pointer references ($ref: '#/components/...')"""
        if visited is None:
            visited = set()

        if isinstance(node, dict):
            if "$ref" in node and isinstance(node["$ref"], str):
                ref_path = node["$ref"]
                if ref_path.startswith("#/"):
                    if ref_path in visited:
                        # Prevent infinite recursion on circular schemas
                        return {"type": "object", "description": f"Circular ref {ref_path}"}
                    
                    target = self._resolve_pointer(ref_path[2:], root)
                    new_visited = visited.copy()
                    new_visited.add(ref_path)
                    
                    resolved = self.resolve_refs(copy.deepcopy(target), root, new_visited)
                    # Merge any sibling keys (like description or nullable)
                    merged = copy.deepcopy(resolved) if isinstance(resolved, dict) else resolved
                    if isinstance(merged, dict):
                        for k, v in node.items():
                            if k != "$ref":
                                merged[k] = self.resolve_refs(v, root, new_visited)
                    return merged
                else:
                    # External references not dereferenced locally
                    return node

            return {k: self.resolve_refs(v, root, visited) for k, v in node.items()}

        elif isinstance(node, list):
            return [self.resolve_refs(item, root, visited) for item in node]

        return node

    def _resolve_pointer(self, pointer: str, root: Dict[str, Any]) -> Any:
        parts = pointer.split("/")
        current = root
        for part in parts:
            part = part.replace("~1", "/").replace("~0", "~")
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                raise KeyError(f"Invalid reference pointer: '#/{pointer}' not found at key '{part}'")
        return current

    def parse(self) -> ParsedSpec:
        """Parse and normalize OpenAPI 3.x document."""
        resolved_spec = self.resolve_refs(copy.deepcopy(self.spec), self.spec)

        info = resolved_spec.get("info", {})
        title = info.get("title", "Untitled API")
        version = info.get("version", "1.0.0")

        # Determine base path if servers are defined
        base_path = ""
        servers = resolved_spec.get("servers", [])
        if servers and isinstance(servers, list) and len(servers) > 0:
            server_url = servers[0].get("url", "")
            if server_url.startswith("/"):
                base_path = server_url.rstrip("/")

        endpoints: List[ParsedEndpoint] = []
        paths = resolved_spec.get("paths", {})

        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue

            # Path-level parameters
            common_params = path_item.get("parameters", [])

            for method in ["get", "post", "put", "delete", "patch", "options", "head"]:
                if method not in path_item:
                    continue

                operation = path_item[method]
                if not isinstance(operation, dict):
                    continue

                # Merge parameters
                op_params = operation.get("parameters", [])
                all_params = common_params + op_params
                parsed_params: List[ParsedParameter] = []

                for param in all_params:
                    if isinstance(param, dict) and "name" in param and "in" in param:
                        parsed_params.append(
                            ParsedParameter(
                                name=param["name"],
                                location=param["in"],
                                required=param.get("required", False),
                                schema=param.get("schema", {"type": "string"}),
                                description=param.get("description")
                            )
                        )

                # Request body
                parsed_body: Optional[ParsedRequestBody] = None
                rb = operation.get("requestBody")
                if rb and isinstance(rb, dict):
                    required = rb.get("required", False)
                    content = rb.get("content", {})
                    # Prefer application/json
                    content_type = "application/json" if "application/json" in content else (list(content.keys())[0] if content else "application/json")
                    body_schema = content.get(content_type, {}).get("schema", {}) if content else {}
                    parsed_body = ParsedRequestBody(
                        required=required,
                        content_type=content_type,
                        schema=body_schema
                    )

                # Responses
                parsed_responses: Dict[str, ParsedResponse] = {}
                responses = operation.get("responses", {})
                for status_code, resp in responses.items():
                    if isinstance(resp, dict):
                        desc = resp.get("description", "")
                        content = resp.get("content", {})
                        resp_content_type = None
                        resp_schema = None
                        if content and isinstance(content, dict):
                            resp_content_type = "application/json" if "application/json" in content else list(content.keys())[0]
                            resp_schema = content[resp_content_type].get("schema")

                        parsed_responses[str(status_code)] = ParsedResponse(
                            status_code=str(status_code),
                            description=desc,
                            content_type=resp_content_type,
                            schema=resp_schema
                        )

                endpoints.append(
                    ParsedEndpoint(
                        path=path,
                        method=method.upper(),
                        operation_id=operation.get("operationId"),
                        summary=operation.get("summary"),
                        description=operation.get("description"),
                        parameters=parsed_params,
                        request_body=parsed_body,
                        responses=parsed_responses,
                        security=operation.get("security", resolved_spec.get("security", []))
                    )
                )

        return ParsedSpec(
            title=title,
            version=version,
            base_path=base_path,
            endpoints=endpoints,
            raw_spec=self.spec
        )
