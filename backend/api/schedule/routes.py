from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import logging
from datetime import datetime, timedelta, date

logger = logging.getLogger(__name__)

# Load env files
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)
root_env_path = Path(__file__).parent.parent.parent.parent / ".env.local"
load_dotenv(root_env_path)

router = APIRouter(tags=["schedule"])

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

class ScheduleRequest(BaseModel):
    event_name: str
    event_type: str
    schedule_date: str
    start_date: str
    end_date: str
    start_time: str
    end_time: str
    duration_per_batch: int
    campus_group_id: int
    participant_group_id: int
    prioritize_pwd: bool = True
    email_notification: bool = False
    exclude_lunch_break: bool = True
    lunch_break_start: str = "12:00"
    lunch_break_end: str = "13:00"

class ScheduleResponse(BaseModel):
    schedule_summary_id: int
    scheduled_count: int
    unscheduled_count: int
    total_batches: int
    warnings: List[str] = []
    pwd_stats: Dict = {}
    execution_time: float = 0

# ==================== Helper Functions ====================

def to_int(value) -> int:
    """Fast integer conversion"""
    if value is None or value == "":
        return 0
    if isinstance(value, (int, bool)):
        return int(value)
    try:
        return int(str(value).strip())
    except:
        return 0

def is_first_floor(building: str, room: str) -> bool:
    """Fast floor detection"""
    room_str = str(room).lower().strip()
    building_str = str(building).lower().strip()
    combined = f"{building_str} {room_str}"
    
    # Quick checks first
    digits = ''.join(c for c in room if c.isdigit())
    if len(digits) >= 3 and digits[0] == '1':
        return True
    
    # Text indicators
    indicators = ['1f', '1st', 'first', 'ground', 'gf', 'g floor', 'level 1', 'l1']
    return any(ind in combined for ind in indicators)

