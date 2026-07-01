'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, Plus, Search, Users, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Badge from '@/components/ui/Badge';
import RoleSelector from '@/components/ui/RoleSelector';

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  client_name: z.string().min(1, 'Client name is required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  deadline: z.string().min(1, 'Deadline is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
}).refine((data) => {
  if (data.start_date && data.deadline && data.deadline <= data.start_date) return false;
  return true;
}, { message: 'Deadline must be after start date', path: ['deadline'] });

type FormData = z.infer<typeof schema>;

interface SelectedMember {
  user_id: number;
  name: string;
  project_role: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Props {
  onClose: () => void;
}



const avatarColors = [
  'bg-indigo-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-pink-600', 'bg-teal-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CreateProjectModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, string>>({});

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const activeUsers: User[] = (users || []).filter((u: User) => u.status === 'active');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData & { members: { user_id: number; project_role: string }[] }) => {
      setError(null);
      console.log('Submitting project:', data);
      const res = await api.post('/api/projects', data);
      console.log('Response:', res.data);
      return res.data;
    },
    onSuccess: async (data) => {
      const projectId = data.data?.id;
      if (projectId && selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', file.name);
          formData.append('project_id', String(projectId));
          try {
            await api.post('/api/documents/upload', formData);
          } catch (err: any) {
            console.error('Document upload error:', err?.response?.data || err);
            toast({ message: err?.response?.data?.message || `Failed to upload ${file.name}`, type: 'error' });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast({ message: 'Project created successfully', type: 'success' });
      onClose();
    },
    onError: (err: any) => {
      console.error('Submit error:', err);
      const message = err?.response?.data?.message || err?.message || 'Failed to create project';
      console.error('Error message:', message);
      setError(message);
    },
  });

  const addMember = (user: User, role: string = 'Backend Developer') => {
    setSelectedMembers((prev) => {
      if (prev.some((m) => m.user_id === user.id)) return prev;
      return [...prev, { user_id: user.id, name: user.name, project_role: role }];
    });
  };

  const removeMember = (userId: number) => {
    setSelectedMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const updateRole = (userId: number, role: string) => {
    setSelectedMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, project_role: role } : m)));
  };

  const filteredUsers = activeUsers.filter(u =>
    !selectedMembers.some(m => m.user_id === u.id) &&
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      members: selectedMembers.map(m => ({ user_id: m.user_id, project_role: m.project_role })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input {...register('name')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input {...register('client_name')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" {...register('start_date')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input type="date" {...register('deadline')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select {...register('priority')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Team Members Section */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Team Members (Optional)</h3>

            {/* Search input */}
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Search results */}
            {searchQuery.length === 0 ? (
              <div className="text-center py-6">
                <Users size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Search to add members</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No members found</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <Badge variant="role" value={user.role} />
                    </div>
                    <div className="flex gap-2 w-64 items-start">
                      <div className="flex-1">
                        <RoleSelector
                          value={draftRoles[user.id] || 'Backend Developer'}
                          onChange={(val) => setDraftRoles((prev) => ({ ...prev, [user.id]: val }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const val = draftRoles[user.id] || 'Backend Developer';
                          if (val) {
                            addMember(user, val);
                            setDraftRoles((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
                          }
                        }}
                        className="flex items-center justify-center gap-1 h-9 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500">Selected ({selectedMembers.length})</p>
                {selectedMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {getInitials(member.name)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">{member.name}</span>
                    <div className="w-48">
                      <RoleSelector
                        value={member.project_role}
                        onChange={(val) => updateRole(member.user_id, val)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(member.user_id)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Documents (Optional)</h3>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors">
              <Upload size={18} className="text-gray-400" />
              <span className="text-sm text-gray-500">Click to select files</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedFiles((prev) => [...prev, ...files]);
                }}
              />
            </label>
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm">
                    <span className="text-gray-700 truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-red-500 hover:bg-red-100 rounded ml-2"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {mutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
