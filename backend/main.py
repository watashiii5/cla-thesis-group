from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.schedule.routes import router as schedule_router
import logging

# Configure logging to see what's happening
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="CLA Scheduler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(schedule_router)

@app.get("/health")
def health():
    logger.info("Health check called")
    return {"ok": True, "message": "Backend is running"}

if __name__ == "__main__":
    logger.info("Starting FastAPI server...")
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)