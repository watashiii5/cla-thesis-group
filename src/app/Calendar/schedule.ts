// Types
export interface Campus {
  id: string;
  name: string;
}

export interface Building {
  id: string;
  campusId: string;
  name: string;
}

export interface Room {
  id: string;
  buildingId: string;
  name: string;
  capacity: number;
}

export interface Applicant {
  id: string;
  appNo: string;
  course: string;
  major?: string;
}

export interface ScheduledSlot {
  id: string;
  applicantId: string;
  roomId: string;
  date: string;
  time: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

// Demo data
export const campuses: Campus[] = [
  { id: 'c1', name: 'Main Campus' },
  { id: 'c2', name: 'North Campus' }
];

export const buildings: Building[] = [
  { id: 'b1', campusId: 'c1', name: 'Building A' },
  { id: 'b2', campusId: 'c1', name: 'Building B' }
];

export const rooms: Room[] = [
  { id: 'r1', buildingId: 'b1', name: 'Room 101', capacity: 30 },
  { id: 'r2', buildingId: 'b1', name: 'Room 102', capacity: 25 },
  { id: 'r3', buildingId: 'b2', name: 'Room 201', capacity: 40 }
];

export const applicants: Applicant[] = [
  { id: 'a1', appNo: 'APP001', course: 'Computer Science', major: 'Software Engineering' },
  { id: 'a2', appNo: 'APP002', course: 'Information Technology' },
  { id: 'a3', appNo: 'APP003', course: 'Computer Science', major: 'Network Security' }
];

export const scheduledSlots: ScheduledSlot[] = [
  { id: 's1', applicantId: 'a1', roomId: 'r1', date: '2024-01-15', time: '09:00 - 10:00' },
  { id: 's2', applicantId: 'a2', roomId: 'r2', date: '2024-01-16', time: '14:00 - 15:00' }
];

// Helper functions
export function getSlotsForMonth(year: number, month: number): ScheduledSlot[] {
  return scheduledSlots.filter(s => {
    const slotDate = new Date(s.date);
    return slotDate.getFullYear() === year && slotDate.getMonth() === month;
  });
}

export function getUpcomingSlots(limit: number = 5): ScheduledSlot[] {
  const now = new Date();
  return scheduledSlots
    .filter(s => new Date(s.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit);
}

export function getStats() {
  return {
    totalCampuses: campuses.length,
    totalBuildings: buildings.length,
    totalRooms: rooms.length,
    totalScheduled: scheduledSlots.length
  };
}