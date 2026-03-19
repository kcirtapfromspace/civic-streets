// WS3: PDF report generator — main entry point
// @react-pdf/renderer is imported lazily to avoid SSR issues with localStorage
import type { StreetSegment, ValidationResult } from '@/lib/types';

/**
 * Generate a PDF report for a street design concept.
 * Lazily imports @react-pdf/renderer to avoid SSR/Node localStorage issues.
 */
export async function generatePDF(
  currentStreet: StreetSegment,
  beforeStreet: StreetSegment | null,
  validationResults: ValidationResult[],
): Promise<Blob> {
  const React = await import('react');
  const { pdf } = await import('@react-pdf/renderer');
  const { StreetReportDocument } = await import('./pdf-document');

  const document = React.createElement(StreetReportDocument, {
    currentStreet,
    beforeStreet,
    validationResults,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const blob = await pdf(document).toBlob();
  return blob;
}
