// WS1: Standards Engine — validator
// Validates a StreetSegment against NACTO/PROWAG standards
import type { StreetSegment, ValidationResult } from '@/lib/types';

export interface StandardsData {
  nacto: Record<string, unknown>;
  prowag: Record<string, unknown>;
}

export function loadStandards(): StandardsData {
  // WS1 implements: load JSON data files from data/standards/
  throw new Error('Not implemented — WS1');
}

export function validateStreet(
  street: StreetSegment,
  standards: StandardsData,
): ValidationResult[] {
  // WS1 implements: PROWAG-first constraint checking
  void street;
  void standards;
  throw new Error('Not implemented — WS1');
}
