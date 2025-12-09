import React, { memo } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input = memo<InputProps>(({ label, className = '', ...props }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all ${className}`}
        {...props}
      />
    </div>
  );
});

Input.displayName = 'Input';
