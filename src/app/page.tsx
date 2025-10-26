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

const ATBulSUSchedule = () => {
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

  // Mock data
  const [campuses] = useState<Campus[]>([
    { id: '1', name: 'Main Campus' },
    { id: '2', name: 'Alangilan Campus' },
    { id: '3', name: 'Pablo Borbon Campus' }
  ]);

  const [buildings] = useState<Record<string, Building[]>>({
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

  const [rooms] = useState<Record<string, Room[]>>({
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    // Parse CSV
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
    
    // Separate PWD and non-PWD applicants
    const pwdApplicants = applicants.filter(a => a.isPWD);
    const nonPwdApplicants = applicants.filter(a => !a.isPWD);
    
    // Prioritize PWD applicants
    const sortedApplicants = [...pwdApplicants, ...nonPwdApplicants];
    
    // Create room-time slot combinations
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

    // Assign applicants to slots
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

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get all available rooms
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
    { href: '/', label: 'ATBulSU Schedule', icon: <BuildingIcon className="w-5 h-5" /> },
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
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">ATBulSU Schedule</h1>

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

  const CampusesView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center">Schedule Management</h2>

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
          <button
            key={campus.id}
            onClick={() => handleCampusSelect(campus)}
            className="flex flex-col items-start gap-2 p-6 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transform hover:-translate-y-1 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-indigo-50 dark:bg-indigo-800">
                <BuildingIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-200" />
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">{campus.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">View schedules</div>
              </div>
            </div>
          </button>
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
          <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {selectedCampus && (buildings[selectedCampus.id] || []).map((building) => (
            <button
              key={building.id}
              onClick={() => handleBuildingSelect(building)}
              className="flex flex-col items-start gap-2 p-5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition transform hover:-translate-y-1"
            >
              <div className="rounded-md p-3 bg-yellow-50 dark:bg-yellow-900">
                <BuildingIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{building.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">View rooms</div>
            </button>
          ))}
        </div>
      </div>
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
          <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {selectedBuilding && (rooms[selectedBuilding.id] || []).map((room) => (
            <button
              key={room.id}
              onClick={() => handleRoomSelect(room)}
              className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5"
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
          ))}
        </div>
      </div>
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

export default ATBulSUSchedule;