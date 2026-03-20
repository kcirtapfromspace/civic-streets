
import React, { useId } from 'react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.5,
  suffix,
  disabled = false,
  className = '',
}: NumberInputProps) {
  const id = useId();

  const clamp = (v: number): number => {
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    return parseFloat(clamped.toFixed(2));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    if (!isNaN(raw)) {
      onChange(clamp(raw));
    }
  };

  const increment = () => onChange(clamp(value + step));
  const decrement = () => onChange(clamp(value - step));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-gray-600">
        {label}
      </label>
      <div className="flex items-center">
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || (min !== undefined && value <= min)}
          aria-label={`Decrease ${label}`}
          className="px-1.5 py-1 text-gray-500 border border-r-0 border-gray-300 rounded-l-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          −
        </button>
        <input
          id={id}
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-16 px-1.5 py-1 text-sm text-center border-y border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={increment}
          disabled={disabled || (max !== undefined && value >= max)}
          aria-label={`Increase ${label}`}
          className="px-1.5 py-1 text-gray-500 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          +
        </button>
        {suffix && (
          <span className="ml-1 text-xs text-gray-500">{suffix}</span>
        )}
      </div>
    </div>
  );
}
