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
    """
    Fetch ALL rows from a Supabase table, bypassing the 1000 row limit.
    Uses pagination with 1000 rows per page.
    """
    PAGE_SIZE = 1000
    all_data = []
    page = 0
    has_more = True
    
    logger.info(f"Fetching ALL rows from '{table_name}' (bypassing 1000 limit)...")
    
    while has_more:
        from_idx = page * PAGE_SIZE
        to_idx = from_idx + PAGE_SIZE - 1
        
        query = supabase.table(table_name).select("*").range(from_idx, to_idx).order(order_by)
        
        # Apply filters
        for key, value in filters.items():
            query = query.eq(key, value)
        
        try:
            res = query.execute()
            data = res.data or []
            
            if not data:
                has_more = False
                break
            
            all_data.extend(data)
            logger.debug(f"   Page {page + 1}: Fetched {len(data)} rows (total: {len(all_data)})")
            
            if len(data) < PAGE_SIZE:
                has_more = False
            
            page += 1
            
        except Exception as e:
            logger.error(f"Error fetching page {page} from {table_name}: {e}")
            raise
    
    logger.info(f"Total rows fetched from '{table_name}': {len(all_data)}")
    return all_data

# ==================== Endpoints ====================

@router.post("/generate")
async def generate_schedule(request: ScheduleRequest):
    """Generate optimized schedule with proper data saving"""
    logger.info("=" * 80)
    logger.info("SCHEDULE GENERATION REQUEST RECEIVED")
    logger.info("=" * 80)
    logger.info(f"Request data: {request}")
    
    try:
        # Validate required fields including end_date
        required_fields = ['campus_group_id', 'participant_group_id', 'event_name', 'schedule_date', 'end_date']
        missing_fields = [field for field in required_fields if field not in request]
        
        if missing_fields:
            logger.error(f"Missing required fields: {missing_fields}")
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        # Validate date range
        start_date = datetime.strptime(request.schedule_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d").date()
        
        if end_date < start_date:
            raise HTTPException(400, "end_date must be >= schedule_date")
        
        date_diff = (end_date - start_date).days
        logger.info(f"Schedule spans {date_diff + 1} day(s): {start_date} to {end_date}")
        
        # FETCH ROOMS WITH VALIDATION
        logger.info("\nSTEP 1: Fetching ALL rooms from Supabase...")
        rooms = fetch_all_rows(
            "campuses",
            filters={"upload_group_id": request.campus_group_id},
            order_by="id"
        )
        
        logger.info(f"Fetched {len(rooms)} rooms")
        if not rooms:
            raise HTTPException(404, "No rooms found for this campus group")

        # VALIDATE ROOM DATA FOR NULL VALUES
        logger.info("\nSTEP 1.5: Validating room data...")
        invalid_rooms = []
        for room in rooms:
            campus = room.get("campus")
            building = room.get("building")
            room_name = room.get("room")
            capacity = room.get("capacity")
            
            issues = []
            if not campus or str(campus).strip() == "":
                issues.append("Campus is blank")
            if not building or str(building).strip() == "":
                issues.append("Building is blank")
            if not room_name or str(room_name).strip() == "":
                issues.append("Room is blank")
            if not capacity or capacity <= 0:
                issues.append(f"Capacity is {capacity}")
            
            if issues:
                invalid_rooms.append({
                    'id': room['id'],
                    'campus': campus or 'NULL',
                    'building': building or 'NULL',
                    'room': room_name or 'NULL',
                    'capacity': capacity,
                    'issues': ', '.join(issues)
                })
        
        if invalid_rooms:
            error_details = "\n".join([
                f"Row ID {r['id']}: {r['issues']} (Campus='{r['campus']}', Building='{r['building']}', Room='{r['room']}', Capacity={r['capacity']})"
                for r in invalid_rooms
            ])
            raise HTTPException(
                status_code=400,
                detail=f"INVALID CAMPUS DATA DETECTED\n\n{error_details}\n\nAction Required:\n1. Open your Excel file\n2. Fix the blank/invalid values\n3. Re-upload to Supabase\n4. Try generating the schedule again"
            )

        logger.info(f"All {len(rooms)} rooms have valid data")

        # FETCH PARTICIPANTS
        participants = fetch_all_rows(
            "participants",
            filters={"upload_group_id": request.participant_group_id},
            order_by="id"
        )
        
        logger.info(f"Fetched {len(participants)} participants")
        pwd_count = sum(1 for p in participants if p.get("is_pwd", False))
        logger.info(f"   PWD: {pwd_count}")
        logger.info(f"   Non-PWD: {len(participants) - pwd_count}")

        if not participants:
            raise HTTPException(404, "No participants found for this group")

        # Extract lunch break settings from request
        exclude_lunch_break = request.get('exclude_lunch_break', True)
        lunch_break_start = request.get('lunch_break_start', '12:00')
        lunch_break_end = request.get('lunch_break_end', '13:00')
        
        logger.info("Lunch Break Settings:")
        logger.info(f"   Exclude: {exclude_lunch_break}")
        if exclude_lunch_break:
            logger.info(f"   Time: {lunch_break_start} - {lunch_break_end}")

        # SCHEDULE ALGORITHM (with lunch break support)
        logger.info("\nSTEP 3: Running priority scheduler...")
        scheduler = PriorityScheduler()
        result = scheduler.schedule(
            rooms=rooms,
            participants=participants,
            start_date=request.schedule_date,
            end_date=request.end_date,
            start_time=request.start_time,
            end_time=request.end_time,
            duration_per_batch=request.duration_per_batch,
            prioritize_pwd=request.prioritize_pwd,
            exclude_lunch_break=exclude_lunch_break,
            lunch_break_start=lunch_break_start,
            lunch_break_end=lunch_break_end
        )
        
        logger.info("Scheduling complete")
        logger.info(f"   Total Batches: {result['total_batches']}")
        logger.info(f"   Total Scheduled: {result['scheduled_count']}/{len(participants)}")

        # SAVE TO SUPABASE WITH PROPER DATA
        logger.info("\nSTEP 4: Saving to Supabase...")

        # Insert schedule_summary with end_date
        summary_row = {
            "event_name": request.event_name,
            "event_type": request.event_type,
            "schedule_date": request.schedule_date,
            "start_time": request.start_time,
            "end_date": request.end_date,
            "end_time": request.end_time,
            "campus_group_id": request.campus_group_id,
            "participant_group_id": request.participant_group_id,
            "scheduled_count": result["scheduled_count"],
            "unscheduled_count": result["unscheduled_count"],
        }
        
        logger.info(f"   Schedule Date Range: {summary_row['schedule_date']} to {summary_row['end_date']}")
        
        try:
            summary_res = supabase.table("schedule_summary").insert([summary_row]).execute()
            if not summary_res.data:
                raise HTTPException(500, "Failed to insert schedule_summary")
            schedule_summary_id = summary_res.data[0]["id"]
            logger.info(f"schedule_summary created (ID: {schedule_summary_id})")
        except Exception as e:
            logger.error(f"Failed to insert schedule_summary: {e}")
            raise HTTPException(500, f"Failed to insert schedule_summary: {e}")

        # Insert schedule_batches with all required fields
        logger.info(f"   Inserting {len(result['batches'])} schedule_batches...")
        batch_rows = []
        batch_id_map = {}  # Map batch_number to database ID
        
        for b in result["batches"]:
            batch_data = {
                "schedule_summary_id": schedule_summary_id,
                "batch_number": b.get("batch_number", 1),
                "batch_name": b["batch_name"],
                "batch_date": b.get("batch_date"),
                "campus": b.get("campus", "Main Campus"),
                "building": b.get("building", "Unknown Building"),
                "room": b.get("room", "Unknown Room"),
                "is_first_floor": b.get("is_first_floor", False),
                "start_time": b.get("start_time", "08:00"),
                "end_time": b.get("end_time", "09:00"),
                "time_slot": b.get("time_slot", "08:00 - 09:00"),
                "participant_count": b["participant_count"],
                "has_pwd": b["has_pwd"],
                "participant_ids": b["participant_ids"],
            }
            
            logger.info(f"   Batch {b['batch_name']}: {batch_data['campus']} | {batch_data['building']} | {batch_data['room']} | {batch_data['batch_date']} | {batch_data['start_time']}-{batch_data['end_time']}")
            
            try:
                batch_res = supabase.table("schedule_batches").insert([batch_data]).execute()
                
                if not batch_res.data:
                    raise HTTPException(500, f"Failed to insert batch {b['batch_name']}")
                
                batch_db_id = batch_res.data[0]["id"]
                batch_id_map[b.get("batch_number", len(batch_id_map) + 1)] = batch_db_id
                
                logger.info(f"     Saved with DB ID: {batch_db_id}")
                
            except Exception as e:
                logger.error(f"Failed to insert batch {b['batch_name']}: {e}")
                logger.error(f"   Batch data: {batch_data}")
                raise HTTPException(500, f"Failed to insert batch {b['batch_name']}: {e}")

        logger.info(f"All {len(result['batches'])} batches saved successfully")
        logger.info(f"Batch ID mapping: {batch_id_map}")

        # Insert schedule_assignments with all required fields
        logger.info(f"   Inserting {len(result['assignments'])} schedule_assignments...")
        assignments_saved = 0
        assignments_failed = 0
        
        for assignment in result["assignments"]:
            batch_number = assignment.get("batch_number", 1)
            batch_db_id = batch_id_map.get(batch_number)
            
            if not batch_db_id:
                logger.error(f"Could not find batch DB ID for batch_number {batch_number}")
                assignments_failed += 1
                continue
            
            # Ensure all assignment fields are present
            assignment_data = {
                "schedule_summary_id": schedule_summary_id,
                "schedule_batch_id": batch_db_id,
                "participant_id": assignment["participant_id"],
                "seat_no": assignment["seat_no"],
                "is_pwd": assignment["is_pwd"],
                "campus": assignment.get("campus", "Main Campus"),
                "building": assignment.get("building", "Unknown Building"),
                "room": assignment.get("room", "Unknown Room"),
                "is_first_floor": assignment.get("is_first_floor", False),
                "start_time": assignment.get("start_time", "08:00"),
                "end_time": assignment.get("end_time", "09:00"),
                "batch_date": assignment.get("batch_date", str(start_date)),
            }
            
            # Validate assignment data before insertion
            required_assignment_fields = ['campus', 'building', 'room', 'start_time', 'end_time', 'batch_date']
            missing_field = False
            for field in required_assignment_fields:
                if not assignment_data[field] or assignment_data[field] in ['N/A', '', None]:
                    logger.error(f"Assignment for participant {assignment['participant_id']} missing {field}: {assignment_data[field]}")
                    assignments_failed += 1
                    missing_field = True
                    break
            if missing_field:
                continue
            
            try:
                supabase.table('schedule_assignments').insert([assignment_data]).execute()
                assignments_saved += 1
                
                if assignments_saved % 50 == 0:  # Log progress every 50 assignments
                    logger.info(f"   Saved {assignments_saved}/{len(result['assignments'])} assignments...")
                    
            except Exception as e:
                logger.error(f"Error inserting assignment for participant {assignment['participant_id']}: {e}")
                logger.error(f"   Assignment data: {assignment_data}")
                assignments_failed += 1

        logger.info(f"Saved {assignments_saved}/{len(result['assignments'])} assignments")
        if assignments_failed > 0:
            logger.warning(f"Failed to save {assignments_failed} assignments")

        # Add warnings
        warnings: List[str] = []
        if result.get("warnings"):
            warnings.extend(result["warnings"])

        if result["unscheduled_count"] > 0:
            warning_msg = f"{result['unscheduled_count']} participants not scheduled"
            warnings.append(warning_msg)

        logger.info(f"\n{'='*100}")
        logger.info("SCHEDULE GENERATION COMPLETE")
        logger.info(f"{'='*100}\n")

        return ScheduleResponse(
            schedule_summary_id=schedule_summary_id,
            scheduled_count=result["scheduled_count"],
            unscheduled_count=result["unscheduled_count"],
            total_batches=result["total_batches"],
            warnings=warnings,
            assignments=result["assignments"],
            pwd_stats={
                "pwd_scheduled": result.get("pwd_scheduled", 0),
                "pwd_unscheduled": result.get("pwd_unscheduled", 0),
                "non_pwd_scheduled": result.get("non_pwd_scheduled", 0),
                "non_pwd_unscheduled": result.get("non_pwd_unscheduled", 0),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"UNEXPECTED ERROR: {e}", exc_info=True)
        raise HTTPException(500, f"Scheduling failed: {e}")

@router.get("/export/{schedule_id}")
async def export_schedule(schedule_id: int):
    """Export schedule data as rows (handle unlimited rows)"""
    try:
        logger.info(f"Exporting schedule {schedule_id}...")
        
        # Fetch ALL batches
        batches = fetch_all_rows(
            "schedule_batches",
            filters={"schedule_summary_id": schedule_id},
            order_by="batch_name"
        )
        
        logger.info(f"Fetched {len(batches)} batches")

        # Try normalized assignments (fetch ALL)
        assigns = []
        try:
            assigns = fetch_all_rows(
                "schedule_assignments",
                filters={"schedule_summary_id": schedule_id},
                order_by="schedule_batch_id"
            )
            logger.info(f"Using {len(assigns)} assignments from schedule_assignments")
        except Exception as e:
            logger.warning(f"schedule_assignments not available: {e}")

        rows: List[Dict] = []

        if assigns:
            # Build from normalized assignments
            pids = list(set(a["participant_id"] for a in assigns))
            
            # Fetch ALL participants
            participants = []
            CHUNK_SIZE = 1000
            for i in range(0, len(pids), CHUNK_SIZE):
                chunk = pids[i:i + CHUNK_SIZE]
                try:
                    res = supabase.table("participants").select("*").in_("id", chunk).execute()
                    if res.data:
                        participants.extend(res.data)
                except Exception as e:
                    logger.error(f"Failed to fetch participant chunk: {e}")
                    raise HTTPException(500, f"Failed to fetch participants: {e}")

            pmap = {p["id"]: p for p in participants}
            bmap = {b["id"]: b for b in batches}

            for a in assigns:
                b = bmap.get(a["schedule_batch_id"], {})
                p = pmap.get(a["participant_id"], {})
                rows.append({
                    "participant_number": p.get("participant_number") or p.get("id"),
                    "name": p.get("name") or "N/A",
                    "email": p.get("email") or "N/A",
                    "pwd": "Yes" if p.get("is_pwd") else "No",
                    "batch_name": b.get("batch_name"),
                    "room": b.get("room"),
                    "time_slot": b.get("time_slot"),
                    "campus": "N/A",
                    "seat_no": a.get("seat_no"),
                })
        else:
            # Fallback to participant_ids arrays
            pids = []
            for b in batches:
                pids.extend(b.get("participant_ids") or [])
            pids = list(set(pids))

            if pids:
                # Fetch ALL participants in chunks
                participants = []
                CHUNK_SIZE = 1000
                for i in range(0, len(pids), CHUNK_SIZE):
                    chunk = pids[i:i + CHUNK_SIZE]
                    try:
                        res = supabase.table("participants").select("*").in_("id", chunk).execute()
                        if res.data:
                            participants.extend(res.data)
                    except Exception as e:
                        logger.error(f"Failed to fetch participant chunk: {e}")
                        raise HTTPException(500, f"Failed to fetch participants: {e}")

                pmap = {p["id"]: p for p in participants}

                for b in batches:
                    for seat_no, pid in enumerate(b.get("participant_ids") or [], start=1):
                        p = pmap.get(pid, {})
                        rows.append({
                            "participant_number": p.get("participant_number") or p.get("id"),
                            "name": p.get("name") or "N/A",
                            "email": p.get("email") or "N/A",
                            "pwd": "Yes" if p.get("is_pwd") else "No",
                            "batch_name": b.get("batch_name"),
                            "room": b.get("room"),
                            "time_slot": b.get("time_slot"),
                            "campus": "N/A",
                            "seat_no": seat_no,
                        })

        logger.info(f"Export complete: {len(rows)} rows")
        return rows
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(500, f"Export failed: {e}")

@router.get("/")
async def get_schedules():
    return {"schedules": []}