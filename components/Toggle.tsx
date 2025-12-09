import React from 'react';

interface ToggleProps {
  labelLeft: string;
  labelRight: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ labelLeft, labelRight, value, onChange }) => {
  const handleToggle = () => {
    onChange(!value);
  };

  return (
    <div className="flex items-center space-x-2">
      <span className={`text-sm font-medium ${!value ? 'text-gray-900' : 'text-gray-500'}`}>{labelLeft}</span>
      <button
        type="button"
        className={`${
          value ? 'bg-indigo-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 md:h-6 md:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={value}
        onClick={handleToggle}
      >
        <span
          aria-hidden="true"
          className={`${
            value ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 md:h-5 md:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
      <span className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-500'}`}>{labelRight}</span>
    </div>
  );
};
