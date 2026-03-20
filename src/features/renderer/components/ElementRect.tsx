
import React, { useCallback } from 'react';
import type { CrossSectionElement, RenderMode } from '@/lib/types';
import { ELEMENT_COLORS } from '@/lib/constants';
import {
  PX_PER_FOOT,
  ELEMENT_RECT_HEIGHT,
  ELEMENT_Y_OFFSET,
  CURB_ELEVATION,
  SELECTED_STROKE_WIDTH,
  DEFAULT_STROKE_WIDTH,
  FONT,
  ROAD_LEVEL_TYPES,
  ELEVATED_TYPES,
} from '../constants';

export interface ElementRectProps {
  element: CrossSectionElement;
  xOffset: number;
  mode: RenderMode;
  isSelected: boolean;
  onClick?: (id: string) => void;
}

/**
 * Renders a single element as a colored SVG rectangle with a centered label.
 * In display mode, elements are interactive (clickable, hoverable).
 * In export mode, elements are static.
 */
export const ElementRect = React.memo(function ElementRect({
  element,
  xOffset,
  mode,
  isSelected,
  onClick,
}: ElementRectProps) {
  const colors = ELEMENT_COLORS[element.type];
  const widthPx = element.width * PX_PER_FOOT;

  // Elevated elements (sidewalk, planting strip, furniture zone) sit higher
  const isElevated = ELEVATED_TYPES.has(element.type);
  const isRoadLevel = ROAD_LEVEL_TYPES.has(element.type);
  const isCurb = element.type === 'curb';

  let yStart = ELEMENT_Y_OFFSET;
  let rectHeight = ELEMENT_RECT_HEIGHT;

  if (isElevated) {
    // Sidewalk-level elements are raised by curb height
    yStart = ELEMENT_Y_OFFSET - CURB_ELEVATION;
    rectHeight = ELEMENT_RECT_HEIGHT + CURB_ELEVATION;
  } else if (isCurb) {
    // Curb is a thin vertical transition element
    yStart = ELEMENT_Y_OFFSET - CURB_ELEVATION;
    rectHeight = ELEMENT_RECT_HEIGHT + CURB_ELEVATION;
  } else if (isRoadLevel) {
    // Road-level elements start at the standard Y offset
    yStart = ELEMENT_Y_OFFSET;
    rectHeight = ELEMENT_RECT_HEIGHT;
  }

  const strokeWidth = isSelected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH;
  const opacity = isSelected ? 0.95 : 1;
  const isInteractive = mode === 'display';
  const label = element.label ?? colors.label;

  const handleClick = useCallback(() => {
    onClick?.(element.id);
  }, [onClick, element.id]);

  return (
    <g
      data-element-id={element.id}
      data-element-type={element.type}
      {...(isInteractive
        ? {
            role: 'button',
            'aria-label': `${label}, ${element.width} feet wide`,
            tabIndex: 0,
            onClick: handleClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            },
            style: { cursor: 'pointer' },
          }
        : {
            'aria-label': `${label}, ${element.width} feet wide`,
          })}
    >
      {/* Main fill rectangle */}
      <rect
        x={xOffset}
        y={yStart}
        width={widthPx}
        height={rectHeight}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        rx={0}
        ry={0}
      />

      {/* Selection highlight overlay */}
      {isSelected && (
        <rect
          x={xOffset}
          y={yStart}
          width={widthPx}
          height={rectHeight}
          fill="none"
          stroke="#1565C0"
          strokeWidth={SELECTED_STROKE_WIDTH + 1}
          strokeDasharray="none"
          pointerEvents="none"
        />
      )}

      {/* Hover highlight (display mode only, via CSS class) */}
      {isInteractive && (
        <rect
          x={xOffset}
          y={yStart}
          width={widthPx}
          height={rectHeight}
          fill="white"
          opacity={0}
          className="element-hover-rect"
          pointerEvents="all"
        >
          <title>{`${label}: ${element.width}' wide`}</title>
        </rect>
      )}

      {/* Element label — centered in the rectangle */}
      {widthPx > 30 && (
        <text
          x={xOffset + widthPx / 2}
          y={yStart + rectHeight / 2 - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={getContrastTextColor(colors.fill)}
          fontSize={widthPx < 60 ? FONT.validationSize : FONT.labelSize}
          fontFamily={FONT.family}
          fontWeight={500}
          pointerEvents="none"
        >
          {label}
        </text>
      )}

      {/* Width in feet — below the label */}
      {widthPx > 20 && (
        <text
          x={xOffset + widthPx / 2}
          y={yStart + rectHeight / 2 + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={getContrastTextColor(colors.fill)}
          fontSize={FONT.validationSize}
          fontFamily={FONT.family}
          fontWeight={400}
          opacity={0.8}
          pointerEvents="none"
        >
          {element.width}&apos;
        </text>
      )}
    </g>
  );
});

ElementRect.displayName = 'ElementRect';

/**
 * Simple contrast check — returns white text for dark fills, dark text for light fills.
 */
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Relative luminance approximation
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#212121' : '#FFFFFF';
}
