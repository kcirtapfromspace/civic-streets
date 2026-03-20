// Individual representative card — displays rep info with selection toggle

import React from 'react';
import type { RepInfo } from '@/lib/types';

interface RepCardProps {
  rep: RepInfo;
  selected: boolean;
  onToggle: (rep: RepInfo) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function RepCard({ rep, selected, onToggle }: RepCardProps) {
  const initials = getInitials(rep.name);

  return (
    <button
      type="button"
      onClick={() => onToggle(rep)}
      aria-pressed={selected}
      className={`
        w-full text-left rounded-lg border-2 p-4 transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${
          selected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Photo or initials avatar */}
        {rep.photoUrl ? (
          <img
            src={rep.photoUrl}
            alt={`Photo of ${rep.name}`}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {rep.name}
            </h3>
            {selected && (
              <svg
                className="h-4 w-4 flex-shrink-0 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{rep.title}</p>

          {/* Contact info */}
          <div className="mt-2 space-y-0.5">
            {rep.email && (
              <p className="text-xs text-gray-600 truncate">
                <span className="sr-only">Email: </span>
                {rep.email}
              </p>
            )}
            {rep.phone && (
              <p className="text-xs text-gray-600">
                <span className="sr-only">Phone: </span>
                {rep.phone}
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
