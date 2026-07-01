'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Download, Save, AlertTriangle, Mail, ShieldAlert, Plus, ToggleLeft, ToggleRight, Edit3, Trash2, AlertOctagon } from 'lucide-react';
import EscalationRuleModal from '@/components/settings/EscalationRuleModal';
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

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['escalation-rules'],
    queryFn: async () => {
      const res = await api.get('/api/escalation-rules');
      return res.data.rules;
    },
    enabled: isAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      await api.patch(`/api/escalation-rules/${ruleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      await api.delete(`/api/escalation-rules/${ruleId}`);
    },
    onSuccess: () => {
      toast({ message: 'Rule deleted', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
      setDeleteConfirmId(null);
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="space-y-4">
          {isAdmin && (
            <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4 pb-4 border-b border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input {...profileForm.register('name')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                {profileForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.name.message}</p>}
              </div>
              <button type="submit" disabled={profileMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg">
                {profileMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                <Save size={16} /> Save Changes
              </button>
            </form>
          )}
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
        </div>
      </div>

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

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Alert Escalation Rules</h2>
              <p className="text-sm text-gray-500 mt-1">
                Configure when and how often alerts are sent for project deadlines and subscription expiry. These rules apply globally.
              </p>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
              >
                <Plus size={16} /> Add Rule
              </button>
            )}
          </div>

          {rulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !rulesData || rulesData.length === 0 ? (
            <div className="text-center py-8">
              <AlertOctagon size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900">No escalation rules configured</p>
              <p className="text-xs text-gray-500 mt-1">
                Default rules will apply automatically. Add custom rules to fine-tune your alert system.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rulesData.map((rule: any) => (
                <div key={rule.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{rule.rule_name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs text-gray-500">
                        Trigger: {rule.trigger_type === 'percentage' ? `${rule.threshold_value}% time elapsed` : `${rule.threshold_value} days remaining`}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rule.frequency === 'daily' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {rule.frequency === 'daily' ? 'Daily' : 'One-time'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {rule.applies_to === 'both' ? 'Projects & Subscriptions' : rule.applies_to === 'projects' ? 'Projects' : 'Subscriptions'}
                      </span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleMutation.mutate(rule.id)}
                        className={`p-1.5 rounded-lg transition-colors ${rule.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-200'}`}
                        title={rule.is_active ? 'Disable' : 'Enable'}
                      >
                        {rule.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={() => { setEditingRule(rule); setShowRuleModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(rule.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showRuleModal && (
        <EscalationRuleModal
          isOpen={showRuleModal}
          onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
          rule={editingRule}
        />
      )}

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Escalation Rule?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure? Deleting this rule means the associated alert scenario will no longer trigger notifications.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
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
