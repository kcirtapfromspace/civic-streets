import { Document, Page, View, Text, Image, Link } from '@react-pdf/renderer';
import type { DiscussionBriefContext, StreetSegment, ValidationResult } from '@/lib/types';
import type { BriefPhoto } from './pdf-evidence';
import { styles, colors, ELEMENT_TYPE_COLORS } from './pdf-styles';

function displayName(value: string): string {
  return value.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function dateLabel(value: number): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : 'Date unavailable';
}

function PageHeader({ title }: { title: string }) {
  return <View style={styles.header} fixed>
    <Text style={styles.headerTitle}>{title}</Text>
    <Text style={styles.headerDate}>Curbwise</Text>
  </View>;
}

function PageFooter() {
  return <View style={styles.footer} fixed>
    <Text style={styles.footerText}>Discussion material · No engineering approval implied</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  </View>;
}

function BriefField({ label, text }: { label: string; text?: string }) {
  return <View style={{ marginBottom: 12 }}>
    <Text style={styles.sectionSubtitle}>{label}</Text>
    <Text style={styles.body}>{text?.trim() || 'Not provided.'}</Text>
  </View>;
}

const SOURCE_LABELS = {
  community: 'Community observation',
  example: 'Example observation · Not a verified community submission',
  'browser-session': 'Browser-session observation · Not a published community submission',
};

function BriefPage({ title, briefContext, photos, location, generatedAt, evidenceOnly = false }: {
  title: string;
  briefContext?: DiscussionBriefContext;
  photos: BriefPhoto[];
  location?: { address?: string; lat?: number; lng?: number };
  generatedAt: number;
  evidenceOnly?: boolean;
}) {
  const observation = briefContext?.observation;
  const place = observation ?? location;
  return <Page size="LETTER" style={styles.page}>
    <PageHeader title="Discussion brief" />
    <Text style={styles.briefTitle}>{title}</Text>
    {briefContext?.briefId && <Text style={styles.caption}>Brief: {briefContext.briefId}{briefContext.revisedAt ? ` · Revision: ${briefContext.revisedAt}` : ''}</Text>}
    <Text style={styles.body}>{place?.address || 'Address not provided.'}</Text>
    {typeof place?.lat === 'number' && typeof place?.lng === 'number' && <Text style={styles.caption}>Location: {place.lat.toFixed(5)}, {place.lng.toFixed(5)}</Text>}
    <BriefField label="The concern" text={briefContext?.concern} />
    <BriefField label="What we would like to improve" text={briefContext?.desiredOutcome} />
    <BriefField label="What we are asking for" text={briefContext?.requestedNextStep} />
    {observation ? <View>
      <Text style={styles.sectionSubtitle}>Observation evidence</Text>
      <Text style={styles.caption}>{SOURCE_LABELS[observation.source]}</Text>
      <Text style={styles.caption}>Saved {dateLabel(observation.createdAt)} · Reference: {observation.id}</Text>
      {briefContext?.sourceUrl && observation.source === 'community' && <Link style={styles.caption} src={briefContext.sourceUrl}>Source observation: {briefContext.sourceUrl}</Link>}
      <Text style={styles.body}>{observation.description || 'No original notes supplied.'}</Text>
      <Text style={styles.caption}>Snapshot retained with this brief; the source may have changed. The saved date is not a verified photo capture date.</Text>
      {photos.map((photo, index) => <View key={`${index}-${photo.source}`} wrap={false} style={{ marginTop: 12 }}>
        {photo.image && <Image src={photo.image} style={styles.evidencePhoto} />}
        <Text style={styles.caption}>{photo.image ? `Observation photo ${index + 1}` : `Observation photo ${index + 1} unavailable for this export. Reopen the observation to view it.`}</Text>
      </View>)}
      {observation.photoUrls.length === 0 && <Text style={styles.caption}>No photos attached.</Text>}
      {observation.photoUrls.length > 3 && <Text style={styles.caption}>The first three attached photos are included when available; additional photos remain in the source observation.</Text>}
    </View> : <Text style={styles.caption}>No linked observation supplied. The concern and location have not been independently verified.</Text>}
    {briefContext?.supportingEvidence && <View>
      <Text style={styles.sectionSubtitle}>{briefContext.supportingEvidence.title}</Text>
      <Text style={styles.body}>{briefContext.supportingEvidence.summary}</Text>
      <Text style={styles.caption}>Snapshot: {briefContext.supportingEvidence.capturedAt}</Text>
      {briefContext.supportingEvidence.details.map((detail, index) => <Text key={index} style={styles.body}>{detail}</Text>)}
      {briefContext.supportingEvidence.sources.map((source, index) => <Link key={index} style={styles.caption} src={source.url}>{source.label}: {source.url}</Link>)}
    </View>}
    <Text style={[styles.caption, { marginTop: 18 }]}>
      {evidenceOnly
        ? 'Evidence-only brief. No street geometry or standards checks are included. This document does not submit a request to an agency.'
        : 'Concept for discussion. Review the dimensions, assumptions, and limited checks on the following pages. This document does not submit a request to an agency.'}
    </Text>
    <Text style={styles.caption}>Prepared {dateLabel(generatedAt)} (UTC).</Text>
    <PageFooter />
  </Page>;
}

