import { convexAvailable } from './convex-provider';
import { useAuth } from './auth';

export type PhotoRequirement = 'optional' | 'required' | 'loading' | 'unavailable';

function useConnectedPhotoRequirement(): PhotoRequirement {
  const { user, isLoading } = useAuth();
  if (isLoading) return 'loading';
  if (!user) return 'unavailable';
  return user.reputation < 10 ? 'required' : 'optional';
}

/** Configuration is fixed for the lifetime of the application. */
export const usePhotoRequirement = convexAvailable ? useConnectedPhotoRequirement : (): PhotoRequirement => 'optional';
