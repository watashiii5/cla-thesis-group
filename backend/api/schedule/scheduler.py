from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Set
from datetime import datetime, timedelta, date
import logging
import os  # Add this for environment variables

# ✅ Load environment variables securely (from .env file)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SERVICE_ROLE_KEY in environment variables. Check your .env file.")

# ✅ Import and initialize Supabase client AFTER loading env vars
from supabase import create_client, Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

logger = logging.getLogger(__name__)

# ✅ UPDATED: Request model now accepts group IDs instead of full lists
class ScheduleRequest(BaseModel):
    campusGroupId: int
    participantGroupId: int
    eventName: str
    eventType: str
    scheduleDate: str
    startDate: str
    endDate: str
    startTime: str
    endTime: str
    durationPerBatch: int
    prioritizePWD: bool = True
    emailNotification: bool = False
    excludeLunchBreak: bool = True  # ✅ NEW
    lunchBreakStart: str = "12:00"  # ✅ NEW
    lunchBreakEnd: str = "13:00"    # ✅ NEW

router = APIRouter()

def to_int(value) -> int:
    try:
        if value is None:
            return 0
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        s = str(value).strip()
        if s == "":
            return 0
        digits = "".join(ch for ch in s if ch.isdigit() or ch == "-")
        return int(digits) if digits not in ("", "-") else 0
    except Exception:
        return 0

def is_first_floor(building: str, room: str) -> bool:
    """
    Determine if a room is on the first floor.
    """
    room_clean = str(room).strip().lower()
    building_clean = str(building).strip().lower()
    combined = f"{building_clean} {room_clean}"
    
    # Method 1: Parse numeric room codes
    digits = ''.join(ch for ch in room if ch.isdigit())
    
    if digits:
        if len(digits) >= 3:
            floor_digit = digits[0]
            if floor_digit == '1':
                logger.debug(f"✅ Room {room} identified as 1st floor (numeric: {digits})")
                return True
            else:
                logger.debug(f"❌ Room {room} is NOT 1st floor (floor digit: {floor_digit})")
                return False
    
    # Method 2: Text-based indicators
    first_floor_indicators = [
        "1f", "1st floor", "first floor", "ground floor", 
        "ground", "g floor", "gf", "floor 1", "level 1", "l1",
        "first", "1st", "one"
    ]
    
    for indicator in first_floor_indicators:
        if indicator in combined:
            logger.debug(f"✅ Room {room} identified as 1st floor (text: {indicator})")
            return True
    
    # Method 3: Single digit "1" followed by non-digits
    if room_clean.startswith("1") and len(room_clean) > 1 and not room_clean[1].isdigit():
        logger.debug(f"✅ Room {room} identified as 1st floor (starts with '1')")
        return True
    
    logger.debug(f"❌ Room {room} is NOT 1st floor (no match)")
    return False

