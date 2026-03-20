import React, { useState, useCallback } from 'react';

type VoteState = 'up' | 'down' | null;

interface VoteButtonProps {
  upvotes: number;
  downvotes: number;
  /** Horizontal layout for compact cards */
  horizontal?: boolean;
  className?: string;
}

export function VoteButton({
  upvotes,
  downvotes,
  horizontal = false,
  className = '',
}: VoteButtonProps) {
  const [vote, setVote] = useState<VoteState>(null);

  // Optimistic count
  const netCount =
    upvotes -
    downvotes +
    (vote === 'up' ? 1 : 0) +
    (vote === 'down' ? -1 : 0);

  const handleUpvote = useCallback(() => {
    setVote((prev) => (prev === 'up' ? null : 'up'));
  }, []);

  const handleDownvote = useCallback(() => {
    setVote((prev) => (prev === 'down' ? null : 'down'));
  }, []);

  const containerClass = horizontal
    ? 'flex flex-row items-center gap-1'
    : 'flex flex-col items-center gap-0.5';

  return (
    <div className={`${containerClass} ${className}`}>
      <button
        type="button"
        onClick={handleUpvote}
        aria-label="Upvote"
        aria-pressed={vote === 'up'}
        className={`p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          vote === 'up'
            ? 'text-green-600 bg-green-50'
            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={vote === 'up' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>

      <span
        className={`text-sm font-semibold tabular-nums min-w-[1.5rem] text-center ${
          vote === 'up'
            ? 'text-green-600'
            : vote === 'down'
              ? 'text-red-500'
              : 'text-gray-700'
        }`}
        aria-label={`${netCount} votes`}
      >
        {netCount}
      </span>

      <button
        type="button"
        onClick={handleDownvote}
        aria-label="Downvote"
        aria-pressed={vote === 'down'}
        className={`p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          vote === 'down'
            ? 'text-red-500 bg-red-50'
            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={vote === 'down' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
