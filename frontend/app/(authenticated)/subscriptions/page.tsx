'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Globe, Server, Plug, Shield, Key, Database, Mail, Package, FolderKanban,
  Plus, Search, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle, MoreVertical, Edit, Trash2,
  ArrowLeft, Save, Loader2, X
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import SubscriptionModal from '@/components/subscriptions/SubscriptionModal';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Constants
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

const CATEGORY_OPTIONS = [
  { value: 'domain', label: '🌐 Domain' },
  { value: 'hosting', label: '🖥️ Hosting' },
  { value: 'api_service', label: '🔌 API Service' },
  { value: 'ssl_certificate', label: '🔒 SSL Certificate' },
  { value: 'software_license', label: '🔑 Software License' },
  { value: 'database', label: '🗄️ Database' },
  { value: 'email_service', label: '📧 Email Service' },
  { value: 'other', label: '📦 Other' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'PKR', label: 'PKR (₨)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'SAR', label: 'SAR (﷼)' },
];

const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One Time' },
];

interface ServiceCard {
  id: string;
  name: string;
  category: string;
  provider: string;
  description: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  start_date: string;
  expiry_date: string;
  alert_days_before: number;
  auto_renew: boolean;
  account_email: string;
  notes: string;
  isValid: boolean;
  isSaved: boolean;
  hasError: boolean;
  errorMessage: string;
  isCollapsed: boolean;
}

const createEmptyService = (): ServiceCard => ({
  id: crypto.randomUUID(),
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
  isValid: true,
  isSaved: false,
  hasError: false,
  errorMessage: '',
  isCollapsed: false,
});