function DimensionNote({ context }: { context?: DiscussionBriefContext }) {
  const basis = context?.dimensionBasis ?? 'assumed';
  return <View style={styles.note}>
    <Text style={styles.body}>Existing-condition dimension basis: {displayName(basis)}.</Text>
    <Text style={styles.caption}>{basis === 'measured'
      ? 'The author describes existing dimensions as measured; Curbwise has not verified the measurements.'
      : 'Existing dimensions are working assumptions, not a verified site survey.'}</Text>
    <Text style={styles.caption}>Proposed widths remain concept allocations, not surveyed conditions.</Text>
    <Text style={styles.caption}>Source or method: {context?.dimensionSource.trim() || 'Not provided.'}</Text>
  </View>;
}

function CrossSection({ street, label }: { street: StreetSegment; label: string }) {
  const validWidths = street.elements.length > 0 && street.elements.every((element) => Number.isFinite(element.width) && element.width > 0);
  const totalWidth = street.elements.reduce((sum, element) => sum + element.width, 0);
  return <View wrap={false} style={{ marginBottom: 16 }}>
    <Text style={[styles.sectionSubtitle, { marginTop: 6, marginBottom: 4 }]}>{label}</Text>
    <Text style={styles.caption}>Declared right-of-way: {street.totalROWWidth} ft · {displayName(street.direction)}</Text>
    {validWidths ? <View style={styles.crossSectionContainer}>
      {street.elements.map((element, index) => <View key={element.id} style={[
        styles.crossSectionElement,
        { width: `${(element.width / totalWidth) * 100}%`, backgroundColor: ELEMENT_TYPE_COLORS[element.type] },
      ]}>
        {element.width / totalWidth >= 0.04 && <>
          <Text style={styles.crossSectionNumber}>{index + 1}</Text>
          <Text style={styles.crossSectionNumber}>{element.width} ft</Text>
        </>}
      </View>)}
    </View> : <Text style={styles.body}>Diagram unavailable: every element needs a positive, finite width.</Text>}
    <Text style={styles.caption}>{street.elements.map((element, index) => `${index + 1}. ${element.label || displayName(element.type)} (${element.width} ft)`).join(' · ')}</Text>
  </View>;
}

function ChangeSummary({ before, after }: { before: StreetSegment; after: StreetSegment }) {
  const types = [...new Set([...before.elements, ...after.elements].map((element) => element.type))];
  const changes = types.flatMap((type) => {
    const beforeWidth = before.elements.filter((element) => element.type === type).reduce((sum, element) => sum + element.width, 0);
    const afterWidth = after.elements.filter((element) => element.type === type).reduce((sum, element) => sum + element.width, 0);
    const delta = afterWidth - beforeWidth;
    return Math.abs(delta) < 0.01 ? [] : [`${displayName(type)}: ${beforeWidth.toFixed(1)} ft to ${afterWidth.toFixed(1)} ft (${delta > 0 ? '+' : ''}${delta.toFixed(1)} ft)`];
  });
  return <View>
    <Text style={styles.sectionSubtitle}>Space allocation changes</Text>
    {changes.length > 0 ? changes.map((change) => <Text key={change} style={[styles.body, { fontSize: 9, marginBottom: 3 }]}>{change}</Text>) : <Text style={styles.body}>No width allocation changes by element type.</Text>}
    <Text style={styles.caption}>Widths are summed by element type across the street. These changes do not predict traffic, safety, accessibility, or other real-world outcomes.</Text>
  </View>;
}

function ConceptPage({ currentStreet, beforeStreet, briefContext }: StreetReportDocumentProps) {
  return <Page size="LETTER" style={styles.page}>
    <PageHeader title="A concept to discuss" />
    <DimensionNote context={briefContext} />
    {beforeStreet ? <CrossSection street={beforeStreet} label="Before · recorded or assumed layout" /> : <Text style={styles.caption}>No before layout supplied.</Text>}
    <CrossSection street={currentStreet} label="After · proposed layout" />
    {beforeStreet && <ChangeSummary before={beforeStreet} after={currentStreet} />}
    <Text style={[styles.caption, { marginTop: 12 }]}>Schematic cross-sections, proportional within each diagram. Intersection geometry, grades, and conditions along the street are not represented.</Text>
    <PageFooter />
  </Page>;
}

function WidthTable({ street }: { street: StreetSegment }) {
  const columns = ['24%', '10%', '12%', '12%', '12%', '30%'];
  return <View style={styles.table}>
    <View style={styles.tableHeader}>
      {['Element', 'Side', 'Width', 'Min.', 'Rec. min.', 'Stored guidance source'].map((label, index) => <Text key={label} style={[styles.tableHeaderCell, { width: columns[index] }]}>{label}</Text>)}
    </View>
    {street.elements.map((element) => <View key={element.id} style={styles.tableRow} wrap={false}>
      {[element.label || displayName(element.type), displayName(element.side), `${element.width} ft`, `${element.constraints.absoluteMin} ft`, `${element.constraints.recommendedMin} ft`, element.constraints.source].map((value, index) => <Text key={index} style={[styles.tableCell, { width: columns[index] }]}>{value}</Text>)}
    </View>)}
  </View>;
}

