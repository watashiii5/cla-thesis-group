from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from .scheduler import PriorityScheduler
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)

# Load env files
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)
root_env_path = Path(__file__).parent.parent.parent.parent / ".env.local"
load_dotenv(root_env_path)

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

# Read keys from backend .env (server-only)
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ANON = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL:
    raise RuntimeError("❌ SUPABASE_URL not configured in .env")

SUPABASE_KEY = SERVICE_ROLE or ANON
if not SUPABASE_KEY:
    raise RuntimeError("❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required in .env")

logger.info(f"✅ Supabase URL: {SUPABASE_URL}")
logger.info(f"✅ Using key type: {'SERVICE_ROLE' if SERVICE_ROLE else 'ANON'}")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    end_time: str
    duration_per_batch: int
    campus_group_id: int
    participant_group_id: int
    prioritize_pwd: bool = True
    email_notification: bool = False

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
    
    logger.info(f"📥 Fetching ALL rows from '{table_name}' (bypassing 1000 limit)...")
    
    while has_more:
        from_idx = page * PAGE_SIZE
        to_idx = from_idx + PAGE_SIZE - 1
        
        query = sb.table(table_name).select("*").range(from_idx, to_idx).order(order_by)
        
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
            logger.error(f"❌ Error fetching page {page} from {table_name}: {e}")
            raise
    
    logger.info(f"✅ Total rows fetched from '{table_name}': {len(all_data)}")
    return all_data

# ==================== Endpoints ====================

@router.post("/generate")
async def generate_schedule(request: dict):
    """Generate optimized schedule with PWD priority"""
    logger.info("=" * 80)
    logger.info("🚀 SCHEDULE GENERATION REQUEST RECEIVED")
    logger.info("=" * 80)
    logger.info(f"Request data: {json.dumps(request, indent=2)}")
    
    try:
        # Validate required fields (accept snake_case from Next.js API route)
        required_fields = ['campus_group_id', 'participant_group_id', 'event_name', 'schedule_date']
        missing_fields = [field for field in required_fields if field not in request]
        
        if missing_fields:
            logger.error(f"❌ Missing required fields: {missing_fields}")
            logger.error(f"❌ Received fields: {list(request.keys())}")
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        # ==================== FETCH ROOMS (ALL) ====================
        logger.info("\n📊 STEP 1: Fetching ALL rooms from Supabase...")
        rooms = fetch_all_rows(
            "campuses",
            filters={"upload_group_id": request['campus_group_id']},  # ✅ snake_case
            order_by="id"
        )
        
        logger.info(f"✅ Fetched {len(rooms)} rooms")
        if len(rooms) > 0:
            logger.debug(f"   Sample: {rooms[0].get('room')} | Capacity: {rooms[0].get('capacity')}")

        if not rooms:
            logger.error(f"❌ No rooms found for campus_group_id={request['campus_group_id']}")
            raise HTTPException(404, "No rooms found for this campus group")

        # ==================== FETCH PARTICIPANTS (ALL) ====================
        participants = fetch_all_rows(
            "participants",
            filters={"upload_group_id": request['participant_group_id']},  # Was: participantGroupId
            order_by="id"
        )
        
        logger.info(f"✅ Fetched {len(participants)} participants")
        pwd_count = sum(1 for p in participants if p.get("is_pwd", False))
        logger.info(f"   ♿ PWD: {pwd_count}")
        logger.info(f"   👤 Non-PWD: {len(participants) - pwd_count}")

        if not participants:
            logger.error(f"❌ No participants found for participant_group_id={request['participant_group_id']}")
            raise HTTPException(404, "No participants found for this group")

        # ==================== SCHEDULE ALGORITHM ====================
        logger.info("\n🗓️  STEP 3: Running priority scheduler with PWD 1st floor rule...")
        scheduler = PriorityScheduler()
        result = scheduler.schedule(
            rooms=rooms,
            participants=participants,
            start_time=request['start_time'],
            end_time=request['end_time'],
            duration_per_batch=request['duration_per_batch'],
            prioritize_pwd=request['prioritize_pwd'],
        )
        
        logger.info(f"✅ Scheduling complete")
        logger.info(f"   Total Batches: {result['total_batches']}")
        logger.info(f"   Total Scheduled: {result['scheduled_count']}/{len(participants)}")
        logger.info(f"   PWD Scheduled: {result.get('pwd_scheduled', 0)}")
        logger.info(f"   Non-PWD Scheduled: {result.get('non_pwd_scheduled', 0)}")

        # ==================== SAVE TO SUPABASE ====================
        logger.info("\n💾 STEP 4: Saving to Supabase...")

        # Insert schedule_summary
        logger.info("   Inserting schedule_summary...")
        summary_row = {
            "event_name": request['event_name'],  # Was: eventName
            "event_type": request['event_type'],
            "schedule_date": request['schedule_date'],  # Was: scheduleDate
            "start_time": request['start_time'],
            "end_time": request['end_time'],
            "campus_group_id": request['campus_group_id'],
            "participant_group_id": request['participant_group_id'],  # Was: participantGroupId
            "scheduled_count": result["scheduled_count"],
            "unscheduled_count": result["unscheduled_count"],
        }
        try:
            summary_res = sb.table("schedule_summary").insert([summary_row]).execute()
            if not summary_res.data:
                logger.error("❌ schedule_summary insert returned no data")
                raise HTTPException(500, "Failed to insert schedule_summary")
            summary_data = summary_res.data
            schedule_summary_id = summary_data[0]["id"]
            logger.info(f"✅ schedule_summary created (ID: {schedule_summary_id})")
        except Exception as e:
            logger.error(f"❌ Failed to insert schedule_summary: {e}")
            raise HTTPException(500, f"Failed to insert schedule_summary: {e}")

        # Insert schedule_batches (handle large batches with chunking)
        logger.info(f"   Inserting {len(result['batches'])} schedule_batches...")
        batch_rows = []
        for b in result["batches"]:
            batch_rows.append({
                "schedule_summary_id": schedule_summary_id,
                "batch_name": b["batch_name"],
                "room": b["room"],
                "time_slot": b["time_slot"],
                "participant_count": b["participant_count"],
                "has_pwd": b["has_pwd"],
                "participant_ids": b["participant_ids"],
            })

        try:
            # Insert in chunks of 500 to avoid payload size issues
            BATCH_CHUNK_SIZE = 500
            batches_data = []
            
            for i in range(0, len(batch_rows), BATCH_CHUNK_SIZE):
                chunk = batch_rows[i:i + BATCH_CHUNK_SIZE]
                chunk_res = sb.table("schedule_batches").insert(chunk).execute()
                if chunk_res.data:
                    batches_data.extend(chunk_res.data)
                logger.debug(f"   Inserted batch chunk {i // BATCH_CHUNK_SIZE + 1}")
            
            if not batches_data:
                logger.error("❌ schedule_batches insert returned no data")
                raise HTTPException(500, "Failed to insert schedule_batches")
            
            logger.info(f"✅ {len(batches_data)} batches inserted")
            
            # Map batch_number to DB IDs for assignments
            batch_id_by_number = {}
            for i, batch_row in enumerate(batch_rows):
                if i < len(batches_data):
                    batch_id_by_number[result["batches"][i]["batch_number"]] = batches_data[i]["id"]
        except Exception as e:
            logger.error(f"❌ Failed to insert schedule_batches: {e}")
            raise HTTPException(500, f"Failed to insert schedule_batches: {e}")

        # Insert schedule_assignments (handle large assignments with chunking)
        logger.info(f"   Inserting {len(result['assignments'])} schedule_assignments...")
        warnings: List[str] = []
        try:
            if result["assignments"]:
                assign_rows = []
                for a in result["assignments"]:
                    batch_id = batch_id_by_number.get(a["batch_number"])
                    if batch_id:
                        assign_rows.append({
                            "schedule_summary_id": schedule_summary_id,
                            "schedule_batch_id": batch_id,
                            "participant_id": a["participant_id"],
                            "seat_no": a["seat_no"],
                            "is_pwd": a["is_pwd"],
                        })

                if assign_rows:
                    # Insert in chunks of 1000
                    ASSIGN_CHUNK_SIZE = 1000
                    total_inserted = 0
                    
                    for i in range(0, len(assign_rows), ASSIGN_CHUNK_SIZE):
                        chunk = assign_rows[i:i + ASSIGN_CHUNK_SIZE]
                        assigns_res = sb.table("schedule_assignments").insert(chunk).execute()
                        if assigns_res.data:
                            total_inserted += len(assigns_res.data)
                        logger.debug(f"   Inserted assignment chunk {i // ASSIGN_CHUNK_SIZE + 1}")
                    
                    logger.info(f"✅ {total_inserted} assignments inserted")
        except Exception as e:
            logger.warning(f"⚠️  schedule_assignments insert failed: {e}")
            warnings.append(f"Assignments not saved: {e}")

        # Add warnings from scheduler
        if result.get("warnings"):
            warnings.extend(result["warnings"])

        if result["unscheduled_count"] > 0:
            warning_msg = f"{result['unscheduled_count']} participants not scheduled"
            warnings.append(warning_msg)
            logger.warning(f"⚠️  {warning_msg}")

        logger.info(f"\n{'='*100}")
        logger.info(f"✅ SCHEDULE GENERATION COMPLETE")
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
        logger.error(f"❌ UNEXPECTED ERROR: {e}", exc_info=True)
        raise HTTPException(500, f"Scheduling failed: {e}")

