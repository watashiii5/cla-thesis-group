'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface Campus {
  id: string;
  name: string;
}

export interface Building {
  id: string;
  name: string;
  campusId: string;
}

export interface Room {
  id: string;
  capacity: number;
  buildingId: string;
}

export interface Applicant {
  appNo: string;
  name: string;
  course: string;
  major: string;
  isPWD: boolean;
  roomId?: string;
  timeSlot?: string;
}

export interface ScheduleResult {
  success: boolean;
  scheduled: Applicant[];
  unscheduled: Applicant[];
  summary: {
    totalApplicants: number;
    totalScheduled: number;
    pwdScheduled: number;
    totalUnscheduled: number;
  };
}

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const BuildingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21v-13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13M9 21V9M13 21V9M7 7h.01M11 7h.01M15 7h.01" />
  </svg>
);

const RoomIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);

const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-3-3.87M7 21v-2a4 4 0 0 1 3-3.87" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
  </svg>
);

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const HelpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);

const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Scheduler = () => {
  const [currentView, setCurrentView] = useState<'campuses' | 'buildings' | 'rooms' | 'applicants'>('campuses');
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [query, setQuery] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const pathname = usePathname();

  // Modal states
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Form states
  const [campusName, setCampusName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');

  // Data states
  const [campuses, setCampuses] = useState<Campus[]>([
    { id: '1', name: 'Main Campus' },
    { id: '2', name: 'Alangilan Campus' },
    { id: '3', name: 'Pablo Borbon Campus' }
  ]);

  const [buildings, setBuildings] = useState<Record<string, Building[]>>({
    '1': [
      { id: 'b1', name: 'Building A', campusId: '1' },
      { id: 'b2', name: 'Building B', campusId: '1' },
      { id: 'b3', name: 'Building C', campusId: '1' },
      { id: 'b4', name: 'Building D', campusId: '1' }
    ],
    '2': [
      { id: 'b5', name: 'Engineering Bldg', campusId: '2' },
      { id: 'b6', name: 'Science Bldg', campusId: '2' }
    ],
    '3': [
      { id: 'b7', name: 'Admin Bldg', campusId: '3' },
      { id: 'b8', name: 'Library Bldg', campusId: '3' }
    ]
  });

  const [rooms, setRooms] = useState<Record<string, Room[]>>({
    'b1': [
      { id: 'A101', capacity: 30, buildingId: 'b1' },
      { id: 'A102', capacity: 40, buildingId: 'b1' },
      { id: 'A103', capacity: 35, buildingId: 'b1' },
      { id: 'A104', capacity: 25, buildingId: 'b1' },
      { id: 'A105', capacity: 50, buildingId: 'b1' }
    ],
    'b2': [
      { id: 'B201', capacity: 30, buildingId: 'b2' },
      { id: 'B202', capacity: 35, buildingId: 'b2' },
      { id: 'B203', capacity: 40, buildingId: 'b2' }
    ]
  });

  const [applicants, setApplicants] = useState<Applicant[]>([]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cla-theme') : null;
    if (stored) {
      setIsDark(stored === 'dark');
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('cla-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('cla-theme', 'light');
      }
    }
  }, [isDark]);

  // Campus CRUD operations
  const handleAddCampus = () => {
    if (!campusName.trim()) return;
    const newCampus: Campus = {
      id: Date.now().toString(),
      name: campusName
    };
    setCampuses([...campuses, newCampus]);
    setCampusName('');
    setShowCampusModal(false);
  };

  const handleEditCampus = () => {
    if (!editingCampus || !campusName.trim()) return;
    setCampuses(campuses.map(c => c.id === editingCampus.id ? { ...c, name: campusName } : c));
    setCampusName('');
    setEditingCampus(null);
    setShowCampusModal(false);
  };

  const handleDeleteCampus = (campusId: string) => {
    if (confirm('Are you sure you want to delete this campus? All buildings and rooms in this campus will also be deleted.')) {
      setCampuses(campuses.filter(c => c.id !== campusId));
      // Clean up buildings
      const newBuildings = { ...buildings };
      delete newBuildings[campusId];
      setBuildings(newBuildings);
    }
  };

  const openCampusModal = (campus?: Campus) => {
    if (campus) {
      setEditingCampus(campus);
      setCampusName(campus.name);
    } else {
      setEditingCampus(null);
      setCampusName('');
    }
    setShowCampusModal(true);
  };

  // Building CRUD operations
  const handleAddBuilding = () => {
    if (!selectedCampus || !buildingName.trim()) return;
    const newBuilding: Building = {
      id: 'b' + Date.now(),
      name: buildingName,
      campusId: selectedCampus.id
    };
    setBuildings({
      ...buildings,
      [selectedCampus.id]: [...(buildings[selectedCampus.id] || []), newBuilding]
    });
    setBuildingName('');
    setShowBuildingModal(false);
  };

  const handleEditBuilding = () => {
    if (!editingBuilding || !buildingName.trim() || !selectedCampus) return;
    setBuildings({
      ...buildings,
      [selectedCampus.id]: buildings[selectedCampus.id].map(b => 
        b.id === editingBuilding.id ? { ...b, name: buildingName } : b
      )
    });
    setBuildingName('');
    setEditingBuilding(null);
    setShowBuildingModal(false);
  };

  const handleDeleteBuilding = (buildingId: string) => {
    if (!selectedCampus) return;
    if (confirm('Are you sure you want to delete this building? All rooms in this building will also be deleted.')) {
      setBuildings({
        ...buildings,
        [selectedCampus.id]: buildings[selectedCampus.id].filter(b => b.id !== buildingId)
      });
      // Clean up rooms
      const newRooms = { ...rooms };
      delete newRooms[buildingId];
      setRooms(newRooms);
    }
  };

  const openBuildingModal = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setBuildingName(building.name);
    } else {
      setEditingBuilding(null);
      setBuildingName('');
    }
    setShowBuildingModal(true);
  };

  // Room CRUD operations
  const handleAddRoom = () => {
    if (!selectedBuilding || !roomId.trim() || !roomCapacity) return;
    const newRoom: Room = {
      id: roomId,
      capacity: parseInt(roomCapacity),
      buildingId: selectedBuilding.id
    };
    setRooms({
      ...rooms,
      [selectedBuilding.id]: [...(rooms[selectedBuilding.id] || []), newRoom]
    });
    setRoomId('');
    setRoomCapacity('');
    setShowRoomModal(false);
  };

  const handleEditRoom = () => {
    if (!editingRoom || !roomId.trim() || !roomCapacity || !selectedBuilding) return;
    setRooms({
      ...rooms,
      [selectedBuilding.id]: rooms[selectedBuilding.id].map(r => 
        r.id === editingRoom.id ? { id: roomId, capacity: parseInt(roomCapacity), buildingId: selectedBuilding.id } : r
      )
    });
    setRoomId('');
    setRoomCapacity('');
    setEditingRoom(null);
    setShowRoomModal(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!selectedBuilding) return;
    if (confirm('Are you sure you want to delete this room?')) {
      setRooms({
        ...rooms,
        [selectedBuilding.id]: rooms[selectedBuilding.id].filter(r => r.id !== roomId)
      });
    }
  };

  const openRoomModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomId(room.id);
      setRoomCapacity(room.capacity.toString());
    } else {
      setEditingRoom(null);
      setRoomId('');
      setRoomCapacity('');
    }
    setShowRoomModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const parsed: Applicant[] = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return {
        appNo: values[0] || '',
        name: values[1] || '',
        course: values[2] || '',
        major: values[3] || '',
        isPWD: values[4]?.toLowerCase() === 'true' || values[4] === '1'
      };
    });

    setApplicants(parsed);
  };

  const scheduleAlgorithm = (applicants: Applicant[], rooms: Room[]): ScheduleResult => {
    const timeSlots = ['8:00-10:00', '10:00-12:00', '1:00-3:00', '3:00-5:00'];
    const scheduled: Applicant[] = [];
    const unscheduled: Applicant[] = [];
    
    const pwdApplicants = applicants.filter(a => a.isPWD);
    const nonPwdApplicants = applicants.filter(a => !a.isPWD);
    
    const sortedApplicants = [...pwdApplicants, ...nonPwdApplicants];
    
    const slots: Array<{room: Room, time: string, capacity: number, assigned: number}> = [];
    rooms.forEach(room => {
      timeSlots.forEach(time => {
        slots.push({
          room,
          time,
          capacity: room.capacity,
          assigned: 0
        });
      });
    });

    sortedApplicants.forEach(applicant => {
      let assigned = false;
      
      for (const slot of slots) {
        if (slot.assigned < slot.capacity) {
          scheduled.push({
            ...applicant,
            roomId: slot.room.id,
            timeSlot: slot.time
          });
          slot.assigned++;
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        unscheduled.push(applicant);
      }
    });

    return {
      success: true,
      scheduled,
      unscheduled,
      summary: {
        totalApplicants: applicants.length,
        totalScheduled: scheduled.length,
        pwdScheduled: scheduled.filter(a => a.isPWD).length,
        totalUnscheduled: unscheduled.length
      }
    };
  };

  const handleGenerateSchedule = async () => {
    if (applicants.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    setIsGenerating(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const allRooms: Room[] = [];
    Object.values(rooms).forEach(roomList => {
      allRooms.push(...roomList);
    });

    const result = scheduleAlgorithm(applicants, allRooms);
    setScheduleResult(result);
    setIsGenerating(false);
  };

  const exportScheduleCSV = () => {
    if (!scheduleResult) return;

    const headers = ['Application No', 'Name', 'Course', 'Major', 'PWD', 'Room', 'Time Slot'];
    const rows = scheduleResult.scheduled.map(a => [
      a.appNo,
      a.name,
      a.course,
      a.major,
      a.isPWD ? 'Yes' : 'No',
      a.roomId || '',
      a.timeSlot || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const generateSampleCSV = () => {
    const headers = 'Application No,Name,Course,Major,PWD\n';
    const sampleData = [
      '2024-0001,Juan Dela Cruz,BS Computer Science,Software Engineering,false',
      '2024-0002,Maria Santos,BS Information Technology,,true',
      '2024-0003,Pedro Reyes,BS Mathematics,Applied Mathematics,false',
      '2024-0004,Ana Garcia,BS Computer Science,,false',
      '2024-0005,Jose Mendoza,BS Information Technology,,true',
      '2024-0006,Linda Torres,BS Mathematics,Pure Mathematics,false',
      '2024-0007,Carlos Ramos,BS Computer Science,Data Science,false',
      '2024-0008,Sofia Cruz,BS Information Technology,,false',
      '2024-0009,Miguel Santos,BS Mathematics,,true',
      '2024-0010,Elena Rodriguez,BS Computer Science,,false'
    ];

    const csv = headers + sampleData.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_applicants.csv';
    a.click();
  };

  const handleCampusSelect = (campus: Campus) => {
    setSelectedCampus(campus);
    setSelectedBuilding(null);
    setSelectedRoom(null);
    setCurrentView('buildings');
  };

  const handleBuildingSelect = (building: Building) => {
    setSelectedBuilding(building);
    setSelectedRoom(null);
    setCurrentView('rooms');
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentView('applicants');
  };

  const handleBack = () => {
    if (currentView === 'applicants') {
      setCurrentView('rooms');
      setSelectedRoom(null);
    } else if (currentView === 'rooms') {
      setCurrentView('buildings');
      setSelectedBuilding(null);
    } else if (currentView === 'buildings') {
      setCurrentView('campuses');
      setSelectedCampus(null);
    }
  };

  const filteredApplicants = (scheduleResult?.scheduled || applicants).filter(
    (a) =>
      a.appNo.toLowerCase().includes(query.toLowerCase()) ||
      a.name?.toLowerCase().includes(query.toLowerCase()) ||
      a.course.toLowerCase().includes(query.toLowerCase()) ||
      a.major?.toLowerCase().includes(query.toLowerCase())
  );

  const navItems = [
    { href: '/', label: 'Scheduler', icon: <BuildingIcon className="w-5 h-5" /> },
    { href: '/Dashboard', label: 'Dashboard', icon: <BuildingIcon className="w-5 h-5 text-indigo-500" /> },
    { href: '/Calendar', label: 'Calendar', icon: <MenuIcon className="w-5 h-5 text-yellow-500" /> },
    { href: '/Participants', label: 'Participants', icon: <UsersIcon className="w-5 h-5 text-green-500" /> },
    { href: '/Messages', label: 'Messages', icon: <BellIcon className="w-5 h-5 text-pink-500" /> },
    { href: '/Notifications', label: 'Notifications', icon: <FileIcon className="w-5 h-5 text-gray-500" /> },
  ];

  const Sidebar = () => (
    <aside className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center shadow">
            <span className="text-white font-semibold">Q</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">QTime</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Administrator</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 font-semibold'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        <Link href="/help" className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <div className="flex items-center gap-2">
            <HelpIcon className="w-4 h-4 text-indigo-500" />
            <span>Need help?</span>
          </div>
          <span className="text-xs text-gray-400">FAQ</span>
        </Link>
      </div>
    </aside>
  );

  const Header = () => (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Scheduler</h1>

        <div className="relative">
          <input
            aria-label="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-md bg-gray-100 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Search applicants..."
          />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            <SearchIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/Notifications" title="notifications" className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <BellIcon className="w-5 h-5" />
        </Link>

        <button
          onClick={() => setIsDark((s) => !s)}
          className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:opacity-90 transition"
          title="toggle theme"
        >
          {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">AD</div>
      </div>
    </header>
  );

  const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const CampusesView = () => (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Schedule Management</h2>
        <button
          onClick={() => openCampusModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm shadow hover:bg-indigo-700 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Add Campus
        </button>
      </div>

      {scheduleResult && (
        <div className="max-w-4xl mx-auto mb-6 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Schedule Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{scheduleResult.summary.totalApplicants}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Applicants</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{scheduleResult.summary.totalScheduled}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Scheduled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{scheduleResult.summary.pwdScheduled}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">PWD Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{scheduleResult.summary.totalUnscheduled}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Unscheduled</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
        {campuses.map((campus) => (
          <div
            key={campus.id}
            className="relative group flex flex-col items-start gap-2 p-6 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition"
          >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
              <button
                onClick={() => openCampusModal(campus)}
                className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition"
                title="Edit campus"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteCampus(campus.id)}
                className="p-1.5 rounded-md bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition"
                title="Delete campus"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => handleCampusSelect(campus)}
              className="flex items-center gap-3 w-full"
            >
              <div className="p-3 rounded-md bg-indigo-50 dark:bg-indigo-800">
                <BuildingIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-200" />
              </div>
              <div className="text-left">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{campus.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">View schedules</div>
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-4xl mx-auto space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Upload Applicants</h3>
          
          <div className="flex items-center gap-3 mb-4">
            <label className="cursor-pointer">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                Choose CSV file
              </div>
            </label>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {uploadedFile ? uploadedFile.name : 'No file selected'}
            </span>
            {applicants.length > 0 && (
              <span className="text-sm text-green-600 dark:text-green-400">
                ({applicants.length} applicants loaded)
              </span>
            )}
          </div>

          <button 
            onClick={generateSampleCSV}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Download sample CSV template
          </button>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button 
            onClick={handleGenerateSchedule}
            disabled={isGenerating || applicants.length === 0}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md text-sm shadow hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Schedule'}
          </button>
          {scheduleResult && (
            <button 
              onClick={exportScheduleCSV}
              className="px-6 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-200 shadow hover:shadow-md transition flex items-center gap-2"
            >
              <DownloadIcon className="w-4 h-4" />
              Export Schedule
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={showCampusModal} onClose={() => setShowCampusModal(false)} title={editingCampus ? 'Edit Campus' : 'Add Campus'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campus Name</label>
            <input
              type="text"
              value={campusName}
              onChange={(e) => setCampusName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter campus name"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCampusModal(false)}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={editingCampus ? handleEditCampus : handleAddCampus}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {editingCampus ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  const BuildingsView = () => (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Buildings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCampus?.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openBuildingModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm shadow hover:bg-indigo-700 transition"
            >
              <PlusIcon className="w-4 h-4" />
              Add Building
            </button>
            <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {selectedCampus && (buildings[selectedCampus.id] || []).map((building) => (
            <div
              key={building.id}
              className="relative group flex flex-col items-start gap-2 p-5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition"
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                <button
                  onClick={() => openBuildingModal(building)}
                  className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition"
                  title="Edit building"
                >
                  <EditIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteBuilding(building.id)}
                  className="p-1.5 rounded-md bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition"
                  title="Delete building"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => handleBuildingSelect(building)}
                className="w-full"
              >
                <div className="rounded-md p-3 bg-yellow-50 dark:bg-yellow-900">
                  <BuildingIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
                </div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-2">{building.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">View rooms</div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={showBuildingModal} onClose={() => setShowBuildingModal(false)} title={editingBuilding ? 'Edit Building' : 'Add Building'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Building Name</label>
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter building name"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBuildingModal(false)}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={editingBuilding ? handleEditBuilding : handleAddBuilding}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {editingBuilding ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  const RoomsView = () => (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Rooms</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCampus?.name} • {selectedBuilding?.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openRoomModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm shadow hover:bg-indigo-700 transition"
            >
              <PlusIcon className="w-4 h-4" />
              Add Room
            </button>
            <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {selectedBuilding && (rooms[selectedBuilding.id] || []).map((room) => (
            <div
              key={room.id}
              className="relative group p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition"
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                <button
                  onClick={() => openRoomModal(room)}
                  className="p-1 rounded-md bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 transition"
                  title="Edit room"
                >
                  <EditIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteRoom(room.id)}
                  className="p-1 rounded-md bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 transition"
                  title="Delete room"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
              <button
                onClick={() => handleRoomSelect(room)}
                className="w-full"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{room.id}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Cap: {room.capacity}</div>
                  </div>
                  <div className="p-2 rounded-md bg-indigo-50 dark:bg-indigo-900">
                    <RoomIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-200" />
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={showRoomModal} onClose={() => setShowRoomModal(false)} title={editingRoom ? 'Edit Room' : 'Add Room'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., A101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity</label>
            <input
              type="number"
              value={roomCapacity}
              onChange={(e) => setRoomCapacity(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., 30"
              min="1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRoomModal(false)}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={editingRoom ? handleEditRoom : handleAddRoom}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {editingRoom ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

  const ApplicantsView = () => {
    const roomApplicants = filteredApplicants.filter(a => a.roomId === selectedRoom?.id);
    
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Scheduled Applicants</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCampus?.name} • {selectedBuilding?.name} - {selectedRoom?.id}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
              <button onClick={exportScheduleCSV} className="px-4 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <DownloadIcon className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md overflow-hidden shadow-sm">
            <table className="w-full table-auto">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Application No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Course</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Major</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">PWD</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Time Slot</th>
                </tr>
              </thead>
              <tbody>
                {roomApplicants.length > 0 ? (
                  roomApplicants.map((applicant, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.appNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.course}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.major || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {applicant.isPWD ? (
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded">PWD</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.timeSlot || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No applicants scheduled for this room
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-right">
            <span className="text-sm text-gray-500 dark:text-gray-400">{roomApplicants.length} applicant(s) in this room</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {currentView === 'campuses' && <CampusesView />}
          {currentView === 'buildings' && <BuildingsView />}
          {currentView === 'rooms' && <RoomsView />}
          {currentView === 'applicants' && <ApplicantsView />}
        </main>
      </div>
    </div>
  );
};

export default Scheduler;