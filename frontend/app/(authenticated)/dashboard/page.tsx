'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  FolderKanban, Play, AlertTriangle, Users, CheckCircle, Clock, Calendar,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import { StatsCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/LoadingSkeleton';

const PIE_COLORS = ['#9ca3af', '#3b82f6', '#eab308', '#22c55e', '#f97316'];
const BAR_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

interface AdminData {
  overview: {
    total_projects: number;
    active_projects: number;
    overdue_projects: number;
    total_users: number;
    total_tasks: number;
    overdue_tasks: number;
    completed_projects: number;
    on_hold_projects: number;
  };
  projects_by_status: { status: string; count: number }[];
  projects_by_priority: { priority: string; count: number }[];
  upcoming_deadlines: { id: number; name: string; deadline: string; days_remaining: number; member_count: number }[];
  team_workload: { id: number; name: string; role: string; active_tasks_count: number; completed_tasks_count: number; overdue_tasks_count: number }[];
  recent_activity: { action: string; entity_type: string; created_at: string; user_name: string }[];
}

interface MemberData {
  my_stats: { my_active_tasks: number; my_overdue_tasks: number; my_completed_tasks: number; my_projects_count: number };
  tasks_due_today: { id: number; title: string; status: string; priority: string; project_name: string }[];
  upcoming_tasks: { id: number; title: string; due_date: string; status: string; project_name: string; days_remaining: number }[];
  my_projects: { id: number; name: string; status: string; deadline: string; days_remaining: number; progress_percentage: number; my_task_count: number }[];
  my_recent_activity: { action: string; entity_type: string; created_at: string }[];
}

function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminData>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/admin');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton /><ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TableSkeleton /><TableSkeleton />
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const { overview, projects_by_status, projects_by_priority, upcoming_deadlines, team_workload } = data;
  const totalCompletedTasks = team_workload.reduce((sum, m) => sum + m.completed_tasks_count, 0);

  const statusPieData = projects_by_status.filter((s) => s.count > 0);
  const priorityBarData = projects_by_priority.map((p) => ({ name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1), count: p.count }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={FolderKanban} label="Total Projects" value={overview.total_projects} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={Play} label="Active Projects" value={overview.active_projects} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={AlertTriangle} label="Overdue Projects" value={overview.overdue_projects} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatsCard icon={Users} label="Team Members" value={overview.total_users} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Status</h3>
          {statusPieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
              <p className="text-sm">No project data yet.</p>
              <p className="text-xs mt-1">Create your first project to see analytics.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusPieData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e?.payload?.status?.replace('_', ' ') || ''}: ${e?.value}`}>
                  {statusPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Priority</h3>
          {priorityBarData.every((d) => d.count === 0) ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
              <p className="text-sm">No project data yet.</p>
              <p className="text-xs mt-1">Create your first project to see analytics.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityBarData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Deadlines</h3>
          {upcoming_deadlines.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3">
              {upcoming_deadlines.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.member_count} members</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{new Date(p.deadline).toLocaleDateString()}</p>
                    <span className={`text-xs font-semibold ${p.days_remaining <= 3 ? 'text-red-600' : p.days_remaining <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {p.days_remaining > 0 ? `${p.days_remaining}d left` : 'Overdue'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Team Workload</h3>
          {team_workload.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No team data</p>
          ) : (
            <div className="space-y-4">
              {team_workload.map((m) => {
                const maxTasks = Math.max(...team_workload.map((t) => t.active_tasks_count), 1);
                const pct = (m.active_tasks_count / maxTasks) * 100;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                        <span className="text-xs font-semibold text-gray-600">{m.active_tasks_count} tasks</span>
                      </div>
                      <div className="mt-1 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={CheckCircle} label="Total Tasks Created This Month" value={overview.total_tasks} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatsCard icon={CheckCircle} label="Tasks Completed This Month" value={totalCompletedTasks} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={FolderKanban} label="Projects Completed This Month" value={overview.completed_projects} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <StatsCard icon={AlertTriangle} label="Alerts Sent This Month" value={0} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>
    </div>
  );
}

function MemberDashboard() {
  const { data, isLoading } = useQuery<MemberData>({
    queryKey: ['member-dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/member');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><TableSkeleton /><TableSkeleton /></div>
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const { my_stats, tasks_due_today, upcoming_tasks, my_projects } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={CheckCircle} label="My Active Tasks" value={my_stats.my_active_tasks} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={AlertTriangle} label="Overdue" value={my_stats.my_overdue_tasks} iconBg={my_stats.my_overdue_tasks > 0 ? 'bg-red-50' : 'bg-gray-50'} iconColor={my_stats.my_overdue_tasks > 0 ? 'text-red-600' : 'text-gray-400'} />
        <StatsCard icon={Clock} label="Completed This Month" value={my_stats.my_completed_tasks} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={FolderKanban} label="My Projects" value={my_stats.my_projects_count} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Due Today</h3>
          {tasks_due_today.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks due today</p>
          ) : (
            <div className="space-y-2">
              {tasks_due_today.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.project_name}</p>
                  </div>
                  <Badge variant="priority" value={t.priority} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Upcoming (Next 7 Days)</h3>
          {upcoming_tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No upcoming tasks</p>
          ) : (
            <div className="space-y-2">
              {upcoming_tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.project_name}</p>
                  </div>
                  <span className={`text-xs font-semibold ${t.days_remaining <= 2 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {t.days_remaining}d left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">My Projects</h3>
        {my_projects.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Not assigned to any projects</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {my_projects.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{p.name}</h4>
                  <Badge variant="status" value={p.status} />
                </div>
                <div className="mb-2">
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round(p.progress_percentage || 0)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{Math.round(p.progress_percentage || 0)}% complete</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No deadline'}</span>
                  <span>{p.days_remaining > 0 ? `${p.days_remaining}d left` : 'Overdue'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">My Progress This Month</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatsCard icon={CheckCircle} label="Tasks Completed This Month" value={my_stats.my_completed_tasks} iconBg="bg-green-50" iconColor="text-green-600" />
          <StatsCard icon={Clock} label="On-Time Completion Rate" value="—" iconBg="bg-blue-50" iconColor="text-blue-600" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  useEffect(() => { document.title = 'Dashboard — TNT Pulse'; }, []);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'manager';

  return isAdmin ? <AdminDashboard /> : <MemberDashboard />;
}
