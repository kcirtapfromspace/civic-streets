// Report Success View — shown after the user sends their report

import React, { useEffect, useState } from 'react';
import type { RepInfo } from '@/lib/types';
import { Button } from '@/components/ui';

interface ReportSuccessProps {
  reps: RepInfo[];
  address: string;
  onReportAnother: () => void;
}

export function ReportSuccess({
  reps,
  address,
  onReportAnother,
}: ReportSuccessProps) {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    // Trigger the check animation after mount
    const timer = setTimeout(() => setShowCheck(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const repNames = reps.map((r) => r.name).join(', ');

  const shareText = `I just contacted my local representative about street safety at ${address} using Street Copilot.`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Fallback: some browsers restrict clipboard in non-HTTPS
    }
  };

  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      {/* Animated checkmark */}
      <div
        className={`
          flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6
          transition-all duration-500 ease-out
          ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}
        `}
      >
        <svg
          className={`
            w-8 h-8 text-green-600 transition-all duration-300 delay-200
            ${showCheck ? 'opacity-100' : 'opacity-0'}
          `}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            className={showCheck ? 'animate-draw-check' : ''}
            style={{
              strokeDasharray: 24,
              strokeDashoffset: showCheck ? 0 : 24,
              transition: 'stroke-dashoffset 0.4s ease-out 0.3s',
            }}
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Message Sent
      </h2>
      <p className="text-sm text-gray-600 max-w-md mb-6">
        Your message has been prepared for{' '}
        <span className="font-medium text-gray-800">{repNames}</span>. Thank
        you for engaging with your local government.
      </p>

      {/* Share section */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-sm font-medium text-gray-700 mb-3">
          Share this with your community
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={handleCopyLink}>
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy Link
          </Button>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <svg
              className="w-4 h-4 mr-1.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="primary" onClick={onReportAnother}>
          Report Another Issue
        </Button>
      </div>
    </div>
  );
}
