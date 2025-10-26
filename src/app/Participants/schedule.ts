// Dummy implementations for dashboard page

export function getStats() {
  return {
    totalCampuses: 3,
    totalBuildings: 12,
    totalRooms: 48,
    totalScheduled: 120,
    occupancyRate: 75,
  };
}

export function getSlotsForMonth(year: number, month: number) {
  // Return some mock slots for demonstration
  return [
    { id: '1', date: `${year}-${String(month + 1).padStart(2, '0')}-05`, time: '09:00 AM' },
    { id: '2', date: `${year}-${String(month + 1).padStart(2, '0')}-12`, time: '01:00 PM' },
    { id: '3', date: `${year}-${String(month + 1).padStart(2, '0')}-18`, time: '10:30 AM' },
  ];
}

export function getUpcomingSlots(count: number) {
  // Return some mock upcoming slots
  return [
    {
      slot: { id: '1', date: '2024-06-05', time: '09:00 AM' },
      applicant: { appNo: '2024-001', course: 'BSCS', major: 'AI', time: '09:00 AM' },
      room: { id: 'R1', name: 'Room 101', capacity: '40' },
    },
    {
      slot: { id: '2', date: '2024-06-12', time: '01:00 PM' },
      applicant: { appNo: '2024-002', course: 'BSIT', major: 'Web', time: '01:00 PM' },
      room: { id: 'R2', name: 'Room 202', capacity: '35' },
    },
  ];
}