'use client';

import React, { useState, useRef } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 100);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap pointer-events-none"
        >
          {content}
        </span>
      )}
    </span>
  );
}