export default function SubscriptionsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [viewMode, setViewMode] = useState<'all' | 'by_project'>('all');

  // ADD MODE STATES
  const [mode, setMode] = useState<'view' | 'add'>('view');
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // To handle the fixed bottom bar sidebar offset on desktop
  const [sidebarOffset, setSidebarOffset] = useState('left-0 md:left-[260px]');

  useEffect(() => {
    const pref = localStorage.getItem('subscription_view_preference');
    if (pref === 'all' || pref === 'by_project') {
      setViewMode(pref);
    }
  }, []);

  const handleViewChange = (vMode: 'all' | 'by_project') => {
    setViewMode(vMode);
    localStorage.setItem('subscription_view_preference', vMode);
  };

  const isAdminOrManager = user?.role === 'super_admin' || user?.role === 'manager';

  // Existing Queries
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['subscriptions-stats'],
    queryFn: () => api.get('/api/subscriptions/stats').then(res => res.data.stats),
    enabled: isAdminOrManager && mode === 'view'
  });

  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ['subscriptions', categoryFilter, statusFilter],
    queryFn: () => {
      let url = '/api/subscriptions?';
      if (categoryFilter !== 'all') url += `category=${categoryFilter}&`;
      if (statusFilter !== 'all') url += `status=${statusFilter}`;
      return api.get(url).then(res => res.data.subscriptions);
    },
    enabled: mode === 'view'
  });

  const { data: byProjectData, isLoading: isLoadingByProject } = useQuery({
    queryKey: ['subscriptions-by-project'],
    queryFn: () => api.get('/api/subscriptions/by-project').then(res => res.data.data),
    enabled: mode === 'view' && viewMode === 'by_project'
  });

  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then(res => res.data.data),
    enabled: mode === 'add' && step === 1
  });

  const { data: uniqueEmailsData } = useQuery({
    queryKey: ['subscription-emails'],
    queryFn: () => api.get('/api/subscriptions/emails').then(res => res.data.emails),
  });

  // Existing Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      toast.success('Subscription deleted');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-stats'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-by-project'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete subscription');
    }
  });

  const unlinkProjectMutation = useMutation({
    mutationFn: ({ subId, projectId }: { subId: number, projectId: number }) => api.delete(`/api/subscriptions/${subId}/projects/${projectId}`),
    onSuccess: () => {
      toast.success('Subscription unlinked from project');
      queryClient.invalidateQueries({ queryKey: ['subscriptions-by-project'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to unlink subscription');
    }
  });

  const handleUnlink = (subId: number, projectId: number) => {
    if (window.confirm('Are you sure you want to unlink this subscription from the project?')) {
      unlinkProjectMutation.mutate({ subId, projectId });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this subscription?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (sub: any) => {
    setEditingSubscription(sub);
    setIsModalOpen(true);
  };

  const filteredSubscriptions = subscriptionsData?.filter((sub: any) => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sub.provider && sub.provider.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Add Mode Functions
  const startAddMode = () => {
    setMode('add');
    setStep(1);
    setSelectedProjectId(null);
    setSelectedProjectName('');
    setServices([]);
  };

  const cancelAddMode = () => {
    if (services.length > 0) {
      if (!window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
        return;
      }
    }
    setMode('view');
  };

  const goToStep2 = () => {
    if (selectedProjectId) {
      if (selectedProjectId === 'none') {
        setSelectedProjectName('Not linked to any project');
      } else {
        const p = projectsData?.find((x: any) => x.id.toString() === selectedProjectId);
        if (p) setSelectedProjectName(p.name);
      }
      setServices([createEmptyService()]);
      setStep(2);
    }
  };

  const addServiceCard = () => {
    let newService = createEmptyService();
    if (services.length > 0) {
      const lastService = services[services.length - 1];
      newService.account_email = lastService.account_email;
    }
    setServices([...services, newService]);
  };

  const removeServiceCard = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id: string, field: string, value: any) => {
    setServices(services.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: value, hasError: false, errorMessage: '' };
        return updated;
      }
      return s;
    }));
  };

  const toggleCollapse = (id: string) => {
    setServices(services.map(s => s.id === id ? { ...s, isCollapsed: !s.isCollapsed } : s));
  };

  const validateCard = (card: ServiceCard): ServiceCard => {
    let isValid = true;
    let errorMessage = '';

    if (!card.name.trim()) {
      isValid = false;
      errorMessage = 'Name is required';
    } else if (!card.category) {
      isValid = false;
      errorMessage = 'Category is required';
    } else if (!card.start_date) {
      isValid = false;
      errorMessage = 'Start date is required';
    } else if (!card.expiry_date) {
      isValid = false;
      errorMessage = 'Expiry date is required';
    } else if (new Date(card.expiry_date) <= new Date(card.start_date)) {
      isValid = false;
      errorMessage = 'Expiry date must be after start date';
    }

    if (card.account_email) {
      const emails = card.account_email.split(',').map((e: string) => e.trim()).filter(Boolean);
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      const invalidEmails = emails.filter((e: string) => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        isValid = false;
        errorMessage = 'Invalid email address';
      }
    }

    return { ...card, isValid, hasError: !isValid, errorMessage };
  };

  const handleSaveAll = async () => {
    // Validate first
    const validatedServices = services.map(validateCard);
    
    setServices(validatedServices);
    
    if (validatedServices.some(s => !s.isValid)) {
      // scroll to first invalid card
      const firstInvalidId = validatedServices.find(s => !s.isValid)?.id;
      if (firstInvalidId) {
        const el = document.getElementById(`service-card-${firstInvalidId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSaving(true);
    let allSuccess = true;
    let anySuccess = false;

    const newServices = [...validatedServices];

    const promises = newServices.map(async (service, index) => {
      if (service.isSaved) return true; // skip already saved in case of retry
      try {
        const payload = {
          name: service.name,
          category: service.category,
          provider: service.provider,
          description: service.description,
          cost: Number(service.cost),
          currency: service.currency,
          billing_cycle: service.billing_cycle,
          start_date: service.start_date,
          expiry_date: service.expiry_date,
          alert_days_before: Number(service.alert_days_before),
          auto_renew: service.auto_renew,
          account_email: service.account_email,
          notes: service.notes,
          linked_project_ids: selectedProjectId === 'none' ? [] : [Number(selectedProjectId)]
        };
        await api.post('/api/subscriptions', payload);
        newServices[index] = { ...newServices[index], isSaved: true, hasError: false };
        anySuccess = true;
        return true;
      } catch (err: any) {
        allSuccess = false;
        newServices[index] = { 
          ...newServices[index], 
          hasError: true, 
          errorMessage: err.response?.data?.message || 'Failed to save subscription',
          isCollapsed: false
        };
        return false;
      }
    });

    await Promise.all(promises);
    
    setServices([...newServices]);
    setIsSaving(false);

    if (allSuccess) {
      toast.success(`${newServices.length} subscription(s) saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-stats'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-by-project'] });
      if (selectedProjectId !== 'none') {
        setViewMode('by_project');
      }
      setMode('view');
    } else if (anySuccess) {
      toast.error('Some subscriptions failed to save. Please review and retry.');
    } else {
      toast.error('Failed to save subscriptions. Please check the errors and try again.');
    }
  };

  // Render view mode
  if (mode === 'view') {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
            <p className="text-gray-500">Track domains, hosting, APIs, and other recurring services</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button 
                onClick={() => handleViewChange('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📋 All
              </button>
              <button 
                onClick={() => handleViewChange('by_project')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'by_project' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📁 By Project
              </button>
            </div>
            {isAdminOrManager && (
              <button 
                onClick={startAddMode}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={20} />
                Add Subscriptions
              </button>
            )}
          </div>
        </div>

        {isAdminOrManager && statsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${statsData.expiring_this_week > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Expiring This Week</h3>
                <Clock size={20} className={statsData.expiring_this_week > 0 ? 'text-red-500' : 'text-gray-400'} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${statsData.expiring_this_week > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {statsData.expiring_this_week}
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${statsData.expiring_this_month > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Expiring This Month</h3>
                <Calendar size={20} className={statsData.expiring_this_month > 0 ? 'text-yellow-600' : 'text-gray-400'} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${statsData.expiring_this_month > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>
                {statsData.expiring_this_month}
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${statsData.already_expired > 0 ? 'bg-red-100 border-red-300' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Already Expired</h3>
                <AlertTriangle size={20} className={statsData.already_expired > 0 ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <p className={`text-2xl font-bold mt-2 ${statsData.already_expired > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {statsData.already_expired}
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-white border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Monthly Cost</h3>
                <RefreshCw size={20} className="text-gray-400" />
              </div>
              <p className="text-2xl font-bold mt-2 text-gray-900">
                ${statsData.total_monthly_cost?.toFixed(2) || '0.00'}/mo
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search subscriptions..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label.replace(/[^a-zA-Z\s]/g, '').trim()}</option>
            ))}
          </select>
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <RefreshCw className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
            <Package size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No subscriptions found</h3>
            <p className="text-gray-500 mt-2">
              Add hosting, domains, or API subscriptions to get expiry reminders.
            </p>
            {isAdminOrManager && (
              <button 
                onClick={startAddMode}
                className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Subscription
              </button>
            )}
          </div>
        ) : viewMode === 'all' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Subscription</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Cost</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Linked Projects</th>
                    {isAdminOrManager && <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSubscriptions.map((sub: any) => {
                    const Icon = CATEGORY_ICONS[sub.category as keyof typeof CATEGORY_ICONS] || Package;
                    let badgeClass = 'bg-green-100 text-green-800';
                    let badgeText = `${sub.days_remaining} days left`;

                    if (sub.is_expired || sub.days_remaining < 0) {
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
                      <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Icon size={20} className="text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 flex items-center gap-2">
                                {sub.name}
                                {!!sub.auto_renew && <RefreshCw size={14} className="text-indigo-500" />}
                              </div>
                              <div className="text-sm text-gray-500">{sub.provider || sub.category.replace('_', ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {sub.currency === 'USD' ? '$' : sub.currency} {Number(sub.cost).toFixed(2)}
                          <span className="text-gray-500 block text-xs capitalize">/{sub.billing_cycle.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                              {badgeText}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(sub.expiry_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {sub.linked_projects?.slice(0, 3).map((p: any) => (
                              <span key={p.id} className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs border border-indigo-100">
                                {p.name}
                              </span>
                            ))}
                            {sub.linked_projects?.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                                +{sub.linked_projects.length - 3}
                              </span>
                            )}
                            {(!sub.linked_projects || sub.linked_projects.length === 0) && (
                              <span className="text-sm text-gray-400 italic">None</span>
                            )}
                          </div>
                        </td>
                        {isAdminOrManager && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleEdit(sub)}
                                className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(sub.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {isLoadingByProject ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              <>
                {byProjectData?.grouped?.map((group: any) => (
                  <div key={group.project_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <FolderKanban className="text-indigo-500" size={24} />
                        <h2 className="text-lg font-bold text-gray-900">Project: {group.project_name}</h2>
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                          {group.subscriptions.length} subscriptions
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {group.subscriptions.map((sub: any) => {
                        const Icon = CATEGORY_ICONS[sub.category as keyof typeof CATEGORY_ICONS] || Package;
                        let badgeClass = 'bg-green-100 text-green-800';
                        let badgeText = `${sub.days_remaining} days left`;

                        if (sub.is_expired || sub.days_remaining < 0) {
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
                          <div key={sub.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                <Icon size={20} className="text-gray-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {sub.name}
                                  {!!sub.auto_renew && <RefreshCw size={14} className="text-indigo-500" />}
                                </div>
                                <div className="text-sm text-gray-500">{sub.provider || sub.category.replace('_', ' ')}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-sm text-gray-900">
                                {sub.currency === 'USD' ? '$' : sub.currency} {Number(sub.cost).toFixed(2)}
                                <span className="text-gray-500 text-xs capitalize">/{sub.billing_cycle.replace('_', ' ')}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1 w-32">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                  {badgeText}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Exp: {format(new Date(sub.expiry_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {isAdminOrManager && (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleEdit(sub)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => handleUnlink(sub.id, group.project_id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {byProjectData?.unlinked?.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                    <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-red-500" size={24} />
                        <h2 className="text-lg font-bold text-gray-900">⚠️ Unlinked Subscriptions</h2>
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                          {byProjectData.unlinked.length} subscriptions
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {byProjectData.unlinked.map((sub: any) => {
                        const Icon = CATEGORY_ICONS[sub.category as keyof typeof CATEGORY_ICONS] || Package;
                        let badgeClass = 'bg-green-100 text-green-800';
                        let badgeText = `${sub.days_remaining} days left`;

                        if (sub.is_expired || sub.days_remaining < 0) {
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
                          <div key={sub.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-gray-100 rounded-lg">
                                <Icon size={20} className="text-gray-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {sub.name}
                                  {!!sub.auto_renew && <RefreshCw size={14} className="text-indigo-500" />}
                                </div>
                                <div className="text-sm text-gray-500">{sub.provider || sub.category.replace('_', ' ')}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-sm text-gray-900">
                                {sub.currency === 'USD' ? '$' : sub.currency} {Number(sub.cost).toFixed(2)}
                                <span className="text-gray-500 text-xs capitalize">/{sub.billing_cycle.replace('_', ' ')}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1 w-32">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                                  {badgeText}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Exp: {format(new Date(sub.expiry_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {isAdminOrManager && (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleEdit(sub)} className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium">
                                    Link to Project
                                  </button>
                                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {isModalOpen && (
          <SubscriptionModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            subscription={editingSubscription}
            preselectedProject={null}
          />
        )}
      </div>
    );
  }

  // ADD MODE Render
  return (
    <div className="min-h-full bg-gray-50 pb-32">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={step === 1 ? cancelAddMode : () => setStep(1)} 
              className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {step === 1 ? 'Add Subscriptions' : 'Add Services'}
            </h1>
          </div>
          {step === 2 && (
            <button
              onClick={addServiceCard}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Add Service
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col items-center max-w-lg mx-auto pt-12">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <FolderKanban className="text-indigo-600" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
                Which project are these subscriptions for?
              </h2>
              <p className="text-center text-gray-500 mb-8">
                Select the project to link these new subscriptions.
              </p>

              {isLoadingProjects ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-indigo-600" /></div>
              ) : (
                <select 
                  className="w-full p-3 border border-gray-300 rounded-xl bg-white mb-6 focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="" disabled>Select a project...</option>
                  <option value="none">🔗 Not linked to any project</option>
                  <optgroup label="Active Projects">
                    {projectsData?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
                    ))}
                  </optgroup>
                </select>
              )}

              <button
                onClick={goToStep2}
                disabled={!selectedProjectId}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-gray-500">Adding subscriptions for:</span>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-medium text-sm rounded-full">
                {selectedProjectName}
              </span>
            </div>

            {services.map((service, index) => {
              const Icon = CATEGORY_ICONS[service.category as keyof typeof CATEGORY_ICONS] || Package;
              return (
                <div 
                  key={service.id} 
                  id={`service-card-${service.id}`}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${service.hasError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'}`}
                >
                  <div 
                    className="px-6 py-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleCollapse(service.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Icon size={20} className="text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {service.name || `Service #${index + 1}`}
                        </h3>
                        {service.isCollapsed && service.provider && (
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            {service.provider} 
                            {service.expiry_date && <span>• Expires: {format(new Date(service.expiry_date), 'dd MMM yyyy')}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {service.isSaved && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded">
                          <CheckCircle size={14} /> Saved
                        </span>
                      )}
                      {service.hasError && (
                        <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                          <AlertTriangle size={14} /> Error
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeServiceCard(service.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove service"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {!service.isCollapsed && (
                    <div className="p-6">
                      {service.hasError && service.errorMessage && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                          <p>{service.errorMessage}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                              <select 
                                value={service.category}
                                onChange={e => updateService(service.id, 'category', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              >
                                {CATEGORY_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                              <input 
                                type="text" 
                                value={service.name}
                                onChange={e => updateService(service.id, 'name', e.target.value)}
                                placeholder="e.g. tntinnovations.com"
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${service.hasError && !service.name.trim() ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'}`}
                                disabled={service.isSaved}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                              <input 
                                type="text" 
                                value={service.provider}
                                onChange={e => updateService(service.id, 'provider', e.target.value)}
                                placeholder="e.g. GoDaddy, AWS"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Account / Alert Emails</label>
                              <input 
                                type="text" 
                                list={`saved-emails-${service.id}`}
                                value={service.account_email}
                                onChange={e => updateService(service.id, 'account_email', e.target.value)}
                                placeholder="admin@company.com, alerts@company.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              />
                              <datalist id={`saved-emails-${service.id}`}>
                                {uniqueEmailsData?.map((email: string) => (
                                  <option key={email} value={email} />
                                ))}
                              </datalist>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                              <input 
                                type="date" 
                                value={service.start_date}
                                onChange={e => updateService(service.id, 'start_date', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${service.hasError && !service.start_date ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'}`}
                                disabled={service.isSaved}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                              <input 
                                type="date" 
                                value={service.expiry_date}
                                onChange={e => updateService(service.id, 'expiry_date', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${service.hasError && (!service.expiry_date || new Date(service.expiry_date) <= new Date(service.start_date)) ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'}`}
                                disabled={service.isSaved}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                              <input 
                                type="number" 
                                value={service.cost}
                                onChange={e => updateService(service.id, 'cost', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                              <select 
                                value={service.currency}
                                onChange={e => updateService(service.id, 'currency', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              >
                                {CURRENCY_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Cycle</label>
                              <select 
                                value={service.billing_cycle}
                                onChange={e => updateService(service.id, 'billing_cycle', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              >
                                {BILLING_CYCLE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Days Before</label>
                              <input 
                                type="number" 
                                value={service.alert_days_before}
                                onChange={e => updateService(service.id, 'alert_days_before', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                disabled={service.isSaved}
                              />
                            </div>
                            <div className="flex items-center">
                              <label className="flex items-center gap-2 mt-6 cursor-pointer group">
                                <div className="relative">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={service.auto_renew}
                                    onChange={e => updateService(service.id, 'auto_renew', e.target.checked)}
                                    disabled={service.isSaved}
                                  />
                                  <div className={`block w-10 h-6 rounded-full transition-colors ${service.auto_renew ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${service.auto_renew ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                  Auto Renew
                                </span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea 
                              value={service.notes}
                              onChange={e => updateService(service.id, 'notes', e.target.value)}
                              placeholder="Any additional details..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                              disabled={service.isSaved}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-center pt-4">
              <button
                onClick={addServiceCard}
                className="flex items-center gap-2 px-6 py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl font-medium transition-colors"
              >
                <Plus size={18} /> Add Another Service
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUMMARY BAR */}
      <div className={`fixed bottom-0 ${sidebarOffset} right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg z-40 transition-all duration-300`}>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {services.length} service(s) ready to save
          </span>
          {selectedProjectId && selectedProjectId !== 'none' && (
            <span className="text-sm text-indigo-600 font-medium hidden md:inline-flex items-center gap-1">
              → {selectedProjectName}
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={cancelAddMode}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveAll}
            disabled={isSaving || services.length === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save All ({services.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