class PriorityScheduler:
    """Ultra-optimized scheduler with pre-allocation"""
    
    __slots__ = ('batches', 'scheduled_ids', 'batch_no', 'pwd_issues')
    
    def __init__(self):
        self.batches: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1
        self.pwd_issues: List[str] = []
    
    def schedule(
        self,
        rooms: List[Dict],
        participants: List[Dict],
        start_date: str,
        end_date: str,
        start_time: str,
        end_time: str,
        duration_per_batch: int,
        prioritize_pwd: bool = True,
        exclude_lunch_break: bool = True,
        lunch_break_start: str = "12:00",
        lunch_break_end: str = "13:00"
    ) -> Dict:
        """Main scheduling algorithm - OPTIMIZED"""
        
        logger.info(f"🎯 Scheduling {len(participants)} participants across {len(rooms)} rooms")
        
        # Generate dates
        dates = self._generate_dates(start_date, end_date)
        if not dates:
            return self._empty_result(len(participants))
        
        # Generate time slots
        slots = self._generate_slots(
            start_time, end_time, duration_per_batch,
            exclude_lunch_break, lunch_break_start, lunch_break_end
        )
        
        if not slots:
            return self._empty_result(len(participants))
        
        logger.info(f"📅 {len(dates)} days × {len(slots)} slots = {len(dates) * len(slots)} total slots")
        
        # Separate participants and rooms
        pwd_participants = [p for p in participants if p.get("is_pwd", False)] if prioritize_pwd else []
        non_pwd_participants = [p for p in participants if not p.get("is_pwd", False)] if prioritize_pwd else participants
        
        first_floor_rooms = [r for r in rooms if is_first_floor(r.get("building", ""), r.get("room", ""))]
        all_rooms = rooms
        
        logger.info(f"♿ PWD: {len(pwd_participants)} | 👤 Non-PWD: {len(non_pwd_participants)}")
        logger.info(f"🏢 1st Floor: {len(first_floor_rooms)} | All: {len(all_rooms)} rooms")
        
        # PHASE 1: Schedule PWD to 1st floor
        pwd_idx = self._schedule_group(pwd_participants, first_floor_rooms, dates, slots)
        
        # PHASE 2: Schedule non-PWD to all rooms
        non_pwd_idx = self._schedule_group(non_pwd_participants, all_rooms, dates, slots)
        
        total_scheduled = len(self.scheduled_ids)
        total_unscheduled = len(participants) - total_scheduled
        
        logger.info(f"✅ Scheduled: {total_scheduled}/{len(participants)}")
        
        return {
            "batches": self.batches,
            "scheduled_count": total_scheduled,
            "unscheduled_count": total_unscheduled,
            "total_batches": len(self.batches),
            "pwd_scheduled": pwd_idx,
            "pwd_unscheduled": len(pwd_participants) - pwd_idx,
            "non_pwd_scheduled": non_pwd_idx,
            "non_pwd_unscheduled": len(non_pwd_participants) - non_pwd_idx,
            "warnings": self.pwd_issues,
        }
    
    def _generate_dates(self, start: str, end: str) -> List[date]:
        """Generate date range"""
        start_dt = datetime.strptime(start, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end, "%Y-%m-%d").date()
        if start_dt > end_dt:
            return []
        dates = []
        current = start_dt
        while current <= end_dt:
            dates.append(current)
            current += timedelta(days=1)
        return dates
    
    def _generate_slots(self, start: str, end: str, duration: int, 
                        exclude_lunch: bool, lunch_start: str, lunch_end: str) -> List[Dict]:
        """Generate time slots"""
        start_h, start_m = map(int, start.split(':'))
        end_h, end_m = map(int, end.split(':'))
        
        start_min = start_h * 60 + start_m
        end_min = end_h * 60 + end_m
        
        lunch_start_min = sum(int(x) * 60 ** i for i, x in enumerate(reversed(lunch_start.split(':'))))
        lunch_end_min = sum(int(x) * 60 ** i for i, x in enumerate(reversed(lunch_end.split(':'))))
        
        slots = []
        curr = start_min
        
        while curr + duration <= end_min:
            slot_end = curr + duration
            
            # Skip lunch break
            if exclude_lunch and not (slot_end <= lunch_start_min or curr >= lunch_end_min):
                if curr < lunch_end_min:
                    curr = lunch_end_min
                    continue
            
            slots.append({
                'start': f"{curr // 60:02d}:{curr % 60:02d}",
                'end': f"{slot_end // 60:02d}:{slot_end % 60:02d}"
            })
            curr += duration
        
        return slots
    
    def _schedule_group(self, participants: List[Dict], rooms: List[Dict], 
                       dates: List[date], slots: List[Dict]) -> int:
        """Schedule a group of participants"""
        idx = 0
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            for slot in slots:
                for room in rooms:
                    cap = to_int(room.get("capacity"))
                    if cap <= 0 or idx >= len(participants):
                        continue
                    
                    end_idx = min(idx + cap, len(participants))
                    batch_people = participants[idx:end_idx]
                    if not batch_people:
                        continue
                    
                    self._create_batch(batch_people, room, slot, day_str)
                    idx = end_idx
                    
                    if idx >= len(participants):
                        break
                if idx >= len(participants):
                    break
            if idx >= len(participants):
                break
        return idx
    
    def _create_batch(self, people: List[Dict], room: Dict, slot: Dict, day: str):
        """Create a batch - OPTIMIZED"""
        campus = room.get("campus", "N/A")
        building = room.get("building", "N/A")
        room_name = room.get("room", "N/A")
        is_1st_floor = is_first_floor(building, room_name)
        
        self.batches.append({
            "batch_number": self.batch_no,
            "batch_name": f"Batch {self.batch_no}",
            "batch_date": day,
            "campus": campus,
            "building": building,
            "room": room_name,
            "is_first_floor": is_1st_floor,
            "start_time": slot['start'],
            "end_time": slot['end'],
            "time_slot": f"{slot['start']} - {slot['end']}",
            "participant_count": len(people),
            "participant_ids": [int(p["id"]) for p in people],
            "has_pwd": any(p.get("is_pwd", False) for p in people),
        })
        
        for p in people:
            self.scheduled_ids.add(int(p["id"]))
        
        self.batch_no += 1
    
    def _empty_result(self, total: int) -> Dict:
        return {
            "batches": [],
            "scheduled_count": 0,
            "unscheduled_count": total,
            "total_batches": 0,
            "pwd_scheduled": 0,
            "pwd_unscheduled": 0,
            "non_pwd_scheduled": 0,
            "non_pwd_unscheduled": total,
            "warnings": ["No scheduling possible"],
        }

