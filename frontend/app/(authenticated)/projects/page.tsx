'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users, Trash2, RotateCcw, AlertTriangle, X, Pencil, Edit3, FolderKanban, Loader2, Calendar, Upload } from 'lucide-react';
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
  is_member?: number;
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

interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: string;
  project_role: string | null;
  status: string;
  task_count: number;
  completed_tasks: number;
  initials: string;
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
  members: ProjectMember[];
}

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
}

const projectRoleOptions = [
  { value: '', label: 'No role' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'Lead Developer', label: 'Lead Developer' },
  { value: 'Frontend Developer', label: 'Frontend Developer' },
  { value: 'Backend Developer', label: 'Backend Developer' },
  { value: 'Full Stack Developer', label: 'Full Stack Developer' },
  { value: 'UI/UX Designer', label: 'UI/UX Designer' },
  { value: 'Graphic Designer', label: 'Graphic Designer' },
  { value: 'QA Engineer', label: 'QA Engineer' },
  { value: 'DevOps Engineer', label: 'DevOps Engineer' },
  { value: 'AI/ML Engineer', label: 'AI/ML Engineer' },
  { value: 'Intern', label: 'Intern' },
  { value: 'Observer', label: 'Observer' },
  { value: '__other__', label: 'Other (type manually)' },
];

