'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Megaphone,
  FolderOpen,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: '' },
  { label: 'Announcements', href: '/announcements', icon: Megaphone, module: '' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, module: 'projects' },
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare, module: 'tasks' },
  { label: 'Team', href: '/team', icon: Users, module: 'team' },
  { label: 'Documents', href: '/documents', icon: FolderOpen, module: 'documents' },
  { label: 'Reports', href: '/reports', icon: BarChart3, module: 'reports' },
  { label: 'Activity', href: '/activity', icon: Activity, module: 'activity' },
  { label: 'Settings', href: '/settings', icon: Settings, module: 'settings' },
];

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  developer: 'bg-green-100 text-green-700',
  designer: 'bg-purple-100 text-purple-700',
  viewer: 'bg-gray-100 text-gray-700',
};

function NavLinks({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-alert-count'],
    queryFn: async () => {
      const res = await api.get('/api/alerts/unread-count');
      return res.data.data.count as number;
    },
    refetchInterval: 30000,
  });

  if (!user) {
    return (
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </nav>
    );
  }

  const userRole = user.role;
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleNav = navigation.filter((item) => {
    if (userRole === 'super_admin') return true;
    if (item.module === '') return true;
    if (item.module === 'settings' || item.module === 'reports') {
      return userRole === 'super_admin' || userRole === 'manager';
    }
    return hasPermission(item.module, 'can_view');
  });

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        const isAnnouncements = item.href === '/announcements';
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && (
              <span className="flex-1">{item.label}</span>
            )}
            {!collapsed && isAnnouncements && (unreadData ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-red-500 rounded-full">
                {unreadData}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  const handleLogout = () => {
    localStorage.removeItem('tnt_token');
    localStorage.removeItem('tnt_user');
    localStorage.removeItem('tnt_permissions');
    logout();
    window.location.href = '/login';
  };

  return (
    <div className={`border-t border-gray-200 p-4 shrink-0 ${collapsed ? 'text-center' : ''}`}>
      {collapsed ? (
        <div className="w-8 h-8 mx-auto rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {user.name.charAt(0).toUpperCase()}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-700'}`}>
                {user.role.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { sidebarCollapsed: collapsed, sidebarMobileOpen: mobileOpen, toggleSidebar, setSidebarMobileOpen } = useAuthStore();
  const [hasLogo, setHasLogo] = useState(false);

  useEffect(() => {
    fetch('/logo.jpeg', { method: 'HEAD' })
      .then((res) => setHasLogo(res.ok))
      .catch(() => setHasLogo(false));
  }, []);

  const logoEl = (size: number, textSize: string) =>
    hasLogo ? (
      <Image src="/logo.jpeg" alt="TNT Pulse" width={size} height={size} className="rounded-lg shrink-0" />
    ) : (
      <div
        className={`rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0`}
        style={{ width: size, height: size, fontSize: textSize }}
      >
        TNT
      </div>
    );

  return (
    <>
      <button
        onClick={() => setSidebarMobileOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-white shadow-md"
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0 h-screen ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 shrink-0">
          {collapsed ? (
            <div className="flex items-center justify-between w-full">
              {logoEl(32, '10px')}
              <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <Link href="/dashboard" className="flex items-center gap-3">
                {logoEl(48, '14px')}
                <div>
                  <span className="text-xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                      TNT Pulse
                    </span>
                  </span>
                  <p className="text-[10px] text-gray-400 leading-tight">by TNT Innovations</p>
                </div>
              </Link>
              <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronLeft size={18} />
              </button>
            </>
          )}
        </div>
        <NavLinks collapsed={collapsed} />
        <UserSection collapsed={collapsed} />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300 w-64 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3">
            {logoEl(48, '14px')}
            <div>
              <span className="text-xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                  TNT Pulse
                </span>
              </span>
              <p className="text-[10px] text-gray-400 leading-tight">by TNT Innovations</p>
            </div>
          </Link>
          <button onClick={() => setSidebarMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} />
        <UserSection collapsed={false} />
      </aside>
    </>
  );
}
