from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from .scheduler import PriorityScheduler
from datetime import datetime
import logging
import os

# Load .env only if it exists (for local development)
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"Loaded .env from: {env_path}")
else:
    print("No .env file found, using environment variables from system")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Get environment variables with proper fallbacks
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ.get("SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

# Better error message with what we found
logger.info("Checking environment variables...")
logger.info(f"   SUPABASE_URL: {'Found' if SUPABASE_URL else 'Missing'}")
logger.info(f"   SERVICE_ROLE_KEY: {'Found' if SERVICE_ROLE_KEY else 'Missing'}")
logger.info(f"   SUPABASE_ANON_KEY: {'Found' if SUPABASE_ANON_KEY else 'Missing'}")

# Use SERVICE_ROLE_KEY if available, otherwise ANON_KEY
SUPABASE_KEY = SERVICE_ROLE_KEY or SUPABASE_ANON_KEY

if not SUPABASE_URL or not SUPABASE_KEY:
    error_msg = f"""
    Missing required environment variables:
    - SUPABASE_URL: {'OK' if SUPABASE_URL else 'MISSING'}
    - SERVICE_ROLE_KEY or SUPABASE_KEY: {'OK' if SUPABASE_KEY else 'MISSING'}
    
    Please set these in Render dashboard:
    1. Go to your service → Environment tab
    2. Add: SUPABASE_URL, SERVICE_ROLE_KEY, SUPABASE_KEY
    """
    logger.error(error_msg)
    raise RuntimeError(error_msg)

logger.info(f"Supabase URL: {SUPABASE_URL}")
logger.info(f"Using key type: {'SERVICE_ROLE' if SERVICE_ROLE_KEY else 'ANON'}")

# Initialize Supabase client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    raise

# ==================== Models ====================

class ScheduleBase(BaseModel):
    name: str
    description: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    created_at: datetime

class ScheduleRequest(BaseModel):
    event_name: str
    event_type: str
    schedule_date: str
    start_time: str
    end_date: str
    end_time: str
    duration_per_batch: int
    campus_group_id: int
    participant_group_id: int
    prioritize_pwd: bool = True
    email_notification: bool = False
    exclude_lunch_break: bool = True
    lunch_break_start: str = "12:00"
    lunch_break_end: str = "13:00"
    
    # ✅ Allow camelCase aliases
    class Config:
        populate_by_name = True
        
    # ✅ Alternative field names
    campusGroupId: Optional[int] = Field(None, alias="campus_group_id")
    participantGroupId: Optional[int] = Field(None, alias="participant_group_id")
    eventName: Optional[str] = Field(None, alias="event_name")
    eventType: Optional[str] = Field(None, alias="event_type")
    scheduleDate: Optional[str] = Field(None, alias="schedule_date")
    startDate: Optional[str] = Field(None, alias="start_date")
    startTime: Optional[str] = Field(None, alias="start_time")
    endDate: Optional[str] = Field(None, alias="end_date")
    endTime: Optional[str] = Field(None, alias="end_time")
    durationPerBatch: Optional[int] = Field(None, alias="duration_per_batch")
    prioritizePWD: Optional[bool] = Field(None, alias="prioritize_pwd")
    emailNotification: Optional[bool] = Field(None, alias="email_notification")
    excludeLunchBreak: Optional[bool] = Field(None, alias="exclude_lunch_break")
    lunchBreakStart: Optional[str] = Field(None, alias="lunch_break_start")
    lunchBreakEnd: Optional[str] = Field(None, alias="lunch_break_end")

class ScheduleResponse(BaseModel):
    schedule_summary_id: int
    scheduled_count: int
    unscheduled_count: int
    total_batches: int
    warnings: List[str] = []
    assignments: List[Dict] = {}
    pwd_stats: Dict = {}

# ==================== Helper Functions ====================

def fetch_all_rows(table_name: str, filters: Dict = {}, order_by: str = "id") -> List[Dict]:
    res = supabase.table(table_name).select("*").limit(1).execute()
    return res.data or []

# ==================== Endpoints ====================

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    logger.info("⚡️ /generate endpoint hit")

    # Map fields for scheduler (handle both snake_case and camelCase)
    campus_group_id = request.campus_group_id or request.campusGroupId
    participant_group_id = request.participant_group_id or request.participantGroupId
    event_name = request.event_name or request.eventName
    event_type = request.event_type or request.eventType
    schedule_date = request.schedule_date or request.scheduleDate
    end_date = request.end_date or request.endDate
    start_time = request.start_time or request.startTime
    end_time = request.end_time or request.endTime
    duration_per_batch = request.duration_per_batch or request.durationPerBatch
    prioritize_pwd = request.prioritize_pwd if request.prioritize_pwd is not None else request.prioritizePWD
    email_notification = request.email_notification if request.email_notification is not None else request.emailNotification
    exclude_lunch_break = request.exclude_lunch_break if request.exclude_lunch_break is not None else request.excludeLunchBreak
    lunch_break_start = request.lunch_break_start or request.lunchBreakStart or "12:00"
    lunch_break_end = request.lunch_break_end or request.lunchBreakEnd or "13:00"

    # Fetch rooms and participants from Supabase
    rooms = supabase.table('campuses').select('*').eq('upload_group_id', campus_group_id).execute().data
    participants = supabase.table('participants').select('*').eq('upload_group_id', participant_group_id).execute().data

    if not rooms or not participants:
        raise HTTPException(status_code=400, detail="No rooms or participants found for the selected group.")

    # Run the scheduler
    scheduler = PriorityScheduler()
    result = scheduler.schedule(
        rooms=rooms,
        participants=participants,
        start_date=schedule_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        duration_per_batch=duration_per_batch,
        prioritize_pwd=prioritize_pwd,
        exclude_lunch_break=exclude_lunch_break,
        lunch_break_start=lunch_break_start,
        lunch_break_end=lunch_break_end
    )

    # Optionally, save results to Supabase here (see scheduler.py for reference)

    # Return result to frontend
    return {
        "success": True,
        "message": "Schedule generated",
        "scheduled_count": result.get("scheduled_count", 0),
        "unscheduled_count": result.get("unscheduled_count", 0),
        "execution_time": 0,  # You can add timing if needed
        "assignments": result.get("assignments", []),
        "schedule_summary_id": None,  # Add if you save summary
        "pwd_stats": result.get("pwd_stats", {})
    }