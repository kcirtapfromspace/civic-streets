import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useMemo } from 'react';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

/** Whether a Convex backend is configured. Components use this to switch between Convex hooks and mock data. */
export const convexAvailable = !!convexUrl;

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!client) {
    // Silently fall back to mock data — no yellow banner
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
