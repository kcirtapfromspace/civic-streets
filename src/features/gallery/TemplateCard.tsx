
import React from 'react';
import type { TemplateDefinition, TemplateCategory } from '@/lib/types';
import { UNITS } from '@/lib/constants';
import { Badge, Button } from '@/components/ui';

interface TemplateCardProps {
  template: TemplateDefinition;
  onApply: (template: TemplateDefinition) => void;
  locked?: boolean;
  lockLabel?: string;
  onLockedClick?: (template: TemplateDefinition) => void;
}

const CATEGORY_BADGE: Record<
  TemplateCategory,
  { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }
> = {
  'road-diet': { label: 'Road Diet', variant: 'warning' },
  'protected-bike': { label: 'Protected Bike', variant: 'success' },
  'transit-priority': { label: 'Transit Priority', variant: 'error' },
  'complete-street': { label: 'Complete Street', variant: 'info' },
  'shared-street': { label: 'Shared Street', variant: 'default' },
};

export function TemplateCard({
  template,
  onApply,
  locked = false,
  lockLabel = 'Contact Curbwise',
  onLockedClick,
}: TemplateCardProps) {
  const cat = CATEGORY_BADGE[template.category];
  const rowRange = template.applicableROWWidths;
  const minROW = Math.min(...rowRange);
  const maxROW = Math.max(...rowRange);
  const rowLabel =
    minROW === maxROW
      ? `${minROW} ${UNITS.primary}`
      : `${minROW}–${maxROW} ${UNITS.primary}`;

  return (
    <div role="group" aria-label={`${template.name} template`} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-shadow bg-white flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-800 leading-tight">
          {template.name}
        </h3>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={cat.variant}>{cat.label}</Badge>
          {locked && <Badge variant="warning">Gov</Badge>}
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-3 flex-1 line-clamp-3">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="inline-block px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs text-gray-500">ROW: {rowLabel}</span>
        <Button
          variant={locked ? 'secondary' : 'primary'}
          onClick={() =>
            locked ? onLockedClick?.(template) : onApply(template)
          }
          aria-label={
            locked
              ? `${template.name} requires municipal onboarding`
              : `Apply ${template.name} template`
          }
        >
          {locked ? lockLabel : 'Apply'}
        </Button>
      </div>
    </div>
  );
}
