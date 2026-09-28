// Keep the PDF renderer lazy: importing it eagerly breaks SSR and bloats the main bundle.
import type { DiscussionBriefContext, StreetSegment, ValidationResult } from '@/lib/types';
import { loadBriefPhotos } from './pdf-evidence';

/** Generate a discussion brief with concept drawings and a scoped technical appendix. */
export async function generatePDF(
  currentStreet: StreetSegment,
  beforeStreet: StreetSegment | null,
  validationResults: ValidationResult[],
  briefContext?: DiscussionBriefContext,
  validationStatus: 'idle' | 'pending' | 'complete' | 'error' = 'complete',
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const { StreetReportDocument } = await import('./pdf-document');
  const photos = await loadBriefPhotos(briefContext);
  const document = StreetReportDocument({
    currentStreet,
    beforeStreet,
    validationResults,
    briefContext,
    validationStatus,
    photos,
    generatedAt: Date.now(),
  });
  return pdf(document).toBlob();
}

/** Export evidence and a requested next step without inventing a street design. */
export async function generateObservationPDF(briefContext: DiscussionBriefContext, location?: { name: string; address?: string; lat?: number; lng?: number }): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const { ObservationBriefDocument } = await import('./pdf-document');
  const photos = await loadBriefPhotos(briefContext);
  return pdf(ObservationBriefDocument({ briefContext, photos, location, generatedAt: Date.now() })).toBlob();
}
