'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStats, getSlotsForMonth, getUpcomingSlots } from './schedule';

type Campus = { id: string; name: string };
type Building = { id: string; name: string };
type Room = { id: string; name: string; capacity: string };
type Applicant = { appNo: string; course: string; major: string; time: string };

/* Icons (kept the same look & props as before) */
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

/**
 * Main page component
 * - Sidebar & Header are kept exactly from your original design.
 * - The "campuses / buildings / rooms / applicants" UI is removed.
 * - The main area now contains the Dashboard UI (stats, calendar, upcoming) connected to ./lib/schedule.
 */
const Dashboard: React.FC = () => {
  const pathname = usePathname();

  // theme state (shared for this page)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('cla-theme');
    if (stored) return stored === 'dark';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  });

  // search query used in header
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cla-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cla-theme', 'light');
    }
  }, [isDark]);

  // Stats / calendar data from shared lib
  const stats = useMemo(() => getStats(), []);

  const now = new Date();
  const [displayMonth, setDisplayMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  type Slot = { id: string; date: string; time: string; [key: string]: any };

  const monthSlots = useMemo(() => getSlotsForMonth(year, month) as Slot[], [year, month]);
  const upcoming = useMemo(() => getUpcomingSlots(6), []);

  function prevMonth() {
    setDisplayMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setDisplayMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // calendar matrix builder
  function buildCalendarMatrix(year: number, monthIndex: number) {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const firstDay = first.getDay(); // 0=Sun .. 6=Sat
    const daysInMonth = last.getDate();

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(7).fill(null);
    let day = 1;
    // Fill first week
    for (let i = firstDay; i < 7; i++) {
      week[i] = day++;
    }
    weeks.push(week);
    while (day <= daysInMonth) {
      week = new Array(7).fill(null);
      for (let i = 0; i < 7 && day <= daysInMonth; i++) {
        week[i] = day++;
      }
      weeks.push(week);
    }
    return weeks;
  }

  const weeks = useMemo(() => buildCalendarMatrix(year, month), [year, month]);
  const monthLabel = displayMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  function formatDate(year: number, monthIndex: number, day: number) {
    const mm = (monthIndex + 1).toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  function eventsOn(day: number) {
    const dateStr = formatDate(year, month, day);
    return monthSlots.filter((s: Slot) => s.date === dateStr);
  }

  // Nav items
  const navItems = [
    { href: '/', label: 'Scheduler', icon: <BuildingIcon className="w-5 h-5" /> },
    { href: '/Dashboard', label: 'Dashboard', icon: <BuildingIcon className="w-5 h-5 text-indigo-500" /> },
    { href: '/Calendar', label: 'Calendar', icon: <MenuIcon className="w-5 h-5 text-yellow-500" /> },
    { href: '/Participants', label: 'Participants', icon: <UsersIcon className="w-5 h-5 text-green-500" /> },
    { href: '/Messages', label: 'Messages', icon: <BellIcon className="w-5 h-5 text-pink-500" /> },
    { href: '/Notifications', label: 'Notifications', icon: <FileIcon className="w-5 h-5 text-gray-500" /> },
  ];

  // Sidebar (kept the same)
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

  // Header (kept the same)
  const Header = () => (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Scheduler</h1>

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

  // Main: Dashboard UI (replaces campuses/buildings/rooms/applicants)
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Administrator</div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of schedule, stats and upcoming applicants</p>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/Calendar" className="px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-sm">
                  Open Calendar
                </Link>
                <button
                  onClick={() => setIsDark((t) => !t)}
                  className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-sm"
                  title="toggle theme"
                >
                  {isDark ? 'Light' : 'Dark'}
                </button>
              </div>
            </div>

            {/* Stats */}
            <section className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Campuses</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalCampuses}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Buildings</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalBuildings}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Rooms</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalRooms}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Applicants scheduled</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalScheduled}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Occupancy: {stats.occupancyRate}%</div>
              </div>
            </section>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Calendar</div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">Prev</button>
                    <button onClick={nextMonth} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">Next</button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-7 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <div className="text-center">Sun</div>
                    <div className="text-center">Mon</div>
                    <div className="text-center">Tue</div>
                    <div className="text-center">Wed</div>
                    <div className="text-center">Thu</div>
                    <div className="text-center">Fri</div>
                    <div className="text-center">Sat</div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-2 text-sm">
                        {week.map((day, di) => {
                          const has = day ? eventsOn(day).length > 0 : false;
                          const isToday =
                            day &&
                            new Date().getFullYear() === year &&
                            new Date().getMonth() === month &&
                            new Date().getDate() === day;
                          return (
                            <div
                              key={di}
                              className={`min-h-[64px] p-2 rounded-md border ${day ? 'bg-white dark:bg-gray-900' : 'bg-transparent'} ${
                                isToday ? 'ring-2 ring-indigo-300' : 'border-gray-100 dark:border-gray-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className={`text-sm ${day ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{day ?? ''}</div>
                                {has && <div className="w-2 h-2 rounded-full bg-indigo-500" title={`${eventsOn(day || 0).length} event(s)`} />}
                              </div>

                              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                {day &&
                                  eventsOn(day).slice(0, 2).map((e) => (
                                    <div key={e.id} className="px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40">
                                      <div className="truncate">{e.time}</div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Total events this month: {monthSlots.length}</div>
              </div>

              <aside className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Upcoming</div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Next slots</h3>
                  </div>
                  <Link href="/" className="text-sm text-indigo-600 dark:text-indigo-300">Open schedule</Link>
                </div>

                <ul className="mt-4 space-y-3">
                  {upcoming.length === 0 && <li className="text-sm text-gray-500 dark:text-gray-400">No upcoming slots</li>}
                  {upcoming.map((it: { slot: Slot; applicant: Applicant; room: Room }) => {
                    const { slot, applicant, room } = it;
                    return (
                      <li key={slot.id} className="p-3 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{applicant?.appNo}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{slot.date} • {slot.time}</div>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">{room?.name}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">Showing up to 6 upcoming slots</div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;