@router.get("/export/{schedule_id}")
async def export_schedule(schedule_id: int):
    """Export schedule data as rows (handle unlimited rows)"""
    try:
        logger.info(f"📥 Exporting schedule {schedule_id}...")
        
        # Fetch ALL batches
        batches = fetch_all_rows(
            "schedule_batches",
            filters={"schedule_summary_id": schedule_id},
            order_by="batch_name"
        )
        
        logger.info(f"✅ Fetched {len(batches)} batches")

        # Try normalized assignments (fetch ALL)
        assigns = []
        try:
            assigns = fetch_all_rows(
                "schedule_assignments",
                filters={"schedule_summary_id": schedule_id},
                order_by="schedule_batch_id"
            )
            logger.info(f"✅ Using {len(assigns)} assignments from schedule_assignments")
        except Exception as e:
            logger.warning(f"⚠️  schedule_assignments not available: {e}")

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
                    res = sb.table("participants").select("*").in_("id", chunk).execute()
                    if res.data:
                        participants.extend(res.data)
                except Exception as e:
                    logger.error(f"❌ Failed to fetch participant chunk: {e}")
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
                        res = sb.table("participants").select("*").in_("id", chunk).execute()
                        if res.data:
                            participants.extend(res.data)
                    except Exception as e:
                        logger.error(f"❌ Failed to fetch participant chunk: {e}")
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

        logger.info(f"✅ Export complete: {len(rows)} rows")
        return rows
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Export failed: {e}", exc_info=True)
        raise HTTPException(500, f"Export failed: {e}")

@router.get("/")
async def get_schedules():
    return {"schedules": []}