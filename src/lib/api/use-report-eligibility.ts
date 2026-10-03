import { convexAvailable } from './convex-provider';
import { useAuth } from './auth';

export type ReportEligibility = 'ready' | 'loading' | 'unavailable';

function useConnectedReportEligibility(): ReportEligibility {
  const { user, isLoading } = useAuth();
  if (isLoading) return 'loading';
  return user ? 'ready' : 'unavailable';
}

/** Configuration is fixed for the lifetime of the application. */
export const useReportEligibility = convexAvailable ? useConnectedReportEligibility : (): ReportEligibility => 'ready';
