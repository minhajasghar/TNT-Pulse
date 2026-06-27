'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Megaphone, Pin, PinOff, Trash2, Plus, X, AlertCircle, Info } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  is_pinned: boolean;
  created_by: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

const priorityStyles: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-700',
  important: 'bg-blue-100 text-blue-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function AnnouncementsPage() {
  useEffect(() => { document.title = 'Announcements — TNT Pulse'; }, []);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canManage = user?.role === 'super_admin' || user?.role === 'manager';
  const [showCreate, setShowCreate] = useState(false);

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await api.get('/api/announcements');
      return res.data.data;
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/announcements/${id}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      toast({ message: data?.message || data?.error || 'Failed to update announcement', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ message: 'Announcement deleted', type: 'success' });
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      toast({ message: data?.message || data?.error || 'Failed to delete announcement', type: 'error' });
    },
  });

  const pinned = announcements?.filter((a) => a.is_pinned) ?? [];
  const regular = announcements?.filter((a) => !a.is_pinned) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
          >
            <Plus size={18} /> New Announcement
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Megaphone size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-1">No announcements yet</h3>
          <p className="text-sm text-gray-400">Check back later for updates from your team.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pinned.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              canManage={canManage}
              onPin={() => pinMutation.mutate(a.id)}
              onDelete={() => deleteMutation.mutate(a.id)}
              isPinned
            />
          ))}
          {regular.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              canManage={canManage}
              onPin={() => pinMutation.mutate(a.id)}
              onDelete={() => deleteMutation.mutate(a.id)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateAnnouncementModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  canManage,
  onPin,
  onDelete,
  isPinned,
}: {
  announcement: Announcement;
  canManage: boolean;
  onPin: () => void;
  onDelete: () => void;
  isPinned?: boolean;
}) {
  return (
    <div
      className={`rounded-xl shadow-sm border p-5 transition-colors ${
        isPinned ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {isPinned && <Pin size={14} className="text-amber-600 shrink-0" />}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                priorityStyles[announcement.priority] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {announcement.priority === 'urgent' && <AlertCircle size={10} className="animate-pulse" />}
              {announcement.priority === 'important' && <Info size={10} />}
              {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
            </span>
            {isPinned && (
              <span className="text-xs font-medium text-amber-700">Pinned</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">{announcement.title}</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{announcement.content}</p>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
              {(announcement.creator_name || '?').charAt(0).toUpperCase()}
            </div>
            <span>{announcement.creator_name || 'Unknown'}</span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onPin}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAnnouncementModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [apiError, setApiError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      setApiError('');
      const res = await api.post('/api/announcements', { title, content, priority });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ message: data.message || 'Announcement posted and team notified!', type: 'success' });
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      const msg = data?.message || data?.error || 'Failed to create announcement';
      setApiError(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'normal' | 'important' | 'urgent')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {apiError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={!title.trim() || !content.trim() || mutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
            >
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {mutation.isPending ? 'Posting...' : 'Post Announcement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
