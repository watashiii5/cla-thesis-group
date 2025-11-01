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

class PriorityScheduler:
    """
    Priority Scheduling with strict room capacity from Supabase (campuses.capacity).
    Produces:
      - batches: one record per room per time slot
      - assignments: one row per participant (seat) ensuring <= capacity
    """

    def __init__(self):
        self.batches: List[Dict] = []
        self.assignments: List[Dict] = []
        self.scheduled_ids: Set[int] = set()
        self.batch_no = 1

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

    def _sort_priority(self, participants: List[Dict], prioritize_pwd: bool) -> List[Dict]:
        if not prioritize_pwd:
            return participants
        pwd = [p for p in participants if bool(p.get("is_pwd", False))]
        non = [p for p in participants if not bool(p.get("is_pwd", False))]
        return pwd + non

    def schedule(
        self,
        rooms: List[Dict],
        participants: List[Dict],
        start_time: str,
        end_time: str,
        duration_per_batch: int,
        prioritize_pwd: bool = True,
    ) -> Dict:
        slots = self._time_slots(start_time, end_time, duration_per_batch)
        ordered = self._sort_priority(participants, prioritize_pwd)

        idx = 0
        for slot in slots:
            for room in rooms:
                cap = to_int(room.get("capacity"))
                if cap <= 0:
                    continue
                if idx >= len(ordered):
                    break

                end_idx = min(idx + cap, len(ordered))
                batch_people = ordered[idx:end_idx]
                if not batch_people:
                    continue

                pwd_in_batch = sum(1 for p in batch_people if bool(p.get("is_pwd", False)))

                batch = {
                    "batch_number": self.batch_no,  # not stored, but useful for mapping
                    "batch_name": f"Batch {self.batch_no}",
                    "campus": room.get("campus", "N/A"),
                    "building": room.get("building", "N/A"),
                    "room": room.get("room", "N/A"),
                    "time_slot": slot,
                    "room_capacity": cap,           # not stored in DB
                    "participant_count": len(batch_people),
                    "participant_ids": [int(p["id"]) for p in batch_people],  # bigint[]
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
                idx = end_idx

            if idx >= len(ordered):
                break

        logger.info(f"Scheduler: {len(self.batches)} batches, {len(self.assignments)} seat assignments")
        return {
            "batches": self.batches,
            "assignments": self.assignments,
            "scheduled_count": len(self.scheduled_ids),
            "unscheduled_count": max(0, len(participants) - len(self.scheduled_ids)),
            "total_batches": len(self.batches),
        }