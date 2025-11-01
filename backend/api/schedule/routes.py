from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from .scheduler import PriorityScheduler
import logging

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
    assignments: List[Dict] = []

@router.post("/generate", response_model=ScheduleResponse)
async def generate_schedule(req: ScheduleRequest):
    logger.info(f"\n{'='*100}")
    logger.info(f"🚀 SCHEDULE GENERATION REQUEST")
    logger.info(f"{'='*100}")
    logger.info(f"Event: {req.event_name}")
    logger.info(f"Date: {req.schedule_date}")
    logger.info(f"Time: {req.start_time} - {req.end_time}")
    logger.info(f"Campus Group ID: {req.campus_group_id}")
    logger.info(f"Participant Group ID: {req.participant_group_id}")
    
    try:
        # ==================== FETCH ROOMS ====================
        logger.info("\n📊 STEP 1: Fetching rooms from Supabase...")
        rooms = []
        try:
            res = sb.table("campuses") \
                .select("id, campus, building, room, capacity, upload_group_id") \
                .eq("upload_group_id", req.campus_group_id) \
                .execute()
            rooms = res.data or []
            logger.info(f"✅ Fetched {len(rooms)} rooms")
            for r in rooms:
                logger.debug(f"   Room: {r.get('room')} | Capacity: {r.get('capacity')}")
        except Exception as e:
            logger.error(f"❌ Failed to fetch rooms: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch rooms: {e}")

        if not rooms:
            logger.error(f"❌ No rooms found for campus_group_id={req.campus_group_id}")
            raise HTTPException(404, "No rooms found for this campus group")

        # ==================== FETCH PARTICIPANTS ====================
        logger.info("\n👥 STEP 2: Fetching participants from Supabase...")
        participants = []
        try:
            res = sb.table("participants") \
                .select("*") \
                .eq("upload_group_id", req.participant_group_id) \
                .order("id") \
                .execute()
            participants = res.data or []
            logger.info(f"✅ Fetched {len(participants)} participants")
            pwd_count = sum(1 for p in participants if p.get("is_pwd", False))
            logger.info(f"   ♿ PWD: {pwd_count}")
            logger.info(f"   👤 Non-PWD: {len(participants) - pwd_count}")
        except Exception as e:
            logger.error(f"❌ Failed to fetch participants: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch participants: {e}")

        if not participants:
            logger.error(f"❌ No participants found for participant_group_id={req.participant_group_id}")
            raise HTTPException(404, "No participants found for this group")

        # ==================== SCHEDULE ALGORITHM ====================
        logger.info("\n🗓️  STEP 3: Running priority scheduler...")
        scheduler = PriorityScheduler()
        result = scheduler.schedule(
            rooms=rooms,
            participants=participants,
            start_time=req.start_time,
            end_time=req.end_time,
            duration_per_batch=req.duration_per_batch,
            prioritize_pwd=req.prioritize_pwd,
        )
        logger.info(f"✅ Scheduling complete")
        logger.info(f"   Batches: {result['total_batches']}")
        logger.info(f"   Scheduled: {result['scheduled_count']}/{len(participants)}")

        # ==================== SAVE TO SUPABASE ====================
        logger.info("\n💾 STEP 4: Saving to Supabase...")

        # Insert schedule_summary
        logger.info("   Inserting schedule_summary...")
        summary_row = {
            "event_name": req.event_name,
            "event_type": req.event_type,
            "schedule_date": req.schedule_date,
            "start_time": req.start_time,
            "end_time": req.end_time,
            "campus_group_id": req.campus_group_id,
            "participant_group_id": req.participant_group_id,
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

        # Insert schedule_batches
        logger.info("   Inserting schedule_batches...")
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
            batches_res = sb.table("schedule_batches").insert(batch_rows).execute()
            if not batches_res.data:
                logger.error("❌ schedule_batches insert returned no data")
                raise HTTPException(500, "Failed to insert schedule_batches")
            batches_data = batches_res.data
            logger.info(f"✅ {len(batches_data)} batches inserted")
            
            # Map batch_number to DB IDs for assignments
            batch_id_by_number = {}
            for i, batch_row in enumerate(batch_rows):
                if i < len(batches_data):
                    batch_id_by_number[result["batches"][i]["batch_number"]] = batches_data[i]["id"]
            logger.debug(f"   Batch ID mapping: {batch_id_by_number}")
        except Exception as e:
            logger.error(f"❌ Failed to insert schedule_batches: {e}")
            raise HTTPException(500, f"Failed to insert schedule_batches: {e}")

        # Insert schedule_assignments
        logger.info("   Inserting schedule_assignments...")
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
                    assigns_res = sb.table("schedule_assignments").insert(assign_rows).execute()
                    if assigns_res.data:
                        logger.info(f"✅ {len(assigns_res.data)} assignments inserted")
                    else:
                        logger.warning("⚠️  schedule_assignments insert returned no data")
        except Exception as e:
            logger.warning(f"⚠️  schedule_assignments insert failed (table may not have RLS): {e}")
            warnings.append(f"Assignments not saved: {e}")

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
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ UNEXPECTED ERROR: {e}", exc_info=True)
        raise HTTPException(500, f"Scheduling failed: {e}")

@router.get("/export/{schedule_id}")
async def export_schedule(schedule_id: int):
    """Export schedule data as rows"""
    try:
        logger.info(f"📥 Exporting schedule {schedule_id}...")
        
        batches = []
        try:
            res = sb.table("schedule_batches") \
                .select("*") \
                .eq("schedule_summary_id", schedule_id) \
                .order("batch_name") \
                .execute()
            batches = res.data or []
        except Exception as e:
            logger.error(f"❌ Failed to fetch batches: {e}")
            raise HTTPException(500, f"Failed to fetch batches: {e}")

        # Try normalized assignments
        assigns = []
        try:
            res = sb.table("schedule_assignments") \
                .select("*") \
                .eq("schedule_summary_id", schedule_id) \
                .order("schedule_batch_id", { "ascending": True }) \
                .order("seat_no", { "ascending": True }) \
                .execute()
            assigns = res.data or []
            logger.info(f"✅ Using {len(assigns)} assignments from schedule_assignments")
        except Exception as e:
            logger.warning(f"⚠️  schedule_assignments not available: {e}")

        rows: List[Dict] = []

        if assigns:
            # Build from normalized assignments
            pids = list(set(a["participant_id"] for a in assigns))
            try:
                res = sb.table("participants").select("*").in_("id", pids).execute()
                participants = res.data or []
            except Exception as e:
                logger.error(f"❌ Failed to fetch participants: {e}")
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
                try:
                    res = sb.table("participants").select("*").in_("id", pids).execute()
                    participants = res.data or []
                except Exception as e:
                    logger.error(f"❌ Failed to fetch participants: {e}")
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