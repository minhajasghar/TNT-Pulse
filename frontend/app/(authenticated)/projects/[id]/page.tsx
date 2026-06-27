'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CheckCircle, XCircle, Clock, Users, Target, ListTodo, Search, AlertTriangle, Trash2, X, Building, Calendar, User as UserIcon, Edit3, Pencil, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Badge from '@/components/ui/Badge';
import StatsCard from '@/components/ui/StatsCard';
import { ProjectDetailSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';

interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: string;
  project_role: string | null;
  status: string;
  assigned_at: string;
  task_count: number;
  completed_tasks: number;
  overdue_tasks: number;
  initials: string;
  completion_rate: number;
}

interface ProjectDetail {
  id: number;
  name: string;
  description: string;
  client_name: string;
  status: string;
  priority: string;
  deadline: string;
  start_date: string;
  created_by_name: string;
  member_count: number;
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
  members: ProjectMember[];
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface UserWorkload {
  active_projects: number;
  active_tasks: number;
}

type Tab = 'tasks' | 'team' | 'milestones' | 'requirements';

function getWorkloadLevel(activeTasks: number) {
  if (activeTasks === 0) return { label: 'Empty', color: 'bg-gray-200' };
  if (activeTasks <= 2) return { label: 'Light', color: 'bg-green-400' };
  if (activeTasks <= 4) return { label: 'Moderate', color: 'bg-yellow-400' };
  if (activeTasks <= 6) return { label: 'Heavy', color: 'bg-orange-500' };
  return { label: 'Overloaded', color: 'bg-red-600' };
}

function TaskDonutChart({ members }: { members: ProjectMember[] }) {
  const membersWithTasks = members.filter(m => m.task_count > 0);
  if (membersWithTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <div className="w-24 h-24 rounded-full border-4 border-gray-100 mb-2"></div>
        <span className="text-sm">No tasks assigned</span>
      </div>
    );
  }

