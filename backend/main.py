from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.auth import router as auth_router
from api.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    yield
    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title="Medical SOAP API",
    description="AI-powered SOAP note generation for doctors",
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


# Health check
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}