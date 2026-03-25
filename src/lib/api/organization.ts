import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from './auth';

export interface OrganizationContext {
  organizationId: string;
  workspaceId: string | null;
  name: string;
  slug: string;
  organizationType: string;
  jurisdictionName: string | null;
  populationBand: string;
  contractTier: string;
  procurementState: string;
  invoiceMode: string;
  purchaseOrderNumber: string | null;
  contractRenewalDate: string | null;
  memberRole: string;
  workspaceName: string | null;
}

interface UseOrganizationContextOptions {
  bootstrapIfMissing?: boolean;
}

function toIsoStringFromTimestamp(value: number): string {
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toISOString();
}

function normalizeOrganizationContext(value: unknown): OrganizationContext | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    organizationId:
      typeof raw.organizationId === 'string' ? raw.organizationId : '',
    workspaceId:
      typeof raw.workspaceId === 'string' ? raw.workspaceId : null,
    name: typeof raw.name === 'string' ? raw.name : 'Curbwise Organization',
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    organizationType:
      typeof raw.organizationType === 'string'
        ? raw.organizationType
        : 'individual',
    jurisdictionName:
      typeof raw.jurisdictionName === 'string' ? raw.jurisdictionName : null,
    populationBand:
      typeof raw.populationBand === 'string' ? raw.populationBand : 'individual',
    contractTier:
      typeof raw.contractTier === 'string' ? raw.contractTier : 'civic_free',
    procurementState:
      typeof raw.procurementState === 'string' ? raw.procurementState : 'none',
    invoiceMode:
      typeof raw.invoiceMode === 'string' ? raw.invoiceMode : 'self_serve',
    purchaseOrderNumber:
      typeof raw.purchaseOrderNumber === 'string'
        ? raw.purchaseOrderNumber
        : null,
    contractRenewalDate:
      typeof raw.contractRenewalDate === 'number'
        ? toIsoStringFromTimestamp(raw.contractRenewalDate)
        : typeof raw.contractRenewalDate === 'string'
          ? raw.contractRenewalDate
          : null,
    memberRole: typeof raw.memberRole === 'string' ? raw.memberRole : 'owner',
    workspaceName:
      typeof raw.workspaceName === 'string' ? raw.workspaceName : null,
  };
}

export function useOrganizationContext(
  options: UseOrganizationContextOptions = {},
) {
  const { bootstrapIfMissing = false } = options;
  const { sessionToken } = useAuth();
  const bootstrap = useMutation(api.organizations.bootstrapCurrentOrganization);
  const didBootstrapRef = useRef(false);
  const rawContext = useQuery(
    api.organizations.getCurrentOrganizationContext,
    sessionToken ? { sessionToken } : 'skip',
  );

  useEffect(() => {
    didBootstrapRef.current = false;
  }, [bootstrapIfMissing, sessionToken]);

  useEffect(() => {
    if (
      !bootstrapIfMissing ||
      !sessionToken ||
      rawContext !== null ||
      didBootstrapRef.current
    ) {
      return;
    }
    didBootstrapRef.current = true;
    void bootstrap({ sessionToken });
  }, [bootstrap, bootstrapIfMissing, rawContext, sessionToken]);

  const organization = useMemo(
    () => normalizeOrganizationContext(rawContext),
    [rawContext],
  );

  return {
    organization,
    organizationLoading: sessionToken
      ? rawContext === undefined || (bootstrapIfMissing && rawContext === null)
      : false,
  };
}
