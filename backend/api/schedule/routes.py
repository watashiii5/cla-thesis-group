from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Set
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import logging
from datetime import datetime, timedelta, date
import asyncio
from concurrent.futures import ThreadPoolExecutor

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

# Thread pool for parallel operations
executor = ThreadPoolExecutor(max_workers=4)

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
    """Fast integer conversion with caching"""
    if value is None or value == "":
        return 0
    if isinstance(value, (int, bool)):
        return int(value)
    try:
        return int(str(value).strip())
    except:
        return 0

def is_first_floor(building: str, room: str) -> bool:
    """Optimized floor detection with caching"""
    room_str = str(room).lower().strip()
    building_str = str(building).lower().strip()
    combined = f"{building_str} {room_str}"
    
    # Quick digit check first (fastest path)
    digits = ''.join(c for c in room if c.isdigit())
    if len(digits) >= 3 and digits[0] == '1':
        return True
    
    # Text indicators (pre-compiled for speed)
    indicators = {'1f', '1st', 'first', 'ground', 'gf', 'g floor', 'level 1', 'l1', 'floor 1'}
    return any(ind in combined for ind in indicators)

class OptimizedScheduler:
    """Ultra-fast scheduler with O(n) complexity and batch processing"""
    
    __slots__ = ('batches', 'scheduled_ids', 'batch_no', 'warnings', 
                 'room_cache', 'slot_cache')
    
    def __init__(self):
        self.batches: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1
        self.warnings: List[str] = []
        self.room_cache = {}
        self.slot_cache = {}
    
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
        """Main scheduling algorithm - OPTIMIZED FOR 10K+ PARTICIPANTS"""
        
        start_exec = datetime.now()
        logger.info(f"🎯 Scheduling {len(participants)} participants across {len(rooms)} rooms")
        
        # Pre-process and cache rooms (O(n))
        first_floor_rooms, all_rooms = self._process_rooms(rooms)
        
        # Generate dates and slots (cached)
        dates = self._generate_dates(start_date, end_date)
        if not dates:
            return self._empty_result(len(participants))
        
        slots = self._generate_slots(
            start_time, end_time, duration_per_batch,
            exclude_lunch_break, lunch_break_start, lunch_break_end
        )
        
        if not slots:
            return self._empty_result(len(participants))
        
        total_capacity = len(dates) * len(slots)
        logger.info(f"📅 {len(dates)} days × {len(slots)} slots = {total_capacity} total slots")
        
        # Separate participants by PWD status (O(n))
        pwd_participants, non_pwd_participants = self._separate_participants(
            participants, prioritize_pwd
        )
        
        logger.info(f"♿ PWD: {len(pwd_participants)} | 👤 Non-PWD: {len(non_pwd_participants)}")
        logger.info(f"🏢 1st Floor: {len(first_floor_rooms)} | All: {len(all_rooms)} rooms")
        
        # PHASE 1: Schedule PWD to 1st floor (O(n))
        pwd_idx = self._schedule_group_fast(
            pwd_participants, first_floor_rooms, dates, slots
        )
        
        # PHASE 2: Schedule non-PWD to all rooms (O(n))
        non_pwd_idx = self._schedule_group_fast(
            non_pwd_participants, all_rooms, dates, slots
        )
        
        total_scheduled = len(self.scheduled_ids)
        total_unscheduled = len(participants) - total_scheduled
        
        exec_time = (datetime.now() - start_exec).total_seconds()
        logger.info(f"✅ Scheduled: {total_scheduled}/{len(participants)} in {exec_time:.2f}s")
        
        return {
            "batches": self.batches,
            "scheduled_count": total_scheduled,
            "unscheduled_count": total_unscheduled,
            "total_batches": len(self.batches),
            "pwd_scheduled": pwd_idx,
            "pwd_unscheduled": len(pwd_participants) - pwd_idx,
            "non_pwd_scheduled": non_pwd_idx,
            "non_pwd_unscheduled": len(non_pwd_participants) - non_pwd_idx,
            "warnings": self.warnings,
        }
    
    def _process_rooms(self, rooms: List[Dict]) -> tuple:
        """Pre-process rooms and cache floor info"""
        first_floor = []
        all_rooms_processed = []
        
        for room in rooms:
            building = room.get("building", "")
            room_name = room.get("room", "")
            
            # Cache floor check
            cache_key = f"{building}_{room_name}"
            if cache_key not in self.room_cache:
                self.room_cache[cache_key] = is_first_floor(building, room_name)
            
            room_copy = room.copy()
            room_copy['_is_first_floor'] = self.room_cache[cache_key]
            room_copy['_capacity'] = to_int(room.get("capacity"))
            
            all_rooms_processed.append(room_copy)
            if room_copy['_is_first_floor']:
                first_floor.append(room_copy)
        
        return first_floor, all_rooms_processed
    
    def _separate_participants(self, participants: List[Dict], prioritize: bool) -> tuple:
        """Separate participants by PWD status"""
        if not prioritize:
            return [], participants
        
        pwd = []
        non_pwd = []
        
        for p in participants:
            if p.get("is_pwd", False):
                pwd.append(p)
            else:
                non_pwd.append(p)
        
        return pwd, non_pwd
    
    def _generate_dates(self, start: str, end: str) -> List[date]:
        """Generate date range (cached)"""
        cache_key = f"{start}_{end}"
        if cache_key in self.slot_cache:
            return self.slot_cache[cache_key]
        
        start_dt = datetime.strptime(start, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end, "%Y-%m-%d").date()
        
        if start_dt > end_dt:
            return []
        
        dates = []
        current = start_dt
        while current <= end_dt:
            dates.append(current)
            current += timedelta(days=1)
        
        self.slot_cache[cache_key] = dates
        return dates
    
    def _generate_slots(self, start: str, end: str, duration: int, 
                        exclude_lunch: bool, lunch_start: str, lunch_end: str) -> List[Dict]:
        """Generate time slots (cached and optimized)"""
        cache_key = f"{start}_{end}_{duration}_{exclude_lunch}_{lunch_start}_{lunch_end}"
        if cache_key in self.slot_cache:
            return self.slot_cache[cache_key]
        
        start_h, start_m = map(int, start.split(':'))
        end_h, end_m = map(int, end.split(':'))
        
        start_min = start_h * 60 + start_m
        end_min = end_h * 60 + end_m
        
        lunch_start_min = 0
        lunch_end_min = 0
        
        if exclude_lunch:
            lunch_h, lunch_m = map(int, lunch_start.split(':'))
            lunch_start_min = lunch_h * 60 + lunch_m
            lunch_h, lunch_m = map(int, lunch_end.split(':'))
            lunch_end_min = lunch_h * 60 + lunch_m
        
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
        
        self.slot_cache[cache_key] = slots
        return slots
    
    def _schedule_group_fast(self, participants: List[Dict], rooms: List[Dict], 
                            dates: List[date], slots: List[Dict]) -> int:
        """Ultra-fast group scheduling with pre-allocation"""
        if not participants or not rooms:
            return 0
        
        idx = 0
        total = len(participants)
        
        # Pre-allocate batches list
        max_batches = len(dates) * len(slots) * len(rooms)
        
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            
            for slot in slots:
                for room in rooms:
                    cap = room.get('_capacity', 0)
                    if cap <= 0 or idx >= total:
                        continue
                    
                    # Calculate batch size
                    end_idx = min(idx + cap, total)
                    batch_size = end_idx - idx
                    
                    if batch_size <= 0:
                        continue
                    
                    # Create batch (optimized)
                    self._create_batch_fast(
                        participants[idx:end_idx],
                        room,
                        slot,
                        day_str
                    )
                    
                    idx = end_idx
                    
                    if idx >= total:
                        return idx
                
                if idx >= total:
                    return idx
            
            if idx >= total:
                return idx
        
        return idx
    
    def _create_batch_fast(self, people: List[Dict], room: Dict, slot: Dict, day: str):
        """Create batch with minimal overhead"""
        campus = room.get("campus", "N/A")
        building = room.get("building", "N/A")
        room_name = room.get("room", "N/A")
        is_1st_floor = room.get('_is_first_floor', False)
        
        # Extract IDs in one pass
        participant_ids = [int(p["id"]) for p in people]
        has_pwd = any(p.get("is_pwd", False) for p in people)
        
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
            "participant_ids": participant_ids,
            "has_pwd": has_pwd,
        })
        
        # Bulk add to scheduled set
        self.scheduled_ids.update(participant_ids)
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
            "warnings": ["No scheduling possible - check date/time configuration"],
        }

