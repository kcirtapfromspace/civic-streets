import { StyleSheet } from '@react-pdf/renderer';

// ── Color Palette ────────────────────────────────────────────────────────────
export const colors = {
  primary: '#1A365D',       // Dark navy — headings
  secondary: '#2C5282',     // Medium blue — subheadings
  accent: '#3182CE',        // Bright blue — links/accents
  text: '#2D3748',          // Dark gray — body text
  textLight: '#718096',     // Medium gray — captions
  border: '#CBD5E0',        // Light gray — borders
  background: '#F7FAFC',    // Very light gray — table alternating rows
  white: '#FFFFFF',

  // Severity colors
  error: '#C53030',
  warning: '#C05621',
  info: '#2B6CB0',
  pass: '#276749',

  // Element type colors (simplified for PDF)
  sidewalk: '#D4C4A8',
  plantingStrip: '#7CB342',
  furnitureZone: '#A1887F',
  bikeLane: '#4CAF50',
  bikeLaneProtected: '#2E7D32',
  buffer: '#BDBDBD',
  parkingLane: '#78909C',
  travelLane: '#424242',
  turnLane: '#616161',
  transitLane: '#E53935',
  median: '#8BC34A',
  curb: '#9E9E9E',
} as const;

export const ELEMENT_TYPE_COLORS: Record<string, string> = {
  'sidewalk': colors.sidewalk,
  'planting-strip': colors.plantingStrip,
  'furniture-zone': colors.furnitureZone,
  'bike-lane': colors.bikeLane,
  'bike-lane-protected': colors.bikeLaneProtected,
  'buffer': colors.buffer,
  'parking-lane': colors.parkingLane,
  'travel-lane': colors.travelLane,
  'turn-lane': colors.turnLane,
  'transit-lane': colors.transitLane,
  'median': colors.median,
  'curb': colors.curb,
};

// ── Shared Styles ────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  // ── Page layout ─────────────────────────────────────
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
  },

  // ── Header/Footer ───────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  headerTitle: {
    fontSize: 10,
    color: colors.primary,
    fontFamily: 'Helvetica-Bold',
  },
  headerDate: {
    fontSize: 8,
    color: colors.textLight,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 7,
    color: colors.textLight,
  },

  // ── Cover page ──────────────────────────────────────
  coverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 16,
    color: colors.secondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  coverStreetName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  coverMeta: {
    fontSize: 11,
    color: colors.textLight,
    marginBottom: 6,
    textAlign: 'center',
  },
  coverDivider: {
    width: 120,
    height: 2,
    backgroundColor: colors.accent,
    marginVertical: 20,
  },

  // ── Section headings ────────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    marginBottom: 8,
    marginTop: 12,
  },

  // ── Cross-section diagram ───────────────────────────
  crossSectionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  crossSectionElement: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: '100%',
    paddingBottom: 4,
  },
  crossSectionLabel: {
    fontSize: 6,
    color: colors.white,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    maxLines: 2,
  },
  crossSectionWidth: {
    fontSize: 7,
    color: colors.white,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Table styles ────────────────────────────────────
  table: {
    marginVertical: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tableCell: {
    fontSize: 8,
    color: colors.text,
  },

  // ── Validation results ──────────────────────────────
  validationItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderLeftWidth: 3,
    backgroundColor: colors.background,
    borderRadius: 2,
  },
  validationMessage: {
    fontSize: 8,
    color: colors.text,
    flex: 1,
  },
  validationCitation: {
    fontSize: 7,
    color: colors.textLight,
    marginTop: 2,
  },

  // ── Summary box ─────────────────────────────────────
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.textLight,
    marginTop: 2,
  },

  // ── Disclaimer ──────────────────────────────────────
  disclaimerBox: {
    marginTop: 40,
    padding: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.error,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 9,
    color: colors.text,
    marginBottom: 6,
    lineHeight: 1.4,
  },
});
