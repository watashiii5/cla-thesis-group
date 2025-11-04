from dotenv import load_dotenv  # Add this import
load_dotenv()  # Load .env file BEFORE any other imports

# Now import everything else
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import routers
try:
    from api.schedule.routes import router as schedule_router
    logger.info("✅ Schedule router imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import schedule router: {e}")
    sys.exit(1)

# Initialize FastAPI app
app = FastAPI(
    title="CLA Thesis Backend API",
    description="Backend API for CLA Thesis Group Scheduling System",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware - Allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from api.schedule import routes as schedule_routes
app.include_router(schedule_routes.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Check if the API is running"""
    return {
        "status": "ok",
        "message": "CLA Thesis Backend is running",
        "version": "0.1.0"
    }

# Root endpoint
@app.get("/")
async def read_root():
    """Welcome endpoint"""
    return {
        "message": "Welcome to CLA Thesis Backend",
        "docs": "/docs",
        "health": "/health"
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on app startup"""
    logger.info("🚀 CLA Thesis Backend starting up...")
    logger.info(f"📡 Backend URL: http://127.0.0.1:8000")
    logger.info(f"📚 API Docs: http://127.0.0.1:8000/docs")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on app shutdown"""
    logger.info("⛔ CLA Thesis Backend shutting down...")

if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Uvicorn server...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )