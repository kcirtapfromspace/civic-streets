import React from 'react';
import { Badge, Button } from '@/components/ui';
import { VoteButton } from './VoteButton';
import type { MockDesign, MockUser } from './mock-data';
import { MOCK_USERS } from './mock-data';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getUserName(authorId: string): string {
  return (
    MOCK_USERS.find((u: MockUser) => u.id === authorId)?.displayName ??
    'Anonymous'
  );
}

// ── Cross-Section Mini Preview ────────────────────────────────────────────

function CrossSectionPreview({
  elements,
}: {
  elements: MockDesign['elements'];
}) {
  return (
    <div
      className="flex h-8 rounded overflow-hidden border border-gray-200"
      aria-label="Cross-section preview"
    >
      {elements.map((el, i) => (
        <div
          key={i}
          className="relative group"
          style={{
            width: `${el.proportion * 100}%`,
            backgroundColor: el.color,
          }}
          title={`${el.name} (${Math.round(el.proportion * 100)}%)`}
        >
          {/* Tooltip visible on hover for wider segments */}
          {el.proportion >= 0.1 && (
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white/80 truncate px-0.5 leading-none">
              {el.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Design Card ───────────────────────────────────────────────────────────

interface DesignCardProps {
  design: MockDesign;
  onOpenEditor?: (designId: string) => void;
}

export function DesignCard({ design, onOpenEditor }: DesignCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <VoteButton
          upvotes={design.upvotes}
          downvotes={0}
          className="shrink-0"
        />

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {design.title}
          </h4>

          {design.address && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {design.address}
            </p>
          )}

          {/* Compliance Badges */}
          <div className="flex gap-1.5 mt-2">
            <Badge variant={design.prowagPass ? 'success' : 'error'}>
              PROWAG {design.prowagPass ? '\u2713' : '\u2717'}
            </Badge>
            <Badge variant={design.nactoPass ? 'success' : 'error'}>
              NACTO {design.nactoPass ? '\u2713' : '\u2717'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Cross-section preview */}
      <div className="mt-3">
        <CrossSectionPreview elements={design.elements} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {getUserName(design.authorId)} &middot;{' '}
          {timeAgo(design.createdAt)}
        </span>

        <Button
          variant="secondary"
          className="text-xs"
          onClick={() => onOpenEditor?.(design.id)}
        >
          Open in Editor
        </Button>
      </div>
    </div>
  );
}
