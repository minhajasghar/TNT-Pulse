'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { 
  ArrowLeft, Users, Calendar, Clock, 
  CheckCircle2, AlertCircle, PlayCircle, Loader2,
  FolderKanban, Trash2, Edit, Plus, FileText,
  Upload, Download, X, Globe, Server, Plug, Shield, Key, Database, Mail, Package, Info, Circle
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import Badge from '@/components/ui/Badge';
import RoleSelector from '@/components/ui/RoleSelector';
import Link from 'next/link';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';

const CATEGORY_ICONS = {
  domain: Globe,
  hosting: Server,
  api_service: Plug,
  ssl_certificate: Shield,
  software_license: Key,
  database: Database,
  email_service: Mail,
  other: Package,
};

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tasks' | 'team' | 'milestones' | 'requirements' | 'subscriptions' | 'documents'>('tasks');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddRequirement, setShowAddRequirement] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/projects/${projectId}`);
      return res.data.data;
    }
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  if (error || !data) return <div className="p-8 text-center text-red-500">Failed to load project details.</div>;

  const project = data;
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'manager';
  
  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter((t: any) => t.status === 'done').length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const daysLeft = differenceInDays(new Date(project.deadline), new Date());
  const isOverdue = daysLeft < 0 && project.status !== 'completed';

  const statusColors: Record<string, string> = {
    planning: 'bg-gray-100 text-gray-700 border-gray-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    review: 'bg-amber-100 text-amber-700 border-amber-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    on_hold: 'bg-red-100 text-red-700 border-red-200',
  };

  const priorityColors: Record<string, string> = {
    low: 'text-gray-500 bg-gray-50',
    medium: 'text-blue-600 bg-blue-50',
    high: 'text-amber-600 bg-amber-50',
    critical: 'text-red-600 bg-red-50'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push('/projects')} className="p-2 hover:bg-gray-100 rounded-lg mt-1 transition-colors">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.planning}`}>
              {project.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[project.priority] || priorityColors.medium}`}>
              {project.priority.toUpperCase()} PRIORITY
            </span>
          </div>
          <p className="text-gray-500">{project.client_name} • Created by {project.created_by_name}</p>
        </div>
      </div>

      {/* Progress & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Card */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Project Progress</h3>
            <span className="text-2xl font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 text-right">{completedTasks} of {totalTasks} tasks completed</p>
        </div>

        {/* Timeline Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3 text-gray-700">
            <Calendar size={18} className="text-indigo-500" />
            <h3 className="text-sm font-semibold">Timeline</h3>
          </div>
          <p className="text-sm font-medium text-gray-900">{format(new Date(project.start_date), 'MMM d, yyyy')} - {format(new Date(project.deadline), 'MMM d, yyyy')}</p>
          <div className="mt-2 flex items-center gap-1.5">
            {project.status === 'completed' ? (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={12} /> Completed
              </span>
            ) : isOverdue ? (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={12} /> Overdue by {Math.abs(daysLeft)} days
              </span>
            ) : (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock size={12} /> {daysLeft} days remaining
              </span>
            )}
          </div>
        </div>

        {/* Team Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3 text-gray-700">
            <Users size={18} className="text-indigo-500" />
            <h3 className="text-sm font-semibold">Team Size</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{project.members?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Active members</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4">
        <div className="flex gap-6 max-w-7xl mx-auto">
          {[
            { id: 'tasks', label: 'Tasks', count: totalTasks },
            { id: 'team', label: 'Team', count: project.members?.length || 0 },
            { id: 'milestones', label: 'Milestones', count: project.milestones?.length || 0 },
            { id: 'requirements', label: 'Requirements', count: project.requirements?.length || 0 },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'documents', label: 'Documents' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="mt-6">
        {activeTab === 'tasks' && <TasksTab project={project} />}
        {activeTab === 'team' && <TeamTab project={project} isAdmin={isAdmin} users={usersData} />}
        {activeTab === 'milestones' && <MilestonesTab project={project} isAdmin={isAdmin} />}
        {activeTab === 'requirements' && <RequirementsTab project={project} isAdmin={isAdmin} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab project={project} isAdmin={isAdmin} />}
        {activeTab === 'documents' && <DocumentsTab project={project} isAdmin={isAdmin} currentUser={currentUser} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TASKS TAB
// ----------------------------------------------------------------------
function TasksTab({ project }: { project: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    estimated_hours: ''
  });
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'manager';
  const isMember = project.members?.some((m: any) => m.user_id === Number(currentUser?.id));

  const members = project.members || [];

  const markDoneMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.put(`/api/tasks/${taskId}`, { status: 'done' });
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['project', String(project.id)] });
      const previous = queryClient.getQueryData(['project', String(project.id)]);
      queryClient.setQueryData(['project', String(project.id)], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks?.map((t: any) => t.id === taskId ? { ...t, status: 'done' } : t)
        };
      });
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      queryClient.setQueryData(['project', String(project.id)], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['member-dashboard'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/api/tasks', {
        ...data,
        project_id: project.id,
        assigned_to: data.assigned_to ? Number(data.assigned_to) : null,
        estimated_hours: data.estimated_hours ? Number(data.estimated_hours) : null
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] });
      toast({ message: 'Task created successfully', type: 'success' });
      setFormData({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', estimated_hours: '' });
      setShowForm(false);
    },
    onError: (err: any) => {
      toast({ message: err.response?.data?.message || 'Failed to create task', type: 'error' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    createMutation.mutate(formData);
  };

  const canCreate = isAdmin || isMember;

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Cancel' : 'Add Task'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                required
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Task title"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
              <select
                value={formData.assigned_to}
                onChange={e => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Hours</label>
              <input
                type="number"
                step="0.5"
                value={formData.estimated_hours}
                onChange={e => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. 4"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      )}

      {(!project.tasks || project.tasks.length === 0) && !showForm ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Yet</h3>
          <p className="text-gray-500">Create your first task to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {project.tasks.map((task: any) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (task.status !== 'done') {
                              markDoneMutation.mutate(task.id);
                            }
                          }}
                          className="shrink-0"
                        >
                          {task.status === 'done' ? (
                            <CheckCircle2 size={18} className="text-green-500" />
                          ) : (
                            <Circle size={18} className="text-gray-300 hover:text-green-400" />
                          )}
                        </button>
                        {task.title}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="status" value={task.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{task.assignee_name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

// ----------------------------------------------------------------------
// TEAM TAB
// ----------------------------------------------------------------------
function TeamTab({ project, isAdmin, users }: { project: any, isAdmin: boolean, users: any[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!newMemberId) throw new Error('Please select a user');
      const res = await api.post(`/api/projects/${project.id}/members`, {
        user_id: parseInt(newMemberId),
        project_role: newMemberRole || 'Member'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] });
      toast({ message: 'Member added successfully', type: 'success' });
      setNewMemberId('');
      setNewMemberRole('');
    },
    onError: (err: any) => {
      toast({ message: err.response?.data?.message || 'Failed to add member', type: 'error' });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/projects/${project.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] });
      toast({ message: 'Member removed', type: 'success' });
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number, role: string }) => {
      await api.patch(`/api/projects/${project.id}/members/${userId}/role`, { project_role: role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] });
      toast({ message: 'Role updated', type: 'success' });
    }
  });

  const activeUsers = users?.filter((u: any) => u.status === 'active') || [];
  const availableUsers = activeUsers.filter((u: any) => !project.members?.some((m: any) => m.user_id === u.id));

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            <select
              value={newMemberId}
              onChange={e => setNewMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose a member...</option>
              {availableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <RoleSelector 
              label="Project Role"
              value={newMemberRole}
              onChange={setNewMemberRole}
            />
          </div>
          <button
            onClick={() => addMemberMutation.mutate()}
            disabled={addMemberMutation.isPending || !newMemberId}
            className="h-[38px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors mt-6"
          >
            {addMemberMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add Member
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {project.members?.map((member: any) => (
          <div key={member.user_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.name} from project?`)) {
                      removeMemberMutation.mutate(member.user_id);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove from project"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Project Role</p>
                {isAdmin ? (
                  <RoleSelector 
                    value={member.project_role || ''}
                    onChange={(val) => updateRoleMutation.mutate({ userId: member.user_id, role: val })}
                  />
                ) : (
                  <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded font-medium">
                    {member.project_role || 'Member'}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-50">
                <span>Joined {format(new Date(member.assigned_at), 'MMM d, yyyy')}</span>
                <Badge variant="role" value={member.role} />
              </div>
            </div>
          </div>
        ))}
        {(!project.members || project.members.length === 0) && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No members assigned to this project yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MILESTONES TAB
// ----------------------------------------------------------------------
function MilestonesTab({ project, isAdmin }: { project: any, isAdmin: boolean }) {
  if (!project.milestones || project.milestones.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <PlayCircle size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Milestones</h3>
        <p className="text-gray-500 mb-6">Milestones track significant phases of the project.</p>
        {isAdmin && (
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
            Create First Milestone
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {project.milestones.map((ms: any) => (
          <li key={ms.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              <div className={`mt-1 w-3 h-3 rounded-full ${ms.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
              <div>
                <h4 className="font-semibold text-gray-900">{ms.title}</h4>
                <p className="text-sm text-gray-500 mt-1">{ms.description || 'No description provided.'}</p>
                <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                  <span className={`${ms.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                    {ms.status.toUpperCase()}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600 flex items-center gap-1">
                    <Calendar size={12} /> {format(new Date(ms.due_date), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------
// REQUIREMENTS TAB
// ----------------------------------------------------------------------
function RequirementsTab({ project, isAdmin }: { project: any, isAdmin: boolean }) {
  if (!project.requirements || project.requirements.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Requirements</h3>
        <p className="text-gray-500 mb-6">Track functional and technical requirements here.</p>
        {isAdmin && (
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
            Add Requirement
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {project.requirements.map((req: any) => (
        <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-gray-900">{req.title}</h4>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
              ${req.type === 'functional' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
            `}>
              {req.type}
            </span>
          </div>
          <p className="text-sm text-gray-600 flex-1 whitespace-pre-wrap">{req.description}</p>
          
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${req.status === 'met' ? 'bg-green-500' : req.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
              {req.status.toUpperCase()}
            </span>
            <span>By {req.created_by_name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// SUBSCRIPTIONS TAB
// ----------------------------------------------------------------------
function SubscriptionsTab({ project, isAdmin }: { project: any, isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: linkedSubs, isLoading } = useQuery({
    queryKey: ['project-subscriptions', String(project.id)],
    queryFn: async () => {
      const res = await api.get(`/api/subscriptions/project/${project.id}`);
      return res.data.subscriptions;
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: async (subId: number) => {
      await api.delete(`/api/subscriptions/${subId}/projects/${project.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-subscriptions', String(project.id)] });
      toast({ message: 'Subscription unlinked', type: 'success' });
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p className="text-blue-700 text-sm">
          To add subscriptions for this project, go to the  
          <Link href="/subscriptions" className="font-medium underline mx-1">
            Subscriptions
          </Link>
          section and select this project.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Linked Subscriptions</h3>
      </div>

      {linkedSubs?.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Linked</h3>
          <p className="text-gray-500 mb-6">Link hosting, domains, or APIs used by this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {linkedSubs?.map((sub: any) => {
            let badgeClass = 'bg-green-100 text-green-800';
            let badgeText = `${sub.days_remaining} days left`;

            if (sub.days_remaining < 0) {
              badgeClass = 'bg-red-100 text-red-800 font-bold';
              badgeText = 'EXPIRED';
            } else if (sub.days_remaining <= 3) {
              badgeClass = 'bg-red-100 text-red-800';
              badgeText = `Expires in ${sub.days_remaining} days`;
            } else if (sub.days_remaining <= 7) {
              badgeClass = 'bg-orange-100 text-orange-800';
              badgeText = `Expires in ${sub.days_remaining} days`;
            } else if (sub.days_remaining <= 30) {
              badgeClass = 'bg-yellow-100 text-yellow-800';
            }

            return (
              <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full relative">
                {isAdmin && (
                  <button 
                    onClick={() => {
                      if (confirm('Unlink this subscription from the project?')) {
                        unlinkMutation.mutate(sub.id);
                      }
                    }}
                    className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Unlink from project"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 pr-8">{sub.name}</h4>
                    <p className="text-xs text-gray-500">{sub.provider || sub.category.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <div className="mt-auto space-y-3 pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {sub.currency === 'USD' ? '$' : sub.currency} {Number(sub.cost).toFixed(2)}
                      <span className="text-gray-500 text-xs capitalize ml-1">/{sub.billing_cycle.replace('_', ' ')}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
                      {badgeText}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(sub.expiry_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// DOCUMENTS TAB
// ----------------------------------------------------------------------
function DocumentsTab({ project, isAdmin, currentUser }: { project: any, isAdmin: boolean, currentUser: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['project-documents', String(project.id)],
    queryFn: async () => {
      const res = await api.get('/api/documents', { params: { project_id: project.id } });
      return res.data.data;
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !docTitle.trim()) {
      toast({ message: 'Title and file are required', type: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', docTitle.trim());
      formData.append('description', docDescription.trim());
      formData.append('project_id', String(project.id));

      await api.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast({ message: 'Document uploaded successfully', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['project-documents', String(project.id)] });
      setSelectedFile(null);
      setDocTitle('');
      setDocDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Failed to upload document', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await api.delete(`/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', String(project.id)] });
      toast({ message: 'Document deleted', type: 'success' });
    },
    onError: (err: any) => {
      toast({ message: err.response?.data?.message || 'Failed to delete document', type: 'error' });
    }
  });

  const canDelete = (doc: any) => isAdmin || Number(doc.uploaded_by) === Number(currentUser?.id);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      {isAdmin && (
        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Upload Document</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                required
                type="text"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Document title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={docDescription}
                onChange={e => setDocDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !docTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
            >
              <Upload size={16} />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {/* Documents List */}
      {!documents || documents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents</h3>
          <p className="text-gray-500">Upload project documents, contracts, or reference files here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500 shrink-0" />
                        <span className="font-medium text-gray-900">{doc.title}</span>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium uppercase">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatFileSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-gray-600">{doc.uploader_name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`${api.defaults.baseURL}/api/documents/${doc.id}/download`}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Download"
                        >
                          <Download size={16} />
                        </a>
                        {canDelete(doc) && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this document?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

