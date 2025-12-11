import React, { memo, useCallback } from 'react';

interface ToggleProps {
  labelLeft: string;
  labelRight: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle = memo<ToggleProps>(({ labelLeft, labelRight, value, onChange }) => {
  const handleToggle = useCallback(() => {
    onChange(!value);
  }, [value, onChange]);

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${!value ? 'text-gray-900' : 'text-gray-500'}`}>{labelLeft}</span>
      <button
        type="button"
        className={`${
          value ? 'bg-indigo-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 min-w-[2.75rem] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={value}
        onClick={handleToggle}
      >
        <span
          aria-hidden="true"
          className={`${
            value ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 min-w-[1.25rem] min-h-[1.25rem] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
      <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${value ? 'text-gray-900' : 'text-gray-500'}`}>{labelRight}</span>
    </div>
  );
});

Toggle.displayName = 'Toggle';
