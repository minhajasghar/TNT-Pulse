'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Shield, UserX, UserCheck, Users, X, ListTodo, Trash2, Eye, Ban, Calendar, FolderKanban, CheckCircle, Mail, Clock, Briefcase, Activity } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Badge from '@/components/ui/Badge';
import StatsCard from '@/components/ui/StatsCard';
import { useToast } from '@/components/ui/Toast';

const STYLES = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return STYLES[Math.abs(hash) % STYLES.length];
}

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  last_seen: string;
  created_at?: string;
  active_tasks_count?: number;
  completed_tasks_count?: number;
}

interface Permissions {
  id: number;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const addSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.string().min(1, 'Role is required'),
});

const permissionModules = ['projects', 'tasks', 'team', 'documents', 'reports', 'activity', 'announcements', 'subscriptions'] as const;

export default function TeamPage() {
  useEffect(() => { document.title = 'Team — TNT Pulse'; }, []);
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const canCreate = hasPermission('team', 'can_create');
  const canEdit = hasPermission('team', 'can_edit');
  const canDelete = hasPermission('team', 'can_delete');
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [permUser, setPermUser] = useState<UserData | null>(null);
  const [removeUser, setRemoveUser] = useState<UserData | null>(null);
  const [suspendUser, setSuspendUser] = useState<UserData | null>(null);
  const [viewUser, setViewUser] = useState<UserData | null>(null);

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const total = users?.length || 0;
  const active = users?.filter((u) => u.status === 'active').length || 0;
  const suspended = users?.filter((u) => u.status === 'suspended').length || 0;
  const roleCounts: Record<string, number> = {};
  users?.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        {canCreate && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">
            <Plus size={18} /> Add Member
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Users} label="Total Members" value={total} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatsCard icon={UserCheck} label="Active" value={active} iconBg="bg-green-50" iconColor="text-green-600" />
        <StatsCard icon={UserX} label="Suspended" value={suspended} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatsCard icon={Shield} label="Roles" value={Object.keys(roleCounts).length} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users?.map((u) => (
            <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${avatarColor(u.name)} flex items-center justify-center text-white text-lg font-bold`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="role" value={u.role} />
                  <span className={`inline-block w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1"><ListTodo size={14} /> {u.active_tasks_count ?? 0} active tasks</span>
                <span>{u.last_seen ? `${formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}` : 'Never'}</span>
              </div>
              {(canEdit || canDelete || isSuperAdmin) && u.role !== 'super_admin' && (
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setViewUser(u)}
                    className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Eye size={14} />
                    <span>View</span>
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => setPermUser(u)} className="flex-1 px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">Permissions</button>
                  )}
                  {canEdit && u.status === 'active' && (
                    <button
                      onClick={() => setSuspendUser(u)}
                      className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      <Ban size={14} />
                      <span>Suspend</span>
                    </button>
                  )}
                  {canEdit && u.status === 'suspended' && (
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/api/users/${u.id}/reactivate`, { status: 'active' });
                          queryClient.setQueryData<UserData[]>(['users'], (old) =>
                            old?.map((x) => (x.id === u.id ? { ...x, status: 'active' } : x)) ?? []
                          );
                          toast({ message: `${u.name} has been reactivated`, type: 'success' });
                        } catch {
                          toast({ message: 'Failed to reactivate member', type: 'error' });
                        }
                      }}
                      className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      <CheckCircle size={14} />
                      <span>Reactivate</span>
                    </button>
                  )}
                  {canDelete && user && u.id !== user.id && (
                    <button
                      onClick={() => setRemoveUser(u)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} />}
      {permUser && <PermissionsModal user={permUser} onClose={() => setPermUser(null)} />}
      {removeUser && <RemoveConfirmModal user={removeUser} onClose={() => setRemoveUser(null)} />}
      {suspendUser && <SuspendConfirmModal user={suspendUser} onClose={() => setSuspendUser(null)} />}
      {viewUser && <ViewMemberModal user={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: 'developer', label: 'Developer' },
  { value: 'frontend_developer', label: 'Frontend Developer' },
  { value: 'backend_developer', label: 'Backend Developer' },
  { value: 'full_stack_developer', label: 'Full Stack Developer' },
  { value: 'mobile_developer', label: 'Mobile Developer' },
  { value: 'ui_ux_designer', label: 'UI/UX Designer' },
  { value: 'graphic_designer', label: 'Graphic Designer' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'qa_engineer', label: 'QA Engineer / Tester' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'ai_ml_engineer', label: 'AI/ML Engineer' },
  { value: 'intern', label: 'Intern' },
  { value: '__other__', label: 'Other (type manually)' },
];

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOtherRole, setIsOtherRole] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('developer');
  const [customRole, setCustomRole] = useState('');
  const [setPasswordManually, setSetPasswordManually] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { role: 'developer', name: '', email: '' },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof addSchema>) => {
      const payload: Record<string, unknown> = { ...data };
      if (setPasswordManually) {
        if (password.length < 8) {
          setPasswordError('Password must be at least 8 characters');
          throw new Error('Validation failed');
        }
        if (password !== confirmPassword) {
          setPasswordError('Passwords do not match');
          throw new Error('Validation failed');
        }
        payload.password = password;
      }
      await api.post('/api/auth/register', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ message: setPasswordManually ? 'Member added successfully.' : 'Member added. Login credentials sent via email.', type: 'success' });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Team Member</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input {...register('name')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" {...register('email')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={isOtherRole ? '__other__' : selectedPreset}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__other__') {
                  setIsOtherRole(true);
                  setValue('role', customRole);
                } else {
                  setIsOtherRole(false);
                  setSelectedPreset(val);
                  setValue('role', val);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {isOtherRole && (
              <input
                value={customRole}
                onChange={(e) => {
                  setCustomRole(e.target.value);
                  setValue('role', e.target.value);
                }}
                placeholder="Enter custom role"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mt-2"
              />
            )}
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
          </div>

          {/* Hidden input to register role field with react-hook-form */}
          <input type="hidden" {...register('role')} />

          {/* Password Section */}
          <div className="border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={setPasswordManually}
                onChange={(e) => {
                  setSetPasswordManually(e.target.checked);
                  setPasswordError('');
                }}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Set password manually</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">If unchecked, a random password will be generated and sent via email.</p>
            {setPasswordManually && (
              <div className="mt-3 space-y-3 ml-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
              </div>
            )}
          </div>

          {mutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add member'}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {mutation.isPending ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ user: targetUser, onClose }: { user: UserData; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/users/${targetUser.id}`);
    },
    onSuccess: () => {
      queryClient.setQueryData<UserData[]>(['users'], (old) => old?.filter((u) => u.id !== targetUser.id) ?? []);
      toast({ message: `${targetUser.name} has been permanently removed`, type: 'success' });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove member';
      toast({ message: msg, type: 'error' });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Permanently Remove Member</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to permanently remove <strong>{targetUser.name}</strong>? This will delete their account and cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {mutation.isPending ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuspendConfirmModal({ user: targetUser, onClose }: { user: UserData; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/users/${targetUser.id}/suspend`);
    },
    onSuccess: () => {
      queryClient.setQueryData<UserData[]>(['users'], (old) =>
        old?.map((u) => (u.id === targetUser.id ? { ...u, status: 'suspended' } : u)) ?? []
      );
      toast({ message: `${targetUser.name} has been suspended`, type: 'success' });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to suspend member';
      toast({ message: msg, type: 'error' });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Suspend Member</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to suspend <strong>{targetUser.name}</strong>? They will lose access until reactivated.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {mutation.isPending ? 'Suspending...' : 'Suspend'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  create_project: 'Created project',
  update_project: 'Updated project',
  delete_project: 'Deleted project',
  create_task: 'Created task',
  update_task: 'Updated task',
  delete_task: 'Deleted task',
  create_milestone: 'Created milestone',
  update_milestone: 'Updated milestone',
  create_requirement: 'Created requirement',
  update_requirement: 'Updated requirement',
  suspend_user: 'Suspended user',
  user_deleted: 'Deleted user',
  update_user: 'Updated user',
  update_permissions: 'Updated permissions',
  add_member: 'Added to project',
  remove_member: 'Removed from project',
  transfer_super_admin_out: 'Transferred admin rights',
  transfer_super_admin_in: 'Received admin rights',
};

const statusBadgeStyles: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  on_hold: 'bg-orange-100 text-orange-700',
};

function ViewMemberModal({ user: targetUser, onClose }: { user: UserData; onClose: () => void }) {
  const { data: userDetail, isLoading } = useQuery({
    queryKey: ['user-detail', targetUser.id],
    queryFn: async () => {
      const res = await api.get(`/api/users/${targetUser.id}`);
      return res.data.data;
    },
    enabled: !!targetUser,
  });

  const { data: activityData } = useQuery({
    queryKey: ['user-activity', targetUser.id],
    queryFn: async () => {
      const res = await api.get(`/api/activity?user_id=${targetUser.id}&limit=5`);
      return res.data.data.logs;
    },
    enabled: !!targetUser,
  });

  const totalTasks = (userDetail?.active_tasks ?? 0) + (userDetail?.completed_tasks ?? 0);
  const completionRate = totalTasks > 0 ? Math.round((userDetail?.completed_tasks ?? 0) / totalTasks * 100) : 0;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const memberSince = userDetail?.created_at ?? targetUser.created_at;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-200" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">Member Profile</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Header */}
          <div className="flex items-center gap-5">
            <div className={`w-20 h-20 rounded-full ${avatarColor(targetUser.name)} flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-sm`}>
              {targetUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 truncate">{targetUser.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="role" value={targetUser.role} />
                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${targetUser.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${targetUser.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {targetUser.status === 'active' ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Personal Info */}
          <div className="bg-gray-50 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <span className="truncate">{targetUser.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span>Member since {memberSince ? format(new Date(memberSince), 'MMMM d, yyyy') : '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock size={16} className="text-gray-400 shrink-0" />
                <span>{userDetail?.last_seen ? `Last seen ${formatDistanceToNow(new Date(userDetail.last_seen), { addSuffix: true })}` : 'Never seen'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Briefcase size={16} className="text-gray-400 shrink-0" />
                <span className="capitalize">{targetUser.role.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Work Stats */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Work Statistics</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{userDetail?.total_projects ?? userDetail?.active_projects ?? 0}</p>
                <p className="text-xs text-blue-600/70 font-medium mt-0.5">Total Projects</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{userDetail?.active_tasks ?? targetUser.active_tasks_count ?? 0}</p>
                <p className="text-xs text-indigo-600/70 font-medium mt-0.5">Active Tasks</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{userDetail?.completed_tasks ?? 0}</p>
                <p className="text-xs text-green-600/70 font-medium mt-0.5">Completed</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{userDetail?.overdue_tasks ?? 0}</p>
                <p className="text-xs text-red-600/70 font-medium mt-0.5">Overdue</p>
              </div>
            </div>
            {totalTasks > 0 && (
              <div className="mt-3 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Task Completion Rate</p>
                  <span className="text-sm font-semibold text-gray-900">{completionRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%`, backgroundColor: completionRate >= 70 ? '#22c55e' : completionRate >= 40 ? '#f59e0b' : '#ef4444' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Current Projects */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <span className="inline-flex items-center gap-1.5"><FolderKanban size={14} /> Current Projects</span>
            </p>
            {userDetail?.projects && userDetail.projects.length > 0 ? (
              <div className="space-y-2">
                {userDetail.projects.map((p: { id: number; name: string; status: string; task_count: number }) => (
                  <div key={p.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3 hover:border-gray-200 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeStyles[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-3">{p.task_count} task{p.task_count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-5 text-center">
                <FolderKanban size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Not assigned to any project yet</p>
              </div>
            )}
          </div>

          {/* Section 5: Recent Activity */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <span className="inline-flex items-center gap-1.5"><Activity size={14} /> Recent Activity</span>
            </p>
            {activityData && activityData.length > 0 ? (
              <div className="space-y-2">
                {activityData.map((log: { id: number; action: string; entity_type: string; created_at: string }, i: number) => (
                  <div key={log.id || i} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {ACTIVITY_LABELS[log.action] || log.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-3">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-5 text-center">
                <Activity size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionsModal({ user: targetUser, onClose }: { user: UserData; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser, setPermissions } = useAuthStore();

  const { data: existingPerms } = useQuery<Permissions[]>({
    queryKey: ['permissions', targetUser.id],
    queryFn: async () => {
      const res = await api.get(`/api/users/${targetUser.id}/permissions`);
      return res.data.data;
    },
  });

  const [perms, setPerms] = useState<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>({});

  useEffect(() => {
    if (existingPerms && existingPerms.length > 0) {
      const mapped: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
      for (const p of existingPerms) {
        mapped[p.module_name] = {
          view: p.can_view,
          create: p.can_create,
          edit: p.can_edit,
          delete: p.can_delete,
        };
      }
      setPerms(mapped);
    }
  }, [existingPerms]);

  const mutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(perms).map(([module_name, p]) => ({
        module_name,
        can_view: p.view,
        can_create: p.create,
        can_edit: p.edit,
        can_delete: p.delete,
      }));
      const res = await api.put(`/api/users/${targetUser.id}/permissions`, { user_id: targetUser.id, permissions });
      return res.data.data;
    },
    onSuccess: async (updatedPerms) => {
      toast({ message: 'Permissions saved successfully', type: 'success' });
      queryClient.setQueryData(['permissions', targetUser.id], updatedPerms);
      
      if (currentUser?.id === targetUser.id) {
        try {
          const myPermsRes = await api.get('/api/users/me/permissions');
          setPermissions(myPermsRes.data.data || []);
        } catch (e) {
          console.error('Failed to refresh own permissions', e);
        }
      }

      if (updatedPerms) {
        const mapped: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
        for (const p of updatedPerms) {
          mapped[p.module_name] = {
            view: p.can_view,
            create: p.can_create,
            edit: p.can_edit,
            delete: p.can_delete,
          };
        }
        setPerms(mapped);
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save permissions';
      toast({ message: msg, type: 'error' });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Permissions — {targetUser.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {permissionModules.map((mod) => {
            const p = perms[mod] || { view: false, create: false, edit: false, delete: false };
            return (
              <div key={mod} className="border border-gray-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 capitalize mb-3">{mod}</p>
                <div className="flex items-center gap-4">
                  {(['view', 'create', 'edit', 'delete'] as const).map((action) => (
                    <label key={action} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p[action]}
                        onChange={() => setPerms({ ...perms, [mod]: { ...p, [action]: !p[action] } })}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {action.charAt(0).toUpperCase() + action.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {mutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save permissions'}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {mutation.isPending ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
