import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useMemo } from 'react';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

interface ConvexClientProviderProps {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!client) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#FEF3C7',
            color: '#92400E',
            padding: '8px 16px',
            fontSize: '14px',
            textAlign: 'center',
            borderBottom: '1px solid #F59E0B',
          }}
        >
          Convex not connected &mdash; set VITE_CONVEX_URL
        </div>
        {children}
      </>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
