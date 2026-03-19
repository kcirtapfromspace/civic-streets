// WS2: SVG Renderer — public API

export { CrossSectionSVG, renderToStaticSVG } from './CrossSectionSVG';
export type { CrossSectionSVGProps } from './CrossSectionSVG';

export { BeforeAfterView } from './BeforeAfterView';
export type { BeforeAfterViewProps } from './BeforeAfterView';

export { generateAltText } from './alt-text';

// Sub-components (for advanced usage / customization)
export { ElementRect } from './components/ElementRect';
export type { ElementRectProps } from './components/ElementRect';

export { DimensionLabel } from './components/DimensionLabel';
export type { DimensionLabelProps } from './components/DimensionLabel';

export { ValidationOverlay } from './components/ValidationOverlay';
export type { ValidationOverlayProps } from './components/ValidationOverlay';

export { StreetLabel } from './components/StreetLabel';
export type { StreetLabelProps } from './components/StreetLabel';

// Renderer constants (for consumers that need to coordinate layout)
export { PX_PER_FOOT, DISPLAY_HEIGHT, EXPORT_HEIGHT } from './constants';