  const totalTasks = membersWithTasks.reduce((sum, m) => sum + m.task_count, 0);
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  let currentAngle = 0;
  const cx = 50;
  const cy = 50;
  const r = 40;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="w-32 h-32 transform -rotate-90">
        {membersWithTasks.map((m, i) => {
          const sliceAngle = (m.task_count / totalTasks) * 360;
          const x1 = cx + r * Math.cos((currentAngle * Math.PI) / 180);
          const y1 = cy + r * Math.sin((currentAngle * Math.PI) / 180);
          const x2 = cx + r * Math.cos(((currentAngle + sliceAngle) * Math.PI) / 180);
          const y2 = cy + r * Math.sin(((currentAngle + sliceAngle) * Math.PI) / 180);

          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          const pathData = sliceAngle === 360
            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

          currentAngle += sliceAngle;

          return (
            <path
              key={m.id}
              d={pathData}
              fill={colors[i % colors.length]}
              className="stroke-white stroke-[2px]"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="25" fill="white" />
      </svg>

      <div className="mt-4 w-full flex flex-wrap justify-center gap-2">
        {membersWithTasks.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></span>
            <span className="text-gray-600 truncate max-w-[80px]">{m.name.split(' ')[0]}</span>
            <span className="font-semibold text-gray-900">({m.task_count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const modalAvatarColors = [
  'bg-indigo-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-pink-600', 'bg-teal-600',
];

function getModalAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return modalAvatarColors[Math.abs(hash) % modalAvatarColors.length];
}

// ─── Edit Project Modal ──────────────────────────────────────────

function EditProjectModal({
  project,
  onClose,
}: {
  project: ProjectDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useParams();
  const [editTab, setEditTab] = useState<'details' | 'members'>('details');

  // ── Tab 1: Details form ──
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.client_name || '');
  const [description, setDescription] = useState(project.description || '');
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [deadline, setDeadline] = useState(project.deadline || '');
  const [priority, setPriority] = useState(project.priority);
  const [status, setStatus] = useState(project.status);

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.put(`/api/projects/${params.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      toast({ message: 'Project updated successfully', type: 'success' });
    },
    onError: () => {
      toast({ message: 'Failed to update project', type: 'error' });
    },
  });

  const handleSaveDetails = () => {
    updateProjectMutation.mutate({
      name,
      client_name: clientName,
      description,
      start_date: startDate || null,
      deadline: deadline || null,
      priority,
      status,
    });
  };

  // ── Tab 2: Members ──
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.post(`/api/projects/${params.id}/members`, { user_id: userId });
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      const user = allUsers?.find((u) => u.id === userId);
      toast({ message: `${user?.name || 'User'} added to project`, type: 'success' });
      setMemberSearch('');
      setMemberSearchResults([]);
    },
    onError: () => {
      toast({ message: 'Failed to add member', type: 'error' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/projects/${params.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      toast({ message: 'Member removed from project', type: 'success' });
    },
    onError: () => {
      toast({ message: 'Failed to remove member', type: 'error' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, project_role }: { userId: number; project_role: string }) => {
      await api.patch(`/api/projects/${params.id}/members/${userId}/role`, { project_role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      toast({ message: 'Member role updated', type: 'success' });
    },
    onError: () => {
      toast({ message: 'Failed to update role', type: 'error' });
    },
  });

  const handleMemberSearch = (q: string) => {
    setMemberSearch(q);
    if (q.length < 1 || !allUsers) {
      setMemberSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const filtered = allUsers.filter(
      (u) =>
        !project.members.some((m) => m.id === u.id) &&
        u.name.toLowerCase().includes(q.toLowerCase()),
    );
    setMemberSearchResults(filtered);
    setIsSearching(false);
  };

  const existingMemberIds = project.members.map((m) => m.id);

  const [removeConfirm, setRemoveConfirm] = useState<ProjectMember | null>(null);

  const projectRoleOptions = [
    { value: '', label: 'No role' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'developer', label: 'Developer' },
    { value: 'designer', label: 'Designer' },
    { value: 'tester', label: 'Tester' },
    { value: 'viewer', label: 'Viewer' },
  ];

  const blockedTasks = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit Project</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5">
          <button
            onClick={() => setEditTab('details')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors mr-6 ${
              editTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Project Details
          </button>
          <button
            onClick={() => setEditTab('members')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              editTab === 'members' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Manage Members
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5 overflow-y-auto flex-1">
          {editTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={startDate || undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveDetails}
                  disabled={!name || !clientName || updateProjectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 text-sm font-semibold rounded-lg transition-colors"
                >
                  {updateProjectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {editTab === 'members' && (
            <div className="space-y-6">
              {/* Current Members */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Current Members ({project.members.length})
                </h3>
                {project.members.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No members in this project</p>
                ) : (
                  <div className="space-y-2">
                    {project.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <div className={`w-9 h-9 rounded-full ${getModalAvatarColor(m.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {m.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="role" value={m.role} />
                            <span className="text-xs text-gray-400">{m.email}</span>
                          </div>
                        </div>
                        <select
                          value={m.project_role || ''}
                          onChange={(e) => updateRoleMutation.mutate({ userId: m.id, project_role: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          {projectRoleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setRemoveConfirm(m)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Remove confirmation */}
              {removeConfirm && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" />
                    <span className="text-sm text-orange-800">
                      Remove <strong>{removeConfirm.name}</strong> from project?
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRemoveConfirm(null)}
                      className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        removeMemberMutation.mutate(removeConfirm.id);
                        setRemoveConfirm(null);
                      }}
                      className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Add New Member */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Member</h3>
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search team members by name..."
                    value={memberSearch}
                    onChange={(e) => handleMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {memberSearch.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Search for team members to add</p>
                    <p className="text-gray-300 text-xs mt-1">Type a name to see results</p>
                  </div>
                ) : isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : memberSearchResults.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-400 text-sm">No members found matching your search</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberSearchResults.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className={`w-9 h-9 rounded-full ${getModalAvatarColor(u.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <Badge variant="role" value={u.role} />
                        </div>
                        {existingMemberIds.includes(u.id) ? (
                          <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md">Already added</span>
                        ) : (
                          <button
                            onClick={() => addMemberMutation.mutate(u.id)}
                            disabled={addMemberMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 rounded-md text-xs font-medium transition-colors shrink-0"
                          >
                            {addMemberMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                            Add
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Member Modal (standalone from project card) ─────────────

function AddMemberModal({ projectId, existingMemberIds, onClose }: { projectId: number; existingMemberIds: number[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const { data: userWorkload } = useQuery<UserWorkload>({
    queryKey: ['user-workload', selectedUserId],
    queryFn: async () => {
      const res = await api.get(`/api/users/${selectedUserId}`);
      return res.data.data;
    },
    enabled: !!selectedUserId,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.post(`/api/projects/${projectId}/members`, { user_id: userId });
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      const user = allUsers?.find((u) => u.id === userId);
      toast({ message: `${user?.name || 'User'} added to project`, type: 'success' });
      setSelectedUserId(null);
      setSearch('');
    },
    onError: () => {
      toast({ message: 'Failed to add member', type: 'error' });
    },
  });

  const availableUsers = allUsers?.filter(
    (u) => !existingMemberIds.includes(u.id) && u.name.toLowerCase().includes(search.toLowerCase()),
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Member to Project</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search team members by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedUserId(null); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : search.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Search for team members to add</p>
              <p className="text-gray-300 text-xs mt-1">Type a name to see results</p>
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">No members found matching your search</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableUsers.map((u) => (
                <div key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${selectedUserId === u.id ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-9 h-9 rounded-full ${getModalAvatarColor(u.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <Badge variant="role" value={u.role} />
                  </div>
                  {selectedUserId === u.id && userWorkload ? (
                    <div className="text-xs text-gray-500 text-right shrink-0">
                      <p>{userWorkload.active_tasks} active tasks</p>
                      <p>{userWorkload.active_projects} projects</p>
                    </div>
                  ) : selectedUserId !== u.id && (
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-xs font-medium transition-colors shrink-0"
                    >
                      <Plus size={14} /> Add
                    </button>
                  )}
                  {selectedUserId === u.id && (
                    <button
                      onClick={() => addMemberMutation.mutate(u.id)}
                      disabled={addMemberMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300 rounded-md text-xs font-medium transition-colors shrink-0"
                    >
                      {addMemberMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const canManage = user?.role === 'super_admin' || user?.role === 'manager';
  const isAdmin = user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: project, isLoading, isError, refetch } = useQuery<ProjectDetail>({
    queryKey: ['project', params.id],
    queryFn: async () => {
      const res = await api.get(`/api/projects/${params.id}`);
      return res.data.data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['project-tasks', params.id],
    queryFn: async () => {
      const res = await api.get(`/api/tasks/project/${params.id}`);
      return res.data.data;
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/projects/${params.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.id] });
      toast({ message: 'Member removed from project', type: 'success' });
      setMemberToRemove(null);
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      await api.put(`/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', params.id] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/projects/${params.id}`);
    },
    onSuccess: () => {
      toast({ message: 'Project moved to recycle bin', type: 'success' });
      router.push('/projects');
    },
    onError: () => {
      toast({ message: 'Failed to delete project', type: 'error' });
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  if (isLoading) return <ProjectDetailSkeleton />;

  if (isError || !project) {
    return (
      <div className="text-center py-16">
        <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Could not load project details</h3>
        <p className="text-sm text-gray-500 mb-4">The project may have been deleted or you don&apos;t have access.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => router.push('/projects')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Back to Projects
          </button>
          <button onClick={() => refetch()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const daysRemaining = project.deadline ? Math.floor((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const progressPercent = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
  const activeTaskCount = project.total_tasks - project.completed_tasks;

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'tasks', label: 'Tasks', icon: <ListTodo size={16} /> },
    { key: 'team', label: 'Team', icon: <Users size={16} /> },
    { key: 'milestones', label: 'Milestones', icon: <Target size={16} /> },
    { key: 'requirements', label: 'Requirements', icon: <CheckCircle size={16} /> },
  ];

  const mostActiveMember = project.members.reduce((prev, current) => (prev.completed_tasks > current.completed_tasks) ? prev : current, project.members[0]);
  const mostOverdueMember = project.members.reduce((prev, current) => (prev.overdue_tasks > current.overdue_tasks) ? prev : current, project.members[0]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => router.push('/projects')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* ─── Project Header Card ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {/* Row 1: Name + Badges + Actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <Badge variant="status" value={project.status} />
            <Badge variant="priority" value={project.priority} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canManage && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Pencil size={16} /> Edit
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">{project.client_name || 'No client'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <span>{project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={16} className={`shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
            <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
              {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set'}
              {isOverdue && ' (Overdue)'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <UserIcon size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">{project.created_by_name || 'Unknown'}</span>
          </div>
        </div>

        {/* Row 3: Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-900">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {project.completed_tasks} of {project.total_tasks} tasks completed
          </p>
        </div>

        {/* Row 4: Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard icon={ListTodo} label="Total Tasks" value={project.total_tasks} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatsCard icon={CheckCircle} label="Completed" value={project.completed_tasks} iconBg="bg-green-50" iconColor="text-green-600" />
          <StatsCard icon={Clock} label="In Progress" value={activeTaskCount} iconBg="bg-yellow-50" iconColor="text-yellow-600" />
          <StatsCard icon={XCircle} label="Blocked" value={0} iconBg="bg-red-50" iconColor="text-red-600" />
        </div>

        {/* Row 5: Description */}
        <div>
          {project.description ? (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {project.description}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No description provided</p>
          )}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tasks Tab ─── */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['todo', 'in_progress', 'blocked', 'done'].map((status) => {
            const statusTasks = tasks?.[status] || [];
            return (
              <div key={status} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 capitalize">{status.replace('_', ' ')}</h3>
                  <span className="text-xs text-gray-400">{statusTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {statusTasks.map((t: { id: number; title: string; assigned_user_name: string; due_date: string; priority: string }) => (
                    <div key={t.id} className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                        <Badge variant="priority" value={t.priority} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{t.assigned_user_name || 'Unassigned'}</span>
                        {t.due_date && <span>{new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                  {statusTasks.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No tasks</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Team Tab ─── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {canManage && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus size={18} />
                Add Member
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-500 font-medium">Total Members</h3>
                    <p className="text-2xl font-bold text-gray-900">{project.members.length}</p>
                  </div>
                </div>
                {mostActiveMember && mostActiveMember.completed_tasks > 0 && (
                  <div className="border-l border-gray-200 pl-6">
                    <h3 className="text-sm text-gray-500 font-medium mb-1">Most Active</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">{mostActiveMember.initials}</div>
                      <p className="text-sm font-semibold text-gray-900">{mostActiveMember.name} <span className="text-green-600 ml-1">({mostActiveMember.completed_tasks} done)</span></p>
                    </div>
                  </div>
                )}
                {mostOverdueMember && mostOverdueMember.overdue_tasks > 0 && (
                  <div className="border-l border-gray-200 pl-6">
                    <h3 className="text-sm text-gray-500 font-medium mb-1">Attention Needed</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold">{mostOverdueMember.initials}</div>
                      <p className="text-sm font-semibold text-red-600 flex items-center gap-1"><AlertTriangle size={14} /> {mostOverdueMember.name} ({mostOverdueMember.overdue_tasks} overdue)</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.members.map((m) => {
                  const activeCount = m.task_count - m.completed_tasks;
                  const workload = getWorkloadLevel(activeCount);

                  return (
                    <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative group">
                      {canManage && (
                        <button
                          onClick={() => setMemberToRemove(m)}
                          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0">{m.initials}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">{m.name}</h4>
                          <Badge variant="role" value={m.role} />
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-100" />
                              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="100" strokeDashoffset={100 - m.completion_rate} className="text-green-500" />
                            </svg>
                            <span className="absolute text-[10px] font-bold text-gray-700">{m.completion_rate}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4 border-t border-b border-gray-50 py-3">
                        <div className="text-center flex-1">
                          <p className="text-xl font-bold text-blue-600">{activeCount}</p>
                          <p className="text-xs text-gray-500">Active</p>
                        </div>
                        <div className="border-l border-gray-100 h-8"></div>
                        <div className="text-center flex-1">
                          <p className="text-xl font-bold text-green-600">{m.completed_tasks}</p>
                          <p className="text-xs text-gray-500">Completed</p>
                        </div>
                        {m.overdue_tasks > 0 && (
                          <>
                            <div className="border-l border-gray-100 h-8"></div>
                            <div className="text-center flex-1">
                              <p className="text-xl font-bold text-red-600">{m.overdue_tasks}</p>
                              <p className="text-xs text-gray-500">Overdue</p>
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500 font-medium">Workload</span>
                          <span className="font-medium" style={{ color: workload.color.replace('bg-', 'text-') }}>{workload.label}</span>
                        </div>
                        <div className="flex gap-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`flex-1 ${i < Math.min(5, Math.max(1, activeCount / 1.5)) ? workload.color : 'bg-transparent'}`}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Task Distribution</h3>
                <TaskDonutChart members={project.members} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Milestones Tab ─── */}
      {activeTab === 'milestones' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Milestones</h3>
            {canManage && (
              <button className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
                <Plus size={16} /> Add
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400 text-center py-8">No milestones yet.</p>
        </div>
      )}

      {/* ─── Requirements Tab ─── */}
      {activeTab === 'requirements' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Requirements</h3>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg">
              <Plus size={16} /> Add
            </button>
          </div>
          <p className="text-sm text-gray-400 text-center py-8">No requirements yet.</p>
        </div>
      )}

      {/* ─── Remove Member Confirm ─── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-center">
            <AlertTriangle size={48} className="mx-auto text-orange-500 mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remove {memberToRemove.name}?</h2>

            {memberToRemove.task_count - memberToRemove.completed_tasks > 0 ? (
              <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-6 text-sm text-left">
                <p className="font-semibold mb-1">Warning: Incomplete Tasks</p>
                <p>This member has {memberToRemove.task_count - memberToRemove.completed_tasks} incomplete tasks. Reassign them before removing or they will become unassigned.</p>
              </div>
            ) : (
              <p className="text-gray-600 mb-6">Are you sure you want to remove this member from the project?</p>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMemberMutation.mutate(memberToRemove.id)}
                disabled={removeMemberMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:bg-red-300"
              >
                {memberToRemove.task_count - memberToRemove.completed_tasks > 0 ? 'Remove Anyway' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Member Modal ─── */}
      {showAddMemberModal && (
        <AddMemberModal
          projectId={Number(params.id)}
          existingMemberIds={project.members.map((m) => m.id)}
          onClose={() => setShowAddMemberModal(false)}
        />
      )}

      {/* ─── Edit Project Modal ─── */}
      {showEditModal && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* ─── Delete Project Confirm ─── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Project?</h2>
            <p className="text-gray-600 mb-4">This will move <span className="font-semibold">{project.name}</span> to the recycle bin.</p>
            <p className="text-sm text-gray-500 mb-4">Type the project name to confirm:</p>
            <input
              type="text"
              placeholder={project.name}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => deleteProjectMutation.mutate()}
                disabled={deleteConfirmText !== project.name || deleteProjectMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 rounded-lg text-sm font-medium"
              >
                {deleteProjectMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
