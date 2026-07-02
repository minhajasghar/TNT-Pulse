'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Loader2, Upload, FileText, Trash2, Download, X, FolderOpen, Search, Filter,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

interface Document {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  project_id: number | null;
  uploaded_by: number;
  uploader_name: string;
  uploaded_at: string;
}

interface Project {
  id: number;
  name: string;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'text-red-600 bg-red-50',
  doc: 'text-blue-600 bg-blue-50',
  docx: 'text-blue-600 bg-blue-50',
  xlsx: 'text-green-600 bg-green-50',
  xls: 'text-green-600 bg-green-50',
  png: 'text-purple-600 bg-purple-50',
  jpg: 'text-purple-600 bg-purple-50',
  jpeg: 'text-purple-600 bg-purple-50',
  zip: 'text-gray-600 bg-gray-50',
  rar: 'text-gray-600 bg-gray-50',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  useEffect(() => { document.title = 'Documents — TNT Pulse'; }, []);
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canDelete = hasPermission('documents', 'can_delete');
  const canCreate = hasPermission('documents', 'can_create');

  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['documents', projectFilter, typeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectFilter) params.set('project_id', projectFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/api/documents?${params.toString()}`);
      return res.data.data;
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-select'],
    queryFn: async () => {
      const res = await api.get('/api/projects');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ message: 'Document deleted', type: 'success' });
    },
    onError: () => {
      toast({ message: 'Failed to delete document', type: 'error' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
          >
            <Upload size={18} /> Upload Document
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          {Object.keys(FILE_TYPE_COLORS).map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
              <div className="h-12 w-12 bg-gray-200 rounded-lg mb-3" />
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-full mb-4" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : !documents || documents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FolderOpen size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-1">No documents uploaded yet</h3>
          <p className="text-sm text-gray-400">Upload files to share with your team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const colorClass = FILE_TYPE_COLORS[doc.file_type] || 'text-gray-600 bg-gray-50';
            const isOwner = Number(doc.uploaded_by) === Number(user?.id);
            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className={`inline-flex p-3 rounded-lg mb-3 w-fit ${colorClass}`}>
                  <FileText size={24} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{doc.title}</h3>
                {doc.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{doc.description}</p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  {doc.project_id && (
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-full">
                      {projects?.find((p) => p.id === doc.project_id)?.name || 'Project'}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">{doc.file_type.toUpperCase()}</span>
                  <span className="text-[10px] text-gray-400">·</span>
                  <span className="text-[10px] text-gray-400">{formatFileSize(doc.file_size)}</span>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-50">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold shrink-0">
                    {(doc.uploader_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{doc.uploader_name || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-400">{formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true })}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`http://localhost:5000/api/documents/${doc.id}/download`}
                      download
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download size={15} />
                    </a>
                    {(canDelete || isOwner) && (
                      <button
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} projects={projects || []} />}
    </div>
  );
}

function UploadModal({ onClose, projects }: { onClose: () => void; projects: Project[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleUpload = async () => {
    if (!file || !title.trim()) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    if (description.trim()) formData.append('description', description.trim());
    if (projectId) formData.append('project_id', projectId);

    setUploading(true);
    setUploadProgress(0);

    try {
      await api.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        },
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ message: 'Document uploaded successfully', type: 'success' });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err as { message?: string })?.message
        || 'Failed to upload document';
      toast({ message: msg, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.zip,.rar"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={24} className="text-indigo-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Drag & drop a file here, or <span className="text-indigo-600 font-medium">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images, ZIP (max 10MB)</p>
              </>
            )}
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || !title.trim() || uploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
            >
              {uploading && <Loader2 size={16} className="animate-spin" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
