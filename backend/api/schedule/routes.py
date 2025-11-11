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

# Create Supabase client with connection pooling
sb: Client = create_client(
    SUPABASE_URL, 
    SUPABASE_KEY,
)

# Thread pool for parallel operations (reduced to prevent exhaustion)
executor = ThreadPoolExecutor(max_workers=2)

# ==================== Models ====================

class ScheduleRequest(BaseModel):
    event_name: str
    event_type: str
    schedule_date: str
    start_date: str
    end_date: str
    start_time: str
    end_time: str  # ✅ FIXED: Was duplicate 'end_date'
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

def fetch_all_paginated(table: str, filter_column: str, filter_value: any) -> List[Dict]:
    """
    Fetch all rows from a table with pagination to avoid row limits.
    
    Args:
        table: Table name to query
        filter_column: Column to filter by
        filter_value: Value to filter on
    
    Returns:
        List of all matching rows
    """
    PAGE_SIZE = 1000
    all_data = []
    page = 0
    
    while True:
        start = page * PAGE_SIZE
        end = start + PAGE_SIZE - 1
        
        try:
            response = sb.table(table)\
                .select("*")\
                .eq(filter_column, filter_value)\
                .range(start, end)\
                .execute()
            
            if not response.data:
                break
            
            all_data.extend(response.data)
            
            # If we got less than PAGE_SIZE rows, we've reached the end
            if len(response.data) < PAGE_SIZE:
                break
            
            page += 1
            
        except Exception as e:
            logger.error(f"❌ Error fetching {table} page {page}: {e}")
            break
    
    logger.info(f"✅ Fetched {len(all_data)} rows from {table}")
    return all_data

