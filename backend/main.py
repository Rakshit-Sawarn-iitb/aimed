from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api.auth import router as auth_router
from api.reports import router as reports_router
from api.consults import router as consults_router
from api.facts import router as facts_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up AIMED backend…")
    yield
    # Shutdown
    print("Shutting down…")


app = FastAPI(
    title="AIMED API",
    description="AI-powered medical consultation recorder — transcription, diarization, and structured extraction.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(consults_router)
app.include_router(facts_router)


# Health check
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "aimed-backend"}
