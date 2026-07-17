'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

type Log = {
  id: number;
  user_name: string;
  action: string;
  entity_type: string;
  created_at: string;
};

export default function ActivityPage() {
  useEffect(() => { document.title = 'Activity — TNT Pulse'; }, []);
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      const res = await api.get('/api/activity');
      return res.data.data.logs as Log[];
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        {[1,2,3,4,5].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Activity Log</h1>
      <div className="space-y-3">
        {data?.length === 0 && (
          <p className="text-gray-500">No activity recorded yet.</p>
        )}
        {data?.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
              {log.user_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">{log.user_name}</span>
                {' '}{log.action.replace(/_/g, ' ')}{' '}
                <span className="text-gray-400">on {log.entity_type}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
