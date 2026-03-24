
import React, { useMemo } from 'react';
import ReactDOMServer from 'react-dom/server';
import type { StreetSegment, ValidationResult, RenderMode } from '@/lib/types';
import { generateAltText } from './alt-text';
import { ElementRect } from './components/ElementRect';
import { DimensionLabel } from './components/DimensionLabel';
import { ValidationOverlay } from './components/ValidationOverlay';
import { StreetLabel } from './components/StreetLabel';
import {
  PX_PER_FOOT,
  DISPLAY_HEIGHT,
  EXPORT_HEIGHT,
  ELEMENT_Y_OFFSET,
  ELEMENT_RECT_HEIGHT,
} from './constants';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CrossSectionSVGProps {
  street: StreetSegment;
  validationResults?: ValidationResult[];
  mode?: RenderMode;
  onElementClick?: (id: string) => void;
  selectedElementId?: string | null;
  showDimensions?: boolean;
  showValidation?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helper: build validation index                                     */
/* ------------------------------------------------------------------ */

function buildValidationMap(
  validationResults: ValidationResult[] | undefined,
): Map<string, ValidationResult[]> {
  const map = new Map<string, ValidationResult[]>();
  if (!validationResults) return map;
  for (const v of validationResults) {
    const list = map.get(v.elementId);
    if (list) {
      list.push(v);
    } else {
      map.set(v.elementId, [v]);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Hover styles (injected into SVG for display mode)                  */
/* ------------------------------------------------------------------ */

const HOVER_STYLES = `
  .element-hover-rect { transition: opacity 0.15s ease; }
  g[role="button"]:hover .element-hover-rect { opacity: 0.08 !important; }
  g[role="button"]:focus { outline: none; }
  g[role="button"]:focus-visible > rect:first-of-type {
    stroke: #1565C0;
    stroke-width: 2.5;
  }
`;

/* ------------------------------------------------------------------ */
/*  CrossSectionSVG — Main component                                   */
/* ------------------------------------------------------------------ */

export function CrossSectionSVG({
  street,
  validationResults,
  mode = 'display',
  onElementClick,
  selectedElementId,
  showDimensions = true,
  showValidation = true,
}: CrossSectionSVGProps) {
  const isDisplay = mode === 'display';

  // Compute total SVG pixel width from street ROW width
  const svgWidth = street.totalROWWidth * PX_PER_FOOT;
  const svgHeight = isDisplay ? DISPLAY_HEIGHT : EXPORT_HEIGHT;

  // Build element-to-validation lookup
  const validationMap = useMemo(
    () => buildValidationMap(validationResults),
    [validationResults],
  );

  // Alt text for accessibility
  const altText = useMemo(
    () => generateAltText(street, validationResults),
    [street, validationResults],
  );

  // Compute x-offsets for each element (left-to-right layout)
  const elementLayouts = useMemo(() => {
    return street.elements.reduce<{
      layouts: Array<{ element: StreetSegment['elements'][number]; xOffset: number }>;
      nextXOffset: number;
    }>(
      (acc, element) => ({
        layouts: [
          ...acc.layouts,
          { element, xOffset: acc.nextXOffset },
        ],
        nextXOffset: acc.nextXOffset + element.width * PX_PER_FOOT,
      }),
      { layouts: [], nextXOffset: 0 },
    ).layouts;
  }, [street.elements]);

  // Ground line Y position (bottom of element rects)
  const groundY = ELEMENT_Y_OFFSET + ELEMENT_RECT_HEIGHT;

  // Total element width vs ROW width — if elements don't fill the ROW,
  // center them within the SVG
  const totalElementWidth = street.elements.reduce((sum, el) => sum + el.width, 0);
  const leftPadding = Math.max(0, (street.totalROWWidth - totalElementWidth) * PX_PER_FOOT / 2);

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={altText}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      {/* Inject hover styles for display mode */}
      {isDisplay && <style>{HOVER_STYLES}</style>}

      {/* Background */}
      <rect
        x={0}
        y={0}
        width={svgWidth}
        height={svgHeight}
        fill="#FAFAFA"
      />

      {/* Street header label */}
      <StreetLabel street={street} svgWidth={svgWidth} />

      {/* Element group — translated for centering if needed */}
      <g transform={leftPadding > 0 ? `translate(${leftPadding}, 0)` : undefined}>
        {/* Ground line */}
        <line
          x1={0}
          y1={groundY}
          x2={totalElementWidth * PX_PER_FOOT}
          y2={groundY}
          stroke="#9E9E9E"
          strokeWidth={1}
        />

        {/* Render each element */}
        {elementLayouts.map(({ element, xOffset }) => (
          <React.Fragment key={element.id}>
            {/* Element rectangle */}
            <ElementRect
              element={element}
              xOffset={xOffset}
              mode={mode}
              isSelected={selectedElementId === element.id}
              onClick={onElementClick}
            />

            {/* Dimension label below element */}
            {showDimensions && (
              <DimensionLabel element={element} xOffset={xOffset} />
            )}

            {/* Validation overlay */}
            {showValidation && validationMap.has(element.id) && (
              <ValidationOverlay
                validations={validationMap.get(element.id)!}
                elementWidth={element.width}
                elementType={element.type}
                xOffset={xOffset}
                mode={mode}
              />
            )}
          </React.Fragment>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Static SVG export (for PDF embedding via WS3)                      */
/* ------------------------------------------------------------------ */

/**
 * Renders a complete SVG string with embedded styles for static/PDF use.
 * No interactive elements — pure visual output.
 */
export function renderToStaticSVG(
  street: StreetSegment,
  validationResults?: ValidationResult[],
): string {
  const svgMarkup = ReactDOMServer.renderToStaticMarkup(
    <CrossSectionSVG
      street={street}
      validationResults={validationResults}
      mode="export"
      showDimensions={true}
      showValidation={true}
    />,
  );

  return svgMarkup;
}
