from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List

demo_app = FastAPI(
    title="Sample E-Commerce & Account API",
    version="2.1.0",
    description="Demo REST API for testing contract conformance and multi-tenant isolation."
)

# Simulated in-memory database
USERS = {
    1: {"id": 1, "username": "alice", "email": "alice@example.com"},
    2: {"id": 2, "username": "bob", "email": "bob@example.com"}
}

INVOICES = {
    101: {"id": 101, "owner_id": 1, "amount": 250.0, "status": "paid"},
    102: {"id": 102, "owner_id": 2, "amount": 140.0, "status": "pending"}
}

class UserResponse(BaseModel):
    id: int
    username: str
    email: str

class UserCreateRequest(BaseModel):
    username: str
    email: str

class ProfileResponse(BaseModel):
    id: int
    bio: str
    # Note: Spec says only id and bio, but endpoint will return extra 'internal_debug_token'

@demo_app.get("/api/v1/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    """Clean endpoint that strictly conforms to spec."""
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    return USERS[user_id]

@demo_app.post("/api/v1/users", response_model=UserResponse, status_code=201)
def create_user(user: UserCreateRequest):
    """Endpoint supporting user creation."""
    new_id = max(USERS.keys(), default=0) + 1
    new_user = {"id": new_id, "username": user.username, "email": user.email}
    USERS[new_id] = new_user
    return new_user

@demo_app.get("/api/v1/profiles/{user_id}")
def get_profile(user_id: int):
    """Endpoint with schema drift: returns undeclared internal field."""
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "id": user_id,
        "bio": f"Bio of user {user_id}",
        "internal_debug_token": "sec_token_undeclared_9942"  # Schema drift: extra field
    }

@demo_app.get("/api/v1/invoices/{invoice_id}")
def get_invoice(invoice_id: int, authorization: Optional[str] = Header(None)):
    """
    Simulated multi-tenancy flaw: fails to verify that the requesting caller
    matches the invoice's owner_id, leaking invoices across tenants!
    """
    if invoice_id not in INVOICES:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return INVOICES[invoice_id]

@demo_app.get("/api/v1/metrics")
def get_metrics(limit: str = Query("10")):
    """
    Simulated unhandled exception: does raw int() conversion without validation,
    causing 500 Internal Server Error when given non-numeric string!
    """
    # Flaw: raw int() triggers ValueError unhandled -> 500 error
    val = int(limit)
    return {"metrics": [f"metric_{i}" for i in range(val)]}

@demo_app.get("/api/v1/status")
def get_status():
    """Endpoint with standard RateLimit headers."""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"status": "operational"},
        headers={
            "RateLimit-Limit": "100",
            "RateLimit-Remaining": "98",
            "RateLimit-Reset": "60"
        }
    )