class PriorityScheduler:
    """
    ✅ UPDATED: Multi-day scheduling with PWD priority
    - Supports date ranges (start_date to end_date)
    - PWD participants scheduled to 1st floor rooms only
    - Generates time slots for each day in the range
    """

    def __init__(self):
        self.batches: List[Dict] = []
        self.assignments: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1
        self.pwd_scheduling_issues: List[str] = []

    def _generate_date_range(self, start_date_str: str, end_date_str: str) -> List[date]:
        """
        ✅ NEW: Generate list of dates between start and end (inclusive)
        """
        start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        
        if start > end:
            logger.error(f"❌ Invalid date range: {start_date_str} > {end_date_str}")
            return []
        
        date_list = []
        current = start
        while current <= end:
            date_list.append(current)
            current += timedelta(days=1)
        
        logger.info(f"📅 Generated {len(date_list)} days: {start} to {end}")
        return date_list

    def _time_slots_for_day(self, start_time: str, end_time: str, minutes: int, exclude_lunch: bool = False, lunch_start: str = "12:00", lunch_end: str = "13:00") -> List[Dict[str, str]]:
        """
        ✅ UPDATED: Generate time slots with lunch break exclusion
        """
        start_h, start_m = map(int, start_time.split(':'))
        end_h, end_m = map(int, end_time.split(':'))
        
        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        
        if end_minutes <= start_minutes:
            end_minutes = start_minutes + (23 * 60)
        
        slots = []
        curr = start_minutes
        
        # ✅ Parse lunch break times
        lunch_start_h, lunch_start_m = map(int, lunch_start.split(':'))
        lunch_end_h, lunch_end_m = map(int, lunch_end.split(':'))
        lunch_start_min = lunch_start_h * 60 + lunch_start_m
        lunch_end_min = lunch_end_h * 60 + lunch_end_m
        
        while curr + minutes <= end_minutes:
            slot_end = curr + minutes
            
            # ✅ Skip lunch break slots
            if exclude_lunch:
                # Skip if slot overlaps with lunch break
                if not (slot_end <= lunch_start_min or curr >= lunch_end_min):
                    # Slot overlaps lunch, skip to after lunch
                    if curr < lunch_end_min:
                        curr = lunch_end_min
                        continue
            
            h_start = curr // 60
            m_start = curr % 60
            h_end = slot_end // 60
            m_end = slot_end % 60
            
            slots.append({
                'start': f"{h_start:02d}:{m_start:02d}",
                'end': f"{h_end:02d}:{m_end:02d}"
            })
            curr += minutes
        
        logger.info(f"✅ Generated {len(slots)} time slots (lunch break {'excluded' if exclude_lunch else 'included'})")
        return slots

    def _sort_priority(self, participants: List[Dict], prioritize_pwd: bool) -> tuple[List[Dict], List[Dict]]:
        """Separate PWD and non-PWD participants."""
        if not prioritize_pwd:
            return [], participants
        
        pwd = [p for p in participants if bool(p.get("is_pwd", False))]
        non = [p for p in participants if not bool(p.get("is_pwd", False))]
        
        logger.info(f"🔄 Split participants: {len(pwd)} PWD, {len(non)} Non-PWD")
        return pwd, non

    def _separate_rooms_by_floor(self, rooms: List[Dict]) -> tuple[List[Dict], List[Dict]]:
        """Separate rooms into first floor and upper floors."""
        first_floor = []
        upper_floors = []
        
        for room in rooms:
            building = room.get("building", "")
            room_name = room.get("room", "")
            
            if is_first_floor(building, room_name):
                first_floor.append(room)
            else:
                upper_floors.append(room)
        
        logger.info(f"🏢 Rooms separated: {len(first_floor)} first floor, {len(upper_floors)} upper floors")
        return first_floor, upper_floors

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
        """Main scheduling algorithm with multi-day support"""
        logger.info(f"\n{'='*100}")
        logger.info(f"🎯 STARTING PRIORITY SCHEDULER (MULTI-DAY)")
        logger.info(f"{'='*100}")
        logger.info(f"📊 Total Participants: {len(participants)}")
        logger.info(f"🏢 Total Rooms: {len(rooms)}")
        logger.info(f"📅 Date Range: {start_date} to {end_date}")
        logger.info(f"⏰ Time Range: {start_time} - {end_time}")
        logger.info(f"⏱️  Batch Duration: {duration_per_batch} minutes")
        logger.info(f"♿ PWD Priority: {prioritize_pwd}")
        logger.info(f"🍽️  Exclude Lunch: {exclude_lunch_break}")
        if exclude_lunch_break:
            logger.info(f"🍽️  Lunch Break: {lunch_break_start} - {lunch_break_end}")
        
        # Generate date range
        dates = self._generate_date_range(start_date, end_date)
        if not dates:
            logger.error("❌ No valid dates in range")
            return self._empty_result(len(participants))
        
        # ✅ FIXED: Pass all parameters to _time_slots_for_day
        daily_slots = self._time_slots_for_day(
            start_time, 
            end_time, 
            duration_per_batch,
            exclude_lunch=exclude_lunch_break,
            lunch_start=lunch_break_start,
            lunch_end=lunch_break_end
        )
        logger.info(f"🕐 Generated {len(daily_slots)} time slots per day")
        
        if len(daily_slots) == 0:
            logger.warning(f"⚠️  No time slots generated")
            return self._empty_result(len(participants))
        
        total_slots = len(dates) * len(daily_slots)
        logger.info(f"📦 Total available slots: {total_slots}")
        
        # Separate participants
        pwd_participants, non_pwd_participants = self._sort_priority(participants, prioritize_pwd)
        
        # Separate rooms by floor
        first_floor_rooms, upper_floor_rooms = self._separate_rooms_by_floor(rooms)
        
        if prioritize_pwd and len(pwd_participants) > 0 and len(first_floor_rooms) == 0:
            logger.warning(f"⚠️  WARNING: {len(pwd_participants)} PWD but NO 1st floor rooms!")
            self.pwd_scheduling_issues.append(f"No first floor rooms for {len(pwd_participants)} PWD")
        
        # PHASE 1: Schedule PWD to 1st floor
        logger.info(f"\n{'='*80}")
        logger.info(f"📍 PHASE 1: Scheduling {len(pwd_participants)} PWD to 1st floor")
        logger.info(f"{'='*80}")
        
        pwd_idx = 0
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            for slot in daily_slots:
                for room in first_floor_rooms:
                    cap = to_int(room.get("capacity"))
                    if cap <= 0:
                        continue
                    if pwd_idx >= len(pwd_participants):
                        break

                    end_idx = min(pwd_idx + cap, len(pwd_participants))
                    batch_people = pwd_participants[pwd_idx:end_idx]
                    if not batch_people:
                        continue

                    self._create_batch(batch_people, room, slot, day_str)
                    pwd_idx = end_idx

                if pwd_idx >= len(pwd_participants):
                    break
            
            if pwd_idx >= len(pwd_participants):
                break
        
        logger.info(f"✅ Phase 1: {pwd_idx}/{len(pwd_participants)} PWD scheduled")
        
        if pwd_idx < len(pwd_participants):
            unscheduled_pwd = len(pwd_participants) - pwd_idx
            logger.warning(f"⚠️  {unscheduled_pwd} PWD unscheduled")
            self.pwd_scheduling_issues.append(f"{unscheduled_pwd} PWD unscheduled")
        
        # PHASE 2: Schedule non-PWD to all rooms
        logger.info(f"\n{'='*80}")
        logger.info(f"📍 PHASE 2: Scheduling {len(non_pwd_participants)} Non-PWD")
        logger.info(f"{'='*80}")
        
        all_rooms_for_non_pwd = rooms
        
        non_pwd_idx = 0
        for day in dates:
            day_str = day.strftime("%Y-%m-%d")
            for slot in daily_slots:
                for room in all_rooms_for_non_pwd:
                    cap = to_int(room.get("capacity"))
                    if cap <= 0:
                        continue
                    if non_pwd_idx >= len(non_pwd_participants):
                        break

                    end_idx = min(non_pwd_idx + cap, len(non_pwd_participants))
                    batch_people = non_pwd_participants[non_pwd_idx:end_idx]
                    if not batch_people:
                        continue

                    self._create_batch(batch_people, room, slot, day_str)
                    non_pwd_idx = end_idx

                if non_pwd_idx >= len(non_pwd_participants):
                    break
            
            if non_pwd_idx >= len(non_pwd_participants):
                break
        
        logger.info(f"✅ Phase 2: {non_pwd_idx}/{len(non_pwd_participants)} Non-PWD scheduled")
        
        # Calculate totals
        total_scheduled = len(self.scheduled_ids)
        total_unscheduled = max(0, len(participants) - total_scheduled)
        
        logger.info(f"\n{'='*100}")
        logger.info(f"📊 SUMMARY")
        logger.info(f"{'='*100}")
        logger.info(f"✅ Scheduled: {total_scheduled}/{len(participants)}")
        logger.info(f"❌ Unscheduled: {total_unscheduled}")
        logger.info(f"📦 Batches: {len(self.batches)}")
        
        if self.pwd_scheduling_issues:
            logger.warning(f"\n⚠️  PWD ISSUES:")
            for issue in self.pwd_scheduling_issues:
                logger.warning(f"   - {issue}")
        
        return {
            "batches": self.batches,
            "assignments": self.assignments,
            "scheduled_count": total_scheduled,
            "unscheduled_count": total_unscheduled,
            "total_batches": len(self.batches),
            "pwd_scheduled": pwd_idx,
            "pwd_unscheduled": len(pwd_participants) - pwd_idx,
            "non_pwd_scheduled": non_pwd_idx,
            "non_pwd_unscheduled": len(non_pwd_participants) - non_pwd_idx,
            "warnings": self.pwd_scheduling_issues,
        }
    
    def _create_batch(self, batch_people: List[Dict], room: Dict, slot: Dict, batch_date: str):
        """Create batch with proper variable order"""
        pwd_in_batch = sum(1 for p in batch_people if bool(p.get("is_pwd", False)))
        
        # ✅ Extract data FIRST
        campus = room.get("campus", "N/A")
        building = room.get("building", "N/A") 
        room_name = room.get("room", "N/A")
        
        # ✅ DEFINE is_first_floor_room BEFORE using it
        is_first_floor_room = is_first_floor(building, room_name)

        # ✅ NOW it's safe to use
        batch = {
            "batch_number": self.batch_no,
            "batch_name": f"Batch {self.batch_no}",
            "batch_date": batch_date,
            "campus": campus,
            "building": building,
            "room": room_name,
            "is_first_floor": is_first_floor_room,  # ✅ Already defined above
            "start_time": slot['start'],
            "end_time": slot['end'],
            "time_slot": f"{slot['start']} - {slot['end']}",
            "room_capacity": to_int(room.get("capacity")),
            "participant_count": len(batch_people),
            "participant_ids": [int(p["id"]) for p in batch_people],
            "has_pwd": pwd_in_batch > 0,
        }
        self.batches.append(batch)

        for seat_no, p in enumerate(batch_people, start=1):
            self.assignments.append({
                "batch_number": self.batch_no,
                "participant_id": int(p["id"]),
                "seat_no": seat_no,
                "is_pwd": bool(p.get("is_pwd", False)),
                "campus": campus,
                "building": building,
                "room": room_name,
                "is_first_floor": is_first_floor_room,  # ✅ Already defined
                "start_time": slot['start'],
                "end_time": slot['end'],
                "time_slot": f"{slot['start']} - {slot['end']}",
                "batch_date": batch_date,
            })
            self.scheduled_ids.add(int(p["id"]))

        # ✅ Use defined variable
        floor_info = "1st Floor ♿" if is_first_floor_room else "Upper Floor"
        logger.info(
            f"📦 Batch {self.batch_no}: {len(batch_people)} participants → "
            f"{campus} | {building} | {room_name} ({floor_info}) | "
            f"{slot['start']}-{slot['end']} on {batch_date}"
        )
        
        self.batch_no += 1
    
    def _empty_result(self, total_participants: int) -> Dict:
        """Return empty result when no scheduling is possible"""
        return {
            "batches": [],
            "assignments": [],
            "scheduled_count": 0,
            "unscheduled_count": total_participants,
            "total_batches": 0,
            "pwd_scheduled": 0,
            "pwd_unscheduled": 0,
            "non_pwd_scheduled": 0,
            "non_pwd_unscheduled": total_participants,
            "warnings": ["No scheduling possible - check time slots and room capacity"],
        }

