// Report template generator — produces professional civic engagement messages
// References NACTO and PROWAG standards where relevant

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

    const voterPhrase =
      input.hotspotVotes && input.hotspotVotes > 1
        ? `${input.hotspotVotes} community members`
        : 'community members';

    lines.push(
      `This location has been identified as a ${categoryLabel} concern by ${voterPhrase} on Curbwise, a civic engagement platform for street safety.`,
    );

    if (input.hotspotDescription) {
      lines.push(`${input.hotspotDescription}`);
    }

    if (input.hotspotTitle) {
      lines.push(
        `The concern is titled "${input.hotspotTitle}" and reflects observed conditions at this location.`,
      );
    }

    lines.push('');
  }

  // Design section
  if (variant === 'design-proposal' || variant === 'combined') {
    lines.push(
      'I have prepared a street design concept that addresses this area using nationally recognized street design standards.',
    );

    if (input.designElements) {
      lines.push(
        `The proposed design includes ${input.designElements}, following guidance from the NACTO Urban Street Design Guide.`,
      );
    }

    if (input.prowagCompliant === true) {
      lines.push(
        'The design meets PROWAG (Public Right-of-Way Accessibility Guidelines) accessibility requirements, ensuring the street is safe and usable for people of all abilities.',
      );
    } else if (input.prowagCompliant === false) {
      lines.push(
        'The design concept is a starting point for discussion. Some elements may require adjustment to fully meet PROWAG accessibility standards, which I am committed to incorporating.',
      );
    }

    if (input.designTitle) {
      lines.push(
        `The design concept, "${input.designTitle}," is available for your review.`,
      );
    }

    lines.push('');
  }

  // General case
  if (variant === 'general') {
    lines.push(
      'I believe this location would benefit from street improvements that prioritize safety, accessibility, and comfort for all users, including pedestrians, cyclists, and transit riders.',
    );
    lines.push('');
    lines.push(
      'The NACTO Urban Street Design Guide and PROWAG accessibility guidelines provide excellent frameworks for improvements that serve all community members.',
    );
    lines.push('');
  }

  // Community support
  if (input.communityVotes && input.communityVotes > 1) {
    lines.push(
      `This issue has received ${input.communityVotes} upvotes from community members, demonstrating broad support for improvement at this location.`,
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
