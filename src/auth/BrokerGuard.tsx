import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useBrokerAuth } from './BrokerAuthProvider';

/** Redirects to the broker sign-in page when there is no broker session. */
export function BrokerGuard({ children }: { children: ReactNode }) {
  const { session } = useBrokerAuth();

  if (!session) {
    return <Redirect to="/broker/signin" replace />;
  }

  return <>{children}</>;
}
