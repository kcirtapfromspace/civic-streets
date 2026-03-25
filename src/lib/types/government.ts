export type CoverageStatus =
  | 'unsigned'
  | 'outreach'
  | 'pilot'
  | 'active'
  | 'paused';

export type JurisdictionContactType = 'municipal' | 'district_representative';

export type OutreachRequestStatus =
  | 'collecting_contacts'
  | 'queued_review'
  | 'ready'
  | 'sent'
  | 'blocked';

export interface JurisdictionContact {
  contactId: string;
  contactType: JurisdictionContactType;
  officeType: string;
  districtLabel: string | null;
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  sourceUrl: string;
  confidence: number;
  freshUntil: number;
}

export interface JurisdictionSummary {
  coverageId: string | null;
  slug: string;
  displayName: string;
  jurisdictionType: string;
  stateCode: string | null;
  status: CoverageStatus;
  isSigned: boolean;
  officialWebsiteUrl: string | null;
  contactCount: number;
  freshContactCount: number;
  topContacts: JurisdictionContact[];
  lastContactSyncAt: number | null;
  lastDiscoveryAttemptAt: number | null;
}

export interface GovernmentLead {
  leadId: string;
  jurisdictionName: string;
  workEmail: string;
  roleTitle: string;
  sourceSurface: string;
  requestedFeature: string | null;
  status: string;
  submissionCount: number;
  lastSubmittedAt: number;
}

export interface GovernmentHubContext {
  coverage: JurisdictionSummary | null;
  latestLead: GovernmentLead | null;
}
