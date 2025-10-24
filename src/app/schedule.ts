// Shared schedule "model" and helper functions used by the Dashboard page.
// This is intentionally lightweight and uses in-memory sample data so the Dashboard can
// compute stats connected to the schedule. Later you can replace this with an API or
// with persistent state (DB / localStorage) and then import it in the root schedule page
// so both pages share the same canonical data.
export type Campus = { id: string; name: string };
export type Building = { id: string; name: string; campusId: string };
export type Room = { id: string; name: string; capacity: number; buildingId: string };
export type Applicant = { id: string; appNo: string; course: string; major: string };
export type ScheduledSlot = {
  id: string;
  applicantId: string;
  roomId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "08:00 - 12:00"
  status?: 'scheduled' | 'completed' | 'cancelled';
};

export const campuses: Campus[] = [
  { id: 'main', name: 'MAIN CAMPUS' },
  { id: 'sarmiento', name: 'SARMIENTO' },
  { id: 'hagonoy', name: 'HAGONOY' },
  { id: 'sanrafael', name: 'SAN RAFAEL' },
  { id: 'meneses', name: 'MENESES' },
  { id: 'bustos', name: 'BUSTOS' },
];

export const buildings: Building[] = [
  { id: 'fed', name: 'FED HALL', campusId: 'main' },
  { id: 'alvarado', name: 'ALVARADO HALL', campusId: 'main' },
  { id: 'roxas', name: 'ROXAS HALL', campusId: 'main' },
  { id: 'pimentel', name: 'PIMENTEL', campusId: 'main' },
];

export const rooms: Room[] = Array.from({ length: 15 }).map((_, i) => {
  const buildingId = 'fed';
  const number = (i < 5 ? 100 : i < 10 ? 200 : 300) + (i % 5) + 1;
  return { id: `r-${number}`, name: String(number), capacity: 30, buildingId };
});

export const applicants: Applicant[] = new Array(15).fill(null).map((_, i) => ({
  id: `a-${i + 1}`,
  appNo: `2024-${(1000 + i).toString().padStart(4, '0')}`,
  course: i % 2 === 0 ? 'BS MATH' : 'BS CS',
  major: i % 3 === 0 ? 'Comscie' : i % 3 === 1 ? 'Applied Math' : '',
}));

// Create some scheduled slots across dates (some in current month)
const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const scheduledSlots: ScheduledSlot[] = [
  // few for today
  {
    id: 's-1',
    applicantId: applicants[0].id,
    roomId: rooms[0].id,
    date: dateStr(today),
    time: '08:00 - 12:00',
    status: 'scheduled',
  },
  {
    id: 's-2',
    applicantId: applicants[1].id,
    roomId: rooms[1].id,
    date: dateStr(today),
    time: '13:00 - 17:00',
    status: 'scheduled',
  },
  // some for next days
  {
    id: 's-3',
    applicantId: applicants[2].id,
    roomId: rooms[2].id,
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return dateStr(d);
    })(),
    time: '08:00 - 12:00',
    status: 'scheduled',
  },
  {
    id: 's-4',
    applicantId: applicants[3].id,
    roomId: rooms[3].id,
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return dateStr(d);
    })(),
    time: '13:00 - 17:00',
    status: 'scheduled',
  },
];

// Helpers
export function getStats() {
  const totalCampuses = campuses.length;
  const totalBuildings = buildings.length;
  const totalRooms = rooms.length;
  const totalApplicants = applicants.length;
  const totalScheduled = scheduledSlots.filter((s) => s.status === 'scheduled').length;

  // compute room occupancy as scheduled slots / (rooms * possible daily slots)
  // for demo assume 2 slots per day
  const totalCapacitySlots = rooms.length * 2;
  const occupancyRate = totalCapacitySlots > 0 ? Math.round((totalScheduled / totalCapacitySlots) * 100) : 0;

  return {
    totalCampuses,
    totalBuildings,
    totalRooms,
    totalApplicants,
    totalScheduled,
    occupancyRate,
  };
}

/**
 * Return scheduled slots for a given month (year, monthIndex 0-based)
 */
export function getSlotsForMonth(year: number, monthIndex: number) {
  return scheduledSlots.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

export function getUpcomingSlots(limit = 5) {
  const nowStr = dateStr(new Date());
  return scheduledSlots
    .filter((s) => s.date >= nowStr)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .slice(0, limit)
    .map((slot) => {
      const applicant = applicants.find((a) => a.id === slot.applicantId);
      const room = rooms.find((r) => r.id === slot.roomId);
      return { slot, applicant, room };
    });
}