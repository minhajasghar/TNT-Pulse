interface BadgeProps {
  variant: 'status' | 'priority' | 'role' | 'approval';
  value: string;
}

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  on_hold: 'bg-orange-100 text-orange-700',
  todo: 'bg-gray-100 text-gray-700',
  blocked: 'bg-red-100 text-red-700',
  done: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  developer: 'bg-green-100 text-green-700',
  designer: 'bg-purple-100 text-purple-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function Badge({ variant, value }: BadgeProps) {
  const colorMap = variant === 'priority' ? priorityColors : variant === 'role' ? roleColors : statusColors;
  const color = colorMap[value] || 'bg-gray-100 text-gray-700';
  const label = value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {label}
    </span>
  );
}