def batch_insert(table: str, data: List[Dict], batch_size: int = 500) -> List[int]:
    """
    Insert data in batches to avoid payload limits.
    
    Args:
        table: Table name
        data: List of records to insert
        batch_size: Number of records per batch
    
    Returns:
        List of failed batch indices
    """
    failed_batches = []
    total_batches = (len(data) + batch_size - 1) // batch_size
    
    for i in range(0, len(data), batch_size):
        batch_num = i // batch_size + 1
        chunk = data[i:i + batch_size]
        
        try:
            response = sb.table(table).insert(chunk).execute()
            
            if not response.data:
                logger.error(f"❌ Batch {batch_num}/{total_batches} failed: No data returned")
                failed_batches.append(batch_num)
            else:
                logger.info(f"✅ Inserted batch {batch_num}/{total_batches} ({len(chunk)} records)")
                
        except Exception as e:
            logger.error(f"❌ Batch {batch_num}/{total_batches} failed: {e}")
            failed_batches.append(batch_num)
    
    return failed_batches

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
                 'room_cache', 'slot_cache', 'assignments', 'batch_assignments_map',
                 'room_slot_usage')  # ✅ NEW: Track room usage per slot
    
    def __init__(self):
        self.batches: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1
        self.warnings: List[str] = []
        self.room_cache = {}
        self.slot_cache = {}
        self.assignments = []
        self.batch_assignments_map = {}
        self.room_slot_usage = {}  # ✅ NEW: {(date, slot_idx, room_key): remaining_capacity}
    
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
        """Main scheduling algorithm - FULLY FIXED"""
        
        start_exec = datetime.now()
        logger.info(f"🎯 Starting scheduling for {len(participants)} participants")
        
        # Pre-process and cache rooms
        first_floor_rooms, all_rooms = self._process_rooms(rooms)
        
        # ✅ NEW: Initialize room usage tracking
        dates = self._generate_dates(start_date, end_date)
        if not dates:
            logger.error("❌ No valid dates generated")
            return self._empty_result(len(participants))
        
        slots = self._generate_slots(
            start_time, end_time, duration_per_batch,
            exclude_lunch_break, lunch_break_start, lunch_break_end
        )
        
        if not slots:
            logger.error("❌ No valid time slots generated")
            return self._empty_result(len(participants))
        
        # ✅ NEW: Initialize room capacity tracking for each slot
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            for slot_idx in range(len(slots)):
                for room in all_rooms:
                    room_key = f"{room['campus']}|{room['building']}|{room['room']}"
                    usage_key = (day_str, slot_idx, room_key)
                    self.room_slot_usage[usage_key] = room.get('_capacity', 0)
        
        # Calculate capacity
        total_room_capacity = sum(room.get('_capacity', 0) for room in all_rooms)
        total_slots = len(dates) * len(slots)
        total_capacity = total_room_capacity * total_slots
        
        logger.info(f"📊 CAPACITY ANALYSIS:")
        logger.info(f"   📅 Days: {len(dates)}")
        logger.info(f"   🕐 Slots per day: {len(slots)}")
        logger.info(f"   ⏰ Total time slots: {total_slots}")
        logger.info(f"   🏢 Total rooms: {len(all_rooms)}")
        logger.info(f"   💺 Total room capacity: {total_room_capacity}")
        logger.info(f"   🎯 TOTAL CAPACITY: {total_capacity} participants")
        logger.info(f"   👥 Participants to schedule: {len(participants)}")
        
        if len(participants) > total_capacity:
            shortage = len(participants) - total_capacity
            logger.error(f"❌ CAPACITY EXCEEDED: Need {shortage} more spaces!")
            self.warnings.append(
                f"Insufficient capacity: {len(participants)} participants but only {total_capacity} spaces available. "
                f"Need {shortage} more capacity."
            )
            return self._empty_result(len(participants))
        
        # Separate participants by PWD status
        pwd_participants, non_pwd_participants = self._separate_participants(
            participants, prioritize_pwd
        )
        
        logger.info(f"♿ PWD participants: {len(pwd_participants)}")
        logger.info(f"👤 Non-PWD participants: {len(non_pwd_participants)}")
        logger.info(f"🏢 1st Floor rooms: {len(first_floor_rooms)}")
        logger.info(f"🏢 All rooms: {len(all_rooms)}")
        
        # Validate PWD capacity
        first_floor_capacity = sum(r.get('_capacity', 0) for r in first_floor_rooms) * total_slots
        if prioritize_pwd and len(pwd_participants) > first_floor_capacity:
            logger.warning(f"⚠️ PWD participants ({len(pwd_participants)}) exceed 1st floor capacity ({first_floor_capacity})")
            self.warnings.append(
                f"PWD participants ({len(pwd_participants)}) exceed 1st floor capacity ({first_floor_capacity}). "
                f"Some PWD participants will be assigned to upper floors."
            )
        
        # ✅ FIXED: Schedule PWD first, then non-PWD (no separate phases)
        pwd_idx = 0
        non_pwd_idx = 0
        
        if prioritize_pwd and pwd_participants:
            logger.info("🔄 PHASE 1: Scheduling PWD participants to 1st floor rooms...")
            pwd_idx = self._schedule_group_optimized(
                pwd_participants, first_floor_rooms, dates, slots
            )
            logger.info(f"✅ PWD Phase: {pwd_idx}/{len(pwd_participants)} scheduled")
            
            # If there are unscheduled PWD, schedule them to all rooms
            if pwd_idx < len(pwd_participants):
                remaining_pwd = pwd_participants[pwd_idx:]
                logger.info(f"⚠️ Scheduling {len(remaining_pwd)} remaining PWD to all rooms...")
                additional_pwd = self._schedule_group_optimized(
                    remaining_pwd, all_rooms, dates, slots
                )
                pwd_idx += additional_pwd
        
        logger.info("🔄 PHASE 2: Scheduling Non-PWD participants to all rooms...")
        non_pwd_idx = self._schedule_group_optimized(
            non_pwd_participants, all_rooms, dates, slots
        )
        logger.info(f"✅ Non-PWD Phase: {non_pwd_idx}/{len(non_pwd_participants)} scheduled")
        
        total_scheduled = len(self.scheduled_ids)
        total_unscheduled = len(participants) - total_scheduled
        
        exec_time = (datetime.now() - start_exec).total_seconds()
        
        logger.info(f"")
        logger.info(f"{'='*60}")
        logger.info(f"✅ SCHEDULING COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"📊 Total Participants: {len(participants)}")
        logger.info(f"✅ Scheduled: {total_scheduled} ({(total_scheduled/len(participants)*100):.1f}%)")
        logger.info(f"❌ Unscheduled: {total_unscheduled}")
        logger.info(f"🏢 Total Batches Created: {len(self.batches)}")
        logger.info(f"⏱️ Execution Time: {exec_time:.2f}s")
        logger.info(f"{'='*60}")
        
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
            "execution_time": exec_time
        }
    
    def _schedule_group_optimized(self, participants: List[Dict], rooms: List[Dict], 
                                  dates: List[date], slots: List[Dict]) -> int:
        """
        ✅ FULLY FIXED: Schedule participants with room tracking to prevent conflicts
        """
        if not participants or not rooms:
            return 0
        
        idx = 0
        total = len(participants)
        
        # Iterate in order: DAY → SLOT → ROOM
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            
            for slot_idx, slot in enumerate(slots):
                if idx >= total:
                    logger.info(f"✅ All {total} participants scheduled!")
                    return idx
                
                logger.info(f"📅 {day_str} | 🕐 Slot {slot_idx + 1}/{len(slots)}: {slot['start']}-{slot['end']}")
                
                # Fill rooms for this time slot
                for room in rooms:
                    if idx >= total:
                        return idx
                    
                    room_key = f"{room['campus']}|{room['building']}|{room['room']}"
                    usage_key = (day_str, slot_idx, room_key)
                    
                    # ✅ CRITICAL: Check remaining capacity for this specific slot
                    remaining_capacity = self.room_slot_usage.get(usage_key, 0)
                    
                    if remaining_capacity <= 0:
                        continue
                    
                    # ✅ CRITICAL: Only fill up to remaining capacity
                    remaining_participants = total - idx
                    batch_size = min(remaining_capacity, remaining_participants)
                    
                    if batch_size <= 0:
                        continue
                    
                    # Get participants for this batch
                    batch_participants = participants[idx:idx + batch_size]
                    
                    # Create batch
                    self._create_batch_fast(
                        batch_participants,
                        room,
                        slot,
                        day_str
                    )
                    
                    # ✅ CRITICAL: Update remaining capacity
                    self.room_slot_usage[usage_key] -= batch_size
                    
                    room_capacity = room.get('_capacity', 0)
                    utilization = (batch_size / room_capacity) * 100 if room_capacity > 0 else 0
                    logger.info(
                        f"   📍 {room.get('campus')} | {room.get('building')} | "
                        f"Room {room.get('room')} | "
                        f"Capacity: {room_capacity} | "
                        f"Scheduled: {batch_size} | "
                        f"Remaining: {self.room_slot_usage[usage_key]} | "
                        f"Utilization: {utilization:.1f}% | "
                        f"Progress: {idx + batch_size}/{total}"
                    )
                    
                    idx += batch_size
        
        if idx < total:
            logger.warning(f"⚠️ Only scheduled {idx}/{total} participants")
        
        return idx
    
    def _create_batch_fast(self, people: List[Dict], room: Dict, slot: Dict, day: str):
        """Create batch with proper assignments"""
        campus = room.get("campus", "N/A")
        building = room.get("building", "N/A")
        room_name = room.get("room", "N/A")
        is_1st_floor = room.get('_is_first_floor', False)
        capacity = room.get('_capacity', 0)
        
        # ✅ FIXED: Batch number is sequential across all days/slots/rooms
        batch_name = f"Batch {self.batch_no}"
        
        # Create batch record
        batch = {
            "batch_number": self.batch_no,
            "batch_name": batch_name,
            "batch_date": day,
            "campus": campus,
            "building": building,
            "room": room_name,
            "is_first_floor": is_1st_floor,
            "start_time": slot['start'],
            "end_time": slot['end'],
            "time_slot": f"{slot['start']} - {slot['end']}",
            "participant_count": len(people),
            "participant_ids": [p["id"] for p in people],
            "has_pwd": any(p.get("is_pwd", False) for p in people),
        }
        
        self.batches.append(batch)
        
        # ✅ FIXED: Store assignments with batch number for later mapping
        batch_assignments = []
        for seat_no, participant in enumerate(people, start=1):
            assignment = {
                "participant_id": participant["id"],
                "seat_no": seat_no,
                "is_pwd": participant.get("is_pwd", False),
                "campus": campus,
                "building": building,
                "room": room_name,
                "is_first_floor": is_1st_floor,
                "start_time": slot['start'],
                "end_time": slot['end'],
                "batch_date": day,
                "batch_number": self.batch_no  # Store batch number for mapping
            }
            batch_assignments.append(assignment)
            self.assignments.append(assignment)
        
        # Store mapping for later
        self.batch_assignments_map[self.batch_no] = batch_assignments
        
        # Track scheduled IDs
        self.scheduled_ids.update(p["id"] for p in people)
        self.batch_no += 1
    
    def _process_rooms(self, rooms: List[Dict]) -> tuple:
        """Pre-process rooms and cache floor info"""
        first_floor = []
        all_rooms_processed = []
        
        for room in rooms:
            building = room.get("building", "")
            room_name = room.get("room", "")
            capacity = to_int(room.get("capacity", 0))
            
            # Skip rooms with 0 capacity
            if capacity <= 0:
                logger.warning(f"⚠️ Skipping room {building} - {room_name} (0 capacity)")
                continue
            
            # Cache floor check
            cache_key = f"{building}_{room_name}"
            if cache_key not in self.room_cache:
                self.room_cache[cache_key] = is_first_floor(building, room_name)
            
            room_copy = room.copy()
            room_copy['_is_first_floor'] = self.room_cache[cache_key]
            room_copy['_capacity'] = capacity
            
            all_rooms_processed.append(room_copy)
            if room_copy['_is_first_floor']:
                first_floor.append(room_copy)
        
        logger.info(f"🏢 Processed {len(all_rooms_processed)} rooms ({len(first_floor)} on 1st floor)")
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
        """Generate date range"""
        try:
            start_dt = datetime.strptime(start, "%Y-%m-%d").date()
            end_dt = datetime.strptime(end, "%Y-%m-%d").date()
            
            if start_dt > end_dt:
                logger.error(f"❌ Invalid date range: {start} > {end}")
                return []
            
            dates = []
            current = start_dt
            while current <= end_dt:
                dates.append(current)
                current += timedelta(days=1)
            
            logger.info(f"📅 Generated {len(dates)} days: {start} to {end}")
            return dates
        except Exception as e:
            logger.error(f"❌ Error generating dates: {e}")
            return []
    
    def _generate_slots(self, start: str, end: str, duration: int, 
                        exclude_lunch: bool, lunch_start: str, lunch_end: str) -> List[Dict]:
        """Generate time slots with lunch break handling"""
        try:
            start_h, start_m = map(int, start.split(':'))
            end_h, end_m = map(int, end.split(':'))
            
            start_min = start_h * 60 + start_m
            end_min = end_h * 60 + end_m
            
            if start_min >= end_min:
                logger.error(f"❌ Invalid time range: {start} >= {end}")
                return []
            
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
                
                # Skip if slot overlaps with lunch
                if exclude_lunch:
                    if curr < lunch_end_min and slot_end > lunch_start_min:
                        # Slot overlaps with lunch, skip to after lunch
                        if curr < lunch_end_min:
                            curr = lunch_end_min
                            continue
                
                slots.append({
                    'start': f"{curr // 60:02d}:{curr % 60:02d}",
                    'end': f"{slot_end // 60:02d}:{slot_end % 60:02d}"
                })
                curr += duration
            
            logger.info(f"🕐 Generated {len(slots)} time slots (duration: {duration}min)")
            if exclude_lunch:
                logger.info(f"   Lunch break: {lunch_start} - {lunch_end}")
            
            return slots
        except Exception as e:
            logger.error(f"❌ Error generating slots: {e}")
            return []
    
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
            "warnings": self.warnings if self.warnings else ["Scheduling failed - check configuration"],
            "execution_time": 0
        }

