'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Search, FolderKanban } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee (₨)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
  { value: 'SAR', label: 'SAR — Saudi Riyal (﷼)' },
];

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One Time' },
];

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: any;
  preselectedProject: any;
}

export default function SubscriptionModal({ isOpen, onClose, subscription, preselectedProject }: SubscriptionModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!subscription;

  const [formData, setFormData] = useState({
    name: '',
    category: 'domain',
    provider: '',
    description: '',
    cost: 0,
    currency: 'USD',
    billing_cycle: 'monthly',
    start_date: '',
    expiry_date: '',
    alert_days_before: 7,
    auto_renew: false,
    account_email: '',
    notes: '',
    linked_project_ids: [] as number[]
  });

  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<any[]>([]);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then(res => res.data.data),
    enabled: isOpen
  });

  const { data: uniqueEmailsData } = useQuery({
    queryKey: ['subscription-emails'],
    queryFn: () => api.get('/api/subscriptions/emails').then(res => res.data.emails),
    enabled: isOpen
  });

  useEffect(() => {
    if (subscription) {
      setFormData({
        name: subscription.name || '',
        category: subscription.category || 'domain',
        provider: subscription.provider || '',
        description: subscription.description || '',
        cost: subscription.cost || 0,
        currency: subscription.currency || 'USD',
        billing_cycle: subscription.billing_cycle || 'monthly',
        start_date: subscription.start_date ? subscription.start_date.split('T')[0] : '',
        expiry_date: subscription.expiry_date ? subscription.expiry_date.split('T')[0] : '',
        alert_days_before: subscription.alert_days_before || 7,
        auto_renew: !!subscription.auto_renew,
        account_email: subscription.account_email || '',
        notes: subscription.notes || '',
        linked_project_ids: [] // not editing links here for existing
      });
      // In edit mode we don't edit links directly via form, we do it in detail view or separate action
    } else {
      setFormData({
        name: '', category: 'domain', provider: '', description: '', cost: 0, currency: 'USD',
        billing_cycle: 'monthly', start_date: '', expiry_date: '', alert_days_before: 7,
        auto_renew: false, account_email: '', notes: '', linked_project_ids: []
      });
      setSelectedProjects(preselectedProject ? [preselectedProject] : []);
    }
  }, [subscription, preselectedProject]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) {
        return api.put(`/api/subscriptions/${subscription.id}`, data);
      } else {
        return api.post('/api/subscriptions', data);
      }
    },
    onSuccess: () => {
      toast.success(`Subscription ${isEditing ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-stats'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'An error occurred');
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const name = target.name;
    const value = target.value;
    const type = target.type;
    const checked = target instanceof HTMLInputElement ? target.checked : undefined;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.account_email) {
      const emails = formData.account_email.split(',').map(e => e.trim()).filter(Boolean);
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      const invalidEmails = emails.filter(e => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        toast.error('Invalid email address');
        return;
      }
    }

    const submitData = { ...formData };
    if (!isEditing) {
      submitData.linked_project_ids = selectedProjects.map((p: any) => p.id);
    } else {
      delete (submitData as any).linked_project_ids;
    }
    mutation.mutate(submitData);
  };

  const toggleProject = (project: any) => {
    if (selectedProjects.find((p: any) => p.id === project.id)) {
      setSelectedProjects(prev => prev.filter((p: any) => p.id !== project.id));
    } else {
      setSelectedProjects(prev => [...prev, project]);
    }
  };

  const filteredProjects = projectsData?.filter((p: any) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) &&
    !selectedProjects.find((sp: any) => sp.id === p.id)
  ) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl my-8">
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Subscription' : 'New Subscription'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. AWS Hosting" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select name="category" value={formData.category} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="domain">Domain</option>
                  <option value="hosting">Hosting</option>
                  <option value="api_service">API Service</option>
                  <option value="ssl_certificate">SSL Certificate</option>
                  <option value="software_license">Software License</option>
                  <option value="database">Database</option>
                  <option value="email_service">Email Service</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <input type="text" name="provider" value={formData.provider} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Amazon Web Services" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Brief description"></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select name="currency" value={formData.currency || 'USD'} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm">
                    {CURRENCIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                <select name="billing_cycle" value={formData.billing_cycle || 'monthly'} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm">
                  {BILLING_CYCLES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                  <input required type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Days Before</label>
                <input type="number" name="alert_days_before" value={formData.alert_days_before} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                <p className="text-xs text-gray-500 mt-1">Get notified this many days before expiry</p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="auto_renew" name="auto_renew" checked={formData.auto_renew} onChange={handleChange} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="auto_renew" className="text-sm font-medium text-gray-700">Auto Renew</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account / Alert Emails</label>
                <input type="text" list="saved-emails-modal" name="account_email" value={formData.account_email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="email1@domain.com, email2@domain.com" />
                <datalist id="saved-emails-modal">
                  {uniqueEmailsData?.map((email: string) => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Any additional details..."></textarea>
              </div>
            </div>
          </div>

          {!isEditing && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Link Projects (Optional)</h3>
              
              {preselectedProject ? (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 w-fit mb-3">
                  <FolderKanban className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm text-indigo-700 font-medium">
                    {preselectedProject.name}
                  </span>
                  <span className="text-xs text-indigo-400">
                    (auto-linked)
                  </span>
                </div>
              ) : (
                selectedProjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedProjects.map((p: any) => (
                      <span key={p.id} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                        {p.name}
                        <button type="button" onClick={() => toggleProject(p)} className="hover:bg-indigo-200 rounded-full p-0.5">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )
              )}

              {!preselectedProject && (
                <>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search projects to link..." 
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </div>

                  {projectSearch && filteredProjects.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto bg-white shadow-sm absolute w-full max-w-xl z-10">
                      {filteredProjects.map((p: any) => (
                        <button 
                          key={p.id}
                          type="button"
                          onClick={() => {
                            toggleProject(p);
                            setProjectSearch('');
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex-shrink-0 mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={mutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
