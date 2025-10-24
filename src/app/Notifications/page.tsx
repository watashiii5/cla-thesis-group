'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getStats,
  type ScheduledSlot,
  type Applicant,
  applicants as libApplicants,
} from '..//schedule';

/* Icons (consistent) */
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

type Notification = {
  id: string;
  title: string;
  body?: string;
  date: string;
  read?: boolean;
  relatedSlotId?: string; // optional link to a scheduled slot
};

const DEFAULT_NOTIF_KEY = 'cla-notifs-v1';

export default function NotificationsPage() {
  const pathname = usePathname();
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

  const applicants = libApplicants as Applicant[];
  const stats = useMemo(() => getStats(), []);

  // demo notifications persisted locally
  const [notifs, setNotifs] = useState<Notification[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DEFAULT_NOTIF_KEY);
      if (stored) {
        try {
          return JSON.parse(stored) as Notification[];
        } catch {}
      }
    }
    const today = new Date().toISOString();
    return [
      { id: 'n-1', title: 'New slot scheduled', body: 'A slot was scheduled for 2025-11-01', date: today, read: false },
      { id: 'n-2', title: 'Room changed', body: 'Room for s-2 was changed to 201', date: today, read: true },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(DEFAULT_NOTIF_KEY, JSON.stringify(notifs));
    } catch {}
  }, [notifs]);

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return notifs
      .filter((n) => (filter === 'unread' ? !n.read : true))
      .filter((n) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [notifs, filter, query]);

  function markRead(id: string) {
    setNotifs((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  function markUnread(id: string) {
    setNotifs((s) => s.map((n) => (n.id === id ? { ...n, read: false } : n)));
  }
  function removeNotif(id: string) {
    if (!confirm('Remove notification?')) return;
    setNotifs((s) => s.filter((n) => n.id !== id));
  }
  function clearAll() {
    if (!confirm('Clear all notifications?')) return;
    setNotifs([]);
  }

  // Nav items
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
            placeholder="Search notifications..."
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Notifications</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">System and schedule notifications — manage and review</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setNotifs((s) => s.map((n) => ({ ...n, read: true })))} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Mark all read</button>
                <button onClick={clearAll} className="px-3 py-2 rounded-md bg-red-50 text-red-600 text-sm">Clear all</button>
              </div>
            </div>

            <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-1 rounded bg-white dark:bg-gray-900 border">
                      <option value="all">All</option>
                      <option value="unread">Unread</option>
                    </select>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Showing {filtered.length}</div>
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400">Total {notifs.length} notifications</div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((n) => (
                    <div key={n.id} className={`p-3 flex items-start justify-between ${n.read ? '' : 'bg-indigo-50 dark:bg-indigo-900/30'} rounded-md mb-2`}>
                      <div>
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{n.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{n.body}</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(n.date).toLocaleString()}</div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        {n.read ? (
                          <button onClick={() => markUnread(n.id)} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-900 border">Mark unread</button>
                        ) : (
                          <button onClick={() => markRead(n.id)} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">Mark read</button>
                        )}
                        <button onClick={() => removeNotif(n.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 shadow-sm">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Overview</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Stats</h3>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Applicants</div>
                    <div className="font-semibold">{stats.totalCampuses}</div>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-400">Slots (lib)</div>
                    <div className="font-semibold">{stats.totalScheduled}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Recent</div>
                  <ul className="mt-2 space-y-2">
                    {notifs.slice(0, 6).map((n) => (
                      <li key={n.id} className="text-sm p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(n.date).toLocaleDateString()}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}