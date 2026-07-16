'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Circle, AlertTriangle, Info } from 'lucide-react';
import api from '@/lib/api';
import Badge from '@/components/ui/Badge';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';

const tabs = ['All', 'Todo', 'In Progress', 'Blocked', 'Done', 'Overdue'] as const;
type Tab = (typeof tabs)[number];

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  project_name: string;
  project_id: number;
  assigned_user_name: string;
  overdue: boolean;
  days_remaining: number;
}

export default function TasksPage() {
  useEffect(() => { document.title = 'My Tasks — TNT Pulse'; }, []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const res = await api.get('/api/tasks/my');
      return res.data.data;
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.put(`/api/tasks/${taskId}`, { status: 'done' });
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['my-tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['my-tasks']);
      queryClient.setQueryData<Task[]>(['my-tasks'], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: 'done' } : t)),
      );
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      queryClient.setQueryData(['my-tasks'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['member-dashboard'] });
    },
  });

  const filtered = tasks?.filter((t) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Overdue') return t.overdue;
    return t.status === activeTab.toLowerCase().replace(' ', '_');
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>

      <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-3 border border-blue-100">
        <Info size={20} className="shrink-0 mt-0.5 text-blue-600" />
        <p className="text-sm">
          <strong>Note:</strong> You can only create new tasks by navigating to a specific Project board first. This page shows tasks that are assigned to you across all projects.
        </p>
      </div>

      <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-100 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 bg-gray-200 rounded-full" />
                <div className="flex-1 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-4 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No tasks found</h3>
          <p className="text-sm text-gray-500">
            {activeTab === 'All' ? 'You have no tasks assigned yet.' : `No tasks with status "${activeTab}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isOverdue = task.overdue;
            const isDueToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markDoneMutation.mutate(task.id);
                    }}
                    className="shrink-0"
                  >
                    {task.status === 'done' ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : (
                      <Circle size={20} className="text-gray-300 hover:text-gray-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/projects/${task.project_id}`);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0"
                  >
                    {task.project_name}
                  </button>
                  <Badge variant="priority" value={task.priority} />
                  <Badge variant="status" value={task.status} />
                  <span
                    className={`text-xs shrink-0 ${
                      isOverdue ? 'text-red-600 font-semibold' : isDueToday ? 'text-yellow-600 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTask && <TaskDetailModal task={selectedTask as any} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}
