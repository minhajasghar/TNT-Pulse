'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckSquare, Bell, Clock, CheckCheck } from 'lucide-react';
import api from '@/lib/api';

const tabs = ['All', 'Unread', 'Deadline Warnings', 'Task Alerts'] as const;
type Tab = (typeof tabs)[number];

interface Alert {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  related_entity_type: string;
  related_entity_id: number;
  created_at: string;
}

const alertIcons: Record<string, React.ReactNode> = {
  deadline_warning: <AlertTriangle size={18} className="text-yellow-600" />,
  project_overdue: <AlertTriangle size={18} className="text-red-600" />,
  task_overdue: <Clock size={18} className="text-red-600" />,
  task_assigned: <CheckSquare size={18} className="text-blue-600" />,
  task_due_tomorrow: <Clock size={18} className="text-yellow-600" />,
  new_comment: <Bell size={18} className="text-indigo-600" />,
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('All');

  const { data: alertsData, isLoading } = useQuery<{ alerts: Alert[]; unread_count: number }>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get('/api/alerts');
      return res.data.data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await api.put('/api/alerts/mark-read', { alert_ids: ids });
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<{ alerts: Alert[]; unread_count: number }>(['alerts']);
      queryClient.setQueryData<{ alerts: Alert[]; unread_count: number }>(['alerts'], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((a) => (ids.includes(a.id) ? { ...a, is_read: true } : a)),
          unread_count: Math.max(0, old.unread_count - ids.length),
        };
      });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      queryClient.setQueryData(['alerts'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.put('/api/alerts/mark-all-read');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['alerts'] });
      const previous = queryClient.getQueryData<{ alerts: Alert[]; unread_count: number }>(['alerts']);
      queryClient.setQueryData<{ alerts: Alert[]; unread_count: number }>(['alerts'], (old) => {
        if (!old) return old;
        return {
          ...old,
          alerts: old.alerts.map((a) => ({ ...a, is_read: true })),
          unread_count: 0,
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['alerts'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const alerts = alertsData?.alerts || [];
  const unreadCount = alertsData?.unread_count || 0;

  const filtered = alerts.filter((a) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Unread') return !a.is_read;
    if (activeTab === 'Deadline Warnings') return a.type.includes('deadline') || a.type.includes('overdue');
    if (activeTab === 'Task Alerts') return a.type.includes('task') || a.type === 'new_comment';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <CheckCheck size={18} />
            Mark All Read
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-100 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">You are all caught up!</h3>
          <p className="text-sm text-gray-500">No notifications to show.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              onClick={() => {
                if (!alert.is_read) markReadMutation.mutate([alert.id]);
              }}
              className={`rounded-xl shadow-sm border p-4 cursor-pointer transition-colors ${
                !alert.is_read
                  ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {!alert.is_read && <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />}
                <div className="shrink-0 mt-0.5">{alertIcons[alert.type] || <Bell size={18} className="text-gray-400" />}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!alert.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {alert.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
