// Snippet from: src/app/page.tsx (lines 1-463)
// IMPORTANT: The user requested this snippet always be shown unchanged.
'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Campus = { id: string; name: string };
type Building = { id: string; name: string };
type Room = { id: string; capacity: string };
type Applicant = { appNo: string; course: string; major: string; time: string };

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.9 4.9l1.4 1.4" />
    <path d="M17.7 17.7l1.4 1.4" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M4.9 19.1l1.4-1.4" />
    <path d="M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const BuildingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21v-13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13" />
    <path d="M9 21V9" />
    <path d="M13 21V9" />
    <path d="M7 7h.01" />
    <path d="M11 7h.01" />
    <path d="M15 7h.01" />
  </svg>
);

const RoomIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
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
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

const ATBulSUSchedule: React.FC = () => {
  const [currentView, setCurrentView] = useState<'campuses' | 'buildings' | 'rooms' | 'applicants'>('campuses');
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [query, setQuery] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    // initialize theme from localStorage or prefers-color-scheme
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cla-theme') : null;
    if (stored) {
      setIsDark(stored === 'dark');
    } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    // apply theme globally and persist
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

  const campuses: Campus[] = [
    { id: 'main', name: 'MAIN CAMPUS' },
    { id: 'sarmiento', name: 'SARMIENTO' },
    { id: 'hagonoy', name: 'HAGONOY' },
    { id: 'sanrafael', name: 'SAN RAFAEL' },
    { id: 'meneses', name: 'MENESES' },
    { id: 'bustos', name: 'BUSTOS' },
  ];

  const buildings: Record<string, Building[]> = {
    main: [
      { id: 'fed', name: 'FED HALL' },
      { id: 'alvarado', name: 'ALVARADO HALL' },
      { id: 'roxas', name: 'ROXAS HALL' },
      { id: 'pimentel', name: 'PIMENTEL' },
    ],
  };

  const rooms: Record<string, Room[]> = {
    fed: Array.from({ length: 15 }).map((_, i) => {
      const id = (i < 5 ? 100 : i < 10 ? 200 : 300) + (i % 5) + 1;
      return { id: String(id), capacity: '30/30' };
    }),
  };

  const applicants: Applicant[] = new Array(15).fill(null).map((_, i) => ({
    appNo: `2024-${(1000 + i).toString().padStart(4, '0')}`,
    course: i % 2 === 0 ? 'BS MATH' : 'BS CS',
    major: i % 3 === 0 ? 'Comscie' : i % 3 === 1 ? 'Applied Math' : '',
    time: i < 6 ? '8:00 - 12:00' : i < 12 ? '1:00 - 5:00' : '',
  }));

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

  const filteredApplicants = applicants.filter(
    (a) =>
      a.appNo.includes(query) ||
      a.course.toLowerCase().includes(query.toLowerCase()) ||
      a.major.toLowerCase().includes(query.toLowerCase())
  );

  // Navigation items that map to the different folders you showed in the project tree.
  // Make sure the folder names in src/app match these paths (case-sensitive on some hosts).
  const navItems = [
    { href: '/', label: 'ATBulSU Schedule', icon: <BuildingIcon className="w-5 h-5" /> },
    { href: '/Dashboard', label: 'Dashboard', icon: <BuildingIcon className="w-5 h-5 text-indigo-500" /> },
    { href: '/Calendar', label: 'Calendar', icon: <MenuIcon className="w-5 h-5 text-yellow-500" /> },
    { href: '/Students', label: 'Students', icon: <UsersIcon className="w-5 h-5 text-green-500" /> },
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
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 font-semibold shadow-inner'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              aria-current={isActive ? 'page' : undefined}
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
            className="pl-9 pr-3 py-2 rounded-md bg-gray-100 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Search applicants, course, major..."
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
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center">Campuses</h2>

      <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
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
                <div className="text-xs text-gray-500 dark:text-gray-400">View buildings & rooms</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <label className="cursor-pointer">
            <input type="file" className="hidden" />
            <button className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-200 shadow-sm">Choose file</button>
          </label>
          <span className="text-sm text-gray-500 dark:text-gray-400">dataset.csv</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm shadow hover:bg-indigo-700 transition">Generate schedule</button>
          <button className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-200 shadow hover:shadow-md transition">Export schedule</button>
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
          <div>
            <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
          </div>
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
          <div>
            <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
          </div>
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
                  <div className="text-xs text-gray-500 dark:text-gray-400">{room.capacity}</div>
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

  const ApplicantsView = () => (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Admin Home UI</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Applicants</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCampus?.name} • {selectedBuilding?.name} - {selectedRoom?.id}</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">Back</button>
            <button className="px-4 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200">Export</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md overflow-hidden shadow-sm">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Application No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Course</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Major</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplicants.map((applicant, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.appNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.course}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.major || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.time || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-right">
          <span className="text-sm text-gray-500 dark:text-gray-400">{filteredApplicants.length} results</span>
        </div>
      </div>
    </div>
  );

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