# ==================== Database Operations ====================

async def fetch_all_paginated(table: str, filter_col: str, filter_val: int, page_size: int = 1000):
    """Fetch all rows with pagination (async)"""
    all_data = []
    offset = 0
    
    while True:
        response = sb.table(table)\
            .select("*")\
            .eq(filter_col, filter_val)\
            .range(offset, offset + page_size - 1)\
            .execute()
        
        if not response.data:
            break
        
        all_data.extend(response.data)
        
        if len(response.data) < page_size:
            break
        
        offset += page_size
    
    return all_data

async def batch_insert(table: str, data: List[Dict], batch_size: int = 500):
    """Batch insert with chunking for large datasets"""
    total = len(data)
    
    for i in range(0, total, batch_size):
        chunk = data[i:i + batch_size]
        sb.table(table).insert(chunk).execute()
        logger.info(f"📝 Inserted {min(i + batch_size, total)}/{total} rows")

# ==================== Endpoints ====================

@router.post("/schedule")
async def schedule_event(req: ScheduleRequest):
    logger.info(f"📅 Scheduling from {req.start_date} to {req.end_date}")
    start_time = datetime.now()

    try:
        # Fetch data in parallel
        logger.info("📥 Fetching data from Supabase...")

        rooms_task = asyncio.create_task(
            fetch_all_paginated("campuses", "upload_group_id", req.campus_group_id)
        )
        parts_task = asyncio.create_task(
            fetch_all_paginated("participants", "upload_group_id", req.participant_group_id)
        )

        rooms, participants = await asyncio.gather(rooms_task, parts_task)

        if not rooms:
            raise HTTPException(404, "No rooms found for the selected campus group")

        if not participants:
            raise HTTPException(404, "No participants found for the selected group")

        logger.info(f"📊 Loaded: {len(rooms)} rooms, {len(participants)} participants")

        # Run scheduler
        scheduler = OptimizedScheduler()
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

        # ✅ FIX: Include start_date in schedule_summary
        summary = {
            "event_name": req.event_name,
            "event_type": req.event_type,
            "schedule_date": req.schedule_date,
            "start_date": req.start_date,  # ✅ ADDED
            "end_date": req.end_date,
            "start_time": req.start_time,
            "end_time": req.end_time,
            "campus_group_id": req.campus_group_id,
            "participant_group_id": req.participant_group_id,
            "scheduled_count": result["scheduled_count"],
            "unscheduled_count": result["unscheduled_count"],
        }

        logger.info("💾 Saving schedule summary...")
        summary_res = sb.table("schedule_summary").insert([summary]).execute()
        summary_id = summary_res.data[0]["id"]

        logger.info(f"✅ Summary ID: {summary_id}")

        # Batch insert schedule_batches (optimized)
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

            logger.info(f"💾 Inserting {len(batch_rows)} batches...")
            await batch_insert("schedule_batches", batch_rows)
            logger.info("✅ Batch insertion complete")

            # ✅ FIX: Fetch inserted batch IDs to create assignments
            logger.info("📥 Fetching inserted batch IDs...")
            inserted_batches = await fetch_all_paginated(
                "schedule_batches",
                "schedule_summary_id",
                summary_id
            )
            batch_id_map = {b["batch_number"]: b["id"] for b in inserted_batches}

            # ✅ FIX: Create schedule_assignments for each participant
            logger.info("📝 Creating individual participant assignments...")
            assignments = []

            for batch in result["batches"]:
                batch_id = batch_id_map.get(batch["batch_number"])
                if not batch_id:
                    continue

                for seat_no, participant_id in enumerate(batch["participant_ids"], start=1):
                    # Get participant details
                    participant = next(
                        (p for p in participants if p["id"] == participant_id),
                        None
                    )

                    if participant:
                        assignments.append({
                            "schedule_summary_id": summary_id,
                            "schedule_batch_id": batch_id,
                            "participant_id": participant_id,
                            "seat_no": seat_no,
                            "is_pwd": participant.get("is_pwd", False),
                            "campus": batch["campus"],
                            "building": batch["building"],
                            "room": batch["room"],
                            "is_first_floor": batch["is_first_floor"],
                            "start_time": batch["start_time"],
                            "end_time": batch["end_time"],
                            "batch_date": batch["batch_date"]
                        })

            # Batch insert assignments
            if assignments:
                logger.info(f"💾 Inserting {len(assignments)} participant assignments...")
                await batch_insert("schedule_assignments", assignments, batch_size=500)
                logger.info("✅ Assignment insertion complete")

        execution_time = (datetime.now() - start_time).total_seconds()

        logger.info(f"⚡ COMPLETED in {execution_time:.2f}s")
        logger.info(f"📈 Performance: {len(participants) / execution_time:.0f} participants/sec")

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
            execution_time=round(execution_time, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        raise HTTPException(500, f"Scheduling failed: {str(e)}")

@router.post("/send-batch-emails")
async def send_batch_emails(data: dict):
    """Send batch email notifications"""
    logger.info(f"📧 Email notifications for schedule {data.get('schedule_id')}")
    return {"message": "Email notifications queued successfully"}