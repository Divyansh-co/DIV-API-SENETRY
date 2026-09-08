from fastapi import FastAPI, HTTPException, Header, Query, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List

app = FastAPI(
    title="Sample E-Commerce Store & Order Service",
    version="1.4.0",
    description="Dedicated reference fixture API used by APISentry to evaluate schema conformance and data isolation."
)

# Simulated in-memory database
USERS = {
    1: {"id": 1, "username": "alice", "email": "alice@tenant-a.com"},
    2: {"id": 2, "username": "bob", "email": "bob@tenant-b.com"}
}

ORDERS = {
    101: {"id": 101, "owner_id": 1, "total_price": 289.50, "status": "shipped"},
    102: {"id": 102, "owner_id": 2, "total_price": 54.00, "status": "processing"}
}

# --- Middleware: Simulates unhandled server crashes on invalid inputs for test fixture ---
@app.middleware("http")
async def simulate_unhandled_crash_middleware(request: Request, call_next):
    # If invalid parameter passed to reports/summary, simulate an unhandled server 500 crash
    if "invalid_not_a_number_type" in str(request.url) and "reports" in str(request.url):
        return PlainTextResponse(
            "500 Internal Server Error: Unhandled ValueError: invalid literal for int() with base 10",
            status_code=500
        )
    return await call_next(request)


# --- Schemas ---

class UserSchema(BaseModel):
    id: int
    username: str
    email: str

class UserCreateInput(BaseModel):
    username: str
    email: str

class OrderSchema(BaseModel):
    id: int
    owner_id: int
    total_price: float
    status: str

class AccountProfileSchema(BaseModel):
    id: int
    display_name: str
    email: str
    # Note: Does NOT declare '_internal_cluster_id' or 'server_debug_mode' in schema!
    model_config = ConfigDict(extra="forbid")


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "sample-api"}

@app.get("/api/v1/users/{user_id}", response_model=UserSchema)
def get_user(user_id: int):
    """
    [Conforming Reference Endpoint]
    Correctly adheres to declared UserSchema contract.
    """
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    return USERS[user_id]

@app.post("/api/v1/users", response_model=UserSchema, status_code=201)
def create_user(payload: UserCreateInput):
    """
    [Conforming Reference Endpoint]
    Handles user creation according to schema.
    """
    new_id = max(USERS.keys(), default=0) + 1
    new_user = {"id": new_id, "username": payload.username, "email": payload.email}
    USERS[new_id] = new_user
    return new_user

@app.get("/api/v1/orders/{order_id}")
def get_order(order_id: int, authorization: Optional[str] = Header(None)):
    """
    [INTENTIONAL TEST FIXTURE FLAW #1: Multi-Tenant Data Isolation Bug]
    Simulates a BOLA / tenant isolation failure. This endpoint does NOT verify
    whether the calling tenant owns this order, allowing Account B to retrieve
    Account A's order (Order #101) with HTTP 200 OK.
    """
    if order_id not in ORDERS:
        raise HTTPException(status_code=404, detail="Order not found")
    # Vulnerability: Leaks order data regardless of who makes the request
    return ORDERS[order_id]

@app.get("/api/v1/accounts/{account_id}/profile", responses={200: {"model": AccountProfileSchema}})
def get_account_profile(account_id: int):
    """
    [INTENTIONAL TEST FIXTURE FLAW #2: Schema Drift & Excessive Data Exposure]
    The OpenAPI specification declares that this endpoint returns id, display_name,
    and email. However, the live implementation leaks internal diagnostic attributes:
    '_internal_cluster_id' and 'server_debug_mode'.
    """
    if account_id not in USERS:
        raise HTTPException(status_code=404, detail="Account profile not found")
    
    user = USERS[account_id]
    return {
        "id": user["id"],
        "display_name": user["username"].capitalize(),
        "email": user["email"],
        # Intentional drift / excessive leakage:
        "_internal_cluster_id": "us-east-cluster-942",
        "server_debug_mode": True
    }

@app.get("/api/v1/reports/summary")
def get_report_summary(year: int = Query(2026)):
    """
    [INTENTIONAL TEST FIXTURE FLAW #3: Unhandled Server Crash on Invalid Input]
    Simulates missing input validation. Attempting to parse non-numeric strings
    triggers an unhandled ValueError, returning HTTP 500 Internal Server Error
    rather than a clean HTTP 422/400 validation error.
    """
    return {"year": year, "summary_status": "generated"}

@app.get("/api/v1/system/status")
def get_system_status():
    """
    [Conforming Reference Endpoint]
    Returns standard RateLimit headers for rate-limiting verification.
    """
    return JSONResponse(
        content={"system": "operational", "load": "normal"},
        headers={
            "RateLimit-Limit": "120",
            "RateLimit-Remaining": "118",
            "RateLimit-Reset": "60"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
