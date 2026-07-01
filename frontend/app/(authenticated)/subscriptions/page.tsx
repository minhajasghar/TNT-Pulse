'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Globe, Server, Plug, Shield, Key, Database, Mail, Package, 
  Plus, Search, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle, MoreVertical, Edit, Trash2
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import SubscriptionModal from '@/components/subscriptions/SubscriptionModal';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

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

export default function SubscriptionsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);

  const isAdminOrManager = user?.role === 'super_admin' || user?.role === 'manager';

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['subscriptions-stats'],
    queryFn: () => api.get('/api/subscriptions/stats').then(res => res.data.stats),
    enabled: isAdminOrManager
  });

  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ['subscriptions', categoryFilter, statusFilter],
    queryFn: () => {
      let url = '/api/subscriptions?';
      if (categoryFilter !== 'all') url += `category=${categoryFilter}&`;
      if (statusFilter !== 'all') url += `status=${statusFilter}`;
      return api.get(url).then(res => res.data.subscriptions);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      toast.success('Subscription deleted');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete subscription');
    }
  });

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this subscription?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (sub: any) => {
    setEditingSubscription(sub);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingSubscription(null);
    setIsModalOpen(true);
  };

  const filteredSubscriptions = subscriptionsData?.filter((sub: any) => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sub.provider && sub.provider.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-500">Track domains, hosting, APIs, and other recurring services</p>
        </div>
        {isAdminOrManager && (
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            New Subscription
          </button>
        )}
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
          <option value="domain">Domain</option>
          <option value="hosting">Hosting</option>
          <option value="api_service">API Service</option>
          <option value="ssl_certificate">SSL Certificate</option>
          <option value="software_license">Software License</option>
          <option value="database">Database</option>
          <option value="email_service">Email Service</option>
          <option value="other">Other</option>
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
              onClick={openNewModal}
              className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add Subscription
            </button>
          )}
        </div>
      ) : (
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
                              {sub.auto_renew && <RefreshCw size={14} className="text-indigo-500" />}
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
