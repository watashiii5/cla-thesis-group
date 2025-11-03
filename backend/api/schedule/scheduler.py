from fastapi import APIRouter
from typing import List, Dict, Set
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Define your scheduling logic and algorithms here

@router.post("/generate")
async def generate_schedule(data: dict):
    # Implement the schedule generation logic
    return {"message": "Schedule generated successfully", "data": data}

@router.post("/send-emails")
async def send_emails(schedule_data: dict):
    # Implement the email sending logic
    return {"message": "Emails sent successfully"}

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
    Logic: 
    1. Check if room number starts with "1" (e.g., "101", "102", "150")
    2. Check for text indicators like "1F", "1st", "Ground", etc.
    """
    # Clean the room string
    room_clean = str(room).strip().lower()
    building_clean = str(building).strip().lower()
    combined = f"{building_clean} {room_clean}"
    
    # Method 1: Parse numeric room codes (most reliable for your data)
    # Extract all digits from room string
    digits = ''.join(ch for ch in room if ch.isdigit())
    
    if digits:
        # If room is purely numeric or starts with digits
        if len(digits) >= 3:
            # Room format like "101", "102", "150" -> first floor
            # Room format like "201", "301" -> upper floors
            floor_digit = digits[0]
            if floor_digit == '1':
                logger.debug(f"✅ Room {room} identified as 1st floor (numeric: {digits})")
                return True
            else:
                logger.debug(f"❌ Room {room} is NOT 1st floor (floor digit: {floor_digit})")
                return False
    
    # Method 2: Text-based indicators (fallback)
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
    Priority Scheduling with:
    - Strict room capacity from Supabase (campuses.capacity)
    - PWD participants MUST be assigned to 1st floor rooms only
    - Handle unlimited participants (10K+)
    """

    def __init__(self):
        self.batches: List[Dict] = []
        self.assignments: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1
        self.pwd_scheduling_issues: List[str] = []

    def _time_slots(self, start_time: str, end_time: str, minutes: int) -> List[str]:
        start_dt = datetime.strptime(start_time, "%H:%M")
        end_dt = datetime.strptime(end_time, "%H:%M")
        if start_dt >= end_dt or minutes <= 0:
            return []
        slots = []
        cur = start_dt
        while True:
            nxt = cur + timedelta(minutes=minutes)
            if nxt > end_dt:
                break
            slots.append(f"{cur.strftime('%H:%M')} - {nxt.strftime('%H:%M')}")
            cur = nxt
        return slots

    def _sort_priority(self, participants: List[Dict], prioritize_pwd: bool) -> tuple[List[Dict], List[Dict]]:
        """
        Separate PWD and non-PWD participants.
        Returns: (pwd_list, non_pwd_list)
        """
        if not prioritize_pwd:
            return [], participants
        
        pwd = [p for p in participants if bool(p.get("is_pwd", False))]
        non = [p for p in participants if not bool(p.get("is_pwd", False))]
        
        logger.info(f"🔄 Split participants: {len(pwd)} PWD, {len(non)} Non-PWD")
        return pwd, non

    def _separate_rooms_by_floor(self, rooms: List[Dict]) -> tuple[List[Dict], List[Dict]]:
        """
        Separate rooms into first floor and upper floors.
        Returns: (first_floor_rooms, upper_floor_rooms)
        """
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
        start_time: str,
        end_time: str,
        duration_per_batch: int,
        prioritize_pwd: bool = True,
    ) -> Dict:
        """
        Main scheduling algorithm with PWD 1st floor rule.
        """
        logger.info(f"\n{'='*100}")
        logger.info(f"🎯 STARTING PRIORITY SCHEDULER")
        logger.info(f"{'='*100}")
        logger.info(f"📊 Total Participants: {len(participants)}")
        logger.info(f"🏢 Total Rooms: {len(rooms)}")
        logger.info(f"⏰ Time Range: {start_time} - {end_time}")
        logger.info(f"⏱️  Batch Duration: {duration_per_batch} minutes")
        logger.info(f"♿ PWD Priority: {prioritize_pwd}")
        
        slots = self._time_slots(start_time, end_time, duration_per_batch)
        logger.info(f"📅 Generated {len(slots)} time slots")
        
        # Separate participants
        pwd_participants, non_pwd_participants = self._sort_priority(participants, prioritize_pwd)
        
        # Separate rooms by floor
        first_floor_rooms, upper_floor_rooms = self._separate_rooms_by_floor(rooms)
        
        if prioritize_pwd and len(pwd_participants) > 0 and len(first_floor_rooms) == 0:
            logger.warning(f"⚠️  WARNING: {len(pwd_participants)} PWD participants but NO first floor rooms available!")
            self.pwd_scheduling_issues.append(f"No first floor rooms available for {len(pwd_participants)} PWD participants")
        
        # PHASE 1: Schedule PWD participants to 1st floor rooms only
        logger.info(f"\n{'='*80}")
        logger.info(f"📍 PHASE 1: Scheduling {len(pwd_participants)} PWD participants to first floor rooms")
        logger.info(f"{'='*80}")
        
        pwd_idx = 0
        for slot in slots:
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

                self._create_batch(batch_people, room, slot)
                pwd_idx = end_idx

            if pwd_idx >= len(pwd_participants):
                break
        
        logger.info(f"✅ Phase 1 Complete: {pwd_idx}/{len(pwd_participants)} PWD participants scheduled")
        
        if pwd_idx < len(pwd_participants):
            unscheduled_pwd = len(pwd_participants) - pwd_idx
            logger.warning(f"⚠️  {unscheduled_pwd} PWD participants could NOT be scheduled (insufficient 1st floor rooms)")
            self.pwd_scheduling_issues.append(f"{unscheduled_pwd} PWD participants unscheduled - need more 1st floor rooms")
        
        # PHASE 2: Schedule non-PWD participants to ALL available rooms
        logger.info(f"\n{'='*80}")
        logger.info(f"📍 PHASE 2: Scheduling {len(non_pwd_participants)} Non-PWD participants to all rooms")
        logger.info(f"{'='*80}")
        
        # Use all rooms for non-PWD
        all_rooms_for_non_pwd = rooms  # Can use any floor
        
        non_pwd_idx = 0
        for slot in slots:
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

                self._create_batch(batch_people, room, slot)
                non_pwd_idx = end_idx

            if non_pwd_idx >= len(non_pwd_participants):
                break
        
        logger.info(f"✅ Phase 2 Complete: {non_pwd_idx}/{len(non_pwd_participants)} Non-PWD participants scheduled")
        
        # Calculate totals
        total_scheduled = len(self.scheduled_ids)
        total_unscheduled = max(0, len(participants) - total_scheduled)
        
        logger.info(f"\n{'='*100}")
        logger.info(f"📊 SCHEDULING SUMMARY")
        logger.info(f"{'='*100}")
        logger.info(f"✅ Total Scheduled: {total_scheduled}/{len(participants)}")
        logger.info(f"❌ Total Unscheduled: {total_unscheduled}")
        logger.info(f"📦 Total Batches: {len(self.batches)}")
        logger.info(f"💺 Total Seat Assignments: {len(self.assignments)}")
        
        if self.pwd_scheduling_issues:
            logger.warning(f"\n⚠️  PWD SCHEDULING ISSUES:")
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
    
    def _create_batch(self, batch_people: List[Dict], room: Dict, slot: str):
        """Helper to create a batch and assignments"""
        pwd_in_batch = sum(1 for p in batch_people if bool(p.get("is_pwd", False)))

        batch = {
            "batch_number": self.batch_no,
            "batch_name": f"Batch {self.batch_no}",
            "campus": room.get("campus", "N/A"),
            "building": room.get("building", "N/A"),
            "room": room.get("room", "N/A"),
            "time_slot": slot,
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
                "campus": batch["campus"],
                "building": batch["building"],
                "room": batch["room"],
                "time_slot": slot,
            })
            self.scheduled_ids.add(int(p["id"]))

        self.batch_no += 1