'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { 
  ArrowLeft, Users, Calendar, Clock, 
  CheckCircle2, AlertCircle, PlayCircle, Loader2,
  FolderKanban, Trash2, Edit, Plus, Info
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import Badge from '@/components/ui/Badge';
import RoleSelector from '@/components/ui/RoleSelector';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user: currentUser } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tasks' | 'team' | 'milestones' | 'requirements'>('tasks');
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
            { id: 'requirements', label: 'Requirements', count: project.requirements?.length || 0 }
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
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
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
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TASKS TAB
// ----------------------------------------------------------------------
function TasksTab({ project }: { project: any }) {
  if (!project.tasks || project.tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Yet</h3>
        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-3 border border-blue-100 max-w-md mx-auto mb-6 text-left">
          <Info size={20} className="shrink-0 mt-0.5 text-blue-600" />
          <p className="text-sm">
            <strong>Note:</strong> To create tasks for this project, you need to use the Kanban Board if it's available, or ask a Project Manager to assign tasks to you.
          </p>
        </div>
      </div>
    );
  }

  return (
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
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{task.title}</td>
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
      await api.put(`/api/projects/${project.id}/members/${userId}`, { project_role: role });
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
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded font-medium">
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
