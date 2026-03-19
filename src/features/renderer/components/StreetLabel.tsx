'use client';

import React from 'react';
import type { StreetSegment } from '@/lib/types';
import { FONT } from '../constants';

export interface StreetLabelProps {
  street: StreetSegment;
  svgWidth: number;
}

/**
 * Renders the street name and total width as a header above the cross-section.
 */
export const StreetLabel = React.memo(function StreetLabel({
  street,
  svgWidth,
}: StreetLabelProps) {
  const centerX = svgWidth / 2;

  return (
    <g aria-hidden="true" pointerEvents="none">
      {/* Street name */}
      <text
        x={centerX}
        y={20}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#212121"
        fontSize={FONT.headerSize}
        fontFamily={FONT.family}
        fontWeight={600}
      >
        {street.name}
      </text>

      {/* Total ROW width + functional class */}
      <text
        x={centerX}
        y={38}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#757575"
        fontSize={FONT.dimensionSize}
        fontFamily={FONT.family}
        fontWeight={400}
      >
        {street.totalROWWidth}&apos; ROW &middot;{' '}
        {street.direction} &middot;{' '}
        {street.functionalClass.replace('-', ' ')}
      </text>
    </g>
  );
});

StreetLabel.displayName = 'StreetLabel';
