// Report template generator — prepares resident concerns and preliminary concepts.
// Recorded activity and limited automated checks do not establish consensus or approval.

export interface ReportTemplateInput {
  repName: string;
  address: string;
  senderName?: string;
  // Hotspot context
  hotspotTitle?: string;
  hotspotCategory?: string;
  hotspotDescription?: string;
  hotspotVotes?: number;
  // Design context
  designTitle?: string;
  designElements?: string; // "bike lanes, wider sidewalks, center turn lane"
  prowagCompliant?: boolean;
  // Community
  communityVotes?: number;
}

type TemplateVariant = 'safety-concern' | 'design-proposal' | 'combined' | 'general';

function detectVariant(input: ReportTemplateInput): TemplateVariant {
  const hasHotspot = Boolean(input.hotspotTitle || input.hotspotCategory);
  const hasDesign = Boolean(input.designTitle);

  if (hasHotspot && hasDesign) return 'combined';
  if (hasHotspot) return 'safety-concern';
  if (hasDesign) return 'design-proposal';
  return 'general';
}

export function generateReportSubject(input: ReportTemplateInput): string {
  const variant = detectVariant(input);

  switch (variant) {
    case 'safety-concern':
      return `Street Safety Concern at ${input.address}`;
    case 'design-proposal':
      return `Street Design Proposal for ${input.address}`;
    case 'combined':
      return `Street Safety Concern and Design Proposal for ${input.address}`;
    case 'general':
      return `Street Improvement Request for ${input.address}`;
  }
}

export function generateReportBody(input: ReportTemplateInput): string {
  const variant = detectVariant(input);
  const lines: string[] = [];

  // Greeting
  lines.push(`Dear ${input.repName},`);
  lines.push('');

  // Opening
  lines.push(
    `I am writing as a concerned community member about ${input.address}.`,
  );
  lines.push('');

  // Hotspot section
  if (variant === 'safety-concern' || variant === 'combined') {
    const categoryLabel = input.hotspotCategory
      ? formatCategory(input.hotspotCategory)
      : 'safety';

    lines.push(
      `I would like you to review a ${categoryLabel} concern at this location.`,
    );

    if (input.hotspotDescription) {
      lines.push(`${input.hotspotDescription}`);
    }

    if (input.hotspotTitle) {
      lines.push(
        `The linked report on Curbwise is titled "${input.hotspotTitle}".`,
      );
    }

    lines.push('');
  }

  // Design section
  if (variant === 'design-proposal' || variant === 'combined') {
    lines.push(
      'I would like to discuss a preliminary street design concept for this area.',
    );

    if (input.designElements) {
      lines.push(
        `The concept explores ${input.designElements}.`,
      );
    }

    if (input.prowagCompliant === true) {
      lines.push(
        'The concept is marked as passing Curbwise’s selected PROWAG checks.',
      );
    } else if (input.prowagCompliant === false) {
      lines.push(
        'The concept is marked as having issues in Curbwise’s selected PROWAG checks that need review.',
      );
    }

    if (input.designTitle) {
      lines.push(
        `The design concept, "${input.designTitle}," is available for your review.`,
      );
    }

    lines.push(
      'This preliminary concept requires site measurements and professional review. Curbwise’s checks do not establish accessibility compliance, engineering approval, or city approval.',
    );

    lines.push('');
  }

  // General case
  if (variant === 'general') {
    lines.push(
      'I believe this location would benefit from street improvements that prioritize safety, accessibility, and comfort for all users, including pedestrians, cyclists, and transit riders.',
    );
    lines.push('');
    lines.push(
      'I would welcome a review of site conditions and applicable design and accessibility requirements.',
    );
    lines.push('');
  }

  // The caller supplies recorded counts only. Avoid adding overlapping counts
  // from a report and concept or presenting activity as neighborhood consensus.
  const recordedVotes = Math.max(input.hotspotVotes ?? 0, input.communityVotes ?? 0);
  if (Number.isSafeInteger(recordedVotes) && recordedVotes > 0) {
    lines.push(
      `A linked report or concept has ${recordedVotes} recorded ${recordedVotes === 1 ? 'upvote' : 'upvotes'} on Curbwise. This activity count does not establish wider community support.`,
    );
    lines.push('');
  }

  // Closing
  lines.push(
    'I would appreciate your attention to this matter and welcome the opportunity to discuss solutions that improve safety and accessibility for our community.',
  );
  lines.push('');
  lines.push('Respectfully,');

  if (input.senderName) {
    lines.push(input.senderName);
  } else {
    lines.push('[Your Name]');
  }

  return lines.join('\n');
}

function formatCategory(category: string): string {
  return category
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
