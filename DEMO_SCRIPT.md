# 2-Minute Interview Demo Script: APISentry

Use this script during interviews or technical presentations to demonstrate APISentry live in under 2 minutes.

---

### Step 0: Pre-Flight (10 Seconds Before the Demo)

Spin up the stack with Docker Compose or local commands:
```bash
docker compose up
```
Open your browser to: `http://localhost:3000` (or local dev port).

---

### Minute 0:00 – 0:30: The Hook & Architectural Pitch

> *"Hi everyone. Today I'm demonstrating **APISentry**, an automated API contract testing and multi-tenant data isolation platform I built using Python FastAPI, React, and Tailwind.*
>
> *In modern SaaS APIs, two dangerous classes of bugs consistently slip past standard unit tests: **BOLA (Broken Object Level Authorization)**—where one tenant can access another tenant's records by swapping an ID—and **Schema Drift**—where internal database fields and debug tokens leak into live responses.*
>
> *APISentry solves this by ingesting an API's OpenAPI specification, synthesizing property-based contract probes and cross-tenant credential tests, and scoring compliance in real-time."*

---

### Minute 0:30 – 1:00: Launching a Live Test Run

> *(Click the **"New Test Run"** tab in the top navigation).*
>
> *"Here in the configuration dashboard, we point to our live target API. I'll click **'Load Demo Target Preset'**, which automatically fills in our OpenAPI contract and two test accounts: Tenant A (Alice) and Tenant B (Bob).*
>
> *Now I'll hit **'Start Automated Audit'**."*
>
> *(Click **Start Automated Audit** — dashboard transitions to Live Progress).*
>
> *"Notice the real-time progress bar and live telemetry stream. APISentry's asynchronous engine is dereferencing the OpenAPI spec, generating synthetic probes, and executing them with `httpx`."*

---

### Minute 1:00 – 1:30: Endpoint Risk Map & Critical Finding Inspection

> *(Click the **"Endpoint Map"** tab).*
>
> *"Notice the **Endpoint Map** with its animated scanning-line radar beam. Each route is color-coded by health. Here we immediately see a bright crimson card on `GET /api/v1/orders/{order_id}`.*
>
> *(Click the crimson `/api/v1/orders/{order_id}` card).*
>
> *"This takes us into the **Results Table** filtered to this route. Let's click **'Inspect'** on the finding.*
>
> *Look at the diagnostic trace: APISentry issued an authorized request with **Account B's Bearer token**, but requested **Account A's order ID (101)**. Instead of returning a 403 Forbidden, the server returned `HTTP 200 OK` with Alice's private order details.*
>
> *APISentry automatically flagged this as a **CRITICAL Multi-Tenant Isolation Failure**, provides the full request/response payload, and recommends exact authorization middleware remediation."*

---

### Minute 1:30 – 2:00: Trends & Executive Deliverable Export

> *(Click the **"Trends"** tab).*
>
> *"Over in **Trends**, teams can track their API compliance score and regression history across CI/CD deployments over time.*
>
> *(Click the **"Report Export"** tab).*
>
> *"Finally, when auditing is complete, developers or security auditors can click **'Download / Print PDF'** to get a clean, client-ready executive report with compliance scorecards, category pass rates, and failure traces.*
>
> *Everything runs in Docker, is covered by a 100% passing pytest suite, and gives teams instant visibility into whether their live APIs stay true to their contract and secure for their users."*
