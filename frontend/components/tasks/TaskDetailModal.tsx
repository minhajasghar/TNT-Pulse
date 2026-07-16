'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { X, Send, User } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Badge from '@/components/ui/Badge';

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  estimated_hours: number;
  assigned_user_name: string;
  assigned_to: number;
  project_name: string;
  project_id: number;
  created_by: number;
  blocked_reason: string;
}

interface Comment {
  id: number;
  content: string;
  user_name: string;
  created_at: string;
}

interface Props {
  task: Task;
  onClose: () => void;
}

export default function TaskDetailModal({ task, onClose }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'super_admin' || user?.role === 'manager' || user?.id === task.assigned_to;
  const [newComment, setNewComment] = useState('');

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ['task-comments', task.id],
    queryFn: async () => {
      const res = await api.get(`/api/tasks/${task.id}/comments`);
      return res.data.data;
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await api.put(`/api/tasks/${task.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['member-dashboard'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await api.post(`/api/tasks/${task.id}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] });
      setNewComment('');
    },
  });

  const statusOptions = ['todo', 'in_progress', 'blocked', 'done'];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl translate-x-0 transition-transform overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex-1 min-w-0">
            {canEdit ? (
              <input
                defaultValue={task.title}
                onBlur={(e) => {
                  if (e.target.value !== task.title) updateTaskMutation.mutate({ title: e.target.value });
                }}
                className="text-lg font-semibold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0 w-full"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg ml-4 shrink-0">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                defaultValue={task.status}
                onChange={(e) => {
                  const data: Record<string, unknown> = { status: e.target.value };
                  if (e.target.value === 'blocked' && !task.blocked_reason) {
                    const reason = prompt('Blocked reason is required:');
                    if (!reason) return;
                    data.blocked_reason = reason;
                  }
                  if (e.target.value === 'done') {
                  }
                  updateTaskMutation.mutate(data);
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <Badge variant="priority" value={task.priority} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {task.assigned_user_name?.charAt(0) || <User size={12} />}
                </div>
                <span className="text-sm text-gray-900">{task.assigned_user_name || 'Unassigned'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Hours</label>
              <p className="text-sm text-gray-900">{task.estimated_hours ? `${task.estimated_hours}h` : '—'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
              <p className="text-sm text-indigo-600 font-medium">{task.project_name}</p>
            </div>
          </div>

          {task.status === 'blocked' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <label className="block text-xs font-medium text-red-700 mb-1">Blocked Reason</label>
              {canEdit ? (
                <input
                  defaultValue={task.blocked_reason}
                  onBlur={(e) => {
                    if (e.target.value !== task.blocked_reason) updateTaskMutation.mutate({ blocked_reason: e.target.value });
                  }}
                  className="w-full px-2 py-1.5 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 bg-white"
                  placeholder="Why is this blocked?"
                />
              ) : (
                <p className="text-sm text-red-700">{task.blocked_reason}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            {canEdit ? (
              <textarea
                defaultValue={task.description}
                onBlur={(e) => {
                  if (e.target.value !== task.description) updateTaskMutation.mutate({ description: e.target.value });
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description || 'No description'}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Comments ({(comments || []).length})</h3>
            </div>
            <div className="space-y-3 mb-4">
              {comments?.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
              )}
              {comments?.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                    {c.user_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
                      <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 flex items-end gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={() => {
                    if (newComment.trim()) addCommentMutation.mutate(newComment.trim());
                  }}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
