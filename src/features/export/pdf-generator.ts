// WS3: PDF report generator
import type { StreetSegment, ValidationResult } from '@/lib/types';

export async function generatePDF(
  currentStreet: StreetSegment,
  beforeStreet: StreetSegment | null,
  validationResults: ValidationResult[],
): Promise<Blob> {
  // WS3 implements: @react-pdf/renderer based PDF with
  // - Cross-section image (via renderToStaticSVG)
  // - Width table
  // - Standards citations with page numbers
  // - Disclaimer language
  void currentStreet;
  void beforeStreet;
  void validationResults;
  throw new Error('Not implemented — WS3');
}
