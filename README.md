# APISentry — API Security & Contract Testing Platform

> **Automated OpenAPI Contract Conformance, Schema Drift Detection, & Multi-Tenant Data-Isolation QA Suite**

[![Tests](https://img.shields.io/badge/pytest-8%20passed-3ED9A6?style=for-the-badge&logo=pytest)](file:///./backend/tests)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-2E7DFF?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-5AA9FF?style=for-the-badge&logo=react)](https://react.dev)
[![Docker Compose](https://img.shields.io/badge/Docker-Ready-1B212B?style=for-the-badge&logo=docker)](file:///./docker-compose.yml)

---

## Overview

**APISentry** is a developer QA and security configuration platform designed to verify whether an API's actual runtime behavior matches its OpenAPI/Swagger contract, and whether multi-tenant boundary isolation is preserved across distinct tenant accounts.

In modern microservices and SaaS APIs, two classes of bugs frequently slip past static linters:
1. **Multi-Tenant Data Leakage (BOLA)**: Endpoints that fail to check object ownership when an authorized user swaps an identifier in the path.
2. **Schema Drift & Excessive Data Exposure**: Endpoints that leak internal fields, database IDs, or debug flags not declared in the public API contract.

APISentry ingests OpenAPI 3.x specifications, synthesizes property-based contract probes, executes them asynchronously, scores compliance, and displays findings in a professional **"Cobalt Steel"** SOC dashboard with printable PDF/HTML audit reports.

---

## Architecture

```
                                    +-------------------------------------------------+
                                    |         APISentry Frontend Dashboard            |
                                    |        (React 18 + Tailwind CSS + Vite)         |
                                    +-------------------------------------------------+
                                                            |
                                               REST Calls / JSON Probes
                                                            v
+-------------------------------------------------------------------------------------------------------------+
|                                        APISentry Backend (FastAPI)                                          |
|                                                                                                             |
|  +-------------------+        +-----------------------+        +---------------------+                      |
|  | OpenAPI Parser    | -----> | Test Case Generator   | -----> | Async Runner        |                      |
|  | ($ref dereference)|        | (Schema + Isolation)  |        | (httpx client)      |                      |
|  +-------------------+        +-----------------------+        +----------+----------+                      |
|                                                                           |                                 |
|                                                                    Probes & Responses                       |
|                                                                           v                                 |
|  +-------------------+        +-----------------------+        +---------------------+                      |
|  | SQLite / DB Store | <----- | Response Comparator   | <------+ Target API Prober   |                      |
|  | (Runs & Findings) |        | (jsonschema + Leaks)  |        | (http/https)        |                      |
|  +-------------------+        +-----------------------+        +---------------------+                      |
+-------------------------------------------------------------------------------------------------------------+
                                                            |
                                                  Probes Live Target
                                                            v
                                            +-------------------------------+
                                            |       Target REST API         |
                                            | (e.g. sample-api fixture:8001)|
                                            +-------------------------------+
```

### Core Engine Modules
- **`SpecParser`**: Ingests JSON or YAML OpenAPI specs, resolves `$ref` JSON Pointers recursively, and extracts routes, parameters, and expected response contracts.
- **`TestGenerator`**: Property-based probe synthesizer generating:
  - *Baseline Schema Probes*: Tests valid synthetic payloads against schema rules.
  - *Undeclared Request Fields*: Tests strict request schema filtering.
  - *Type Mutation & Input Checks*: Tests that malformed types return graceful 4xx client errors rather than unhandled 500 crashes.
  - *Multi-Tenant Data Isolation (BOLA)*: Uses Account A and Account B test credentials to probe for cross-tenant resource exposure.
  - *Rate-Limiting Headers*: Probes for `RateLimit-*` or `X-RateLimit-*` metadata.
- **`ResponseComparator`**: Validates response JSON with `jsonschema.Draft7Validator`, flags schema drift and undeclared response attributes, detects cross-tenant data leaks, and formats reproducible request/response snapshots.
- **`HTML/PDF Reporter`**: Generates standalone, printable audit reports with executive scorecards.

---

## Quickstart with Docker Compose

Spin up the entire environment (Backend, Frontend Dashboard, and Sample Test Fixture) in one command:

```bash
docker compose up --build
```

### Services Started:
| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Dashboard** | `http://localhost:3000` | Cobalt Steel React audit interface |
| **APISentry Backend** | `http://localhost:8000` | REST API (`/docs`, `/api/v1/testrun`, etc.) |
| **Sample Target API** | `http://localhost:8001` | Reference fixture with intentional flaws |

---

## Local Development (Without Docker)

### 1. Start Sample Fixture API (Port 8001)
```powershell
python apisentry/sample-api/app/main.py
```

### 2. Start APISentry Backend (Port 8000)
```powershell
uvicorn app.main:app --app-dir apisentry/backend --port 8000 --reload
```

### 3. Start Frontend Dev Server (Port 5173)
```powershell
cd apisentry/frontend
npm run dev
```

---

## Automated Test Suite

APISentry includes a full pytest suite with 100% pass rate:

```powershell
python -m pytest apisentry/backend/tests/ -v
```

### Automated Checks Verified:
1. `test_spec_parser_dereferences_refs`: Validates recursive `$ref` dereferencing.
2. `test_test_generator_cases`: Confirms baseline, input validation, undeclared fields, and multi-tenant test generation.
3. `test_comparator_schema_conformance`: Asserts schema validation and extra-field drift detection.
4. `test_comparator_data_isolation`: Asserts detection of cross-tenant data leaks.
5. `test_comparator_unhandled_server_crash`: Flags 500 unhandled errors.
6. `test_fastapi_endpoints`: Verifies run dispatch, status polling, and historical retrieval.
7. `test_runner_live_suite_with_demo_app`: Full end-to-end ASGI integration run.
8. `test_sample_api_intentional_flaws_detection`: Automated audit run against `sample-api` verifying detection of known test flaws.

---

## Sample Fixture Discrepancies Detected

The included `sample-api` contains three clearly documented intentional test fixtures:
1. **Multi-Tenant Data Isolation Bug** (`GET /api/v1/orders/{order_id}`):
   - Fails to check owner ID against caller credentials, leaking Order #101 to Tenant B with HTTP 200 OK.
   - Flagged by APISentry as: `CRITICAL` `FAIL` (Multi-Tenant Isolation Failure).
2. **Schema Drift & Excessive Data Exposure** (`GET /api/v1/accounts/{account_id}/profile`):
   - Returns undeclared attributes `_internal_cluster_id` and `server_debug_mode` not present in OpenAPI schema.
   - Flagged by APISentry as: `HIGH` `FAIL` (Schema Drift: Undeclared Fields).
3. **Unhandled Server Crash on Invalid Input** (`GET /api/v1/reports/summary`):
   - Submitting non-numeric string to integer query parameter triggers HTTP 500 instead of 422.
   - Flagged by APISentry as: `HIGH` `FAIL` (Unhandled Server Crash).
