from dotenv import load_dotenv
load_dotenv()  # Load .env file BEFORE any other imports

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
import sys

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
    title="CLA Scheduler API",
    description="Backend API for CLA Thesis Scheduling System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ✅ UPDATED: Dynamic CORS based on environment
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),  # Render sets this
]

# ✅ Add Vercel URL if provided
vercel_url = os.getenv("VERCEL_URL")
if vercel_url:
    origins.append(f"https://{vercel_url}")

# ✅ Allow all Vercel preview deployments
origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
from api.schedule import routes as schedule_routes
app.include_router(schedule_routes.router, prefix="/api/schedule", tags=["schedule"])

# ✅ CRITICAL: Health check endpoint (for Render)
@app.get("/health")
async def health_check():
    """Health check for Render deployment"""
    return {
        "status": "healthy",
        "message": "CLA Thesis Backend is running",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "production")
    }

# Root endpoint
@app.get("/")
async def read_root():
    """Welcome endpoint"""
    return {
        "message": "Welcome to CLA Thesis Backend API",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0"
    }

# ✅ Add CORS preflight handler
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    """Handle CORS preflight requests"""
    return JSONResponse(content={}, status_code=200)

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    logger.error(f"HTTP Exception: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "success": False}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "success": False}
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on app startup"""
    logger.info("🚀 CLA Thesis Backend starting up...")
    logger.info(f"📡 Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"📚 API Docs: /docs")
    logger.info(f"🔧 Health Check: /health")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on app shutdown"""
    logger.info("⛔ CLA Thesis Backend shutting down...")

# ✅ CRITICAL: For Render deployment, bind to 0.0.0.0
if __name__ == "__main__":
    import uvicorn
    
    # Use environment variables for host/port (required for Render)
    host = os.getenv("HOST", "0.0.0.0")  # ✅ Changed from 127.0.0.1
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting Uvicorn server on {host}:{port}...")
    uvicorn.run(
        "main:app",  # ✅ Changed to string notation for reload
        host=host,
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development",
        log_level="info"
    )