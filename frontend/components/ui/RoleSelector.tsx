import React, { useState, useEffect } from 'react';

interface RoleSelectorProps {
  value: string;
  onChange: (role: string) => void;
  label?: string;
}

const PREDEFINED_ROLES = [
  'Project Manager',
  'Lead Developer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'UI/UX Designer',
  'Graphic Designer',
  'QA Engineer',
  'DevOps Engineer',
  'AI/ML Engineer',
  'Intern',
  'Other'
];

export default function RoleSelector({ value, onChange, label }: RoleSelectorProps) {
  // Check if current value is in predefined list
  const isPredefined = PREDEFINED_ROLES.slice(0, -1).includes(value);
  
  // If value exists but not in list, it must be a custom role
  const [showCustom, setShowCustom] = useState(!isPredefined && value !== '');
  const [customValue, setCustomValue] = useState(!isPredefined ? value : '');

  // Initialize correctly on mount or value change
  useEffect(() => {
    const isCustom = value && !PREDEFINED_ROLES.slice(0, -1).includes(value);
    
    if (isCustom) {
      setShowCustom(true);
      setCustomValue(value);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      <select
        value={showCustom ? 'Other' : value}
        onChange={(e) => {
          if (e.target.value === 'Other') {
            setShowCustom(true);
            setCustomValue('');
            onChange('');
          } else {
            setShowCustom(false);
            setCustomValue('');
            onChange(e.target.value);
          }
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        <option value="">Select role...</option>
        {PREDEFINED_ROLES.map(role => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>

      {showCustom && (
        <input
          type="text"
          placeholder="Type custom role..."
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange(e.target.value);
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      )}
    </div>
  );
}
