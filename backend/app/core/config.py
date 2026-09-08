import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "APISentry - API Contract & Data-Consistency Test Suite"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./apisentry.db")
    DEFAULT_TIMEOUT_SECONDS: float = 10.0
    DEFAULT_RATE_LIMIT_TEST_COUNT: int = 15

settings = Settings()