@router.post("/generate")
async def generate_schedule_endpoint(request: ScheduleRequest):
    try:
        logger.info(f"\n{'='*100}")
        logger.info(f"🔍 STEP 0: Validating Input Request")
        logger.info(f"{'='*100}")
        logger.info(f"Campus Group ID: {request.campusGroupId}")
        logger.info(f"Participant Group ID: {request.participantGroupId}")
        logger.info(f"Schedule Date: {request.scheduleDate}")
        logger.info(f"Start Date: {request.startDate}")
        logger.info(f"End Date: {request.endDate}")
        logger.info(f"Start Time: {request.startTime}")
        logger.info(f"End Time: {request.endTime}")

        # ✅ STEP 1: Fetch rooms from Supabase
        logger.info(f"\n{'='*100}")
        logger.info(f"📥 STEP 1: Fetching Campus Data")
        logger.info(f"{'='*100}")
        
        rooms_response = supabase.table('campuses').select('*').eq('upload_group_id', request.campusGroupId).execute()
        rooms = rooms_response.data
        
        if not rooms:
            raise HTTPException(status_code=400, detail="No rooms found for the selected campus group")

        logger.info(f"✅ Fetched {len(rooms)} rooms from campuses table")

        # ✅ STEP 2: Validate rooms for null/empty required fields
        logger.info(f"\n{'='*100}")
        logger.info(f"🔍 STEP 2: Validating Campus Data")
        logger.info(f"{'='*100}")
        
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
                f"❌ Row ID {r['id']}: {r['issues']} (Campus='{r['campus']}', Building='{r['building']}', Room='{r['room']}', Capacity={r['capacity']})"
                for r in invalid_rooms
            ])
            raise HTTPException(
                status_code=400,
                detail=f"⚠️ INVALID CAMPUS DATA DETECTED\n\n{error_details}\n\n📝 Action Required:\n1. Open your Excel file\n2. Fix the blank/invalid values\n3. Re-upload to Supabase\n4. Try generating the schedule again"
            )
        
        logger.info(f"✅ All {len(rooms)} rooms have valid data")

        # ✅ STEP 3: Fetch participants
        logger.info(f"\n{'='*100}")
        logger.info(f"📥 STEP 3: Fetching Participant Data")
        logger.info(f"{'='*100}")
        
        participants_response = supabase.table('participants').select('*').eq('upload_group_id', request.participantGroupId).execute()
        participants = participants_response.data
        
        if not participants:
            raise HTTPException(status_code=400, detail="No participants found for the selected group")

        logger.info(f"✅ Fetched {len(participants)} participants")

        # ✅ STEP 4: Create schedule summary
        logger.info(f"\n{'='*100}")
        logger.info(f"💾 STEP 4: Creating Schedule Summary")
        logger.info(f"{'='*100}")
        
        summary_data = {
            "event_name": request.eventName,
            "event_type": request.eventType,
            "schedule_date": request.scheduleDate,
            "start_date": request.startDate,
            "end_date": request.endDate,
            "start_time": request.startTime,
            "end_time": request.endTime,
            "duration_per_batch": request.durationPerBatch,
            "prioritize_pwd": request.prioritizePWD,
            "email_notification": request.emailNotification,
            "campus_group_id": request.campusGroupId,
            "participant_group_id": request.participantGroupId,
        }
        
        logger.info(f"  Event: {summary_data['event_name']}")
        logger.info(f"  Date Range: {summary_data['start_date']} to {summary_data['end_date']}")
        logger.info(f"  Time Range: {summary_data['start_time']} to {summary_data['end_time']}")
        
        summary_response = supabase.table('schedule_summary').insert(summary_data).execute()
        summary_id = summary_response.data[0]['id']
        
        logger.info(f"✅ Created schedule_summary with ID: {summary_id}")

        # ✅ STEP 5: Run scheduler
        logger.info(f"\n{'='*100}")
        logger.info(f"🎯 STEP 5: Running Scheduler Algorithm")
        logger.info(f"{'='*100}")
        
        scheduler = PriorityScheduler()
        result = scheduler.schedule(
            rooms=rooms,
            participants=participants,
            start_date=request.startDate,
            end_date=request.endDate,
            start_time=request.startTime,
            end_time=request.endTime,
            duration_per_batch=request.durationPerBatch,
            prioritize_pwd=request.prioritizePWD
        )
        
        logger.info(f"\n{'='*100}")
        logger.info(f"💾 STEP 6: Saving to Supabase")
        logger.info(f"{'='*100}")
        
        # ✅ CRITICAL FIX: Save batches first and map batch_number to database ID
        batch_id_map = {}  # Maps batch_number -> database ID
        
        logger.info(f"\n📦 Saving {len(result['batches'])} batches...")
        for batch in result["batches"]:
            batch_data = {
                "schedule_summary_id": summary_id,
                "batch_number": batch["batch_number"],  # ✅ Include this for reference
                "batch_name": batch["batch_name"],
                "campus": batch["campus"],
                "building": batch["building"],
                "room": batch["room"],
                "is_first_floor": batch["is_first_floor"],
                "start_time": batch["start_time"],
                "end_time": batch["end_time"],
                "time_slot": batch["time_slot"],
                "batch_date": batch["batch_date"],
                "participant_count": batch["participant_count"],
                "has_pwd": batch["has_pwd"],
                "participant_ids": batch["participant_ids"],
            }
            
            logger.info(f"\n  📦 Batch {batch['batch_number']}:")
            logger.info(f"     Campus: {batch['campus']}")
            logger.info(f"     Building: {batch['building']}")
            logger.info(f"     Room: {batch['room']}")
            logger.info(f"     Date: {batch['batch_date']}")
            logger.info(f"     Time: {batch['start_time']} - {batch['end_time']}")
            logger.info(f"     Floor: {'1st Floor' if batch['is_first_floor'] else 'Upper Floor'}")
            logger.info(f"     Participants: {batch['participant_count']}")
            
            # Insert and get the database ID
            batch_response = supabase.table('schedule_batches').insert(batch_data).execute()
            batch_db_id = batch_response.data[0]['id']
            
            # Map batch_number to database ID
            batch_id_map[batch["batch_number"]] = batch_db_id
            
            logger.info(f"     ✅ Saved with DB ID: {batch_db_id}")
        
        logger.info(f"\n✅ All {len(result['batches'])} batches saved successfully")
        logger.info(f"📊 Batch ID mapping: {batch_id_map}")
        
        # ✅ CRITICAL FIX: Save assignments with correct batch_id from map
        logger.info(f"\n💺 Saving {len(result['assignments'])} assignments...")
        assignments_saved = 0
        assignments_failed = 0
        
        for assignment in result["assignments"]:
            batch_number = assignment.get("batch_number")
            batch_db_id = batch_id_map.get(batch_number)
            
            if not batch_db_id:
                logger.error(f"❌ Could not find batch DB ID for batch_number {batch_number}")
                assignments_failed += 1
                continue
            
            assignment_data = {
                "schedule_summary_id": summary_id,
                "schedule_batch_id": batch_db_id,  # ✅ FIXED: Use actual batch ID from database
                "participant_id": assignment["participant_id"],
                "seat_no": assignment["seat_no"],
                "is_pwd": assignment["is_pwd"],
                "campus": assignment["campus"],  # ✅ From scheduler
                "building": assignment["building"],  # ✅ From scheduler
                "room": assignment["room"],  # ✅ From scheduler
                "is_first_floor": assignment["is_first_floor"],  # ✅ From scheduler
                "start_time": assignment["start_time"],  # ✅ From scheduler
                "end_time": assignment["end_time"],  # ✅ From scheduler
                "batch_date": assignment["batch_date"],  # ✅ From scheduler
            }
            
            try:
                supabase.table('schedule_assignments').insert(assignment_data).execute()
                assignments_saved += 1
                
                if assignments_saved % 50 == 0:  # Log progress every 50 assignments
                    logger.info(f"   ✅ Saved {assignments_saved}/{len(result['assignments'])} assignments...")
                    
            except Exception as e:
                logger.error(f"❌ Error inserting assignment for participant {assignment['participant_id']}: {e}")
                logger.error(f"   Assignment data: {assignment_data}")
                assignments_failed += 1
        
        logger.info(f"\n✅ Saved {assignments_saved}/{len(result['assignments'])} assignments")
        if assignments_failed > 0:
            logger.warning(f"⚠️ Failed to save {assignments_failed} assignments")
        
        # ✅ Return result with summary_id
        result["schedule_summary_id"] = summary_id
        result["pwd_stats"] = {
            "pwd_scheduled": result["pwd_scheduled"],
            "pwd_unscheduled": result["pwd_unscheduled"],
            "non_pwd_scheduled": result["non_pwd_scheduled"],
            "non_pwd_unscheduled": result["non_pwd_unscheduled"],
        }
        
        logger.info(f"\n{'='*100}")
        logger.info(f"✅ SCHEDULE GENERATION COMPLETE")
        logger.info(f"{'='*100}")
        logger.info(f"📊 Summary ID: {summary_id}")
        logger.info(f"👥 Scheduled: {result['scheduled_count']}/{len(participants)}")
        logger.info(f"📦 Batches: {len(result['batches'])}")
        logger.info(f"💺 Assignments: {assignments_saved}")
        
        return result
        
    except HTTPException as e:
        logger.error(f"❌ HTTP Error: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))