function ChecksPage({ currentStreet, validationResults, validationStatus = 'complete', generatedAt }: StreetReportDocumentProps) {
  const errors = validationResults.filter((result) => result.severity === 'error').length;
  const warnings = validationResults.filter((result) => result.severity === 'warning').length;
  const notes = validationResults.filter((result) => result.severity === 'info').length;
  return <Page size="LETTER" style={styles.page}>
    <PageHeader title="Appendix · Dimensions and limited checks" />
    <Text style={styles.sectionTitle}>{currentStreet.name}</Text>
    <Text style={styles.body}>Declared right-of-way: {currentStreet.totalROWWidth} ft · Curb-to-curb: {currentStreet.curbToCurbWidth} ft</Text>
    <Text style={styles.caption}>Functional class: {displayName(currentStreet.functionalClass)}{currentStreet.metadata.templateId ? ` · Template: ${currentStreet.metadata.templateId}` : ''}</Text>
    <WidthTable street={currentStreet} />
    <Text style={styles.caption}>Min. and recommended minimum values above are stored element guidance, not a complete specification or proof that local requirements are met.</Text>
    <Text style={styles.sectionSubtitle}>Selected dimensional checks</Text>
    <Text style={styles.body}>The validator compares supported element widths against stored minimum, maximum, and recommended widths, including applicable stored PROWAG width entries and NACTO guidance. It also compares summed widths with the declared right-of-way and curb-to-curb widths.</Text>
    {validationStatus === 'complete' ? <Text style={styles.body}>Reported findings: {errors} errors · {warnings} warnings · {notes} guidance notes</Text> : <Text style={styles.body}>Checks not completed. No compliance assessment is available. Run the selected checks before using their results.</Text>}
    <Text style={styles.caption}>These are findings, not a count of checks performed. An empty result does not establish compliance or approval.</Text>
    {validationStatus === 'complete' && validationResults.map((result, index) => <View key={index} style={[styles.validationItem, { borderLeftColor: colors[result.severity] }]} wrap={false}>
      <View style={{ flex: 1 }}>
        <Text style={styles.validationMessage}>{displayName(result.severity)} · {result.message}</Text>
        <Text style={styles.validationCitation}>{result.citation} · Entered: {result.currentValue} ft · Comparison value: {result.requiredValue} ft</Text>
      </View>
    </View>)}
    {validationStatus === 'complete' && validationResults.length === 0 && <Text style={styles.body}>No findings were reported by the selected dimensional checks.</Text>}
    <Text style={styles.sectionSubtitle}>Still to be assessed</Text>
    <Text style={styles.body}>Local requirements, verified site dimensions, right-of-way boundaries, slopes, crossing and curb-ramp details, sight distance, traffic operations, drainage, utilities, construction feasibility, and broader accessibility are not assessed here.</Text>
    <Text style={styles.body}>Citations identify guidance stored in the app. Check the original sources, their applicability, and current local requirements with the intended reviewer. This is not a comprehensive engineering, legal, or accessibility assessment.</Text>
    <Text style={styles.caption}>Prepared with Curbwise on {dateLabel(generatedAt)} (UTC). Use this brief to discuss a next step, not as construction documentation.</Text>
    <PageFooter />
  </Page>;
}

interface StreetReportDocumentProps {
  currentStreet: StreetSegment;
  beforeStreet: StreetSegment | null;
  validationResults: ValidationResult[];
  validationStatus?: 'idle' | 'pending' | 'complete' | 'error';
  briefContext?: DiscussionBriefContext;
  photos: BriefPhoto[];
  generatedAt: number;
}

export function StreetReportDocument(props: StreetReportDocumentProps) {
  return <Document title={`${props.currentStreet.name} · Discussion brief`} author="Curbwise" subject="Street concern and concept for discussion">
    <BriefPage title={props.currentStreet.name} briefContext={props.briefContext} photos={props.photos} location={props.currentStreet.location} generatedAt={props.generatedAt} />
    <ConceptPage {...props} />
    <ChecksPage {...props} />
  </Document>;
}

export function ObservationBriefDocument({ briefContext, photos, location, generatedAt }: { briefContext: DiscussionBriefContext; photos: BriefPhoto[]; location?: { name: string; address?: string; lat?: number; lng?: number }; generatedAt: number }) {
  const title = briefContext.observation?.title || location?.name || 'Street concern';
  return <Document title={`${title} · Discussion brief`} author="Curbwise" subject="Observation evidence for discussion">
    <BriefPage title={title} briefContext={briefContext} photos={photos} location={location} generatedAt={generatedAt} evidenceOnly />
  </Document>;
}
