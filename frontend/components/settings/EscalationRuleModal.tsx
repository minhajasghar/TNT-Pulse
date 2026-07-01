'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface EscalationRule {
  id?: number;
  rule_name: string;
  trigger_type: 'percentage' | 'fixed_days';
  threshold_value: number;
  frequency: 'once' | 'daily';
  applies_to: 'projects' | 'subscriptions' | 'both';
  is_active: boolean;
  display_order?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rule?: EscalationRule | null;
}

export default function EscalationRuleModal({ isOpen, onClose, rule }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!rule;

  const [formData, setFormData] = useState<EscalationRule>({
    rule_name: '',
    trigger_type: 'fixed_days',
    threshold_value: 7,
    frequency: 'once',
    applies_to: 'both',
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setFormData({
        rule_name: rule.rule_name,
        trigger_type: rule.trigger_type,
        threshold_value: Number(rule.threshold_value),
        frequency: rule.frequency,
        applies_to: rule.applies_to,
        is_active: rule.is_active,
      });
    } else {
      setFormData({
        rule_name: '',
        trigger_type: 'fixed_days',
        threshold_value: 7,
        frequency: 'once',
        applies_to: 'both',
        is_active: true,
      });
    }
    setErrors({});
  }, [rule, isOpen]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.rule_name.trim()) errs.rule_name = 'Rule name is required';

    if (formData.trigger_type === 'percentage') {
      const val = Number(formData.threshold_value);
      if (val < 1 || val > 100) errs.threshold_value = 'Percentage must be between 1 and 100';
    } else {
      const val = Number(formData.threshold_value);
      if (val < 0) errs.threshold_value = 'Days must be 0 or greater';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (data: EscalationRule) => {
      if (isEditing) {
        const res = await api.put(`/api/escalation-rules/${rule.id}`, data);
        return res.data;
      } else {
        const res = await api.post('/api/escalation-rules', data);
        return res.data;
      }
    },
    onSuccess: () => {
      toast({ message: `Rule ${isEditing ? 'updated' : 'created'} successfully`, type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'An error occurred';
      toast({ message: msg, type: 'error' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(formData);
  };

  const update = <K extends keyof EscalationRule>(key: K, value: EscalationRule[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const triggerLabel = formData.trigger_type === 'percentage' ? 'time elapsed' : 'remaining';
  const thresholdDesc = formData.trigger_type === 'percentage'
    ? `${formData.threshold_value}% of time has passed`
    : `${formData.threshold_value} day(s) remain`;
  const freqDesc = formData.frequency === 'once' ? 'once' : 'every day';
  const appliesDesc = formData.applies_to === 'both' ? 'projects and subscriptions' : `${formData.applies_to} only`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Escalation Rule' : 'Add Escalation Rule'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
            <input
              type="text"
              value={formData.rule_name}
              onChange={(e) => update('rule_name', e.target.value)}
              placeholder="e.g. One Week Warning"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
            {errors.rule_name && <p className="text-xs text-red-500 mt-1">{errors.rule_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trigger_type"
                  value="percentage"
                  checked={formData.trigger_type === 'percentage'}
                  onChange={() => update('trigger_type', 'percentage')}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Percentage of time elapsed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trigger_type"
                  value="fixed_days"
                  checked={formData.trigger_type === 'fixed_days'}
                  onChange={() => update('trigger_type', 'fixed_days')}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Fixed days remaining</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.trigger_type === 'percentage'
                ? 'Trigger when ___% of time has passed'
                : 'Trigger when ___ days remain'}
            </label>
            <input
              type="number"
              value={formData.threshold_value}
              onChange={(e) => update('threshold_value', Number(e.target.value))}
              min={formData.trigger_type === 'percentage' ? 1 : 0}
              max={formData.trigger_type === 'percentage' ? 100 : undefined}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
            {formData.trigger_type === 'fixed_days' && (
              <p className="text-xs text-gray-500 mt-1">Use 0 for the exact due date, negative handled automatically for overdue</p>
            )}
            {errors.threshold_value && <p className="text-xs text-red-500 mt-1">{errors.threshold_value}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="frequency"
                  value="once"
                  checked={formData.frequency === 'once'}
                  onChange={() => update('frequency', 'once')}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Send once <span className="text-gray-400">(good for early warnings)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="frequency"
                  value="daily"
                  checked={formData.frequency === 'daily'}
                  onChange={() => update('frequency', 'daily')}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Send daily <span className="text-gray-400">(good for urgent final warnings)</span></span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
            <select
              value={formData.applies_to}
              onChange={(e) => update('applies_to', e.target.value as EscalationRule['applies_to'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
            >
              <option value="both">Both (Projects & Subscriptions)</option>
              <option value="projects">Projects only</option>
              <option value="subscriptions">Subscriptions only</option>
            </select>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              This rule will alert team members <strong>{freqDesc}</strong> when <strong>{thresholdDesc}</strong> for <strong>{appliesDesc}</strong>.
              {!formData.is_active && <span className="text-red-500 block mt-1">This rule is currently disabled.</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {isEditing ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
