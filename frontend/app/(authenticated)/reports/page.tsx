'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, startOfMonth, subMonths, format } from 'date-fns';
import { BarChart3, Download, Calendar, Users, FolderKanban, CheckSquare, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import StatsCard from '@/components/ui/StatsCard';
import { StatsCardSkeleton } from '@/components/ui/LoadingSkeleton';

const PIE_COLORS = ['#9ca3af', '#3b82f6', '#eab308', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = { planning: '#9ca3af', in_progress: '#3b82f6', review: '#eab308', completed: '#22c55e', on_hold: '#f97316' };

type Tab = 'project' | 'team' | 'task';

interface DateRange { from: string; to: string; label: string }

function getDateRanges(): DateRange[] {
  const now = new Date();
  return [
    { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd'), label: 'This Week' },
    { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd'), label: 'This Month' },
    { from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'), to: format(startOfMonth(now), 'yyyy-MM-dd'), label: 'Last Month' },
    { from: format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd'), label: 'Last 3 Months' },
  ];
}

function downloadCSV(filename: string, headers: string[], rows: Record<string, unknown>[]) {
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  useEffect(() => { document.title = 'Reports — TNT Pulse'; }, []);
  const { user, hasPermission } = useAuthStore();
  const isAdmin = hasPermission('reports', 'can_view');
  const [activeTab, setActiveTab] = useState<Tab>('project');
  const ranges = useMemo(() => getDateRanges(), []);
  const [dateFrom, setDateFrom] = useState(ranges[1].from);
  const [dateTo, setDateTo] = useState(ranges[1].to);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BarChart3 size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-500">Access Restricted</h2>
          <p className="text-sm text-gray-400 mt-1">Only admins and managers can view reports.</p>
        </div>
      </div>
    );
  }

  const params = `from=${dateFrom}&to=${dateTo}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} ranges={ranges} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {(['project', 'team', 'task'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'project' ? 'Project' : tab === 'team' ? 'Team' : 'Task'} Report
          </button>
        ))}
      </div>

      {activeTab === 'project' && <ProjectReport params={params} />}
      {activeTab === 'team' && <TeamReport params={params} />}
      {activeTab === 'task' && <TaskReport params={params} />}
    </div>
  );
}

function DateRangePicker({ from, to, ranges, onChange }: { from: string; to: string; ranges: DateRange[]; onChange: (f: string, t: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ranges.map((r) => (
        <button key={r.label} onClick={() => onChange(r.from, r.to)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            from === r.from && to === r.to ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          {r.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-2">
        <Calendar size={14} className="text-gray-400" />
        <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
      </div>
    </div>
  );
}

function ProjectReport({ params }: { params: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-project', params],
    queryFn: async () => { const r = await api.get(`/api/reports/projects?${params}`); return r.data.data },
  });

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}</div>;

  if (!data) return null;

  const statusData = data.status_breakdown?.map((s: { status: string; count: number }) => ({ name: s.status.replace(/_/g, ' '), value: s.count })) ?? [];
  const projectRows = data.projects?.map((p: { id: number; name: string; status: string; team_size: number; progress_percentage: number }) => ({
    Name: p.name, Status: p.status.replace(/_/g, ' '), 'Team Size': p.team_size, 'Progress (%)': `${Math.round(p.progress_percentage)}%`,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={FolderKanban} label="Total Projects" value={data.total_projects} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={CheckSquare} label="Completed" value={data.completed_projects} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={Clock} label="On Hold" value={data.on_hold_projects} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatsCard icon={Calendar} label="Avg Days" value={data.avg_completion_days ?? '—'} iconBg="bg-blue-50" iconColor="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Projects by Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                {statusData.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress per Project</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {(data.projects ?? []).slice(0, 10).map((p: { id: number; name: string; progress_percentage: number; status: string }) => (
              <div key={p.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 truncate">{p.name}</span>
                  <span className="text-gray-500 font-medium">{Math.round(p.progress_percentage)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.progress_percentage}%`, backgroundColor: STATUS_COLORS[p.status] || '#6366f1' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Projects</h3>
          <button onClick={() => downloadCSV('project-report.csv', ['Name', 'Status', 'Team Size', 'Progress (%)'], projectRows)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">{['Name', 'Status', 'Team Size', 'Progress'].map((h) => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead>
            <tbody>
              {(data.projects ?? []).map((p: { id: number; name: string; status: string; team_size: number; progress_percentage: number }) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{p.name}</td>
                  <td className="py-2.5 pr-4"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[p.status] ? 'bg-gray-100 text-gray-700' : ''}`} style={{ backgroundColor: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status] }}>{p.status.replace(/_/g, ' ')}</span></td>
                  <td className="py-2.5 pr-4 text-gray-600">{p.team_size}</td>
                  <td className="py-2.5 pr-4"><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${p.progress_percentage}%`, backgroundColor: '#6366f1' }} /></div><span className="text-xs text-gray-500">{Math.round(p.progress_percentage)}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TeamReport({ params }: { params: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-team', params],
    queryFn: async () => { const r = await api.get(`/api/reports/team?${params}`); return r.data.data },
  });

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}</div>;

  if (!data) return null;

  const totalAssigned = data.reduce((s: number, m: { tasks_assigned: number }) => s + Number(m.tasks_assigned), 0);
  const totalCompleted = data.reduce((s: number, m: { tasks_completed: number }) => s + Number(m.tasks_completed), 0);
  const totalOverdue = data.reduce((s: number, m: { overdue_tasks: number }) => s + Number(m.overdue_tasks), 0);
  const avgOnTime = data.length > 0 ? Math.round(data.reduce((s: number, m: { on_time_rate: number }) => s + Number(m.on_time_rate), 0) / data.length) : 0;

  const barData = data.map((m: { name: string; tasks_assigned: number; tasks_completed: number; overdue_tasks: number }) => ({ name: m.name.split(' ')[0], Assigned: m.tasks_assigned, Completed: m.tasks_completed, Overdue: m.overdue_tasks }));

  const memberRows = data.map((m: { name: string; role: string; tasks_assigned: number; tasks_completed: number; overdue_tasks: number; on_time_rate: number; avg_completion_days: number | null }) => ({
    Name: m.name, Role: m.role.replace(/_/g, ' '), Assigned: m.tasks_assigned, Completed: m.tasks_completed, Overdue: m.overdue_tasks, 'On-Time Rate': `${m.on_time_rate}%`, 'Avg Days': m.avg_completion_days ?? '—',
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Users} label="Team Members" value={data.length} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={CheckSquare} label="Total Assigned" value={totalAssigned} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatsCard icon={CheckSquare} label="Completed" value={totalCompleted} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={Clock} label="Avg On-Time Rate" value={`${avgOnTime}%`} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Member Workload</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Assigned" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Member Details</h3>
          <button onClick={() => downloadCSV('team-report.csv', ['Name', 'Role', 'Assigned', 'Completed', 'Overdue', 'On-Time Rate', 'Avg Days'], memberRows)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">{['Name', 'Role', 'Assigned', 'Completed', 'Overdue', 'On-Time Rate', 'Avg Days'].map((h) => <th key={h} className="pb-2 pr-4">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((m: { id: number; name: string; role: string; tasks_assigned: number; tasks_completed: number; overdue_tasks: number; on_time_rate: number; avg_completion_days: number | null }) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{m.name}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{m.role.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{m.tasks_assigned}</td>
                  <td className="py-2.5 pr-4 text-green-600 font-medium">{m.tasks_completed}</td>
                  <td className="py-2.5 pr-4"><span className={m.overdue_tasks > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>{m.overdue_tasks}</span></td>
                  <td className="py-2.5 pr-4"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${m.on_time_rate >= 80 ? 'bg-green-100 text-green-700' : m.on_time_rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{m.on_time_rate}%</span></td>
                  <td className="py-2.5 pr-4 text-gray-600">{m.avg_completion_days ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TaskReport({ params }: { params: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-task', params],
    queryFn: async () => { const r = await api.get(`/api/reports/tasks?${params}`); return r.data.data },
  });

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}</div>;

  if (!data) return null;

  const priorityData = data.priority_breakdown?.map((p: { priority: string; count: number }) => ({ name: p.priority, value: p.count })) ?? [];
  const statusData = data.status_breakdown?.map((s: { status: string; count: number }) => ({ name: s.status.replace(/_/g, ' '), value: s.count })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={CheckSquare} label="Total Tasks" value={data.total_tasks} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={CheckSquare} label="Completed On Time" value={data.completed_on_time} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={Clock} label="Completed Late" value={data.completed_late} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <StatsCard icon={Calendar} label="Still Overdue" value={data.still_overdue} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                {priorityData.map((_: unknown, i: number) => <Cell key={i} fill={['#9ca3af', '#3b82f6', '#ef4444'][i] || PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                {statusData.map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Task Summary</h3>
          <button onClick={() => downloadCSV('task-report.csv', ['Metric', 'Value'], [
            { Metric: 'Total Tasks', Value: data.total_tasks },
            { Metric: 'Completed On Time', Value: data.completed_on_time },
            { Metric: 'Completed Late', Value: data.completed_late },
            { Metric: 'Still Overdue', Value: data.still_overdue },
            { Metric: 'Avg Completion (days)', Value: data.avg_completion_days ?? '—' },
          ])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
            <Download size={14} /> CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Tasks', value: data.total_tasks, color: 'text-indigo-600' },
            { label: 'On Time', value: data.completed_on_time, color: 'text-green-600' },
            { label: 'Late', value: data.completed_late, color: 'text-orange-600' },
            { label: 'Overdue', value: data.still_overdue, color: 'text-red-600' },
            { label: 'Avg Days', value: data.avg_completion_days ?? '—', color: 'text-blue-600' },
          ].map((m) => (
            <div key={m.label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
