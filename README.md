# APISentry

A tool that checks whether an API actually behaves the way its OpenAPI/Swagger spec says it does — and whether tenants can accidentally see each other's data.

## Why I built this

I originally set out to build a straightforward API security scanner covering stuff from the OWASP API Security Top 10 (broken object-level auth, excessive data exposure, rate limiting gaps, etc). Partway through I ended up reframing it more as a contract/QA testing tool rather than an "attack tool," which honestly made it more useful — instead of just flagging vulnerabilities, it tells you where your API's real behavior has drifted from its documented contract.

Two specific problems this focuses on:

1. **Multi-tenant data leakage (BOLA)** — an endpoint that doesn't properly check ownership when a user swaps an ID in the URL and ends up seeing someone else's data.
2. **Schema drift / excessive data exposure** — endpoints returning extra fields, internal DB ids, or debug info that were never declared in the public API contract.

## How it works

You feed it an OpenAPI 3.x spec. It generates test probes based on that spec (property-based, not hardcoded per-endpoint), runs them against the live API asynchronously, and scores how compliant the actual behavior is against what was documented. Results show up in a dashboard along with exportable PDF/HTML audit reports.

## Stack

- Backend: FastAPI, with the actual test execution running async
- Frontend: React 18 + TypeScript + Tailwind + Vite
- Dockerized so the whole thing can spin up in one go
- Test suite built with pytest (currently all green)

## Running it

```bash
git clone https://github.com/Divyansh-co/DIV-API-SENETRY.git
cd DIV-API-SENETRY
docker compose up --build
```

Then point it at an OpenAPI spec (either a local file or a URL) and it'll kick off a new test run from the dashboard.

## Current state

I self-tested it against its own backend as a sanity check — 24 tests, 0 failures, decent compliance score, and it actually caught a real issue (missing/weak rate limiting on some of its own endpoints), which was a nice validation that the tool works as intended.

The dashboard theme has changed a couple times while I was iterating on it (started as "Cobalt Steel," went through a couple of other looks) — cosmetic stuff, not load-bearing.

## What's still rough

- Coverage of the full OWASP API Top 10 isn't complete yet — currently strongest on BOLA and schema/contract drift
- Some endpoints in my own test backend still need better rate limiting (the tool told me so)
- Report styling/export could use more polish
- No auth/multi-user support in the dashboard itself yet — it's single-user for now

## Why this matters (to me, as a portfolio piece)

Most student security projects are either "scan for known CVEs" or a toy vulnerable-app demo. This one's closer to something you'd actually use in a CI pipeline — verify a real API's runtime behavior against its own contract before it ships.
