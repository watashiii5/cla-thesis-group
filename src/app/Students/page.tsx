'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  applicants as libApplicants,
  scheduledSlots as libScheduledSlots,
  rooms as libRooms,
  getStats,
  type Applicant,
  type ScheduledSlot,
  type Room,
} from '../schedule';

/* Reuse icons so UI matches Dashboard / Calendar */
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

/* Utility */
const formatSlotLabel = (s?: ScheduledSlot, rooms?: Room[]) => {
  if (!s) return '—';
  const r = rooms?.find((x) => x.id === s.roomId);
  return `${s.date} • ${s.time} ${r ? `• ${r.name}` : ''}`;
};

const StudentsPage: React.FC = () => {
  const pathname = usePathname();

  // theme
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

  // Data (read-only from shared lib)
  const applicants = libApplicants as Applicant[];
  const slots = libScheduledSlots as ScheduledSlot[];
  const rooms = libRooms as Room[];

  // Filters & search
  const [query, setQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState<'all' | string>('all');
  const [filterHasSlot, setFilterHasSlot] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const stats = useMemo(() => getStats(), []);

  // Derived: compute slot count per applicant and next slot
  const applicantWithMeta = useMemo(() => {
    return applicants.map((a) => {
      const assigned = slots.filter((s) => s.applicantId === a.id);
      const next = assigned
        .slice()
        .sort((x, y) => (x.date === y.date ? x.time.localeCompare(y.time) : x.date.localeCompare(y.date)))[0];
      return { applicant: a, count: assigned.length, next };
    });
  }, [applicants, slots]);

  const filtered = useMemo(() => {
    return applicantWithMeta.filter(({ applicant, count, next }) => {
      if (filterCourse !== 'all' && applicant.course !== filterCourse) return false;
      if (filterHasSlot === 'assigned' && count === 0) return false;
      if (filterHasSlot === 'unassigned' && count > 0) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        applicant.appNo.toLowerCase().includes(q) ||
        applicant.course.toLowerCase().includes(q) ||
        (applicant.major || '').toLowerCase().includes(q) ||
        (next?.date || '').includes(q)
      );
    });
  }, [applicantWithMeta, filterCourse, filterHasSlot, query]);

  // modal to view details
  const [modalOpen, setModalOpen] = useState(false);
  const [activeApplicant, setActiveApplicant] = useState<Applicant | null>(null);

  function openDetails(a: Applicant) {
    setActiveApplicant(a);
    setModalOpen(true);
  }

  function exportCSV() {
    const rows = [
      ['appNo', 'course', 'major', 'assignedSlots', 'nextSlot'],
      ...filtered.map(({ applicant, count, next }) => [
        applicant.appNo,
        applicant.course,
        applicant.major || '',
        String(count),
        next ? `${next.date} ${next.time}` : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Nav items (same as other pages)
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
            placeholder="Search by appNo, course, major..."
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Students</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage applicants and view assigned schedule slots</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={exportCSV} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Export CSV</button>
                <Link href="/Calendar" className="px-3 py-2 rounded-md bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-sm">Open Calendar</Link>
              </div>
            </div>

            {/* quick stats */}
            <section className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Applicants</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalApplicants}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Scheduled</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{slots.length}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Rooms</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.totalRooms}</div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-lg shadow-sm">
                <div className="text-xs text-gray-400">Occupancy</div>
                <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-2">{stats.occupancyRate}%</div>
              </div>
            </section>

            {/* filters */}
            <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value as any)} className="px-3 py-2 rounded bg-white dark:bg-gray-900 border">
                  <option value="all">All courses</option>
                  {[...new Set(applicants.map((a) => a.course))].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select value={filterHasSlot} onChange={(e) => setFilterHasSlot(e.target.value as any)} className="px-3 py-2 rounded bg-white dark:bg-gray-900 border">
                  <option value="all">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>

                <button onClick={() => { setFilterCourse('all'); setFilterHasSlot('all'); setQuery(''); }} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-800">Reset</button>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} result(s)</div>
            </div>

            {/* students table */}
            <div className="mt-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md overflow-hidden shadow-sm">
              <table className="w-full table-auto">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Application No</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Course</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Major</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Assigned</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300">Next slot</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(({ applicant, count, next }, i) => (
                    <tr key={applicant.id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.appNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.course}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{applicant.major || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{count}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{formatSlotLabel(next, rooms)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openDetails(applicant)} className="px-2 py-1 rounded bg-white dark:bg-gray-900 border text-sm">View</button>
                          <Link href="/Calendar" className="px-2 py-1 rounded bg-indigo-600 text-white text-sm">Schedule</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* small pagination placeholder (client-side array; keep simple) */}
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">Showing {filtered.length} applicant(s)</div>
          </div>
        </main>
      </div>

      {/* modal: applicant details */}
      {modalOpen && activeApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Applicant details</h3>
              <button onClick={() => setModalOpen(false)} className="text-sm text-gray-500">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Application No</div>
                <div className="font-medium">{activeApplicant.appNo}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Course</div>
                <div className="font-medium">{activeApplicant.course}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Major</div>
                <div className="font-medium">{activeApplicant.major || '—'}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Assigned slots</div>
                <div className="mt-1 space-y-2">
                  {slots.filter((s) => s.applicantId === activeApplicant.id).length === 0 && <div className="text-sm text-gray-500">No assigned slots</div>}
                  {slots.filter((s) => s.applicantId === activeApplicant.id).map((s) => (
                    <div key={s.id} className="p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{s.date} • {s.time}</div>
                          <div className="text-xs text-gray-500">{rooms.find((r) => r.id === s.roomId)?.name}</div>
                        </div>
                        <div className="text-xs text-gray-500">{s.status || 'scheduled'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link href="/Calendar" className="px-3 py-2 rounded bg-indigo-600 text-white">Open Calendar</Link>
                <button onClick={() => setModalOpen(false)} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-800">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;