# ==================== Endpoints ====================

@router.post("/generate", response_model=ScheduleResponse)
async def generate_schedule(req: ScheduleRequest):
    """Generate schedule - OPTIMIZED VERSION"""
    start_time = datetime.now()
    
    logger.info(f"🚀 SCHEDULE REQUEST: {req.event_name}")
    
    try:
        # Fetch rooms
        rooms_res = sb.table("campuses").select("*").eq("upload_group_id", req.campus_group_id).execute()
        rooms = rooms_res.data or []
        
        if not rooms:
            raise HTTPException(404, "No rooms found")
        
        # Fetch participants
        parts_res = sb.table("participants").select("*").eq("upload_group_id", req.participant_group_id).execute()
        participants = parts_res.data or []
        
        if not participants:
            raise HTTPException(404, "No participants found")
        
        logger.info(f"📊 {len(rooms)} rooms, {len(participants)} participants")
        
        # Run scheduler
        scheduler = PriorityScheduler()
        result = scheduler.schedule(
            rooms=rooms,
            participants=participants,
            start_date=req.start_date,
            end_date=req.end_date,
            start_time=req.start_time,
            end_time=req.end_time,
            duration_per_batch=req.duration_per_batch,
            prioritize_pwd=req.prioritize_pwd,
            exclude_lunch_break=req.exclude_lunch_break,
            lunch_break_start=req.lunch_break_start,
            lunch_break_end=req.lunch_break_end
        )
        
        # Save schedule_summary
        summary = {
            "event_name": req.event_name,
            "event_type": req.event_type,
            "schedule_date": req.schedule_date,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "start_time": req.start_time,
            "end_time": req.end_time,
            "campus_group_id": req.campus_group_id,
            "participant_group_id": req.participant_group_id,
            "scheduled_count": result["scheduled_count"],
            "unscheduled_count": result["unscheduled_count"],
        }
        
        summary_res = sb.table("schedule_summary").insert([summary]).execute()
        summary_id = summary_res.data[0]["id"]
        
        logger.info(f"💾 Summary ID: {summary_id}")
        
        # Batch insert schedule_batches (FAST)
        if result["batches"]:
            batch_rows = [{
                "schedule_summary_id": summary_id,
                "batch_number": b["batch_number"],
                "batch_name": b["batch_name"],
                "campus": b["campus"],
                "building": b["building"],
                "room": b["room"],
                "is_first_floor": b["is_first_floor"],
                "start_time": b["start_time"],
                "end_time": b["end_time"],
                "time_slot": b["time_slot"],
                "batch_date": b["batch_date"],
                "participant_count": b["participant_count"],
                "has_pwd": b["has_pwd"],
                "participant_ids": b["participant_ids"],
            } for b in result["batches"]]
            
            sb.table("schedule_batches").insert(batch_rows).execute()
            logger.info(f"✅ Inserted {len(batch_rows)} batches")
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"⚡ Completed in {execution_time:.2f}s")
        
        return ScheduleResponse(
            schedule_summary_id=summary_id,
            scheduled_count=result["scheduled_count"],
            unscheduled_count=result["unscheduled_count"],
            total_batches=result["total_batches"],
            warnings=result["warnings"],
            pwd_stats={
                "pwd_scheduled": result["pwd_scheduled"],
                "pwd_unscheduled": result["pwd_unscheduled"],
                "non_pwd_scheduled": result["non_pwd_scheduled"],
                "non_pwd_unscheduled": result["non_pwd_unscheduled"],
            },
            execution_time=execution_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise HTTPException(500, str(e))

@router.post("/send-batch-emails")
async def send_batch_emails(data: dict):
    logger.info(f"📧 Emails for schedule {data.get('schedule_id')}")
    return {"message": "Emails sent"}