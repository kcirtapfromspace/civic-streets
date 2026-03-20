// Renderer-local constants

/** Pixels per foot — controls overall SVG scale */
export const PX_PER_FOOT = 12;

/** SVG height for display mode */
export const DISPLAY_HEIGHT = 300;

/** SVG height for export mode (taller for PDF clarity) */
export const EXPORT_HEIGHT = 320;

/** SVG height for compact bottom dock on map */
export const COMPACT_DISPLAY_HEIGHT = 220;

/** Height of the element rectangles (the colored "road surface" area) */
export const ELEMENT_RECT_HEIGHT = 160;

/** Y offset where element rectangles start (leaves room for header) */
export const ELEMENT_Y_OFFSET = 60;

/** Height allocated for dimension labels below elements */
export const DIMENSION_AREA_HEIGHT = 50;

/** Curb visual elevation in pixels */
export const CURB_ELEVATION = 12;

/** Stroke width for selected element highlight */
export const SELECTED_STROKE_WIDTH = 3;

/** Default stroke width for element borders */
export const DEFAULT_STROKE_WIDTH = 1;

/** Font sizes */
export const FONT = {
  headerSize: 14,
  labelSize: 11,
  dimensionSize: 10,
  validationSize: 9,
  family: "'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const;

/** Element types that sit at "road level" (vs. elevated sidewalk level) */
export const ROAD_LEVEL_TYPES = new Set([
  'bike-lane',
  'bike-lane-protected',
  'buffer',
  'parking-lane',
  'travel-lane',
  'turn-lane',
  'transit-lane',
  'median',
]);

/** Element types that are elevated (sidewalk level) */
export const ELEVATED_TYPES = new Set([
  'sidewalk',
  'planting-strip',
  'furniture-zone',
]);