# ==================== Endpoints ====================

@router.post("/schedule")
async def schedule_event(req: ScheduleRequest):
    try:
        logger.info("="*60)
        logger.info("🚀 STARTING SCHEDULE GENERATION")
        logger.info("="*60)
        logger.info(f"Event: {req.event_name}")
        logger.info(f"Type: {req.event_type}")
        logger.info(f"Date Range: {req.start_date} to {req.end_date}")
        logger.info(f"Time: {req.start_time} - {req.end_time}")
        logger.info(f"Duration per batch: {req.duration_per_batch} minutes")
        logger.info(f"Exclude lunch: {req.exclude_lunch_break}")
        if req.exclude_lunch_break:
            logger.info(f"Lunch break: {req.lunch_break_start} - {req.lunch_break_end}")
        logger.info(f"Prioritize PWD: {req.prioritize_pwd}")
        
        # Fetch ALL data
        logger.info(f"\n📥 Fetching data from database...")
        rooms = fetch_all_paginated("campuses", "upload_group_id", req.campus_group_id)
        participants = fetch_all_paginated("participants", "upload_group_id", req.participant_group_id)

        if not rooms:
            raise HTTPException(status_code=404, detail="No rooms found for this campus group")
        if not participants:
            raise HTTPException(status_code=404, detail="No participants found for this participant group")

        logger.info(f"✅ Fetched {len(rooms)} rooms")
        logger.info(f"✅ Fetched {len(participants)} participants")

        # Initialize scheduler and run
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

        # ✅ FIXED: Check if scheduling was successful
        if result["scheduled_count"] == 0:
            logger.error("❌ No participants were scheduled!")
            raise HTTPException(
                status_code=400,
                detail="Scheduling failed: " + "; ".join(result.get("warnings", ["Unknown error"]))
            )

        # Create schedule summary
        logger.info("\n💾 Saving to database...")
        summary_data = {
            "event_name": req.event_name,
            "event_type": req.event_type,
            "schedule_date": req.schedule_date,
            "start_time": req.start_time,
            "end_time": req.end_time,
            "scheduled_count": result["scheduled_count"],
            "unscheduled_count": result["unscheduled_count"],
            "campus_group_id": req.campus_group_id,
            "participant_group_id": req.participant_group_id
        }

        summary_response = sb.table("schedule_summary").insert(summary_data).execute()
        if not summary_response.data:
            raise HTTPException(status_code=500, detail="Failed to create schedule summary")
        
        summary_id = summary_response.data[0]["id"]
        logger.info(f"✅ Created schedule summary (ID: {summary_id})")

        # Insert batches
        if result["batches"]:
            batches_data = []
            for batch in result["batches"]:
                batch["schedule_summary_id"] = summary_id
                batches_data.append(batch)
            
            batches_response = sb.table("schedule_batches").insert(batches_data).execute()
            if not batches_response.data:
                raise HTTPException(status_code=500, detail="Failed to create batches")

            logger.info(f"✅ Created {len(batches_response.data)} batches")

            # ✅ FIXED: Create batch ID mapping using batch_number
            batch_id_map = {
                batch["batch_number"]: batch["id"]
                for batch in batches_response.data
            }

            # ✅ FIXED: Create assignments with correct batch IDs
            assignments_data = []
            for assignment in scheduler.assignments:
                batch_number = assignment["batch_number"]
                batch_id = batch_id_map.get(batch_number)
                
                if batch_id:
                    assignment_copy = assignment.copy()
                    assignment_copy["schedule_summary_id"] = summary_id
                    assignment_copy["schedule_batch_id"] = batch_id
                    del assignment_copy["batch_number"]  # Remove temporary field
                    assignments_data.append(assignment_copy)

            # Insert assignments
            if assignments_data:
                logger.info(f"💾 Inserting {len(assignments_data)} assignments...")
                failed_chunks = batch_insert("schedule_assignments", assignments_data, batch_size=500)
                
                if failed_chunks:
                    logger.error(f"❌ Failed to insert {len(failed_chunks)} assignment chunks")
                else:
                    logger.info(f"✅ All assignments inserted successfully")

        logger.info("\n" + "="*60)
        logger.info("✅ SCHEDULE GENERATION COMPLETE")
        logger.info("="*60)

        return ScheduleResponse(
            schedule_summary_id=summary_id,
            scheduled_count=result["scheduled_count"],
            unscheduled_count=result["unscheduled_count"],
            total_batches=len(result["batches"]),
            warnings=result.get("warnings", []),
            pwd_stats={
                "pwd_scheduled": result.get("pwd_scheduled", 0),
                "pwd_unscheduled": result.get("pwd_unscheduled", 0),
                "non_pwd_scheduled": result.get("non_pwd_scheduled", 0),
                "non_pwd_unscheduled": result.get("non_pwd_unscheduled", 0)
            },
            execution_time=result.get("execution_time", 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("❌ Schedule generation failed")
        raise HTTPException(status_code=500, detail=f"Scheduling failed: {str(e)}")