// WS3: PDF report generator — main entry point
// Uses @react-pdf/renderer to generate professional PDF reports
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { StreetSegment, ValidationResult } from '@/lib/types';
import { StreetReportDocument } from './pdf-document';

/**
 * Generate a PDF report for a street design concept.
 *
 * @param currentStreet - The current (proposed) street segment design
 * @param beforeStreet - The existing/before street segment (null if no comparison)
 * @param validationResults - Validation results from the standards engine
 * @returns A Blob containing the PDF document
 */
export async function generatePDF(
  currentStreet: StreetSegment,
  beforeStreet: StreetSegment | null,
  validationResults: ValidationResult[],
): Promise<Blob> {
  // StreetReportDocument renders a <Document> at its root, which @react-pdf/renderer
  // requires. The cast is needed because React.createElement returns
  // ReactElement<StreetReportDocumentProps> while pdf() expects ReactElement<DocumentProps>.
  // At runtime the element tree is correct.
  const document = React.createElement(StreetReportDocument, {
    currentStreet,
    beforeStreet,
    validationResults,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const blob = await pdf(document).toBlob();
  return blob;
}
