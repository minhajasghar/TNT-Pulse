'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Download, Save, AlertTriangle, Mail, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

const notifSchema = z.object({
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  alert_days_before_deadline: z.number().min(1).max(30),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type NotifForm = z.infer<typeof notifSchema>;

interface UserOption {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function SettingsPage() {
  useEffect(() => { document.title = 'Settings — TNT Pulse'; }, []);
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role === 'manager';
  const [exporting, setExporting] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState('');
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const { toast } = useToast();

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);
  const [transferConfirmText, setTransferConfirmText] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: allUsers } = useQuery<UserOption[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data.data;
    },
  });

  const eligibleUsers = allUsers?.filter(
    (u) => u.id !== user?.id && u.status === 'active',
  ) || [];

  const handleUpdateEmail = async () => {
    setEmailError('');
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (newEmail === user?.email) {
      setEmailError('New email must be different from current email');
      return;
    }
    setShowEmailConfirm(true);
  };

  const confirmEmailUpdate = async () => {
    if (!confirmPassword) return;
    setIsUpdatingEmail(true);
    setEmailError('');
    try {
      const res = await api.put(`/api/users/${user?.id}`, { email: newEmail, password: confirmPassword });
      const updated = res.data.data;
      setUser(updated);
      localStorage.setItem('tnt_user', JSON.stringify(updated));
      toast({ message: 'Email updated successfully', type: 'success' });
      setShowEmailConfirm(false);
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update email';
      setEmailError(msg);
    }
    setIsUpdatingEmail(false);
  };

  const handleTransfer = async () => {
    if (!transferTargetId) return;
    setIsTransferring(true);
    try {
      await api.post('/api/users/transfer-admin', { new_admin_id: transferTargetId });
      const updatedUser = { ...user!, role: 'manager' as const };
      setUser(updatedUser);
      localStorage.setItem('tnt_user', JSON.stringify(updatedUser));
      toast({ message: 'Admin rights transferred successfully. You are now a Manager.', type: 'success' });
      setShowTransferModal(false);
      setTransferTargetId(null);
      setTransferConfirmText('');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to transfer admin rights';
      toast({ message: msg, type: 'error' });
    }
    setIsTransferring(false);
  };

  const profileForm = useForm<ProfileForm>({ defaultValues: { name: user?.name || '' }, resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const notifForm = useForm<NotifForm>({ defaultValues: { email_enabled: true, in_app_enabled: true, alert_days_before_deadline: 3 } });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const res = await api.put(`/api/users/${user?.id}`, data);
      return res.data.data;
    },
    onSuccess: (data: User) => {
      setUser(data);
      profileForm.reset({ name: data.name });
    },
  });

  const notifMutation = useMutation({
    mutationFn: async (data: NotifForm) => {
      await api.put(`/api/users/${user?.id}`, data);
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/api/activity/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'activity_logs.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      //
    }
    setExporting(false);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Profile</h2>
          <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input {...profileForm.register('name')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              {profileForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex gap-2">
                <input
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                  placeholder="Enter new email"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleUpdateEmail}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
                >
                  <Mail size={16} /> Update Email
                </button>
              </div>
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
            <button type="submit" disabled={profileMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg">
              {profileMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              <Save size={16} /> Save Changes
            </button>
          </form>
        </div>
      )}

      {showEmailConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Your Password</h3>
            <p className="text-sm text-gray-600 mb-4">Confirm your password to change email.</p>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowEmailConfirm(false); setConfirmPassword(''); setEmailError(''); }}
                disabled={isUpdatingEmail}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEmailUpdate}
                disabled={isUpdatingEmail || !confirmPassword}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
              >
                {isUpdatingEmail && <Loader2 size={16} className="animate-spin" />}
                {isUpdatingEmail ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password — visible to ALL users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={passwordForm.handleSubmit(async (d) => {
          try {
            await api.put(`/api/users/${user?.id}`, { old_password: d.old_password, password: d.new_password });
            toast({ message: 'Password updated successfully', type: 'success' });
            passwordForm.reset();
          } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update password';
            toast({ message: msg, type: 'error' });
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" {...passwordForm.register('old_password')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            {passwordForm.formState.errors.old_password && <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.old_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" {...passwordForm.register('new_password')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            {passwordForm.formState.errors.new_password && <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.new_password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" {...passwordForm.register('confirm_password')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            {passwordForm.formState.errors.confirm_password && <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirm_password.message}</p>}
          </div>
          <button type="submit" disabled={passwordForm.formState.isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg">
            {passwordForm.formState.isSubmitting && <Loader2 size={16} className="animate-spin" />}
            <Save size={16} /> Update Password
          </button>
        </form>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
          <form onSubmit={notifForm.handleSubmit((d) => notifMutation.mutate(d))} className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...notifForm.register('email_enabled')} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-gray-700">Email notifications enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...notifForm.register('in_app_enabled')} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-gray-700">In-app notifications enabled</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days before deadline to send alert</label>
              <input
                type="number"
                {...notifForm.register('alert_days_before_deadline', { valueAsNumber: true })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button type="submit" disabled={notifMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg">
              {notifMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              <Save size={16} /> Save Preferences
            </button>
          </form>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-500" /> Transfer Admin Rights
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">
              Warning: This action is irreversible. You will lose Super Admin access immediately after transfer.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Super Admin</label>
              <select
                value={transferTargetId ?? ''}
                onChange={(e) => setTransferTargetId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a member...</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              disabled={!transferTargetId}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg"
            >
              Transfer Rights
            </button>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> Danger Zone
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Export the full activity audit log as a CSV file. This includes all user actions across the system.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Exporting...' : 'Export Activity Logs'}
          </button>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Are you absolutely sure?</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to transfer Super Admin rights to{' '}
              <strong>{eligibleUsers.find((u) => u.id === transferTargetId)?.name}</strong>.
              You will become a Manager immediately. This cannot be undone.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-mono font-bold">TRANSFER</span> to confirm
            </label>
            <input
              type="text"
              value={transferConfirmText}
              onChange={(e) => setTransferConfirmText(e.target.value)}
              placeholder="TRANSFER"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowTransferModal(false); setTransferConfirmText(''); }}
                disabled={isTransferring}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={isTransferring || transferConfirmText !== 'TRANSFER'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
              >
                {isTransferring && <Loader2 size={16} className="animate-spin" />}
                {isTransferring ? 'Transferring...' : 'Yes, Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
