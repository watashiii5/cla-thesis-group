'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  campuses as libCampuses,
  buildings as libBuildings,
  rooms as libRooms,
  applicants as libApplicants,
  scheduledSlots as libScheduledSlots,
  getSlotsForMonth,
  getUpcomingSlots,
  getStats,
  type ScheduledSlot,
  type Applicant,
  type Room,
} from '../schedule';

/**
 * CalendarPage
 *
 * - Uses the same Sidebar / Header / styling / dark-mode key ("cla-theme") as your other pages,
 *   so the UI looks identical across pages.
 * - Provides an interactive calendar with multiple views: month / week / day / list.
 * - Allows creating, editing, deleting and moving slots (persisted to localStorage for demo).
 * - Filters and search for quick discovery.
 *
 * Notes:
 * - This is a self-contained client page for demo purposes. For production you'd move
 *   schedule persistence to a backend or a shared Context so other pages update live.
 */

/* Re-used icons to keep the same look */
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
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
const HelpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);
const RoomIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

/* Utility helpers */
const pad = (n: number) => String(n).padStart(2, '0');
const formatDateYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* Component */
const CalendarPage: React.FC = () => {
  const pathname = usePathname();

  // theme (same key as other pages)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('cla-theme');
    if (stored) return stored === 'dark';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  });

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

  // load initial data (persisted copy of scheduled slots for interactive demo)
  const [slots, setSlots] = useState<ScheduledSlot[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cla-scheduled-slots');
      if (stored) {
        try {
          return JSON.parse(stored) as ScheduledSlot[];
        } catch {
          // fallthrough
        }
      }
    }
    // copy from lib (do not mutate libScheduledSlots)
    return libScheduledSlots.map((s: ScheduledSlot) => ({ ...s }));
  });

  useEffect(() => {
    try {
      localStorage.setItem('cla-scheduled-slots', JSON.stringify(slots));
    } catch {
      // ignore
    }
  }, [slots]);

  // view state and navigation (month/week/day/list)
  type View = 'month' | 'week' | 'day' | 'list';
  const [view, setView] = useState<View>('month');
  const now = new Date();
  const [cursorDate, setCursorDate] = useState<Date>(new Date(now.getFullYear(), now.getMonth(), now.getDate())); // active date for week/day
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // small selectors
  const applicants = libApplicants as Applicant[];
  const rooms = libRooms as Room[];

  // derived stats (connected to schedule)
  const stats = useMemo(() => getStats(), []);
  const upcoming = useMemo(() => getUpcomingSlots(12), [slots]); // show based on library data — local slots not used here for simplify; you can map local changes if needed

  // calendar helpers
  const displayMonth = useMemo(() => new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1), [cursorDate]);
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  function prev() {
    if (view === 'month') setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === 'week') setCursorDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    else setCursorDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }
  function next() {
    if (view === 'month') setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === 'week') setCursorDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    else setCursorDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }
  function goToday() {
    setCursorDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setView('month');
  }

  // build month matrix (same as Dashboard)
  function buildCalendarMatrix(yearN: number, monthIndex: number) {
    const first = new Date(yearN, monthIndex, 1);
    const last = new Date(yearN, monthIndex + 1, 0);
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

  function formatYMD(yearN: number, monthIndex: number, dayN: number) {
    const mm = (monthIndex + 1).toString().padStart(2, '0');
    const dd = dayN.toString().padStart(2, '0');
    return `${yearN}-${mm}-${dd}`;
  }

  // events queries against local slots
  function slotsOnDate(ymd: string) {
    return slots.filter((s) => s.date === ymd);
  }

  // week view days
  const weekStart = useMemo(() => {
    const d = new Date(cursorDate);
    const day = d.getDay(); // 0..6
    d.setDate(d.getDate() - day); // go to Sunday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  // modal for create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledSlot | null>(null);
  const [form, setForm] = useState({
    applicantId: libApplicants[0]?.id ?? '',
    roomId: libRooms[0]?.id ?? '',
    date: formatDateYMD(now),
    time: '08:00 - 12:00',
    status: 'scheduled',
  });

  // when opening modal for a day
  function openCreateFor(dateISO: string) {
    setEditing(null);
    setForm((f) => ({ ...f, date: dateISO }));
    setModalOpen(true);
  }

  function openEdit(slot: ScheduledSlot) {
    setEditing(slot);
    setForm({ applicantId: slot.applicantId, roomId: slot.roomId, date: slot.date, time: slot.time, status: slot.status ?? 'scheduled' });
    setModalOpen(true);
  }

  function saveFromModal() {
    if (!form.applicantId || !form.roomId || !form.date) return;
    if (editing) {
      setSlots((s) => s.map((it) => (it.id === editing.id ? { ...it, ...form } as ScheduledSlot : it)));
    } else {
      const newSlot: ScheduledSlot = {
        id: `s-${Date.now()}`,
        applicantId: form.applicantId,
        roomId: form.roomId,
        date: form.date,
        time: form.time,
        status: form.status as any,
      };
      setSlots((s) => [...s, newSlot]);
    }
    setModalOpen(false);
  }

  function deleteSlot(id: string) {
    if (!confirm('Delete this slot?')) return;
    setSlots((s) => s.filter((it) => it.id !== id));
    setModalOpen(false);
  }

  // quick move: move slot to given date
  function moveSlotTo(id: string, dateISO: string) {
    setSlots((s) => s.map((it) => (it.id === id ? { ...it, date: dateISO } : it)));
  }

  // filter/search applied when showing lists
  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (filterRoom !== 'all' && s.roomId !== filterRoom) return false;
      if (filterCourse !== 'all') {
        const ap = applicants.find((a) => a.id === s.applicantId);
        if (!ap) return false;
        if (filterCourse !== ap.course) return false;
      }
      if (search.trim()) {
        const ap = applicants.find((a) => a.id === s.applicantId);
        const matches =
          s.date.includes(search) ||
          s.time.includes(search) ||
          ap?.appNo.includes(search) ||
          ap?.course.toLowerCase().includes(search.toLowerCase()) ||
          ap?.major.toLowerCase().includes(search.toLowerCase());
        return matches;
      }
      return true;
    });
  }, [slots, filterRoom, filterCourse, search, applicants]);

  // helpers to display applicant & room info
  function findApplicant(id?: string) {
    return libApplicants.find((a: Applicant) => a.id === id);
  }
  function findRoom(id?: string) {
    return libRooms.find((r: Room) => r.id === id);
  }

  /* Sidebar & Header (kept the same look so sidebar is shared across pages) */
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

  const Header = () => {
    const [localSearch, setLocalSearch] = useState<string>('');
    return (
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">ATBulSU Schedule</h1>

          <div className="relative">
            <input
              aria-label="search"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setSearch(e.target.value);
              }}
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
  };

  /* RENDER */
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Administrator</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Calendar</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Interactive calendar — create, edit, move & filter slots</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md border border-gray-100 dark:border-gray-800 p-2 bg-white dark:bg-gray-900">
                  <button onClick={prev} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">Prev</button>
                  <button onClick={goToday} className="px-3 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 text-sm">Today</button>
                  <button onClick={next} className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm">Next</button>
                </div>

                <div className="flex items-center gap-2">
                  <select value={view} onChange={(e) => setView(e.target.value as View)} className="px-3 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <option value="month">Month</option>
                    <option value="week">Week</option>
                    <option value="day">Day</option>
                    <option value="list">List</option>
                  </select>

                  <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} className="px-3 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <option value="all">All rooms</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="px-3 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <option value="all">All courses</option>
                    {[...new Set(applicants.map((a) => a.course))].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <button onClick={() => { setModalOpen(true); setEditing(null); setForm({ applicantId: applicants[0]?.id ?? '', roomId: rooms[0]?.id ?? '', date: formatDateYMD(cursorDate), time: '08:00 - 12:00', status: 'scheduled' }); }} className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm">New slot</button>
                </div>
              </div>
            </div>

            {/* VIEW: Month */}
            {view === 'month' && (
              <div>
                <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">{monthLabel}</div>

                <div className="grid grid-cols-7 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  <div className="text-center">Sun</div>
                  <div className="text-center">Mon</div>
                  <div className="text-center">Tue</div>
                  <div className="text-center">Wed</div>
                  <div className="text-center">Thu</div>
                  <div className="text-center">Fri</div>
                  <div className="text-center">Sat</div>
                </div>

                <div className="space-y-2">
                  {weeks.map((weekRow, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-2 text-sm">
                      {weekRow.map((day, di) => {
                        const ymd = day ? formatYMD(year, month, day) : '';
                        const daySlots = day ? slotsOnDate(ymd) : [];
                        const has = daySlots.length > 0;
                        const isToday = day && new Date().getFullYear() === now.getFullYear() && new Date().getMonth() === now.getMonth() && new Date().getDate() === day;
                        return (
                          <div
                            key={di}
                            className={`min-h-[84px] p-2 rounded-md border ${day ? 'bg-white dark:bg-gray-900' : 'bg-transparent'} ${
                              isToday ? 'ring-2 ring-indigo-300' : 'border-gray-100 dark:border-gray-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className={`text-sm ${day ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{day ?? ''}</div>
                              <div className="flex items-center gap-1">
                                {has && <div className="w-2 h-2 rounded-full bg-indigo-500" title={`${daySlots.length} event(s)`} />}
                                {day && (
                                  <button onClick={() => openCreateFor(ymd)} className="text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                                    + Add
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 space-y-1">
                              {daySlots
                                .filter((s) => {
                                  if (filterRoom !== 'all' && s.roomId !== filterRoom) return false;
                                  if (filterCourse !== 'all') {
                                    const ap = findApplicant(s.applicantId);
                                    if (!ap) return false;
                                    if (ap.course !== filterCourse) return false;
                                  }
                                  if (search.trim()) {
                                    const ap = findApplicant(s.applicantId);
                                    return (
                                      s.time.includes(search) ||
                                      s.date.includes(search) ||
                                      ap?.appNo.includes(search) ||
                                      ap?.course.toLowerCase().includes(search.toLowerCase()) ||
                                      ap?.major.toLowerCase().includes(search.toLowerCase())
                                    );
                                  }
                                  return true;
                                })
                                .slice(0, 3)
                                .map((s) => {
                                  const ap = findApplicant(s.applicantId);
                                  const rm = findRoom(s.roomId);
                                  return (
                                    <button key={s.id} onClick={() => openEdit(s)} className="w-full text-left px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40">
                                      <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{ap?.appNo} • {s.time}</div>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{rm?.name} • {ap?.course}</div>
                                    </button>
                                  );
                                })}
                              {daySlots.length > 3 && <div className="text-xs text-gray-400">+{daySlots.length - 3} more</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW: Week */}
            {view === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((d) => {
                  const ymd = formatDateYMD(d);
                  const daySlots = slotsOnDate(ymd).filter((s) => {
                    if (filterRoom !== 'all' && s.roomId !== filterRoom) return false;
                    if (filterCourse !== 'all') {
                      const ap = findApplicant(s.applicantId);
                      if (!ap) return false;
                      if (ap.course !== filterCourse) return false;
                    }
                    if (search.trim()) {
                      const ap = findApplicant(s.applicantId);
                      return (
                        s.time.includes(search) ||
                        ap?.appNo.includes(search) ||
                        ap?.course.toLowerCase().includes(search.toLowerCase())
                      );
                    }
                    return true;
                  });

                  return (
                    <div key={d.toISOString()} className="rounded-md p-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 min-h-[360px]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        <button onClick={() => openCreateFor(ymd)} className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/40">+ Add</button>
                      </div>

                      <div className="space-y-2">
                        {daySlots.length === 0 && <div className="text-xs text-gray-400">No slots</div>}
                        {daySlots.map((s) => {
                          const ap = findApplicant(s.applicantId);
                          const rm = findRoom(s.roomId);
                          return (
                            <div key={s.id} className="p-2 rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{s.time}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{ap?.appNo} • {ap?.course}</div>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-300">{rm?.name}</div>
                              </div>

                              <div className="mt-2 flex gap-2">
                                <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-900 border">Edit</button>
                                <button onClick={() => moveSlotTo(s.id, formatDateYMD(new Date(new Date(s.date).getTime() + 24 * 60 * 60 * 1000)))} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">+1 day</button>
                                <button onClick={() => deleteSlot(s.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW: Day */}
            {view === 'day' && (
              <div>
                <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">{cursorDate.toLocaleDateString()}</div>

                <div className="space-y-3">
                  {(slotsOnDate(formatDateYMD(cursorDate)).filter((s) => {
                    if (filterRoom !== 'all' && s.roomId !== filterRoom) return false;
                    if (filterCourse !== 'all') {
                      const ap = findApplicant(s.applicantId);
                      if (!ap) return false;
                      if (ap.course !== filterCourse) return false;
                    }
                    if (search.trim()) {
                      const ap = findApplicant(s.applicantId);
                      return s.time.includes(search) || ap?.appNo.includes(search) || ap?.course.toLowerCase().includes(search.toLowerCase());
                    }
                    return true;
                  }) || []).map((s) => {
                    const ap = findApplicant(s.applicantId);
                    const rm = findRoom(s.roomId);
                    return (
                      <div key={s.id} className="p-3 rounded-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.time} • {ap?.appNo}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{rm?.name} • {ap?.course} {ap?.major && `• ${ap.major}`}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-900 border">Edit</button>
                            <button onClick={() => deleteSlot(s.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW: List */}
            {view === 'list' && (
              <div>
                <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">All slots</div>

                <div className="space-y-2">
                  {filteredSlots.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No slots</div>}
                  {filteredSlots.map((s) => {
                    const ap = findApplicant(s.applicantId);
                    const rm = findRoom(s.roomId);
                    return (
                      <div key={s.id} className="p-3 rounded-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{s.date} • {s.time}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{ap?.appNo} • {ap?.course} • {rm?.name}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(s)} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-900 border">Edit</button>
                          <button onClick={() => deleteSlot(s.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Right column summary (stats + upcoming) */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-2"></div>

              <aside className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div className="mb-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Overview</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Stats</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-700 dark:text-gray-200">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Campuses</div>
                    <div className="font-semibold">{stats.totalCampuses}</div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Buildings</div>
                    <div className="font-semibold">{stats.totalBuildings}</div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Rooms</div>
                    <div className="font-semibold">{stats.totalRooms}</div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Scheduled</div>
                    <div className="font-semibold">{slots.length}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Upcoming</div>
                </div>

                <ul className="space-y-2">
                  {slots.length === 0 && <li className="text-sm text-gray-500 dark:text-gray-400">No scheduled slots</li>}
                  {slots
                    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
                    .slice(0, 6)
                    .map((s) => {
                      const ap = findApplicant(s.applicantId);
                      const rm = findRoom(s.roomId);
                      return (
                        <li key={s.id} className="p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{ap?.appNo}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{s.date} • {s.time}</div>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">{rm?.name}</div>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </aside>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Create / Edit slot */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{editing ? 'Edit slot' : 'Create slot'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-sm text-gray-500">Close</button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <div className="text-xs text-gray-500 mb-1">Applicant</div>
                <select value={form.applicantId} onChange={(e) => setForm((f) => ({ ...f, applicantId: e.target.value }))} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border">
                  {applicants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.appNo} — {a.course} {a.major && `• ${a.major}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-gray-500 mb-1">Room</div>
                <select value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border">
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} • capacity {r.capacity}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <div className="text-xs text-gray-500 mb-1">Date</div>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border" />
                </label>

                <label>
                  <div className="text-xs text-gray-500 mb-1">Time</div>
                  <input type="text" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border" />
                </label>
              </div>

              <label className="block">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border">
                  <option value="scheduled">scheduled</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>

              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button onClick={saveFromModal} className="px-3 py-2 rounded bg-indigo-600 text-white">Save</button>
                  {editing && <button onClick={() => editing && deleteSlot(editing.id)} className="px-3 py-2 rounded bg-red-50 text-red-600">Delete</button>}
                </div>

                <div className="text-xs text-gray-500">Slots are persisted locally (localStorage) for demo.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;