function EditProjectModal({ project, onClose }: EditProjectModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'details' | 'members' | 'documents'>('details');

  const { data: fullProject } = useQuery<ProjectDetail>({
    queryKey: ['project-detail', project.id],
    queryFn: async () => {
      const res = await api.get(`/api/projects/${project.id}`);
      return res.data.data;
    },
  });

  const members = fullProject?.members || [];

  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.client_name || '');
  const [description, setDescription] = useState(project.description || '');
  const [startDate, setStartDate] = useState(project.start_date ? project.start_date.split('T')[0] : '');
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState(project.priority);
  const [status, setStatus] = useState(project.status);

  const [memberSearch, setMemberSearch] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState<ProjectMember | null>(null);
  const [customRoleEdit, setCustomRoleEdit] = useState<Record<number, string>>({});
  const [newMemberCustomRoles, setNewMemberCustomRoles] = useState<Record<number, string>>({});
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: projectDocs } = useQuery({
    queryKey: ['project-docs', project.id],
    queryFn: async () => {
      const res = await api.get(`/api/documents?project_id=${project.id}`);
      return res.data.data;
    },
    enabled: tab === 'documents',
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await api.delete(`/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-docs', project.id] });
      toast({ message: 'Document deleted', type: 'success' });
    },
  });

  const handleUploadDocs = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    let allSucceeded = true;
    for (const file of uploadFiles) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name);
      fd.append('project_id', String(project.id));
      try {
        await api.post('/api/documents/upload', fd);
      } catch (err: any) {
        allSucceeded = false;
        console.error('Document upload error:', err?.response?.data || err);
        toast({ message: err?.response?.data?.message || `Failed to upload ${file.name}`, type: 'error' });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['project-docs', project.id] });
    setUploadFiles([]);
    setUploading(false);
    if (allSucceeded) {
      toast({ message: 'Documents uploaded', type: 'success' });
    }
  };

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.put(`/api/projects/${project.id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ message: 'Project updated', type: 'success' });
      onClose();
    },
    onError: () => {
      toast({ message: 'Failed to update project', type: 'error' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, projectRole }: { userId: number; projectRole: string }) => {
      await api.post(`/api/projects/${project.id}/members`, { user_id: userId, project_role: projectRole });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', project.id] });
      const user = allUsers?.find((u: { id: number }) => u.id === vars.userId);
      toast({ message: `${user?.name || 'User'} added to project`, type: 'success' });
      setMemberSearch('');
    },
    onError: () => {
      toast({ message: 'Failed to add member', type: 'error' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/projects/${project.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', project.id] });
      toast({ message: 'Member removed', type: 'success' });
      setRemoveConfirm(null);
    },
    onError: () => {
      toast({ message: 'Failed to remove member', type: 'error' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, project_role }: { userId: number; project_role: string }) => {
      await api.patch(`/api/projects/${project.id}/members/${userId}/role`, { project_role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', project.id] });
      toast({ message: 'Role updated', type: 'success' });
    },
    onError: () => {
      toast({ message: 'Failed to update role', type: 'error' });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name,
      client_name: clientName,
      description,
      start_date: startDate || null,
      deadline: deadline || null,
      priority,
      status,
    });
  };

  const existingMemberIds = members.map((m: ProjectMember) => m.id);
  const memberSearchResults = allUsers?.filter(
    (u: { id: number; name: string; status: string }) =>
      !existingMemberIds.includes(u.id) &&
      u.status === 'active' &&
      u.name.toLowerCase().includes(memberSearch.toLowerCase()),
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-6">
          <button onClick={() => setTab('details')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors mr-6 ${tab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Project Details
          </button>
          <button onClick={() => setTab('members')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'members' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Manage Members
          </button>
          <button onClick={() => setTab('documents')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors mr-6 ${tab === 'documents' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Documents
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={!name || !clientName || updateMutation.isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                  {updateMutation.isPending && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Current Members ({members.length})</h3>
                {members.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No members in this project</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: ProjectMember) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                          <p className="text-xs text-gray-400">{m.email}</p>
                        </div>
                        {(() => {
                          const isCustomRole = m.project_role && !projectRoleOptions.some((o) => o.value === m.project_role);
                          if (customRoleEdit[m.id] !== undefined) {
                            return (
                              <div className="flex gap-1">
                                <input
                                  value={customRoleEdit[m.id]}
                                  onChange={(e) => setCustomRoleEdit((prev) => ({ ...prev, [m.id]: e.target.value }))}
                                  placeholder="Custom role"
                                  className="w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => {
                                    const val = customRoleEdit[m.id].trim();
                                    if (val) {
                                      updateRoleMutation.mutate({ userId: m.id, project_role: val });
                                      setCustomRoleEdit((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
                                    }
                                  }}
                                  disabled={updateRoleMutation.isPending || !customRoleEdit[m.id].trim()}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded text-xs font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setCustomRoleEdit((prev) => { const n = { ...prev }; delete n[m.id]; return n; })}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium"
                                >
                                  X
                                </button>
                              </div>
                            );
                          }
                          if (isCustomRole) {
                            return (
                              <div className="flex items-center gap-1">
                                <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                  {m.project_role}
                                </span>
                                <button
                                  onClick={() => setCustomRoleEdit((prev) => ({ ...prev, [m.id]: m.project_role || '' }))}
                                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Edit role"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <select
                              value={m.project_role || ''}
                              onChange={(e) => {
                                if (e.target.value === '__other__') {
                                  setCustomRoleEdit((prev) => ({ ...prev, [m.id]: '' }));
                                } else {
                                  updateRoleMutation.mutate({ userId: m.id, project_role: e.target.value });
                                }
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              {projectRoleOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          );
                        })()}
                        <button
                          onClick={() => setRemoveConfirm(m)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {removeConfirm && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800 mb-1">Remove {removeConfirm.name} from project?</p>
                      <p className="text-xs text-orange-600 mb-3">Their tasks will become unassigned.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setRemoveConfirm(null)} className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button onClick={() => { removeMemberMutation.mutate(removeConfirm.id); setRemoveConfirm(null); }} className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Member</h3>
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search team members by name..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {memberSearch.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Search for team members to add</p>
                  </div>
                ) : memberSearchResults.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-gray-400 text-sm">No members found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {memberSearchResults.map((u: { id: number; name: string; role: string }) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        </div>
                        {newMemberCustomRoles[u.id] !== undefined ? (
                          <div className="flex gap-1">
                            <input
                              value={newMemberCustomRoles[u.id]}
                              onChange={(e) => setNewMemberCustomRoles((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              placeholder="Custom role"
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => {
                                const val = newMemberCustomRoles[u.id].trim();
                                if (val) {
                                  addMemberMutation.mutate({ userId: u.id, projectRole: val });
                                  setNewMemberCustomRoles((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
                                }
                              }}
                              disabled={addMemberMutation.isPending || !newMemberCustomRoles[u.id].trim()}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded text-xs font-medium"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setNewMemberCustomRoles((prev) => { const n = { ...prev }; delete n[u.id]; return n; })}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <>
                            <select
                              id={`role-${u.id}`}
                              defaultValue="Developer"
                              onChange={(e) => {
                                if (e.target.value === '__other__') {
                                  setNewMemberCustomRoles((prev) => ({ ...prev, [u.id]: '' }));
                                }
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              {projectRoleOptions.filter(r => r.value !== '').map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const roleSelect = document.getElementById(`role-${u.id}`) as HTMLSelectElement;
                                const val = roleSelect?.value || 'Developer';
                                if (val === '__other__') {
                                  setNewMemberCustomRoles((prev) => ({ ...prev, [u.id]: '' }));
                                } else {
                                  addMemberMutation.mutate({ userId: u.id, projectRole: val });
                                }
                              }}
                              disabled={addMemberMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white disabled:bg-green-300 rounded-md text-xs font-medium transition-colors shrink-0"
                            >
                              {addMemberMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                              Add
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Documents</h3>
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Click to select files</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setUploadFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                  />
                </label>
                {uploadFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded text-sm">
                        <span className="text-gray-700 truncate flex-1">{f.name}</span>
                        <button type="button" onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-100 rounded ml-2"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleUploadDocs} disabled={uploading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-medium rounded-lg flex items-center gap-1">
                        {uploading && <Loader2 size={12} className="animate-spin" />}
                        Upload {uploadFiles.length} file(s)
                      </button>
                      <button onClick={() => setUploadFiles([])} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg">Clear</button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Existing Documents ({projectDocs?.length || 0})</h3>
                {!projectDocs || projectDocs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No documents uploaded yet</p>
                ) : (
                  <div className="space-y-2">
                    {projectDocs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                          <p className="text-xs text-gray-400">
                            {doc.file_type?.toUpperCase()} • {(doc.file_size / 1024).toFixed(1)} KB • {doc.uploader_name || 'Unknown'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <a
                            href={`${api.defaults?.baseURL || ''}/api/documents/${doc.id}/download`}
                            className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            target="_blank"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => { if (confirm('Delete this document?')) deleteDocMutation.mutate(doc.id); }}
                            className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
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

export default function ProjectsPage() {
  useEffect(() => { document.title = 'Projects — TNT Pulse'; }, []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, hasPermission } = useAuthStore();
  
  const canManage = user?.role === 'super_admin' || user?.role === 'manager';
  const canCreate = hasPermission('projects', 'can_create');
  const canDeleteGlobal = hasPermission('projects', 'can_delete');
  const canEditGlobal = hasPermission('projects', 'can_edit');
  
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [teamModalProject, setTeamModalProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { data: projects, isLoading, isError, refetch } = useQuery<Project[]>({
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
      toast({ message: 'Moved to recycle bin', type: 'success' });
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

  const handleEditClick = (e: React.MouseEvent, p: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditProject(p);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-3">
          {canDeleteGlobal && (
            <button onClick={() => setShowRecycleBin(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
              <Trash2 size={18} />
              Recycle Bin
            </button>
          )}
          {canCreate && (
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
      ) : isError ? (
        <div className="text-center py-16">
          <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Could not load projects</h3>
          <button onClick={() => refetch()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
            Retry
          </button>
        </div>
      ) : !projects || projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first project to get started</p>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
              <Plus size={18} className="inline mr-1" /> New Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const daysRemaining = p.deadline ? Math.floor((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <div key={p.id} className="relative bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                {/* Top row: Title + Action buttons */}
                <div className="flex items-start justify-between mb-3">
                  {/* Left: Title + Client */}
                  <div className="flex-1 mr-3 min-w-0">
                    <h3
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="font-semibold text-gray-900 text-base leading-tight truncate hover:text-indigo-600 cursor-pointer transition-colors"
                    >
                      {p.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{p.client_name}</p>
                  </div>
                  {/* Right: Action buttons ONLY */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(canEditGlobal || p.is_member === 1) && (
                      <button
                        onClick={(e) => handleEditClick(e, p)}
                        className="p-1.5 bg-white hover:bg-gray-100 text-gray-400 hover:text-indigo-600 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {canDeleteGlobal && (
                      <button
                        onClick={(e) => handleDeleteClick(e, p)}
                        className="p-1.5 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md transition-colors"
                        title="Move to Recycle Bin"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status + Priority badges — BELOW title */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="cursor-default"><Badge variant="status" value={p.status} /></span>
                  <span className="cursor-default"><Badge variant="priority" value={p.priority} /></span>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                  <Calendar size={14} className={p.status !== 'completed' && daysRemaining !== null && daysRemaining < 0 ? 'text-red-500' : ''} />
                  {p.status === 'completed' ? (
                    <span className="text-green-600 font-medium">Completed</span>
                  ) : daysRemaining !== null ? (
                    daysRemaining < 0 ? (
                      <span className="text-red-500 font-medium">Overdue by {Math.abs(daysRemaining)}d</span>
                    ) : (
                      <span>{daysRemaining}d left</span>
                    )
                  ) : (
                    <span>No deadline</span>
                  )}
                </div>

                {/* Members avatars */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
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
                </div>

                {/* View Project button */}
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  View Project &rarr;
                </button>
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
      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => { setEditProject(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); queryClient.invalidateQueries({ queryKey: ['project-detail', editProject.id] }); }}
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
