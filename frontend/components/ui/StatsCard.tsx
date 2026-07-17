'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  iconBg?: string;
  iconColor?: string;
}

export default function StatsCard({ icon: Icon, label, value, iconBg = 'bg-indigo-50', iconColor = 'text-indigo-600' }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`p-2.5 sm:p-3 rounded-lg ${iconBg}`}>
          <Icon size={20} className={`${iconColor} sm:text-inherit`} />
        </div>
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}
