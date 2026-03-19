// WS2: SVG Renderer — main cross-section component
'use client';

import type { StreetSegment, ValidationResult, RenderMode } from '@/lib/types';

export interface CrossSectionSVGProps {
  street: StreetSegment;
  validationResults?: ValidationResult[];
  mode?: RenderMode;
  onElementClick?: (id: string) => void;
  selectedElementId?: string | null;
  showDimensions?: boolean;
  showValidation?: boolean;
}

export function CrossSectionSVG(_props: CrossSectionSVGProps) {
  // WS2 implements: full SVG cross-section rendering
  return <svg aria-label="Street cross-section" role="img" />;
}

export function renderToStaticSVG(
  _street: StreetSegment,
  _validationResults?: ValidationResult[],
): string {
  // WS2 implements: render SVG to static string for PDF export
  throw new Error('Not implemented — WS2');
}
