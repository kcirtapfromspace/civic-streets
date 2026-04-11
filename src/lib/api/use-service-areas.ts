import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

// ── Queries ─────────────────────────────────────────────────────────────────

export function useServiceAreas(organizationId: string | undefined) {
  return useQuery(
    api.serviceAreas.getActiveByOrganization,
    organizationId
      ? { organizationId: organizationId as Id<'organizations'> }
      : 'skip',
  );
}

export function useAllServiceAreas(organizationId: string | undefined) {
  return useQuery(
    api.serviceAreas.list,
    organizationId
      ? { organizationId: organizationId as Id<'organizations'> }
      : 'skip',
  );
}

export function useServiceAreaById(serviceAreaId: string | undefined) {
  return useQuery(
    api.serviceAreas.getById,
    serviceAreaId
      ? { serviceAreaId: serviceAreaId as Id<'serviceAreas'> }
      : 'skip',
  );
}

export function useHotspotsByServiceArea(serviceAreaId: string | undefined) {
  return useQuery(
    api.hotspots.getByServiceArea,
    serviceAreaId
      ? { serviceAreaId: serviceAreaId as Id<'serviceAreas'> }
      : 'skip',
  );
}

export function useHeatmapByServiceArea(serviceAreaId: string | undefined) {
  return useQuery(
    api.hotspots.getHeatmapByServiceArea,
    serviceAreaId
      ? { serviceAreaId: serviceAreaId as Id<'serviceAreas'> }
      : 'skip',
  );
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function useCreateServiceArea() {
  return useMutation(api.serviceAreas.create);
}

export function useUpdateServiceArea() {
  return useMutation(api.serviceAreas.update);
}

export function useRemoveServiceArea() {
  return useMutation(api.serviceAreas.remove);
}
