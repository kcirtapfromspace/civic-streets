'use client';

import React from 'react';
import type { CrossSectionElement } from '@/lib/types';
import {
  PX_PER_FOOT,
  ELEMENT_Y_OFFSET,
  ELEMENT_RECT_HEIGHT,
  FONT,
} from '../constants';

export interface DimensionLabelProps {
  element: CrossSectionElement;
  xOffset: number;
}

/**
 * Renders a width dimension annotation below an element.
 * Pattern: |<--- 10' --->|
 * Uses extension lines and centered text.
 */
export const DimensionLabel = React.memo(function DimensionLabel({
  element,
  xOffset,
}: DimensionLabelProps) {
  const widthPx = element.width * PX_PER_FOOT;
  const y = ELEMENT_Y_OFFSET + ELEMENT_RECT_HEIGHT + 18;
  const lineY = y + 2;

  // Don't render if too narrow to be legible
  if (widthPx < 16) return null;

  const leftX = xOffset;
  const rightX = xOffset + widthPx;
  const centerX = xOffset + widthPx / 2;

  // Arrow inset from edges
  const arrowInset = Math.min(4, widthPx * 0.1);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {/* Left tick mark */}
      <line
        x1={leftX}
        y1={lineY - 5}
        x2={leftX}
        y2={lineY + 5}
        stroke="#616161"
        strokeWidth={0.75}
      />

      {/* Right tick mark */}
      <line
        x1={rightX}
        y1={lineY - 5}
        x2={rightX}
        y2={lineY + 5}
        stroke="#616161"
        strokeWidth={0.75}
      />

      {/* Left extension line with arrow */}
      <line
        x1={leftX + arrowInset}
        y1={lineY}
        x2={centerX - (widthPx > 50 ? 18 : 10)}
        y2={lineY}
        stroke="#616161"
        strokeWidth={0.75}
      />
      {/* Left arrowhead */}
      <polyline
        points={`${leftX + arrowInset + 4},${lineY - 2.5} ${leftX + arrowInset},${lineY} ${leftX + arrowInset + 4},${lineY + 2.5}`}
        fill="none"
        stroke="#616161"
        strokeWidth={0.75}
      />

      {/* Right extension line with arrow */}
      <line
        x1={centerX + (widthPx > 50 ? 18 : 10)}
        y1={lineY}
        x2={rightX - arrowInset}
        y2={lineY}
        stroke="#616161"
        strokeWidth={0.75}
      />
      {/* Right arrowhead */}
      <polyline
        points={`${rightX - arrowInset - 4},${lineY - 2.5} ${rightX - arrowInset},${lineY} ${rightX - arrowInset - 4},${lineY + 2.5}`}
        fill="none"
        stroke="#616161"
        strokeWidth={0.75}
      />

      {/* Dimension text */}
      <text
        x={centerX}
        y={lineY + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#424242"
        fontSize={FONT.dimensionSize}
        fontFamily={FONT.family}
        fontWeight={500}
      >
        {element.width}&apos;
      </text>
    </g>
  );
});

DimensionLabel.displayName = 'DimensionLabel';
