'use client';

import React, { useMemo } from 'react';
import type { StreetSegment, ValidationResult, RenderMode } from '@/lib/types';
import { CrossSectionSVG } from './CrossSectionSVG';
import { FONT, PX_PER_FOOT } from './constants';

export interface BeforeAfterViewProps {
  before: StreetSegment;
  after: StreetSegment;
  /** Validation results applied to the "after" view */
  validationResults?: ValidationResult[];
  mode?: RenderMode;
}

/**
 * Renders two CrossSectionSVGs stacked vertically for before/after comparison.
 * Both views share the same horizontal scale so widths are directly comparable.
 * The wider of the two streets determines the scale.
 */
export function BeforeAfterView({
  before,
  after,
  validationResults,
  mode = 'display',
}: BeforeAfterViewProps) {
  // Use the wider ROW width for both so they line up
  const maxROW = Math.max(before.totalROWWidth, after.totalROWWidth);

  // Create normalized street objects with the same totalROWWidth
  // so both SVGs render at the same scale
  const normalizedBefore = useMemo(
    () => ({ ...before, totalROWWidth: maxROW }),
    [before, maxROW],
  );
  const normalizedAfter = useMemo(
    () => ({ ...after, totalROWWidth: maxROW }),
    [after, maxROW],
  );

  const containerWidth = maxROW * PX_PER_FOOT;

  return (
    <div
      role="group"
      aria-label={`Before and after comparison of ${before.name}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '100%' }}
    >
      {/* Before section */}
      <div>
        <div
          style={{
            fontFamily: FONT.family,
            fontSize: FONT.headerSize,
            fontWeight: 600,
            color: '#616161',
            marginBottom: '4px',
            paddingLeft: '4px',
          }}
        >
          Before
        </div>
        <CrossSectionSVG
          street={normalizedBefore}
          mode={mode}
          showDimensions={true}
          showValidation={false}
        />
      </div>

      {/* Divider */}
      <div
        aria-hidden="true"
        style={{
          borderTop: '1px dashed #BDBDBD',
          maxWidth: `${containerWidth}px`,
        }}
      />

      {/* After section */}
      <div>
        <div
          style={{
            fontFamily: FONT.family,
            fontSize: FONT.headerSize,
            fontWeight: 600,
            color: '#1565C0',
            marginBottom: '4px',
            paddingLeft: '4px',
          }}
        >
          After
        </div>
        <CrossSectionSVG
          street={normalizedAfter}
          validationResults={validationResults}
          mode={mode}
          showDimensions={true}
          showValidation={true}
        />
      </div>
    </div>
  );
}
