
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  'aria-label'?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98] disabled:bg-blue-300 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)]',
  secondary:
    'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50 active:scale-[0.98] disabled:bg-gray-100 disabled:text-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100/80 active:scale-[0.98] disabled:text-gray-300',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:scale-[0.98] disabled:bg-red-300 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)]',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
