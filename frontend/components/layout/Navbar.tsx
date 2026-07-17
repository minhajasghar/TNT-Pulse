'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, CheckCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/activity': 'Activity',
  '/settings': 'Settings',
};

interface Alert {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface SearchResult {
  projects: { id: number; name: string; status: string }[];
  tasks: { id: number; title: string; status: string; project_name: string }[];
  users: { id: number; name: string; email: string; role: string }[];
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [dateStr, setDateStr] = useState('');

  const alertRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const today = useCallback(() => {
    setDateStr(new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }));
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/alerts/unread-count');
      setUnreadCount(res.data.data.count);
    } catch {
      //
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/api/alerts?is_read=false&limit=5');
      setAlerts(res.data.data.alerts);
      setUnreadCount(res.data.data.unread_count);
    } catch {
      //
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/api/alerts/mark-all-read');
      setAlerts([]);
      setUnreadCount(0);
    } catch {
      //
    }
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults(null);
      setShowSearch(false);
      return;
    }
    try {
      const res = await api.get(`/api/activity/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.data);
      setShowSearch(true);
    } catch {
      setSearchResults(null);
    }
  }, []);

  useEffect(() => {
    today();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [today, fetchUnreadCount]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const rootPath = '/' + pathname.split('/')[1];
  const pageTitle = pageTitles[rootPath] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-16 px-4 pl-14 lg:pl-4 lg:px-6 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
          <span className="text-sm text-gray-400 hidden sm:block">{dateStr}</span>
        </div>

        <div className="flex items-center gap-3">
          <div ref={searchRef} className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
              className="w-64 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {showSearch && searchResults && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {searchResults.projects.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Projects</p>
                    {searchResults.projects.map((p) => (
                      <a key={p.id} href={`/projects/${p.id}`} className="block px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">
                        {p.name}
                      </a>
                    ))}
                  </div>
                )}
                {searchResults.tasks.length > 0 && (
                  <div className="p-2 border-t border-gray-100">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Tasks</p>
                    {searchResults.tasks.map((t) => (
                      <a key={t.id} href={`/tasks/${t.id}`} className="block px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">
                        {t.title}
                      </a>
                    ))}
                  </div>
                )}
                {searchResults.users.length > 0 && (
                  <div className="p-2 border-t border-gray-100">
                    <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Users</p>
                    {searchResults.users.map((u) => (
                      <div key={u.id} className="px-2 py-1.5 text-sm text-gray-700">
                        {u.name} <span className="text-gray-400">({u.email})</span>
                      </div>
                    ))}
                  </div>
                )}
                {!searchResults.projects.length && !searchResults.tasks.length && !searchResults.users.length && (
                  <p className="p-4 text-sm text-gray-400 text-center">No results found</p>
                )}
              </div>
            )}
          </div>

          <div ref={alertRef} className="relative">
            <button
              onClick={() => { setShowAlerts(!showAlerts); if (!showAlerts) fetchAlerts(); }}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showAlerts && (
              <div className="absolute top-full mt-1 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Notifications</span>
                  {alerts.length > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
                      <CheckCheck size={14} />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400 text-center">No new notifications</p>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                        <p className="text-sm text-gray-800">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <a
                  href="/alerts"
                  className="block px-4 py-2.5 text-sm text-center text-indigo-600 hover:bg-indigo-50 rounded-b-lg font-medium"
                >
                  View all notifications
                </a>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user.name.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
