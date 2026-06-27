'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, Users, Trash2, RotateCcw, AlertTriangle, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Badge from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import CreateProjectModal from '@/components/projects/CreateProjectModal';
import { useToast } from '@/components/ui/Toast';

interface Project {
  id: number;
  name: string;
  description: string;
  client_name: string;
  status: string;
  priority: string;
  deadline: string;
  start_date: string;
  created_at: string;
  member_count: number;
  active_tasks: number;
  deleted_at?: string;
  deleted_by_name?: string;
}

function RecycleBinModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [confirmPermanent, setConfirmPermanent] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const { data: recycleBin, isLoading } = useQuery<Project[]>({
    queryKey: ['recycle-bin'],
    queryFn: async () => {
      const res = await api.get('/api/projects/recycle-bin');
      return res.data.data;
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/projects/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ message: 'Project restored', type: 'success' });
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/projects/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast({ message: 'Project permanently deleted', type: 'success' });
      setConfirmPermanent(null);
      setConfirmText('');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Trash2 size={20} className="text-gray-500" />
            Recycle Bin
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-gray-500 text-center">Loading...</p>
          ) : !recycleBin || recycleBin.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Recycle bin is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recycleBin.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 gap-4 relative">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">Deleted by: {p.deleted_by_name || 'Unknown'} &bull; {new Date(p.deleted_at!).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => restoreMutation.mutate(p.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-sm font-medium transition-colors"
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw size={16} /> Restore
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setConfirmPermanent(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-sm font-medium transition-colors"
                      >
                        <Trash2 size={16} /> Delete Forever
                      </button>
                    )}
                  </div>

                  {confirmPermanent === p.id && (
                    <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-6 rounded-lg text-center">
                      <AlertTriangle size={32} className="text-red-500 mb-3" />
                      <p className="font-bold text-gray-900 mb-2">This cannot be undone.</p>
                      <p className="text-sm text-gray-600 mb-4">All tasks, members, requirements will be permanently deleted.</p>
                      <p className="text-sm font-medium mb-2">Type "DELETE" to confirm</p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="border border-gray-300 rounded px-3 py-2 mb-4 w-48 text-center uppercase"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setConfirmPermanent(null); setConfirmText(''); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                        <button
                          onClick={() => permanentDeleteMutation.mutate(p.id)}
                          disabled={confirmText !== 'DELETE' || permanentDeleteMutation.isPending}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 rounded-lg text-sm font-medium"
                        >
                          Confirm Permanent Delete
                        </button>
                      </div>
                    </div>
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

const avatarColors = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-pink-600',
  'bg-teal-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: string;
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
  members: ProjectMember[];
}

function TeamMembersModal({ projectId, projectName, onClose }: { projectId: number; projectName: string; onClose: () => void }) {
  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/projects/${projectId}`);
      return res.data.data;
    },
  });

  const members = project?.members || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{projectName} — Team</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No team members</p>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full ${getAvatarColor(member.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.task_count} active task{member.task_count !== 1 ? 's' : ''}</p>
                  </div>
                  <Badge variant="role" value={member.role} />
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                    member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {member.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  useEffect(() => { document.title = 'Projects — TNT Pulse'; }, []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const canManage = user?.role === 'super_admin' || user?.role === 'manager';
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [teamModalProject, setTeamModalProject] = useState<Project | null>(null);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', statusFilter, priorityFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/api/projects?${params.toString()}`);
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ message: 'Project moved to recycle bin', type: 'success' });
      setDeleteConfirm(null);
      setDeleteConfirmStep(1);
      setDeleteConfirmText('');
    }
  });

  const handleDeleteClick = (e: React.MouseEvent, p: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(p);
    setDeleteConfirmStep(1);
    setDeleteConfirmText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-3">
          {canManage && (
            <button onClick={() => setShowRecycleBin(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
              <Trash2 size={18} />
              Recycle Bin
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <Plus size={18} />
              New Project
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Status</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Search size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects found</h3>
          <p className="text-sm text-gray-500">Try adjusting your filters or create a new project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const daysRemaining = p.deadline ? Math.floor((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <div key={p.id} className="relative group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between mb-3">
                  <Link href={`/projects/${p.id}`} className="font-semibold text-gray-900 truncate pr-8 hover:text-indigo-600 transition-colors">
                    {p.name}
                  </Link>
                  <span className="inline-flex cursor-default pointer-events-none">
                    <Badge variant="status" value={p.status} />
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 truncate">{p.client_name || 'No client'}</p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex cursor-default pointer-events-none">
                    <Badge variant="priority" value={p.priority} />
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeamModalProject(p);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setTeamModalProject(p);
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <Users size={14} />
                    {p.member_count}
                  </span>
                  {daysRemaining !== null && (
                    <span className={daysRemaining <= 3 ? 'text-red-600 font-semibold' : daysRemaining <= 7 ? 'text-yellow-600' : ''}>
                      {daysRemaining > 0 ? `${daysRemaining}d left` : 'Overdue'}
                    </span>
                  )}
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  View Project &rarr;
                </Link>
                {canManage && (
                  <button
                    onClick={(e) => handleDeleteClick(e, p)}
                    className="absolute top-4 right-4 p-1.5 bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-100 shadow-sm"
                    title="Move to Recycle Bin"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {showRecycleBin && <RecycleBinModal onClose={() => setShowRecycleBin(false)} />}
      {teamModalProject && (
        <TeamMembersModal
          projectId={teamModalProject.id}
          projectName={teamModalProject.name}
          onClose={() => setTeamModalProject(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            {deleteConfirmStep === 1 ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Move to Recycle Bin?</h2>
                <p className="text-gray-600 mb-6">Are you sure you want to delete <span className="font-semibold">{deleteConfirm.name}</span>? It will be moved to the recycle bin.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                  <button onClick={() => setDeleteConfirmStep(2)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Yes, Delete</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Type the project name to confirm:</h2>
                <input
                  type="text"
                  placeholder={deleteConfirm.name}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                  <button
                    onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                    disabled={deleteConfirmText !== deleteConfirm.name || deleteMutation.isPending}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 rounded-lg text-sm font-medium"
                  >
                    Confirm Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
