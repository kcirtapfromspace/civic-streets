import { useCallback, useMemo, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from './auth';
import type {
  GovernmentHubContext,
  GovernmentLead,
  JurisdictionContact,
  JurisdictionSummary,
} from '@/lib/types/government';

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeContact(value: unknown): JurisdictionContact | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.contactId !== 'string') {
    return null;
  }
  return {
    contactId: raw.contactId,
    contactType:
      raw.contactType === 'district_representative'
        ? 'district_representative'
        : 'municipal',
    officeType: typeof raw.officeType === 'string' ? raw.officeType : 'general',
    districtLabel:
      typeof raw.districtLabel === 'string' ? raw.districtLabel : null,
    name: typeof raw.name === 'string' ? raw.name : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    email: typeof raw.email === 'string' ? raw.email : null,
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : '',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
    freshUntil: typeof raw.freshUntil === 'number' ? raw.freshUntil : 0,
  };
}

function normalizeJurisdictionSummary(value: unknown): JurisdictionSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.slug !== 'string' || typeof raw.displayName !== 'string') {
    return null;
  }

  return {
    coverageId: typeof raw.coverageId === 'string' ? raw.coverageId : null,
    slug: raw.slug,
    displayName: raw.displayName,
    jurisdictionType:
      typeof raw.jurisdictionType === 'string' ? raw.jurisdictionType : 'city',
    stateCode: typeof raw.stateCode === 'string' ? raw.stateCode : null,
    status:
      raw.status === 'outreach' ||
      raw.status === 'pilot' ||
      raw.status === 'active' ||
      raw.status === 'paused'
        ? raw.status
        : 'unsigned',
    isSigned: raw.isSigned === true,
    officialWebsiteUrl:
      typeof raw.officialWebsiteUrl === 'string' ? raw.officialWebsiteUrl : null,
    contactCount: typeof raw.contactCount === 'number' ? raw.contactCount : 0,
    freshContactCount:
      typeof raw.freshContactCount === 'number' ? raw.freshContactCount : 0,
    topContacts: Array.isArray(raw.topContacts)
      ? raw.topContacts
          .map(normalizeContact)
          .filter((contact): contact is JurisdictionContact => Boolean(contact))
      : [],
    lastContactSyncAt: toNumberOrNull(raw.lastContactSyncAt),
    lastDiscoveryAttemptAt: toNumberOrNull(raw.lastDiscoveryAttemptAt),
  };
}

function normalizeLead(value: unknown): GovernmentLead | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.leadId !== 'string') {
    return null;
  }

  return {
    leadId: raw.leadId,
    jurisdictionName:
      typeof raw.jurisdictionName === 'string' ? raw.jurisdictionName : '',
    workEmail: typeof raw.workEmail === 'string' ? raw.workEmail : '',
    roleTitle: typeof raw.roleTitle === 'string' ? raw.roleTitle : '',
    sourceSurface:
      typeof raw.sourceSurface === 'string' ? raw.sourceSurface : 'account',
    requestedFeature:
      typeof raw.requestedFeature === 'string' ? raw.requestedFeature : null,
    status: typeof raw.status === 'string' ? raw.status : 'new',
    submissionCount:
      typeof raw.submissionCount === 'number' ? raw.submissionCount : 1,
    lastSubmittedAt:
      typeof raw.lastSubmittedAt === 'number' ? raw.lastSubmittedAt : Date.now(),
  };
}

export interface GovernmentLeadInput {
  jurisdictionName: string;
  workEmail: string;
  roleTitle: string;
  phone?: string;
  populationBand?: string;
  notes?: string;
  sourceSurface: 'landing' | 'account';
  requestedFeature?: string;
  hotspotId?: string;
  reportId?: string;
  designId?: string;
}

export interface UnsignedOutreachInput {
  sourceAction: 'report_to_city' | 'send_to_rep';
  hotspot: {
    id?: string;
    title: string;
    description: string;
    address: string;
    lat: number;
    lng: number;
    category: string;
    upvotes?: number;
  };
}

export function useGovernmentLeadSubmission() {
  const { sessionToken } = useAuth();
  const submitLeadMutation = useMutation(api.government.submitGovernmentLead);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLead = useCallback(
    async (input: GovernmentLeadInput) => {
      if (!sessionToken) {
        throw new Error('No active session');
      }
      setIsSubmitting(true);
      try {
        return await submitLeadMutation({
          sessionToken,
          ...input,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionToken, submitLeadMutation],
  );

  return {
    submitLead,
    isSubmitting,
  };
}

export function useGovernmentHub() {
  const { sessionToken } = useAuth();
  const raw = useQuery(
    api.government.getGovernmentHubContext,
    sessionToken ? { sessionToken } : 'skip',
  );

  const hub = useMemo<GovernmentHubContext | null>(() => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const value = raw as Record<string, unknown>;
    return {
      coverage: normalizeJurisdictionSummary(value.coverage),
      latestLead: normalizeLead(value.latestLead),
    };
  }, [raw]);

  return {
    hub,
    isLoading: sessionToken ? raw === undefined : false,
  };
}

export function useJurisdictionSummaryForLocation(args: {
  address: string;
  lat: number;
  lng: number;
}) {
  const raw = useQuery(
    api.government.getJurisdictionSummaryForLocation,
    args.address
      ? {
          address: args.address,
          lat: args.lat,
          lng: args.lng,
        }
      : 'skip',
  );

  return {
    summary: useMemo(() => normalizeJurisdictionSummary(raw), [raw]),
    isLoading: args.address ? raw === undefined : false,
  };
}

export function useUnsignedOutreach() {
  const convex = useConvex();
  const { sessionToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queueUnsignedOutreach = useCallback(
    async (input: UnsignedOutreachInput) => {
      if (!sessionToken) {
        throw new Error('No active session');
      }

      setIsSubmitting(true);
      try {
        return await convex.action(api.governmentActions.queueUnsignedOutreach, {
          sessionToken,
          ...input,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [convex, sessionToken],
  );

  return {
    queueUnsignedOutreach,
    isSubmitting,
  };
}
